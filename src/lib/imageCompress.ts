/**
 * imageCompress.ts — сжатие картинки-награды в браузере.
 *
 * Родитель фотографирует настоящую награду (мяч, форму). Хранить это в
 * Firebase Storage — значит подключать платный план и настраивать правила.
 * Вместо этого ужимаем картинку до маленького квадрата и кодируем в data URL,
 * который кладётся прямо в документ награды в Firestore. Ужатая картинка
 * весит ~10–25 КБ — это в пределах лимита документа и работает без Storage.
 */

const MAX_SIDE = 320; // достаточно для карточки награды
const QUALITY = 0.72;

export async function compressImage(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  // Обрезаем в квадрат по центру и уменьшаем.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = MAX_SIDE;
  canvas.height = MAX_SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, MAX_SIDE, MAX_SIDE);

  // JPEG почти всегда компактнее PNG для фото.
  return canvas.toDataURL("image/jpeg", QUALITY);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("read-failed"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image-failed"));
    img.src = src;
  });
}

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";
