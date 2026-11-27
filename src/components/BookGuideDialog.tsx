import { BookJacket } from "@/components/BookJacket";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BookserIcon } from "@/components/BookserIcon";
import { RoomSheet, CloseButton } from "@/components/RoomControls";
/**
 * BookGuideDialog — a short questionnaire that learns what the child is in
 * the mood for, then recommends books ranked by taste, length, challenge,
 * age fit and novelty.
 *
 * Flow: 4 questions, one per screen → results.
 */

import { useState, type ReactNode } from "react";
import { recommendBook, type BookPick } from "@/lib/ai";
import { BookDiscovery } from "@/components/BookDiscovery";
import type { Book, ChildProfile, Language } from "@/lib/types";

export type LengthPref = "short" | "medium" | "long";
export type ChallengePref = "easy" | "normal" | "hard";

const COPY = {
  ru: {
    eyebrow: "Книжный помощник",
    q1: "Что тебе интереснее всего?",
    q1sub: "Можно выбрать несколько",
    ownTopic: "Или напиши свою тему",
    ownPlaceholder: "например: про динозавров",
    addTopic: "Добавить",
    q2: "Какую историю хочешь?",
    q3: "Насколько сложно?",
    q4: "Что-то ещё? (необязательно)",
    q4placeholder: "Например: про дружбу и приключения в лесу",
    next: "Дальше",
    back: "Назад",
    find: "Подобрать книгу",
    finding: "Подбираю…",
    resultTitle: "Вот что тебе подойдёт",
    best: "Лучший выбор",
    read: "Читать",
    again: "Подобрать заново",
    empty: "В библиотеке пока нет книг — сначала добавь сказки.",
    lengths: [
      { v: "short" as LengthPref, emoji: "⚡", label: "Покороче", sub: "прочитаю быстро" },
      { v: "medium" as LengthPref, emoji: "📗", label: "Обычную", sub: "как всегда" },
      { v: "long" as LengthPref, emoji: "📚", label: "Подлиннее", sub: "люблю читать" },
    ],
    levels: [
      { v: "easy" as ChallengePref, emoji: "🙂", label: "Полегче", sub: "простые слова" },
      { v: "normal" as ChallengePref, emoji: "😀", label: "Как обычно", sub: "мой уровень" },
      { v: "hard" as ChallengePref, emoji: "💪", label: "Посложнее", sub: "хочу вызов" },
    ],
    topics: [
      { emoji: "🐾", label: "Животные", value: "животные звери лес" },
      { emoji: "🏰", label: "Волшебство", value: "волшебство сказка магия" },
      { emoji: "🚀", label: "Приключения", value: "приключения путешествие" },
      { emoji: "😄", label: "Смешное", value: "смешное весёлое хитрость" },
      { emoji: "👫", label: "Дружба", value: "дружба друзья помощь" },
      { emoji: "🦸", label: "Про героев", value: "герой батыр смелость" },
      { emoji: "🌳", label: "Природа", value: "природа сад деревья цветы" },
      { emoji: "🌟", label: "Космос", value: "космос звёзды планеты ракета" },
      { emoji: "🌊", label: "Море", value: "море океан рыбы вода" },
      { emoji: "🏫", label: "Школа", value: "школа класс учитель урок" },
      { emoji: "⚽", label: "Спорт", value: "спорт футбол игра медаль" },
      { emoji: "🍰", label: "Еда", value: "еда кухня пирог готовить" },
      { emoji: "🔍", label: "Загадки", value: "тайна загадка детектив" },
      { emoji: "🏠", label: "Семья", value: "семья мама папа брат сестра" },
    ],
  },
  kk: {
    eyebrow: "Кітап көмекшісі",
    q1: "Саған не қызық?",
    q1sub: "Бірнешеуін таңдауға болады",
    ownTopic: "Немесе өз тақырыбыңды жаз",
    ownPlaceholder: "мысалы: динозавр туралы",
    addTopic: "Қосу",
    q2: "Қандай әңгіме керек?",
    q3: "Қаншалықты қиын?",
    q4: "Тағы бірдеңе? (міндетті емес)",
    q4placeholder: "Мысалы: достық пен орманда болған оқиға",
    next: "Әрі қарай",
    back: "Артқа",
    find: "Кітап табу",
    finding: "Іздеп жатырмын…",
    resultTitle: "Саған мынау жарайды",
    best: "Ең жақсы таңдау",
    read: "Оқу",
    again: "Қайта табу",
    empty: "Кітапханада кітап жоқ — алдымен ертегілерді қос.",
    lengths: [
      { v: "short" as LengthPref, emoji: "⚡", label: "Қысқасы", sub: "тез оқимын" },
      { v: "medium" as LengthPref, emoji: "📗", label: "Орташа", sub: "әдеттегідей" },
      { v: "long" as LengthPref, emoji: "📚", label: "Ұзынырақ", sub: "оқыған ұнайды" },
    ],
    levels: [
      { v: "easy" as ChallengePref, emoji: "🙂", label: "Жеңілірек", sub: "қарапайым сөздер" },
      { v: "normal" as ChallengePref, emoji: "😀", label: "Әдеттегідей", sub: "менің деңгейім" },
      { v: "hard" as ChallengePref, emoji: "💪", label: "Қиынырақ", sub: "сынақ керек" },
    ],
    topics: [
      { emoji: "🐾", label: "Жануарлар", value: "жануарлар аңдар орман" },
      { emoji: "🏰", label: "Сиқыр", value: "сиқыр ертегі" },
      { emoji: "🚀", label: "Оқиға", value: "оқиға саяхат" },
      { emoji: "😄", label: "Күлкілі", value: "күлкілі қулық" },
      { emoji: "👫", label: "Достық", value: "достық көмек" },
      { emoji: "🦸", label: "Батырлар", value: "батыр ерлік" },
      { emoji: "🌳", label: "Табиғат", value: "табиғат бақ ағаш гүл" },
      { emoji: "🌟", label: "Ғарыш", value: "ғарыш жұлдыз планета зымыран" },
      { emoji: "🌊", label: "Теңіз", value: "теңіз мұхит балық су" },
      { emoji: "🏫", label: "Мектеп", value: "мектеп сынып мұғалім сабақ" },
      { emoji: "⚽", label: "Спорт", value: "спорт футбол ойын медаль" },
      { emoji: "🍰", label: "Тағам", value: "тағам ас бәліш пісіру" },
      { emoji: "🔍", label: "Жұмбақ", value: "құпия жұмбақ детектив" },
      { emoji: "🏠", label: "Отбасы", value: "отбасы ана әке аға апа" },
    ],
  },
  en: {
    eyebrow: "Book helper",
    q1: "What sounds most interesting?",
    q1sub: "Pick as many as you like",
    ownTopic: "Or type your own topic",
    ownPlaceholder: "for example: dinosaurs",
    addTopic: "Add",
    q2: "How long a story?",
    q3: "How hard should it be?",
    q4: "Anything else? (optional)",
    q4placeholder: "For example: friendship and forest adventures",
    next: "Next",
    back: "Back",
    find: "Find my book",
    finding: "Finding…",
    resultTitle: "Here's what suits you",
    best: "Best match",
    read: "Read",
    again: "Start over",
    empty: "No books in the library yet — add the stories first.",
    lengths: [
      { v: "short" as LengthPref, emoji: "⚡", label: "Short", sub: "a quick read" },
      { v: "medium" as LengthPref, emoji: "📗", label: "Normal", sub: "as usual" },
      { v: "long" as LengthPref, emoji: "📚", label: "Longer", sub: "I love reading" },
    ],
    levels: [
      { v: "easy" as ChallengePref, emoji: "🙂", label: "Easier", sub: "simple words" },
      { v: "normal" as ChallengePref, emoji: "😀", label: "Just right", sub: "my level" },
      { v: "hard" as ChallengePref, emoji: "💪", label: "Harder", sub: "challenge me" },
    ],
    topics: [
      { emoji: "🐾", label: "Animals", value: "animals forest creatures" },
      { emoji: "🏰", label: "Magic", value: "magic fairy tale dragons" },
      { emoji: "🚀", label: "Adventure", value: "adventure travel journey" },
      { emoji: "😄", label: "Funny", value: "funny silly clever" },
      { emoji: "👫", label: "Friendship", value: "friendship friends helping" },
      { emoji: "🦸", label: "Heroes", value: "hero brave courage" },
      { emoji: "🌳", label: "Nature", value: "nature garden trees flowers" },
      { emoji: "🌟", label: "Space", value: "space stars planets rocket" },
      { emoji: "🌊", label: "Sea", value: "sea ocean fish water" },
      { emoji: "🏫", label: "School", value: "school class teacher lesson" },
      { emoji: "⚽", label: "Sport", value: "sport football game medal" },
      { emoji: "🍰", label: "Food", value: "food kitchen cake baking" },
      { emoji: "🔍", label: "Mystery", value: "mystery secret detective" },
      { emoji: "🏠", label: "Family", value: "family mom dad brother sister" },
    ],
  },
} as const;

