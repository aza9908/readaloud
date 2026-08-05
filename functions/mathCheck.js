/**
 * mathCheck.js — проверка решения по математике моделью Claude.
 *
 * СТОИМОСТЬ И ЕЁ ОГРАНИЧЕНИЕ. Один вызов с картинкой стоит примерно $0.006
 * (~3 ₸). Без ограничения ребёнок может фотографировать одну задачу
 * бесконечно — это единственный способ реально сжечь бюджет. Поэтому лимит
 * в шесть проверок в сутки проверяется ЗДЕСЬ, на сервере: на клиенте его
 * обошли бы за минуту. При таком лимите потолок расходов известен заранее:
 * максимум ~$1.1 на ребёнка в месяц.
 *
 * ПОЧЕМУ МОДЕЛЬ, А НЕ СВЕРКА ОТВЕТА. Правильный ответ известен генератору, и
 * сверить его можно бесплатно. Модель нужна для другого: увидеть, есть ли на
 * фотографии ХОД решения, а не только итог. Именно ход отличает решившего от
 * списавшего, и именно его человек проверяет глазами дольше всего.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

/** Проверок в сутки на одного ребёнка. */
const DAILY_LIMIT = 6;

/** Модель: Haiku дешевле втрое и для сверки школьной работы её достаточно. */
const MODEL = "claude-haiku-4-5-20251001";

const opts = {
  secrets: [ANTHROPIC_API_KEY],
  region: "europe-west1",
  cors: true,
  maxInstances: 10,
};

function localDay() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Списывает одну проверку из дневного лимита. Транзакция — иначе двойное нажатие обойдёт лимит. */
async function consumeCheck(db, uid, profileId) {
  const ref = db.doc(`users/${uid}/profiles/${profileId}`);
  const day = localDay();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: "no_profile" };
    const d = snap.data() || {};
    const used = d.mathChecksDay === day ? d.mathChecksUsed || 0 : 0;
    if (used >= DAILY_LIMIT) {
      return { ok: false, reason: "daily_limit", used, limit: DAILY_LIMIT };
    }
    tx.update(ref, {
      mathChecksDay: day,
      mathChecksUsed: used + 1,
      mathLastCheckAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, used: used + 1, limit: DAILY_LIMIT };
  });
}

export const checkMathSolution = onCall(opts, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Нужна авторизация");

  const { profileId, photoBase64, mimeType, taskText, correctAnswer, difficulty } = req.data || {};
  if (!profileId || !photoBase64 || !taskText) {
    throw new HttpsError("invalid-argument", "Нужны profileId, фото и условие задачи");
  }

  const db = getFirestore();
  const quota = await consumeCheck(db, req.auth.uid, profileId);
  if (!quota.ok) {
    return {
      ok: false,
      reason: quota.reason,
      used: quota.used ?? DAILY_LIMIT,
      limit: DAILY_LIMIT,
      verdict: null,
    };
  }

  // Модель отвечает СТРОГО в JSON — иначе разбор ответа превращается в
  // угадывание по тексту, а нам нужно принять решение о начислении монет.
  const system = `Ты проверяешь работу школьника 1–4 класса по математике.
Тебе дают условие задачи, правильный ответ и фотографию тетради.

Оцени по фотографии:
1. Виден ли ход решения (вычисления, рассуждения), а не только итоговый ответ.
2. Совпадает ли полученный ребёнком ответ с правильным.
3. Похоже ли это на рукописную работу в тетради.

Отвечай ТОЛЬКО валидным JSON без markdown и пояснений:
{"correct": true|false, "hasWorking": true|false, "handwritten": true|false,
 "score": 0..100, "feedback": "одно доброе предложение для ребёнка на русском",
 "mistake": "если есть ошибка — где именно, одним предложением, иначе пустая строка"}

Будь доброжелателен: это ребёнок. Если решение верное, но написано неаккуратно —
это всё равно верное решение. Если ответ верный, но хода решения не видно,
поставь hasWorking: false и мягко попроси показать, как считал.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY.value(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: photoBase64 } },
            { type: "text", text: `Задача: ${taskText}\nПравильный ответ: ${correctAnswer}\nУровень: ${difficulty || "A"}` },
          ],
        }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic error", res.status, (await res.text()).slice(0, 300));
      return { ok: false, reason: "provider_error", verdict: null, used: quota.used, limit: DAILY_LIMIT };
    }

    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let verdict;
    try {
      verdict = JSON.parse(clean);
    } catch {
      // Модель ответила не JSON — не наказываем ребёнка, отдаём родителю.
      console.error("Не удалось разобрать ответ модели:", clean.slice(0, 200));
      return { ok: false, reason: "unparsable", verdict: null, used: quota.used, limit: DAILY_LIMIT };
    }

    return { ok: true, verdict, used: quota.used, limit: DAILY_LIMIT };
  } catch (err) {
    console.error("Проверка не удалась:", err);
    return { ok: false, reason: "network", verdict: null, used: quota.used, limit: DAILY_LIMIT };
  }
});
