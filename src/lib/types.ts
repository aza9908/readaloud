/** Firestore data model.
 *
 *  users/{uid}                              — parent account
 *  users/{uid}/profiles/{profileId}         — child profile + aggregate stats
 *  users/{uid}/profiles/{pid}/sessions/{id} — reading sessions
 *  users/{uid}/profiles/{pid}/achievements/{badgeId}
 *  books/{bookId}                           — system (ownerId=null) & custom books;
 *                                             pages embedded as string[] (1 read/book)
 */

export type Language = "en" | "ru" | "kk";

export const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: "ru", label: "Русский", flag: "🇷🇺" },
  { value: "kk", label: "Қазақша", flag: "🇰🇿" },
  { value: "en", label: "English", flag: "🇬🇧" },
];

export const SPEECH_LANG_TAGS: Record<Language, string> = {
  en: "en-US",
  ru: "ru-RU",
  kk: "kk-KZ",
};

export interface Book {
  id: string;
  title: string;
  language: Language;
  /** Paragraphs inside a page separated by \n\n */
  pages: string[];
  /** Optional illustration per page (same length as `pages`); null = none. */
  pageImages?: (string | null)[];
  totalWords: number;
  estimatedMinutes: number;
  difficulty: "easy" | "medium" | "hard" | "custom";
  ageMin: number;
  ageMax: number;
  coverEmoji: string;
  coverUrl: string | null;
  ownerId: string | null;
  isCustom: boolean;
  createdAt: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  avatar: string; // emoji
  defaultLanguage: Language;
  createdAt: number;
  // ── Aggregates (incrementally updated on session save/complete) ──
  totalWords: number;
  totalMs: number;
  booksCompleted: number;
  /** Reward coins: 1 per word read, plus bonuses for pages and books. */
  coins?: number;
  /** Ids of avatar characters bought in the shop. */
  unlockedAvatars?: string[];
  byLanguage: Record<Language, { books: number; ms: number }>;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  bookTitle: string;
  language: Language;
  startedAt: number;
  updatedAt: number;
  currentPage: number;
  currentWordIndex: number;
  wordsRead: number;
  durationMs: number;
  wpm: number;
  completed: boolean;
}

export interface Achievement {
  id: string; // badge id
  earnedAt: number;
}

export const EMPTY_BY_LANGUAGE: ChildProfile["byLanguage"] = {
  en: { books: 0, ms: 0 },
  ru: { books: 0, ms: 0 },
  kk: { books: 0, ms: 0 },
};
