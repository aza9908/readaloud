/** Badge system — PRD §4.5 (GAME-03 … GAME-10). */

import { awardAchievement } from "./firestore";
import type { ChildProfile } from "./types";

export interface BadgeDef {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  { id: "word_wizard",     icon: "⭐", title: "Маленький читатель", description: "Прочитал 15 слов" },
  { id: "century_reader",  icon: "🏆", title: "Сто слов!",          description: "Прочитал 100 слов" },
  { id: "bookworm",        icon: "💎", title: "Книжный червь",      description: "Прочитал 300 слов" },
  { id: "first_story",     icon: "📖", title: "Первая сказка!",     description: "Завершил первую книгу" },
  { id: "story_collector", icon: "🎒", title: "Коллектор сказок",   description: "Завершил 3 книги" },
  { id: "book_lover",      icon: "👑", title: "Книгоман",           description: "Завершил 5 книг" },
  { id: "reading_star",    icon: "⏰", title: "Звезда чтения",      description: "Читал 3 минуты подряд" },
  { id: "real_reader",     icon: "🕐", title: "Настоящий читатель", description: "Читал 10 минут суммарно" },
];

export const badgeById = (id: string): BadgeDef | undefined =>
  BADGES.find((b) => b.id === id);

interface StatsSnapshot {
  totalWords: number;
  totalMs: number;
  booksCompleted: number;
  /** Duration of the current uninterrupted session (for reading_star). */
  sessionMs: number;
}

function earnedBadgeIds(s: StatsSnapshot): string[] {
  const ids: string[] = [];
  if (s.totalWords >= 15) ids.push("word_wizard");
  if (s.totalWords >= 100) ids.push("century_reader");
  if (s.totalWords >= 300) ids.push("bookworm");
  if (s.booksCompleted >= 1) ids.push("first_story");
  if (s.booksCompleted >= 3) ids.push("story_collector");
  if (s.booksCompleted >= 5) ids.push("book_lover");
  if (s.sessionMs >= 3 * 60_000) ids.push("reading_star");
  if (s.totalMs >= 10 * 60_000) ids.push("real_reader");
  return ids;
}

/**
 * Award any newly earned badges; returns the badges that were NEW
 * (for GAME-02 toast notifications). Idempotent per badge.
 */
export async function checkAndAwardBadges(
  uid: string,
  pid: string,
  profileBefore: Pick<ChildProfile, "totalWords" | "totalMs" | "booksCompleted">,
  live: { wordsThisSession: number; msThisSession: number; booksJustCompleted: number },
): Promise<BadgeDef[]> {
  const snapshot: StatsSnapshot = {
    totalWords: profileBefore.totalWords + live.wordsThisSession,
    totalMs: profileBefore.totalMs + live.msThisSession,
    booksCompleted: profileBefore.booksCompleted + live.booksJustCompleted,
    sessionMs: live.msThisSession,
  };
  const candidates = earnedBadgeIds(snapshot);
  const fresh: BadgeDef[] = [];
  for (const id of candidates) {
    const isNew = await awardAchievement(uid, pid, id);
    const def = badgeById(id);
    if (isNew && def) fresh.push(def);
  }
  return fresh;
}
