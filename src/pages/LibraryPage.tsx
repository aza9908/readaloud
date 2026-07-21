import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteCustomBook,
  getAchievements,
  getBooks,
  getProfile,
  getSessions,
} from "@/lib/firestore";
import { badgeById } from "@/lib/achievements";
import {
  LANGUAGES,
  type Achievement,
  type Book,
  type ChildProfile,
  type Language,
  type ReadingSession,
} from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UploadBookDialog } from "@/components/UploadBookDialog";
import { useToast } from "@/components/Toast";

function fmtDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  return `${Math.floor(totalSec / 60)} мин ${totalSec % 60} сек`;
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

  useEffect(reload, [reload]);

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
  const avgWpm =
    profile && profile.totalMs > 3000
      ? Math.round(profile.totalWords / (profile.totalMs / 60000))
      : 0;

  if (!user || !profile) {
    return <div className="min-h-dvh flex items-center justify-center text-slate-400">Загрузка…</div>;
  }

  const handleDelete = async (book: Book) => {
    if (!confirm(`Удалить «${book.title}»?`)) return;
    await deleteCustomBook(book.id);
    toast({ icon: "🗑️", title: "Книга удалена" });
    reload();
  };

  return (
    <div className="min-h-dvh px-4 py-4 max-w-3xl mx-auto pb-24">
      <header className="flex items-center justify-between mb-4">
        <button className="text-2xl p-1" onClick={() => navigate("/profiles")} aria-label="Назад">←</button>
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <span className="text-2xl">{profile.avatar}</span> {profile.name}
        </div>
        <ThemeToggle />
      </header>

      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Выбери сказку</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-4">Выбери книгу и читай вслух!</p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            onClick={() => setLanguage(l.value)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              language === l.value
                ? "bg-primary text-white"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm"
            }`}
          >
            {l.flag} {l.label}
          </button>
        ))}
        <button className="ml-auto btn-outline text-sm" onClick={() => setShowProgress(true)}>
          🏆 Мой прогресс
        </button>
      </div>

      <button
        className="w-full mb-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-soft/40 dark:bg-primary/10 text-primary font-semibold py-3"
        onClick={() => setShowUpload(true)}
      >
        ＋ Добавить свою книгу
      </button>

      <div className="space-y-3">
        {books === null && <p className="text-center text-slate-400 py-8">Загрузка книг…</p>}
        {books?.length === 0 && (
          <p className="text-center text-slate-400 py-8">
            На этом языке пока нет книг — добавьте свою!
          </p>
        )}
        {books?.map((book) => {
          const prog = progressByBook.get(book.id);
          const pct = prog?.open
            ? Math.round((prog.open.currentPage / book.pages.length) * 100)
            : 0;
          return (
            <div key={book.id} className="card flex items-center gap-4 p-3">
              <button
                className="flex items-center gap-4 flex-1 min-w-0 text-left"
                onClick={() => navigate(`/read/${book.id}?profile=${profile.id}`)}
              >
                <div className="w-16 h-16 rounded-xl bg-primary-soft dark:bg-primary/20 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    book.coverEmoji
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white truncate">
                    {book.title} {prog?.completed && "⭐"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {book.totalWords} слов · {book.pages.length} стр. · ≈{book.estimatedMinutes} мин
                    {book.isCustom && " · своя книга"}
                  </p>
                  {pct > 0 && !prog?.completed && (
                    <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </button>
              {book.isCustom && (
                <button
                  className="text-slate-400 hover:text-red-500 p-2"
                  onClick={() => void handleDelete(book)}
                  aria-label="Удалить книгу"
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>

      <UploadBookDialog
        uid={user.uid}
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onCreated={reload}
      />

      {/* LIB-05: progress modal */}
      {showProgress && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setShowProgress(false)}>
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-800 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                🏆 Мои успехи <span className="text-base font-semibold text-slate-500">{profile.avatar} {profile.name}</span>
              </h2>
              <button className="text-2xl text-slate-400 p-1" onClick={() => setShowProgress(false)} aria-label="Закрыть">×</button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-purple-50 dark:bg-purple-500/10 p-3">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{profile.booksCompleted}</p>
                <p className="text-xs text-slate-500">Книг</p>
              </div>
              <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 p-3">
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">{fmtDuration(profile.totalMs)}</p>
                <p className="text-xs text-slate-500">Время</p>
              </div>
              <div className="rounded-2xl bg-green-50 dark:bg-green-500/10 p-3">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{avgWpm}</p>
                <p className="text-xs text-slate-500">сл/мин</p>
              </div>
            </div>

            <div>
              <p className="font-bold text-slate-900 dark:text-white mb-2">Книги по языкам</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {LANGUAGES.map((l) => (
                  <div key={l.value} className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-3">
                    <p className="text-lg">{l.flag}</p>
                    <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                      {profile.byLanguage?.[l.value]?.books ?? 0}
                    </p>
                    <p className="text-xs text-slate-500">{l.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-bold text-slate-900 dark:text-white mb-2">🏆 Мои награды</p>
              {achievements.length === 0 && (
                <p className="text-sm text-slate-400">Пока нет наград. Начни читать!</p>
              )}
              <div className="grid sm:grid-cols-2 gap-2">
                {achievements
                  .sort((a, b) => b.earnedAt - a.earnedAt)
                  .map((a) => {
                    const def = badgeById(a.id);
                    if (!def) return null;
                    return (
                      <div key={a.id} className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 p-3 flex items-center gap-3">
                        <span className="text-2xl">{def.icon}</span>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{def.title}</p>
                          <p className="text-xs text-slate-500">{def.description}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div>
              <p className="font-bold text-slate-900 dark:text-white mb-2">📖 Прочитанные книги</p>
              {completedSessions.length === 0 && (
                <p className="text-sm text-slate-400">Пока нет прочитанных книг</p>
              )}
              <div className="space-y-2">
                {completedSessions.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {LANGUAGES.find((l) => l.value === s.language)?.flag} {s.bookTitle}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.wordsRead} слов · {fmtDuration(s.durationMs)}
                      </p>
                    </div>
                    <span className="text-amber-400 text-xl">⭐</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
