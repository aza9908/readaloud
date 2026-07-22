/**
 * QuizDialog — comprehension questions after the child finishes a book.
 * Questions come from the AI function; falls back to text-derived questions.
 */

import { useEffect, useState } from "react";
import { generateQuiz, type QuizQuestion } from "@/lib/ai";
import type { Language } from "@/lib/types";

const COPY = {
  ru: {
    title: "Вопросы по книге",
    loading: "Придумываю вопросы…",
    correct: "Верно!",
    wrong: "Почти! Правильный ответ подсвечен.",
    next: "Следующий вопрос",
    finish: "Завершить",
    resultTitle: "Готово!",
    of: "из",
    great: "Отлично! Ты внимательно читал.",
    good: "Хорошо! Кое-что можно перечитать.",
    ok: "Ничего страшного — попробуй перечитать книгу.",
    close: "К библиотеке",
    none: "Вопросы не получились — но книга прочитана, и это главное!",
  },
  kk: {
    title: "Кітап бойынша сұрақтар",
    loading: "Сұрақтар дайындалуда…",
    correct: "Дұрыс!",
    wrong: "Тағы сәл! Дұрыс жауап белгіленді.",
    next: "Келесі сұрақ",
    finish: "Аяқтау",
    resultTitle: "Дайын!",
    of: "ішінен",
    great: "Тамаша! Мұқият оқыдың.",
    good: "Жақсы! Кейбірін қайта оқуға болады.",
    ok: "Ештеңе етпейді — кітапты қайта оқып көр.",
    close: "Кітапханаға",
    none: "Сұрақтар шықпады — бірақ кітап оқылды, ең бастысы сол!",
  },
  en: {
    title: "Questions about the book",
    loading: "Thinking up questions…",
    correct: "Correct!",
    wrong: "Almost! The right answer is highlighted.",
    next: "Next question",
    finish: "Finish",
    resultTitle: "All done!",
    of: "of",
    great: "Excellent! You read carefully.",
    good: "Good! A few bits are worth re-reading.",
    ok: "No worries — try reading the book again.",
    close: "Back to library",
    none: "No questions this time — but you finished the book, and that's what matters!",
  },
} as const;

interface Props {
  open: boolean;
  title: string;
  text: string;
  language: Language;
  age: number;
  onClose: () => void;
}

export function QuizDialog({ open, title, text, language, age, onClose }: Props) {
  const c = COPY[language] ?? COPY.ru;
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void generateQuiz({ title, text, language, age }).then((r) => {
      if (!cancelled) setQuestions(r.questions);
    });
    return () => { cancelled = true; };
  }, [open, title, text, language, age]);

  if (!open) return null;

  const q = questions?.[index];

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (q && i === q.correct) setScore((s) => s + 1);
  };

  const next = () => {
    if (!questions) return;
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setPicked(null);
    } else {
      setDone(true);
    }
  };

  const total = questions?.length ?? 0;

  return (
    <div className="fixed inset-0 z-[96] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
      <div className="sheet max-w-md space-y-4 max-h-[92vh] overflow-y-auto">
        {questions === null ? (
          <div className="py-10 text-center">
            <div className="text-4xl animate-float mb-3">🤔</div>
            <p className="text-ink-soft dark:text-ink-faint">{c.loading}</p>
          </div>
        ) : total === 0 ? (
          <div className="py-8 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <p className="text-ink-soft dark:text-ink-faint">{c.none}</p>
            <button className="btn-primary w-full" onClick={onClose}>{c.close}</button>
          </div>
        ) : done ? (
          <div className="py-6 text-center space-y-4">
            <div className="text-5xl">{score === total ? "🏆" : score >= total / 2 ? "👏" : "📖"}</div>
            <h2 className="font-display font-extrabold text-2xl text-ink dark:text-white">{c.resultTitle}</h2>
            <p className="font-display font-extrabold text-4xl text-brand-500">
              {score} <span className="text-ink-faint text-2xl font-sans font-bold">{c.of} {total}</span>
            </p>
            <p className="text-ink-soft dark:text-ink-faint">
              {score === total ? c.great : score >= total / 2 ? c.good : c.ok}
            </p>
            <button className="btn-primary w-full" onClick={onClose}>{c.close}</button>
          </div>
        ) : q ? (
          <>
            <div className="flex items-center justify-between">
              <p className="eyebrow">{c.title}</p>
              <span className="text-xs font-bold text-ink-faint">{index + 1} / {total}</span>
            </div>

            <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
                   style={{ width: `${((index + (picked !== null ? 1 : 0)) / total) * 100}%` }} />
            </div>

            <h3 className="font-display font-bold text-xl text-ink dark:text-white leading-snug">{q.q}</h3>

            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const isCorrect = i === q.correct;
                const isPicked = picked === i;
                const show = picked !== null;
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    disabled={show}
                    className={`w-full text-left rounded-2xl px-4 py-3 border-2 transition-all duration-200 font-medium
                      ${!show ? "border-black/[0.06] dark:border-white/10 bg-white dark:bg-white/5 hover:border-brand-300 hover:-translate-y-0.5" : ""}
                      ${show && isCorrect ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ""}
                      ${show && isPicked && !isCorrect ? "border-red-300 bg-red-50 dark:bg-red-500/10 text-red-600" : ""}
                      ${show && !isCorrect && !isPicked ? "border-transparent opacity-50" : ""}
                      text-ink dark:text-white`}
                  >
                    {opt} {show && isCorrect && "✓"}
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <div className="animate-fade-up space-y-3">
                <p className={`text-sm font-bold ${picked === q.correct ? "text-emerald-600" : "text-amber-600"}`}>
                  {picked === q.correct ? c.correct : c.wrong}
                </p>
                {q.why && <p className="text-sm text-ink-soft dark:text-ink-faint">💡 {q.why}</p>}
                <button className="btn-primary w-full" onClick={next}>
                  {index + 1 < total ? c.next : c.finish}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
