// Проверяет, что сложность книг определяется осмысленно и, главное,
// НЕ зависит от орфографии языка (казахские книги не должны автоматом
// становиться «сложными» из-за большего числа слогов в слове).
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const src = readFileSync("src/lib/readingLevel.ts", "utf8")
  .replace(/import type \{[^}]*\} from "[^"]*";/g, "");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const m = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const { bandForText, difficultyScore, analyseText, fitFor, bandForAge, pickBlockReason } = m;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : ` — получили ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

console.log("\n── реальные книги стартовой библиотеки ──");
const books = JSON.parse(readFileSync("src/lib/starterBooks.json", "utf8"));
const byBand = {};
for (const b of books) {
  const score = difficultyScore(b.text, b.language);
  const band = bandForText(b.text, b.language);
  const st = analyseText(b.text);
  byBand[band] = (byBand[band] ?? 0) + 1;
  console.log(`  ${b.title.padEnd(26)} ${b.language}  ${String(st.words).padStart(4)} сл  ${score.toFixed(0).padStart(3)} баллов → ${band}`);
}
console.log("  распределение:", JSON.stringify(byBand));

console.log("\n── язык не должен влиять на категорию сам по себе ──");
{
  // Одинаковые по структуре тексты на трёх языках должны попасть в одну категорию.
  const ru = "Кот сидел на окне. Он смотрел во двор. Там играли дети. Кот тихо мурлыкал.";
  const kk = "Мысық терезеде отырды. Ол ауланы қарады. Онда балалар ойнады. Мысық тынық жатты.";
  const en = "The cat sat on the sill. It watched the yard. Children played there. The cat purred.";
  const bands = [bandForText(ru, "ru"), bandForText(kk, "kk"), bandForText(en, "en")];
  console.log("    ru/kk/en →", bands.join(" / "));
  eq("три языка дают одну категорию", new Set(bands).size, 1);
}

console.log("\n── длина текста должна двигать категорию ──");
{
  const short = "Мышка бежала. Хвостиком махнула. Яичко упало.";
  const long = Array.from({ length: 40 }, () =>
    "Однажды маленький путешественник отправился через огромную снежную равнину искать потерянный колокольчик."
  ).join(" ");
  const b1 = bandForText(short, "ru");
  const b2 = bandForText(long, "ru");
  console.log(`    короткий → ${b1}, длинный → ${b2}`);
  eq("короткий текст = самая младшая категория", b1, "4-5");
  eq("длинный сложный текст = старшая категория", b2, "10-12");
}

console.log("\n── соответствие возрасту ребёнка ──");
{
  eq("10-летний и книга 4-5 → ниже уровня", fitFor(10, "4-5"), "below");
  eq("7-летний и книга 6-7 → в самый раз", fitFor(7, "6-7"), "match");
  eq("6-летний и книга 10-12 → выше уровня", fitFor(6, "10-12"), "above");
  eq("8-летний и книга 6-7 → в самый раз (соседняя)", fitFor(8, "6-7"), "match");
  eq("категория по возрасту 7", bandForAge(7), "6-7");
  eq("категория по возрасту 11", bandForAge(11), "10-12");
}

console.log("\n── нельзя брать простое подряд ──");
{
  // Десятилетний берёт книгу для 4-5 лет впервые — можно.
  eq("первая лёгкая книга разрешена", pickBlockReason(10, "4-5", undefined), null);
  eq("лёгкая после книги по возрасту разрешена", pickBlockReason(10, "4-5", "match"), null);
  // А вот вторая лёгкая подряд — уже нет.
  eq("вторая лёгкая подряд заблокирована", pickBlockReason(10, "4-5", "below"), "easy_twice_in_a_row");
  // Книга по возрасту доступна всегда, даже после лёгкой.
  eq("книга по возрасту всегда доступна", pickBlockReason(10, "10-12", "below"), null);
  eq("сложная книга всегда доступна", pickBlockReason(7, "10-12", "below"), null);
  // Младшему ребёнку его же книги не блокируются никогда.
  eq("малышу его книги не блокируются", pickBlockReason(5, "4-5", "below"), null);
}

console.log("\n── устойчивость к пустому и мусорному вводу ──");
{
  eq("пустой текст не падает", bandForText("", "ru"), "4-5");
  eq("текст без знаков препинания не падает", typeof bandForText("слово слово слово", "ru"), "string");
}

console.log(`\n${pass} прошло, ${fail} упало\n`);
process.exit(fail ? 1 : 0);
