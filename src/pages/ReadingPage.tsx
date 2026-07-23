import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  completeSession,
  findOpenSession,
  getBook,
  getProfile,
  saveSessionProgress,
  startSession,
} from "@/lib/firestore";
import { checkAndAwardBadges } from "@/lib/achievements";
import { SPEECH_LANG_TAGS, type Book, type ChildProfile } from "@/lib/types";
import { useSpeechReader, type ProgressSnapshot } from "@/hooks/useSpeechReader";
import { KaraokeText } from "@/components/KaraokeText";
import { Fireworks } from "@/components/Fireworks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/Toast";
import { CoinCounter } from "@/components/CoinCounter";
import { CurrentWord } from "@/components/CurrentWord";
import { StoryScene } from "@/components/StoryScene";
import { ArrowLeft, Bookmark, Ear, Mic, Pause, SkipForward, RotateCcw } from "lucide-react";
import { BOOK_COMPLETION_BONUS } from "@/lib/firestore";
import { RetellDialog } from "@/components/RetellDialog";
import { QuizDialog } from "@/components/QuizDialog";

const AUTOSAVE_MS = 15_000; // READ-10
/**
 * Retelling (пересказ) checkpoints.
 * Books here are short (3-8 pages), so a fixed "every 3 pages" rule never
 * fired on a 3-page book (page 3 is the last page and goes straight to the
 * finish). Instead: one checkpoint at the midpoint of short books, then
 * every 3 pages for longer ones. Never on the final page.
 */
function retellCheckpoints(totalPages: number): Set<number> {
  const marks = new Set<number>();
  if (totalPages < 3) return marks;              // too short to interrupt
  if (totalPages <= 4) {
    marks.add(Math.floor(totalPages / 2) - 1);   // midpoint (0-based page just read)
    return marks;
  }
  for (let p = 2; p < totalPages - 1; p += 3) marks.add(p);
  return marks;
}

/**
 * Memoized so the 1-second progress tick never repaints the illustration.
 * Remote images (Wikisource / Commons) can fail or be missing, so a broken
 * image never leaves a gap — the block simply disappears.
 */
const PageIllustration = memo(function PageIllustration({
  src, fallbackTitle, fallbackEmoji,
}: {
  src: string | null;
  /** When there is no photo, a scene is drawn from these. */
  fallbackTitle?: string;
  fallbackEmoji?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setFailed(false); setLoaded(false); }, [src]);

  // No image (or it failed): draw a scene so the page still has a picture.
  if ((!src || failed) && fallbackTitle) {
    return (
      <figure className="mb-5 overflow-hidden rounded-3xl shadow-soft">
        <StoryScene
          title={fallbackTitle}
          emoji={fallbackEmoji ?? "📖"}
          className="w-full block aspect-[400/220]"
          dark={document.documentElement.classList.contains("dark")}
        />
      </figure>
    );
  }
  if (!src || failed) return null;
  return (
    <figure className="mb-5 overflow-hidden rounded-3xl bg-black/[0.03] dark:bg-white/5 shadow-soft grid place-items-center aspect-[400/220]">
      <img
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-contain transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </figure>
  );
});

/**
 * The entire reading surface (illustration + word spans), frozen behind memo.
 * The parent ReadingPage re-renders ~1×/sec to update the progress header,
 * but this subtree only re-renders when the page actually turns (words change)
 * or the font size changes — so the per-second tick does ZERO work here.
 */
const ReadingSurface = memo(
  function ReadingSurface({
    illustrationSrc,
    sceneTitle,
    sceneEmoji,
    words,
    paragraphSizes,
    registerWordEl,
    fontSizePx,
  }: {
    illustrationSrc: string | null;
    sceneTitle?: string;
    sceneEmoji?: string;
    words: string[];
    paragraphSizes: number[];
    registerWordEl: (index: number, el: HTMLElement | null) => void;
    fontSizePx: number;
  }) {
    return (
      <main className="flex-1 px-4 pt-5 pb-64 max-w-2xl mx-auto w-full">
        <PageIllustration src={illustrationSrc} fallbackTitle={sceneTitle} fallbackEmoji={sceneEmoji} />
        <div className="reading-canvas rounded-3xl px-6 py-7 text-ink dark:text-[#e8e5f2]">
          <KaraokeText
            words={words}
            paragraphSizes={paragraphSizes}
            registerWordEl={registerWordEl}
            fontSizePx={fontSizePx}
          />
        </div>
      </main>
    );
  },
  (prev, next) =>
    prev.words === next.words &&
    prev.fontSizePx === next.fontSizePx &&
    prev.illustrationSrc === next.illustrationSrc &&
    prev.sceneTitle === next.sceneTitle,
);

