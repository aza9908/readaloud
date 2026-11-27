import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const isDark = () => document.documentElement.classList.contains("dark");
function watchTheme(update: () => void) {
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function useDarkAppearance() {
  return useSyncExternalStore(watchTheme, isDark, () => false);
}

export function ThemeToggle() {
  const dark = useDarkAppearance();
  const label = dark ? "Включить светлую тему" : "Включить тёмную тему";
  return (
    <button type="button" className="theme-switch" aria-label={label} title={label}
      onClick={() => {
        const next = !isDark();
        document.documentElement.classList.toggle("dark", next);
        try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* Use this tab's theme. */ }
      }}>
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  );
}
