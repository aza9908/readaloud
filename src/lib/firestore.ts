/**
 * firestore.ts — data layer. Replaces the old Express API entirely.
 *
 * Old route            → new function
 * GET  /api/profiles   → getProfiles / watchProfiles
 * POST /api/profiles   → createProfile
 * GET  /api/books      → getBooks (system + own custom, per language)
 * GET  /api/books/:id  → getBook (pages are embedded — one read)
 * POST /api/sessions   → startSession
 * PUT  /api/sessions   → saveSessionProgress / completeSession
 * GET  …/sessions      → getSessions
 * GET  …/achievements  → getAchievements
 * POST /api/custom-books    → createCustomBook (auto-pagination client-side)
 * DELETE /api/custom-books  → deleteCustomBook
 */

import {
  runTransaction,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  EMPTY_BY_LANGUAGE,
  type Achievement,
  type Book,
  type ChildProfile,
  type Language,
  type ParentReward,
  type RewardRequest,
  type RewardRequestStatus,
  type ReadingSession,
} from "./types";

// ───────────────────────── Profiles ─────────────────────────

const profilesCol = (uid: string) => collection(db, "users", uid, "profiles");

export function watchProfiles(
  uid: string,
  cb: (profiles: ChildProfile[]) => void,
): () => void {
  return onSnapshot(profilesCol(uid), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ChildProfile, "id">) }))
        .sort((a, b) => a.createdAt - b.createdAt),
    );
  });
}

export async function createProfile(
  uid: string,
  data: { name: string; age: number; avatar: string; defaultLanguage: Language },
): Promise<string> {
  // Keep the parent doc present (useful for future admin/exports).
  await setDoc(
    doc(db, "users", uid),
    { updatedAt: serverTimestamp() },
    { merge: true },
  );
  const ref = await addDoc(profilesCol(uid), {
    ...data,
    createdAt: Date.now(),
    totalWords: 0,
    totalMs: 0,
    booksCompleted: 0,
    coins: 0,
    unlockedAvatars: [],
    byLanguage: EMPTY_BY_LANGUAGE,
  });
  return ref.id;
}

export async function getProfile(
  uid: string,
  profileId: string,
): Promise<ChildProfile | null> {
  const snap = await getDoc(doc(db, "users", uid, "profiles", profileId));
  return snap.exists()
    ? ({ id: snap.id, ...(snap.data() as Omit<ChildProfile, "id">) })
    : null;
}

// ───────────────────────── Books ─────────────────────────

export async function getBooks(uid: string, language: Language): Promise<Book[]> {
  const col = collection(db, "books");
  const [systemSnap, ownSnap] = await Promise.all([
    getDocs(query(col, where("ownerId", "==", null), where("language", "==", language))),
    getDocs(query(col, where("ownerId", "==", uid), where("language", "==", language))),
  ]);
  const toBook = (d: (typeof systemSnap.docs)[number]): Book => ({
    id: d.id,
    ...(d.data() as Omit<Book, "id">),
  });
  return [...systemSnap.docs.map(toBook), ...ownSnap.docs.map(toBook)].sort(
    (a, b) => a.title.localeCompare(b.title),
  );
}

export async function getBook(bookId: string): Promise<Book | null> {
  const snap = await getDoc(doc(db, "books", bookId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Book, "id">) }) : null;
}

// ───────────────── Custom books (upload feature) ─────────────────

