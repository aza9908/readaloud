import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { loadLibrary } from "../whatsapp/build-simulator.mjs";
import { DEMO_USER, demoEnvelope, parseWebhook, simulateTurn } from "../whatsapp/events.mjs";
import { parentAction } from "../whatsapp/parent.mjs";
import { mockTranscribe } from "../whatsapp/reading.mjs";
import { ReadingRuntime } from "../whatsapp/runtime.mjs";
import { createWhatsAppServer } from "../whatsapp/server.mjs";

const library = await loadLibrary();
const start = Date.parse("2026-11-19T09:00:00Z");
const consent = { kind: "consent", guardian: true, processing: true, crossBorder: false, pin: "0432", confirmPin: "0432" };
const profile = { kind: "profile", name: "Ару", age: 8, language: "kk", avatar: "🐰" };
let sequence = 0;
const uid = () => "wamid.parent." + ++sequence;

function session(options = {}) {
  let now = start;
  const runtime = new ReadingRuntime({ library, now: () => now, ...options });
  const gate = input => parentAction(runtime, DEMO_USER, input);
  const send = input => simulateTurn(runtime, { id: uid(), ...input }, (env, fixture) =>
    runtime.enqueue(parseWebhook(env).map(e => fixture ? { ...e, fixture } : e)), now);
  const begin = () => send({ kind: "button", value: "lang:ru" });
  const enroll = async () => { await begin(); await send(consent); await send(profile); };
  return { runtime, gate, send, begin, enroll, advance: ms => { now += ms; } };
}
function assertChildView(family) {
  assert.equal(family.hasParentPin, true);
  assert.ok(!family.consent || typeof family.consent === "boolean");
  const child = family.children[0];
  for (const field of ["reportDays", "lastWcpm", "best"]) assert.equal(Object.hasOwn(child, field), false, field);
  for (const { reply } of family.history) assert.equal(Object.hasOwn(reply, "parentMetrics"), false);
  assert.doesNotMatch(JSON.stringify(family), /"pinHash"|"pinSalt"|"parentGate"|"hardWords"|"reportDays"/);
}

test("consent requires matching PINs, keeps the PIN out of saved records and prevents re-enrollment", async () => {
  let persistedPlaintext = false;
  const { runtime, gate, begin, send } = session({ save: state => {
    persistedPlaintext ||= JSON.stringify(state).includes('"0432"');
  } });
  assert.equal((await gate({ action: "setup", pin: "0432", confirmPin: "0432" })).ok, false);
  await begin();
  await send({ ...consent, confirmPin: "5432" });
  assert.equal(runtime.family(DEMO_USER).consent, null);
  assert.equal((await gate({ action: "unlock", pin: "0432" })).ok, false);
  await send(consent); await send(profile);
  const response = await send({ ...consent, pin: "1234", confirmPin: "1234" });
  assertChildView(response.family);
  assert.equal((await gate({ action: "setup", pin: "1234", confirmPin: "1234" })).ok, false);
  assert.equal((await gate({ action: "unlock", pin: "1234" })).ok, false);
  assert.equal((await gate({ action: "unlock", pin: "0432" })).ok, true);
  assert.equal(persistedPlaintext, false);
});

test("five wrong entries lock the parent area for a full minute across worker restart", async () => {
  const first = session(); await first.enroll();
  for (let i = 0; i < 5; i++) assert.equal((await first.gate({ action: "unlock", pin: "9999" })).ok, false);
  const restored = session({ state: structuredClone(first.runtime.state) });
  let locked = await restored.gate({ action: "unlock", pin: "0432" });
  assert.equal(locked.ok, false); assert.equal(locked.code, "locked"); assert.equal(locked.retryAfter, 60);
  restored.advance(59_999);
  assert.equal((await restored.gate({ action: "unlock", pin: "0432" })).code, "locked");
  restored.advance(1);
  assert.equal((await restored.gate({ action: "unlock", pin: "0432" })).ok, true);
});

test("an existing consented demo family can set its first PIN and retain reading history", async () => {
  const first = session(); await first.enroll();
  await first.send({ kind: "audio", transcript: library.kk.pages[0], seconds: 30, language: "kk" });
  const legacy = structuredClone(first.runtime.state);
  delete legacy.families[0].parent;
  delete legacy.families[0].data.children[0].reportDays;
  legacy.families[0].data.history.at(-1).reply.parentMetrics = { wcpm: 100, completion: 1 };
  const restored = session({ state: legacy });
  assert.equal((await restored.gate({ action: "report", childId: "1" })).ok, false);
  const unlock = await restored.gate({ action: "setup", pin: "2468", confirmPin: "2468" });
  assert.ok(unlock.token);
  assert.equal((await restored.gate({ action: "report", childId: "1", token: unlock.token })).report.name, profile.name);
  const view = (await restored.send({ kind: "button", value: "readers" })).family;
  assertChildView(view);
  assert.equal(view.children[0].wallet.coins, 20);
});

