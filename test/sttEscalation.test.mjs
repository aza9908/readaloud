// Проверяет ограничители расхода платного распознавания.
// Каждый пропущенный ограничитель = реальные деньги, поэтому тесты строгие.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const src = readFileSync("src/lib/sttEscalation.ts", "utf8")
  .replace(/import type \{[^}]*\} from "[^"]*";/g, "");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const m = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const {
  shouldEscalate, recordEscalation, resetForNewBook, disableEscalation,
  initialEscalationState, STALL_THRESHOLD, MIN_INTERVAL_MS,
  MAX_ESCALATIONS_PER_BOOK, estimateSessionCost,
} = m;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : ` — получили ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

const base = {
  language: "kk", consecutiveMisses: STALL_THRESHOLD,
  cursorAdvancedRecently: false, now: 1_000_000,
  state: initialEscalationState(), featureEnabled: true,
};
const D = (o) => shouldEscalate({ ...base, ...o });

console.log("\n── ограничитель 1: только казахский ──");
{
  eq("русский не эскалирует", D({ language: "ru" }).reason, "language");
  eq("английский не эскалирует", D({ language: "en" }).reason, "language");
  eq("казахский при сбое эскалирует", D({}).escalate, true);
}

console.log("\n── ограничитель 2: только при настоящем сбое ──");
{
  eq("курсор движется — не платим", D({ cursorAdvancedRecently: true }).reason, "no_stall");
  eq("мало промахов — не платим", D({ consecutiveMisses: STALL_THRESHOLD - 1 }).reason, "no_stall");
  eq("порог выше встроенного восстановления", STALL_THRESHOLD > 3, true);
}

console.log("\n── ограничитель 3: частота ──");
{
  const used = recordEscalation(initialEscalationState(), 1_000_000);
  eq("сразу после обращения — рано", D({ state: used, now: 1_000_000 + 1000 }).reason, "too_soon");
  eq("после интервала — можно",
     D({ state: used, now: 1_000_000 + MIN_INTERVAL_MS + 1 }).escalate, true);
}

console.log("\n── ограничитель 4: лимит на книгу ──");
{
  let st = initialEscalationState();
  let t = 1_000_000;
  for (let i = 0; i < MAX_ESCALATIONS_PER_BOOK; i++) {
    t += MIN_INTERVAL_MS + 1;
    eq(`обращение ${i + 1} разрешено`, D({ state: st, now: t }).escalate, true);
    st = recordEscalation(st, t);
  }
  t += MIN_INTERVAL_MS + 1;
  eq("сверх лимита — отказ", D({ state: st, now: t }).reason, "book_limit");
  eq("на новой книге счётчик сбрасывается",
     D({ state: resetForNewBook(st), now: t }).escalate, true);
}

console.log("\n── аварийное отключение ──");
{
  const off = disableEscalation(initialEscalationState());
  eq("после исчерпания бюджета не обращаемся", D({ state: off }).reason, "disabled");
  eq("выключенная функция не обращается", D({ featureEnabled: false }).reason, "disabled");
}

console.log("\n── стоимость: худший случай за книгу ──");
{
  const worst = estimateSessionCost(MAX_ESCALATIONS_PER_BOOK);
  console.log(`    максимум за одну книгу: ${worst.toFixed(2)} ₸`);
  eq("одна книга не может стоить дороже 3 ₸", worst < 3, true);

  // Худший месяц: 30 книг подряд, и на каждой движок упирается в лимит.
  const monthly = worst * 30;
  const perAccount = monthly * 1.8;      // среднее число детей на аккаунт
  const share = perAccount / 2490 * 100; // доля от подписки
  console.log(`    худший месяц: ${monthly.toFixed(0)} ₸ на ребёнка, ` +
              `${perAccount.toFixed(0)} ₸ на аккаунт = ${share.toFixed(1)}% выручки`);
  // Значимый порог — не абсолютное число, а доля выручки: даже при полном
  // упоре в лимиты платное распознавание не должно ломать экономику.
  eq("даже худший случай остаётся под 5% выручки", share < 5, true);
}

console.log("\n── стратегия по умолчанию безопасна ──");
{
  // При включённой функции, но нормальном чтении обращений быть не должно.
  let escalations = 0;
  let st = initialEscalationState();
  for (let t = 0; t < 100; t++) {
    const d = shouldEscalate({
      ...base, now: 1_000_000 + t * 1000,
      consecutiveMisses: t % 5, cursorAdvancedRecently: t % 3 !== 0, state: st,
    });
    if (d.escalate) { escalations++; st = recordEscalation(st, 1_000_000 + t * 1000); }
  }
  console.log(`    нормальное чтение (100 тактов): ${escalations} обращений`);
  eq("при нормальном чтении не платим", escalations, 0);
}

console.log(`\n${pass} прошло, ${fail} упало\n`);
process.exit(fail ? 1 : 0);
