/**
 * coins.ts — экономика монет.
 *
 * ЧТО БЫЛО НЕ ТАК. Прошлая версия выдавала всю награду ТОЛЬКО при завершении
 * книги — так закрывалась накрутка через перечитывание страниц. Для сказки на
 * 130 слов это работало, но для книги на 10 000 слов означало 77 дней чтения
 * без единой монеты. Ребёнок не видит отдачи и бросает. Именно это и произошло.
 *
 * КАК ИСПРАВЛЕНО. Платим за НОВУЮ ТЕРРИТОРИЮ, а не за факт чтения:
 * каждая впервые дочитанная страница приносит монеты сразу. Перечитывание
 * уже пройденных страниц не приносит ничего — накрутка по-прежнему закрыта,
 * но длинная книга теперь кормит ребёнка всю дорогу.
 *
 * ЧТО ЕЩЁ ДОБАВЛЕНО, чтобы вернуть интерес:
 *   • ставка поднята вдвое — прошлая была слишком скупой;
 *   • «золотые слова»: несколько слов на странице подсвечены и дают бонус —
 *     ребёнок ВИДИТ награду впереди по строке и хочет дочитать до неё;
 *   • множитель за серию дней: читаешь каждый день — получаешь больше;
 *   • бонус за завершение книги остаётся как крупная цель.
 *
 * Модуль чистый и покрыт тестами: test/coins.test.mjs
 */

import type { AgeBand, LevelFit } from "./readingLevel";

/** Монет за слово. Вдвое выше прошлой ставки (была 0.25 — слишком скупо). */
export const COINS_PER_WORD = 0.5;

/** Монет за каждую ВПЕРВЫЕ дочитанную страницу — мгновенная отдача. */
export const PAGE_MILESTONE = 5;

/** Бонус за дочитанную книгу — тем больше, чем сложнее. */
export const COMPLETION_BONUS: Record<AgeBand, number> = {
  "4-5": 12,
  "6-7": 25,
  "8-9": 40,
  "10-12": 60,
};

/**
 * Бонус за все верные ответы на вопросы по книге. Небольшой, но осмысленный:
 * он платит за ПОНИМАНИЕ, а не за проговаривание слов, и тем самым не даёт
 * превратить чтение вслух в механическое озвучивание ради монет.
 */
export const COMPREHENSION_BONUS = 20;

/** Сколько стоит одно «золотое слово». */
export const GOLDEN_WORD_BONUS = 3;

/** Примерно одно золотое слово на столько слов текста. */
export const GOLDEN_WORD_EVERY = 25;

/** Книга заметно ниже уровня ребёнка оплачивается частично. */
export const BELOW_LEVEL_FACTOR = 0.35;

/** Небольшая надбавка за книгу выше своего уровня — за смелость. */
export const ABOVE_LEVEL_FACTOR = 1.15;

/**
 * Множитель за серию дней подряд. Растёт медленно и упирается в потолок,
 * чтобы пропуск одного дня не обесценивал накопленное.
 */
export function streakMultiplier(streakDays: number): number {
  // Надбавка идёт ПО НЕДЕЛЯМ: полная неделя подряд даёт +0.2, две недели +0.4,
  // и так далее. Растёт заметно, но упирается в потолок — иначе ребёнок,
  // пропустивший один день после трёх месяцев, терял бы слишком много,
  // и это било бы сильнее, чем мотивировало.
  const fullWeeks = Math.floor(streakDays / 7);
  return Math.min(1 + fullWeeks * 0.2, STREAK_MULTIPLIER_CAP);
}

/** Потолок множителя: втрое — дальше экономика перестаёт сходиться. */
export const STREAK_MULTIPLIER_CAP = 3;

/**
 * Порог, после которого награда за день уменьшается. Мягкий: сверх порога
 * монеты продолжают капать по сниженной ставке, потому что жёсткий ноль
 * наказывал бы увлечённого читателя.
 */
