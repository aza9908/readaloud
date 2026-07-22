import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteCustomBook, getAchievements, getBooks, getProfile, getSessions,
} from "@/lib/firestore";
import { badgeById } from "@/lib/achievements";
import {
  LANGUAGES, type Achievement, type Book, type ChildProfile, type Language, type ReadingSession,
} from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UploadBookDialog } from "@/components/UploadBookDialog";
import { useToast } from "@/components/Toast";
import { BookGuideDialog } from "@/components/BookGuideDialog";

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} мин ${s % 60} сек` : `${s} сек`;
}

export default function LibraryPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const toast = useToast();
  const profileId = new URLSearchParams(search).get("profile") ?? "";

  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [language, setLanguage] = useState<Language>("ru");
  const [books, setBooks] = useState<Book[] | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showProgress, setShowProgress] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const reload = useCallback(() => {
    if (!user) return;
    void getBooks(user.uid, language).then(setBooks);
  }, [user, language]);

  useEffect(() => {
    if (!user || !profileId) return;
    void getProfile(user.uid, profileId).then((p) => {
      setProfile(p);
      if (p) setLanguage(p.defaultLanguage);
    });
  }, [user, profileId]);

  useEffect(() => { setBooks(null); reload(); }, [reload]);

  useEffect(() => {
    if (!user || !profileId) return;
    void getSessions(user.uid, profileId).then(setSessions);
    void getAchievements(user.uid, profileId).then(setAchievements);
  }, [user, profileId, showProgress]);

  const progressByBook = useMemo(() => {
    const map = new Map<string, { completed: boolean; open?: ReadingSession }>();
    for (const s of sessions) {
      const cur = map.get(s.bookId) ?? { completed: false };
      if (s.completed) cur.completed = true;
      else if (!cur.open || s.updatedAt > cur.open.updatedAt) cur.open = s;
      map.set(s.bookId, cur);
    }
    return map;
  }, [sessions]);

  const completedSessions = sessions.filter((s) => s.completed);
  const avgWpm = profile && profile.totalMs > 3000
    ? Math.round(profile.totalWords / (profile.totalMs / 60000)) : 0;

  if (!user || !profile) {
    return <div className="min-h-dvh grid place-items-center text-ink-faint">Загрузка…</div>;
  }

  const handleDelete = async (book: Book) => {
    if (!confirm(`Удалить «${book.title}»?`)) return;
    await deleteCustomBook(book.id);
    toast({ icon: "🗑️", title: "Книга удалена" });
    reload();
  };

  const gradients = [
    "from-rose-200 to-orange-200", "from-sky-200 to-indigo-200",
    "from-emerald-200 to-teal-200", "from-violet-200 to-fuchsia-200",
    "from-amber-200 to-yellow-200", "from-cyan-200 to-blue-200",
  ];

  return (
    <div className="min-h-dvh px-5 py-5 max-w-3xl mx-auto pb-28">
      <header className="flex items-center justify-between mb-6">
        <button className="btn-ghost !py-2 !px-3" onClick={() => navigate("/profiles")} aria-label="Назад">←</button>
        <div className="flex items-center gap-2 font-display font-bold text-ink dark:text-white">
          <span className="text-2xl">{profile.avatar}</span> {profile.name}
        </div>
        <ThemeToggle />
      </header>

      <div className="mb-5 animate-fade-up">
        <p className="eyebrow mb-1">Библиотека</p>
        <h1 className="font-display font-extrabold text-3xl text-ink dark:text-white">Выбери сказку</h1>
      </div>

      <button
        onClick={() => setShowGuide(true)}
        className="w-full mb-5 rounded-3xl p-4 flex items-center gap-3 text-left bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift hover:-translate-y-0.5 transition-all animate-fade-up"
      >
        <span className="w-12 h-12 rounded-2xl bg-white/20 grid place-items-center text-2xl shrink-0">✨</span>
        <span className="min-w-0">
          <span className="block font-display font-extrabold text-lg leading-tight">Подобрать книгу</span>
          <span className="block text-sm text-white/80">Найду то, что тебе понравится</span>
        </span>
        <span className="ml-auto text-2xl">›</span>
      </button>

      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {LANGUAGES.map((l) => (
          <button key={l.value} onClick={() => setLanguage(l.value)}
            className={`chip shrink-0 ${language === l.value ? "chip-on" : "chip-off"}`}>
            {l.flag} {l.label}
          </button>
        ))}
        <button className="chip chip-off shrink-0 ml-auto" onClick={() => setShowProgress(true)}>
          🏆 Успехи
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {books === null && (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 flex gap-4 animate-pulse">
              <div className="w-20 h-20 rounded-2xl bg-black/5 dark:bg-white/5" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-4 w-2/3 rounded bg-black/5 dark:bg-white/5" />
                <div className="h-3 w-1/2 rounded bg-black/5 dark:bg-white/5" />
              </div>
            </div>
          ))
        )}
        {books?.length === 0 && (
          <div className="card p-8 text-center sm:col-span-2">
            <div className="text-4xl mb-2">📚</div>
            <p className="font-display font-bold text-ink dark:text-white">Здесь пока пусто</p>
            <p className="text-sm text-ink-faint mt-1">Добавь свою книгу кнопкой ниже</p>
          </div>
        )}
        {books?.map((book, i) => {
          const prog = progressByBook.get(book.id);
          const pct = prog?.open ? Math.round((prog.open.currentPage / book.pages.length) * 100) : 0;
          return (
            <div key={book.id} className="card p-4 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-lift transition-all duration-200 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <button className="flex items-center gap-4 flex-1 min-w-0 text-left" onClick={() => navigate(`/read/${book.id}?profile=${profile.id}`)}>
                <div className={`w-20 h-20 rounded-2xl grid place-items-center text-4xl shrink-0 shadow-soft bg-gradient-to-br ${gradients[i % gradients.length]}`}>
                  {book.coverUrl
                    ? <img src={book.coverUrl} alt="" className="w-full h-full object-cover rounded-2xl" loading="lazy" />
                    : book.coverEmoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display font-bold text-ink dark:text-white truncate">{book.title}</p>
                    {prog?.completed && <span className="text-amber-500">⭐</span>}
                  </div>
                  <p className="text-xs text-ink-faint mt-0.5">
                    {book.totalWords} слов · {book.pages.length} стр.
                    {book.isCustom && " · своя"}
                  </p>
                  {pct > 0 && !prog?.completed && (
                    <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              </button>
              {book.isCustom && (
                <button className="text-ink-faint hover:text-red-500 p-2 shrink-0" onClick={() => void handleDelete(book)} aria-label="Удалить">🗑</button>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="w-full mt-4 rounded-3xl border-2 border-dashed border-brand-300 bg-brand-50/50 dark:bg-brand-500/10 text-brand-500 font-display font-bold py-4 hover:-translate-y-0.5 transition-all"
        onClick={() => setShowUpload(true)}
      >
        ＋ Добавить свою книгу
      </button>

      <UploadBookDialog uid={user.uid} open={showUpload} onClose={() => setShowUpload(false)} onCreated={reload} />

      {showGuide && books && books.length > 0 && (
        <BookGuideDialog
          open
          books={books}
          profile={profile}
          language={language}
          readIds={completedSessions.map((s) => s.bookId)}
          readTitles={completedSessions.map((s) => s.bookTitle)}
          onClose={() => setShowGuide(false)}
          onPick={(bookId) => {
            setShowGuide(false);
            navigate(`/read/${bookId}?profile=${profile.id}`);
          }}
        />
      )}

      {showProgress && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowProgress(false)}>
          <div className="sheet max-w-lg max-h-[92vh] overflow-y-auto space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{profile.avatar}</span>
                <div>
                  <h2 className="font-display font-extrabold text-xl text-ink dark:text-white leading-none">Мои успехи</h2>
                  <p className="text-sm text-ink-faint">{profile.name}</p>
                </div>
              </div>
              <button className="text-2xl text-ink-faint w-8 h-8" onClick={() => setShowProgress(false)} aria-label="Закрыть">×</button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { v: profile.booksCompleted, l: "книг", bg: "from-violet-100 to-fuchsia-100 dark:from-violet-500/15 dark:to-fuchsia-500/10" },
                { v: fmtDuration(profile.totalMs), l: "времени", bg: "from-sky-100 to-blue-100 dark:from-sky-500/15 dark:to-blue-500/10" },
                { v: avgWpm, l: "сл/мин", bg: "from-emerald-100 to-teal-100 dark:from-emerald-500/15 dark:to-teal-500/10" },
              ].map((s, i) => (
                <div key={i} className={`rounded-2xl p-4 bg-gradient-to-br ${s.bg}`}>
                  <p className="font-display font-extrabold text-xl text-ink dark:text-white leading-tight">{s.v}</p>
                  <p className="text-xs text-ink-soft dark:text-ink-faint mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="font-display font-bold text-ink dark:text-white mb-2">Книги по языкам</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {LANGUAGES.map((l) => (
                  <div key={l.value} className="rounded-2xl bg-black/[0.03] dark:bg-white/5 p-3">
                    <p className="text-xl">{l.flag}</p>
                    <p className="font-display font-extrabold text-lg text-ink dark:text-white">{profile.byLanguage?.[l.value]?.books ?? 0}</p>
                    <p className="text-xs text-ink-faint">{l.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-display font-bold text-ink dark:text-white mb-2">🏆 Награды</p>
              {achievements.length === 0
                ? <p className="text-sm text-ink-faint">Пока нет наград. Начни читать!</p>
                : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {achievements.sort((a, b) => b.earnedAt - a.earnedAt).map((a) => {
                      const def = badgeById(a.id); if (!def) return null;
                      return (
                        <div key={a.id} className="rounded-2xl border-2 border-amber-400/30 bg-amber-50/50 dark:bg-amber-500/5 p-3 flex items-center gap-3">
                          <span className="text-2xl">{def.icon}</span>
                          <div>
                            <p className="font-display font-bold text-sm text-ink dark:text-white leading-tight">{def.title}</p>
                            <p className="text-xs text-ink-faint">{def.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>

            {completedSessions.length > 0 && (
              <div>
                <p className="font-display font-bold text-ink dark:text-white mb-2">📖 Прочитано</p>
                <div className="space-y-2">
                  {completedSessions.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-black/5 dark:border-white/5 p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-ink dark:text-white">
                          {LANGUAGES.find((l) => l.value === s.language)?.flag} {s.bookTitle}
                        </p>
                        <p className="text-xs text-ink-faint">{s.wordsRead} слов · {fmtDuration(s.durationMs)}</p>
                      </div>
                      <span className="text-amber-500 text-xl">⭐</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
