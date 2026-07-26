/**
 * Симуляция экономики: проверяем, что прогресс не слишком лёгкий,
 * но и не унизительно медленный — и что систему нельзя обмануть.
 *
 * Запуск: node test/economy.sim.mjs
 */
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

async function load(path) {
  const src = readFileSync(path, "utf8").replace(/import type \{[^}]*\} from "[^"]*";/g, "");
  const { code } = await transform(src, { loader: "ts", format: "esm" });
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
}

const coins = await load("src/lib/coins.ts");
const level = await load("src/lib/readingLevel.ts");
const { awardForCompletion, DAILY_COIN_CAP } = coins;
const { fitFor } = level;

/** Один «день чтения»: ребёнок читает N книг, соблюдая правила. */
function simulateDay({ childAge, books, completionsSoFar }) {
  let earnedToday = 0;
  let lastFit;
  const log = [];

  for (const b of books) {
    const fit = fitFor(childAge, b.band);

    // Правило: две лёгкие подряд нельзя — считаем, что ребёнок вынужден
    // взять книгу по возрасту (то есть попытка «фарма» проваливается).
    if (fit === "below" && lastFit === "below") {
      log.push({ title: b.title, coins: 0, note: "заблокирована (вторая лёгкая подряд)" });
      continue;
    }

    const prev = completionsSoFar[b.title] ?? 0;
    const r = awardForCompletion({
      wordsRead: b.words,
      band: b.band,
      fit,
      previousCompletions: prev,
      earnedToday,
    });
    completionsSoFar[b.title] = prev + 1;
    earnedToday += r.coins;
    lastFit = fit;
    log.push({ title: b.title, coins: r.coins, note: r.reason });
  }
  return { earnedToday, log };
}

const BOOK = (title, words, band) => ({ title, words, band });

console.log("═".repeat(70));
console.log("  СЦЕНАРИЙ 1. Честный читатель 7 лет — по одной книге в день");
console.log("═".repeat(70));
{
  const completions = {};
  let total = 0;
  for (let day = 1; day <= 14; day++) {
    const { earnedToday } = simulateDay({
      childAge: 7,
      books: [BOOK(`Сказка ${day}`, 130, "6-7")],
      completionsSoFar: completions,
    });
    total += earnedToday;
    if ([1, 3, 7, 14].includes(day)) {
      console.log(`  день ${String(day).padStart(2)}: всего ${String(total).padStart(4)} монет`);
    }
  }
  console.log(`\n  За 2 недели: ${total} монет`);
  console.log(`  → первый герой (160):  ${Math.ceil(160 / (total / 14))} дней`);
  console.log(`  → мороженое (150):     ${Math.ceil(150 / (total / 14))} дней`);
  console.log(`  → кино (800):          ${Math.ceil(800 / (total / 14))} дней`);
  console.log(`  → легендарный (960):   ${Math.ceil(960 / (total / 14))} дней`);
}

console.log("\n" + "═".repeat(70));
console.log("  СЦЕНАРИЙ 2. Увлечённый читатель — 8 книг за вечер");
console.log("═".repeat(70));
{
  const completions = {};
  const books = Array.from({ length: 8 }, (_, i) => BOOK(`Книга ${i + 1}`, 130, "6-7"));
  const { earnedToday, log } = simulateDay({ childAge: 7, books, completionsSoFar: completions });
  log.forEach((l, i) => console.log(`  книга ${i + 1}: +${String(l.coins).padStart(3)}  (${l.note})`));
  console.log(`\n  Итого за вечер: ${earnedToday} монет (потолок ${DAILY_COIN_CAP})`);
  const honest = 5 * 50;
  console.log(`  Проверка: честные 5 книг дали бы ~${honest}. Марафон из 8 книг дал ${earnedToday}.`);
}

console.log("\n" + "═".repeat(70));
console.log("  СЦЕНАРИЙ 3. Попытка обмануть: перечитывать одну книгу");
console.log("═".repeat(70));
{
  const completions = {};
  const books = Array.from({ length: 6 }, () => BOOK("Репка", 130, "6-7"));
  const { earnedToday, log } = simulateDay({ childAge: 7, books, completionsSoFar: completions });
  log.forEach((l, i) => console.log(`  чтение ${i + 1}: +${String(l.coins).padStart(3)}  (${l.note})`));
  console.log(`\n  Итого за 6 перечитываний: ${earnedToday} монет`);
  console.log(`  Для сравнения: 6 РАЗНЫХ книг дали бы ~300.`);
}

console.log("\n" + "═".repeat(70));
console.log("  СЦЕНАРИЙ 4. Попытка обмануть: 10-летний берёт книги для малышей");
console.log("═".repeat(70));
{
  const completions = {};
  const books = Array.from({ length: 6 }, (_, i) => BOOK(`Малышам ${i + 1}`, 45, "4-5"));
  const { earnedToday, log } = simulateDay({ childAge: 10, books, completionsSoFar: completions });
  log.forEach((l, i) => console.log(`  книга ${i + 1}: +${String(l.coins).padStart(3)}  (${l.note})`));
  console.log(`\n  Итого: ${earnedToday} монет за 6 лёгких книг`);
  console.log(`  Честное чтение 6 книг по возрасту (10-12) дало бы ~${6 * 145}.`);
}

console.log("\n" + "═".repeat(70));
console.log("  СЦЕНАРИЙ 5. Растущий читатель — прогресс по возрастам");
console.log("═".repeat(70));
{
  for (const [age, band, words] of [[5, "4-5", 50], [7, "6-7", 130], [9, "8-9", 220], [11, "10-12", 400]]) {
    const r = awardForCompletion({
      wordsRead: words, band, fit: fitFor(age, band),
      previousCompletions: 0, earnedToday: 0,
    });
    console.log(`  ${age} лет, книга ${String(band).padEnd(6)} (${String(words).padStart(3)} слов) → ${String(r.coins).padStart(3)} монет`);
  }
}

console.log("\n" + "═".repeat(70));
console.log("  ВЫВОД: сколько дней честного чтения до каждой награды");
console.log("═".repeat(70));
{
  const perDay = awardForCompletion({
    wordsRead: 130, band: "6-7", fit: "match",
    previousCompletions: 0, earnedToday: 0,
  }).coins;
  const goals = [
    ["Мороженое", 150], ["Первый герой", 160], ["30 мин PlayStation", 250],
    ["Редкий герой", 340], ["Поход в кино", 800], ["Легендарный герой", 960],
    ["Футбольный мяч", 1500], ["Форма", 3000],
  ];
  for (const [name, price] of goals) {
    const days = Math.ceil(price / perDay);
    const weeks = (days / 7).toFixed(1);
    console.log(`  ${name.padEnd(20)} ${String(price).padStart(4)} монет = ${String(days).padStart(2)} дней (${weeks} нед.)`);
  }
}
console.log();
