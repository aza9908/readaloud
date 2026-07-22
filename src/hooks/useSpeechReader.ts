/**
 * useSpeechReader — high-performance karaoke reading hook.
 *
 * Performance design (this is why the old Replit version lagged):
 * 1. All matching state lives in refs — zero React re-renders per word.
 * 2. Highlighting toggles CSS classes DIRECTLY on word <span>s.
 * 3. React state syncs on a throttled 1000 ms tick (progress bar / WPM).
 * 4. One SpeechRecognition instance; Chrome's auto-stop handled with a
 *    guarded silent restart. Listening intent survives page turns.
 * 5. Levenshtein replaced by an O(n) distance-≤1 check; matching scans
 *    only current word + small lookahead window.
 *
 * Implements PRD §4.4 (MATCH-01 … MATCH-07).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechReaderOptions {
  words: string[];
  lang: string; // BCP-47
  onPageComplete: () => void;
  onProgress?: (state: ProgressSnapshot) => void;
  lookahead?: number;
}

export interface ProgressSnapshot {
  currentIndex: number;
  wordsRead: number;
  elapsedMs: number;
  wpm: number;
}

export interface SpeechReaderApi {
  currentIndex: number;
  wordsRead: number;
  wpm: number;
  elapsedMs: number;
  isListening: boolean;
  isSupported: boolean;
  currentWord: string;
  start: () => void;
  pause: () => void;
  skipWord: () => void;
  seek: (index: number) => void;
  registerWordEl: (index: number, el: HTMLElement | null) => void;
}

// ── Normalization (MATCH-01) ──
const NORMALIZE_RE = /[^\p{L}\p{N}]+/gu;

export function normalizeWord(raw: string): string {
  return raw.toLocaleLowerCase().replace(/ё/g, "е").replace(NORMALIZE_RE, "");
}

function expandHyphens(raw: string): string[] {
  if (raw.includes("-")) {
    const parts = raw.split("-").map(normalizeWord).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  const n = normalizeWord(raw);
  return n ? [n] : [];
}

// ── O(n) Levenshtein ≤ 1 (all MATCH-05 needs) ──
function withinDistanceOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la === lb) { i++; j++; }
    else if (la > lb) i++;
    else j++;
  }
  return edits + (la - i) + (lb - j) <= 1;
}

// ── Matcher (MATCH-02…05) ──
function wordsMatch(target: string, spoken: string): boolean {
  if (!target || !spoken) return false;
  if (target === spoken) return true;               // MATCH-02
  if (target.length <= 2) return false;             // MATCH-03
  if (target.length >= 4) {                         // MATCH-04
    const need = Math.ceil(target.length * 0.75);
    if (spoken.length >= need && (target.startsWith(spoken) || spoken.startsWith(target))) {
      return true;
    }
  }
  return withinDistanceOne(target, spoken);         // MATCH-05
}

const CASCADE_MS = 130;         // MATCH-07 — slower, calmer highlight pace (was 70)
const SYNC_INTERVAL_MS = 1000;
const RESTART_BACKOFF_MS = 250;

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

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
}

export function useSpeechReader(opts: SpeechReaderOptions): SpeechReaderApi {
  const { words, lang, onPageComplete, onProgress, lookahead = 3 } = opts;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordsRead, setWordsRead] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const isSupported = !!getSpeechRecognitionCtor();

  const idxRef = useRef(0);
  const wordsReadRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const listeningRef = useRef(false);
  const wantListeningRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wordElsRef = useRef(new Map<number, HTMLElement>());
  const normTargetsRef = useRef<string[][]>([]);
  const lastProcessedRef = useRef("");
  const cascadeTimersRef = useRef<number[]>([]);
  const pageDoneRef = useRef(false);
  const onPageCompleteRef = useRef(onPageComplete);
  const onProgressRef = useRef(onProgress);
  onPageCompleteRef.current = onPageComplete;
  onProgressRef.current = onProgress;

  // Page changed → precompute targets, reset index, clear timers.
  useEffect(() => {
    normTargetsRef.current = words.map(expandHyphens);
    pageDoneRef.current = false;
    idxRef.current = 0;
    lastProcessedRef.current = "";
    cascadeTimersRef.current.forEach(clearTimeout);
    cascadeTimersRef.current = [];
    currentElRef.current = null;
    setCurrentIndex(0);
  }, [words]);

  // ── Direct-DOM highlighting ──
  /**
   * Paints one word. `word-current` is special: only a single element may
   * carry it at a time, so we track the element that holds it and clear it
   * explicitly. Without this, a late cascade timer from a previous advance
   * could leave a second highlighted word on screen (the "two cursors" bug).
   */
  const currentElRef = useRef<HTMLElement | null>(null);

  const clearCurrentHighlight = useCallback(() => {
    const prev = currentElRef.current;
    if (prev) {
      prev.classList.remove("word-current");
      // A word that was current has, by definition, been reached already.
      const i = Number(prev.dataset.wordIndex ?? -1);
      prev.classList.add(i > -1 && i < idxRef.current ? "word-read" : "word-pending");
      currentElRef.current = null;
    }
  }, []);

  const paintWord = useCallback(
    (index: number, state: "read" | "current" | "pending") => {
      const el = wordElsRef.current.get(index);
      if (!el) return;
      if (state === "current") {
        if (currentElRef.current === el) return; // already the cursor
        clearCurrentHighlight();
        el.classList.remove("word-read", "word-pending");
        el.classList.add("word-current");
        currentElRef.current = el;
        return;
      }
      // Painting a non-current state on the element that holds the cursor
      // must also release the cursor, or it would linger.
      if (currentElRef.current === el) currentElRef.current = null;
      el.classList.remove("word-read", "word-current", "word-pending");
      el.classList.add(`word-${state}`);
    },
    [clearCurrentHighlight],
  );

  const registerWordEl = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      wordElsRef.current.set(index, el);
      const i = idxRef.current;
      el.classList.remove("word-read", "word-current", "word-pending");
      if (index === i) {
        // Re-registering the cursor word (e.g. after a font-size change):
        // release any previous holder so we never end up with two.
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
    accumulatedMsRef.current +
    (startedAtRef.current ? Date.now() - startedAtRef.current : 0);

  const syncStateNow = useCallback(() => {
    const elapsed = computeElapsed();
    const minutes = elapsed / 60000;
    const currentWpm = minutes > 0.05 ? Math.round(wordsReadRef.current / minutes) : 0;
    setCurrentIndex(Math.min(idxRef.current, Math.max(words.length - 1, 0)));
    setWordsRead(wordsReadRef.current);
    setElapsedMs(elapsed);
    setWpm(currentWpm);
    onProgressRef.current?.({
      currentIndex: idxRef.current,
      wordsRead: wordsReadRef.current,
      elapsedMs: elapsed,
      wpm: currentWpm,
    });
  }, [words.length]);

  useEffect(() => {
    if (!isListening) return;
    const id = window.setInterval(syncStateNow, SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isListening, syncStateNow]);

  // ── Advance (cascade MATCH-07, page turn READ-05) ──
  const advanceTo = useCallback(
    (newIndex: number) => {
      const from = idxRef.current;
      const count = newIndex - from;
      if (count <= 0) return;
      // Drop any pending cascade steps from an earlier advance — otherwise a
      // late timer repaints an old word as the cursor.
      cascadeTimersRef.current.forEach(clearTimeout);
      cascadeTimersRef.current = [];
      for (let k = 0; k < count; k++) {
        const wordIdx = from + k;
        const t = window.setTimeout(() => {
          paintWord(wordIdx, "read");
          if (wordIdx + 1 < words.length) paintWord(wordIdx + 1, "current");
        }, k * CASCADE_MS);
        cascadeTimersRef.current.push(t);
      }
      idxRef.current = newIndex;
      wordsReadRef.current += count;
      if (newIndex >= words.length && !pageDoneRef.current) {
        pageDoneRef.current = true;
        window.setTimeout(() => {
          syncStateNow();
          onPageCompleteRef.current();
        }, count * CASCADE_MS + 120);
      }
    },
    [words.length, paintWord, syncStateNow],
  );

  // ── Hot path: transcript → match → advance (refs only) ──
  const handleTranscript = useCallback(
    (transcript: string) => {
      if (transcript === lastProcessedRef.current) return;
      lastProcessedRef.current = transcript;
      const spokenTokens = transcript
        .split(/\s+/)
        .map(normalizeWord)
        .filter(Boolean)
        .slice(-6);
      if (!spokenTokens.length) return;

      const targets = normTargetsRef.current;
      let advanced = idxRef.current;
      for (const spoken of spokenTokens) {
        if (advanced >= targets.length) break;
        const windowEnd = Math.min(advanced + 1 + lookahead, targets.length);
        for (let w = advanced; w < windowEnd; w++) {
          if (targets[w].some((p) => wordsMatch(p, spoken))) {
            advanced = w + 1;
            break;
          }
        }
      }
      if (advanced > idxRef.current) advanceTo(advanced);
    },
    [advanceTo, lookahead],
  );
  const handleTranscriptRef = useRef(handleTranscript);
  handleTranscriptRef.current = handleTranscript;

  // ── Recognition lifecycle: one instance per language ──
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = lang;

    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last || !last[0]) return;
      handleTranscriptRef.current(last[0].transcript);
      if (last.isFinal) lastProcessedRef.current = "";
    };

    rec.onend = () => {
      listeningRef.current = false;
      if (wantListeningRef.current) {
        // Chrome auto-stops (~60 s / silence) → silent restart with backoff.
        window.setTimeout(() => {
          if (wantListeningRef.current && !listeningRef.current) {
            try { rec.start(); listeningRef.current = true; } catch { /* already started */ }
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
    // Intent survives instance recreation (e.g. language switch).
    if (wantListeningRef.current) {
      try { rec.start(); listeningRef.current = true; } catch { /* noop */ }
    }
    return () => {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try { rec.stop(); } catch { /* noop */ }
      listeningRef.current = false;
      recognitionRef.current = null;
    };
  }, [lang]);

  // ── Controls ──
  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    wantListeningRef.current = true;
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    lastProcessedRef.current = "";
    if (!listeningRef.current) {
      try { recognitionRef.current.start(); listeningRef.current = true; } catch { /* noop */ }
    }
    setIsListening(true);
  }, []);

  const pause = useCallback(() => {
    wantListeningRef.current = false;
    if (startedAtRef.current) {
      accumulatedMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    listeningRef.current = false;
    setIsListening(false);
    syncStateNow();
  }, [syncStateNow]);

  const skipWord = useCallback(() => {
    if (idxRef.current < words.length) advanceTo(idxRef.current + 1);
    syncStateNow();
  }, [advanceTo, words.length, syncStateNow]);

  const seek = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, Math.max(words.length - 1, 0)));
      cascadeTimersRef.current.forEach(clearTimeout);
      cascadeTimersRef.current = [];
      idxRef.current = clamped;
      // Paint non-current states first, then the cursor last, so the
      // single-cursor invariant is never briefly violated.
      wordElsRef.current.forEach((_el, i) => {
        if (i !== clamped) paintWord(i, i < clamped ? "read" : "pending");
      });
      paintWord(clamped, "current");
      syncStateNow();
    },
    [words.length, paintWord, syncStateNow],
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
    currentWord: words[Math.min(currentIndex, Math.max(words.length - 1, 0))] ?? "",
    start,
    pause,
    skipWord,
    seek,
    registerWordEl,
  };
}
