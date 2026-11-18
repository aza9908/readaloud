import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { loadLibrary } from "../whatsapp/build-simulator.mjs";
import { CONSENT_VERSION } from "../whatsapp/bot.mjs";
import { DEMO_USER, demoEnvelope, parseWebhook, simulateTurn } from "../whatsapp/events.mjs";
import { mockTranscribe, reward, scoreReading } from "../whatsapp/reading.mjs";
import { ReadingRuntime } from "../whatsapp/runtime.mjs";
import { parentAction } from "../whatsapp/parent.mjs";
import { createWhatsAppServer, localStore, signature } from "../whatsapp/server.mjs";
import { feedbackSvg } from "../whatsapp/simulator/card.mjs";

const library = await loadLibrary();
const time = Date.parse("2026-11-18T17:00:00Z");
let seq = 0;
const id = () => "wamid.test." + ++seq;
const button = value => ({ kind: "button", value });
const consent = { kind: "consent", guardian: true, processing: true, crossBorder: false, pin: "0432", confirmPin: "0432" };
const profile = { kind: "profile", name: "Ару", age: 8, language: "kk", avatar: "🐰" };
const note = (transcript, language = "kk") => ({ kind: "audio", transcript, language, seconds: 30 });
const message = (packet, mid = id()) => parseWebhook(demoEnvelope(packet, mid, time));
const newest = family => family.history.at(-1).reply;
function setup(options = {}) {
  const runtime = new ReadingRuntime({ library, now: () => time, pause: async () => {}, transcriberRegion: "local", ...options });
  const send = (input, mid = id()) => simulateTurn(runtime, { ...input, id: mid }, async (envelope, fixture) => {
    return runtime.enqueue(parseWebhook(envelope).map(e => fixture ? { ...e, fixture } : e));
  }, runtime.now());
  const onboard = async (lang = "kk") => {
    await send(button("lang:" + lang)); await send(consent);
    return (await send({ ...profile, language: lang })).family;
  };
  return { runtime, send, onboard, family: () => runtime.family(DEMO_USER) };
}

