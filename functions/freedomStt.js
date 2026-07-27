/**
 * freedomStt.js — серверный прокси к Freedom Speech STT.
 *
 * ЗАЧЕМ ПРОКСИ. Ключ Freedom нельзя класть в браузерный бандл: он станет
 * публичным, и любой сможет тратить оплаченные минуты. Поэтому клиент
 * обращается к этой функции, а ключ живёт в секретах Firebase и наружу
 * не выходит.
 *
 * ЗАЧЕМ ПОТОЛОК МИНУТ. При 2,5 ₸/мин один «марафонец» способен съесть всю
 * выручку с аккаунта: расчёт показал 2 498 ₸ затрат при подписке 2 490 ₸,
 * то есть работу в убыток. Поэтому у каждого ребёнка есть месячный лимит
 * минут, который проверяется здесь, на сервере — на клиенте его можно
 * обойти. Исчерпан лимит — просто возвращаем отказ, и приложение
 * продолжает работать на бесплатном браузерном распознавании.
 *
 * ВАЖНО: точный формат запроса к Freedom нужно подтвердить по документации
 * после первого тестового вызова. Ниже помечено, что именно уточнить.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const FREEDOM_STT_KEY = defineSecret("FREEDOM_STT_KEY");

/** Базовый адрес API. Уточнить по документации freedomspeech.kz/docs. */
const FREEDOM_STT_URL =
  process.env.FREEDOM_STT_URL || "https://api.freedomspeech.kz/v1/stt";

/** Месячный лимит минут на одного ребёнка. 60 мин ≈ 150 ₸ — верхняя граница. */
const MONTHLY_MINUTE_BUDGET = 60;

/** Больше этого за один вызов не принимаем: защита от случайной отправки часа звука. */
const MAX_SECONDS_PER_CALL = 30;

const opts = {
  secrets: [FREEDOM_STT_KEY],
  region: "europe-west1",
  cors: true,
  // Ограничиваем параллелизм: платный сервис, всплеск не нужен.
  maxInstances: 10,
};

/** Ключ месяца в формате YYYY-MM — по нему сбрасывается бюджет. */
function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Списывает минуты из месячного бюджета ребёнка.
 * Возвращает false, если бюджет исчерпан — тогда распознавание не делаем.
 */
async function consumeBudget(db, uid, profileId, seconds) {
  const ref = db.doc(`users/${uid}/profiles/${profileId}`);
  const month = currentMonth();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: "no_profile" };

    const data = snap.data() || {};
    // Бюджет обнуляется при смене месяца.
    const used = data.sttMonth === month ? data.sttSecondsUsed || 0 : 0;
    const limit = MONTHLY_MINUTE_BUDGET * 60;

    if (used + seconds > limit) {
      return { ok: false, reason: "budget_exhausted", used, limit };
    }

    tx.update(ref, {
      sttMonth: month,
      sttSecondsUsed: used + seconds,
      sttLastUsedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, used: used + seconds, limit };
  });
}

/**
 * Распознаёт короткий фрагмент казахской речи.
 *
 * Вызывается ТОЛЬКО когда бесплатное браузерное распознавание не справилось:
 * стратегия «платный движок как подстраховка» снижает расход примерно в 35 раз
 * по сравнению с прогоном всего аудио (0,5% выручки против 20%).
 */
export const transcribeFallback = onCall(opts, async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Нужна авторизация");
  }

  const { profileId, audioBase64, mimeType, durationSec, language } = req.data || {};

  if (!profileId || !audioBase64) {
    throw new HttpsError("invalid-argument", "Нужны profileId и audioBase64");
  }
  // Платный движок подключаем только для казахского: русский и английский
  // браузер распознаёт достаточно хорошо и бесплатно.
  if (language !== "kk") {
    throw new HttpsError("invalid-argument", "Платное распознавание только для kk");
  }
  const seconds = Math.min(Number(durationSec) || 0, MAX_SECONDS_PER_CALL);
  if (seconds <= 0) {
    throw new HttpsError("invalid-argument", "Некорректная длительность");
  }

  const db = getFirestore();
  const budget = await consumeBudget(db, req.auth.uid, profileId, seconds);
  if (!budget.ok) {
    // Не ошибка: приложение просто продолжит на бесплатном распознавании.
    return { ok: false, reason: budget.reason, transcript: "" };
  }

  try {
    // ── Формат запроса уточнить по документации ──
    // Ожидаемая форма: multipart или JSON с полем audio в base64.
    // После первого успешного вызова зафиксировать здесь точную схему.
    const res = await fetch(FREEDOM_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FREEDOM_STT_KEY.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio: audioBase64,
        format: mimeType || "audio/webm",
        language: "kk",
      }),
    });

    if (!res.ok) {
      console.error("Freedom STT ответил", res.status, await res.text().catch(() => ""));
      return { ok: false, reason: "provider_error", transcript: "" };
    }

    const json = await res.json();
    // Поле с текстом уточнить по документации: text / transcript / result.
    const transcript = json.text || json.transcript || json.result || "";

    return {
      ok: true,
      transcript,
      budget: { usedSec: budget.used, limitSec: budget.limit },
    };
  } catch (err) {
    console.error("Freedom STT недоступен:", err);
    // Падать нельзя: чтение должно продолжаться на бесплатном движке.
    return { ok: false, reason: "network", transcript: "" };
  }
});
