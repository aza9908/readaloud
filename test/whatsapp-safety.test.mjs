import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLibrary } from "../whatsapp/build-simulator.mjs";
import { DEMO_USER, parseWebhook, simulateTurn } from "../whatsapp/events.mjs";
import { parentAction } from "../whatsapp/parent.mjs";
import { ReadingRuntime } from "../whatsapp/runtime.mjs";

const library = await loadLibrary();
const testPin = "5286";
const sundayStart = Date.parse("2026-11-22T14:00:00Z"); // 19:00 in Almaty
const marker = "transient-private-sample-marker";

async function simulator({ crossBorder = false, ...options } = {}) {
  const saved = [];
  let now = sundayStart - 1000, seq = 0;
  const runtime = new ReadingRuntime({ library, now: () => now, pause: async () => {},
    save: state => saved.push(JSON.stringify(state)), ...options });
  const send = (input, id = "wamid.safety." + ++seq) => simulateTurn(runtime, { ...input, id }, (envelope, fixture) => {
    const events = parseWebhook(envelope);
    if (fixture) for (const event of events) if (event.kind === "audio") event.fixture = fixture;
    return runtime.enqueue(events);
  }, now);
  const parent = input => parentAction(runtime, DEMO_USER, input);
  await send({ kind: "button", value: "lang:ru" });
  await send({ kind: "consent", guardian: true, processing: true, crossBorder, pin: testPin, confirmPin: testPin });
  await send({ kind: "profile", name: "Ару", age: 8, language: "ru", avatar: "🐰" });
  assert.equal(runtime.publicFamily(DEMO_USER).hasParentPin, true);
  return { runtime, send, parent, saved, setTime: time => { now = time; } };
}
const note = (overrides = {}) => ({ kind: "audio", transcript: library.ru.pages[0], seconds: 30, language: "ru", ...overrides });

test("transcription checks the provider's processing region and separate parental consent before invoking it", async t => {
  for (const [region, consent, allowed] of [
    [undefined, false, false], ["unknown", true, false], ["crossBorder", false, false],
    ["local", false, true], ["KZ", false, true], ["crossBorder", true, true],
  ]) {
    await t.test(String(region) + ", consent=" + consent, async () => {
      let calls = 0;
      const { runtime, send } = await simulator({ crossBorder: consent, transcriberRegion: region,
        transcribe: async (_event, page) => { calls++; return { transcript: page, seconds: 30 }; } });
      const response = await send(note());
      assert.equal(calls, allowed ? 1 : 0);
      assert.equal(Boolean(response.family.history.at(-1).reply.card), allowed);
      const child = runtime.family(DEMO_USER).children[0];
      assert.equal(child.wallet.coins > 0, allowed);
      assert.equal(Boolean(child.reportDays?.length), allowed);
    });
  }
});

test("flagged notes stay out of coins, reading reports and the child's view; the parent can acknowledge them", async t => {
  for (const source of ["provider", "sample"]) {
    await t.test(source, async () => {
      const provider = source === "provider" ? {
        transcriberRegion: "local", transcribe: async () => ({ flagged: true, transcript: marker, seconds: 30 }),
      } : {};
      const { runtime, send, parent, saved } = await simulator(provider);
      const sample = source === "sample" ? note({ flagged: true, transcript: marker }) : note();
      const turn = await send(sample, "wamid.flagged");
      assert.equal(turn.accepted, 1);
      assert.equal(turn.family.history.at(-1).reply.card, undefined);
      assert.doesNotMatch(JSON.stringify(turn.family), /reviewItems|transient-private-sample-marker/);
      assert.equal(runtime.family(DEMO_USER).children[0].wallet.coins, 0);
      assert.doesNotMatch(JSON.stringify(runtime.state), /transient-private-sample-marker/);
      if (source === "sample") assert.ok(saved.every(snapshot => !snapshot.includes(marker)), "preflagged sample text entered durable storage");
      assert.equal((await send(sample, "wamid.flagged")).accepted, 0);
      const denied = await parent({ action: "report", childId: "1" });
      assert.equal(denied.ok, false); assert.equal(denied.reviewItems, undefined);
      const { token } = await parent({ action: "unlock", pin: testPin });
      assert.ok(token);
      const response = await parent({ action: "report", token, childId: "1" });
      assert.equal(response.ok, true);
      assert.equal(response.report.attempts, 0); assert.equal(response.report.words, 0); assert.equal(response.report.accuracy, null);
      assert.equal(response.reviewItems.length, 1);
      const [item] = response.reviewItems;
      assert.deepEqual(Object.keys(item).sort(), ["at", "id"]);
      assert.ok(item.id); assert.equal(item.at, sundayStart - 1000);
      assert.equal((await parent({ action: "review", childId: "1", itemId: item.id })).ok, false);
      assert.equal((await parent({ action: "review", token, childId: "1", itemId: item.id })).ok, true);
      const cleared = await parent({ action: "report", token, childId: "1" });
      assert.deepEqual(cleared.reviewItems, []);
    });
  }
});

test("PIN-protected opt-in publishes one generic local Sunday notice and Stop disables subsequent weeks", async () => {
  const { runtime, send, parent, setTime } = await simulator();
  const { token } = await parent({ action: "unlock", pin: testPin });
  assert.equal((await parent({ action: "weekly", enabled: true })).ok, false);
  assert.equal((await parent({ action: "weekly", token, enabled: true })).ok, true);
  await runtime.checkWeekly();
  assert.ok(!runtime.publicFamily(DEMO_USER).weeklyNotice);
  setTime(sundayStart);
  await Promise.all([runtime.checkWeekly(), runtime.checkWeekly()]);
  const first = runtime.publicFamily(DEMO_USER).weeklyNotice;
  assert.ok(first); assert.match(JSON.stringify(first), /Отчёт за неделю/);
  assert.doesNotMatch(JSON.stringify(first), /Ару|%|WCPM|practiceWords|accuracy/);
  const snapshot = JSON.stringify(runtime.state);
  await runtime.checkWeekly();
  assert.equal(JSON.stringify(runtime.state), snapshot);
  const preference = () => runtime.state.families.find(row => row.user === DEMO_USER).parent.weeklyReports;
  assert.equal(preference().lastWeek, "2026-11-22");
  await send({ kind: "text", value: "Стоп" });
  assert.equal(preference().enabled, false);
  assert.ok(!runtime.publicFamily(DEMO_USER).weeklyNotice);
  setTime(sundayStart + 7 * 86400000); await runtime.checkWeekly();
  assert.notEqual(preference().lastWeek, "2026-11-29");
});
