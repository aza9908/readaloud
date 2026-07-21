import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
      aria-label={dark ? "Светлая тема" : "Тёмная тема"}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
