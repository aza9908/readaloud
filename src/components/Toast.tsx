import { BookserIcon } from "./BookserIcon";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastItem { id: number; icon?: string; title: string; description?: string }
const ToastCtx = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white dark:bg-[var(--surface)] shadow-card border-2 border-amber-400/40 px-4 py-3 flex items-center gap-3 animate-toast-in"
          >
            {t.icon && (
              <span className="text-3xl grid place-items-center w-11 h-11 rounded-xl bg-amber-400/15 shrink-0">
                <BookserIcon value={t.icon} size={32} />
              </span>
            )}
            <div className="min-w-0">
              <p className="font-display font-bold text-ink dark:text-white leading-tight">{t.title}</p>
              {t.description && (
                <p className="text-sm text-ink-soft dark:text-ink-faint">{t.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
