import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ReadingAligner, bandForText, wordsPerMinute } from "#bookser-reader";
import { sampleLibrary, scoreReading } from "../whatsapp/reading.mjs";

test("a recovered struggle is detected in both the web karaoke reader and the backend report", () => {
  const page = "Радость длилась недолго.";
  const spoken = "Радость тук бах ясно длилась недолго";
  const web = new ReadingAligner();
  web.setPage(page.split(" "));
  const reading = web.feed(spoken, "");
  const result = scoreReading(page, spoken, 31, "ru");
  assert.deepEqual(result.struggledWords, reading.struggled.map(i => web.wordAt(i)));
  assert.deepEqual(result.struggledWords, ["длилась"]);
  assert.equal(result.wcpm, wordsPerMinute(3, 31));
  assert.equal(result.insertions, 3);
  assert.equal(result.accuracy, 1);
  assert.doesNotMatch(JSON.stringify(result), /тук|бах|ясно/);
});

test("a hyphenated page word can be read aloud in parts without earning extra words", () => {
  const result = scoreReading("Солтүстік-батыс және оңтүстік-шығыс.", "солтүстік батыс және онтүстік шығыс", 30, "kk");
  assert.deepEqual(result.marks.map(m => m.status), ["correct", "correct", "close"]);
  assert.deepEqual(result.marks.map(m => m.offset), [0, 16, 21]);
  assert.equal(result.insertions, 0); assert.equal(result.wcpm, 6);
  assert.equal(scoreReading("Северо-запад", "северо", 10, "ru").matched, 0);
  assert.equal(scoreReading("Северо-запад", "северозапад", 10, "ru").matched, 1);
});

test("recogniser tolerance preserves exact and close Kazakh distinctions in a completed note", () => {
  assert.deepEqual(scoreReading("Ғарыш Қар таң күн", "ғарыш кар тан кун", 10, "kk").marks.map(m => m.status),
    ["correct", "close", "close", "substituted"]);
  assert.equal(scoreReading("Ёлка, йод.", "eлка и\u0306од", 10, "ru").accuracy, 1);
  assert.equal(scoreReading("и", "в", 10, "ru").matched, 0);
});

test("the WhatsApp library uses the web app’s language-adjusted reading bands", () => {
  const seed = JSON.parse(readFileSync(new URL("../seed/books.sample.json", import.meta.url), "utf8"));
  const library = sampleLibrary(seed);
  for (const [language, book] of Object.entries(library)) {
    const source = seed.find(b => b.language === language);
    assert.equal(book.band, bandForText(source.text, language));
  }
});