test("both seed stories are preserved as complete 15–60 word pages", () => {
  assert.equal(library.kk.title, "Батыл қоян"); assert.equal(library.ru.title, "Репка");
  assert.equal(library.kk.pages.length, 5); assert.equal(library.ru.pages.length, 6);
  for (const book of Object.values(library)) for (const page of book.pages) {
    const score = scoreReading(page, page, 30, "kk");
    assert.ok(score.total >= 15 && score.total <= 60); assert.equal(score.accuracy, 1);
  }
});
test("alignment preserves Kazakh distinctions, offsets, near matches, insertions and repetitions", () => {
  const s = scoreReading("Қар, үй. Ёжик ойнады түн!", "кар үй eжик үй ойнады", 30, "kk");
  assert.deepEqual(s.marks.map(m => m.status), ["close", "correct", "correct", "correct", "missed"]);
  assert.equal(s.marks[0].offset, 0); assert.equal(s.marks[1].offset, 5);
  assert.equal(s.insertions, 1); assert.equal(s.wcpm, 8); assert.equal(s.completion, 0.8);
  assert.equal(scoreReading("күн", "кун", 5, "kk").marks[0].status, "substituted");
  assert.equal(scoreReading("домик", "томик", 5, "ru").marks[0].status, "close");
  assert.equal(scoreReading("Қар", "кар", 5, "ru").marks[0].status, "substituted");
  assert.deepEqual(scoreReading("дом дом там", "дом там", 5, "ru").marks.map(m => m.status), ["correct", "missed", "correct"]);
});
test("stars start at exactly 60, 75 and 90 percent and only five words get red marks", () => {
  const words = Array.from({ length: 20 }, (_, i) => "слово" + i);
  for (const [n, stars] of [[7, 0], [11, 0], [12, 1], [14, 1], [15, 2], [17, 2], [18, 3]]) {
    const result = scoreReading(words.join(" "), words.slice(0, n).join(" "), 20, "ru");
    assert.equal(result.accuracy, n / 20); assert.equal(result.stars, stars);
    assert.equal(result.marks.filter(m => m.flag).length, Math.min(5, 20 - n));
  }
});
test("mock voice input handles quiet, language, unknown media and 120-second clipping", async () => {
  const rec = (transcript, seconds, language = "kk") => mockTranscribe({ fixture: { transcript, seconds, language } }, "кітап", "kk");
  assert.equal((await rec("кітап", 2)).issue, "quiet"); assert.equal((await rec(" ", 80)).issue, "quiet");
  assert.equal((await rec("кітап", 3)).seconds, 3);
  assert.equal((await rec("слово", 4, "ru")).issue, "wrongLanguage");
  const clipped = await rec("бір екі үш төрт", 240);
  assert.deepEqual(clipped, { transcript: "бір екі", seconds: 120, clipped: true });
  assert.equal((await mockTranscribe({ media: "unknown" }, "кітап", "kk")).issue, "unavailable");
});
test("a parent gives versioned consent before a profile or transcript can be processed", async () => {
  let calls = 0, snapshot;
  const { send, family } = setup({ save: s => { snapshot = structuredClone(s); }, transcribe: async () => { calls++; } });
  await send(button("lang:ru")); await send(profile);
  await send({ ...consent, processing: false });
  await send(note("сырлы сөз")); await send({ kind: "text", value: "private arbitrary incoming text" });
  assert.equal(calls, 0); assert.deepEqual(family().children, []); assert.equal(family().consent, null);
  assert.doesNotMatch(JSON.stringify(snapshot), /сырлы сөз|private arbitrary incoming text/);
  await send(consent);
  assert.deepEqual(family().consent, { version: CONSENT_VERSION, givenAt: time, guardian: true, processing: true, crossBorder: false, keepAudio: false });
  await send({ ...profile, age: 13 }); assert.equal(family().children.length, 0);
});
test("a two-language family can switch readers and each has its own position and wallet", async () => {
  const { send, onboard, family } = setup();
  await onboard("kk"); await send(note(library.kk.pages[0])); await send(button("next:1:0"));
  await send(button("add")); await send({ ...profile, name: "Мирас", language: "ru", avatar: "🦊" });
  let f = family(); assert.equal(newest(f).page.title, "Репка"); assert.equal(f.children[1].wallet.coins, 0);
  await send(button("readers")); await send(button("reader:1"));
  assert.equal(newest(family()).page.number, 2); assert.equal(family().children[0].wallet.coins, 20);
  for (const name of ["Дана", "Тимур"]) { await send(button("add")); await send({ ...profile, name }); }
  f = (await send(button("add"))).family;
  assert.equal(f.children.length, 4); assert.equal(f.stage, "choose"); assert.ok(newest(f).buttons.every(b => b.id !== "add"));
});
test("scoring returns a highlighted image, gentle low-score feedback and best-only coin differences", async () => {
  const { send, onboard, family } = setup(); await onboard("ru");
  const page = library.ru.pages[0], words = page.split(/\s+/);
  const fail = newest((await send(note(words[0], "ru"))).family);
  assert.doesNotMatch(fail.body, /%/); assert.equal(fail.card.stars, 0); assert.equal(fail.card.marks.filter(m => m.flag).length, 5);
  assert.equal(fail.buttons[0].id, "listen");
  const svg = feedbackSvg(fail.card, "стр.");
  assert.equal((svg.match(/text-decoration="underline"/g) ?? []).length, 5);
  assert.match(svg, /Репка/);
  await send(note(words.slice(0, Math.ceil(words.length * 0.63)).join(" "), "ru"));
  const part = family().children[0].wallet.coins; assert.equal(part, 10);
  const mid = id(), perfect = note(page, "ru");
  const earlierRateSum = family().children[0].reportDays[0].rateSum;
  const happy = (await send(perfect, mid)).family;
  assert.equal(happy.children[0].wallet.coins, 20); assert.equal(newest(happy).parentMetrics, undefined);
  assert.equal(family().children[0].reportDays[0].rateSum - earlierRateSum, words.length * 2);
  assert.match(newest(happy).body, /\+10/); assert.equal(newest(happy).card.stars, 3);
  const replay = await send(perfect, mid);
  assert.equal(replay.accepted, 0); assert.deepEqual(replay.family, happy);
  await send(perfect); assert.equal(family().children[0].wallet.coins, 20);
  assert.match(newest(family()).body, /\+0/);
});
test("finishing every page awards the book bonus once, including after rereading", async () => {
  const { send, onboard, family } = setup(); await onboard();
  const pages = library.kk.pages;
  for (let pass = 0; pass < 2; pass++) {
    for (const [i, page] of pages.entries()) {
      await send(note(page)); await send(button("next:1:" + i));
    }
    assert.equal(family().stage, "finished");
    assert.equal(family().children[0].wallet.coins, 5 + 15 * pages.length + 50);
    await send(button("restart"));
  }
});
const child = () => ({ best: {}, finished: false, wallet: { coins: 0, earnedToday: 0, lastDay: null, streak: 0, freezeWeek: null } });
test("Almaty midnight, a weekly freeze, streak milestones and hard daily cap", () => {
  const c = child(), score = { stars: 3, matched: 10 };
  const go = (date, page = 0) => reward(c, page, 100, score, Date.parse(date));
  go("2026-11-17T18:59:59Z"); // 23:59:59 in Almaty
  assert.equal(c.wallet.streak, 1); assert.equal(go("2026-11-17T19:00:00Z"), 5);
  assert.equal(c.wallet.streak, 2);
  go("2026-11-19T19:00:00Z"); assert.equal(c.wallet.streak, 3); // missed Thursday
  go("2026-11-21T19:00:00Z"); assert.equal(c.wallet.streak, 1); // a second gap in that week
  for (let p = 1; p < 30; p++) go("2026-11-21T21:00:00Z", p);
  assert.equal(c.wallet.earnedToday, 200);
  const m = child();
  for (let day = 0; day < 7; day++) reward(m, 0, 100, score, time + 86400000 * day);
  assert.equal(m.wallet.streak, 7); assert.equal(m.wallet.earnedToday, 55);
});
test("chat deletion requests the parent area; confirmed deletion erases the family and queued voice data", async () => {
  const { runtime, send, onboard, family } = setup(); await onboard(); await send(note(library.kk.pages[0]));
  const request = await send({ kind: "text", value: "Жою" });
  assert.equal(newest(request.family).parentAction, "delete");
  const { token } = await parentAction(runtime, DEMO_USER, { action: "unlock", pin: "0432" });
  const mid = id();
  await runtime.enqueue(message(note(""), mid));
  assert.equal((await parentAction(runtime, DEMO_USER, { action: "delete", token })).ok, true);
  await runtime.drain();
  assert.equal(runtime.state.families.length, 0); assert.equal(runtime.state.pending.length, 0);
  assert.doesNotMatch(JSON.stringify(runtime.state), /BOOKSER_DEMO|Ару|Батыл|sample-custom/);
  assert.equal(await runtime.enqueue(message(note(""), mid)), 0); assert.equal(family().consent, null);
});
test("closed windows suppress replies, respect opt-outs and preserve protected deletion; unconsented data expires", async () => {
  let now = time;
  const { runtime, onboard, family, send } = setup({ now: () => now }); await onboard();
  const rows = family().history.length;
  now += 86400000;
  await runtime.enqueue(message(note(""))); await runtime.drain();
  assert.equal(family().history.length, rows);
  await runtime.enqueue(message({ kind: "text", value: "Стоп" })); await runtime.drain();
  assert.equal(family().history.length, rows); assert.equal(family().reminders, false);
  await runtime.enqueue(message({ kind: "text", value: "delete" })); await runtime.drain();
  assert.equal(family().history.length, rows);
  assert.equal(family().children.length, 1);
  const { token } = await parentAction(runtime, DEMO_USER, { action: "unlock", pin: "0432" });
  assert.equal((await parentAction(runtime, DEMO_USER, { action: "delete", token })).ok, true);
  assert.equal(runtime.state.families.length, 0);
  await send(button("lang:ru")); now += 31 * 86400000;
  const reopened = setup({ state: runtime.state, now: () => now });
  assert.equal(reopened.runtime.state.families.length, 0);
});
test("webhook batches ignore statuses and phone-only IDs and handle a scoped ID rotation", async () => {
  const { onboard, runtime } = setup(); await onboard();
  const env = demoEnvelope(button("readers"), id(), time);
  const value = env.entry[0].changes[0].value, fromContact = { ...value.messages[0], id: id(), from: "phone-placeholder" };
  delete fromContact.from_user_id;
  value.contacts = [{ wa_id: "phone-placeholder", user_id: "KZ.CONTACT" }];
  value.statuses = [{ id: id(), status: "read" }];
  value.messages.push(fromContact, { ...fromContact, from: "other" }, { id: id(), timestamp: String(time / 1000), type: "system",
    system: { type: "user_changed_user_id", previous_user_id: DEMO_USER, user_id: "KZ.NEXT" } });
  const events = parseWebhook(env);
  assert.deepEqual(events.map(e => e.user), [DEMO_USER, "KZ.CONTACT", DEMO_USER]);
  assert.doesNotMatch(JSON.stringify(events), /phone-placeholder/);
  await runtime.enqueue(events); await runtime.drain();
  assert.equal(runtime.family("KZ.NEXT").children.length, 1); assert.equal(runtime.family(DEMO_USER).children.length, 0);
});
test("an interrupted queued delivery survives restart and a transient provider failure without doubling rewards", async t => {
  const dir = mkdtempSync(join(tmpdir(), "bookser-wa-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = join(dir, "state.json");
  const { runtime, onboard } = setup(localStore(filename)); await onboard();
  const mid = id(), pending = message(note(""), mid);
  pending[0].media = "sample-perfect";
  await runtime.enqueue(pending);
  let tries = 0;
  const resumed = setup({ ...localStore(filename), transcribe: async (...args) => {
    if (++tries < 3) throw new Error("fixture provider unavailable");
    return mockTranscribe(...args);
  } });
  await resumed.runtime.drain(); assert.equal(tries, 3);
  assert.equal(resumed.family().children[0].wallet.coins, 20);
  const again = setup(localStore(filename)); assert.equal(await again.runtime.enqueue(pending), 0);
  assert.equal(again.family().children[0].wallet.coins, 20);
});
test("signed HTTP webhook acknowledges before transcription; local controls reuse it", async t => {
  let began, release;
  const started = new Promise(r => { began = r; }), blocker = new Promise(r => { release = r; });
  const { runtime, onboard, family } = setup({ transcribe: async (...args) => { began(); await blocker; return mockTranscribe(...args); } });
  await onboard("ru");
  const server = createWhatsAppServer({ runtime, html: "<title>Bookser</title>", appSecret: "test-only", verifyToken: "local-test" });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { release(); server.closeAllConnections(); await new Promise(r => server.close(r)); });
  const base = "http://127.0.0.1:" + server.address().port;
  let res = await fetch(base + "/webhook?hub.mode=subscribe&hub.verify_token=local-test&hub.challenge=abc123");
  assert.equal(res.status, 200); assert.equal(await res.text(), "abc123");
  assert.equal((await fetch(base + "/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=abc")).status, 403);
  const env = demoEnvelope({ kind: "audio" }, id(), time);
  env.entry[0].changes[0].value.messages[0].audio.id = "sample-perfect";
  const raw = JSON.stringify(env), header = signature(raw, "test-only");
  const post = (body, sig) => fetch(base + "/webhook", { method: "POST", body, headers: { "X-Hub-Signature-256": sig } });
  assert.equal((await post(raw + " ", header)).status, 403);
  assert.equal((await post("{", signature("{", "test-only"))).status, 400);
  res = await post(raw, header); assert.equal(await res.text(), "OK");
  await started;
  assert.equal(family().children[0].wallet.coins, 0);
  assert.equal((await post(raw, header)).status, 200);
  release(); await runtime.drain(); assert.equal(family().children[0].wallet.coins, 20);
  const simulate = data => fetch(base + "/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const packet = { ...note(library.ru.pages[0], "ru"), id: id() };
  const first = await (await simulate(packet)).json(), second = await (await simulate(packet)).json();
  assert.equal(first.accepted, 1); assert.equal(second.accepted, 0); assert.equal(first.family.children[0].wallet.coins, 20);
  assert.equal((await fetch(base + "/api/family", { headers: { Origin: "https://elsewhere.invalid" } })).status, 403);
  const deletion = await (await simulate({ ...button("delete"), id: id() })).json();
  assert.equal(newest(deletion.family).parentAction, "delete"); assert.equal(deletion.family.children.length, 1);
});
