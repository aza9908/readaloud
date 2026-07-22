/**
 * AI layer. Calls Cloud Functions when available; otherwise falls back to
 * local heuristics so every feature still works (important for demos and for
 * projects still on the Firebase free/Spark plan).
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";
import type { Book, Language } from "./types";

const functions = getFunctions(app, "europe-west1");

/** True once a call has failed — avoids retrying a non-deployed function. */
let functionsUnavailable = false;

async function call<TReq, TRes>(name: string, data: TReq): Promise<TRes | null> {
  if (functionsUnavailable) return null;
  try {
    const fn = httpsCallable<TReq, TRes>(functions, name);
    const res = await fn(data);
    return res.data;
  } catch {
    functionsUnavailable = true; // not deployed / no billing / offline
    return null;
  }
}

// ───────────────────────── Types ─────────────────────────

export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
  why?: string;
}

export interface RetellResult {
  score: number;
  praise: string;
  missed: string[];
  tip: string;
  offline?: boolean;
}

export interface BookPick {
  id: string;
  reason: string;
}

// ─────────────────── Local text utilities ───────────────────

const STOPWORDS = new Set([
  // ru
  "и","в","на","с","а","но","что","как","он","она","они","это","的","из","по","за","то","же","у","не","бы","был","была","были","его","её","их","к","о","от","до","для","при","так","там","тут","вот","уже","ещё","еще",
  // kk
  "мен","бен","пен","де","да","ол","бұл","бір","үшін","және","деп","сол",
  // en
  "the","a","an","and","or","but","in","on","at","to","of","for","with","was","were","is","are","he","she","it","they","his","her","that","this","had","have",
]);

function tokens(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]+/g) ?? [text])
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4);
}

