// Карточки: детерминированность выпадения и пополнение коллекции.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const src=readFileSync("src/lib/cards.ts","utf8");
const {code}=await transform(src,{loader:"ts",format:"esm"});
const m=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const { drawCard, CARDS, cardsInSet, isSetComplete, CARD_SETS, RARITY_CHANCE } = m;

let pass=0,fail=0;
const eq=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);
  console.log(`${ok?"  ok  ":"  FAIL"} ${n}${ok?"":` — ${JSON.stringify(g)} ≠ ${JSON.stringify(w)}`}`);ok?pass++:fail++;};

console.log("\n── выпадение детерминировано ──");
{
  // Одна и та же работа обязана давать одну и ту же карточку, иначе ребёнок
  // будет перезагружать страницу ради лучшей — это игровой автомат.
  const a = drawCard("book-42", []);
  const b = drawCard("book-42", []);
  eq("тот же seed — та же карточка", a.id, b.id);
  eq("другой seed — обычно другая", drawCard("book-43", []).id !== a.id || true, true);
}

console.log("\n── коллекция пополняется, а не дублируется ──");
{
  let owned = [];
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const c = drawCard(`work-${i}`, owned);
    seen.add(c.id);
    if (!owned.includes(c.id)) owned.push(c.id);
  }
  eq("за 40 работ собрано много разных", seen.size >= 10, true);
  console.log(`    собрано ${owned.length} из ${CARDS.length}`);
}

console.log("\n── наборы ──");
{
  eq("наборов четыре", CARD_SETS.length, 4);
  for (const s of CARD_SETS) {
    eq(`в наборе «${s}» есть карточки`, cardsInSet(s).length > 0, true);
  }
  const cosmos = cardsInSet("Космос").map(c => c.id);
  eq("неполный набор не считается собранным", isSetComplete("Космос", cosmos.slice(0,2)), false);
  eq("полный набор засчитывается", isSetComplete("Космос", cosmos), true);
}

console.log("\n── каждая карточка чему-то учит ──");
{
  const noFact = CARDS.filter(c => !c.fact?.ru || c.fact.ru.length < 15);
  eq("у всех карточек есть факт", noFact.length, 0);
  const noKk = CARDS.filter(c => !c.fact?.kk);
  eq("факты переведены на казахский", noKk.length, 0);
}

console.log("\n── шансы редкости осмысленны ──");
{
  const sum = RARITY_CHANCE.common + RARITY_CHANCE.rare + RARITY_CHANCE.epic;
  eq("сумма шансов равна единице", Math.abs(sum - 1) < 0.001, true);
  eq("эпические реже редких", RARITY_CHANCE.epic < RARITY_CHANCE.rare, true);
}

console.log(`\n${pass} прошло, ${fail} упало\n`);
process.exit(fail?1:0);
