import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import sproutScout from "@/assets/avatars/sprout-scout.webp";
import { UploadBookDialog } from "@/components/UploadBookDialog";
import { useToast } from "@/components/Toast";
import { ArrowLeft, ChevronRight, Plus, Sparkles, Trash2, Trophy, BookOpen, Download, Shirt, Gift, Calculator, Swords, Layers } from "lucide-react";
import { BookGuideDialog } from "@/components/BookGuideDialog";
import { RewardsPanel } from "@/components/RewardsPanel";
import { AvatarShop } from "@/components/AvatarShop";
import { RewardsStore } from "@/components/RewardsStore";
import { Leaderboard } from "@/components/Leaderboard";
import { CardCollection } from "@/components/CardCollection";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { StreakBadge } from "@/components/StreakBadge";
import {
  AGE_BANDS, BAND_LABEL, BAND_HINT, bandForAge, bandForBook, fitFor,
  pickBlockReason, PICK_BLOCK_MESSAGE, type AgeBand,
} from "@/lib/readingLevel";
import { installStarterLibrary, STARTER_COUNT } from "@/lib/starterLibrary";

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
  const [installing, setInstalling] = useState(false);
  /** Book just added via the guide — pulled to the top and highlighted. */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [bandFilter, setBandFilter] = useState<AgeBand | "all">("all");
  /** Открываем категорию ребёнка при первой загрузке профиля. */
  const bandInitedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!user) return;
    const next = await getBooks(user.uid, language);
    setBooks(next);
    return next;
  }, [user, language]);

  useEffect(() => {
    if (!user || !profileId) return;
    void getProfile(user.uid, profileId).then((p) => {
      setProfile(p);
      if (p) {
        setLanguage(p.defaultLanguage);
        // Первый раз показываем категорию ребёнка, дальше не мешаем выбору.
        if (!bandInitedRef.current) {
          bandInitedRef.current = true;
          setBandFilter(bandForAge(p.age));
        }
      }
    });
  }, [user, profileId]);

  useEffect(() => { setBooks(null); void reload(); }, [reload]);

  // Books can be added from the guide or another tab; refresh on return.
  useEffect(() => {
    const onFocus = () => { void reload(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [reload]);

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

  /**
   * Книги, обогащённые возрастной категорией и признаком блокировки.
   * Категория считается из текста, потому что поля ageMin/ageMax в старых
   * книгах захардкожены и не отражают реальную сложность.
   */
  const decorated = useMemo(() => {
    if (!books || !profile) return null;
    return books.map((book) => {
      const band = bandForBook(book);
      return {
        book,
        band,
        fit: fitFor(profile.age, band),
        block: pickBlockReason(profile.age, band, profile.lastBookFit),
      };
    });
  }, [books, profile]);

  const visible = useMemo(() => {
    if (!decorated) return null;
    return bandFilter === "all" ? decorated : decorated.filter((d) => d.band === bandFilter);
  }, [decorated, bandFilter]);
  const avgWpm = profile && profile.totalMs > 3000
    ? Math.round(profile.totalWords / (profile.totalMs / 60000)) : 0;

  if (!user || !profile) {
    return <div className="min-h-dvh grid place-items-center text-ink-faint">Загрузка…</div>;
  }

  const addStarter = async () => {
    if (!user || installing) return;
    setInstalling(true);
    try {
      const n = await installStarterLibrary(user.uid);
      toast({ icon: "📚", title: "Библиотека загружена!", description: `Добавлено ${n} сказок` });
      reload();
    } catch {
      toast({ icon: "⚠️", title: "Не удалось загрузить", description: "Проверьте соединение и попробуйте снова" });
    } finally {
      setInstalling(false);
    }
  };

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
    <main className="library-shell min-h-dvh mx-auto">
      <header className="bookser-toolbar grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="justify-self-start">
          <button className="btn-ghost !py-2 !px-3" onClick={() => navigate("/profiles")} aria-label="Назад">
            <ArrowLeft className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>
        <div className="justify-self-center flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 font-display font-bold text-ink dark:text-white min-w-0">
            <ProfileAvatar value={profile.avatar} size={30} />
            <span className="truncate">{profile.name}</span>
          </div>
          <StreakBadge streak={profile.streak ?? 0} lastReadDay={profile.lastReadDay} />
        </div>
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </header>

      <div className="library-title animate-fade-up">
        <p className="eyebrow mb-1">Библиотека</p>
        <h1 className="font-display font-extrabold text-3xl text-ink dark:text-white">Выбери сказку</h1>
      </div>

      <div className="library-layout">
        <nav className="library-activities" aria-label="Занятия и награды">
          <button className="chip chip-off shrink-0" onClick={() => setShowRating(true)}>
            <Trophy className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.4} />Рейтинг
          </button>
          <button className="chip chip-off shrink-0"
            onClick={() => navigate(`/arena?profile=${profile.id}`)}>
            <Swords className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.4} />Матч
          </button>
          <button className="chip chip-off shrink-0"
            onClick={() => navigate(`/math?profile=${profile.id}`)}>
            <Calculator className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.4} />Математика
          </button>
          <button className="chip chip-off shrink-0" onClick={() => setShowRewards(true)}>
            <Gift className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.4} />Хотелки
          </button>
          <button className="chip chip-off shrink-0" onClick={() => setShowShop(true)}>
            <Shirt className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.4} />Герои
          </button>
          <button className="chip chip-off shrink-0" onClick={() => setShowProgress(true)}>
            <Trophy className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.4} />Успехи
          </button>
        </nav>
        <section className="library-shelf" aria-label="Книжная полка">
          <button
            onClick={() => setShowGuide(true)}
            className="library-guide"
          >
            <img src={sproutScout} width={64} height={64} alt="" />
            <span className="min-w-0">
              <span className="block font-display font-extrabold text-lg leading-tight">Подобрать книгу</span>
              <span className="block text-sm guide-description">Найду то, что тебе понравится</span>
            </span>
            <ChevronRight className="ml-auto w-6 h-6 shrink-0" strokeWidth={2.4} />
          </button>

          <div className="shelf-filter" role="group" aria-label="Язык книг">
            {LANGUAGES.map((l) => (
              <button key={l.value} aria-pressed={language === l.value} onClick={() => setLanguage(l.value)}
                className={`chip shrink-0 ${language === l.value ? "chip-on" : "chip-off"}`}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>

          {/* Возрастные категории. По умолчанию открыта категория ребёнка —
              так он сразу видит подходящее, а не весь список вперемешку. */}
          <div className="shelf-filter age-filter" role="group" aria-label="Возраст читателя">
            <span className="text-xs font-bold text-ink-faint shrink-0 mr-0.5">Возраст</span>
            <button
              onClick={() => setBandFilter("all")} aria-pressed={bandFilter === "all"}
              className={`chip shrink-0 ${bandFilter === "all" ? "chip-on" : "chip-off"}`}
            >
              Все
            </button>
            {AGE_BANDS.map((b) => {
              const isMine = b === bandForAge(profile.age);
              return (
                <button
                  key={b}
                  onClick={() => setBandFilter(b)} aria-pressed={bandFilter === b}
                  className={`chip shrink-0 ${bandFilter === b ? "chip-on" : "chip-off"}`}
                >
                  {BAND_LABEL[b].ru}
                  {isMine && <span className="ml-1 text-[10px] opacity-70">твой</span>}
                </button>
              );
            })}
          </div>

          <div className="shelf-books grid gap-4">
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
            {/* Книги есть, но в выбранной категории пусто. Частый случай для
                малышей: готовые сказки в основном для 6–7 лет и старше. */}
            {books && books.length > 0 && visible && visible.length === 0 && (
              <div className="card p-8 text-center col-span-full space-y-4">
                <BookOpen className="w-12 h-12 mx-auto text-brand-400" strokeWidth={1.8} />
                <div>
                  <p className="font-display font-bold text-lg text-ink dark:text-white">
                    В категории «{bandFilter === "all" ? "" : BAND_LABEL[bandFilter as AgeBand].ru}» пока нет книг
                  </p>
                  <p className="text-sm text-ink-faint mt-1">
                    Можно подобрать сказку под этот возраст — она сгенерируется специально
                    для {profile.name}.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost flex-1" onClick={() => setBandFilter("all")}>
                    Показать все
                  </button>
                  <button className="btn-primary flex-1" onClick={() => setShowGuide(true)}>
                    <Sparkles className="w-5 h-5 inline -mt-0.5 mr-1.5" strokeWidth={2.4} />
                    Подобрать книгу
                  </button>
                </div>
              </div>
            )}

            {books?.length === 0 && (
              <div className="card p-8 text-center col-span-full space-y-4">
                <BookOpen className="w-12 h-12 mx-auto text-brand-400" strokeWidth={1.8} />
                <div>
                  <p className="font-display font-bold text-lg text-ink dark:text-white">Здесь пока пусто</p>
                  <p className="text-sm text-ink-faint mt-1">
                    Загрузи {STARTER_COUNT} готовых сказок на русском, казахском и английском
                  </p>
                </div>
                <button
                  className="btn-primary w-full"
                  disabled={installing}
                  onClick={() => void addStarter()}
                >
                  {installing ? "Загружаю…" : <><Download className="w-5 h-5 inline -mt-0.5 mr-1.5" strokeWidth={2.4} />Загрузить {STARTER_COUNT} сказок</>}
                </button>
                <p className="text-xs text-ink-faint">или добавь свою книгу кнопкой ниже</p>
              </div>
            )}
            {(highlightId && visible
                ? [...visible].sort((a, b) =>
                    a.book.id === highlightId ? -1 : b.book.id === highlightId ? 1 : 0)
                : visible
              )?.map(({ book, band, fit, block }, i) => {
              const prog = progressByBook.get(book.id);
              const pct = prog?.open ? Math.round((prog.open.currentPage / book.pages.length) * 100) : 0;
              const openBook = () => {
                if (block) {
                  toast({ icon: "📘", title: "Сначала книга по возрасту", description: PICK_BLOCK_MESSAGE[block].ru });
                  return;
                }
                navigate(`/read/${book.id}?profile=${profile.id}`);
              };
              return (
                <div
                  key={book.id}
                  data-book-id={book.id}
                  className={`card p-4 flex items-center gap-4 transition-all duration-200 animate-fade-up ${
                    block ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-lift"
                  } ${book.id === highlightId ? "ring-2 ring-brand-400 shadow-lift" : ""}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <button className="flex items-center gap-4 flex-1 min-w-0 text-left" onClick={openBook}>
                    <div className={`w-20 h-20 rounded-2xl grid place-items-center text-4xl shrink-0 shadow-soft bg-gradient-to-br ${gradients[i % gradients.length]}`}>
                      {book.coverUrl
                        ? <img src={book.coverUrl} alt="" className="w-full h-full object-cover rounded-2xl" loading="lazy" />
                        : book.coverEmoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-display font-bold text-ink dark:text-white truncate">{book.title}</p>
                        {book.id === highlightId && (
                          <span className="shrink-0 rounded-full bg-brand-500 text-white text-[10px] font-extrabold px-2 py-0.5">
                            НОВАЯ
                          </span>
                        )}
                        {prog?.completed && <span className="text-amber-500">⭐</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {/* Возрастная категория книги — считается из текста */}
                        <span
                          className={`rounded-full text-[10px] font-extrabold px-2 py-0.5 ${
                            fit === "below"
                              ? "bg-black/[0.06] dark:bg-white/10 text-ink-faint"
                              : fit === "above"
                                ? "bg-brand-500/12 text-brand-600 dark:text-brand-300"
                                : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {BAND_LABEL[band].ru}
                        </span>
                        {fit === "below" && (
                          <span className="text-[10px] text-ink-faint">{BAND_HINT[band].ru}</span>
                        )}
                        {fit === "above" && (
                          <span className="text-[10px] text-brand-500 font-bold">вызов</span>
                        )}
                      </div>
                      <p className="text-xs text-ink-faint mt-0.5">
                        {book.totalWords} слов · {book.pages.length} стр.
                        {book.isCustom && " · своя"}
                      </p>
                      {block && (
                        <p className="text-[11px] text-ink-faint mt-1 leading-snug">
                          🔒 Сначала прочитай книгу по возрасту
                        </p>
                      )}
                      {pct > 0 && !prog?.completed && (
                        <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </button>
                  {book.isCustom && (
                    <button className="text-ink-faint hover:text-red-500 p-2 shrink-0" onClick={() => void handleDelete(book)} aria-label="Удалить"><Trash2 className="w-4 h-4" strokeWidth={2.2} /></button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            className="w-full mt-4 rounded-3xl border-2 border-dashed border-brand-300 bg-brand-50/50 dark:bg-brand-500/10 text-brand-500 font-display font-bold py-4 hover:-translate-y-0.5 transition-all"
            onClick={() => setShowUpload(true)}
          >
            <Plus className="w-5 h-5 inline -mt-0.5 mr-1" strokeWidth={2.6} />Добавить свою книгу
          </button>
        </section>
      </div>

      <CardCollection
        open={showCards}
        owned={profile.cards ?? []}
        language={language}
        onClose={() => setShowCards(false)}
      />

      <Leaderboard
        open={showRating}
        currentProfileId={profile.id}
        onClose={() => setShowRating(false)}
      />

      <RewardsStore
        open={showRewards}
        uid={user.uid}
        profile={profile}
        onClose={() => setShowRewards(false)}
      />

      <AvatarShop
        open={showShop}
        uid={user.uid}
        profile={profile}
        language={language}
        onClose={() => setShowShop(false)}
        onChanged={() => { void getProfile(user.uid, profileId).then(setProfile); }}
      />

      <UploadBookDialog uid={user.uid} open={showUpload} onClose={() => setShowUpload(false)} onCreated={reload} />

      {showGuide && (
        <BookGuideDialog
          open
          uid={user.uid}
          books={books ?? []}
          profile={profile}
          language={language}
          readIds={completedSessions.map((s) => s.bookId)}
          readTitles={completedSessions.map((s) => s.bookTitle)}
          onClose={() => setShowGuide(false)}
          onPick={(bookId) => {
            setShowGuide(false);
            navigate(`/read/${bookId}?profile=${profile.id}`);
          }}
          onBookAdded={async (bookId, bookLanguage) => {
            // Stay in the library so the child actually sees the new book
            // appear, instead of being thrown straight into the reader.
            setShowGuide(false);
            if (bookLanguage !== language) {
              setLanguage(bookLanguage); // triggers reload via the effect
            } else {
              await reload();
            }
            setHighlightId(bookId);
            toast({ icon: "📚", title: "Книга добавлена в библиотеку" });
            // Bring it into view once the list has painted.
            requestAnimationFrame(() => {
              document
                .querySelector(`[data-book-id="${bookId}"]`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
            window.setTimeout(() => setHighlightId(null), 6000);
          }}
        />
      )}

      {showProgress && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowProgress(false)}>
          <div className="sheet max-w-lg max-h-[92vh] overflow-y-auto space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ProfileAvatar value={profile.avatar} size={38} />
                <div>
                  <h2 className="font-display font-extrabold text-xl text-ink dark:text-white leading-none">Мои успехи</h2>
                  <p className="text-sm text-ink-faint">{profile.name}</p>
                </div>
              </div>
              <button className="text-2xl text-ink-faint w-8 h-8" onClick={() => setShowProgress(false)} aria-label="Закрыть">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                { v: profile.booksCompleted, l: "книг", bg: "from-violet-100 to-fuchsia-100 dark:from-violet-500/15 dark:to-fuchsia-500/10" },
                { v: fmtDuration(profile.totalMs), l: "времени", bg: "from-sky-100 to-blue-100 dark:from-sky-500/15 dark:to-blue-500/10" },
                { v: avgWpm, l: "сл/мин", bg: "from-emerald-100 to-teal-100 dark:from-emerald-500/15 dark:to-teal-500/10" },
                { v: profile.coins ?? 0, l: "монет", bg: "from-amber-100 to-yellow-100 dark:from-amber-500/15 dark:to-yellow-500/10" },
              ].map((s, i) => (
                <div key={i} className={`rounded-2xl p-4 bg-gradient-to-br ${s.bg}`}>
                  <p className="font-display font-extrabold text-xl text-ink dark:text-white leading-tight">{s.v}</p>
                  <p className="text-xs text-ink-soft dark:text-ink-faint mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            <RewardsPanel language={language} coins={profile.coins ?? 0} />

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
    </main>
  );
}
