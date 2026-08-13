import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Строка для живой демонстрации. Показываем ровно то, что делает продукт,
 * вместо того чтобы описывать это словами: слова загораются одно за другим,
 * как во время чтения. Это и есть тезис первого экрана.
 */
const DEMO_WORDS = ["Жили-были", "старик", "со", "старухой", "у", "самого", "синего", "моря"];

function LiveDemo() {
  const [lit, setLit] = useState(-1);

  useEffect(() => {
    // Пауза в конце фразы длиннее — так ритм похож на настоящее чтение,
    // а не на равномерный тик.
    let cancelled = false;
    let i = -1;
    const step = () => {
      if (cancelled) return;
      i = i + 1 > DEMO_WORDS.length ? 0 : i + 1;
      setLit(i);
      const pause = i >= DEMO_WORDS.length ? 1400 : 420;
      window.setTimeout(step, pause);
    };
    const t = window.setTimeout(step, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return (
    <div className="rounded-[28px] bg-white dark:bg-[#1C1828] p-6 shadow-[0_18px_50px_-24px_rgba(45,32,90,0.45)] border border-black/[0.04] dark:border-white/[0.06]">
      <p className="text-[15px] leading-[2] font-medium tracking-[-0.01em]">
        {DEMO_WORDS.map((w, i) => (
          <span
            key={i}
            className={`rounded-lg px-1.5 py-0.5 transition-[background-color,color] duration-[90ms] ${
              i === lit
                ? "bg-brand-500 text-white"
                : i < lit
                  ? "text-ink dark:text-white"
                  : "text-ink-faint/55 dark:text-white/25"
            }`}
          >
            {w}{" "}
          </span>
        ))}
      </p>

      {/* Микрофон и волна — знак того, что читает сам ребёнок, а не приложение */}
      <div className="mt-5 flex items-center gap-3 border-t border-black/[0.05] dark:border-white/[0.07] pt-4">
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/12">
          <span className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
          <svg viewBox="0 0 24 24" className="relative h-4 w-4 fill-brand-500">
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"/>
            <path d="M18 11a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-3.06A8 8 0 0 0 20 11h-2Z"/>
          </svg>
        </span>
        <span className="flex items-end gap-[3px] h-6" aria-hidden="true">
          {[9, 16, 22, 13, 19, 8, 14, 20, 11].map((h, i) => (
            <span key={i}
              className="w-[3px] rounded-full bg-brand-400/70"
              style={{
                height: `${h}px`,
                animation: `wave 1.1s ease-in-out ${i * 90}ms infinite`,
              }} />
          ))}
        </span>
        <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          читает вслух
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { login, loginAsGuest, error } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex justify-between items-center px-5 py-4">
        <span className="font-display font-extrabold text-xl text-ink dark:text-white">
          Book<span className="text-brand-500">ser</span>
        </span>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 pb-8">
        <div className="w-full max-w-sm mx-auto animate-fade-up">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-500 mb-3">
            Чтение вслух · 4–12 лет
          </p>
          <h1 className="font-display font-extrabold text-[2.5rem] leading-[1.02] tracking-[-0.02em] text-ink dark:text-white">
            Слова<br />зажигаются,<br />когда их читают
          </h1>

          {/* Показываем продукт, а не описываем: это и есть первый экран */}
          <div className="mt-7">
            <LiveDemo />
          </div>

          <p className="mt-6 text-[15px] text-ink-soft dark:text-ink-faint leading-relaxed">
            Приложение слышит голос ребёнка и подсвечивает слово, которое он
            читает прямо сейчас. Русский, казахский, английский.
          </p>

          <div className="mt-7 space-y-3">
            <button className="btn-primary w-full" onClick={() => void login()}>
              Войти через Google
            </button>
            <button className="btn-ghost w-full" onClick={() => void loginAsGuest()}>
              Попробовать без входа
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-2xl px-4 py-3 text-left">
              {error}
            </p>
          )}

          <p className="mt-6 text-xs text-ink-faint leading-relaxed">
            Лучше всего работает в Chrome и Edge. Голос ребёнка
            распознаётся прямо в браузере и никуда не отправляется.
          </p>
          {/* Метка сборки нужна для диагностики («какая версия у вас
              открыта?»), но пользователю она ничего не говорит и выглядит
              как недоделка. Прячем от глаз, оставляя в разметке. */}
          <p className="sr-only" data-build={__BUILD_ID__}>сборка {__BUILD_ID__} UTC</p>
        </div>
      </main>
    </div>
  );
}
