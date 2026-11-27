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
import { useSttEscalation } from "@/hooks/useSttEscalation";
import { KaraokeText } from "@/components/KaraokeText";
import { Fireworks } from "@/components/Fireworks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/Toast";
import { CoinCounter } from "@/components/CoinCounter";
import { CurrentWord } from "@/components/CurrentWord";
import { StoryScene } from "@/components/StoryScene";
import { ArrowLeft, Bookmark, Ear, Mic, Pause, SkipForward, RotateCcw, Share2 } from "lucide-react";
import { updateStreakAndHardWords, awardPage, grantCard } from "@/lib/firestore";
import { bandForBook } from "@/lib/readingLevel";
import { AWARD_EXPLANATION, goldenWordIndexes, COMPREHENSION_BONUS, type PageAwardResult } from "@/lib/coins";
import { drawCard, CARDS } from "@/lib/cards";
import { CardReveal } from "@/components/CardCollection";
import { successFeedback } from "@/lib/haptics";
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
    goldenWords,
  }: {
    illustrationSrc: string | null;
    sceneTitle?: string;
    sceneEmoji?: string;
    words: string[];
    paragraphSizes: number[];
    registerWordEl: (index: number, el: HTMLElement | null) => void;
    fontSizePx: number;
    goldenWords?: Set<number>;
  }) {
    return (
      <main className="reader-page flex-1">
        <PageIllustration src={illustrationSrc} fallbackTitle={sceneTitle} fallbackEmoji={sceneEmoji} />
        <div className="reading-canvas rounded-3xl px-6 py-7 text-ink dark:text-[#e8e5f2]">
          <KaraokeText
            words={words}
            paragraphSizes={paragraphSizes}
            registerWordEl={registerWordEl}
            fontSizePx={fontSizePx}
            goldenWords={goldenWords}
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

/**
 * Платное распознавание казахского как подстраховка. Выключено по умолчанию:
 * требует тарифа Blaze и ключа Freedom в секретах функций. Включается сборкой
 * с VITE_STT_FALLBACK=1, когда всё готово. Так код можно влить и задеплоить,
 * не активируя платный путь, пока не подтверждена биллинговая модель.
 */
const STT_FALLBACK_ENABLED = import.meta.env.VITE_STT_FALLBACK === "1";

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
  /** Результат вопросов — влияет на бонус и показывается в итоге. */
  const [quizResult, setQuizResult] = useState<{ correct: number; total: number } | null>(null);
  const [coins, setCoins] = useState(0);
  const [streakInfo, setStreakInfo] = useState<{ streak: number; grew: boolean } | null>(null);
  /** Всплывающая награда за только что дочитанную страницу. */
  const [pageAward, setPageAward] = useState<PageAwardResult | null>(null);
  /** Выпавшая за книгу карточка — показываем после празднования. */
  const [wonCard, setWonCard] = useState<(typeof CARDS)[number] | null>(null);
  /** Что реально начислено за книгу — с причиной, если срезали. */
  const [awardInfo, setAwardInfo] = useState<{
    coins: number; baseCoins: number; reason: keyof typeof AWARD_EXPLANATION;
  } | null>(null);
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
    struggledWords: [],
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

  /**
   * Золотые слова текущей страницы — приносят бонусные монеты.
   * Набор детерминирован (книга + номер страницы), поэтому при возврате на
   * страницу подсветка та же: ребёнок не решит, что приложение «жульничает».
   */
  const goldenWords = useMemo(
    () => (bookId ? goldenWordIndexes(bookId, pageIndex, words) : new Set<number>()),
    [bookId, pageIndex, words],
  );
  const goldenWordsRef = useRef(goldenWords);
  goldenWordsRef.current = goldenWords;

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
      // Счётчик монет НЕ увеличиваем здесь. Раньше он рос на монету за слово,
      // хотя награда давно начисляется постранично, — ребёнок видел одно
      // число, а получал другое. Теперь счётчик двигают только реальные
      // начисления (awardPage и completeSession).
      persist(s);
    },
    [persist],
  );

  // ── Page / book completion ──
  /**
   * Завершение книги идёт в два такта:
   *   1) вопросы по прочитанному,
   *   2) только потом подсчёт награды и празднование.
   * Раньше празднование с монетами показывалось сразу, а вопросы задавались
   * поверх него: ребёнок видел награду до того, как ответил, и его ответы ни
   * на что не влияли. Теперь награда — итог всей работы, включая вопросы.
   */
  const finishBook = useCallback(() => {
    setShowQuiz(true);
  }, []);

  /** Вызывается после вопросов: считаем награду и показываем празднование. */
  const finalizeBook = useCallback((quizScore?: { correct: number; total: number }) => {
    setShowQuiz(false);
    setQuizResult(quizScore ?? null);
    setFinished(true);
    void (async () => {
      if (!user || !sessionId || !book || !profile) return;
      persist(latestSnapRef.current, true); // final flush
      // Награда считается на сервере с учётом повторов, уровня и дневного
      // потолка — здесь только показываем, что реально начислено.
      const award = await completeSession(
        user.uid,
        profileId,
        sessionId,
        book.language,
        savedMsRef.current,
        {
          bookId: book.id,
          wordsRead: savedWordsRef.current,
          band: bandForBook(book),
          childAge: profile.age,
        },
      );
      setAwardInfo(award);
      const before = profileBeforeRef.current ?? profile;
      setCoins((c) => c + award.coins);
      // Обновляем серию и копилку трудных слов — результат покажем на итоге.
      const streakRes = await updateStreakAndHardWords(
        user.uid,
        profileId,
        latestSnapRef.current.struggledWords,
      );
      setStreakInfo(streakRes);

      // Карточка за дочитанную книгу. Выпадение детерминировано от книги,
      // поэтому перезагрузка страницы не даст «прокрутить» другую — иначе
      // награда превратилась бы в игровой автомат.
      if (book) {
        const card = drawCard(`book:${book.id}`, profile.cards ?? []);
        const granted = await grantCard(user.uid, profileId, `book:${book.id}`, card.id);
        if (granted) setWonCard(card);
      }
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

    // Начисляем монеты СРАЗУ за дочитанную страницу — это главное изменение:
    // ребёнок видит награду по ходу чтения, а не только в конце книги.
    if (user && book && profile && bookId) {
      void awardPage(user.uid, profileId, {
        bookId,
        pageIndex: justFinished,
        wordsOnPage: wordsLenRef.current,
        goldenWordsRead: goldenWordsRef.current.size,
        band: bandForBook(book),
        childAge: profile.age,
      }).then((res) => {
        if (res.coins > 0) {
          setCoins((c) => c + res.coins);
          setPageAward(res);
          successFeedback();
          // Всплывающая награда живёт пару секунд и уходит сама.
          window.setTimeout(() => setPageAward(null), 2600);
        }
      });
    }

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
    sttFallback:
      STT_FALLBACK_ENABLED && book?.language === "kk"
        ? { profileId, onStall: () => void sttStallRef.current?.() }
        : undefined,
  });

  // Платная подстраховка для казахского. Полностью опциональна: при выключенном
  // флаге ничего не создаётся и движок работает как прежде.
  const { handleStall } = useSttEscalation({
    enabled: STT_FALLBACK_ENABLED && book?.language === "kk",
    language: book?.language ?? "ru",
    profileId,
    bookId: bookId ?? "",
    onTranscript: (text) => reader.feedExternal(text),
  });
  const sttStallRef = useRef<(() => void) | null>(null);
  sttStallRef.current = handleStall;

  // Поделиться результатом: Web Share API на телефоне, иначе копирование.
  const shareResult = useCallback(async () => {
    const wpm = reader.wpm || latestSnapRef.current.wpm || 0;
    const text = `${profile?.name ?? "Ребёнок"} прочитал книгу «${book?.title ?? ""}» в Bookser` +
      (wpm ? ` — скорость ${wpm} слов/мин! 📚` : " 📚");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bookser", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ icon: "📋", title: "Скопировано", description: "Можно отправить в мессенджер" });
      }
    } catch {
      /* пользователь отменил — это не ошибка */
    }
  }, [reader, profile, book, toast]);
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
    <div className="reader-shell min-h-dvh flex flex-col">
      {/* Header — updates ≤1×/sec, cheap */}
      <header className="reader-toolbar sticky z-20 px-4 pt-3 pb-2.5">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <button className="w-9 h-9 shrink-0 rounded-2xl grid place-items-center bg-white/70 dark:bg-white/10 shadow-soft" onClick={stopAndExit} aria-label="Назад"><ArrowLeft className="w-5 h-5 text-ink dark:text-white" strokeWidth={2.4} /></button>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold truncate text-ink dark:text-white leading-tight">{book.title}</p>
            <p className="text-[11px] text-ink-faint">Страница {pageIndex + 1} из {book.pages.length}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <CoinCounter coins={coins} />
            <div className="flex items-center gap-0.5 rounded-2xl bg-white/70 dark:bg-white/10 shadow-soft p-0.5">
              <button className="w-8 h-8 rounded-xl font-bold text-ink dark:text-white grid place-items-center" onClick={() => setFontSizePx((s) => Math.max(16, s - 2))} aria-label="Меньше">A−</button>
              <button className="w-8 h-8 rounded-xl font-bold text-ink dark:text-white text-sm grid place-items-center" onClick={() => setFontSizePx((s) => Math.min(30, s + 2))} aria-label="Больше">A+</button>
            </div>
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
        goldenWords={goldenWords}
        fontSizePx={fontSizePx}
      />

      {/* Controls */}
      <footer className="reader-controls fixed bottom-0 inset-x-0 z-20">
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
          onFinished={(score) => finalizeBook(score)}
          onClose={() => {
            // Ребёнок закрыл вопросы, не ответив — награду всё равно считаем,
            // но без бонуса за понимание. Чтение состоялось, и оставлять его
            // совсем без итога нельзя.
            if (!finished) finalizeBook();
          }}
        />
      )}

      {/* GAME-01: completion */}
      {/* Награда за дочитанную страницу. Показываем сразу и с разбивкой:
          ребёнок должен ВИДЕТЬ, что чтение приносит монеты прямо сейчас,
          а не когда-то в конце длинной книги. */}
      {pageAward && pageAward.coins > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[70] pointer-events-none animate-pop">
          <div className="sheet !py-3 !px-5 flex items-center gap-3 !shadow-lift">
            <span className="text-3xl">🪙</span>
            <div>
              <p className="font-display font-extrabold text-xl text-amber-600 dark:text-amber-400 leading-none">
                +{pageAward.coins}
              </p>
              <p className="text-[11px] text-ink-faint mt-1">
                Страница прочитана
                {pageAward.breakdown.golden > 0 && ` · золотые слова +${pageAward.breakdown.golden}`}
                {pageAward.breakdown.streakBonus > 0 && ` · серия +${pageAward.breakdown.streakBonus}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <CardReveal
        card={wonCard}
        language={book?.language ?? "ru"}
        onClose={() => setWonCard(null)}
      />

      {finished && (
        <>
          <Fireworks />
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto sheet max-w-sm text-center space-y-3 !shadow-lift animate-pop">
              <div className="text-6xl animate-float">🎉</div>
              <h2 className="font-display font-extrabold text-3xl text-ink dark:text-white">Молодец, {profile.name}!</h2>
              <p className="text-ink-soft dark:text-ink-faint">
                Книга «{book.title}» прочитана — {savedWordsRef.current} слов!
              </p>

              {/* Серия дней — показываем, только когда она сегодня выросла */}
              {streakInfo && streakInfo.grew && streakInfo.streak > 1 && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-orange-400/15 border border-orange-400/30 px-4 py-2">
                  <span className="text-2xl">🔥</span>
                  <span className="font-display font-extrabold text-lg text-orange-600 dark:text-orange-400">
                    {streakInfo.streak} {streakPlural(streakInfo.streak)} подряд!
                  </span>
                </div>
              )}

              {/* Результат вопросов — теперь он ЧАСТЬ итога, а не приходит
                  после награды, как было раньше. */}
              {quizResult && (
                <div className={`rounded-2xl px-4 py-2.5 border ${
                  quizResult.correct === quizResult.total
                    ? "bg-emerald-500/12 border-emerald-500/30"
                    : "bg-brand-500/8 border-brand-500/20"
                }`}>
                  <p className="text-sm font-bold text-ink dark:text-white">
                    {quizResult.correct === quizResult.total
                      ? `Все ответы верные — ${quizResult.correct} из ${quizResult.total}!`
                      : `Вопросы: ${quizResult.correct} из ${quizResult.total}`}
                  </p>
                  {quizResult.correct === quizResult.total && quizResult.total > 0 && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      +{COMPREHENSION_BONUS} монет за понимание
                    </p>
                  )}
                </div>
              )}

              {/* Итоговые показатели */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-amber-400/15 border border-amber-400/30 px-3 py-2.5">
                  <div className="text-2xl">🪙</div>
                  <div className="font-display font-extrabold text-lg text-amber-600 dark:text-amber-400">
                    +{awardInfo?.coins ?? 0}
                  </div>
                  <div className="text-[11px] text-ink-faint">монет</div>
                </div>
                <div className="rounded-2xl bg-brand-500/10 border border-brand-500/25 px-3 py-2.5">
                  <div className="text-2xl">⚡</div>
                  <div className="font-display font-extrabold text-lg text-brand-600 dark:text-brand-300">
                    {reader.wpm || latestSnapRef.current.wpm || "—"}
                  </div>
                  <div className="text-[11px] text-ink-faint">слов/мин</div>
                </div>
              </div>

              {/* Если награду срезали — честно объясняем ребёнку почему,
                  иначе он решит, что приложение сломалось. */}
              {awardInfo && awardInfo.reason !== "full" && awardInfo.reason !== "none" && (
                <div className="rounded-2xl bg-brand-500/8 border border-brand-500/20 px-3 py-2.5 text-left">
                  <p className="text-xs text-ink-soft dark:text-ink-faint leading-relaxed">
                    {AWARD_EXPLANATION[awardInfo.reason][
                      (book?.language ?? "ru") as "ru" | "kk" | "en"
                    ]}
                  </p>
                </div>
              )}

              <p className="text-xs text-ink-faint leading-relaxed px-2">
                Монеты можно потратить в магазине героев или обменять у родителей
                на настоящий приз.
              </p>

              <div className="flex gap-2">
                <button className="btn-ghost flex-1 !py-2.5" onClick={() => void shareResult()}>
                  <Share2 className="w-4 h-4 inline -mt-0.5 mr-1.5" strokeWidth={2.4} />Поделиться
                </button>
                <button className="btn-primary flex-1 !py-2.5" onClick={() => navigate(`/library?profile=${profileId}`)}>
                  К сказкам
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function streakPlural(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "дня";
  return "дней";
}
