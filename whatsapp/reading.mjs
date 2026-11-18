import { ReadingAligner, matchStrength, normalizeWrittenWord, wordsPerMinute, bandForText, BAND_HINT } from "#bookser-reader";

const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[-’'][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;
const LOOKALIKE = { a: "а", c: "с", e: "е", h: "һ", i: "і", k: "к", m: "м", o: "о", p: "р", x: "х", y: "у" };
const KK_CLOSE = { қ: "к", ғ: "г", ң: "н" };

function normalized(raw) {
  const script = raw.normalize("NFKC").toLowerCase().replace(/[acehikmopxy]/g, c => LOOKALIKE[c]);
  return normalizeWrittenWord(script);
}

function words(text) {
  return [...text.matchAll(WORD)].map(m => ({ text: m[0], offset: m.index, norm: normalized(m[0]) }));
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const row = [i + 1];
    for (let j = 0; j < b.length; j++) {
      row.push(Math.min(prev[j + 1] + 1, row[j] + 1, prev[j] + Number(a[i] !== b[j])));
    }
    prev = row;
  }
  return prev[b.length];
}

function compare(expected, said, language) {
  if (expected === said) return "correct";
  if (language === "kk" && expected.replace(/[қғң]/g, c => KK_CLOSE[c]) === said.replace(/[қғң]/g, c => KK_CLOSE[c])) return "close";
  const max = Math.max(expected.length, said.length);
  if (max < 5 || max > 80 || 5 * Math.abs(expected.length - said.length) > max) return "substituted";
  // Bookser recognises a one-edit match or a long prefix. The length guard
  // above keeps those within the completed-note similarity threshold.
  if (matchStrength(expected, said) !== "none") return "close";
  return max >= 10 && 5 * distance(expected, said) <= max ? "close" : "substituted";
}

function spokenParts(parts, spoken, start, language) {
  if (start + parts.length > spoken.length) return null;
  let status = "correct";
  for (const [offset, part] of parts.entries()) {
    const comparison = compare(part, spoken[start + offset].norm, language);
    if (comparison === "substituted") return null;
    if (comparison === "close") status = "close";
  }
  return status;
}

/** Align the complete voice note. Ties prefer an earlier reference word. */
export function scoreReading(page, transcript, seconds, language) {
  const ref = words(page), spoken = words(transcript);
  if (!ref.length || ref.length > 60 || spoken.length > 480 || !Number.isFinite(seconds) || seconds <= 0) {
    throw new RangeError("Invalid page, transcript, or speaking duration");
  }
  const n = ref.length, m = spoken.length;
  const parts = ref.map(word => word.text.includes("-") ? word.text.split("-").map(normalized) : null);
  // The low-order term counts uncredited reference words. This resolves equal-cost
  // edit paths in favour of words the child actually read, including after a repetition.
  const unit = n + 1, gap = 4 * unit;
  const cost = { correct: 0, close: unit, substituted: gap + 1 };
  const costs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  const moves = Array.from({ length: n }, () => new Array(m));
  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      if (i === n) { costs[i][j] = (m - j) * gap; continue; }
      if (j === m) { costs[i][j] = (n - i) * (gap + 1); continue; }
      const status = compare(ref[i].norm, spoken[j].norm, language);
      const diagonal = costs[i + 1][j + 1] + cost[status];
      const skip = costs[i + 1][j] + gap + 1, extra = costs[i][j + 1] + gap;
      const best = Math.min(diagonal, skip, extra);
      costs[i][j] = best;
      moves[i][j] = diagonal === best ? status : skip === best ? "missed" : "inserted";
      // A voice provider can split a hyphenated page word into several words.
      // The card still marks that single printed word and preserves its offset.
      if (parts[i]) {
        const compound = spokenParts(parts[i], spoken, j, language);
        if (compound) {
          const joined = costs[i + 1][j + parts[i].length] + cost[compound];
          if (joined <= best) {
            costs[i][j] = joined;
            moves[i][j] = compound === "correct" ? "compound-correct" : "compound-close";
          }
        }
      }
    }
  }
  let i = 0, j = 0, matched = 0, lastAttempted = 0, insertions = 0, problems = 0;
  const marks = [];
  while (i < n || j < m) {
    const move = i === n ? "inserted" : j === m ? "missed" : moves[i][j];
    const compound = move.startsWith("compound-");
    const status = compound ? move.slice("compound-".length) : move;
    if (status === "inserted") { j++; insertions++; continue; }
    const credit = status === "correct" || status === "close";
    if (credit) matched++;
    if (status !== "missed") { j += compound ? parts[i].length : 1; lastAttempted = i + 1; }
    if (!credit) problems++;
    marks.push({ text: ref[i].text, offset: ref[i].offset, status, flag: !credit && problems <= 5 });
    i++;
  }
  const accuracy = matched / n;
  // Use the live reader's repeated-miss detector for the parent practice list.
  // A child can recover and read a word correctly after struggling with it.
  const aligner = new ReadingAligner();
  aligner.setPage(ref.map(word => word.text));
  const tracking = aligner.feed(spoken.map(word => word.norm).join(" "), "");
  const struggledWords = tracking.struggled.map(index => aligner.wordAt(index));
  return { marks, matched, total: n, accuracy, struggledWords, wcpm: wordsPerMinute(matched, seconds),
    completion: lastAttempted / n, insertions, stars: [0.6, 0.75, 0.9].filter(t => accuracy >= t).length };
}

