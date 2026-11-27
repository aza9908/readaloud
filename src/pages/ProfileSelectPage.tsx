import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, ChevronRight, Coins, Library, LockKeyhole, LogOut, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createProfile, watchProfiles } from "@/lib/firestore";
import { LANGUAGES, type ChildProfile, type Language } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { BookserWordmark, ReadingWorld } from "@/components/ReadingWorld";

const AVATARS = [
  ["🦁", "Лев"], ["🐬", "Дельфин"], ["🦊", "Лиса"], ["🐼", "Панда"], ["🦄", "Единорог"],
  ["🐸", "Лягушка"], ["🦋", "Бабочка"], ["🐯", "Тигр"], ["🐨", "Коала"], ["🦉", "Сова"],
];
const years = new Intl.NumberFormat("ru", { style: "unit", unit: "year", unitDisplay: "long" });
const bookForms = new Intl.PluralRules("ru");
function bookCount(count: number) {
  const form = bookForms.select(count);
  return `${count} ${form === "one" ? "книга" : form === "few" ? "книги" : "книг"}`;
}

export default function ProfileSelectPage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [profiles, setProfiles] = useState<ChildProfile[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState(7);
  const [avatar, setAvatar] = useState("🦁");
  const [language, setLanguage] = useState<Language>("ru");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    return watchProfiles(user.uid, setProfiles);
  }, [user]);

  if (!user) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createProfile(user.uid, { name: name.trim(), age, avatar, defaultLanguage: language });
      setCreating(false);
      setName("");
    } catch {
      setError("Не удалось сохранить профиль. Попробуй ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="world-shell profile-shell">
      <header className="world-bar">
        <BookserWordmark />
        <div className="bar-actions">
          <button className="bar-link" onClick={() => void logout()}><LogOut size={16} aria-hidden="true" />Выйти</button>
          <ThemeToggle />
        </div>
      </header>

      <main>
        <ReadingWorld scene="observatory" labelledBy="profiles-title">
          <p className="world-kicker"><Library size={16} aria-hidden="true" />Семейная библиотека</p>
          <h1 id="profiles-title">Кто читает<br /><em>сегодня?</em></h1>
          <p className="world-description">{profiles?.length === 0 ? "Добавь свой первый профиль, чтобы открыть книжную полку." : "Выбери свой профиль, чтобы открыть книги и продолжить с того места, где остановился."}</p>
        </ReadingWorld>

        <section className="reader-collection" aria-labelledby="readers-title">
          <div className="collection-heading">
            <h2 id="readers-title">Читатели</h2>
            <button className="bar-link" onClick={() => navigate("/dashboard")}><LockKeyhole size={16} aria-hidden="true" />Родителям <ChevronRight size={15} aria-hidden="true" /></button>
          </div>
          <div className="profile-grid">
            {profiles === null && <p className="profile-loading" role="status">Загружаем читателей…</p>}
            {profiles?.map(p => (
              <button key={p.id} className="reader-ticket" onClick={() => navigate(`/library?profile=${p.id}`)}>
                <span className="reader-portrait" aria-hidden="true"><ProfileAvatar value={p.avatar} size={53} /></span>
                <span className="ticket-info">
                  <strong>{p.name}</strong>
                  <span className="ticket-meta"><span>{years.format(p.age)}</span><span><BookOpen size={13} aria-hidden="true" />{bookCount(p.booksCompleted ?? 0)}</span>
                    {(p.coins ?? 0) > 0 && <span aria-label={`Монет: ${p.coins}`}><Coins size={13} aria-hidden="true" />{p.coins}</span>}
                  </span>
                </span>
                <ChevronRight className="ticket-chevron" size={18} aria-hidden="true" />
              </button>
            ))}
            <Dialog.Root open={creating} onOpenChange={open => { setCreating(open); if (open) setError(""); }}>
              <Dialog.Trigger asChild>
                <button className="reader-ticket ticket-add"><span className="add-portrait"><Plus aria-hidden="true" /></span>Новый профиль</button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="room-scrim" />
                <Dialog.Content className="room-sheet" aria-describedby={undefined}>
                  <div className="sheet-heading">
                    <Dialog.Title>Новый профиль</Dialog.Title>
                    <Dialog.Close className="round-control" aria-label="Закрыть"><X size={18} /></Dialog.Close>
                  </div>
                  <form onSubmit={submit} className="profile-form">
                    <label htmlFor="reader-name">Имя ребёнка</label>
                    <input id="reader-name" className="input" placeholder="Имя" value={name} maxLength={40} required onChange={e => setName(e.target.value)} />
                    <fieldset><legend>Аватар</legend>
                      <div className="avatar-choices">{AVATARS.map(([emoji, label]) => (
                        <button key={emoji} type="button" aria-label={label} aria-pressed={avatar === emoji} onClick={() => setAvatar(emoji)}>{emoji}</button>
                      ))}</div>
                    </fieldset>
                    <div>
                      <label className="range-label" htmlFor="reader-age">Возраст <output htmlFor="reader-age">{years.format(age)}</output></label>
                      <input id="reader-age" type="range" min={5} max={12} value={age} onChange={e => setAge(Number(e.target.value))} />
                    </div>
                    <fieldset><legend>Основной язык</legend>
                      <div className="language-choices">{LANGUAGES.map(l => (
                        <button key={l.value} type="button" aria-pressed={language === l.value} onClick={() => setLanguage(l.value)}>{l.label}</button>
                      ))}</div>
                    </fieldset>
                    {error && <p role="alert" className="welcome-error">{error}</p>}
                    <button className="world-primary" disabled={!name.trim() || saving}>{saving ? "Создаём…" : "Создать профиль"}</button>
                  </form>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </section>
      </main>
    </div>
  );
}