export const DAILY_SOFT_CAP = 400;
export const OVER_CAP_RATE = 0.25;

/** Совместимость со старым именем. @deprecated */
export const DAILY_COIN_CAP = DAILY_SOFT_CAP;

function settle(v: number): number {
  return Math.max(0, Math.floor(v));
}

/** Применяет мягкий дневной порог к сырой награде. */
function applySoftCap(coins: number, earnedToday: number): { coins: number; capped: boolean } {
  const beforeCap = Math.max(0, DAILY_SOFT_CAP - earnedToday);
  if (coins <= beforeCap) return { coins: settle(coins), capped: false };
  return { coins: settle(beforeCap + (coins - beforeCap) * OVER_CAP_RATE), capped: true };
}

// ───────────────────── Награда за страницу ─────────────────────

export interface PageAwardInput {
  wordsOnPage: number;
  goldenWordsRead: number;
  alreadyAwarded: boolean;
  fit: LevelFit;
  streakDays: number;
  earnedToday: number;
}

export interface PageAwardResult {
  coins: number;
  breakdown: { words: number; milestone: number; golden: number; streakBonus: number };
  reason: "new_page" | "already_read" | "daily_cap";
}

/**
 * Награда за дочитанную страницу. Это главное изменение: ребёнок получает
 * монеты СРАЗУ, а не в конце книги, поэтому длинные книги больше не выглядят
 * бесплатной работой.
 */
export function awardForPage(input: PageAwardInput): PageAwardResult {
  const empty = { words: 0, milestone: 0, golden: 0, streakBonus: 0 };

  // Перечитывание уже пройденной страницы не приносит ничего — так закрыта
  // накрутка, ради которой раньше приходилось откладывать всю награду на конец.
  if (input.alreadyAwarded) {
    return { coins: 0, breakdown: empty, reason: "already_read" };
  }

  const levelFactor =
    input.fit === "below" ? BELOW_LEVEL_FACTOR
    : input.fit === "above" ? ABOVE_LEVEL_FACTOR
    : 1;

  const words = input.wordsOnPage * COINS_PER_WORD * levelFactor;
  const milestone = PAGE_MILESTONE * levelFactor;
  const golden = input.goldenWordsRead * GOLDEN_WORD_BONUS;

  const base = words + milestone + golden;
  const mult = streakMultiplier(input.streakDays);
  const withStreak = base * mult;

  const { coins, capped } = applySoftCap(withStreak, input.earnedToday);

  return {
    coins,
    breakdown: {
      words: settle(words),
      milestone: settle(milestone),
      golden: settle(golden),
      streakBonus: settle(withStreak - base),
    },
    reason: capped ? "daily_cap" : "new_page",
  };
}

// ───────────────────── Награда за книгу ─────────────────────

export interface AwardInput {
  wordsRead: number;
  band: AgeBand;
  fit: LevelFit;
  previousCompletions: number;
  earnedToday: number;
  streakDays?: number;
}

export interface AwardResult {
  coins: number;
  baseCoins: number;
  reason: "full" | "reread" | "below_level" | "daily_cap" | "none";
}

/** Доля бонуса за повторное завершение: 1-й раз, 2-й, дальше. */
export const REREAD_FACTORS = [1, 0.3, 0];

/**
 * Бонус за ДОЧИТАННУЮ книгу. Теперь это именно бонус сверх постраничных
 * начислений, а не вся награда: основное ребёнок уже получил по дороге.
 */
