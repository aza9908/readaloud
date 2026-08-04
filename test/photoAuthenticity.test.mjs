// Проверка распознавания скриншотов. Ключевое требование: честное фото
// ребёнка не должно отвергаться, даже если снято при плохом свете.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const src = readFileSync("src/lib/photoAuthenticity.ts", "utf8");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const { assessPhoto, matchesKnownScreenSize } =
  await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

let pass=0, fail=0;
const eq=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);
  console.log(`${ok?"  ok  ":"  FAIL"} ${n}${ok?"":` — ${JSON.stringify(g)} ≠ ${JSON.stringify(w)}`}`);ok?pass++:fail++;};

// Честное фото тетради: есть камера, JPEG, шумный фон, нестандартный размер.
const realPhoto = { hasExifCamera:true, matchesScreenSize:false, whiteRatio:0.55,
  backgroundUniformity:0.45, isPng:false, width:3024, height:4032 };

// Скриншот с телефона: нет камеры, PNG, точный размер экрана, белый фон.
const screenshot = { hasExifCamera:false, matchesScreenSize:true, whiteRatio:0.9,
  backgroundUniformity:0.97, isPng:true, width:1170, height:2532 };

console.log("\n── честное фото проходит ──");
eq("обычное фото тетради принято", assessPhoto(realPhoto).verdict, "ok");
{
  // Плохой свет, пересвет — но это всё ещё настоящая фотография.
  const dim = { ...realPhoto, whiteRatio:0.7, backgroundUniformity:0.6 };
  eq("тёмное/пересвеченное фото не отвергается", assessPhoto(dim).verdict !== "rejected", true);
}

console.log("\n── скриншот ловится ──");
{
  const r = assessPhoto(screenshot);
  eq("скриншот отвергнут", r.verdict, "rejected");
  eq("причина названа", r.reasons.length > 0, true);
}

console.log("\n── скриншот с обрезкой (размер уже не эталонный) ──");
{
  const cropped = { ...screenshot, matchesScreenSize:false, width:1100, height:2000 };
  const r = assessPhoto(cropped);
  // Даже без совпадения размера остаются PNG + нет камеры + белый фон.
  eq("обрезанный скриншот всё ещё подозрителен", r.verdict !== "ok", true);
}

console.log("\n── фото экрана монитора ──");
{
  // Снято камерой, но фон подозрительно ровный и белый.
  const screenPhoto = { hasExifCamera:true, matchesScreenSize:false, whiteRatio:0.88,
    backgroundUniformity:0.94, isPng:false, width:3024, height:4032 };
  eq("фото экрана помечено подозрительным", assessPhoto(screenPhoto).verdict !== "ok", true);
}

console.log("\n── распознавание размеров экранов ──");
eq("iPhone", matchesKnownScreenSize(1170, 2532), true);
eq("тот же экран в альбомной ориентации", matchesKnownScreenSize(2532, 1170), true);
eq("Full HD монитор", matchesKnownScreenSize(1920, 1080), true);
eq("случайный размер камеры", matchesKnownScreenSize(3024, 4032), false);

console.log(`\n${pass} прошло, ${fail} упало\n`);
process.exit(fail?1:0);
