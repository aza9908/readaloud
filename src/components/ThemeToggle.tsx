import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="w-10 h-10 rounded-2xl grid place-items-center text-lg bg-white/70 dark:bg-white/10 border border-black/5 dark:border-white/10 shadow-soft hover:-translate-y-0.5 transition-all"
      aria-label={dark ? "Светлая тема" : "Тёмная тема"}
    >
      {dark ? <Sun className="w-[18px] h-[18px] text-amber-500" strokeWidth={2.2} /> : <Moon className="w-[18px] h-[18px] text-ink-soft dark:text-ink-faint" strokeWidth={2.2} />}
    </button>
  );
}
