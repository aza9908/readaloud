import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Mic } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import pagePal from "@/assets/avatars/page-pal.webp";

const demoWords = ["Жили-были", "старик", "со", "старухой", "у", "самого", "синего", "моря."];

function ReadingPreview() {
  const [activeWord, setActiveWord] = useState(1);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number;
    function start() {
      window.clearTimeout(timer);
      let word = 1;
      setActiveWord(word);
      if (motion.matches) return;
      function advance() {
        word = (word + 1) % demoWords.length;
        setActiveWord(word);
        timer = window.setTimeout(advance, word === demoWords.length - 1 ? 1600 : 620);
      }
      timer = window.setTimeout(advance, 1200);
    }
    start();
    motion.addEventListener("change", start);
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener("change", start);
    };
  }, []);

  return (
    <figure className="book-preview">
      <img className="book-preview-art" src={pagePal} width={320} height={320}
        alt="Плюшевый читатель в наушниках с открытой книгой" />
      <figcaption>
        <span className="preview-label"><Mic size={16} aria-hidden="true" />Пример чтения</span>
        <p className="preview-passage">
          {demoWords.map((word, i) => (
            <span key={word}><span className={i === activeWord ? "preview-current" : undefined}>{word}</span>{" "}</span>
          ))}
        </p>
      </figcaption>
    </figure>
  );
}

export default function LandingPage() {
  const { login, loginAsGuest, busy, error } = useAuth();

  return (
    <div className="welcome-shell">
      <header className="welcome-bar">
        <span className="bookser-wordmark"><BookOpen aria-hidden="true" />Book<span>ser</span></span>
        <ThemeToggle />
      </header>
      <main className="welcome-spread">
        <section className="welcome-intro" aria-labelledby="welcome-title">
          <p className="eyebrow">Чтение вслух · 4–12 лет</p>
          <h1 id="welcome-title">Слова зажигаются, <em>когда их читают</em></h1>
          <p className="welcome-description">
            Ребёнок читает сказку вслух, а Bookser подсвечивает слова в такт его голосу.
            На русском, казахском и английском.
          </p>
          <div className="welcome-actions" aria-busy={busy}>
            <button className="btn-primary" disabled={busy} onClick={() => void login()}>Войти через Google</button>
            <button className="btn-ghost" disabled={busy} onClick={() => void loginAsGuest()}>
              Попробовать без входа <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
          {error && <p className="welcome-error" role="alert">{error}</p>}
          <p className="welcome-privacy"><Mic size={15} aria-hidden="true" /> Для чтения вслух нужен доступ к микрофону.</p>
        </section>
        <ReadingPreview />
      </main>
      <span className="sr-only" data-build={__BUILD_ID__}>сборка {__BUILD_ID__} UTC</span>
    </div>
  );
}
