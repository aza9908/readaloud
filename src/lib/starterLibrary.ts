/**
 * Starter library — lets a parent load the 14 built-in stories straight from
 * the app, with no Cloud Function, service account or CI step involved.
 *
 * Books are written as the user's own books (ownerId = uid), which the
 * existing Firestore rules already permit. Seeding via `npm run seed` writes
 * shared books (ownerId = null) instead; both can coexist.
 */

import { collection, getDocs, query, where, writeBatch, doc } from "firebase/firestore";
import { db } from "./firebase";
import { paginateText, countWords } from "./firestore";
import type { Book, Language } from "./types";
import starter from "./starterBooks.json";

interface StarterBook {
  title: string;
  language: string;
  coverEmoji?: string;
  text: string;
  difficulty?: string;
  ageMin?: number;
  ageMax?: number;
}

const STARTER = starter as StarterBook[];

export const STARTER_COUNT = STARTER.length;

/** Marks books created by this installer so we don't add them twice. */
const STARTER_TAG = "starter-v1";

export async function hasStarterLibrary(uid: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, "books"), where("ownerId", "==", uid), where("starterTag", "==", STARTER_TAG)),
  );
  return !snap.empty;
}

/**
 * Writes all 14 stories in a single batch (one round-trip, fast enough to
 * run while a "loading" button spinner shows).
 */
export async function installStarterLibrary(uid: string): Promise<number> {
  const batch = writeBatch(db);
  let created = 0;

  for (const b of STARTER) {
    const pages = paginateText(b.text);
    if (!pages.length) continue;
    const totalWords = countWords(b.text);
    const ref = doc(collection(db, "books"));
    batch.set(ref, {
      title: b.title,
      language: b.language as Language,
      pages,
      totalWords,
      estimatedMinutes: Math.max(1, Math.round(totalWords / 60)),
      difficulty: (b.difficulty ?? "easy") as Book["difficulty"],
      ageMin: b.ageMin ?? 6,
      ageMax: b.ageMax ?? 10,
      coverEmoji: b.coverEmoji ?? "📖",
      coverUrl: null,
      ownerId: uid,
      isCustom: true,
      starterTag: STARTER_TAG,
      createdAt: Date.now(),
    });
    created++;
  }

  await batch.commit();
  return created;
}

/** Saves a prepared book (found online or generated) into the child's library. */
export async function saveDiscoveredBook(
  uid: string,
  book: {
    title: string;
    pages: string[];
    language: Language;
    coverEmoji?: string;
    sourceUrl?: string;
    origin: "wikisource" | "generated";
    age: number;
  },
): Promise<string> {
  const totalWords = book.pages.reduce(
    (n, p) => n + p.split(/\s+/).filter(Boolean).length,
    0,
  );
  const ref = doc(collection(db, "books"));
  const batch = writeBatch(db);
  batch.set(ref, {
    title: book.title.slice(0, 120),
    language: book.language,
    pages: book.pages,
    totalWords,
    estimatedMinutes: Math.max(1, Math.round(totalWords / 60)),
    difficulty: "custom",
    ageMin: Math.max(5, book.age - 1),
    ageMax: Math.min(12, book.age + 2),
    coverEmoji: book.coverEmoji ?? (book.origin === "generated" ? "✨" : "🌐"),
    coverUrl: null,
    ownerId: uid,
    isCustom: true,
    origin: book.origin,
    sourceUrl: book.sourceUrl ?? null,
    createdAt: Date.now(),
  });
  await batch.commit();
  return ref.id;
}
