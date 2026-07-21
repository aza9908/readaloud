import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  const { login } = useAuth();

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
        <button className="btn-primary text-lg px-8 py-4" onClick={() => void login()}>
          Войти через Google
        </button>
        <p className="text-xs text-slate-400 max-w-xs">
          Работает в Chrome и Edge — распознавание речи происходит прямо в
          браузере, без записи на сервер.
        </p>
      </main>
    </div>
  );
}
