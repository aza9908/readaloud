/**
 * photoInspect.ts — извлекает признаки из файла для проверки подлинности.
 *
 * Всё считается в браузере: фото не уходит на сервер ради проверки, а значит
 * работает офлайн и не стоит денег. Анализ идёт по уменьшенной копии — на
 * полном снимке 12 Мп это заняло бы секунды и подвесило интерфейс.
 */

import { assessPhoto, matchesKnownScreenSize, type AuthenticityResult } from "./photoAuthenticity";

/**
 * Ищет в JPEG маркер EXIF с данными камеры.
 *
 * Скриншоты сохраняются без него. Смотрим на сигнатуру Exif и присутствие
 * тега модели камеры — этого достаточно, чтобы отличить снимок от скриншота,
 * и не требует тяжёлой библиотеки разбора EXIF.
 */
async function hasCameraExif(file: File): Promise<boolean> {
  // Читаем только начало файла: EXIF всегда в первых килобайтах.
  const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const text = new TextDecoder("latin1").decode(head);
  if (!text.includes("Exif")) return false;
  // Признаки настоящей съёмки: модель устройства или параметры экспозиции.
  return /Make|Model|ExposureTime|FNumber|ISOSpeed|Apple|samsung|Xiaomi/i.test(text);
}

/** Считает долю белого и ровность фона по уменьшенной копии. */
async function analysePixels(file: File): Promise<{
  whiteRatio: number; backgroundUniformity: number; width: number; height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const W = 160;
  const H = Math.max(1, Math.round((bitmap.height / bitmap.width) * W));
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return { whiteRatio: 0, backgroundUniformity: 0, width: bitmap.width, height: bitmap.height };
  }
  ctx.drawImage(bitmap, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  let white = 0;
  const lum: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lum.push(l);
    if (l > 244) white++;
  }
  const whiteRatio = white / lum.length;

  // Ровность фона: у фотографии бумаги яркость плавает от освещения и шума,
  // у скриншота она почти постоянная. Меряем через разброс яркости.
  const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
  const variance = lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length;
  const sd = Math.sqrt(variance);
  // sd около 0 → идеально ровно (1); sd больше 60 → живой шум (0).
  const backgroundUniformity = Math.max(0, Math.min(1, 1 - sd / 60));

  const out = { whiteRatio, backgroundUniformity, width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return out;
}

/** Полная проверка файла перед отправкой работы. */
export async function inspectPhoto(file: File): Promise<AuthenticityResult> {
  try {
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
    const [hasExifCamera, px] = await Promise.all([
      hasCameraExif(file),
      analysePixels(file),
    ]);
    return assessPhoto({
      hasExifCamera,
      matchesScreenSize: matchesKnownScreenSize(px.width, px.height),
      whiteRatio: px.whiteRatio,
      backgroundUniformity: px.backgroundUniformity,
      isPng,
      width: px.width,
      height: px.height,
    });
  } catch {
    // Не смогли проанализировать — не наказываем ребёнка, отдаём на проверку
    // родителю. Ошибка анализа не должна означать обвинение.
    return { verdict: "suspicious", score: 0, reasons: ["не удалось проверить снимок"] };
  }
}
