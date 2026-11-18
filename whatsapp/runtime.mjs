import { activeChild, familyStart, handleTurn } from "./bot.mjs";
import { copy } from "./copy.mjs";
import { mockTranscribe } from "./reading.mjs";

const DAY = 86400000;
export const emptyStore = () => ({ version: 1, families: [], pending: [], seen: {} });
async function digest(id) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

function inboundLabel(event, family) {
  const t = copy[family.lang ?? "kk"];
  if (event.kind === "audio") return t.received;
  if (event.kind === "consent") return t.formSent;
  if (event.kind === "profile") return t.profileSent;
  if (event.kind === "button") {
    if (event.value === "lang:kk") return "Қазақша";
    if (event.value === "lang:ru") return "Русский";
    for (const row of family.history.slice().reverse()) {
      const match = row.reply.buttons?.find(b => b.id === event.value);
      if (match) return match.title;
    }
    return Object.hasOwn(t, event.value) ? t[event.value] : t.menu;
  }
  return event.kind === "text" ? event.value || (family.lang === "ru" ? "Текстовое сообщение" : "Мәтіндік хабарлама") : "";
}

/** One FIFO worker and one writer per local simulator instance. */
export class ReadingRuntime {
  constructor({ library, state = emptyStore(), save = () => {}, transcribe = mockTranscribe, now = Date.now,
    pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    if (state.version !== 1 || !Array.isArray(state.pending) || !Array.isArray(state.families) || !state.seen) throw new Error("Unrecognised demo store");
    Object.assign(this, { library, state, save, transcribe, now, pause });
    this.running = null;
    if (state.families.some(f => this.expired(f.data))) this.commit(() => {});
  }
  expired(family) {
    return !family.consent && (family.firstContactAt ?? family.history[0]?.at ?? this.now()) < this.now() - 30 * DAY;
  }
  family(user) {
    const family = this.state.families.find(f => f.user === user)?.data;
    return family && !this.expired(family) ? structuredClone(family) : familyStart();
  }
  commit(change) {
    const next = structuredClone(this.state);
    change(next);
    next.families = next.families.filter(f => !this.expired(f.data));
    this.save(next);
    this.state = next;
  }
  async enqueue(events) {
    const jobs = await Promise.all(events.map(async ({ id, ...event }) => ({
      ...event, key: await digest(id), tries: 0,
    })));
    let count = 0;
    if (!jobs.length) return count;
    this.commit(s => {
      for (const job of jobs) {
        if (s.seen[job.key] || s.pending.some(p => p.key === job.key)) continue;
        if (job.kind === "audio" && !s.families.find(f => f.user === job.user)?.data.consent) {
          delete job.media;
          delete job.fixture;
        }
        s.pending.push(job);
        count++;
      }
    });
    return count;
  }
  async drain() {
    while (this.state.pending.length) {
      if (!this.running) this.running = this.work().finally(() => { this.running = null; });
      await this.running;
    }
  }
  async work() {
    while (this.state.pending.length) {
      const event = this.state.pending[0];
      if (event.kind === "identity") {
        this.commit(s => {
          const source = s.families.find(f => f.user === event.user);
          if (source && !s.families.some(f => f.user === event.newUser)) {
            source.user = event.newUser;
            for (const pending of s.pending) if (pending.user === event.user) pending.user = event.newUser;
          }
          s.pending.shift();
          s.seen[event.key] = this.now();
        });
        continue;
      }
      const family = this.family(event.user);
      family.firstContactAt ??= event.at;
      let reply;
      try {
        // A delayed worker must not issue a normal reply outside the service window.
        // Explicit deletion and opt-out are still honoured.
        const expired = this.now() - event.at >= DAY;
        const control = /^(delete|удалить|жою|stop|стоп|тоқта)$/i.test(event.value?.trim() ?? "");
        if (!expired || control) reply = await handleTurn(family, event, this);
        if (reply && !expired && !reply.erase) {
          const previous = this.family(event.user);
          family.history.push({ incoming: inboundLabel(event, previous), reply, at: event.at });
          family.history = family.history.slice(-60);
        }
      } catch (error) {
        if (event.tries < 2) {
          this.commit(s => { s.pending[0].tries++; });
          await this.pause(50 * (2 ** event.tries));
          continue;
        }
        const original = this.family(event.user);
        const t = copy[original.lang ?? "kk"];
        original.history.push({ incoming: inboundLabel(event, original), reply: { body: t.unavailable }, at: event.at });
        this.finish(event, original, false);
        continue;
      }
      this.finish(event, family, reply?.erase || !reply && !this.state.families.some(f => f.user === event.user), reply?.erase);
    }
  }
  finish(event, family, erase, purge = false) {
    this.commit(s => {
      s.pending.shift();
      s.seen[event.key] = this.now();
      if (purge) {
        for (const job of s.pending) if (job.user === event.user || job.newUser === event.user) s.seen[job.key] = this.now();
        s.pending = s.pending.filter(job => job.user !== event.user && job.newUser !== event.user);
      }
      for (const [key, at] of Object.entries(s.seen)) if (at < this.now() - 30 * DAY) delete s.seen[key];
      s.families = s.families.filter(f => f.user !== event.user);
      if (!erase) s.families.push({ user: event.user, data: family });
    });
  }
}

/** Project only what the simulator needs. The raw event queue and deduplication keys stay private. */
export function readerSummary(family, library) {
  const reader = activeChild(family);
  if (!reader) return null;
  const book = library[reader.language];
  return { name: reader.name, avatar: reader.avatar, language: reader.language, title: book.title,
    page: reader.page + 1, pages: book.pages.length, text: book.pages[reader.page], coins: reader.wallet.coins, streak: reader.wallet.streak };
}
