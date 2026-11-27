/**
 * InstallPrompt — предложение поставить приложение на домашний экран.
 *
 * ЗАЧЕМ. Установленное приложение открывается без адресной строки, во весь
 * экран, со своей иконкой — именно это отличает «приложение» от «сайта» в
 * восприятии родителя. Но сам браузер об этом почти не сообщает, и без
 * подсказки установку не находит почти никто.
 *
 * ДВА РАЗНЫХ ПУТИ. Chrome даёт событие beforeinstallprompt, и установку
 * можно запустить одной кнопкой. Safari на iOS такого события не даёт —
 * там установка только вручную через «Поделиться», поэтому айфонам
 * показываем инструкцию, а не кнопку.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Download, Share, X } from "lucide-react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Уже запущено как установленное приложение? */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari на iOS сообщает об этом своим нестандартным свойством.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios/i.test(navigator.userAgent);

const DISMISS_KEY = "bookser:install-dismissed";

export function InstallPrompt() {
  const [location] = useLocation();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Уже установлено — подсказка не нужна.
    if (isStandalone()) return;
    // Родитель уже отказался — не навязываемся.
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch { /* приватный режим — покажем подсказку */ }

    if (isIOS()) {
      setShowIosHint(true);
      setHidden(false);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // иначе Chrome покажет свою полоску
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* не важно */ }
  };

  const install = async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setHidden(true);
  };

  if (hidden || location !== "/profiles") return null;

  return (
    <div className="install-offer">
      <div className="sheet !py-3 !px-4 flex items-center gap-3 !shadow-lift">
        <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-sm text-ink dark:text-white">
            Добавить Bookser на экран
          </p>
          {showIosHint ? (
            <p className="text-[11px] text-ink-faint leading-snug mt-0.5">
              Нажмите <Share className="w-3 h-3 inline -mt-0.5" strokeWidth={2.4} /> внизу,
              затем «На экран Домой»
            </p>
          ) : (
            <p className="text-[11px] text-ink-faint mt-0.5">
              Откроется во весь экран, как обычное приложение
            </p>
          )}
        </div>
        {!showIosHint && (
          <button className="btn-primary !py-2 !px-3 text-xs shrink-0" onClick={() => void install()}>
            <Download className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.4} />
            Добавить
          </button>
        )}
        <button className="w-11 h-11 grid place-items-center text-ink-faint shrink-0"
          onClick={dismiss} aria-label="Закрыть">
          <X className="w-4 h-4" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
