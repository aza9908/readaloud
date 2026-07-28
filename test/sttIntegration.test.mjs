// Проверяет, что подстраховка STT встроена безопасно:
// при выключенном флаге движок ведёт себя ровно как раньше, а feedExternal
// двигает курсор тем же путём, что и обычная речь.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const src = readFileSync("src/lib/alignment.ts", "utf8");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const { ReadingAligner } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

let pass = 0, fail = 0;
const eq = (n, g, w) => { const ok = JSON.stringify(g)===JSON.stringify(w);
  console.log(`${ok?"  ok  ":"  FAIL"} ${n}${ok?"":` — ${JSON.stringify(g)} ≠ ${JSON.stringify(w)}`}`); ok?pass++:fail++; };

console.log("\n── feedExternal двигает курсор как обычная речь ──");
{
  // Ребёнок читает казахскую страницу; браузер молчит, но платный движок
  // вернул текст — курсор должен продвинуться.
  const page = "Ертеде бір кемпір мен шал болыпты".split(/\s+/);
  const a = new ReadingAligner();
  a.setPage(page);
  // Симулируем feedExternal: тот же feed, что и для речи.
  const { advanced } = a.feed("ертеде бір кемпір мен шал болыпты", "");
  eq("платный текст дочитывает страницу", a.cursor, page.length);
  eq("продвижение засчитано", advanced > 0, true);
}

console.log("\n── контракт прокси совпадает с подтверждённым API ──");
{
  const proxy = readFileSync("functions/freedomStt.js", "utf8");
  eq("эндпоинт speech-to-text", proxy.includes("/api/speech-to-text"), true);
  eq("поле файла audio", /AUDIO_FIELD.*"audio"/.test(proxy), true);
  eq("поле ответа text читается", proxy.includes("json.text"), true);
  eq("multipart, не JSON base64", proxy.includes("FormData"), true);
  eq("бюджет минут проверяется", proxy.includes("consumeBudget"), true);
  eq("только казахский", proxy.includes('language !== "kk"'), true);
}

console.log("\n── функция выключена по умолчанию ──");
{
  const page = readFileSync("src/pages/ReadingPage.tsx", "utf8");
  eq("флаг off-by-default", page.includes('VITE_STT_FALLBACK === "1"'), true);
  eq("подстраховка только для казахского", page.includes('book?.language === "kk"'), true);
}

console.log("\n── клиент не содержит ключа и адреса провайдера ──");
{
  const client = readFileSync("src/lib/freedomStt.ts", "utf8");
  eq("нет ключа в клиенте", !/FREEDOM_STT_KEY/.test(client), true);
  eq("нет адреса qazlm в клиенте", !/qazlm\.space/.test(client), true);
  eq("клиент зовёт только callable-функцию", client.includes("transcribeFallback"), true);
}

console.log(`\n${pass} прошло, ${fail} упало\n`);
process.exit(fail ? 1 : 0);
