/**
 * Seed system books into Firestore (idempotent — PRD §5.4).
 *
 * Auth (either):
 *   export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *   — or place serviceAccountKey.json in the repo root (gitignored).
 *
 * Usage:
 *   npm run seed                              # seeds seed/books.sample.json
 *   npm run seed seed/books.exported.json     # seeds books exported from Replit
 *
 * Idempotency: doc id = `system-${language}-${slug(title)}` — re-running
 * overwrites the same docs instead of duplicating them.
 */
import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

interface SeedBook {
  title: string;
  language: "en" | "ru" | "kk";
  coverEmoji?: string;
  coverUrl?: string | null;
  difficulty?: string;
  ageMin?: number;
  ageMax?: number;
  /** Either raw `text` (auto-paginated) or ready-made `pages`. */
  text?: string;
  pages?: string[];
}

const TARGET = 45;
const MAX = 65;
const countWords = (t: string) => t.split(/\s+/).filter(Boolean).length;

function splitLong(p: string): string[] {
  const sentences = p.match(/[^.!?…]+[.!?…]+["»']?\s*|[^.!?…]+$/g) ?? [p];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (countWords(cur) + countWords(s) > MAX && cur) {
      chunks.push(cur.trim());
      cur = s;
    } else cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function paginate(raw: string): string[] {
  const paras = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((p) => (countWords(p) > MAX ? splitLong(p) : [p]));
  const pages: string[] = [];
  let cur: string[] = [];
  let cw = 0;
  for (const p of paras) {
    const w = countWords(p);
    if (cw > 0 && cw + w > TARGET) {
      pages.push(cur.join("\n\n"));
      cur = [];
      cw = 0;
    }
    cur.push(p);
    cw += w;
  }
  if (cur.length) pages.push(cur.join("\n\n"));
  return pages;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

async function main() {
  const file = process.argv[2] ?? "seed/books.sample.json";
  const raw = JSON.parse(readFileSync(file, "utf8")) as SeedBook[];

  initializeApp({
    credential: existsSync("serviceAccountKey.json")
      ? cert("serviceAccountKey.json")
      : applicationDefault(),
  });
  const db = getFirestore();

  for (const b of raw) {
    const pages = b.pages ?? paginate(b.text ?? "");
    if (!pages.length) {
      console.warn(`⚠️  Skipping "${b.title}" — no content`);
      continue;
    }
    const totalWords = pages.reduce((n, p) => n + countWords(p), 0);
    const id = `system-${b.language}-${slug(b.title)}`;
    await db.doc(`books/${id}`).set({
      title: b.title,
      language: b.language,
      pages,
      totalWords,
      estimatedMinutes: Math.max(1, Math.round(totalWords / 60)),
      difficulty: b.difficulty ?? "easy",
      ageMin: b.ageMin ?? 6,
      ageMax: b.ageMax ?? 10,
      coverEmoji: b.coverEmoji ?? "📖",
      coverUrl: b.coverUrl ?? null,
      ownerId: null,
      isCustom: false,
      createdAt: Date.now(),
    });
    console.log(`✅ ${id}  (${pages.length} pages, ${totalWords} words)`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
