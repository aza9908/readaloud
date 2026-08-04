// Экономика монет: щедрость по ходу чтения + защита от накрутки.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const src = readFileSync("src/lib/coins.ts", "utf8").replace(/import type \{[^}]*\} from "[^"]*";/g, "");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const m = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const { awardForPage, awardForCompletion, goldenWordIndexes,
        streakMultiplier, DAILY_SOFT_CAP } = m;

let pass = 0, fail = 0;
const eq = (n, g, w) => { const ok = JSON.stringify(g)===JSON.stringify(w);
  console.log(`${ok?"  ok  ":"  FAIL"} ${n}${ok?"":` — ${JSON.stringify(g)} ≠ ${JSON.stringify(w)}`}`); ok?pass++:fail++; };
const P = (o) => awardForPage({ wordsOnPage:22, goldenWordsRead:1, alreadyAwarded:false,
  fit:"match", streakDays:1, earnedToday:0, ...o });

console.log("\n── ГЛАВНОЕ: длинная книга платит СРАЗУ, а не в конце ──");
{
  // Это и была причина, по которой дети бросали чтение: книга на 10 000 слов
  // не приносила ничего до самого конца.
  const first = P({});
  eq("первая же страница приносит монеты", first.coins > 0, true);
  eq("причина — новая страница", first.reason, "new_page");

  // 455 страниц большой книги — каждая платит.
  let total = 0, earned = 0;
  for (let i = 0; i < 50; i++) {
    const r = P({ earnedToday: earned });
    total += r.coins; earned += r.coins;
  }
  eq("50 страниц длинной книги приносят заметную сумму", total > 300, true);
}

console.log("\n── перечитывание не приносит ничего ──");
{
  const again = P({ alreadyAwarded: true });
  eq("уже пройденная страница = 0 монет", again.coins, 0);
  eq("причина объяснена", again.reason, "already_read");
}

console.log("\n── награда стала заметно щедрее ──");
{
  // Типичная сказка ~130 слов = 6 страниц.
  let total = 0, earned = 0;
  for (let i = 0; i < 6; i++) { const r = P({ earnedToday: earned }); total += r.coins; earned += r.coins; }
  const done = awardForCompletion({ wordsRead:130, band:"6-7", fit:"match",
    previousCompletions:0, earnedToday:earned, streakDays:1 });
  const sum = total + done.coins;
  console.log(`    типичная сказка: ${sum} монет (раньше было 50)`);
  eq("сказка приносит существенно больше прежнего", sum > 100, true);
}

console.log("\n── серия дней увеличивает награду ──");
{
  eq("день 1 без множителя", streakMultiplier(1), 1);
  eq("множитель растёт", streakMultiplier(7) > streakMultiplier(2), true);
  eq("множитель ограничен сверху", streakMultiplier(365), 1.5);
  const d1 = P({ streakDays: 1 }).coins;
  const d14 = P({ streakDays: 14 }).coins;
  eq("на серии платят больше", d14 > d1, true);
}

console.log("\n── золотые слова ──");
{
  const page = "Ертеде бір кемпір мен шал болыпты жақсы өмір сүрді бақытты".split(" ");
  const a = [...goldenWordIndexes("b1", 0, page)].sort();
  const b = [...goldenWordIndexes("b1", 0, page)].sort();
  eq("выбор стабилен между заходами", a, b);
  eq("на странице есть хотя бы одно", a.length >= 1, true);
  // Короткие слова не должны попадать: бонус за настоящее слово.
  for (const i of a) {
    eq(`слово «${page[i]}» достаточно длинное`, page[i].replace(/[^\p{L}\p{N}]/gu,"").length >= 4, true);
  }
  const withGold = P({ goldenWordsRead: 3 }).coins;
  const noGold = P({ goldenWordsRead: 0 }).coins;
  eq("золотые слова прибавляют монет", withGold > noGold, true);
}

console.log("\n── лёгкая книга для старшего платит меньше ──");
{
  eq("ниже уровня — меньше", P({ fit:"below" }).coins < P({ fit:"match" }).coins, true);
  eq("выше уровня — больше", P({ fit:"above" }).coins > P({ fit:"match" }).coins, true);
}

console.log("\n── дневной порог мягкий ──");
{
  const over = P({ earnedToday: DAILY_SOFT_CAP });
  eq("за порогом всё ещё платят", over.coins > 0, true);
  eq("но меньше", over.coins < P({}).coins, true);
}

console.log("\n── бонус за книгу: повтор обесценивается ──");
{
  const B = (n) => awardForCompletion({ wordsRead:130, band:"6-7", fit:"match",
    previousCompletions:n, earnedToday:0, streakDays:1 }).coins;
  eq("второй раз меньше первого", B(1) < B(0), true);
  eq("третий раз ноль", B(2), 0);
}

console.log(`\n${pass} прошло, ${fail} упало\n`);
process.exit(fail ? 1 : 0);
