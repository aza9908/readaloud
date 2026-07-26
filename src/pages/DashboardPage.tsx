import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
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
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec} сек`;
  return `${min} мин ${sec} сек`;
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

  if (!user) return null;

  return (
    <div className="min-h-dvh px-4 py-4 max-w-3xl mx-auto pb-16">
      {/* Та же сетка, что и на экране профилей: заголовок точно по центру
          независимо от того, что стоит по бокам. */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center mb-5 gap-2">
        <div className="justify-self-start">
          <button
            className="w-10 h-10 rounded-2xl bg-white/70 dark:bg-white/10 shadow-soft grid place-items-center"
            onClick={() => navigate("/profiles")}
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5 text-ink dark:text-white" strokeWidth={2.4} />
          </button>
        </div>
        <h1 className="justify-self-center font-display font-extrabold text-lg text-ink dark:text-white text-center">
          Родительский дашборд
        </h1>
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </header>

      {profiles.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`px-4 py-2 rounded-full font-bold text-sm transition-colors ${
                selected === p.id
                  ? "bg-brand-500 text-white"
                  : "bg-white dark:bg-[#211d2e] text-ink-soft dark:text-ink-faint shadow-sm"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {profile && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ProfileAvatar value={profile.avatar} size={52} />
            <div>
              <p className="text-2xl font-display font-extrabold text-ink dark:text-white leading-tight">
                {profile.name}
              </p>
              <p className="text-sm text-ink-faint">
                {profile.age} лет · {LANGUAGES.find((l) => l.value === profile.defaultLanguage)?.label}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard tint="purple" emoji="📖" value={`${profile.booksCompleted}`} label="Книг прочитано" />
            <StatCard tint="blue" emoji="🕐" value={fmtDuration(profile.totalMs)} label="Время чтения" small />
            <StatCard tint="green" emoji="📈" value={`${avgWpm}`} label="Слов в минуту" />
            <StatCard tint="amber" emoji="🪙" value={`${profile.coins ?? 0}`} label="Монет" />
          </div>

          <WeeklyReport profile={profile} sessions={sessions} />

          <ParentRewardsManager uid={user.uid} />

          <RewardsPanel language={profile.defaultLanguage} coins={profile.coins ?? 0} />

          <div className="card p-4">
            <p className="font-display font-bold text-ink dark:text-white mb-3">🌍 По языкам</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {LANGUAGES.map((l) => (
                <div key={l.value} className="rounded-2xl bg-black/[0.03] dark:bg-white/5 p-3">
                  <p className="text-lg">{l.flag}</p>
                  <p className="text-lg font-display font-extrabold text-ink dark:text-white">
                    {profile.byLanguage?.[l.value]?.books ?? 0}
                  </p>
                  <p className="text-xs text-ink-faint">{fmtDuration(profile.byLanguage?.[l.value]?.ms ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="font-display font-bold text-ink dark:text-white mb-2">🏆 Достижения</p>
            {achievements.length === 0 ? (
              <div className="card p-4 text-center text-ink-faint text-sm">
                Пока нет достижений. Начни читать!
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {achievements
                  .sort((a, b) => b.earnedAt - a.earnedAt)
                  .map((a) => {
                    const def = badgeById(a.id);
                    if (!def) return null;
                    return (
                      <div
                        key={a.id}
                        className="card p-3 flex items-center gap-3 border border-amber-200 dark:border-amber-500/30"
                      >
                        <span className="text-2xl">{def.icon}</span>
                        <div className="min-w-0">
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
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="font-display font-bold text-ink dark:text-white">⚡ История чтения</p>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setLangFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    langFilter === "all"
                      ? "bg-brand-500 text-white"
                      : "bg-white dark:bg-[#211d2e] text-ink-faint shadow-sm"
                  }`}
                >
                  Все
                </button>
                {LANGUAGES.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLangFilter(l.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      langFilter === l.value
                        ? "bg-brand-500 text-white"
                        : "bg-white dark:bg-[#211d2e] text-ink-faint shadow-sm"
                    }`}
                  >
                    {l.flag}
                  </button>
                ))}
              </div>
            </div>
            {shownSessions.length === 0 ? (
              <div className="card p-6 text-center text-ink-faint text-sm">📖 Пока нет прочитанных книг</div>
            ) : (
              <div className="space-y-2">
                {shownSessions.map((s) => (
                  <div key={s.id} className="card p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-ink dark:text-white truncate">
                        {LANGUAGES.find((l) => l.value === s.language)?.flag} {s.bookTitle}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {new Date(s.updatedAt).toLocaleDateString("ru-RU")} · {s.wordsRead} слов · {fmtDuration(s.durationMs)} · {s.wpm} сл/мин
                      </p>
                    </div>
                    <span className="text-lg shrink-0">{s.completed ? "⭐" : "⏳"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  tint, emoji, value, label, small,
}: {
  tint: "purple" | "blue" | "green" | "amber";
  emoji: string;
  value: string;
  label: string;
  small?: boolean;
}) {
  const tints = {
    purple: "from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10",
    blue: "from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10",
    green: "from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10",
    amber: "from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10",
  };
  return (
    <div className={`card bg-gradient-to-br ${tints[tint]} p-4`}>
      <p className="text-2xl mb-1">{emoji}</p>
      <p className={`font-display font-extrabold text-ink dark:text-white ${small ? "text-lg leading-tight" : "text-2xl"}`}>
        {value}
      </p>
      <p className="text-xs text-ink-faint mt-0.5">{label}</p>
    </div>
  );
}
