import { copy, greeting } from "./copy.mjs";
import { scoreReading, reward } from "./reading.mjs";
import { recordReading } from "./report.mjs";

export const CONSENT_VERSION = "demo-1";
export const ALIASES = ["Ару", "Мирас", "Дана", "Тимур"];
export const AVATARS = ["🐰", "🦊", "🐼", "🦉"];
export const familyStart = () => ({ lang: null, consent: null, children: [], active: null, stage: "language", reminders: false, history: [] });
const button = (id, title) => ({ id, title });
export const welcome = () => ({ body: greeting, buttons: [button("lang:kk", "Қазақша"), button("lang:ru", "Русский")] });
export const activeChild = family => family.children.find(c => c.id === family.active);
export const hasReadingConsent = consent => consent?.processing === true && consent.guardian === true && consent.withdrawnAt == null;

function profiles(family, t) {
  family.stage = "choose";
  const buttons = family.children.map(c => button("reader:" + c.id, c.avatar + " " + c.name));
  if (buttons.length < 4) buttons.push(button("add", t.add));
  return { body: t.choose, buttons };
}
function form(family, kind, body) {
  family.stage = kind;
  return { body, form: kind };
}
function pageView(family, library) {
  family.stage = "read";
  const child = activeChild(family), book = library[child.language];
  const t = copy[child.language];
  return { language: child.language, body: t.page, page: { title: book.title, number: child.page + 1, count: book.pages.length,
    language: child.language, text: book.pages[child.page] }, buttons: [button("listen", t.listen), button("help", t.help)] };
}
export function command(event) {
  if (event.kind === "button") return event.value;
  if (event.kind !== "text") return "";
  const text = event.value.trim().toLowerCase();
  if (["тоқта", "стоп", "stop"].includes(text)) return "stop";
  if (["жою", "удалить", "delete"].includes(text)) return "delete";
  if (["сәлем", "привет", "start", "/start", "мәзір", "меню"].includes(text)) return "menu";
  if (["көмек", "помощь", "help"].includes(text)) return "help";
  if (["есеп", "отчет", "отчёт", "report"].includes(text)) return "report";
  return "";
}

/** Mutates the worker's private copy. Only the local parent form can create consent or a child. */
export async function handleTurn(family, event, { library, transcribe, transcriberRegion }) {
  const action = command(event);
  let t = copy[family.lang ?? "kk"];
  if (action === "delete") return family.consent ? { parentAction: "delete", body: t.parentDelete } : { erase: true, body: t.deleted };
  if (action === "stop") { family.reminders = false; return { body: t.stopped }; }
  if (!family.lang) {
    if (action !== "lang:kk" && action !== "lang:ru") return welcome();
    family.lang = action.slice(5);
    return form(family, "consent", copy[family.lang].consent);
  }
  if (!hasReadingConsent(family.consent)) {
    if (event.kind !== "consent") return form(family, "consent", t.consent);
    if (event.guardian !== true || event.processing !== true) return form(family, "consent", t.needsConsent);
    if (!event.credential) return form(family, "consent", t.needsPin);
    family.consent = { version: CONSENT_VERSION, givenAt: event.at, guardian: true,
      processing: true, crossBorder: event.crossBorder === true, keepAudio: false };
    return form(family, "profile", t.profile);
  }
  if (action === "report") return { parentAction: "report", body: t.parentReport };
  if (action === "add") {
    if (family.children.length >= 4) return { ...profiles(family, t), body: t.full };
    return form(family, "profile", t.profile);
  }
  if (event.kind === "profile" && family.stage === "profile") {
    if (family.children.length >= 4) return profiles(family, t);
    const { name, age, language, avatar } = event;
    if (!ALIASES.includes(name) || !Number.isInteger(age) || age < 6 || age > 12 ||
        !Object.hasOwn(library, language) || !AVATARS.includes(avatar)) return form(family, "profile", t.invalidProfile);
    const child = { id: String(family.children.length + 1), name, age, language, avatar, page: 0, best: {}, finished: false,
      wallet: { coins: 0, streak: 0, earnedToday: 0, lastDay: null, freezeWeek: null } };
    family.children.push(child);
    family.active = child.id;
    return pageView(family, library);
  }
  if (!family.children.length) return form(family, "profile", t.profile);
  if (action === "menu" || action === "readers") return profiles(family, t);
  if (family.stage === "choose" && action.startsWith("reader:")) {
    const chosen = family.children.find(c => "reader:" + c.id === action);
    if (chosen) { family.active = chosen.id; return pageView(family, library); }
  }
  if (family.stage === "choose") return profiles(family, t);
  if (family.stage === "profile") return form(family, "profile", t.profile);
  const child = activeChild(family);
  if (!child) return profiles(family, t);
  t = copy[child.language];
  const language = child.language;
  const book = library[child.language], page = book.pages[child.page];
  const pageKey = child.id + ":" + child.page;
  if (action === "next:" + pageKey && family.stage === "passed") {
    if (child.page + 1 === book.pages.length) {
      family.stage = "finished";
      return { language, body: t.finished, buttons: [button("restart", t.restartBook), button("readers", t.readers)] };
    }
    child.page++;
    return pageView(family, library);
  }
  if (action === "restart" && family.stage === "finished") child.page = 0;
  if (action === "again" || action === "resume" || action === "restart") return pageView(family, library);
  if (action === "listen") return { language, body: t.narrator, narration: { text: page, language }, buttons: [button("again", t.again)] };
  if (event.kind !== "audio" || family.stage === "finished") {
    return { language, body: action === "help" ? t.helpText : t.scope, buttons: [button("resume", t.resume), button("readers", t.readers)] };
  }
  const forReview = () => ({ language, body: t.adultReview, reviewReader: child.id, buttons: [button("again", t.again)] });
  if (event.flagged) return forReview();
  const allowed = ["local", "KZ"].includes(transcriberRegion) || (transcriberRegion === "crossBorder" && family.consent.crossBorder === true);
  if (!allowed) return { language, body: t.providerUnavailable, buttons: [button("again", t.again)] };
  const audio = await transcribe(event, page, child.language);
  if (audio.flagged === true) return forReview();
  if (audio.issue) return { language, body: t[audio.issue] || t.unavailable, buttons: [button("again", t.again)] };
  const score = scoreReading(page, audio.transcript, audio.seconds, child.language);
  const previouslyFinished = child.finished;
  const coins = reward(child, child.page, book.pages.length, score, event.at);
  recordReading(child, { score, seconds: audio.seconds, at: event.at, bookFinished: !previouslyFinished && child.finished });
  const passed = score.accuracy >= 0.6;
  family.stage = passed ? "passed" : "read";
  const praise = score.accuracy >= 0.9 ? t.excellent : passed ? t.good : t.gentle;
  const metrics = [];
  if (score.accuracy >= 0.4) metrics.push(Math.round(100 * score.accuracy) + "% " + t.accuracy);
  metrics.push("+" + coins + " 🪙", "🔥 " + child.wallet.streak + " " + t.days);
  const caption = [praise, metrics.join(" · "), audio.clipped ? t.clipped : ""].filter(Boolean).join("\n");
  const next = child.page + 1 === book.pages.length ? t.finish : t.next;
  return { language, body: caption, reaction: "👂",
    card: { title: book.title, page: child.page + 1, text: page, marks: score.marks, stars: score.stars },
    buttons: [passed ? button("next:" + pageKey, next) : button("listen", t.listen), button("again", t.again)], openBookser: true };
}
