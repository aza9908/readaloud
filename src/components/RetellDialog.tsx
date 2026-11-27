import { BookserIcon } from "@/components/BookserIcon";
/**
 * RetellDialog — «Перескажи своими словами».
 * Appears after the child finishes a chunk of pages. The child speaks a
 * retelling; it's transcribed with the Web Speech API and evaluated.
 */

import { useState } from "react";
import { evaluateRetell, type RetellResult } from "@/lib/ai";
import { useSpeechCapture } from "@/hooks/useSpeechCapture";
import { SPEECH_LANG_TAGS, type Language } from "@/lib/types";

const COPY = {
  ru: {
    title: "Перескажи своими словами",
    sub: "Что произошло в этой части? Расскажи вслух.",
    start: "Рассказать",
    stop: "Готово",
    listening: "Слушаю…",
    skip: "Пропустить",
    continue: "Читать дальше",
    again: "Рассказать ещё раз",
    empty: "Нажми «Рассказать» и говори — я запишу.",
    missed: "Ещё можно было упомянуть:",
    checking: "Слушаю внимательно…",
    unsupported: "Микрофон недоступен в этом браузере — можно пропустить.",
  },
  kk: {
    title: "Өз сөзіңмен айтып бер",
    sub: "Бұл бөлімде не болды? Дауыстап айт.",
    start: "Айту",
    stop: "Дайын",
    listening: "Тыңдап тұрмын…",
    skip: "Өткізу",
    continue: "Әрі қарай оқу",
    again: "Қайта айту",
    empty: "«Айту» түймесін бас та сөйле — мен жазып аламын.",
    missed: "Мынаны да айтуға болар еді:",
    checking: "Мұқият тыңдап тұрмын…",
    unsupported: "Бұл браузерде микрофон жоқ — өткізуге болады.",
  },
  en: {
    title: "Retell it in your own words",
    sub: "What happened in this part? Say it out loud.",
    start: "Start telling",
    stop: "Done",
    listening: "Listening…",
    skip: "Skip",
    continue: "Keep reading",
    again: "Tell it again",
    empty: "Press “Start telling” and speak — I'll write it down.",
    missed: "You could also mention:",
    checking: "Listening carefully…",
    unsupported: "Microphone isn't available in this browser — you can skip.",
  },
} as const;

interface Props {
  open: boolean;
  chunkText: string;
  language: Language;
  age: number;
  onContinue: () => void;
}

export function RetellDialog({ open, chunkText, language, age, onContinue }: Props) {
  const c = COPY[language] ?? COPY.ru;
  const speech = useSpeechCapture(SPEECH_LANG_TAGS[language]);
  const [result, setResult] = useState<RetellResult | null>(null);
  const [checking, setChecking] = useState(false);

  if (!open) return null;

  const finish = async () => {
    speech.stop();
    const said = speech.transcript.trim();
    if (!said) return;
    setChecking(true);
    try {
      const r = await evaluateRetell({ chunkText, retelling: said, language, age });
      setResult(r);
    } finally {
      setChecking(false);
    }
  };

  const retry = () => {
    setResult(null);
    speech.reset();
  };

  const scoreColor =
    !result ? "" : result.score >= 75 ? "text-emerald-500" : result.score >= 45 ? "text-brand-500" : "text-amber-500";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
      <div className="sheet max-w-md space-y-4 max-h-[92vh] overflow-y-auto">
        {!result ? (
          <>
            <div className="text-center">
              <div className="text-5xl mb-2"><BookserIcon value="🗣" size={58} /></div>
              <h2 className="font-display font-extrabold text-2xl text-ink dark:text-white">{c.title}</h2>
              <p className="text-sm text-ink-soft dark:text-ink-faint mt-1">{c.sub}</p>
            </div>

            <div className="rounded-2xl bg-black/[0.03] dark:bg-white/5 p-4 min-h-[6.5rem] text-ink dark:text-white leading-relaxed">
              {speech.transcript || speech.interim ? (
                <p>
                  {speech.transcript}{" "}
                  <span className="text-ink-faint">{speech.interim}</span>
                </p>
              ) : (
                <p className="text-ink-faint text-sm">
                  {speech.isSupported ? c.empty : c.unsupported}
                </p>
              )}
            </div>

            {speech.listening && (
              <div className="flex items-center justify-center gap-2 text-brand-500 font-bold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
                {c.listening}
              </div>
            )}

            <div className="space-y-2">
              {speech.listening ? (
                <button className="btn-primary w-full" onClick={() => void finish()} disabled={checking}>
                  {checking ? c.checking : <><BookserIcon value="⏹" size={17} line /> {c.stop}</>}
                </button>
              ) : (
                <button
                  className="btn-primary w-full"
                  onClick={speech.transcript ? () => void finish() : speech.start}
                  disabled={!speech.isSupported || checking}
                >
                  {checking ? c.checking : <><BookserIcon value={speech.transcript ? "⏹" : "🎤"} size={17} line /> {speech.transcript ? c.stop : c.start}</>}
                </button>
              )}
              <button className="w-full text-sm font-bold text-ink-faint py-2" onClick={onContinue}>
                {c.skip}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="text-5xl mb-2"><BookserIcon value={result.score >= 75 ? "star" : result.score >= 45 ? "👏" : "💪"} size={62} /></div>
              <p className={`font-display font-extrabold text-4xl ${scoreColor}`}>{result.score}</p>
              <p className="text-ink-soft dark:text-ink-faint mt-2 leading-relaxed">{result.praise}</p>
            </div>

            {result.missed?.length > 0 && (
              <div className="rounded-2xl bg-amber-400/10 border border-amber-400/30 p-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-amber-600 mb-1">{c.missed}</p>
                <p className="text-sm text-ink dark:text-white">{result.missed.join(", ")}</p>
              </div>
            )}

            {result.tip && (
              <p className="text-sm text-ink-soft dark:text-ink-faint text-center"><BookserIcon value="💡" size={16} line /> {result.tip}</p>
            )}

            <div className="space-y-2">
              <button className="btn-primary w-full" onClick={onContinue}>{c.continue}</button>
              <button className="btn-ghost w-full" onClick={retry}>{c.again}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
