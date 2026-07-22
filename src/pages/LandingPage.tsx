import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const { login, loginAsGuest, error } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex justify-between items-center px-5 py-4">
        <span className="font-display font-extrabold text-xl text-ink dark:text-white">
          Read<span className="text-brand-500">Aloud</span>
        </span>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Signature: a stack of storybook "pages" behind the icon */}
          <div className="relative mx-auto mb-8 h-28 w-28">
            <div className="absolute inset-0 rotate-[-8deg] rounded-3xl bg-amber-400/25" />
            <div className="absolute inset-0 rotate-[5deg] rounded-3xl bg-brand-300/30" />
            <div className="absolute inset-0 grid place-items-center rounded-3xl bg-white shadow-card border border-black/5 text-5xl animate-float dark:bg-[#211d2e] dark:border-white/10">
              📖
            </div>
          </div>

          <p className="eyebrow mb-3">Чтение вслух · 6–10 лет</p>
          <h1 className="font-display font-extrabold text-[2.6rem] leading-[1.05] text-ink dark:text-white">
            Слова, которые<br />зажигаются
          </h1>
          <p className="mt-4 text-lg text-ink-soft dark:text-ink-faint leading-relaxed">
            Ребёнок читает вслух — слова подсвечиваются сами.
            Сказки на трёх языках, награды и фейерверки за каждую книгу.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3 text-3xl" aria-hidden="true">
            <span>🇷🇺</span><span>🇰🇿</span><span>🇬🇧</span>
          </div>

          <div className="mt-8 space-y-3">
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
          <p className="mt-3 text-[10px] text-ink-faint/60">сборка {__BUILD_ID__} UTC</p>
        </div>
      </main>
    </div>
  );
}
