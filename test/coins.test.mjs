// Проверяет новую экономику монет: адекватные суммы и работающие
// ограничения против «фарма» (повторы, лёгкие книги, дневной потолок).
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const src = readFileSync("src/lib/coins.ts", "utf8")
  .replace(/import type \{[^}]*\} from "[^"]*";/g, "");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const m = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const { awardForCompletion, coinsForWords, DAILY_SOFT_CAP, OVER_CAP_RATE } = m;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : ` — получили ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};
const A = (o) => awardForCompletion({ previousCompletions: 0, earnedToday: 0, fit: "match", ...o });

console.log("\n── сколько монет за типичные книги (первое чтение, по возрасту) ──");
const cases = [
  ["Репка (128 сл, 6-7)", { wordsRead: 128, band: "6-7" }],
  ["короткая малышам (40 сл, 4-5)", { wordsRead: 40, band: "4-5" }],
  ["книга 8-9 (200 сл)", { wordsRead: 200, band: "8-9" }],
  ["длинная 10-12 (400 сл)", { wordsRead: 400, band: "10-12" }],
];
for (const [label, inp] of cases) {
  const r = A(inp);
  const old = inp.wordsRead + 50; // прежняя формула: 1 монета/слово + 50
  console.log(`  ${label.padEnd(30)} ${String(r.coins).padStart(4)} монет   (было бы ${old}, в ${(old / r.coins).toFixed(1)}× больше)`);
}

console.log("\n── сложнее книга = выше награда (стимул расти) ──");
{
  const easy = A({ wordsRead: 150, band: "4-5" }).coins;
  const mid = A({ wordsRead: 150, band: "6-7" }).coins;
  const hard = A({ wordsRead: 150, band: "8-9" }).coins;
  console.log(`    при равном объёме: 4-5 → ${easy}, 6-7 → ${mid}, 8-9 → ${hard}`);
  eq("награда растёт со сложностью", easy < mid && mid < hard, true);
}

console.log("\n── повторное чтение той же книги ──");
{
  const first = A({ wordsRead: 128, band: "6-7", previousCompletions: 0 });
  const second = A({ wordsRead: 128, band: "6-7", previousCompletions: 1 });
  const third = A({ wordsRead: 128, band: "6-7", previousCompletions: 2 });
  console.log(`    1-й раз ${first.coins}, 2-й раз ${second.coins}, 3-й раз ${third.coins}`);
  eq("второй раз заметно меньше", second.coins < first.coins * 0.4, true);
  eq("третий раз — ноль", third.coins, 0);
  eq("причина объяснена", third.reason, "reread");
}

console.log("\n── лёгкая книга для старшего ребёнка ──");
{
  const match = A({ wordsRead: 60, band: "4-5", fit: "match" });
  const below = A({ wordsRead: 60, band: "4-5", fit: "below" });
  console.log(`    по возрасту ${match.coins}, ниже уровня ${below.coins}`);
  eq("ниже уровня платят меньше", below.coins < match.coins, true);
  eq("причина объяснена", below.reason, "below_level");
}

console.log("\n── книга выше уровня — небольшая надбавка ──");
{
  const match = A({ wordsRead: 200, band: "8-9", fit: "match" }).coins;
  const above = A({ wordsRead: 200, band: "8-9", fit: "above" }).coins;
  console.log(`    по возрасту ${match}, выше уровня ${above}`);
  eq("за вызов платят чуть больше", above > match, true);
}

console.log("\n── дневной порог: мягкий, а не жёсткий ──");
{
  const under = A({ wordsRead: 200, band: "8-9", earnedToday: 0 });
  const over = A({ wordsRead: 200, band: "8-9", earnedToday: DAILY_SOFT_CAP });
  console.log(`    до порога ${under.coins}, за порогом ${over.coins}`);
  // Главное требование: за порогом награда УМЕНЬШАЕТСЯ, но не обнуляется —
  // иначе увлечённый ребёнок читает лишние книги бесплатно и теряет мотивацию.
  eq("за порогом всё ещё что-то начисляют", over.coins > 0, true);
  eq("за порогом заметно меньше", over.coins < under.coins * 0.5, true);
  eq("причина объяснена", over.reason, "daily_cap");

  // Награда, попавшая на границу, считается по частям.
  const straddling = A({ wordsRead: 200, band: "8-9", earnedToday: DAILY_SOFT_CAP - 10 });
  eq("часть до порога — полностью, остаток — по сниженной ставке",
     straddling.coins > 10 && straddling.coins < under.coins, true);

  eq("промежуточный расчёт тоже мягкий", coinsForWords(400, DAILY_SOFT_CAP) > 0, true);
}

console.log("\n── марафон должен давать убывающую отдачу ──");
{
  // Пять книг честно против восьми книг подряд.
  let five = 0, eight = 0, earned = 0;
  for (let i = 0; i < 5; i++) {
    const r = A({ wordsRead: 130, band: "6-7", earnedToday: earned });
    five += r.coins; earned += r.coins;
  }
  earned = 0;
  for (let i = 0; i < 8; i++) {
    const r = A({ wordsRead: 130, band: "6-7", earnedToday: earned });
    eight += r.coins; earned += r.coins;
  }
  console.log(`    5 книг → ${five}, 8 книг → ${eight}`);
  eq("восемь книг дают больше пяти", eight > five, true);
  eq("но далеко не пропорционально", eight < five * 1.4, true);
}

console.log("\n── сколько книг до награды (проверка здравого смысла) ──");
{
  const perBook = A({ wordsRead: 128, band: "6-7" }).coins;
  for (const [name, price] of [["Мороженое", 300], ["30 мин PlayStation", 500], ["Поход в кино", 4000]]) {
    console.log(`    ${name.padEnd(20)} ${price} монет = ${(price / perBook).toFixed(0)} книг`);
  }
  eq("одна книга даёт разумную сумму", perBook > 20 && perBook < 80, true);
}

console.log(`\n${pass} прошло, ${fail} упало\n`);
process.exit(fail ? 1 : 0);
