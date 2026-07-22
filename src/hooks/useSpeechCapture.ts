/**
 * useSpeechCapture — free-form speech-to-text for the retelling (пересказ)
 * feature. Unlike useSpeechReader (which matches against known words), this
 * simply accumulates whatever the child says.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export function useSpeechCapture(lang: string) {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const isSupported = !!getCtor();

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const finalRef = useRef("");

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = lang;

    rec.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r?.[0]) continue;
        if (r.isFinal) {
          finalRef.current += r[0].transcript + " ";
        } else {
          live += r[0].transcript;
        }
      }
      setTranscript(finalRef.current.trim());
      setInterim(live);
    };

    rec.onend = () => {
      if (wantRef.current) {
        // Chrome auto-stops; restart quietly so long retellings aren't cut off.
        setTimeout(() => {
          if (wantRef.current) {
            try { rec.start(); } catch { /* already started */ }
          }
        }, 200);
      } else {
        setListening(false);
      }
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        setListening(false);
      }
    };

    recRef.current = rec;
    return () => {
      wantRef.current = false;
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try { rec.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    wantRef.current = true;
    setListening(true);
    try { recRef.current.start(); } catch { /* already started */ }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
    setInterim("");
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setInterim("");
  }, []);

  return { transcript, interim, listening, isSupported, start, stop, reset };
}
