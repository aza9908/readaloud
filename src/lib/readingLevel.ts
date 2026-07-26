/**
 * readingLevel.ts — определяет реальную сложность книги по её тексту.
 *
 * Раньше возраст книги был захардкожен (ageMin: 6 почти везде), поэтому
 * разделить библиотеку по возрастам было невозможно. Здесь сложность
 * считается из самого текста и переводится в возрастную категорию.
 *
 * ВАЖНО ПРО ЯЗЫКИ. Число слогов на слово систематически различается:
 * английский ~1.6, русский ~2.0, казахский ~2.25 (замерено на нашей
 * стартовой библиотеке). Без нормализации любая казахская книга выглядела бы
 * «сложной», а любая английская — «простой» просто из-за орфографии.
 * Поэтому сложность слов считается ОТНОСИТЕЛЬНО нормы своего языка.
 *
 * Модуль чистый (без React и сети) и покрыт тестами: test/readingLevel.test.mjs
 */

import type { Book, Language } from "./types";

/** Возрастные категории — по образцу детских читательских сайтов. */
export type AgeBand = "4-5" | "6-7" | "8-9" | "10-12";

export const AGE_BANDS: AgeBand[] = ["4-5", "6-7", "8-9", "10-12"];

export const BAND_LABEL: Record<AgeBand, { ru: string; kk: string; en: string }> = {
  "4-5": { ru: "4–5 лет", kk: "4–5 жас", en: "Ages 4–5" },
  "6-7": { ru: "6–7 лет", kk: "6–7 жас", en: "Ages 6–7" },
  "8-9": { ru: "8–9 лет", kk: "8–9 жас", en: "Ages 8–9" },
  "10-12": { ru: "10–12 лет", kk: "10–12 жас", en: "Ages 10–12" },
};

/** Короткая подпись сложности для карточки книги. */
export const BAND_HINT: Record<AgeBand, { ru: string; kk: string; en: string }> = {
  "4-5": { ru: "совсем короткая", kk: "өте қысқа", en: "very short" },
  "6-7": { ru: "для начинающих", kk: "бастаушыларға", en: "for beginners" },
  "8-9": { ru: "уверенное чтение", kk: "сенімді оқу", en: "confident reading" },
  "10-12": { ru: "длинная история", kk: "ұзақ әңгіме", en: "long story" },
};

export const BAND_RANGE: Record<AgeBand, { min: number; max: number }> = {
  "4-5": { min: 4, max: 5 },
  "6-7": { min: 6, max: 7 },
  "8-9": { min: 8, max: 9 },
  "10-12": { min: 10, max: 12 },
};

/** Гласные трёх наших языков (казахские ә, і, ү, ұ, ө включены). */
const VOWELS = new Set("аеёиоуыэюяәіүұөaeiouy".split(""));

/** Средняя норма слогов на слово для каждого языка — база нормализации. */
const SYLLABLE_BASELINE: Record<Language, number> = {
  ru: 2.0,
  kk: 2.25,
  en: 1.6,
};

export interface TextStats {
  words: number;
  sentences: number;
  syllablesPerWord: number;
  wordsPerSentence: number;
  /** Доля слов длиннее 9 символов — маркер трудных слов. */
  longWordRatio: number;
}

export function analyseText(text: string): TextStats {
  const words = text.toLocaleLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? [];
  const sentences = text.split(/[.!?…]+/).filter((s) => s.trim().length > 0);

  let syllables = 0;
  let longWords = 0;
  for (const w of words) {
    let v = 0;
    for (const ch of w) if (VOWELS.has(ch)) v++;
    syllables += Math.max(1, v); // слово без гласных всё равно один слог
    if (w.length > 9) longWords++;
  }

  const n = Math.max(1, words.length);
  return {
    words: words.length,
    sentences: sentences.length,
    syllablesPerWord: syllables / n,
    wordsPerSentence: words.length / Math.max(1, sentences.length),
    longWordRatio: longWords / n,
  };
}