test("private reports require a scoped grant with fixed expiration, explicit lock and restart revoke access", async () => {
  const { runtime, gate, send, advance, enroll } = session(); await enroll();
  const audio = { kind: "audio", transcript: library.kk.pages[0], seconds: 30, language: "kk", id: uid() };
  assertChildView((await send(audio)).family); assert.equal((await send(audio)).accepted, 0);
  await send({ kind: "button", value: "add" });
  await send({ ...profile, name: "Мирас", language: "ru", avatar: "🦊" });
  const request = { action: "report", childId: "1" };
  for (const action of [request, { action: "delete" }, { action: "weekly", enabled: true }]) {
    assert.equal((await gate(action)).ok, false);
  }
  const { token, expiresAt } = await gate({ action: "unlock", pin: "0432" });
  assert.equal(expiresAt, start + 600_000); assert.ok(token);
  const result = await gate({ ...request, token });
  assert.equal(result.report.name, profile.name); assert.equal(result.report.attempts, 1);
  const sibling = await gate({ ...request, childId: "2", token });
  assert.equal(sibling.report.name, "Мирас"); assert.equal(sibling.report.attempts, 0);
  assert.equal(result.report.accuracy, 100); assert.equal(result.report.averageWcpm, library.kk.pages[0].split(/\s+/).length * 2);
  assert.equal((await gate({ ...request, childId: "missing", token })).ok, false);
  assert.equal((await parentAction(runtime, "KZ.OTHER", { ...request, token })).ok, false);
  assert.equal((await gate({ action: "weekly", enabled: true, token })).ok, true);
  assert.equal((await session({ state: structuredClone(runtime.state) }).gate({ ...request, token })).ok, false);
  advance(599_999); assert.equal((await gate({ ...request, token })).ok, true);
  advance(1); assert.equal((await gate({ ...request, token })).ok, false);
  const fresh = await gate({ action: "unlock", pin: "0432" });
  assert.ok(fresh.token); assert.notEqual(fresh.token, token);
  assert.equal((await gate({ action: "lock", token: fresh.token })).ok, true);
  assert.equal((await gate({ ...request, token: fresh.token })).ok, false);
});

test("the parent's confirmed deletion survives scoring work already in flight", async () => {
  let started, finish;
  const active = new Promise(resolve => { started = resolve; });
  const hold = new Promise(resolve => { finish = resolve; });
  const { runtime, gate, enroll } = session({ transcriberRegion: "local", transcribe: async (...args) => {
    started(); await hold; return mockTranscribe(...args);
  } });
  await enroll();
  const { token } = await gate({ action: "unlock", pin: "0432" });
  const messages = parseWebhook(demoEnvelope({ kind: "audio" }, uid(), start)); messages[0].media = "sample-perfect";
  await runtime.enqueue(messages);
  const scoring = runtime.drain();
  await active;
  const deletion = gate({ action: "delete", token });
  finish();
  const [result] = await Promise.all([deletion, scoring]);
  assert.equal(result.ok, true); assert.equal(runtime.state.families.length, 0);
  assert.equal(runtime.state.pending.length, 0);
  assert.equal(await runtime.enqueue(messages), 0);
  assert.equal((await gate({ action: "report", token, childId: "1" })).ok, false);
});

test("the HTTP parent endpoint enforces the grant; GET family returns only the child view", async t => {
  const { runtime, enroll, send } = session(); await enroll();
  await send({ kind: "audio", transcript: library.kk.pages[0], seconds: 40, language: "kk" });
  const server = createWhatsAppServer({ runtime, html: "<title>Bookser</title>" });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); });
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (input, extra = {}) => fetch(base + "/api/parent", {
    method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(input),
  });
  assertChildView(await (await fetch(base + "/api/family")).json());
  const report = { action: "report", childId: "1" };
  const denied = await (await post(report)).json();
  assert.equal(denied.ok, false); assert.equal(denied.report, undefined);
  const credentials = { action: "unlock", pin: "0432" };
  assert.equal((await post(credentials, { Origin: "https://other.invalid" })).status, 403);
  const { token } = await (await post(credentials)).json(); assert.ok(token);
  assert.equal((await (await post({ ...report, token })).json()).report.attempts, 1);
  assert.equal((await (await post({ action: "delete", token })).json()).ok, true);
  assert.deepEqual((await (await fetch(base + "/api/family")).json()).children, []);
});