function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ReadingPage() {
  const { user } = useAuth();
  const [, params] = useRoute("/read/:bookId");
  const search = useSearch();
  const [, navigate] = useLocation();
  const toast = useToast();

  const bookId = params?.bookId ?? "";
  const profileId = new URLSearchParams(search).get("profile") ?? "";

  const [book, setBook] = useState<Book | null>(null);
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [fontSizePx, setFontSizePx] = useState(18);
  const [resumePrompt, setResumePrompt] = useState<{
    page: number;
    wordIndex: number;
    wordsRead: number;
    durationMs: number;
  } | null>(null);
  const [finished, setFinished] = useState(false);
  const [retellFor, setRetellFor] = useState<{ from: number; to: number } | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [coins, setCoins] = useState(0);
  const baseCoinsRef = useRef(0);

  /* ── Session bookkeeping (base + delta model) ──
   * base*Ref   — totals carried over from PREVIOUS visits (restored session)
   * saved*Ref  — totals already written to Firestore (session doc + aggregates)
   * The hook's wordsRead / elapsedMs accumulate across pages within THIS visit,
   * so totals are always: base + hookValue.                                    */
  const baseWordsRef = useRef(0);
  const baseMsRef = useRef(0);
  const savedWordsRef = useRef(0);
  const savedMsRef = useRef(0);
  const lastAutosaveRef = useRef(0);
  const latestSnapRef = useRef<ProgressSnapshot>({
    currentIndex: 0,
    wordsRead: 0,
    elapsedMs: 0,
    wpm: 0,
  });
  /** Words on pages already completed this visit — for the progress bar. */
  const wordsBeforePageRef = useRef(0);
  const profileBeforeRef = useRef<ChildProfile | null>(null);
  const retellMarksRef = useRef<Set<number>>(new Set());
  const lastRetellPageRef = useRef(0);
  const restoreRef = useRef<{ wordIndex: number } | null>(null);

  // ── Load book, profile, and any open session ──
  useEffect(() => {
    if (!user || !bookId || !profileId) return;
    let cancelled = false;
    void (async () => {
      const [b, p, open] = await Promise.all([
        getBook(bookId),
        getProfile(user.uid, profileId),
        findOpenSession(user.uid, profileId, bookId),
      ]);
      if (cancelled) return;
      setBook(b);
      setProfile(p);
      if (p) { baseCoinsRef.current = p.coins ?? 0; setCoins(p.coins ?? 0); }
      if (b) retellMarksRef.current = retellCheckpoints(b.pages.length);
      profileBeforeRef.current = p;
      if (open) {
        setSessionId(open.id);
        savedWordsRef.current = open.wordsRead;
        savedMsRef.current = open.durationMs;
        if (open.wordsRead > 0) {
          setResumePrompt({
            page: open.currentPage,
            wordIndex: open.currentWordIndex,
            wordsRead: open.wordsRead,
            durationMs: open.durationMs,
          });
        }
      } else if (b && p) {
        const id = await startSession(user.uid, profileId, b);
        if (!cancelled) setSessionId(id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, bookId, profileId]);

  // ── Derive words + paragraph sizes for the current page ──
  const pageContent = book?.pages[pageIndex] ?? "";
  const { words, paragraphSizes } = useMemo(() => {
    const paras = pageContent.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const perPara = paras.map((p) => p.split(/\s+/).filter(Boolean));
    return { words: perPara.flat(), paragraphSizes: perPara.map((w) => w.length) };
  }, [pageContent]);

  // ── Persistence: throttled autosave + incremental aggregates ──
  const pageIndexRef = useRef(pageIndex);
  pageIndexRef.current = pageIndex;

  const persist = useCallback(
    (s: ProgressSnapshot, force = false) => {
      if (!user || !sessionId) return;
      const now = Date.now();
      if (!force && now - lastAutosaveRef.current < AUTOSAVE_MS) return;
      lastAutosaveRef.current = now;

      const totalWords = baseWordsRef.current + s.wordsRead;
      const totalMs = baseMsRef.current + s.elapsedMs;
      const deltaWords = Math.max(0, totalWords - savedWordsRef.current);
      const deltaMs = Math.max(0, totalMs - savedMsRef.current);
      savedWordsRef.current = Math.max(totalWords, savedWordsRef.current);
      savedMsRef.current = Math.max(totalMs, savedMsRef.current);

      // Fire-and-forget; on failure allow an earlier retry (PRD §9).
      void saveSessionProgress(
        user.uid,
        profileId,
        sessionId,
        {
          currentPage: pageIndexRef.current,
          currentWordIndex: s.currentIndex,
          wordsRead: savedWordsRef.current,
          durationMs: savedMsRef.current,
          wpm: s.wpm,
        },
        { words: deltaWords, ms: deltaMs },
      ).catch(() => {
        lastAutosaveRef.current = 0;
      });
    },
    [user, sessionId, profileId],
  );

  const handleProgress = useCallback(
    (s: ProgressSnapshot) => {
      latestSnapRef.current = s;
      // 1 coin per word read this session, on top of what the child already had.
      setCoins(baseCoinsRef.current + baseWordsRef.current + s.wordsRead);
      persist(s);
    },
    [persist],
  );

  // ── Page / book completion ──
  const finishBook = useCallback(() => {
    setFinished(true);
    // Comprehension questions after a short celebration beat.
    window.setTimeout(() => setShowQuiz(true), 2600);
    void (async () => {
      if (!user || !sessionId || !book || !profile) return;
      persist(latestSnapRef.current, true); // final flush
      await completeSession(
        user.uid,
        profileId,
        sessionId,
        book.language,
        savedMsRef.current,
      );
      const before = profileBeforeRef.current ?? profile;
      setCoins((c) => c + BOOK_COMPLETION_BONUS);
      const fresh = await checkAndAwardBadges(user.uid, profileId, before, {
        wordsThisSession: savedWordsRef.current,
        msThisSession: savedMsRef.current,
        booksJustCompleted: 1,
      });
      fresh.forEach((b, i) =>
        setTimeout(
          () => toast({ icon: b.icon, title: b.title, description: b.description }),
          800 + i * 1200,
        ),
      );
    })();
  }, [user, sessionId, book, profile, profileId, persist, toast]);

  const finishBookRef = useRef(finishBook);
  finishBookRef.current = finishBook;
  const wordsLenRef = useRef(words.length);
  wordsLenRef.current = words.length;
  const pagesLenRef = useRef(book?.pages.length ?? 0);
  pagesLenRef.current = book?.pages.length ?? 0;

  const handlePageComplete = useCallback(() => {
    wordsBeforePageRef.current += wordsLenRef.current;
    const justFinished = pageIndexRef.current; // 0-based index of the page read
    const isLastPage = justFinished + 1 >= pagesLenRef.current;

    if (isLastPage) {
      finishBookRef.current();
      return;
    }

    // Retelling checkpoint (пересказ after a chunk of pages).
    if (retellMarksRef.current.has(justFinished)) {
      readerRef.current?.pause();
      setRetellFor({ from: lastRetellPageRef.current, to: justFinished });
      lastRetellPageRef.current = justFinished + 1;
      return; // page advances when the child continues
    }

    setPageIndex((i) => i + 1); // READ-05
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const reader = useSpeechReader({
    words,
    lang: SPEECH_LANG_TAGS[book?.language ?? "ru"],
    onPageComplete: handlePageComplete,
    onProgress: handleProgress,
  });
  const readerRef = useRef(reader);
  readerRef.current = reader;

  // Stop the mic once the book is finished.
  useEffect(() => {
    if (finished) readerRef.current.pause();
  }, [finished]);

  // Restore saved position after resume choice (READ-09).
  useEffect(() => {
    if (restoreRef.current && words.length > 0) {
      readerRef.current.seek(restoreRef.current.wordIndex);
      restoreRef.current = null;
    }
  }, [words]);

  if (!book || !profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-slate-400">
        Загрузка…
      </div>
    );
  }

  const totalBookWords = book.totalWords || 1;
  const progressPct = Math.min(
    100,
    Math.round(
      ((baseWordsRef.current -
        (restoreRef.current?.wordIndex ?? 0) +
        wordsBeforePageRef.current +
        reader.currentIndex) /
        totalBookWords) *
        100,
    ),
  );

  const resume = (fromSaved: boolean) => {
    if (!resumePrompt) return;
    if (fromSaved) {
      baseWordsRef.current = resumePrompt.wordsRead;
      baseMsRef.current = resumePrompt.durationMs;
      // For the progress bar: words on pages BEFORE the restored page.
      wordsBeforePageRef.current = Math.max(
        0,
        resumePrompt.wordsRead - resumePrompt.wordIndex,
      );
      // The hook will re-count from the restored word, so subtract it from base
      // to avoid double counting within the restored page.
      baseWordsRef.current = Math.max(
        0,
        resumePrompt.wordsRead - resumePrompt.wordIndex,
      );
      restoreRef.current = { wordIndex: resumePrompt.wordIndex };
      if (resumePrompt.page !== pageIndex) {
        setPageIndex(resumePrompt.page);
      } else {
        readerRef.current.seek(resumePrompt.wordIndex);
        restoreRef.current = null;
      }
    } else {
      baseWordsRef.current = 0;
      baseMsRef.current = 0;
      wordsBeforePageRef.current = 0;
      setPageIndex(0);
      readerRef.current.seek(0);
    }
    setResumePrompt(null);
  };

  const stopAndExit = () => {
    readerRef.current.pause();
    persist(latestSnapRef.current, true); // READ-08: flush before leaving
    navigate(`/library?profile=${profileId}`);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header — updates ≤1×/sec, cheap */}
      <header className="sticky top-0 z-20 bg-[var(--canvas)]/90 backdrop-blur-md px-4 pt-3 pb-2.5 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
          <button className="w-9 h-9 rounded-2xl grid place-items-center bg-white/70 dark:bg-white/10 shadow-soft text-lg" onClick={stopAndExit} aria-label="Назад"><ArrowLeft className="w-5 h-5 text-ink dark:text-white" strokeWidth={2.4} /></button>
          <div className="min-w-0 text-center flex-1">
            <p className="font-display font-bold truncate text-ink dark:text-white leading-tight">{book.title}</p>
            <p className="text-[11px] text-ink-faint">Страница {pageIndex + 1} из {book.pages.length}</p>
          </div>
          <div className="flex items-center gap-1">
            <CoinCounter coins={coins} />
            <button className="w-8 h-8 rounded-xl bg-white/70 dark:bg-white/10 shadow-soft font-bold text-ink dark:text-white" onClick={() => setFontSizePx((s) => Math.max(16, s - 2))} aria-label="Меньше">A−</button>
            <button className="w-8 h-8 rounded-xl bg-white/70 dark:bg-white/10 shadow-soft font-bold text-ink dark:text-white text-sm" onClick={() => setFontSizePx((s) => Math.min(30, s + 2))} aria-label="Больше">A+</button>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-ink-faint mb-1">
            <span>{progressPct}% прочитано</span>
            <span>{fmtClock(baseMsRef.current + reader.elapsedMs)} · {reader.wpm} сл/мин</span>
          </div>
          <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      <ReadingSurface
        illustrationSrc={book.pageImages?.[pageIndex] ?? (pageIndex === 0 ? book.coverUrl : null)}
        sceneTitle={pageIndex === 0 ? book.title : undefined}
        sceneEmoji={book.coverEmoji}
        words={words}
        paragraphSizes={paragraphSizes}
        registerWordEl={reader.registerWordEl}
        fontSizePx={fontSizePx}
      />

      {/* Controls */}
      <footer className="fixed bottom-0 inset-x-0 z-20 px-4 pt-6 pb-4 bg-gradient-to-t from-[var(--canvas)] via-[var(--canvas)]/95 to-transparent">
        <div className="max-w-2xl mx-auto space-y-2.5">
          {reader.isListening && (
            <div className="rounded-3xl border-2 border-brand-300/50 bg-white/90 dark:bg-[#221d31]/90 backdrop-blur shadow-card p-4 flex items-center justify-between gap-3 animate-fade-up">
              <div className="min-w-0 flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-brand-500/10 grid place-items-center shrink-0"><Ear className="w-5 h-5 text-brand-500" strokeWidth={2.2} /></span>
                <div className="min-w-0">
                  <p className="eyebrow">Прочитай вслух</p>
                  <CurrentWord words={words} subscribeCursor={reader.subscribeCursor} />
                </div>
              </div>
              <button className="btn-ghost shrink-0 !py-2.5 !px-4 text-sm" onClick={reader.skipWord}>
                Пропустить <SkipForward className="w-4 h-4 inline -mt-0.5 ml-0.5" strokeWidth={2.4} />
              </button>
            </div>
          )}

          {!finished &&
            (reader.isListening ? (
              <button className="btn-ghost w-full !py-3.5 font-display font-bold" onClick={reader.pause}>
                <Pause className="w-5 h-5 inline -mt-0.5 mr-1.5" strokeWidth={2.4} />Пауза
              </button>
            ) : (
              <button className="btn-primary w-full !py-4" onClick={reader.start} disabled={!reader.isSupported}>
                <Mic className="w-5 h-5 inline -mt-1 mr-2" strokeWidth={2.4} />{reader.wordsRead > 0 || baseMsRef.current > 0 ? "Продолжить чтение" : "Читать вслух"}
              </button>
            ))}

          {!finished && !reader.isListening && (
            <button className="w-full text-center text-sm font-bold text-ink-faint py-2 hover:text-ink-soft transition-colors" onClick={stopAndExit}>
              <Bookmark className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.4} />Остановиться и продолжить позже
            </button>
          )}

          {!reader.isSupported && (
            <p className="text-center text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-2xl px-4 py-3">
              Распознавание речи недоступно в этом браузере. Откройте в Chrome или Edge.
            </p>
          )}
        </div>
      </footer>

      {/* READ-09: resume dialog */}
      {resumePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="sheet max-w-sm text-center space-y-4">
            <div className="text-5xl">📖</div>
            <h2 className="font-display font-extrabold text-2xl text-ink dark:text-white">Продолжить чтение?</h2>
            <p className="text-sm text-ink-soft dark:text-ink-faint">
              Ты остановился на{" "}
              <span className="text-brand-500 font-extrabold">
                {Math.min(99, Math.round((resumePrompt.wordsRead / totalBookWords) * 100))}%
              </span>{" "}
              книги
            </p>
            <div className="rounded-2xl bg-black/[0.03] dark:bg-white/5 p-4 grid grid-cols-2 gap-2">
              <div>
                <p className="font-display font-extrabold text-2xl text-ink dark:text-white">{resumePrompt.wordsRead}</p>
                <p className="text-xs text-ink-faint">слов прочитано</p>
              </div>
              <div>
                <p className="font-display font-extrabold text-2xl text-ink dark:text-white">{fmtClock(resumePrompt.durationMs)}</p>
                <p className="text-xs text-ink-faint">времени</p>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => resume(true)}>Продолжить</button>
            <button className="btn-ghost w-full" onClick={() => resume(false)}><RotateCcw className="w-4 h-4 inline -mt-0.5 mr-1.5" strokeWidth={2.4} />Начать сначала</button>
          </div>
        </div>
      )}

      {/* Пересказ checkpoint after each chunk of pages */}
      {retellFor && book && (
        <RetellDialog
          open
          chunkText={book.pages.slice(retellFor.from, retellFor.to + 1).join("\n\n")}
          language={book.language}
          age={profile?.age ?? 8}
          onContinue={() => {
            setRetellFor(null);
            setPageIndex((i) => Math.min(i + 1, book.pages.length - 1));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* Comprehension questions after the book */}
      {showQuiz && book && (
        <QuizDialog
          open
          title={book.title}
          text={book.pages.join("\n\n")}
          language={book.language}
          age={profile?.age ?? 8}
          onClose={() => {
            setShowQuiz(false);
            navigate(`/library?profile=${profileId}`);
          }}
        />
      )}

      {/* GAME-01: completion */}
      {finished && (
        <>
          <Fireworks />
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto sheet max-w-sm text-center space-y-4 !shadow-lift animate-pop">
              <div className="text-6xl animate-float">🎉</div>
              <h2 className="font-display font-extrabold text-3xl text-ink dark:text-white">Молодец, {profile.name}!</h2>
              <p className="text-ink-soft dark:text-ink-faint">
                Книга «{book.title}» прочитана — {savedWordsRef.current} слов!
              </p>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-400/15 border border-amber-400/30 px-4 py-2">
                <span className="text-2xl">🪙</span>
                <span className="font-display font-extrabold text-lg text-amber-600 dark:text-amber-400">
                  +{savedWordsRef.current + BOOK_COMPLETION_BONUS} монет
                </span>
              </div>
              <p className="text-xs text-ink-faint leading-relaxed px-2">
                Монеты можно обменять на настоящий приз или деньги — договорись с родителями,
                сколько стоит одна монета.
              </p>
              <button className="btn-primary w-full" onClick={() => navigate(`/library?profile=${profileId}`)}>
                📚 К другим сказкам
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
