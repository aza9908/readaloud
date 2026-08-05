/**
 * mathCheck.ts — клиентский вызов проверки решения моделью.
 *
 * Ключ и лимит живут на сервере: на клиенте любой лимит обходится за минуту,
 * а ключ в бандле — это чужие деньги. Здесь только отправка и разбор ответа.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "europe-west1");

export interface MathVerdict {
  correct: boolean;
  hasWorking: boolean;
  handwritten: boolean;
  score: number;
  feedback: string;
  mistake: string;
}

export interface CheckResponse {
  ok: boolean;
  reason?: "daily_limit" | "provider_error" | "network" | "unparsable" | "no_profile";
  verdict: MathVerdict | null;
  used: number;
  limit: number;
}

/** Отправляет фото решения на проверку. Ошибки не бросает — их показывает интерфейс. */
export async function checkSolution(args: {
  profileId: string;
  photoDataUrl: string;
  taskText: string;
  correctAnswer: string;
  difficulty: string;
}): Promise<CheckResponse> {
  // data URL → чистый base64: сервер ждёт только данные, без префикса.
  const comma = args.photoDataUrl.indexOf(",");
  const base64 = comma >= 0 ? args.photoDataUrl.slice(comma + 1) : args.photoDataUrl;
  const mimeMatch = /^data:([^;]+);/.exec(args.photoDataUrl);

  try {
    const fn = httpsCallable<Record<string, unknown>, CheckResponse>(functions, "checkMathSolution");
    const res = await fn({
      profileId: args.profileId,
      photoBase64: base64,
      mimeType: mimeMatch?.[1] ?? "image/jpeg",
      taskText: args.taskText,
      correctAnswer: args.correctAnswer,
      difficulty: args.difficulty,
    });
    return res.data;
  } catch {
    return { ok: false, reason: "network", verdict: null, used: 0, limit: 6 };
  }
}

export const CHECK_ERROR_MESSAGE: Record<string, string> = {
  daily_limit: "На сегодня проверки закончились. Приходи завтра — будут новые задачи!",
  provider_error: "Проверка сейчас недоступна. Работа сохранена — родители посмотрят её сами.",
  network: "Нет связи. Работа сохранена — родители посмотрят её сами.",
  unparsable: "Не удалось разобрать решение. Родители проверят работу сами.",
  no_profile: "Профиль не найден.",
};
