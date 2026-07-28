/**
 * Симуляция реального чтения ребёнком с ошибками распознавания.
 *
 * Цель — измерить, а не утверждать: насколько точно курсор следует за
 * читающим при разном качестве ASR. Моделируются реальные явления:
 *   • подстановки (ASR слышит другое слово)
 *   • пропуски (слово не распознано)
 *   • вставки (шум, покашливание)
 *   • повторы (ребёнок перечитывает слово)
 *   • запинки (пауза, слово произносится по слогам)
 *   • промежуточные результаты, которые потом уточняются
 */
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const src = readFileSync("src/lib/alignment.ts", "utf8");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const { ReadingAligner } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);

// ─────────────── Тексты ───────────────
const PAGES_RU = [
  "Посадил дед репку. Выросла репка большая, пребольшая.",
  "Стал дед репку из земли тянуть. Тянет, потянет, а вытянуть не может.",
  "Позвал дед бабку. Бабка за дедку, дедка за репку.",
  "Тянут, потянут, а вытянуть не могут. Позвала бабка внучку.",
];
const PAGES_KK = [
  "Ертеде бір кемпір мен шал болыпты.",
  "Олардың сегіз ұлы бар еді.",
  "Ең кішісі Ер Төстік батыр болып өсті.",
  "Ол өте күшті әрі ақылды бала еді.",
];
const PAGES_EN = [
  "Once there was a little cloud named Puff. Puff lived high in the sky.",
  "All day long, Puff floated over hills and rivers.",
  "One hot summer day, Puff looked down and saw a small garden.",
];

// ─────────────── Генератор ошибок ───────────────
function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Русские приближения казахских букв — так их часто возвращает браузер. */
const KZ_TO_RU = { "ә":"а","ғ":"г","қ":"к","ң":"н","ө":"о","ұ":"у","ү":"у","һ":"х","і":"и" };

/**
 * Заменяет казахские буквы русскими — самая частая систематическая ошибка
 * распознавания kk-KZ, и именно она ломала выравнивание.
 */
function russify(word, rate, rnd) {
  let out = "";
  for (const ch of word) {
    out += (KZ_TO_RU[ch] && rnd() < rate) ? KZ_TO_RU[ch] : ch;
  }
  return out;
}

/** Портит слово так, как это делает реальный ASR. */
function corrupt(word, rnd) {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "");
  if (!w) return w;
  const r = rnd();
  if (r < 0.34 && w.length > 3) {
    // подстановка буквы — самая частая ошибка
    const i = Math.floor(rnd() * w.length);
    const alt = "аоеиуынтсрк";
    return w.slice(0, i) + alt[Math.floor(rnd() * alt.length)] + w.slice(i + 1);
  }
  if (r < 0.67 && w.length > 4) {
    // потеря окончания — типично для быстрой речи
    return w.slice(0, w.length - 1 - Math.floor(rnd() * 2));
  }
  // совсем другое слово
  const others = ["мама", "потом", "вот", "как", "это", "там"];
  return others[Math.floor(rnd() * others.length)];
}

/**
 * Прогоняет одну страницу через симулятор.
 * Возвращает трассу: на каждом шаге — истинная позиция чтения и позиция курсора.
 */
function simulatePage(aligner, words, profile, rnd) {
  aligner.setPage(words);
  let finalText = "";
  const trace = [];

  for (let truePos = 0; truePos < words.length; truePos++) {
    const word = words[truePos];
    let spoken = word.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "");
    // Казахские буквы часто приходят русскими — воспроизводим это.
    if (profile.russifyRate) spoken = russify(spoken, profile.russifyRate, rnd);

    // Пропуск слова — ребёнок промолчал или ASR не расслышал
    if (rnd() < profile.deletionRate) {
      trace.push({ truePos: truePos + 1, cursor: aligner.cursor });
      continue;
    }
    // Ошибка распознавания
    if (rnd() < profile.errorRate) spoken = corrupt(word, rnd);

    // Промежуточные результаты: ASR сначала выдаёт черновик, потом уточняет
    const interimSteps = 1 + Math.floor(rnd() * 2);
    for (let s = 0; s < interimSteps; s++) {
      aligner.feed(finalText, (finalText ? " " : "") + spoken);
    }
    finalText = (finalText ? finalText + " " : "") + spoken;
    aligner.feed(finalText, "");

    // Ребёнок перечитал слово
    if (rnd() < profile.repeatRate) {
      finalText += " " + spoken;
      aligner.feed(finalText, "");
    }
    // Посторонний шум распознан как слово
    if (rnd() < profile.insertionRate) {
      finalText += " " + ["ммм", "ааа", "эээ"][Math.floor(rnd() * 3)];
      aligner.feed(finalText, "");
    }

    trace.push({ truePos: truePos + 1, cursor: aligner.cursor });
  }
  return trace;
}

