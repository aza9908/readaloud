/** Minimal toast system (GAME-02 achievement notifications etc.). */
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
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-amber-200 dark:border-amber-500/30 px-4 py-3 flex items-center gap-3 animate-toast-in"
          >
            {t.icon && <span className="text-3xl">{t.icon}</span>}
            <div className="min-w-0">
              <p className="font-bold text-slate-900 dark:text-white">{t.title}</p>
              {t.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
