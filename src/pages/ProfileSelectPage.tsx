import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { createProfile, watchProfiles } from "@/lib/firestore";
import { LANGUAGES, type ChildProfile, type Language } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BookOpen, Coins, Plus, Settings } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";

const AVATARS = ["🦁", "🐬", "🦊", "🐼", "🦄", "🐸", "🦋", "🐯", "🐨", "🦉"];

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

  useEffect(() => {
    if (!user) return;
    return watchProfiles(user.uid, setProfiles);
  }, [user]);

  if (!user) return null;

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await createProfile(user.uid, { name: name.trim(), age, avatar, defaultLanguage: language });
      setCreating(false);
      setName("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-shell min-h-dvh mx-auto">
      {/* Сетка 1fr auto 1fr: боковые колонки всегда равной ширины, поэтому
          логотип стоит точно по центру страницы. При flex justify-between он
          съезжал вправо, потому что кнопка «Выйти» шире переключателя темы. */}
      <header className="bookser-toolbar grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="justify-self-start">
          <button className="btn-ghost !py-2 !px-4 text-sm" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
        <span className="bookser-wordmark justify-self-center">
          <BookOpen aria-hidden="true" />Book<span>ser</span>
        </span>
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </header>

      <div className="profile-title text-center mb-8 animate-fade-up">
        <p className="eyebrow mb-2">Профили</p>
        <h1 className="font-display font-extrabold text-4xl text-ink dark:text-white">
          Кто читает сегодня?
        </h1>
        <p className="mt-2 text-ink-soft dark:text-ink-faint">
          Выбери свой профиль или добавь новый
        </p>
      </div>

      <div className="profile-grid grid grid-cols-2 sm:grid-cols-3 gap-4">
        {(profiles ?? []).map((p, i) => (
          <button
            key={p.id}
            className="card p-6 flex flex-col items-center gap-2 hover:-translate-y-1 hover:shadow-lift transition-all duration-200 animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => navigate(`/library?profile=${p.id}`)}
          >
            <span className="mb-1 drop-shadow-sm"><ProfileAvatar value={p.avatar} size={68} /></span>
            <span className="font-display font-bold text-xl text-ink dark:text-white">{p.name}</span>
            <span className="text-sm text-ink-faint">{p.age} лет</span>
            <span className="chip chip-off !py-1 !px-3 text-xs mt-1 inline-flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" strokeWidth={2.2} />
              {p.booksCompleted} {p.booksCompleted === 1 ? "книга" : "книг"}
            </span>
            {(p.coins ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Coins className="w-3.5 h-3.5" strokeWidth={2.4} /> {p.coins}
              </span>
            )}
          </button>
        ))}
        <button
          className="rounded-3xl p-6 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-brand-300 bg-brand-50/60 dark:bg-brand-500/10 text-brand-500 font-display font-bold hover:-translate-y-1 transition-all duration-200"
          onClick={() => setCreating(true)}
        >
          <span className="w-14 h-14 rounded-2xl bg-white dark:bg-brand-500/20 grid place-items-center shadow-soft"><Plus className="w-7 h-7" strokeWidth={2.4} /></span>
          Новый профиль
        </button>
      </div>

      <div className="flex justify-center mt-10">
        <button className="btn-ghost" onClick={() => navigate("/dashboard")}>
          <Settings className="w-4 h-4 inline -mt-0.5 mr-1.5" strokeWidth={2.2} />Родительский дашборд
        </button>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={() => setCreating(false)}>
          <div className="sheet max-w-md space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold text-2xl text-ink dark:text-white">Новый профиль</h2>
              <button className="text-2xl text-ink-faint w-8 h-8" onClick={() => setCreating(false)} aria-label="Закрыть">×</button>
            </div>

            <div className="text-center py-2">
              <span className="text-7xl animate-pop inline-block" key={avatar}>{avatar}</span>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {AVATARS.map((a) => (
                <button key={a} onClick={() => setAvatar(a)}
                  className={`text-2xl w-11 h-11 rounded-2xl transition-all ${avatar === a ? "bg-brand-500/15 ring-2 ring-brand-500 scale-110" : "hover:bg-brand-50 dark:hover:bg-white/5"}`}>
                  {a}
                </button>
              ))}
            </div>

            <input className="input text-center font-semibold" aria-label="Имя ребёнка" placeholder="Имя ребёнка" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />

            <div>
              <div className="flex justify-between text-sm font-bold text-ink-soft dark:text-ink-faint mb-1">
                <span>Возраст</span><span className="text-brand-500">{age} лет</span>
              </div>
              <input type="range" aria-label="Возраст" min={5} max={12} value={age} onChange={(e) => setAge(Number(e.target.value))} className="w-full accent-brand-500" />
            </div>

            <div>
              <p className="text-sm font-bold text-ink-soft dark:text-ink-faint mb-2">Основной язык</p>
              <div className="flex gap-2">
                {LANGUAGES.map((l) => (
                  <button key={l.value} onClick={() => setLanguage(l.value)}
                    className={`chip flex-1 ${language === l.value ? "chip-on" : "chip-off"}`}>
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary w-full" disabled={!name.trim() || saving} onClick={() => void submit()}>
              {saving ? "Создаём…" : "Создать профиль"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
