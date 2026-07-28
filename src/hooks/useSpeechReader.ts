/**
 * useSpeechReader — karaoke reading engine.
 *
 * Responsibilities are split deliberately:
 *   • ReadingAligner (src/lib/alignment.ts) decides WHERE the cursor is.
 *     It is pure and unit-tested (test/alignment.test.mjs).
 *   • This hook owns the microphone, the DOM highlighting and the timers.
 *
 * Performance rules (breaking these reintroduces the reading lag):
 *   1. Never setState per speech event — `onresult` fires 5–15×/sec.
 *   2. Highlighting toggles CSS classes directly on the word <span>s.
 *   3. Progress/WPM sync on a 1-second tick; the reading surface is memoized.
 *
 * Synchronisation rule:
 *   The "read this word" prompt must never lag the highlight. It therefore
 *   does NOT read the throttled React state — it subscribes to cursor changes
 *   and re-renders only itself, immediately.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ReadingAligner } from "@/lib/alignment";

export interface SpeechReaderOptions {
  words: string[];
  lang: string;
  onPageComplete: () => void;
  onProgress?: (state: ProgressSnapshot) => void;
  /**
   * Платное распознавание казахского как подстраховка. Полностью опционально:
   * без него движок работает ровно как раньше. Передаётся только для книг на
   * казахском и только когда функция включена (флаг + тариф Blaze).
   */
  sttFallback?: {
    profileId: string;
    /** Вызывается движком, когда чтение застряло на казахском тексте. */
    onStall: (recentWords: string[]) => void;
  };
}

export interface ProgressSnapshot {
  currentIndex: number;
  wordsRead: number;
  elapsedMs: number;
  wpm: number;
  /** Words the child needed several attempts on — for the parent report. */
  struggledWords: string[];
}

export interface SpeechReaderApi {
  currentIndex: number;
  wordsRead: number;
  wpm: number;
  elapsedMs: number;
  isListening: boolean;
  isSupported: boolean;
  /** Live cursor — subscribe for instant updates, never throttled. */
  subscribeCursor: (fn: (index: number) => void) => () => void;
  getCursor: () => number;
  start: () => void;
  pause: () => void;
  skipWord: () => void;
  seek: (index: number) => void;
  /**
   * Подать текст, распознанный внешним (платным) движком, в тот же
   * выравниватель. Используется подстраховкой для казахского: когда браузер
   * не справился, текст приходит отсюда и двигает курсор так же, как речь.
   */
  feedExternal: (text: string) => void;
  registerWordEl: (index: number, el: HTMLElement | null) => void;
}

