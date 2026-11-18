import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreReading } from "../whatsapp/reading.mjs";
import { recordReading, weeklyReport } from "../whatsapp/report.mjs";

const child = (name = "Ару", id = "1") => ({ id, name, language: "ru" });
const time = iso => Date.parse(iso);
const page = "Кот взял книгу и сел";
function read(reader, iso, transcript, seconds = 30, bookFinished = false) {
  const score = scoreReading(page, transcript, seconds, "ru");
  recordReading(reader, { score, seconds, at: time(iso), bookFinished });
}

test("a legacy reader opens an empty localized report without invented history", () => {
  const reader = { ...child(), lastWcpm: 90, best: { 0: { tier: 15, attempts: 3 } } };
  const report = weeklyReport(reader, time("2026-11-19T11:00:00Z"), "kk");
  assert.equal(report.title, "Апталық есеп");
  assert.equal(report.name, "Ару");
  assert.equal(report.readingLanguage, "ru");
  assert.equal(report.language, "kk");
  assert.equal(report.days.length, 7);
  assert.ok(report.days.every(day => !day.active));
  assert.equal(report.from, "2026-11-13"); assert.equal(report.through, "2026-11-19");
  for (const key of ["minutes", "books", "words", "attempts", "activeDays"]) assert.equal(report[key], 0);
  for (const key of ["wcpmDelta", "accuracyDelta", "averageWcpm", "accuracy"]) assert.equal(report[key], null);
  assert.equal(reader.reportDays, undefined);
});

test("weekly summaries follow Almaty midnight, two comparison windows and canonical measurable-session speed", () => {
  const r = child(), now = time("2026-11-19T12:00:00Z");
  read(r, "2026-11-05T12:00:00Z", page); // before the comparison week
  read(r, "2026-11-12T18:59:59Z", "Кот взял", 20);
  read(r, "2026-11-12T19:00:00Z", page, 10);
  read(r, "2026-11-19T09:00:00Z", "Кот взял книгу", 30, true);
  read(r, "2026-11-19T10:00:00Z", "постороннее", 20);
  read(r, "2026-11-19T19:00:00Z", page); // local November 20, outside this report
  const report = weeklyReport(r, now, "ru");
  assert.deepEqual(report.days.filter(d => d.active).map(d => d.date), ["2026-11-13", "2026-11-19"]);
  assert.equal(report.activeDays, 2); assert.equal(report.attempts, 3);
  assert.equal(report.words, 8); assert.equal(report.minutes, 1); assert.equal(report.books, 1);
  assert.equal(report.averageWcpm, 18); assert.equal(report.wcpmDelta, 12);
  assert.equal(report.accuracy, 53); assert.equal(report.accuracyDelta, 13);
});

test("the practice list requires two separate reads and contains only words from the assigned text", () => {
  const r = child(), at = time("2026-11-18T12:00:00Z"), text = "Кот кот взял книгу и сел";
  const score = scoreReading(text, "лев лев взял", 30, "ru");
  score.struggledWords = ["кот", "сырое"];
  const expose = { score, at, seconds: 30, transcript: "личное сообщение", media: "opaque-id" };
  recordReading(r, expose);
  assert.deepEqual(weeklyReport(r, at, "ru").practiceWords, []);
  recordReading(r, expose);
  const report = weeklyReport(r, at, "ru");
  assert.deepEqual(report.practiceWords, [{ word: "кот", count: 2 }]);
  assert.match(report.advice, /кот/);
  assert.match(weeklyReport(r, at, "kk").advice, /бірге/);
  assert.doesNotMatch(JSON.stringify(r.reportDays), /сырое|личное|opaque-id|лев|книгу/);
});

test("only the last fourteen calendar dates are retained, including for out-of-order deliveries", () => {
  const r = child(), start = time("2026-10-01T12:00:00Z");
  const score = scoreReading(page, page, 30, "ru");
  for (let i = 0; i < 22; i++) recordReading(r, { score, seconds: 30, at: start + i * 86400000 });
  assert.equal(r.reportDays.length, 14);
  recordReading(r, { score, seconds: 30, at: start });
  assert.equal(r.reportDays.length, 14);
  const report = weeklyReport(r, start + 22 * 86400000, "kk");
  assert.equal(report.attempts, 6);
  assert.equal(report.wcpmDelta, 0);
  assert.equal(report.accuracyDelta, 0);
  assert.equal(weeklyReport(child("Мирас", "2"), start + 22 * 86400000, "kk").attempts, 0);
});
