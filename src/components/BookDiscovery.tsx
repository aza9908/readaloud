/**
 * BookDiscovery — shown inside the guide's results screen.
 *
 * Two ways to get a book that isn't in the library yet:
 *   1. Search Wikisource (public-domain stories) → adapt → save
 *   2. Generate an original story from the child's topics → save
 */

import { useState } from "react";
import {
  searchOnline, fetchOnlineText, fetchPageImages, searchCommonsImages,
  distributeImages, type FoundBook,
} from "@/lib/bookSources";
import { adaptStory, generateStory } from "@/lib/ai";
import { saveDiscoveredBook } from "@/lib/starterLibrary";
import type { ChildProfile, Language } from "@/lib/types";

const COPY = {
  ru: {
    title: "Нет подходящей? Найдём новую",
    searchBtn: "🌐 Поискать в интернете",
    genBtn: "✨ Придумать сказку для меня",
    searching: "Ищу истории…",
    generating: "Сочиняю сказку…",
    adding: "Готовлю книгу…",
    found: "Нашлось вот что",
    nothing: "Ничего подходящего не нашлось. Давай придумаем свою сказку!",
    add: "Добавить",
    back: "Назад",
    sourceNote: "Тексты из Викитеки (общественное достояние), адаптированы для детей.",
    failed: "Не получилось загрузить. Попробуй ещё раз или придумай сказку.",
    tooShort: "Эта страница слишком короткая для чтения.",
  },
  kk: {
    title: "Сәйкесі жоқ па? Жаңасын табайық",
    searchBtn: "🌐 Интернеттен іздеу",
    genBtn: "✨ Маған ертегі ойлап тап",
    searching: "Әңгімелер іздеп жатырмын…",
    generating: "Ертегі жазып жатырмын…",
    adding: "Кітап дайындалуда…",
    found: "Мынау табылды",
    nothing: "Ештеңе табылмады. Өз ертегімізді ойлап табайық!",
    add: "Қосу",
    back: "Артқа",
    sourceNote: "Мәтіндер Уикидереккөзден (қоғамдық игілік), балаларға бейімделген.",
    failed: "Жүктеу мүмкін болмады. Қайталап көр немесе ертегі ойлап тап.",
    tooShort: "Бұл бет оқуға тым қысқа.",
  },
  en: {
    title: "Nothing quite right? Let's find something new",
    searchBtn: "🌐 Search online",
    genBtn: "✨ Write me a story",
    searching: "Looking for stories…",
    generating: "Writing your story…",
    adding: "Preparing the book…",
    found: "Here's what I found",
    nothing: "Nothing suitable turned up. Let's write our own story!",
    add: "Add",
    back: "Back",
    sourceNote: "Texts from Wikisource (public domain), adapted for children.",
    failed: "Couldn't load that one. Try again or write a story instead.",
    tooShort: "That page is too short to read.",
  },
} as const;

type Phase = "idle" | "searching" | "results" | "adding" | "generating";

interface Props {
  topics: string;
  language: Language;
  profile: ChildProfile;
  uid: string;
  onAdded: (bookId: string) => void;
}

export function BookDiscovery({ topics, language, profile, uid, onAdded }: Props) {
  const c = COPY[language] ?? COPY.ru;
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<FoundBook[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setPhase("searching");
    setError(null);
    try {
      const found = await searchOnline(topics, language);
      setResults(found);
      setPhase("results");
      if (found.length === 0) setError(c.nothing);
    } catch {
      setPhase("idle");
      setError(c.failed);
    }
  };

  const addFound = async (f: FoundBook) => {
    setPhase("adding");
    setError(null);
    try {
      const [raw, images] = await Promise.all([
        fetchOnlineText(f.title, language),
        fetchPageImages(f.title, language),
      ]);
      if (!raw || raw.split(/\s+/).length < 60) {
        setError(c.tooShort);
        setPhase("results");
        return;
      }
      const prepared = await adaptStory({
        title: f.title,
        text: raw,
        language,
        age: profile.age,
        sourceUrl: f.sourceUrl,
      });
      if (!prepared.pages.length) {
        setError(c.failed);
        setPhase("results");
        return;
      }
      const id = await saveDiscoveredBook(uid, {
        title: prepared.title,
        pages: prepared.pages,
        pageImages: distributeImages(images, prepared.pages.length),
        language,
        sourceUrl: prepared.sourceUrl,
        origin: "wikisource",
        age: profile.age,
      });
      onAdded(id);
    } catch {
      setError(c.failed);
      setPhase("results");
    }
  };

  const generate = async () => {
    setPhase("generating");
    setError(null);
    try {
      const prepared = await generateStory({ topics, language, age: profile.age });
      // Illustrate with freely-licensed Commons imagery matching the topic.
      const commonsQuery = `${topics || "children story"} illustration`;
      const images = await searchCommonsImages(commonsQuery, prepared.pages.length);
      const id = await saveDiscoveredBook(uid, {
        title: prepared.title,
        pages: prepared.pages,
        pageImages: distributeImages(images, prepared.pages.length),
        language,
        origin: "generated",
        age: profile.age,
      });
      onAdded(id);
    } catch {
      setError(c.failed);
      setPhase("idle");
    }
  };

  const busy = phase === "searching" || phase === "adding" || phase === "generating";
  const busyLabel =
    phase === "searching" ? c.searching : phase === "adding" ? c.adding : c.generating;

  return (
    <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
      <p className="font-display font-bold text-ink dark:text-white mb-2">{c.title}</p>

      {busy && (
        <div className="py-6 text-center">
          <div className="text-3xl animate-float mb-2">{phase === "generating" ? "✨" : "🌐"}</div>
          <p className="text-sm text-ink-soft dark:text-ink-faint">{busyLabel}</p>
        </div>
      )}

      {!busy && phase === "results" && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-faint">{c.found}</p>
          {results.map((f) => (
            <div key={f.sourceUrl} className="card p-3 flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-500/15 grid place-items-center text-xl shrink-0">🌐</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-ink dark:text-white truncate">{f.title}</p>
                {f.snippet && <p className="text-xs text-ink-faint line-clamp-2">{f.snippet}</p>}
              </div>
              <button className="chip chip-on !py-1.5 !px-3 text-xs shrink-0" onClick={() => void addFound(f)}>
                {c.add}
              </button>
            </div>
          ))}
          <p className="text-[11px] text-ink-faint pt-1">{c.sourceNote}</p>
        </div>
      )}

      {error && <p className="text-sm text-amber-600 my-2">{error}</p>}

      {!busy && (
        <div className="grid grid-cols-1 gap-2 mt-3">
          {phase !== "results" && (
            <button className="btn-ghost w-full" onClick={() => void search()}>
              {c.searchBtn}
            </button>
          )}
          <button className="btn-primary w-full" onClick={() => void generate()}>
            {c.genBtn}
          </button>
          {phase === "results" && (
            <button className="text-sm font-bold text-ink-faint py-1" onClick={() => { setPhase("idle"); setError(null); }}>
              {c.back}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
