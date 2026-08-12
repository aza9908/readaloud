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
  /**
   * Возрастная категория, вычисленная из текста при добавлении книги.
   * Поля ageMin/ageMax ниже остались от ранней версии и ненадёжны
   * (почти везде захардкожено 6) — для фильтров используйте band.
   */
  band?: "4-5" | "6-7" | "8-9" | "10-12";
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
  /** Дни подряд с чтением (streak). */
  streak?: number;
  /** ISO-дата (YYYY-MM-DD) последнего дня чтения — для подсчёта streak. */
  lastReadDay?: string;
  /** Трудные слова с частотой, накапливаются между сессиями (для отчёта). */
  hardWords?: Record<string, number>;
  /** Всего монет потрачено на награды (для истории). */
  coinsSpent?: number;
  /** Сколько раз дочитана каждая книга: bookId → число. Ограничивает повторы. */
  bookCompletions?: Record<string, number>;
  /**
   * Максимальная страница, за которую уже начислены монеты, по каждой книге:
   * bookId → номер страницы. Позволяет платить за чтение СРАЗУ, но не платить
   * дважды за одну и ту же страницу. Без этого длинная книга либо не приносила
   * монет до конца, либо её можно было накручивать перечитыванием.
   */
  pagesAwarded?: Record<string, number>;
  /** Оплаченные задачи по математике: taskId → когда. Блокирует повтор. */
  solvedTasks?: Record<string, number>;
  /** Собранные карточки. */
  cards?: string[];
  /** За какие работы карточка уже выдана — блокирует повторную выдачу. */
  cardWorks?: Record<string, number>;
  /** Оплаченные матчи: matchId → когда. Блокирует повторное начисление. */
  paidMatches?: Record<string, number>;
  /** Монет начислено за сегодня — для дневного потолка. */
  coinsToday?: number;
  /** Локальная дата (YYYY-MM-DD), к которой относится coinsToday. */
  coinsTodayDay?: string;
  /**
   * Уровень последней дочитанной книги относительно возраста ребёнка.
   * Нужен для правила «нельзя брать простое подряд»: после книги ниже
   * уровня следующая должна быть по возрасту.
   */
  lastBookFit?: "below" | "match" | "above";
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

/**
 * Родительская награда: настоящая «хотелка», которую родитель добавил и
 * оценил в монетах (мороженое, поход в кино, час игры). Ребёнок копит монеты
 * и запрашивает награду; родитель подтверждает выдачу.
 *
 * Это отличается от героев в магазине: героя ребёнок открывает сам и сразу,
 * а физическую награду выдаёт родитель — поэтому есть статус запроса.
 */
export interface ParentReward {
  id: string;
  /** Название: «Мороженое», «30 мин PlayStation». */
  title: string;
  /** Эмодзи-иконка (если нет фото). */
  emoji: string;
  /** Фото награды (сжатый data URL). Если задано — показываем вместо эмодзи. */
  photo?: string;
  /** Цена в монетах, которую назначил родитель. */
  price: number;
  /** Кто создал (для мультиребёнковых семей — награда общая на аккаунт). */
  createdAt: number;
  /** Можно временно скрыть награду, не удаляя. */
  active: boolean;
}

export type RewardRequestStatus = "requested" | "approved" | "declined";

/** Запрос ребёнка на выдачу награды. Монеты списываются при подтверждении. */
export interface RewardRequest {
  id: string;
  rewardId: string;
  rewardTitle: string;
  rewardEmoji: string;
  rewardPhoto?: string;
  price: number;
  profileId: string;
  profileName: string;
  status: RewardRequestStatus;
  requestedAt: number;
  resolvedAt?: number;
}