const TOTAL_STEPS = 4;

interface Props {
  open: boolean;
  uid: string;
  books: Book[];
  profile: ChildProfile;
  language: Language;
  readIds: string[];
  readTitles: string[];
  onClose: () => void;
  /** Existing library book chosen → open it for reading. */
  onPick: (bookId: string) => void;
  /** A new book was fetched/generated and saved → show it in the library. */
  onBookAdded: (bookId: string, language: Language) => void;
}

export function BookGuideDialog({
  open, uid, books, profile, language, readIds, readTitles, onClose, onPick, onBookAdded,
}: Props) {
  const c = COPY[language] ?? COPY.ru;

  const [step, setStep] = useState(0);
  const [topics, setTopics] = useState<string[]>([]);
  const [lengthPref, setLengthPref] = useState<LengthPref | null>(null);
  const [challenge, setChallenge] = useState<ChallengePref | null>(null);
  const [free, setFree] = useState("");
  const [ownTopic, setOwnTopic] = useState("");
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [picks, setPicks] = useState<BookPick[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const addOwnTopic = () => {
    const v = ownTopic.trim();
    if (!v) return;
    if (!customTopics.includes(v)) setCustomTopics((t) => [...t, v]);
    setTopics((t) => (t.includes(v) ? t : [...t, v]));
    setOwnTopic("");
  };

  const toggleTopic = (v: string) =>
    setTopics((t) => (t.includes(v) ? t.filter((x) => x !== v) : [...t, v]));

  const chosenTopics = [...topics, free].filter(Boolean).join(", ");

  const find = async () => {
    setLoading(true);
    try {
      const preferences = chosenTopics;
      const r = await recommendBook({
        books, age: profile.age, language, preferences, readTitles, readIds,
        lengthPref: lengthPref ?? "medium",
        challenge: challenge ?? "normal",
      });
      setPicks(r.picks);
    } finally {
      setLoading(false);
    }
  };

  const bookById = (id: string) => books.find((b) => b.id === id);

  // Empty-library guard — the previous version silently did nothing here.
  if (books.length === 0) {
    return (
      <Shell eyebrow={c.eyebrow} onClose={onClose}>
        <div className="py-4 text-center space-y-2">
          <div className="text-5xl"><BookserIcon value="book" size={58} /></div>
          <p className="text-ink-soft dark:text-ink-faint">{c.empty}</p>
        </div>
        <BookDiscovery
          topics={topics.join(", ") || "сказка"}
          prompt={free}
          language={language}
          profile={profile}
          uid={uid}
          onAdded={(bookId) => onBookAdded(bookId, language)}
        />
      </Shell>
    );
  }

  if (picks) {
    return (
      <Shell eyebrow={c.eyebrow} onClose={onClose}>
        <p className="font-display font-bold text-lg text-ink dark:text-white mb-2">{c.resultTitle}</p>
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
                <BookJacket book={b} />
                <div className="min-w-0 flex-1">
                  {i === 0 && <p className="eyebrow !text-[10px] mb-0.5">{c.best}</p>}
                  <p className="font-display font-bold text-ink dark:text-white truncate">{b.title}</p>
                  <p className="text-xs text-ink-faint">{p.reason}</p>
                </div>
                <span className="chip chip-on !py-1 !px-3 text-xs shrink-0">{c.read}</span>
              </button>
            );
          })}
        </div>
        <button className="btn-ghost w-full mt-3" onClick={() => { setPicks(null); setStep(0); }}>
          {c.again}
        </button>

        <BookDiscovery
          topics={topics.join(", ")}
          prompt={free}
          language={language}
          profile={profile}
          uid={uid}
          onAdded={(bookId) => onBookAdded(bookId, language)}
        />
      </Shell>
    );
  }

  const canAdvance =
    (step === 0 && topics.length > 0) ||
    (step === 1 && lengthPref !== null) ||
    (step === 2 && challenge !== null) ||
    step === 3;

  return (
    <Shell eyebrow={c.eyebrow} onClose={onClose}>
      <div className="flex items-center gap-1.5 mb-4">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
            i <= step ? "bg-brand-500" : "bg-black/[0.08] dark:bg-white/10"
          }`} />
        ))}
      </div>

      {step === 0 && (
        <div className="animate-fade-up">
          <h3 className="font-display font-extrabold text-xl text-ink dark:text-white">{c.q1}</h3>
          <p className="text-sm text-ink-faint mb-3">{c.q1sub}</p>
          <div className="grid grid-cols-2 gap-2">
            {[...c.topics, ...customTopics.map((v) => ({ emoji: "⭐", label: v, value: v }))].map((t) => (
              <button
                key={t.value}
                aria-pressed={topics.includes(t.value)} onClick={() => toggleTopic(t.value)}
                className={`rounded-2xl px-3 py-3 text-left border-2 transition-all duration-200 ${
                  topics.includes(t.value)
                    ? "border-brand-400 bg-brand-50 dark:bg-brand-500/15"
                    : "border-black/[0.06] dark:border-white/10 bg-white dark:bg-white/5 hover:-translate-y-0.5"
                }`}
              >
                <span className="text-2xl"><BookserIcon value={t.emoji} size={30} /></span>
                <p className="font-bold text-sm text-ink dark:text-white mt-1">{t.label}</p>
              </button>
            ))}
          </div>

          <div className="mt-3">
            <p className="text-sm font-bold text-ink-soft dark:text-ink-faint mb-1.5">{c.ownTopic}</p>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder={c.ownPlaceholder}
                value={ownTopic}
                maxLength={40}
                onChange={(e) => setOwnTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addOwnTopic(); }}
              />
              <button className="btn-ghost shrink-0" onClick={addOwnTopic} disabled={!ownTopic.trim()}>
                {c.addTopic}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <StepList
          title={c.q2}
          items={c.lengths}
          selected={lengthPref}
          onSelect={(v) => setLengthPref(v as LengthPref)}
        />
      )}

      {step === 2 && (
        <StepList
          title={c.q3}
          items={c.levels}
          selected={challenge}
          onSelect={(v) => setChallenge(v as ChallengePref)}
        />
      )}

      {step === 3 && (
        <div className="animate-fade-up">
          <h3 className="font-display font-extrabold text-xl text-ink dark:text-white mb-3">{c.q4}</h3>
          <input
            className="input"
            placeholder={c.q4placeholder}
            value={free}
            maxLength={120}
            onChange={(e) => setFree(e.target.value)}
          />
        </div>
      )}

      <div className="flex gap-2 mt-5">
        {step > 0 && (
          <button className="btn-ghost flex-1" onClick={() => setStep((s) => s - 1)}><ChevronLeft size={16} aria-hidden="true" />{c.back}</button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button className="btn-primary flex-1" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
            {c.next}<ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <button className="btn-primary flex-1" onClick={() => void find()} disabled={loading}>
            {loading ? c.finding : c.find}
          </button>
        )}
      </div>
    </Shell>
  );
}

function StepList({
  title, items, selected, onSelect,
}: {
  title: string;
  items: readonly { v: string; emoji: string; label: string; sub: string }[];
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="animate-fade-up">
      <h3 className="font-display font-extrabold text-xl text-ink dark:text-white mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((l) => (
          <button
            key={l.v}
            aria-pressed={selected === l.v} onClick={() => onSelect(l.v)}
            className={`w-full rounded-2xl px-4 py-3 flex items-center gap-3 border-2 text-left transition-all duration-200 ${
              selected === l.v
                ? "border-brand-400 bg-brand-50 dark:bg-brand-500/15"
                : "border-black/[0.06] dark:border-white/10 bg-white dark:bg-white/5 hover:-translate-y-0.5"
            }`}
          >
            <span className="text-2xl"><BookserIcon value={l.v === "long" ? "library" : l.emoji} size={36} /></span>
            <span>
              <span className="block font-bold text-ink dark:text-white">{l.label}</span>
              <span className="block text-xs text-ink-faint">{l.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Shell({
  eyebrow, onClose, children,
}: {
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <RoomSheet returnFocus=".library-guide" title={eyebrow} onClose={onClose} className="guide-sheet">
        <div className="flex items-start justify-between mb-3">
          <p className="eyebrow"><BookserIcon value="✨" size={16} line /> {eyebrow}</p>
          <CloseButton onClick={onClose} />
        </div>
        {children}
    </RoomSheet>
  );
}