function evaluate(pages, profile, seed) {
  const rnd = mulberry(seed);
  const aligner = new ReadingAligner();
  let exact = 0, total = 0, aheadSum = 0, behindSum = 0;
  let maxAhead = 0, stalls = 0, completed = 0;

  for (const page of pages) {
    const words = page.split(/\s+/);
    const trace = simulatePage(aligner, words, profile, rnd);
    for (const { truePos, cursor } of trace) {
      total++;
      const drift = cursor - truePos;      // >0 = курсор убежал вперёд
      if (drift === 0) exact++;
      if (drift > 0) { aheadSum += drift; maxAhead = Math.max(maxAhead, drift); }
      if (drift < 0) behindSum += -drift;
    }
    // Дочитал ли до конца страницы (иначе автопереход не сработает)
    if (aligner.cursor >= words.length) completed++;
    else stalls++;
  }
  return {
    exactPct: (exact / total) * 100,
    avgAhead: aheadSum / total,
    avgBehind: behindSum / total,
    maxAhead,
    pagesCompleted: completed,
    pagesStalled: stalls,
    totalPages: pages.length,
  };
}

// ─────────────── Профили качества ASR ───────────────
const PROFILES = {
  "Идеальные условия (тихо, чёткая речь)":
    { errorRate: 0.03, deletionRate: 0.02, insertionRate: 0.01, repeatRate: 0.03 },
  "Русский, обычный ребёнок 7 лет":
    { errorRate: 0.12, deletionRate: 0.06, insertionRate: 0.04, repeatRate: 0.10 },
  "Русский, шумная комната":
    { errorRate: 0.22, deletionRate: 0.12, insertionRate: 0.10, repeatRate: 0.12 },
  "Казахский (ASR слабее)":
    { errorRate: 0.30, deletionRate: 0.15, insertionRate: 0.10, repeatRate: 0.12,
      russifyRate: 0.7 },
  "Тяжёлый случай (плохой микрофон)":
    { errorRate: 0.40, deletionRate: 0.22, insertionRate: 0.15, repeatRate: 0.15 },
};

const CORPORA = { RU: PAGES_RU, KK: PAGES_KK, EN: PAGES_EN };

console.log("ТОЧНОСТЬ СЛЕЖЕНИЯ ЗА ЧТЕНИЕМ — симуляция, 40 прогонов на профиль\n");
console.log("Профиль                                  Точно   Ср.опережение  Макс   Стр.дочитано");
console.log("─".repeat(92));

const summary = [];
for (const [name, profile] of Object.entries(PROFILES)) {
  const runs = [];
  for (let s = 0; s < 40; s++) {
    const corpus = CORPORA[["RU", "RU", "KK", "EN"][s % 4]];
    runs.push(evaluate(corpus, profile, s * 7919 + 13));
  }
  const avg = (f) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
  const row = {
    name,
    exact: avg((r) => r.exactPct),
    ahead: avg((r) => r.avgAhead),
    behind: avg((r) => r.avgBehind),
    maxAhead: Math.max(...runs.map((r) => r.maxAhead)),
    completedPct: (avg((r) => r.pagesCompleted) / avg((r) => r.totalPages)) * 100,
  };
  summary.push(row);
  console.log(
    `${name.padEnd(40)} ${row.exact.toFixed(1).padStart(5)}%  ` +
    `${row.ahead.toFixed(2).padStart(9)} сл.  ${String(row.maxAhead).padStart(4)}  ` +
    `${row.completedPct.toFixed(0).padStart(9)}%`,
  );
}

console.log("\nПояснения:");
console.log("  Точно        — доля моментов, когда курсор ровно на читаемом слове");
console.log("  Ср.опережение — на сколько слов курсор в среднем убегает вперёд (главный раздражитель)");
console.log("  Макс          — худший случай опережения за все прогоны");
console.log("  Стр.дочитано  — доля страниц, где курсор дошёл до конца (иначе нужна кнопка «Пропустить»)");