const TARGET_WORDS_PER_PAGE = 45;
const MAX_WORDS_PER_PAGE = 65;
export const MIN_TOTAL_WORDS = 20;
export const MAX_TOTAL_WORDS = 5000;

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitLongParagraph(paragraph: string): string[] {
  const sentences =
    paragraph.match(/[^.!?…]+[.!?…]+["»']?\s*|[^.!?…]+$/g) ?? [paragraph];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (countWords(current) + countWords(s) > MAX_WORDS_PER_PAGE && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function paginateText(raw: string): string[] {
  const paragraphs = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((p) => (countWords(p) > MAX_WORDS_PER_PAGE ? splitLongParagraph(p) : [p]));

  const pages: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  for (const p of paragraphs) {
    const w = countWords(p);
    if (currentWords > 0 && currentWords + w > TARGET_WORDS_PER_PAGE) {
      pages.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
    current.push(p);
    currentWords += w;
  }
  if (current.length) pages.push(current.join("\n\n"));
  return pages;
}

export async function createCustomBook(
  uid: string,
  data: { title: string; language: Language; text: string; coverEmoji: string },
): Promise<{ id: string; pageCount: number }> {
  const totalWords = countWords(data.text);
  if (totalWords < MIN_TOTAL_WORDS || totalWords > MAX_TOTAL_WORDS) {
    throw new Error(`Текст должен быть от ${MIN_TOTAL_WORDS} до ${MAX_TOTAL_WORDS} слов`);
  }
  const pages = paginateText(data.text);
  const ref = await addDoc(collection(db, "books"), {
    title: data.title.trim().slice(0, 120),
    language: data.language,
    pages,
    totalWords,
    estimatedMinutes: Math.max(1, Math.round(totalWords / 60)),
    difficulty: "custom",
    ageMin: 6,
    ageMax: 10,
    coverEmoji: data.coverEmoji || "📖",
    coverUrl: null,
    ownerId: uid,
    isCustom: true,
    createdAt: Date.now(),
  } satisfies Omit<Book, "id">);
  return { id: ref.id, pageCount: pages.length };
}

export async function deleteCustomBook(bookId: string): Promise<void> {
  await deleteDoc(doc(db, "books", bookId));
}

/** Coins awarded on finishing a whole book, on top of per-word coins. */
export const BOOK_COMPLETION_BONUS = 50;

/** Локальная дата в формате YYYY-MM-DD (не UTC — важно для «сегодня»). */
function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Обновляет streak и копилку трудных слов.
 *
 * Streak растёт, если предыдущий день чтения — вчера; сохраняется, если это
 * сегодня (несколько сессий за день); и сбрасывается на 1, если был пропуск.
 * Возвращает актуальные значения, чтобы UI показал их сразу.
 */
export async function updateStreakAndHardWords(
  uid: string,
  profileId: string,
  struggledWords: string[],
): Promise<{ streak: number; grew: boolean }> {
  const ref = doc(db, "users", uid, "profiles", profileId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { streak: 1, grew: true };
      const data = snap.data() as ChildProfile;

      const today = localDay();
      const yesterday = localDay(new Date(Date.now() - 86400000));
      const last = data.lastReadDay;
      let streak = data.streak ?? 0;
      let grew = false;

      if (last === today) {
        // Уже читали сегодня — streak не меняется.
      } else if (last === yesterday) {
        streak += 1;
        grew = true;
      } else {
        streak = 1;
        grew = true;
      }

      // Копим трудные слова с частотой (для отчёта показываем топ).
      const hard = { ...(data.hardWords ?? {}) };
      for (const w of struggledWords) hard[w] = (hard[w] ?? 0) + 1;
      // Не даём словарю разрастаться безгранично — оставляем 40 самых частых.
      const trimmed = Object.fromEntries(
        Object.entries(hard).sort((a, b) => b[1] - a[1]).slice(0, 40),
      );

      tx.update(ref, { streak, lastReadDay: today, hardWords: trimmed });
      return { streak, grew };
    });
  } catch {
    return { streak: 0, grew: false };
  }
}

// ───────────────────────── Sessions ─────────────────────────

const sessionsCol = (uid: string, pid: string) =>
  collection(db, "users", uid, "profiles", pid, "sessions");

export async function findOpenSession(
  uid: string,
  pid: string,
  bookId: string,
): Promise<ReadingSession | null> {
  const snap = await getDocs(
    query(sessionsCol(uid, pid), where("bookId", "==", bookId), where("completed", "==", false)),
  );
  if (snap.empty) return null;
  const sessions = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ReadingSession, "id">),
  }));
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export async function startSession(
  uid: string,
  pid: string,
  book: Book,
): Promise<string> {
  const ref = await addDoc(sessionsCol(uid, pid), {
    bookId: book.id,
    bookTitle: book.title,
    language: book.language,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    currentPage: 0,
    currentWordIndex: 0,
    wordsRead: 0,
    durationMs: 0,
    wpm: 0,
    completed: false,
  } satisfies Omit<ReadingSession, "id">);
  return ref.id;
}

