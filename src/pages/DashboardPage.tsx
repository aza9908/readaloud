import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getAchievements, getSessions, watchProfiles } from "@/lib/firestore";
import { badgeById } from "@/lib/achievements";
import {
  LANGUAGES,
  type Achievement,
  type ChildProfile,
  type Language,
  type ReadingSession,
} from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RewardsPanel } from "@/components/RewardsPanel";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { WeeklyReport } from "@/components/WeeklyReport";
import { ParentRewardsManager } from "@/components/ParentRewardsManager";

function fmtDuration(ms: number): string {
  if (ms < 1000) return "—";
  const totalSec = Math.round(ms / 1000);
  return `${Math.floor(totalSec / 60)} мин ${totalSec % 60} сек`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [langFilter, setLangFilter] = useState<Language | "all">("all");

  useEffect(() => {
    if (!user) return;
    return watchProfiles(user.uid, (ps) => {
      setProfiles(ps);
      setSelected((cur) => cur ?? ps[0]?.id ?? null);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !selected) return;
    void getSessions(user.uid, selected).then(setSessions);
    void getAchievements(user.uid, selected).then(setAchievements);
  }, [user, selected]);

  const profile = profiles.find((p) => p.id === selected);
  const avgWpm =
    profile && profile.totalMs > 3000
      ? Math.round(profile.totalWords / (profile.totalMs / 60000))
      : 0;
  const shownSessions = sessions.filter(
    (s) => langFilter === "all" || s.language === langFilter,
  );

  // Activity: books completed per day over last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const completedByDay = days.map(
    (d) =>
      sessions.filter(
        (s) =>
          s.completed &&
          s.updatedAt >= d.getTime() &&
          s.updatedAt < d.getTime() + 86_400_000,
      ).length,
  );
  const maxDay = Math.max(1, ...completedByDay);
  const weekTotal = completedByDay.reduce((a, b) => a + b, 0);
  const DOW = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  if (!user) return null;

  return (
    <div className="min-h-dvh px-4 py-4 max-w-3xl mx-auto pb-16">
      <header className="flex items-center justify-between mb-4">
        <button className="text-2xl p-1" onClick={() => navigate("/profiles")} aria-label="Назад">←</button>
        <h1 className="font-display font-extrabold text-lg text-ink dark:text-white">Родительский дашборд</h1>
        <ThemeToggle />
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`px-4 py-2 rounded-full font-semibold text-sm ${
              selected === p.id
                ? "bg-brand-500 text-white"
                : "bg-white dark:bg-[#211d2e] text-ink-soft dark:text-ink-faint shadow-sm"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {profile && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <ProfileAvatar value={profile.avatar} size={48} />
            <div>
              <p className="text-2xl font-display font-extrabold text-ink dark:text-white">{profile.name}</p>
              <p className="text-sm text-ink-faint">
                {profile.age} лет · {LANGUAGES.find((l) => l.value === profile.defaultLanguage)?.label}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10 p-4">
              <p className="text-2xl">📖</p>
              <p className="text-2xl font-display font-extrabold text-ink dark:text-white">{profile.booksCompleted}</p>
              <p className="text-sm text-ink-faint">Книг прочитано</p>
            </div>
            <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 p-4">
              <p className="text-2xl">🕐</p>
              <p className="text-xl font-display font-extrabold text-ink dark:text-white">{fmtDuration(profile.totalMs)}</p>
              <p className="text-sm text-ink-faint">Время чтения</p>
            </div>
            <div className="card bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 p-4">
              <p className="text-2xl">📈</p>
              <p className="text-2xl font-display font-extrabold text-ink dark:text-white">{avgWpm}</p>
              <p className="text-sm text-ink-faint">Слов в минуту</p>
            </div>
            <div className="card bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 p-4">
              <p className="text-2xl">🪙</p>
              <p className="text-2xl font-display font-extrabold text-ink dark:text-white">{profile.coins ?? 0}</p>
              <p className="text-sm text-ink-faint">Монет заработано</p>
            </div>
            <div className="card bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-500/10 dark:to-pink-500/10 p-4">
              <p className="text-2xl">⭐</p>
              <p className="text-2xl font-display font-extrabold text-ink dark:text-white">{profile.totalWords}</p>
              <p className="text-sm text-ink-faint">Слов прочитано</p>
            </div>
          </div>

          <div className="card p-4 mb-4">
            <p className="font-bold text-ink dark:text-white mb-3">📅 Активность за неделю</p>
            <div className="flex items-end justify-between gap-2 h-24">
              {days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg bg-brand-500/80 min-h-[3px] transition-all" style={{ height: `${(completedByDay[i] / maxDay) * 80}px` }} />
                  <span className={`text-xs ${i === 6 ? "text-brand-500 font-bold" : "text-ink-faint"}`}>{DOW[d.getDay()]}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-ink-faint mt-2">{weekTotal} книг за 7 дней</p>
          </div>

          <div className="card p-4 mb-4">
            <p className="font-bold text-ink dark:text-white mb-3">🌍 По языкам</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {LANGUAGES.map((l) => (
                <div key={l.value} className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-3">
                  <p className="text-lg">{l.flag}</p>
                  <p className="text-lg font-display font-extrabold text-ink dark:text-white">{profile.byLanguage?.[l.value]?.books ?? 0}</p>
                  <p className="text-xs text-ink-faint">{fmtDuration(profile.byLanguage?.[l.value]?.ms ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="font-bold text-ink dark:text-white mb-2">🏆 Достижения</p>
            {achievements.length === 0 ? (
              <div className="card p-4 text-center text-ink-faint text-sm">Пока нет достижений. Начни читать!</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {achievements.sort((a, b) => b.earnedAt - a.earnedAt).map((a) => {
                  const def = badgeById(a.id);
                  if (!def) return null;
                  return (
                    <div key={a.id} className="card p-3 flex items-center gap-3 border border-amber-200 dark:border-amber-500/30">
                      <span className="text-2xl">{def.icon}</span>
                      <div>
                        <p className="font-bold text-sm text-ink dark:text-white">{def.title}</p>
                        <p className="text-xs text-ink-faint">{def.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-ink dark:text-white">⚡ История чтения</p>
              <div className="flex gap-1">
                <button onClick={() => setLangFilter("all")} className={`px-2 py-1 rounded-lg text-xs font-semibold ${langFilter === "all" ? "bg-brand-500 text-white" : "bg-white dark:bg-[#211d2e] text-ink-faint shadow-sm"}`}>Все</button>
                {LANGUAGES.map((l) => (
                  <button key={l.value} onClick={() => setLangFilter(l.value)} className={`px-2 py-1 rounded-lg text-xs font-semibold ${langFilter === l.value ? "bg-brand-500 text-white" : "bg-white dark:bg-[#211d2e] text-ink-faint shadow-sm"}`}>{l.flag}</button>
                ))}
              </div>
            </div>
            {shownSessions.length === 0 ? (
              <div className="card p-6 text-center text-ink-faint text-sm">📖 Пока нет прочитанных книг</div>
            ) : (
              <div className="space-y-2">
                {shownSessions.map((s) => (
                  <div key={s.id} className="card p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-ink dark:text-white truncate">
                        {LANGUAGES.find((l) => l.value === s.language)?.flag} {s.bookTitle}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {new Date(s.updatedAt).toLocaleDateString("ru-RU")} · {s.wordsRead} слов · {fmtDuration(s.durationMs)} · {s.wpm} сл/мин
                      </p>
                    </div>
                    <span className="text-lg">{s.completed ? "⭐" : "⏳"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
