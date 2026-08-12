// АУДИТ СВЯЗОК: ищем дыры между системами, а не проверяем отдельные функции.
import { readFileSync, existsSync } from "node:fs";
const R = (p) => existsSync(p) ? readFileSync(p, "utf8") : "";
let issues = [];
const bad = (sys, what) => issues.push(`[${sys}] ${what}`);

// ── МАТЕМАТИКА: сквозной путь фото → вердикт → монеты ──
const mathPage = R("src/pages/MathPage.tsx");
const mathFn = R("functions/mathCheck.js");
const mathCli = R("src/lib/mathCheck.ts");

if (!mathFn.includes("consumeCheck")) bad("математика","лимит не списывается");
// Дыра 1: лимит списывается ДО вызова модели. Если модель упала —
// проверка сгорела впустую.
// Лимит списывается до вызова модели — это правильно (иначе двойное нажатие
// обойдёт лимит), но при сбое проверка обязана вернуться обратно.
if (!mathFn.includes("refundCheck")) {
  bad("математика","при сбое модели проверка не возвращается в дневной лимит");
}
// Дыра 2: одну задачу можно решать повторно и получать монеты каждый раз
// Защита живёт в данных (solvedTasks), а не в интерфейсе.
{
  const src = R("src/lib/firestore.ts");
  const fnStart = src.indexOf("export async function awardMathCoins");
  const fn = fnStart >= 0 ? src.slice(fnStart, fnStart + 1400) : "";
  if (!fn) bad("математика","функция начисления не найдена");
  else {
    if (!fn.includes("runTransaction")) bad("математика","начисление вне транзакции");
    if (!/solvedTasks/.test(fn)) bad("математика","нет сверки с решёнными задачами");
  }
}
// Дыра 3: доверяем ли мы вердикту без человека
if (mathPage.includes("awardMathCoins") && !mathPage.includes("v.handwritten")) {
  bad("математика","поле handwritten от модели игнорируется — печатный текст пройдёт как решение");
}

// ── ЧТЕНИЕ: начисление и рейтинг ──
const fs_ = R("src/lib/firestore.ts");
if (!fs_.includes("pagesAwarded")) bad("чтение","нет защиты от повторной оплаты страниц");
// Дыра: рейтинг обновляется только при чтении, но не при математике/матчах
const pubs = (fs_.match(/publishToLeaderboard\(/g) || []).length;
if (pubs < 2) bad("рейтинг","публикуется только из одного места — монеты за математику и матчи в рейтинг не попадут");

// ── МАТЧИ ──
const arena = R("src/pages/ArenaPage.tsx");
if (!fs_.includes("runTransaction") || !fs_.includes("findOrCreateMatch")) bad("матчи","подбор без транзакции");
// Дыра: матч может остаться в очереди навсегда, если игрок ушёл
if (!fs_.includes("createdAt") || !arena.includes("status === \"waiting\"")) {
  bad("матчи","нет очистки зависших матчей в очереди");
}
// Дыра: награда за матч выдаётся на клиенте — можно накрутить
{
  // Проверяем не наличие слова, а что функция начисления ДЕЙСТВИТЕЛЬНО
  // сверяется с реестром оплаченных матчей внутри транзакции.
  const src = R("src/lib/firestore.ts");
  const fnStart = src.indexOf("export async function awardMatchCoins");
  const fn = fnStart >= 0 ? src.slice(fnStart, fnStart + 1400) : "";
  if (!fn) bad("матчи","функция начисления награды за матч не найдена");
  else {
    if (!fn.includes("runTransaction")) bad("матчи","награда за матч вне транзакции");
    if (!/paidMatches/.test(fn)) bad("матчи","награда за матч не сверяется с реестром оплаченных");
    if (!/return \{ awarded: 0 \}/.test(fn)) bad("матчи","повторное начисление не отсекается");
  }
}

// ── PIN ──
const gate = R("src/components/ParentGate.tsx");
if (!gate.includes("hashPin")) bad("PIN","код хранится не хешем");
if (!R("src/pages/DashboardPage.tsx").includes("isUnlockFresh")) bad("PIN","дашборд не проверяет срок разрешения");

// ── ОБЩЕЕ ──

console.log("═".repeat(66));
console.log("  АУДИТ СВЯЗОК МЕЖДУ СИСТЕМАМИ");
console.log("═".repeat(66));
if (issues.length === 0) console.log("  дыр не найдено");
else issues.forEach(i => console.log("  ✗ " + i));
console.log();
console.log("Найдено проблем:", issues.length);
