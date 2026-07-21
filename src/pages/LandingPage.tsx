import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const { login, loginAsGuest, error } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 pb-20">
        <div className="text-7xl">📖</div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">
          Read<span className="text-primary">Aloud</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-md">
          Читаем вслух — слова подсвечиваются сами! Сказки на русском, казахском
          и английском с наградами и фейерверками. 🎆
        </p>
        <div className="flex gap-3 text-3xl" aria-hidden="true">
          <span>🇷🇺</span><span>🇰🇿</span><span>🇬🇧</span>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <button className="btn-primary w-full text-lg px-8 py-4" onClick={() => void login()}>
            Войти через Google
          </button>
          <button
            className="btn-outline w-full py-3"
            onClick={() => void loginAsGuest()}
          >
            👋 Попробовать без регистрации
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500 max-w-sm bg-red-50 dark:bg-red-500/10 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}

        <p className="text-xs text-slate-400 max-w-xs">
          Работает в Chrome и Edge — распознавание речи происходит прямо в
          браузере, без записи на сервер.
        </p>
      </main>
    </div>
  );
}
