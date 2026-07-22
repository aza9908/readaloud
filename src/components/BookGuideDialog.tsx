/**
 * BookGuideDialog — «Подбери мне книгу».
 * Asks the child what they're in the mood for, then recommends 3 books
 * ranked by age fit, length, novelty and taste.
 */

import { useState } from "react";
import { recommendBook, type BookPick } from "@/lib/ai";
import type { Book, ChildProfile, Language } from "@/lib/types";

const COPY = {
  ru: {
    title: "Что тебе почитать?",
    sub: "Выбери настроение — подберу книгу",
    custom: "Или напиши сам, что хочешь почитать",
    placeholder: "Например: про животных и дружбу",
    find: "Подобрать книгу",
    finding: "Подбираю…",
    resultTitle: "Вот что тебе подойдёт",
    read: "Читать",
    again: "Подобрать ещё",
    moods: [
      { emoji: "🐾", label: "Про животных", value: "животные, звери, лес" },
      { emoji: "🏰", label: "Волшебство", value: "волшебство, сказка, магия" },
      { emoji: "🚀", label: "Приключения", value: "приключения, путешествия, космос" },
      { emoji: "😄", label: "Весёлое", value: "смешное, весёлое, хитрость" },
      { emoji: "👫", label: "Про дружбу", value: "дружба, друзья, помощь" },
      { emoji: "⚡", label: "Покороче", value: "короткая история" },
    ],
  },
  kk: {
    title: "Не оқығың келеді?",
    sub: "Көңіл күйіңді таңда — кітап табамын",
    custom: "Немесе өзің жаз",
    placeholder: "Мысалы: жануарлар мен достық туралы",
    find: "Кітап табу",
    finding: "Іздеп жатырмын…",
    resultTitle: "Саған мынау жарайды",
    read: "Оқу",
    again: "Тағы табу",
    moods: [
      { emoji: "🐾", label: "Жануарлар", value: "жануарлар, аңдар, орман" },
      { emoji: "🏰", label: "Сиқыр", value: "сиқыр, ертегі" },
      { emoji: "🚀", label: "Оқиға", value: "оқиға, саяхат, ғарыш" },
      { emoji: "😄", label: "Күлкілі", value: "күлкілі, қулық" },
      { emoji: "👫", label: "Достық", value: "достық, көмек" },
      { emoji: "⚡", label: "Қысқасы", value: "қысқа әңгіме" },
    ],
  },
  en: {
    title: "What should you read?",
    sub: "Pick a mood — I'll find a book",
    custom: "Or type what you feel like reading",
    placeholder: "For example: animals and friendship",
    find: "Find me a book",
    finding: "Finding…",
    resultTitle: "Here's what suits you",
    read: "Read",
    again: "Find more",
    moods: [
      { emoji: "🐾", label: "Animals", value: "animals, forest, creatures" },
      { emoji: "🏰", label: "Magic", value: "magic, fairy tale, dragons" },
      { emoji: "🚀", label: "Adventure", value: "adventure, travel, space" },
      { emoji: "😄", label: "Funny", value: "funny, silly, clever tricks" },
      { emoji: "👫", label: "Friendship", value: "friendship, friends, helping" },
      { emoji: "⚡", label: "Short one", value: "short story" },
    ],
  },
} as const;

interface Props {
  open: boolean;
  books: Book[];
  profile: ChildProfile;
  language: Language;
  readIds: string[];
  readTitles: string[];
  onClose: () => void;
  onPick: (bookId: string) => void;
}

export function BookGuideDialog({
  open, books, profile, language, readIds, readTitles, onClose, onPick,
}: Props) {
  const c = COPY[language] ?? COPY.ru;
  const [moods, setMoods] = useState<string[]>([]);
  const [free, setFree] = useState("");
  const [picks, setPicks] = useState<BookPick[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const toggle = (v: string) =>
    setMoods((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]));

  const find = async () => {
    setLoading(true);
    try {
      const preferences = [...moods, free].filter(Boolean).join(", ");
      const r = await recommendBook({
        books, age: profile.age, language, preferences, readTitles, readIds,
      });
      setPicks(r.picks);
    } finally {
      setLoading(false);
    }
  };

  const bookById = (id: string) => books.find((b) => b.id === id);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="sheet max-w-md space-y-4 max-h-[92vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-1">✨ Книжный помощник</p>
            <h2 className="font-display font-extrabold text-2xl text-ink dark:text-white">{c.title}</h2>
            <p className="text-sm text-ink-soft dark:text-ink-faint">{c.sub}</p>
          </div>
          <button className="text-2xl text-ink-faint w-8 h-8" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        {!picks ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {c.moods.map((m) => (
                <button
                  key={m.value}
                  onClick={() => toggle(m.value)}
                  className={`rounded-2xl px-3 py-3 text-left border-2 transition-all duration-200 ${
                    moods.includes(m.value)
                      ? "border-brand-400 bg-brand-50 dark:bg-brand-500/15"
                      : "border-black/[0.06] dark:border-white/10 bg-white dark:bg-white/5 hover:-translate-y-0.5"
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <p className="font-bold text-sm text-ink dark:text-white mt-1">{m.label}</p>
                </button>
              ))}
            </div>

            <div>
              <p className="text-sm font-bold text-ink-soft dark:text-ink-faint mb-1.5">{c.custom}</p>
              <input
                className="input"
                placeholder={c.placeholder}
                value={free}
                maxLength={120}
                onChange={(e) => setFree(e.target.value)}
              />
            </div>

            <button className="btn-primary w-full" onClick={() => void find()} disabled={loading}>
              {loading ? c.finding : c.find}
            </button>
          </>
        ) : (
          <>
            <p className="font-display font-bold text-lg text-ink dark:text-white">{c.resultTitle}</p>
            <div className="space-y-2">
              {picks.map((p, i) => {
                const b = bookById(p.id);
                if (!b) return null;
                return (
                  <button
                    key={p.id}
                    onClick={() => onPick(p.id)}
                    className={`w-full text-left card p-3 flex items-center gap-3 hover:-translate-y-0.5 transition-all ${
                      i === 0 ? "ring-2 ring-brand-400" : ""
                    }`}
                  >
                    <div className="w-14 h-14 rounded-2xl grid place-items-center text-3xl bg-brand-50 dark:bg-brand-500/15 shrink-0">
                      {b.coverEmoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-ink dark:text-white truncate">
                        {i === 0 && "⭐ "}{b.title}
                      </p>
                      <p className="text-xs text-ink-faint">{p.reason}</p>
                    </div>
                    <span className="chip chip-on !py-1 !px-3 text-xs shrink-0">{c.read}</span>
                  </button>
                );
              })}
            </div>
            <button className="btn-ghost w-full" onClick={() => setPicks(null)}>{c.again}</button>
          </>
        )}
      </div>
    </div>
  );
}
