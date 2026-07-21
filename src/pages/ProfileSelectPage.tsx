import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { createProfile, watchProfiles } from "@/lib/firestore";
import { LANGUAGES, type ChildProfile, type Language } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";

const AVATARS = ["🦁", "🐬", "🦊", "🐼", "🦄", "🐸", "🦋", "🐯"];

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
      await createProfile(user.uid, {
        name: name.trim(),
        age,
        avatar,
        defaultLanguage: language,
      });
      setCreating(false);
      setName("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh px-4 py-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => void logout()}>
          Выйти
        </button>
        <ThemeToggle />
      </header>

      <h1 className="text-3xl font-extrabold text-center text-slate-900 dark:text-white mb-1">
        Кто читает сегодня?
      </h1>
      <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
        Выбери профиль или создай новый
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {(profiles ?? []).map((p) => (
          <button
            key={p.id}
            className="card flex flex-col items-center gap-2 py-6 hover:ring-2 hover:ring-primary transition-shadow"
            onClick={() => navigate(`/library?profile=${p.id}`)}
          >
            <span className="text-5xl">{p.avatar}</span>
            <span className="font-bold text-lg text-slate-900 dark:text-white">{p.name}</span>
            <span className="text-sm text-slate-500">{p.age} лет</span>
            <span className="text-xs text-slate-400">📖 {p.booksCompleted} сказок</span>
          </button>
        ))}
        <button
          className="card flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-primary/40 bg-primary-soft/40 dark:bg-primary/10 text-primary font-semibold"
          onClick={() => setCreating(true)}
        >
          <span className="w-12 h-12 rounded-full bg-primary-soft dark:bg-primary/20 flex items-center justify-center text-2xl">＋</span>
          Добавить профиль
        </button>
      </div>

      <div className="flex justify-center mt-8">
        <button className="btn-outline" onClick={() => navigate("/dashboard")}>
          ⚙️ Родительский дашборд
        </button>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-800 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Новый профиль</h2>
            <input className="input" placeholder="Имя ребёнка" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Возраст: {age}</span>
              <input type="range" min={5} max={12} value={age} onChange={(e) => setAge(Number(e.target.value))} className="w-full accent-primary" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button key={a} onClick={() => setAvatar(a)} className={`text-2xl w-10 h-10 rounded-xl ${avatar === a ? "bg-primary-soft ring-2 ring-primary dark:bg-primary/20" : "hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                  {a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {LANGUAGES.map((l) => (
                <button key={l.value} onClick={() => setLanguage(l.value)} className={`px-3 py-2 rounded-xl text-sm font-semibold ${language === l.value ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}`}>
                  {l.flag} {l.label}
                </button>
              ))}
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
