/**
 * One-time migration: export books + pages from the old Replit PostgreSQL
 * into seed/books.exported.json, ready for `npm run seed seed/books.exported.json`.
 *
 * Usage (DATABASE_URL from Replit → Secrets → DATABASE_URL):
 *   DATABASE_URL="postgresql://..." npm run export:postgres
 *
 * Adjust table/column names below if your Drizzle schema used different ones.
 */
import { writeFileSync } from "node:fs";
import pg from "pg";

interface BookRow {
  id: string;
  title_en: string | null;
  title_ru: string | null;
  title_kk: string | null;
  language: "en" | "ru" | "kk";
  difficulty: string | null;
  age_min: number | null;
  age_max: number | null;
  cover_url: string | null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL (copy it from Replit Secrets).");
    process.exit(1);
  }
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const books = await client.query<BookRow>(
    `SELECT id, title_en, title_ru, title_kk, language, difficulty,
            age_min, age_max, cover_url
       FROM books`,
  );

  const out = [];
  for (const b of books.rows) {
    const pages = await client.query<{ content: string }>(
      `SELECT content FROM book_pages WHERE book_id = $1 ORDER BY page_number`,
      [b.id],
    );
    const lang = b.language;
    const title =
      (lang === "ru" ? b.title_ru : lang === "kk" ? b.title_kk : b.title_en) ??
      b.title_en ??
      "Без названия";
    out.push({
      title,
      language: lang,
      difficulty: b.difficulty ?? "easy",
      ageMin: b.age_min ?? 6,
      ageMax: b.age_max ?? 10,
      coverUrl: b.cover_url ?? null,
      coverEmoji: "📖",
      pages: pages.rows.map((r) => r.content),
    });
  }
  await client.end();

  writeFileSync("seed/books.exported.json", JSON.stringify(out, null, 2));
  console.log(`✅ Exported ${out.length} books → seed/books.exported.json`);
  console.log("Now run: npm run seed seed/books.exported.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
