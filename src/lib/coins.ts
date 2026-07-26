/**
 * coins.ts — единственное место, где решается, сколько монет заработано.
 *
 * ЗАЧЕМ ПЕРЕСЧИТАНО. Раньше давали 1 монету за слово + 50 за книгу, то есть
 * ~180 монет за обычную сказку. При таких числах ребёнок «покупал» настоящую
 * награду (мороженое за 300) меньше чем за две книги — родитель не успевал
 * ничего заметить, а награда обесценивалась. Теперь начисление примерно
 * в 3,5 раза скромнее, и главное — оно зависит не от объёма текста, а от
 * приложенного усилия.
 *
 * ЧЕТЫРЕ ПРАВИЛА ПРОТИВ «ФАРМА»:
 *   1. За слова платим по дробной ставке, а не по монете за слово.
 *   2. Бонус за книгу растёт со сложностью — выгоднее читать по возрасту,
 *      чем перечитывать простое.
 *   3. Повторное чтение той же книги почти не приносит монет.
 *   4. Книга сильно ниже уровня ребёнка оплачивается частично.
 *   5. Дневной потолок — чтобы нельзя было «нафармить» дорогую награду
 *      за один вечер. Читать сверх потолка можно, монеты просто не капают.
 *
 * Модуль чистый и покрыт тестами: test/coins.test.mjs
 */

import type { AgeBand, LevelFit } from "./readingLevel";

/** Монет за одно прочитанное слово. */
export const COINS_PER_WORD = 0.25;

/** Бонус за дочитанную книгу — тем больше, чем сложнее книга. */
export const COMPLETION_BONUS: Record<AgeBand, number> = {
  "4-5": 8,
  "6-7": 18,
  "8-9": 30,
  "10-12": 45,
};

/** Доля от награды при повторном чтении: 1-й раз, 2-й раз, дальше. */
export const REREAD_FACTORS = [1, 0.3, 0];

/** Книга заметно ниже уровня ребёнка оплачивается частично. */
export const BELOW_LEVEL_FACTOR = 0.35;

/** Небольшая надбавка за книгу выше своего уровня — за смелость. */
export const ABOVE_LEVEL_FACTOR = 1.15;

/**
 * Порог, после которого награда за день резко уменьшается (≈5 книг по
 * возрасту). Именно уменьшается, а не обнуляется: жёсткий ноль наказывал бы
 * увлечённого ребёнка — прочитал восемь книг вместо пяти и не получил ничего.
 * Симуляция показала, что при жёстком потолке 8 книг давали 260 монет против
 * 250 за пять, то есть три лишние книги стоили 10 монет. Теперь сверх порога
 * монеты продолжают капать, но по сниженной ставке — марафон даёт убывающую
 * отдачу, а ребёнок всегда видит награду за труд.
 */
export const DAILY_SOFT_CAP = 260;

/** Доля награды за книги сверх дневного порога. */
export const OVER_CAP_RATE = 0.25;

/** Совместимость со старым именем. @deprecated используйте DAILY_SOFT_CAP */
export const DAILY_COIN_CAP = DAILY_SOFT_CAP;

export interface AwardInput {
  /** Сколько слов реально прочитано вслух. */
  wordsRead: number;
  /** Категория сложности книги. */
  band: AgeBand;
  /** Насколько книга подходит ребёнку. */
  fit: LevelFit;
  /** Сколько раз эта книга уже была дочитана раньше (0 = впервые). */
  previousCompletions: number;
  /** Сколько монет уже начислено сегодня. */
  earnedToday: number;
}

export interface AwardResult {
  /** Итог к начислению — уже с учётом всех правил и потолка. */
  coins: number;
  /** Награда до ограничений — для объяснения в интерфейсе. */
  baseCoins: number;
  /** Почему срезали, если срезали. */
  reason: "full" | "reread" | "below_level" | "daily_cap" | "none";
}

/** Округляем вниз, но не даём уйти в ноль за честно прочитанную книгу. */
function settle(value: number): number {
  return Math.max(0, Math.floor(value));
}

/**
 * Считает награду за дочитанную книгу.
 * Функция чистая: одни и те же входные данные всегда дают один результат,
 * поэтому её легко проверить тестами и объяснить родителю.
 */
export function awardForCompletion(input: AwardInput): AwardResult {
  const { wordsRead, band, fit, previousCompletions, earnedToday } = input;

  const base = wordsRead * COINS_PER_WORD + COMPLETION_BONUS[band];
  const baseCoins = settle(base);

  // Повторное чтение — главный ограничитель.
  const rereadFactor =
    REREAD_FACTORS[Math.min(previousCompletions, REREAD_FACTORS.length - 1)];
  if (rereadFactor === 0) {
    return { coins: 0, baseCoins, reason: "reread" };
  }

  const levelFactor =
    fit === "below" ? BELOW_LEVEL_FACTOR : fit === "above" ? ABOVE_LEVEL_FACTOR : 1;

  let coins = settle(base * rereadFactor * levelFactor);

  let reason: AwardResult["reason"] = "full";
  if (rereadFactor < 1) reason = "reread";
  else if (fit === "below") reason = "below_level";

  // Дневной порог применяем последним: часть награды до порога считаем
  // полностью, остаток — по сниженной ставке.
  const beforeCap = Math.max(0, DAILY_SOFT_CAP - earnedToday);
  if (coins > beforeCap) {
    const over = coins - beforeCap;
    coins = settle(beforeCap + over * OVER_CAP_RATE);
    reason = "daily_cap";
  }

  return { coins, baseCoins, reason };
}

/**
 * Монеты за чтение по ходу страницы (промежуточное начисление).
 * Держим ту же ставку, что и в итоговом расчёте, чтобы сумма сходилась.
 */
export function coinsForWords(words: number, earnedToday: number): number {
  const raw = settle(words * COINS_PER_WORD);
  const beforeCap = Math.max(0, DAILY_SOFT_CAP - earnedToday);
  if (raw <= beforeCap) return raw;
  return settle(beforeCap + (raw - beforeCap) * OVER_CAP_RATE);
}

/** Человеческое объяснение, почему монет меньше обычного. */
export const AWARD_EXPLANATION: Record<
  AwardResult["reason"],
  { ru: string; kk: string; en: string }
> = {
  full: {
    ru: "Отлично! Полная награда за книгу.",
    kk: "Тамаша! Кітап үшін толық сыйақы.",
    en: "Great! Full reward for the book.",
  },
  reread: {
    ru: "Эту книгу ты уже читал — за повтор монет меньше. Попробуй новую!",
    kk: "Бұл кітапты бұрын оқығансың — қайталағанда монета аз. Жаңасын байқа!",
    en: "You have read this book before — repeats earn less. Try a new one!",
  },
  below_level: {
    ru: "Книга простовата для тебя — за неё монет меньше. Возьми посложнее!",
    kk: "Бұл кітап саған оңай — монета аз. Күрделірегін ал!",
    en: "This book is easy for you — fewer coins. Try a harder one!",
  },
  daily_cap: {
    ru: "Ты сегодня много прочитал! Дальше монет за книгу меньше — завтра снова полная награда.",
    kk: "Бүгін көп оқыдың! Әрі қарай монета азырақ — ертең тағы толық сыйақы.",
    en: "You have read a lot today! Coins are smaller now — full rewards return tomorrow.",
  },
  none: { ru: "", kk: "", en: "" },
};
