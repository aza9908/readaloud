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

const AUTOSAVE_MS = 15_000; // READ-10

/** Memoized so the 1-second progress tick never repaints the illustration. */
const PageIllustration = memo(function PageIllustration({ src }: { src: string | null }) {
  if (!src) return null;
  return <img src={src} alt="" className="w-full rounded-2xl mb-6" decoding="async" />;
});

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
      persist(s);
    },
    [persist],
  );

  // ── Page / book completion ──
  const finishBook = useCallback(() => {
    setFinished(true);
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
    if (pageIndexRef.current + 1 < pagesLenRef.current) {
      setPageIndex((i) => i + 1); // READ-05
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      finishBookRef.current();
    }
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
      <header className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <button className="text-2xl p-1" onClick={stopAndExit} aria-label="Назад">←</button>
          <div className="min-w-0 text-center">
            <p className="font-bold truncate text-slate-900 dark:text-white">{book.title}</p>
            <p className="text-xs text-slate-500">Страница {pageIndex + 1} из {book.pages.length}</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm font-bold" onClick={() => setFontSizePx((s) => Math.max(14, s - 2))} aria-label="Меньше шрифт">−</button>
            <span className="text-sm w-6 text-center text-slate-500">{fontSizePx}</span>
            <button className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm font-bold" onClick={() => setFontSizePx((s) => Math.min(28, s + 2))} aria-label="Больше шрифт">+</button>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
          <span>{progressPct}% прочитано</span>
          <span>{fmtClock(baseMsRef.current + reader.elapsedMs)} • {reader.wpm} сл/мин</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-56 max-w-2xl mx-auto w-full">
        <PageIllustration src={book.coverUrl && pageIndex === 0 ? book.coverUrl : null} />
        <KaraokeText
          words={words}
          paragraphSizes={paragraphSizes}
          registerWordEl={reader.registerWordEl}
          fontSizePx={fontSizePx}
        />
      </main>

      {/* Controls */}
      <footer className="fixed bottom-0 inset-x-0 z-20 p-4 space-y-2 bg-gradient-to-t from-slate-50 via-slate-50/95 dark:from-slate-900 dark:via-slate-900/95 to-transparent">
        <div className="max-w-2xl mx-auto space-y-2">
          {reader.isListening && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary-soft/70 dark:bg-primary/10 backdrop-blur p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-primary/70 tracking-wide">☝️ ПРОЧИТАЙ ВСЛУХ:</p>
                <p className="text-3xl font-extrabold text-primary truncate">
                  {reader.currentWord.toLowerCase().replace(/[^\p{L}\p{N}-]+$/gu, "")}
                </p>
              </div>
              <button className="btn-outline shrink-0" onClick={reader.skipWord}>
                ⏭ Пропустить
              </button>
            </div>
          )}

          {!finished &&
            (reader.isListening ? (
              <button className="btn-outline w-full py-3" onClick={reader.pause}>⏸ Пауза</button>
            ) : (
              <button className="btn-primary w-full py-4 text-lg" onClick={reader.start} disabled={!reader.isSupported}>
                🎤 {reader.wordsRead > 0 || baseMsRef.current > 0 ? "Продолжить чтение" : "Читать вслух"}
              </button>
            ))}

          {!finished && !reader.isListening && (
            <button className="w-full py-3 rounded-2xl bg-white dark:bg-slate-800 shadow-sm font-semibold text-slate-700 dark:text-slate-200" onClick={stopAndExit}>
              🔖 Стоп, продолжу позже
            </button>
          )}

          {!reader.isSupported && (
            <p className="text-center text-sm text-red-500">
              Браузер не поддерживает распознавание речи — откройте в Chrome или Edge.
            </p>
          )}
        </div>
      </footer>

      {/* READ-09: resume dialog */}
      {resumePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-800 p-6 text-center space-y-4">
            <div className="text-4xl">📖</div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Продолжить чтение?</h2>
            <p className="text-sm text-slate-500">
              Ты остановился на{" "}
              <span className="text-primary font-bold">
                {Math.min(99, Math.round((resumePrompt.wordsRead / totalBookWords) * 100))}%
              </span>{" "}
              от книги
            </p>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">{resumePrompt.wordsRead}</p>
                <p className="text-xs text-slate-500">Слов прочитано</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">{fmtClock(resumePrompt.durationMs)}</p>
                <p className="text-xs text-slate-500">Времени потрачено</p>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => resume(true)}>🔖 Продолжить с места остановки</button>
            <button className="btn-outline w-full" onClick={() => resume(false)}>↺ Начать сначала</button>
          </div>
        </div>
      )}

      {/* GAME-01: completion */}
      {finished && (
        <>
          <Fireworks />
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm rounded-3xl bg-white dark:bg-slate-800 p-6 text-center space-y-4 shadow-2xl">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Молодец, {profile.name}!</h2>
              <p className="text-slate-500">
                Ты прочитал «{book.title}» — {savedWordsRef.current} слов!
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