export function awardForCompletion(input: AwardInput): AwardResult {
  const { band, fit, previousCompletions, earnedToday, streakDays = 0 } = input;

  const bonus = COMPLETION_BONUS[band];
  const baseCoins = settle(bonus);

  const rereadFactor =
    REREAD_FACTORS[Math.min(previousCompletions, REREAD_FACTORS.length - 1)];
  if (rereadFactor === 0) {
    return { coins: 0, baseCoins, reason: "reread" };
  }

  const levelFactor =
    fit === "below" ? BELOW_LEVEL_FACTOR : fit === "above" ? ABOVE_LEVEL_FACTOR : 1;

  const raw = bonus * rereadFactor * levelFactor * streakMultiplier(streakDays);
  const { coins, capped } = applySoftCap(raw, earnedToday);

  let reason: AwardResult["reason"] = "full";
  if (rereadFactor < 1) reason = "reread";
  else if (fit === "below") reason = "below_level";
  if (capped) reason = "daily_cap";

  return { coins, baseCoins, reason };
}

// ───────────────────── Золотые слова ─────────────────────

/** Небольшая стабильная хеш-функция (не криптография, только для раскладки). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Детерминированный выбор «золотых слов» на странице.
 *
 * Зачем детерминированный: если бы слова выбирались случайно при каждом
 * открытии, ребёнок видел бы разные подсветки на одной странице и перестал
 * бы им доверять. Здесь набор зависит только от книги и номера страницы,
 * поэтому одинаков при любом заходе, но выглядит непредсказуемо.
 *
 * Короткие слова пропускаем: бонус должен доставаться за настоящее слово,
 * а не за «и» или «на».
 */
export function goldenWordIndexes(
  bookId: string,
  pageIndex: number,
  words: string[],
): Set<number> {
  const picked = new Set<number>();
  const candidates: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const clean = words[i].replace(/[^\p{L}\p{N}]/gu, "");
    if (clean.length >= 4) candidates.push(i);
  }
  if (candidates.length === 0) return picked;

  const count = Math.max(1, Math.round(words.length / GOLDEN_WORD_EVERY));
  const seedBase = hash(`${bookId}:${pageIndex}`);
  const stride = Math.max(1, Math.floor(candidates.length / count));

  for (let k = 0; k < count && picked.size < candidates.length; k++) {
    // Разносим выбор по странице, чтобы бонусы не слипались в начале.
    const jitter = hash(`${seedBase}:${k}`) % stride;
    const pos = Math.min(candidates.length - 1, k * stride + jitter);
    picked.add(candidates[pos]);
  }
  return picked;
}

// ───────────────────── Пояснения для ребёнка ─────────────────────

export const AWARD_EXPLANATION: Record<string, { ru: string; kk: string; en: string }> = {
  full: {
    ru: "Отлично! Полная награда за книгу.",
    kk: "Тамаша! Кітап үшін толық сыйақы.",
    en: "Great! Full reward for the book.",
  },
  new_page: {
    ru: "Страница прочитана — монеты твои!",
    kk: "Бет оқылды — монеталар сенікі!",
    en: "Page done — coins are yours!",
  },
  already_read: {
    ru: "Эту страницу ты уже читал. Новые страницы приносят монеты!",
    kk: "Бұл бетті бұрын оқығансың. Жаңа беттер монета әкеледі!",
    en: "You have read this page already. New pages earn coins!",
  },
  reread: {
    ru: "Книга уже прочитана — бонус за повтор меньше. Попробуй новую!",
    kk: "Кітап оқылған — қайталағанда бонус аз. Жаңасын байқа!",
    en: "Already finished this book — repeat bonus is smaller. Try a new one!",
  },
  below_level: {
    ru: "Книга простовата для тебя — монет меньше. Возьми посложнее!",
    kk: "Бұл кітап саған оңай — монета аз. Күрделірегін ал!",
    en: "This book is easy for you — fewer coins. Try a harder one!",
  },
  daily_cap: {
    ru: "Ты сегодня много прочитал! Дальше монет меньше — завтра снова полная награда.",
    kk: "Бүгін көп оқыдың! Әрі қарай монета азырақ — ертең толық сыйақы.",
    en: "You have read a lot today! Coins are smaller now — full rewards tomorrow.",
  },
  none: { ru: "", kk: "", en: "" },
};