/** Content words that appear most often — the "key facts" of a passage. */
function keywords(text: string, n = 8): string[] {
  const freq = new Map<string, number>();
  for (const t of tokens(text)) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

// ───────────────────── Quiz (after book) ─────────────────────

const L = {
  ru: {
    whoQ: "О ком эта история?",
    whatQ: "Что произошло в конце?",
    orderQ: "Что было в начале истории?",
    fallbackWhy: "Так было в тексте.",
    none: "никто из них",
  },
  kk: {
    whoQ: "Бұл әңгіме кім туралы?",
    whatQ: "Соңында не болды?",
    orderQ: "Әңгіменің басында не болды?",
    fallbackWhy: "Мәтінде осылай айтылған.",
    none: "ешқайсысы",
  },
  en: {
    whoQ: "Who is this story about?",
    whatQ: "What happened at the end?",
    orderQ: "What happened at the beginning?",
    fallbackWhy: "That's what the story said.",
    none: "none of them",
  },
} as const;

/** Offline quiz: builds questions from the book's own sentences. */
function localQuiz(text: string, language: Language): QuizQuestion[] {
  const t = L[language] ?? L.ru;
  const sents = sentences(text);
  if (sents.length < 3) return [];

  const first = sents[0];
  const last = sents[sents.length - 1];
  const mid = sents[Math.floor(sents.length / 2)];

  const shorten = (s: string) => (s.length > 90 ? s.slice(0, 88).trim() + "…" : s);
  const distractors = sents
    .filter((s) => s !== first && s !== last && s !== mid)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .map(shorten);

  const build = (q: string, right: string): QuizQuestion => {
    const opts = [shorten(right), ...distractors.slice(0, 2)];
    const order = opts.map((o, i) => ({ o, i })).sort(() => Math.random() - 0.5);
    return {
      q,
      options: order.map((x) => x.o),
      correct: order.findIndex((x) => x.i === 0),
      why: t.fallbackWhy,
    };
  };

  return [build(t.orderQ, first), build(t.whatQ, last)].filter((q) => q.options.length >= 2);
}

export async function generateQuiz(args: {
  title: string;
  text: string;
  language: Language;
  age: number;
}): Promise<{ questions: QuizQuestion[]; offline: boolean }> {
  const res = await call<typeof args, { questions: QuizQuestion[] }>("generateQuiz", args);
  if (res?.questions?.length) return { questions: res.questions, offline: false };
  return { questions: localQuiz(args.text, args.language), offline: true };
}

// ─────────────────── Retelling (пересказ) ───────────────────

const RETELL_COPY = {
  ru: {
    great: "Отличный пересказ! Ты запомнил almost всё главное.",
    good: "Хороший пересказ! Ты передал главное.",
    ok: "Хорошее начало! Ты вспомнил часть истории.",
    tipMore: "Попробуй рассказать чуть подробнее — что было дальше?",
    tipGood: "Так держать!",
    missedLabel: "Ещё можно было упомянуть",
  },
  kk: {
    great: "Тамаша мазмұндау! Барлық негізгі нәрсені есте сақтадың.",
    good: "Жақсы мазмұндау! Негізгісін жеткіздің.",
    ok: "Жақсы бастама! Әңгіменің бір бөлігін есте сақтадың.",
    tipMore: "Сәл толығырақ айтып көрші — одан кейін не болды?",
    tipGood: "Осылай жалғастыр!",
    missedLabel: "Мынаны да айтуға болар еді",
  },
  en: {
    great: "Excellent retelling! You remembered almost everything.",
    good: "Good retelling! You got the main idea.",
    ok: "Nice start! You remembered part of the story.",
    tipMore: "Try telling a bit more — what happened next?",
    tipGood: "Keep it up!",
    missedLabel: "You could also mention",
  },
} as const;

/** Offline retell scoring: keyword overlap between chunk and retelling. */
function localRetell(chunkText: string, retelling: string, language: Language): RetellResult {
  const c = RETELL_COPY[language] ?? RETELL_COPY.ru;
  const keys = keywords(chunkText, 10);
  const said = new Set(tokens(retelling));
  const hit = keys.filter((k) => said.has(k));
  const missed = keys.filter((k) => !said.has(k)).slice(0, 3);
  const ratio = keys.length ? hit.length / keys.length : 0;
  const lengthBonus = Math.min(0.25, tokens(retelling).length / 60);
  const score = Math.round(Math.min(100, (ratio * 0.8 + lengthBonus) * 100));

  return {
    score,
    praise: score >= 75 ? c.great : score >= 45 ? c.good : c.ok,
    missed,
    tip: score >= 60 ? c.tipGood : c.tipMore,
    offline: true,
  };
}

export async function evaluateRetell(args: {
  chunkText: string;
  retelling: string;
  language: Language;
  age: number;
}): Promise<RetellResult> {
  const res = await call<typeof args, RetellResult>("evaluateRetell", args);
  if (res && typeof res.score === "number") return { ...res, offline: false };
  return localRetell(args.chunkText, args.retelling, args.language);
}

// ─────────────────── Book recommendation ───────────────────

const REC_COPY = {
  ru: {
    justRight: "в самый раз для твоего возраста",
    shorter: "короткая — прочитаешь быстро",
    longer: "подлиннее, для настоящего читателя",
    newOne: "ты её ещё не читал",
    liked: "похоже на то, что тебе нравится",
  },
  kk: {
    justRight: "жасыңа дәл келеді",
    shorter: "қысқа — тез оқып шығасың",
    longer: "ұзындау, нағыз оқырманға",
    newOne: "мұны әлі оқымағансың",
    liked: "саған ұнайтынға ұқсайды",
  },
  en: {
    justRight: "just right for your age",
    shorter: "short — a quick read",
    longer: "a longer one, for a real reader",
    newOne: "you haven't read it yet",
    liked: "similar to what you enjoy",
  },
} as const;

/** Offline recommender: scores books on age fit, length, novelty, keywords. */
function localRecommend(
  books: Book[],
  opts: {
    age: number;
    language: Language;
    preferences: string;
    readIds: Set<string>;
    lengthPref: "short" | "medium" | "long";
    challenge: "easy" | "normal" | "hard";
  },
): BookPick[] {
  const c = REC_COPY[opts.language] ?? REC_COPY.ru;
  const prefTokens = new Set(tokens(opts.preferences));

  const scored = books.map((b) => {
    let score = 0;
    const reasons: string[] = [];

    // Age fit
    if (opts.age >= b.ageMin && opts.age <= b.ageMax) {
      score += 40;
      reasons.push(c.justRight);
    } else {
      score += Math.max(0, 25 - Math.abs(opts.age - (b.ageMin + b.ageMax) / 2) * 6);
    }

    // Length: base on age, then shift by the child's stated preference.
    const ageIdeal = 90 + (opts.age - 5) * 22;
    const lengthShift = opts.lengthPref === "short" ? -45 : opts.lengthPref === "long" ? 55 : 0;
    const idealWords = ageIdeal + lengthShift;
    const diff = Math.abs(b.totalWords - idealWords);
    score += Math.max(0, 35 - diff / 6);
    if (b.totalWords < ageIdeal) reasons.push(c.shorter);
    else reasons.push(c.longer);

    // Challenge: "easy" favours shorter/simpler, "hard" favours longer books.
    if (opts.challenge === "easy" && b.totalWords <= ageIdeal) score += 15;
    if (opts.challenge === "hard" && b.totalWords >= ageIdeal) score += 15;

    // Novelty
    if (!opts.readIds.has(b.id)) {
      score += 25;
      reasons.push(c.newOne);
    } else {
      score -= 30;
    }

    // Taste match against title
    if (prefTokens.size) {
      const titleTokens = tokens(b.title);
      if (titleTokens.some((t) => prefTokens.has(t))) {
        score += 30;
        reasons.unshift(c.liked);
      }
    }

    return { book: b, score, reason: reasons.slice(0, 2).join(", ") };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({
      id: s.book.id,
      reason: s.reason.charAt(0).toUpperCase() + s.reason.slice(1),
    }));
}

export async function recommendBook(args: {
  books: Book[];
  age: number;
  language: Language;
  preferences: string;
  readTitles: string[];
  readIds: string[];
  lengthPref?: "short" | "medium" | "long";
  challenge?: "easy" | "normal" | "hard";
}): Promise<{ picks: BookPick[]; offline: boolean }> {
  const payload = {
    books: args.books.map((b) => ({
      id: b.id,
      title: b.title,
      language: b.language,
      totalWords: b.totalWords,
      difficulty: b.difficulty,
    })),
    age: args.age,
    language: args.language,
    preferences: [
      args.preferences,
      args.lengthPref ? `предпочитает длину: ${args.lengthPref}` : "",
      args.challenge ? `уровень сложности: ${args.challenge}` : "",
    ].filter(Boolean).join("; "),
    history: args.readTitles,
  };
  const res = await call<typeof payload, { picks: BookPick[] }>("recommendBook", payload);
  if (res?.picks?.length) {
    // Keep only ids that actually exist in the library.
    const valid = new Set(args.books.map((b) => b.id));
    const picks = res.picks.filter((p) => valid.has(p.id));
    if (picks.length) return { picks, offline: false };
  }
  return {
    picks: localRecommend(args.books, {
      age: args.age,
      language: args.language,
      preferences: args.preferences,
      readIds: new Set(args.readIds),
      lengthPref: args.lengthPref ?? "medium",
      challenge: args.challenge ?? "normal",
    }),
    offline: true,
  };
}
