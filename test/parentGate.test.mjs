// Замок родительского дашборда: код из 4 цифр, блокировка при переборе.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const src = readFileSync("src/lib/parentGate.ts", "utf8");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const m = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const { isValidPin, initialGateState, registerFailure, registerSuccess, isLockedOut,
        attemptsLeft, MAX_ATTEMPTS, LOCKOUT_MS, isUnlockFresh, UNLOCK_TTL_MS, hashPin } = m;

let pass=0, fail=0;
const eq=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);
  console.log(`${ok?"  ok  ":"  FAIL"} ${n}${ok?"":` — ${JSON.stringify(g)} ≠ ${JSON.stringify(w)}`}`);ok?pass++:fail++;};

console.log("\n── код только из 4 цифр ──");
eq("1234 подходит", isValidPin("1234"), true);
eq("0000 подходит", isValidPin("0000"), true);
eq("три цифры — нет", isValidPin("123"), false);
eq("пять цифр — нет", isValidPin("12345"), false);
eq("буквы — нет", isValidPin("12a4"), false);
eq("пусто — нет", isValidPin(""), false);

console.log("\n── защита от подбора ──");
{
  let s = initialGateState();
  const now = 1_000_000;
  eq("сначала не заблокирован", isLockedOut(s, now), false);
  eq("попыток в запасе", attemptsLeft(s), MAX_ATTEMPTS);

  for (let i = 1; i < MAX_ATTEMPTS; i++) s = registerFailure(s, now);
  eq("до предела ещё пускает", isLockedOut(s, now), false);

  s = registerFailure(s, now);
  eq("после предела блокирует", isLockedOut(s, now), true);
  eq("блокировка снимается со временем", isLockedOut(s, now + LOCKOUT_MS + 1), false);

  // Верный ввод обнуляет счётчик — родитель, ошибшийся пару раз, не наказан.
  eq("успех сбрасывает счётчик", attemptsLeft(registerSuccess()), MAX_ATTEMPTS);
}

console.log("\n── разрешение живёт ограниченное время ──");
{
  const t = 5_000_000;
  eq("сразу после ввода действует", isUnlockFresh(t, t + 1000), true);
  eq("через 5 минут ещё действует", isUnlockFresh(t, t + 5*60_000), true);
  eq("после срока — нет", isUnlockFresh(t, t + UNLOCK_TTL_MS + 1), false);
  eq("без ввода — нет", isUnlockFresh(null, t), false);
}

console.log("\n── код не хранится открытым текстом ──");
{
  if (globalThis.crypto?.subtle) {
    const h1 = await hashPin("1234", "acc-a");
    const h2 = await hashPin("1234", "acc-b");
    const h3 = await hashPin("1234", "acc-a");
    eq("хеш не содержит сам код", h1.includes("1234"), false);
    eq("одинаковый код в разных семьях даёт разные хеши", h1 === h2, false);
    eq("тот же код и та же семья — тот же хеш", h1, h3);
    eq("хеш нормальной длины", h1.length, 64);
  } else {
    console.log("  (crypto.subtle недоступен в этой среде — пропущено)");
  }
}

console.log(`\n${pass} прошло, ${fail} упало\n`);
process.exit(fail?1:0);