/** Кусочно-линейная интерполяция — читаемее, чем магические формулы. */
function scale(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (value <= x1) {
      const t = (value - x0) / (x1 - x0 || 1);
      return y0 + t * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

/**
 * Оценка сложности 0–100.
 *
 * Три составляющих, в порядке важности для ребёнка:
 *   объём текста (сколько вообще предстоит прочесть),
 *   длина предложения (сколько держать в голове до точки),
 *   сложность слов относительно нормы языка.
 */
export function difficultyScore(text: string, language: Language): number {
  const s = analyseText(text);
  const baseline = SYLLABLE_BASELINE[language] ?? 2.0;

  // Объём: 0–40 баллов.
  const lengthScore = scale(s.words, [
    [0, 0], [40, 5], [80, 12], [150, 21], [300, 31], [600, 40],
  ]);

  // Длина предложения: 0–35 баллов.
  const sentenceScore = scale(s.wordsPerSentence, [
    [0, 0], [4, 5], [6, 12], [9, 21], [13, 30], [20, 35],
  ]);

  // Сложность слов ОТНОСИТЕЛЬНО своего языка: 0–25 баллов.
  const ratio = s.syllablesPerWord / baseline;
  const wordScore = scale(ratio, [
    [0.8, 2], [0.95, 7], [1.05, 13], [1.15, 19], [1.3, 25],
  ]);

  // Много длинных слов — небольшая надбавка.
  const longBonus = scale(s.longWordRatio, [[0, 0], [0.08, 2], [0.2, 5]]);

  // Демпфер коротких текстов. На тексте в десяток слов сложность слов
  // измеряется по слишком малой выборке и легко зашкаливает: «Мышка бежала,
  // хвостиком махнула» состоит из длинных слов, но прочесть его ребёнку
  // несложно — там всего шесть слов. Поэтому для совсем коротких текстов вес
  // словесной и синтаксической сложности снижаем: решает объём.
  const damper = scale(s.words, [[0, 0.3], [15, 0.42], [40, 0.72], [70, 1], [1e6, 1]]);

  const total = lengthScore + (sentenceScore + wordScore + longBonus) * damper;
  return Math.max(0, Math.min(100, total));
}

/** Переводит оценку сложности в возрастную категорию. */
export function bandFromScore(score: number): AgeBand {
  if (score < 26) return "4-5";
  if (score < 45) return "6-7";
  if (score < 63) return "8-9";
  return "10-12";
}

/** Главная функция: возрастная категория книги по её тексту. */
export function bandForText(text: string, language: Language): AgeBand {
  return bandFromScore(difficultyScore(text, language));
}

/**
 * Насколько книга подходит ребёнку данного возраста.
 *   "below" — заметно легче, чем нужно (риск «фарма» простых книг)
 *   "match" — в самый раз
 *   "above" — сложнее, полезный вызов
 */
export type LevelFit = "below" | "match" | "above";

export function fitFor(childAge: number, band: AgeBand): LevelFit {
  const { min, max } = BAND_RANGE[band];
  if (childAge > max + 1) return "below"; // ребёнок сильно старше книги
  if (childAge < min - 1) return "above"; // книга заметно старше ребёнка
  return "match";
}

/** Рекомендуемая категория для возраста ребёнка. */
export function bandForAge(age: number): AgeBand {
  if (age <= 5) return "4-5";
  if (age <= 7) return "6-7";
  if (age <= 9) return "8-9";
  return "10-12";
}

/**
 * Возрастная категория книги.
 *
 * Считается из текста, а не из полей ageMin/ageMax: в старых книгах они
 * захардкожены (почти везде 6), поэтому доверять им нельзя. Если у книги
 * уже сохранена вычисленная категория — берём её, иначе считаем на лету.
 */
export function bandForBook(book: Pick<Book, "pages" | "language"> & { band?: AgeBand }): AgeBand {
  if (book.band && AGE_BANDS.includes(book.band)) return book.band;
  return bandForText(book.pages.join(" "), book.language);
}

/**
 * Можно ли ребёнку взять эту книгу прямо сейчас.
 *
 * Правило одно и намеренно мягкое: нельзя читать две «слишком лёгкие» книги
 * подряд. Иначе десятилетний ребёнок берёт сказку для четырёхлетних, дочитывает
 * её за минуту и повторяет — это не чтение, а обход системы. После одной лёгкой
 * книги следующая должна быть по возрасту; потом снова можно взять лёгкую.
 *
 * Именно блокировка, а не просто снижение награды: ребёнок, который нашёл
 * «выгодную» механику, будет её эксплуатировать, даже если монет мало.
 */
export type PickBlock = null | "easy_twice_in_a_row";

export function pickBlockReason(
  childAge: number,
  band: AgeBand,
  lastBookFit: LevelFit | undefined,
): PickBlock {
  const fit = fitFor(childAge, band);
  if (fit === "below" && lastBookFit === "below") return "easy_twice_in_a_row";
  return null;
}

export const PICK_BLOCK_MESSAGE: Record<
  NonNullable<PickBlock>,
  { ru: string; kk: string; en: string }
> = {
  easy_twice_in_a_row: {
    ru: "Прошлая книга была совсем лёгкой. Прочитай одну по своему возрасту — и снова сможешь выбирать любые!",
    kk: "Өткен кітап тым оңай болды. Жасыңа сай біреуін оқы — содан кейін кез келгенін таңдай аласың!",
    en: "Your last book was very easy. Read one at your level, then you can pick any book again!",
  },
};
