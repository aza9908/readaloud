import { useFamilyReaders } from "@/components/FamilyReaders";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { History, Languages, Medal } from "lucide-react";
import { BookserIcon, LanguageMark } from "@/components/BookserIcon";
import { ReadingMetrics, AchievementBadge } from "@/components/ReadingMetrics";
import { SectionHeader } from "@/components/RoomControls";
import { useAuth } from "@/hooks/useAuth";
import { getAchievements, getSessions } from "@/lib/firestore";
import { badgeById } from "@/lib/achievements";
import {
  LANGUAGES,
  type Achievement,
  type Language,
  type ReadingSession,
} from "@/lib/types";
import { RewardsPanel } from "@/components/RewardsPanel";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { WeeklyReport } from "@/components/WeeklyReport";
import { ParentRewardsManager } from "@/components/ParentRewardsManager";
import { ParentGate } from "@/components/ParentGate";
import { isUnlockFresh } from "@/lib/parentGate";

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
  const { profiles: family } = useFamilyReaders();
  const profiles = family ?? [];
  const [choice, setSelected] = useState<string | null>(null);
  const selected = profiles.find(p => p.id === choice)?.id ?? profiles[0]?.id;
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [langFilter, setLangFilter] = useState<Language | "all">("all");
  /**
   * Когда родитель ввёл код. Разрешение живёт ограниченное время, иначе
   * ребёнок откроет дашборд следом за родителем на том же телефоне.
   * Держим в памяти, а не в localStorage: закрыл вкладку — код нужен снова.
   */
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);
  const unlocked = isUnlockFresh(unlockedAt, Date.now());

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

  // Дашборд закрыт кодом: здесь управление наградами и списание монет,
  // и без замка ребёнок мог бы сам себе всё выдать.
  if (!unlocked) {
    return (
      <ParentGate
        uid={user.uid}
        onUnlocked={() => setUnlockedAt(Date.now())}
        onCancel={() => navigate("/profiles")}
      />
    );
  }

  return (
    <main className="section-shell report-shell">
      <SectionHeader title="Родительский дашборд" onBack={() => navigate("/profiles")} />

      {profiles.length > 1 && (
        <div className="reader-tabs" role="group" aria-label="Читатели">
          {profiles.map((p) => (
            <button
              key={p.id}
              aria-pressed={selected === p.id} onClick={() => setSelected(p.id)}
              className={`px-4 py-2 rounded-full font-bold text-sm transition-colors ${
                selected === p.id
                  ? "bg-brand-500 text-white"
                  : "bg-white dark:bg-[var(--surface)] text-ink-soft dark:text-ink-faint shadow-sm"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {profile && (
        <div className="report-content">
          <section className="report-overview">
            <div className="report-owner">
              <ProfileAvatar profileId={profile.id} value={profile.avatar} size={60} />
              <div>
                <p className="text-2xl font-display font-extrabold text-ink dark:text-white leading-tight">
                  {profile.name}
                </p>
                <p className="text-sm text-ink-faint">
                  {profile.age} лет · {LANGUAGES.find((l) => l.value === profile.defaultLanguage)?.label}
                </p>
              </div>
            </div>

            <ReadingMetrics books={profile.booksCompleted} time={fmtDuration(profile.totalMs)} pace={avgWpm} coins={profile.coins ?? 0} />
          </section>

          <WeeklyReport profile={profile} sessions={sessions} />

          <ParentRewardsManager uid={user.uid} />

          <RewardsPanel language={profile.defaultLanguage} coins={profile.coins ?? 0} />

          <div className="card p-4">
            <p className="font-display font-bold text-ink dark:text-white mb-3"><Languages className="section-symbol" /> По языкам</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {LANGUAGES.map((l) => (
                <div key={l.value} className="rounded-2xl bg-black/[0.03] dark:bg-white/5 p-3">
                  <p className="language-caption"><LanguageMark language={l.value} />{l.label}</p>
                  <p className="text-lg font-display font-extrabold text-ink dark:text-white">
                    {profile.byLanguage?.[l.value]?.books ?? 0}
                  </p>
                  <p className="text-xs text-ink-faint">{fmtDuration(profile.byLanguage?.[l.value]?.ms ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="font-display font-bold text-ink dark:text-white mb-2"><Medal className="section-symbol" /> Достижения</p>
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
                    return <AchievementBadge key={a.id} badge={def} />;
                  })}
              </div>
            )}
          </div>

          <div>
            <div className="history-heading">
              <p className="font-display font-bold text-ink dark:text-white"><History className="section-symbol" /> История чтения</p>
              <div className="flex gap-1 shrink-0">
                <button
                  aria-pressed={langFilter === "all"} onClick={() => setLangFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    langFilter === "all"
                      ? "bg-brand-500 text-white"
                      : "bg-white dark:bg-[var(--surface)] text-ink-faint shadow-sm"
                  }`}
                >
                  Все
                </button>
                {LANGUAGES.map((l) => (
                  <button
                    key={l.value}
                    aria-label={l.label} aria-pressed={langFilter === l.value} onClick={() => setLangFilter(l.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      langFilter === l.value
                        ? "bg-brand-500 text-white"
                        : "bg-white dark:bg-[var(--surface)] text-ink-faint shadow-sm"
                    }`}
                  >
                    <LanguageMark language={l.value} />
                  </button>
                ))}
              </div>
            </div>
            {shownSessions.length === 0 ? (
              <div className="card p-6 text-center text-ink-faint text-sm"><BookserIcon value="book" size={30} /> Пока нет прочитанных книг</div>
            ) : (
              <div className="space-y-2">
                {shownSessions.map((s) => (
                  <div key={s.id} className="card p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-ink dark:text-white truncate">
                        <LanguageMark language={s.language} announce /> {s.bookTitle}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {new Date(s.updatedAt).toLocaleDateString("ru-RU")} · {s.wordsRead} слов · {fmtDuration(s.durationMs)} · {s.wpm} сл/мин
                      </p>
                    </div>
                    <span role="img" aria-label={s.completed ? "Прочитано" : "В процессе"}><BookserIcon value={s.completed ? "star" : "⏳"} size={27} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