/** READ-10: fire-and-forget autosave. Also feeds words/time aggregates
 *  incrementally so "Стоп, продолжу позже" keeps stats in sync. */
export async function saveSessionProgress(
  uid: string,
  pid: string,
  sessionId: string,
  data: {
    currentPage: number;
    currentWordIndex: number;
    wordsRead: number;
    durationMs: number;
    wpm: number;
  },
  deltas: { words: number; ms: number; coins?: number },
): Promise<void> {
  const ops: Promise<unknown>[] = [
    updateDoc(doc(sessionsCol(uid, pid), sessionId), {
      ...data,
      updatedAt: Date.now(),
    }),
  ];
  if (deltas.words > 0 || deltas.ms > 0) {
    ops.push(
      updateDoc(doc(db, "users", uid, "profiles", pid), {
        totalWords: increment(deltas.words),
        totalMs: increment(deltas.ms),
        coins: increment(deltas.coins ?? deltas.words),
      }),
    );
  }
  await Promise.all(ops);
}

export async function completeSession(
  uid: string,
  pid: string,
  sessionId: string,
  language: Language,
  finalMs: number,
): Promise<void> {
  await Promise.all([
    updateDoc(doc(sessionsCol(uid, pid), sessionId), {
      completed: true,
      updatedAt: Date.now(),
    }),
    updateDoc(doc(db, "users", uid, "profiles", pid), {
      booksCompleted: increment(1),
      coins: increment(BOOK_COMPLETION_BONUS),
      [`byLanguage.${language}.books`]: increment(1),
      [`byLanguage.${language}.ms`]: increment(finalMs),
    }),
  ]);
}

export async function getSessions(
  uid: string,
  pid: string,
): Promise<ReadingSession[]> {
  const snap = await getDocs(sessionsCol(uid, pid));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ReadingSession, "id">) }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// ───────────────────────── Achievements ─────────────────────────

export async function getAchievements(
  uid: string,
  pid: string,
): Promise<Achievement[]> {
  const snap = await getDocs(
    collection(db, "users", uid, "profiles", pid, "achievements"),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as { earnedAt: number }) }));
}

export async function awardAchievement(
  uid: string,
  pid: string,
  badgeId: string,
): Promise<boolean> {
  const ref = doc(db, "users", uid, "profiles", pid, "achievements", badgeId);
  const existing = await getDoc(ref);
  if (existing.exists()) return false;
  await setDoc(ref, { earnedAt: Date.now() });
  return true;
}


// ───────────────────── Магазин персонажей ─────────────────────

export type PurchaseResult =
  | { ok: true; coinsLeft: number }
  | { ok: false; reason: "not_enough" | "already_owned" | "error"; coinsLeft?: number };

/**
 * Покупка персонажа за монеты.
 *
 * Выполняется в транзакции: без неё два быстрых нажатия (или две вкладки)
 * списали бы монеты дважды либо купили бы уже открытого персонажа.
 */
export async function purchaseAvatar(
  uid: string,
  profileId: string,
  avatarId: string,
  price: number,
): Promise<PurchaseResult> {
  const ref = doc(db, "users", uid, "profiles", profileId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { ok: false, reason: "error" } as PurchaseResult;
      const data = snap.data() as ChildProfile;
      const owned = data.unlockedAvatars ?? [];
      const coins = data.coins ?? 0;

      if (owned.includes(avatarId)) {
        return { ok: false, reason: "already_owned", coinsLeft: coins } as PurchaseResult;
      }
      if (coins < price) {
        return { ok: false, reason: "not_enough", coinsLeft: coins } as PurchaseResult;
      }

      tx.update(ref, {
        coins: coins - price,
        unlockedAvatars: [...owned, avatarId],
      });
      return { ok: true, coinsLeft: coins - price } as PurchaseResult;
    });
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Смена внешнего вида на уже открытого персонажа (или эмодзи). */
export async function setProfileAvatar(
  uid: string,
  profileId: string,
  avatar: string,
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "profiles", profileId), { avatar });
}