/** Local mock only. Long fixtures distribute their synthetic word times uniformly. */
export async function mockTranscribe(event, page, language) {
  let fixture = event.fixture;
  if (!fixture && event.media === "sample-perfect") fixture = { transcript: page, seconds: 30 };
  if (!fixture && event.media === "sample-practice") fixture = { transcript: page.split(/\s+/).filter((_, i) => i % 5 !== 2).join(" "), seconds: 30 };
  if (!fixture || typeof fixture.transcript !== "string" || fixture.transcript.length > 5000 ||
      !Number.isFinite(fixture.seconds) || fixture.seconds < 0 || fixture.seconds > 3600) return { issue: "unavailable" };
  const said = words(fixture.transcript);
  if (fixture.seconds < 3 || !said.length) return { issue: "quiet" };
  if (said.length > 480) return { issue: "unavailable" };
  if (fixture.language && fixture.language !== language) return { issue: "wrongLanguage" };
  const clipped = fixture.seconds > 120;
  const count = Math.floor(said.length * Math.min(1, 120 / fixture.seconds));
  if (!count) return { issue: "quiet" };
  return { transcript: said.slice(0, count).map(w => w.text).join(" "), seconds: Math.min(120, fixture.seconds), clipped };
}

const almaty = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" });
export function localDay(time) {
  const parts = Object.fromEntries(almaty.formatToParts(time).map(p => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day) / 86400000;
}

export function reward(child, pageNo, pageCount, score, time) {
  const day = localDay(time), w = child.wallet;
  if (w.lastDay !== null && day < w.lastDay) return 0;
  const best = child.best[pageNo] ?? { matched: 0, tier: 0, attempts: 0 };
  const tier = [0, 5, 10, 15][score.stars];
  const improvement = Math.max(0, tier - best.tier);
  child.best[pageNo] = { attempts: best.attempts + 1, matched: Math.max(best.matched, score.matched), tier: Math.max(best.tier, tier) };
  if (tier === 0) return 0;
  let bonus = 0;
  if (day !== w.lastDay) {
    const gap = w.lastDay === null ? Infinity : day - w.lastDay;
    const missedWeek = Math.floor((day - 1 + 3) / 7); // Monday-based week containing the missed day
    if (gap === 2 && w.freezeWeek !== missedWeek) { w.freezeWeek = missedWeek; w.streak++; }
    else w.streak = gap === 1 ? w.streak + 1 : 1;
    w.lastDay = day;
    w.earnedToday = 0;
    bonus = 5 + ({ 7: 50, 30: 200, 100: 500 }[w.streak] ?? 0);
  }
  if (!child.finished && Array.from({ length: pageCount }, (_, index) => child.best[index]?.tier > 0).every(Boolean)) {
    child.finished = true;
    bonus += 50;
  }
  const actual = Math.min(improvement + bonus, Math.max(0, 200 - w.earnedToday));
  w.coins += actual;
  w.earnedToday += actual;
  return actual;
}

export function sampleLibrary(seed) {
  const result = {};
  for (const lang of ["kk", "ru"]) {
    const book = seed.find(b => b.language === lang);
    if (!book) throw new Error("Missing " + lang + " sample book");
    const pages = book.text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    for (let index = pages.length - 1; index > 0; index--) {
      if (words(pages[index]).length < 15 && words(pages[index - 1] + " " + pages[index]).length <= 60) {
        pages[index - 1] += " " + pages[index];
        pages.splice(index, 1);
      }
    }
    if (!pages.length || pages.some(p => words(p).length < 15 || words(p).length > 60)) throw new Error("Sample pages must contain 15–60 words");
    const band = bandForText(book.text, lang);
    result[lang] = { title: book.title, band, hint: BAND_HINT[band], level: "A", pages };
  }
  return result;
}
