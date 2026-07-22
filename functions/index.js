/**
 * ReadAloud AI endpoints (Firebase Cloud Functions v2).
 *
 * Three callable functions, all authenticated (works with anonymous users too):
 *   generateQuiz    — comprehension questions after finishing a book
 *   evaluateRetell  — grades a child's spoken retelling of a chunk
 *   recommendBook   — picks a book based on age, taste, level, history
 *
 * Requires the ANTHROPIC_API_KEY secret:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 *
 * NOTE: Cloud Functions require the Blaze (pay-as-you-go) plan. The client
 * degrades gracefully to offline heuristics if these aren't deployed, so the
 * app keeps working either way.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-4-6";

const opts = { secrets: [ANTHROPIC_API_KEY], region: "europe-west1", cors: true };

async function askClaude(system, user, maxTokens = 1200) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY.value(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    throw new HttpsError("internal", `Anthropic API ${res.status}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text.replace(/```json|```/g, "").trim();
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/[[{][\s\S]*[\]}]/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* noop */ } }
    return fallback;
  }
}

const LANG_NAME = { ru: "русском", kk: "казахском", en: "английском" };

/** Comprehension quiz after finishing a book. */
export const generateQuiz = onCall(opts, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const { title, text, language = "ru", age = 8 } = req.data ?? {};
  if (!text || typeof text !== "string") throw new HttpsError("invalid-argument", "text required");

  const system =
    `Ты — добрый детский педагог. Составляешь вопросы на понимание прочитанного ` +
    `для ребёнка ${age} лет. Вопросы должны быть на ${LANG_NAME[language] ?? "русском"} языке, ` +
    `простые, конкретные, по тексту. Никакой критики, только доброжелательный тон. ` +
    `Отвечай ТОЛЬКО валидным JSON, без пояснений и markdown.`;

  const user =
    `Книга: «${title}»\n\nТекст:\n${text.slice(0, 6000)}\n\n` +
    `Составь 4 вопроса с выбором ответа. Формат:\n` +
    `{"questions":[{"q":"вопрос","options":["A","B","C"],"correct":0,"why":"короткое доброе объяснение"}]}`;

  const raw = await askClaude(system, user, 1500);
  const parsed = parseJson(raw, { questions: [] });
  return { questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 4) : [] };
});

/** Evaluates a spoken retelling (пересказ) of a chunk. */
export const evaluateRetell = onCall(opts, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const { chunkText, retelling, language = "ru", age = 8 } = req.data ?? {};
  if (!chunkText || !retelling) throw new HttpsError("invalid-argument", "chunkText and retelling required");

  const system =
    `Ты — тёплый, поддерживающий детский учитель чтения. Ребёнку ${age} лет. ` +
    `Он пересказал отрывок своими словами (текст получен распознаванием речи, ` +
    `поэтому возможны ошибки распознавания — не придирайся к ним). ` +
    `Всегда начинай с похвалы. Отвечай на ${LANG_NAME[language] ?? "русском"} языке. ` +
    `Отвечай ТОЛЬКО валидным JSON.`;

  const user =
    `Отрывок:\n${chunkText.slice(0, 3000)}\n\nПересказ ребёнка:\n"${retelling.slice(0, 1500)}"\n\n` +
    `Оцени пересказ. Формат:\n` +
    `{"score":0-100,"praise":"что получилось хорошо (1-2 предложения)",` +
    `"missed":["что забыл упомянуть"],"tip":"один добрый совет"}`;

  const raw = await askClaude(system, user, 800);
  return parseJson(raw, { score: 70, praise: "Молодец, ты пересказал главное!", missed: [], tip: "" });
});

/** Recommends a book from the library based on the child's profile & taste. */
export const recommendBook = onCall(opts, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const { books = [], age = 8, language = "ru", preferences = "", history = [] } = req.data ?? {};
  if (!Array.isArray(books) || books.length === 0) {
    throw new HttpsError("invalid-argument", "books required");
  }

  const system =
    `Ты — детский библиотекарь. Подбираешь книгу ребёнку ${age} лет. ` +
    `Отвечай на ${LANG_NAME[language] ?? "русском"} языке, тепло и коротко. ` +
    `Отвечай ТОЛЬКО валидным JSON.`;

  const list = books
    .map((b) => `- id:${b.id} | «${b.title}» | ${b.language} | ${b.totalWords} слов | ${b.difficulty}`)
    .join("\n");

  const user =
    `Доступные книги:\n${list}\n\n` +
    `Возраст: ${age}. Что нравится ребёнку: ${preferences || "не указано"}.\n` +
    `Уже прочитал: ${history.length ? history.join(", ") : "ничего"}.\n\n` +
    `Выбери 3 книги по убыванию подходящести. Формат:\n` +
    `{"picks":[{"id":"...","reason":"почему подойдёт (1 предложение, обращайся к ребёнку на ты)"}]}`;

  const raw = await askClaude(system, user, 700);
  const parsed = parseJson(raw, { picks: [] });
  return { picks: Array.isArray(parsed.picks) ? parsed.picks.slice(0, 3) : [] };
});