// ───────────────────── Родительские награды ─────────────────────
//
// Модель: награды и запросы живут на уровне аккаунта (users/{uid}), а не
// профиля, потому что родитель один задаёт список для всех своих детей.
// Монеты у каждого ребёнка свои — списываются с конкретного профиля.

const rewardsCol = (uid: string) => collection(db, "users", uid, "rewards");
const requestsCol = (uid: string) => collection(db, "users", uid, "rewardRequests");

/** Список наград, которые создал родитель. */
export async function getRewards(uid: string): Promise<ParentReward[]> {
  const snap = await getDocs(query(rewardsCol(uid), orderBy("price", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ParentReward, "id">) }));
}

/** Добавить новую награду. */
export async function addReward(
  uid: string,
  reward: Omit<ParentReward, "id" | "createdAt" | "active">,
): Promise<string> {
  const ref = await addDoc(rewardsCol(uid), {
    ...reward,
    createdAt: Date.now(),
    active: true,
  });
  return ref.id;
}

/** Изменить награду (название, цену, иконку, видимость). */
export async function updateReward(
  uid: string,
  rewardId: string,
  patch: Partial<Pick<ParentReward, "title" | "emoji" | "price" | "active">>,
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "rewards", rewardId), patch);
}

/** Удалить награду. */
export async function deleteReward(uid: string, rewardId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "rewards", rewardId));
}

/**
 * Ребёнок запрашивает награду. Монеты пока НЕ списываются — только когда
 * родитель подтвердит. Проверяем, что монет достаточно на момент запроса,
 * чтобы не создавать заведомо невыполнимые заявки.
 */
export async function requestReward(
  uid: string,
  profile: ChildProfile,
  reward: ParentReward,
): Promise<{ ok: boolean; reason?: "not_enough" | "error" }> {
  if ((profile.coins ?? 0) < reward.price) return { ok: false, reason: "not_enough" };
  try {
    await addDoc(requestsCol(uid), {
      rewardId: reward.id,
      rewardTitle: reward.title,
      rewardEmoji: reward.emoji,
      ...(reward.photo ? { rewardPhoto: reward.photo } : {}),
      price: reward.price,
      profileId: profile.id,
      profileName: profile.name,
      status: "requested" as RewardRequestStatus,
      requestedAt: Date.now(),
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Открытые (ещё не решённые) запросы — для родительского дашборда. */
export async function getPendingRequests(uid: string): Promise<RewardRequest[]> {
  const snap = await getDocs(
    query(requestsCol(uid), where("status", "==", "requested")),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<RewardRequest, "id">) }))
    .sort((a, b) => b.requestedAt - a.requestedAt);
}

/**
 * Родитель подтверждает выдачу: монеты списываются с профиля ребёнка в
 * транзакции (чтобы нельзя было подтвердить дважды или уйти в минус).
 */
export async function approveRewardRequest(
  uid: string,
  request: RewardRequest,
): Promise<{ ok: boolean; reason?: "not_enough" | "already_resolved" | "error" }> {
  const reqRef = doc(db, "users", uid, "rewardRequests", request.id);
  const profRef = doc(db, "users", uid, "profiles", request.profileId);
  try {
    return await runTransaction(db, async (tx) => {
      const [reqSnap, profSnap] = await Promise.all([tx.get(reqRef), tx.get(profRef)]);
      if (!reqSnap.exists() || !profSnap.exists()) return { ok: false, reason: "error" as const };
      const req = reqSnap.data() as RewardRequest;
      if (req.status !== "requested") return { ok: false, reason: "already_resolved" as const };

      const prof = profSnap.data() as ChildProfile;
      const coins = prof.coins ?? 0;
      if (coins < request.price) return { ok: false, reason: "not_enough" as const };

      tx.update(profRef, {
        coins: coins - request.price,
        coinsSpent: (prof.coinsSpent ?? 0) + request.price,
      });
      tx.update(reqRef, { status: "approved", resolvedAt: Date.now() });
      return { ok: true as const };
    });
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Родитель отклоняет запрос — монеты не трогаются. */
export async function declineRewardRequest(uid: string, requestId: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "rewardRequests", requestId), {
    status: "declined",
    resolvedAt: Date.now(),
  });
}
