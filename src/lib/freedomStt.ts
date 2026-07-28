/**
 * freedomStt.ts — клиентская сторона платного распознавания казахского.
 *
 * Вызывается ТОЛЬКО из политики эскалации (sttEscalation.ts), когда бесплатный
 * браузерный движок застрял на казахском тексте. Записывает короткий фрагмент
 * с микрофона и отправляет его серверному прокси, который хранит ключ и следит
 * за бюджетом минут.
 *
 * Подтверждённый контракт (freedom_verify2.sh):
 *   эндпоинт  POST /api/speech-to-text
 *   поле файла   audio (multipart)
 *   поле ответа  text
 *   реальная казахская речь распознаётся
 *
 * Всё, что здесь может пойти не так, заканчивается «вернуть пусто»: платное
 * распознавание — это подстраховка, а не критический путь. Если оно недоступно,
 * ребёнок продолжает читать на бесплатном движке.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "europe-west1");

/** Один раз упавший вызов больше не повторяем в этой сессии. */
let proxyUnavailable = false;

interface TranscribeResponse {
  ok: boolean;
  transcript: string;
  reason?: string;
  budget?: { usedSec: number; limitSec: number };
}

/**
 * Записывает не дольше maxSeconds секунд с уже открытого медиапотока.
 * Поток НЕ создаём здесь: движок чтения уже держит микрофон, второй захват
 * забрал бы его и разорвал распознавание.
 */
export async function recordSegment(
  stream: MediaStream,
  maxSeconds: number,
): Promise<{ base64: string; mimeType: string; durationSec: number } | null> {
  if (typeof MediaRecorder === "undefined") return null;

  // Выбираем формат, который поддерживает браузер.
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
    .find((t) => MediaRecorder.isTypeSupported(t)) || "";
  if (!mimeType) return null;

  return new Promise((resolve) => {
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    const startedAt = Date.now();
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      resolve(null);
      return;
    }

    const stop = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };
    const timer = setTimeout(stop, maxSeconds * 1000);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      clearTimeout(timer);
      const blob = new Blob(chunks, { type: mimeType });
      const durationSec = (Date.now() - startedAt) / 1000;
      const buf = await blob.arrayBuffer();
      // В base64 — так удобно передать через callable; прокси декодирует
      // обратно в байты и отправляет как multipart.
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      resolve({ base64: btoa(binary), mimeType, durationSec });
    };
    recorder.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    recorder.start();
  });
}

/**
 * Отправляет фрагмент серверному прокси и возвращает распознанный текст.
 * Возвращает пустую строку при любой проблеме — вызывающая сторона тогда
 * просто остаётся на бесплатном движке.
 */
export async function transcribeSegment(
  profileId: string,
  segment: { base64: string; mimeType: string; durationSec: number },
): Promise<string> {
  if (proxyUnavailable) return "";
  try {
    const fn = httpsCallable<
      { profileId: string; audioBase64: string; mimeType: string; durationSec: number; language: string },
      TranscribeResponse
    >(functions, "transcribeFallback");

    const res = await fn({
      profileId,
      audioBase64: segment.base64,
      mimeType: segment.mimeType,
      durationSec: segment.durationSec,
      language: "kk",
    });

    if (!res.data.ok) {
      // Бюджет исчерпан или провайдер недоступен — не критично.
      return "";
    }
    return res.data.transcript || "";
  } catch {
    // Функция не задеплоена / нет Blaze / офлайн — переходим на бесплатный путь.
    proxyUnavailable = true;
    return "";
  }
}