const CASCADE_MS = 130;
const SYNC_INTERVAL_MS = 1000;
const RESTART_BACKOFF_MS = 250;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechResultEventLike {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
  resultIndex: number;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

/**
 * После скольких тактов речи без движения курсора считаем, что чтение
 * застряло, и уведомляем внешнюю политику эскалации. Число намеренно
 * заметное: платный путь — крайняя мера, сначала пусть отработает
 * бесплатное восстановление выравнивателя.
 */
const STALL_NUDGE_AT = 5;

export function useSpeechReader(opts: SpeechReaderOptions): SpeechReaderApi {
  const { words, lang, onPageComplete, onProgress } = opts;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordsRead, setWordsRead] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const isSupported = !!getSpeechRecognitionCtor();

  const alignerRef = useRef<ReadingAligner>(new ReadingAligner());
  const wordsReadRef = useRef(0);
  /** Words the child struggled on this session (deduped, capped). */
  const struggledRef = useRef<string[]>([]);
  /** Подряд идущие такты речи без движения курсора — сигнал застревания. */
  const stallCountRef = useRef(0);
  const sttFallbackRef = useRef(opts.sttFallback);
  sttFallbackRef.current = opts.sttFallback;
  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const listeningRef = useRef(false);
  const wantListeningRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wordElsRef = useRef(new Map<number, HTMLElement>());
  const currentElRef = useRef<HTMLElement | null>(null);
  const cascadeTimersRef = useRef<number[]>([]);
  const pageDoneRef = useRef(false);
  const onPageCompleteRef = useRef(onPageComplete);
  const onProgressRef = useRef(onProgress);
  onPageCompleteRef.current = onPageComplete;
  onProgressRef.current = onProgress;

  // ── Instant cursor notification (prompt must not lag the highlight) ──
  const cursorSubsRef = useRef(new Set<(i: number) => void>());
  const notifyCursor = useCallback((i: number) => {
    cursorSubsRef.current.forEach((fn) => fn(i));
  }, []);
  const subscribeCursor = useCallback((fn: (index: number) => void) => {
    cursorSubsRef.current.add(fn);
    fn(alignerRef.current.cursor);
    return () => {
      cursorSubsRef.current.delete(fn);
    };
  }, []);
  const getCursor = useCallback(() => alignerRef.current.cursor, []);

  // ── Page load: the aligner drops speech from the previous page ──
  useEffect(() => {
    alignerRef.current.setPage(words, 0);
    pageDoneRef.current = false;
    cascadeTimersRef.current.forEach(clearTimeout);
    cascadeTimersRef.current = [];
    currentElRef.current = null;
    setCurrentIndex(0);
    notifyCursor(0);
  }, [words, notifyCursor]);

  // ── DOM highlighting, with a strict single-cursor invariant ──
  const paintWord = useCallback((index: number, state: "read" | "current" | "pending") => {
    const el = wordElsRef.current.get(index);
    if (!el) return;
    if (state === "current") {
      if (currentElRef.current === el) return;
      const prev = currentElRef.current;
      if (prev) {
        prev.classList.remove("word-current");
        const pi = Number(prev.dataset.wordIndex ?? -1);
        prev.classList.add(
          pi > -1 && pi < alignerRef.current.cursor ? "word-read" : "word-pending",
        );
      }
      el.classList.remove("word-read", "word-pending");
      el.classList.add("word-current");
      currentElRef.current = el;
      return;
    }
    if (currentElRef.current === el) currentElRef.current = null;
    el.classList.remove("word-read", "word-current", "word-pending");
    el.classList.add(`word-${state}`);
  }, []);

  const registerWordEl = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      wordElsRef.current.set(index, el);
      const i = alignerRef.current.cursor;
      el.classList.remove("word-read", "word-current", "word-pending");
      if (index === i) {
        const prev = currentElRef.current;
        if (prev && prev !== el) prev.classList.remove("word-current");
        el.classList.add("word-current");
        currentElRef.current = el;
      } else {
        el.classList.add(index < i ? "word-read" : "word-pending");
      }
    } else {
      if (currentElRef.current === wordElsRef.current.get(index)) currentElRef.current = null;
      wordElsRef.current.delete(index);
    }
  }, []);

  const computeElapsed = () =>
    accumulatedMsRef.current + (startedAtRef.current ? Date.now() - startedAtRef.current : 0);

  const syncStateNow = useCallback(() => {
    const elapsed = computeElapsed();
    const minutes = elapsed / 60000;
    const currentWpm = minutes > 0.05 ? Math.round(wordsReadRef.current / minutes) : 0;
    const cursor = alignerRef.current.cursor;
    setCurrentIndex(Math.min(cursor, Math.max(words.length - 1, 0)));
    setWordsRead(wordsReadRef.current);
    setElapsedMs(elapsed);
    setWpm(currentWpm);
    onProgressRef.current?.({
      currentIndex: cursor,
      wordsRead: wordsReadRef.current,
      elapsedMs: elapsed,
      wpm: currentWpm,
      struggledWords: struggledRef.current.slice(),
    });
  }, [words.length]);

  useEffect(() => {
    if (!isListening) return;
    const id = window.setInterval(syncStateNow, SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isListening, syncStateNow]);

  /** Repaint after the aligner moved the cursor forward. */
  const applyAdvance = useCallback(
    (from: number, advanced: number) => {
      if (advanced <= 0) return;
      cascadeTimersRef.current.forEach(clearTimeout);
      cascadeTimersRef.current = [];

      const to = from + advanced;
      for (let k = 0; k < advanced; k++) {
        const wordIdx = from + k;
        const t = window.setTimeout(() => {
          paintWord(wordIdx, "read");
          if (wordIdx + 1 < words.length) paintWord(wordIdx + 1, "current");
        }, k * CASCADE_MS);
        cascadeTimersRef.current.push(t);
      }

      wordsReadRef.current += advanced;
      notifyCursor(to); // immediate — the prompt must not wait for the tick

      if (to >= words.length && !pageDoneRef.current) {
        pageDoneRef.current = true;
        window.setTimeout(
          () => {
            syncStateNow();
            onPageCompleteRef.current();
          },
          advanced * CASCADE_MS + 120,
        );
      }
    },
    [words.length, paintWord, syncStateNow, notifyCursor],
  );

  // ── Speech events ──
  const handleResults = useCallback(
    (event: SpeechResultEventLike) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r?.[0]) continue;
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interimText += r[0].transcript + " ";
      }

      const before = alignerRef.current.cursor;
      const { advanced, struggled } = alignerRef.current.feed(finalText, interimText);
      if (struggled.length) {
        for (const idx of struggled) {
          const w = alignerRef.current.wordAt(idx).toLocaleLowerCase().replace(/[^\p{L}\p{N}-]/gu, "");
          if (w && w.length >= 4 && !struggledRef.current.includes(w) && struggledRef.current.length < 30) {
            struggledRef.current.push(w);
          }
        }
      }
      if (advanced > 0) {
        applyAdvance(before, advanced);
        stallCountRef.current = 0; // курсор пошёл — сбрасываем счётчик застревания
      } else if (finalText.trim()) {
        // Речь была, но курсор не сдвинулся — возможное застревание.
        // Копим счётчик; политика решит, звать ли платный движок.
        stallCountRef.current += 1;
        const fb = sttFallbackRef.current;
        if (fb && stallCountRef.current >= STALL_NUDGE_AT) {
          stallCountRef.current = 0;
          // Отдаём последние слова вокруг курсора — контекст для распознавания.
          const cur = alignerRef.current.cursor;
          const recent: string[] = [];
          for (let i = cur; i < Math.min(cur + 3, words.length); i++) {
            recent.push(alignerRef.current.wordAt(i));
          }
          fb.onStall(recent);
        }
      }
    },
    [applyAdvance, words],
  );
  const handleResultsRef = useRef(handleResults);
  handleResultsRef.current = handleResults;

  // ── Recogniser lifecycle ──
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = lang;

    rec.onresult = (event) => handleResultsRef.current(event);

    rec.onend = () => {
      listeningRef.current = false;
      if (wantListeningRef.current) {
        // Chrome stops on its own; restart quietly. The aligner tolerates the
        // finals list resetting, so this causes no cursor jump.
        window.setTimeout(() => {
          if (wantListeningRef.current && !listeningRef.current) {
            try {
              rec.start();
              listeningRef.current = true;
            } catch {
              /* already started */
            }
          }
        }, RESTART_BACKOFF_MS);
      } else {
        setIsListening(false);
      }
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognitionRef.current = rec;
    if (wantListeningRef.current) {
      try {
        rec.start();
        listeningRef.current = true;
      } catch {
        /* noop */
      }
    }
    return () => {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      listeningRef.current = false;
      recognitionRef.current = null;
    };
  }, [lang]);

  // ── Controls ──
  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    wantListeningRef.current = true;
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    alignerRef.current.dropPendingSpeech(); // ignore anything heard while paused
    if (!listeningRef.current) {
      try {
        recognitionRef.current.start();
        listeningRef.current = true;
      } catch {
        /* noop */
      }
    }
    setIsListening(true);
  }, []);

  const pause = useCallback(() => {
    wantListeningRef.current = false;
    if (startedAtRef.current) {
      accumulatedMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    listeningRef.current = false;
    setIsListening(false);
    syncStateNow();
  }, [syncStateNow]);

  const skipWord = useCallback(() => {
    const from = alignerRef.current.cursor;
    if (from >= words.length) return;
    alignerRef.current.seek(from + 1);
    alignerRef.current.dropPendingSpeech();
    applyAdvance(from, 1);
    syncStateNow();
  }, [words.length, applyAdvance, syncStateNow]);

  const seek = useCallback(
    (index: number) => {
      cascadeTimersRef.current.forEach(clearTimeout);
      cascadeTimersRef.current = [];
      alignerRef.current.seek(index);
      alignerRef.current.dropPendingSpeech();
      const clamped = alignerRef.current.cursor;
      wordElsRef.current.forEach((_el, i) => {
        if (i !== clamped) paintWord(i, i < clamped ? "read" : "pending");
      });
      paintWord(clamped, "current");
      notifyCursor(clamped);
      syncStateNow();
    },
    [paintWord, syncStateNow, notifyCursor],
  );

  /**
   * Прогоняет внешне распознанный текст через тот же выравниватель, что и
   * обычную речь. Реализация намеренно совпадает с обработкой микрофона:
   * платный результат не «особенный», он просто ещё один источник слов.
   */
  const feedExternal = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const before = alignerRef.current.cursor;
      const { advanced } = alignerRef.current.feed(text, "");
      if (advanced > 0) {
        applyAdvance(before, advanced);
        stallCountRef.current = 0;
        syncStateNow();
      }
    },
    [applyAdvance, syncStateNow],
  );

  useEffect(() => {
    const timers = cascadeTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  return {
    currentIndex,
    wordsRead,
    wpm,
    elapsedMs,
    isListening,
    isSupported,
    subscribeCursor,
    getCursor,
    start,
    pause,
    skipWord,
    seek,
    feedExternal,
    registerWordEl,
  };
}
