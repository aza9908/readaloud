// Simulates realistic Web Speech API behaviour and asserts the aligner
// never runs ahead of the reader.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const src = readFileSync("src/lib/alignment.ts", "utf8");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const { ReadingAligner, matchStrength, normalizeWord } = mod;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

const PAGE1 = "Радость длилась недолго: перед стартом задрожали коленки.".split(/\s+/);
const PAGE2 = "И сразу стало ясно, что делать с находкой.".split(/\s+/);

console.log("\n── BUG 1: page turn must not inherit previous speech ──");
{
  const a = new ReadingAligner();
  a.setPage(PAGE1);
  // Child reads all of page 1. ASR reports it as one final result.
  a.feed("Радость длилась недолго перед стартом задрожали коленки", "");
  eq("page 1 fully read", a.cursor, PAGE1.length);

  // Page turns. The recogniser still holds the whole utterance in `final`.
  a.setPage(PAGE2);
  eq("cursor resets", a.cursor, 0);

  // Same transcript arrives again (Chrome keeps prior finals in the list).
  const r = a.feed("Радость длилась недолго перед стартом задрожали коленки", "");
  eq("NO jump on page 2 before reading", r.advanced, 0);
  eq("cursor still at word 0", a.cursor, 0);

  // Now the child actually reads the first word of page 2.
  a.feed("Радость длилась недолго перед стартом задрожали коленки И", "");
  eq("advances only when actually read", a.cursor, 1);
}

console.log("\n── BUG 3: never skip more than one word ──");
{
  const a = new ReadingAligner();
  a.setPage(PAGE1);
  // Child jumps straight to the 6th word. Old code would leap there.
  const r = a.feed("задрожали", "");
  eq("far-ahead word ignored", r.advanced, 0);
  eq("cursor holds at 0", a.cursor, 0);

  // One mumbled word is tolerated: says word 2 while cursor is on word 1.
  const b = new ReadingAligner();
  b.setPage(PAGE1);
  b.feed("Радость", "");
  eq("word 1 read", b.cursor, 1);
  b.feed("Радость недолго", "");
  eq("single skip allowed", b.cursor, 3);
}

console.log("\n── interim results must not double-count ──");
{
  const a = new ReadingAligner();
  a.setPage(PAGE1);
  // Interim grows as the child speaks — the same words arrive repeatedly.
  a.feed("", "Радость");
  a.feed("", "Радость длилась");
  a.feed("", "Радость длилась недолго");
  eq("interim counted once", a.cursor, 3);
  // Then the result is finalised — must not advance again.
  const r = a.feed("Радость длилась недолго", "");
  eq("finalisation adds nothing", r.advanced, 0);
  eq("cursor stable", a.cursor, 3);
}

console.log("\n── repeated words (child re-reads) ──");
{
  const a = new ReadingAligner();
  a.setPage(PAGE1);
  a.feed("Радость", "");
  a.feed("Радость Радость", "");
  eq("repetition does not advance", a.cursor, 1);
}

console.log("\n── noise / wrong words hold position ──");
{
  const a = new ReadingAligner();
  a.setPage(PAGE1);
  a.feed("мама папа собака", "");
  eq("unrelated speech ignored", a.cursor, 0);
}

console.log("\n── short words need exact match (Russian и/в) ──");
{
  eq("и vs в rejected", matchStrength("и", "в"), "none");
  eq("и vs и accepted", matchStrength("и", "и"), "strong");
  eq("длилась ~ длилась (1 edit)", matchStrength("длилась", "длилась"), "strong");
  eq("below-threshold prefix rejected", matchStrength("задрожали", "задрож"), "none");
  eq("prefix at threshold is weak", matchStrength("приключение", "приключен"), "weak");
}

console.log("\n── weak match cannot cause a skip ──");
{
  const a = new ReadingAligner();
  a.setPage(["кот", "приключение", "лошадь"]);
  // "приключен" is 2 edits from "приключение" → weak (prefix) only.
  // A weak match one word ahead must NOT cause a skip.
  const r = a.feed("приключен", "");
  eq("weak match ahead ignored", r.advanced, 0);
  // But a weak match ON the cursor word is accepted in place.
  const b = new ReadingAligner();
  b.setPage(["приключение", "кот"]);
  b.feed("приключен", "");
  eq("weak match at cursor accepted", b.cursor, 1);
}

console.log("\n── recogniser restart (Chrome auto-stop) ──");
{
  const a = new ReadingAligner();
  a.setPage(PAGE1);
  a.feed("Радость длилась", "");
  eq("read two words", a.cursor, 2);
  // Chrome restarts: the finals list resets to empty, then new speech comes.
  a.feed("", "недолго");
  eq("survives restart without jumping", a.cursor, 3);
}

console.log("\n── full realistic read-through ──");
{
  const a = new ReadingAligner();
  a.setPage(PAGE1);
  let finalText = "";
  for (const w of PAGE1) {
    // each word: two interim frames then finalised
    a.feed(finalText, (finalText ? " " : "") + w);
    a.feed(finalText, (finalText ? " " : "") + w);
    finalText = (finalText ? finalText + " " : "") + w;
    a.feed(finalText, "");
  }
  eq("reaches end exactly", a.cursor, PAGE1.length);
  eq("page complete", a.isPageComplete, true);
}

console.log("\n── recovery must not reintroduce runaway ──");
{
  // Recovery widens the search only after repeated misses. It must still
  // refuse to leap ahead when the child simply has not read that far.
  const a = new ReadingAligner();
  a.setPage(PAGE1);
  a.feed("шум шум шум", "");           // three misses → recovery armed
  const r = a.feed("шум шум шум ещё", "");
  eq("noise never advances even in recovery", a.cursor, 0);

  // But a genuine word further ahead does resync it.
  const b = new ReadingAligner();
  b.setPage(PAGE1);
  b.feed("мама папа собака", "");       // 3 misses
  b.feed("мама папа собака стартом", ""); // real word 4 ahead
  const moved = b.cursor > 0 && b.cursor <= PAGE1.length;
  eq("recovery resyncs on a real word", moved, true);

  // Recovery resets once tracking is healthy again.
  const c = new ReadingAligner();
  c.setPage(PAGE1);
  c.feed("Радость", "");
  eq("normal match keeps strict mode", c.cursor, 1);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
