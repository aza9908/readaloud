/**
 * bookSources.ts — finds real, publicly-licensed stories online and prepares
 * them for the app.
 *
 * SOURCE POLICY (important):
 * Only Wikisource is queried. Its texts are public domain or freely licensed,
 * so importing them into a child's library is legitimate. We deliberately do
 * NOT scrape arbitrary websites — that would sweep in copyrighted books.
 *
 * Wikisource's API supports CORS via `origin=*`, so this works directly from
 * the browser with no proxy.
 */

import type { Language } from "./types";

const WIKI_HOST: Record<Language, string> = {
  ru: "https://ru.wikisource.org",
  kk: "https://kk.wikisource.org",
  en: "https://en.wikisource.org",
};

/** Wikisource pages that are indexes, author pages, etc. — not stories. */
const SKIP_PREFIXES = [
  "Автор:", "Категория:", "Индекс:", "Страница:", "Шаблон:", "Портал:",
  "Author:", "Category:", "Index:", "Page:", "Template:", "Portal:", "Wikisource:",
  "Санат:", "Бет:",
];

export interface FoundBook {
  title: string;
  snippet: string;
  sourceUrl: string;
  language: Language;
}

export interface PreparedBook {
  title: string;
  pages: string[];
  totalWords: number;
  sourceUrl?: string;
  origin: "wikisource" | "generated";
  adapted: boolean;
}

const countWords = (t: string) => t.split(/\s+/).filter(Boolean).length;

// ───────────────────────── Search ─────────────────────────

/**
 * Searches Wikisource. We bias the query toward children's material so the
 * results are age-appropriate rather than legal codes or poetry criticism.
 */
export async function searchOnline(
  topics: string,
  language: Language,
  signal?: AbortSignal,
): Promise<FoundBook[]> {
  const host = WIKI_HOST[language];
  const hint =
    language === "ru" ? "сказка" : language === "kk" ? "ертегі" : "fairy tale";
  const srsearch = `${topics} ${hint}`.trim().slice(0, 200);

  const url =
    `${host}/w/api.php?action=query&format=json&origin=*` +
    `&list=search&srlimit=8&srnamespace=0&srsearch=${encodeURIComponent(srsearch)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Wikisource search failed: ${res.status}`);
  const data = (await res.json()) as {
    query?: { search?: { title: string; snippet: string }[] };
  };

  return (data.query?.search ?? [])
    .filter((r) => !SKIP_PREFIXES.some((p) => r.title.startsWith(p)))
    .map((r) => ({
      title: r.title,
      snippet: r.snippet.replace(/<[^>]+>/g, "").trim(),
      sourceUrl: `${host}/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
      language,
    }))
    .slice(0, 6);
}

// ───────────────────────── Fetch text ─────────────────────────

export async function fetchOnlineText(
  title: string,
  language: Language,
  signal?: AbortSignal,
): Promise<string> {
  const host = WIKI_HOST[language];
  const url =
    `${host}/w/api.php?action=query&format=json&origin=*` +
    `&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Wikisource fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { extract?: string }> };
  };
  const pages = data.query?.pages ?? {};
  const first = Object.values(pages)[0];
  return (first?.extract ?? "").trim();
}

// ───────────────────── Clean + shorten ─────────────────────

/**
 * Wikisource extracts carry footnotes, editorial headers and section markers.
 * Strip them, then keep only as much as a child should read in one sitting.
 */
export function cleanWikiText(raw: string): string {
  return raw
    .replace(/={2,}[^=]+={2,}/g, "\n\n")        // == section headings ==
    .replace(/\[\d+\]/g, "")                    // footnote markers
    .replace(/\{\{[^}]*\}\}/g, "")              // leftover templates
    .replace(/^\s*(Примечания|Источник|Notes|References|Дереккөздер)[\s\S]*$/im, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Keeps whole paragraphs up to a word budget, so text never cuts mid-thought. */
export function trimToBudget(text: string, maxWords: number): string {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const kept: string[] = [];
  let total = 0;
  for (const p of paras) {
    const w = countWords(p);
    if (total + w > maxWords) break;
    kept.push(p);
    total += w;
  }
  // If the very first paragraph already exceeds the budget, cut it at a sentence.
  if (kept.length === 0 && paras.length > 0) {
    const sentences = paras[0].match(/[^.!?…]+[.!?…]+/g) ?? [paras[0]];
    let acc = "";
    for (const s of sentences) {
      if (countWords(acc) + countWords(s) > maxWords) break;
      acc += s;
    }
    return acc.trim() || paras[0].slice(0, 600);
  }
  return kept.join("\n\n");
}

/** Word budget appropriate for the child's age. */
export function budgetForAge(age: number): number {
  return Math.round(140 + Math.max(0, age - 5) * 45); // 6y ≈ 185, 10y ≈ 365
}
