import { useEffect, useState } from "react";
import { ArrowRight, AudioLines, Mic, Pause, Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BookserWordmark, ReadingWorld } from "@/components/ReadingWorld";

const lines = [["Жил", "старик", "со", "своею", "старухой"], ["У", "самого", "синего", "моря;"]];
const wordCount = lines.flat().length;

function ReadingPreview() {
  const [activeWord, setActiveWord] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (activeWord + 1 === wordCount) setPlaying(false);
      else setActiveWord(activeWord + 1);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeWord, playing]);

  return (
    <figure className="reading-sample">
      <figcaption>
        <span className="sample-heading"><AudioLines size={17} aria-hidden="true" />Пример подсветки</span>
        <cite>А. С. Пушкин · Сказка о рыбаке и рыбке</cite>
      </figcaption>
      <blockquote>{lines.map((line, row) => (
        <span className="sample-line" key={row}>{line.map((word, i) => (
          <span key={word}><span className={activeWord === i + (row === 0 ? 0 : lines[0].length) ? "sample-word-current" : undefined}>{word}</span>{" "}</span>
        ))}</span>
      ))}</blockquote>
      <button type="button" className="sample-play" aria-label={playing ? "Приостановить подсветку" : "Включить подсветку слов"}
        onClick={() => {
          if (!playing && activeWord + 1 === wordCount) setActiveWord(0);
          setPlaying(!playing);
        }}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
    </figure>
  );
}

export default function LandingPage() {
  const { login, loginAsGuest, busy, error } = useAuth();

  return (
    <div className="world-shell welcome-shell">
      <header className="world-bar"><BookserWordmark /><ThemeToggle /></header>
      <main>
        <ReadingWorld scene="coast" labelledBy="welcome-title" footer={<ReadingPreview />}>
          <p className="world-kicker"><Mic size={16} aria-hidden="true" />Чтение вслух</p>
          <h1 id="welcome-title">Открой книгу.<br /><em>Читай вслух.</em></h1>
          <p className="world-description">Bookser подсвечивает слова в такт голосу ребёнка. Сказки на русском, казахском и английском.</p>
          <div className="welcome-actions" aria-busy={busy}>
            <button className="world-primary" disabled={busy} onClick={() => void login()}>Войти через Google <ArrowRight size={17} aria-hidden="true" /></button>
            <button className="world-secondary" disabled={busy} onClick={() => void loginAsGuest()}>Попробовать без входа</button>
          </div>
          {error && <p className="welcome-error" role="alert">{error}</p>}
        </ReadingWorld>
        <p className="welcome-privacy"><Mic size={15} aria-hidden="true" /> Для чтения вслух нужен доступ к микрофону.</p>
      </main>
      <span className="sr-only" data-build={__BUILD_ID__}>сборка {__BUILD_ID__} UTC</span>
    </div>
  );
}
