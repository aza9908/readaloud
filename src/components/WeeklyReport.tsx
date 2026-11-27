/**
 * WeeklyReport — родительская карточка «что было за неделю».
 *
 * Это главный аргумент для платящего родителя: он платит не за игру ребёнка,
 * а за то, что видит прогресс. Показываем минуты, слова, динамику скорости и —
 * ключевое — слова, которые даются тяжело (их приложение уже детектирует во
 * время чтения). Ничего не выдумываем: если данных мало, честно об этом пишем.
 */

import { Check } from "lucide-react";
import { useMemo } from "react";
import { Clock, BookOpen, Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ChildProfile, ReadingSession } from "@/lib/types";

interface Props {
  profile: ChildProfile;
  sessions: ReadingSession[];
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeeklyReport({ profile, sessions }: Props) {
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const prevWeekAgo = now - 14 * 86400000;

  const stats = useMemo(() => {
    const inWindow = (from: number, to: number) =>
      sessions.filter((s) => {
        const t = s.updatedAt ?? s.startedAt ?? 0;
        return t >= from && t < to;
      });

    const week = inWindow(weekAgo, now);
    const prev = inWindow(prevWeekAgo, weekAgo);

    const sum = (arr: ReadingSession[], f: (s: ReadingSession) => number) =>
      arr.reduce((a, s) => a + (f(s) || 0), 0);

    const minutes = Math.round(sum(week, (s) => s.durationMs ?? 0) / 60000);
    const words = sum(week, (s) => s.wordsRead ?? 0);
    const books = week.filter((s) => s.completed).length;

    // Средняя скорость по неделям — для стрелки динамики.
    const wpmOf = (arr: ReadingSession[]) => {
      const withWpm = arr.filter((s) => (s.wpm ?? 0) > 0);
      if (!withWpm.length) return 0;
      return Math.round(sum(withWpm, (s) => s.wpm ?? 0) / withWpm.length);
    };
    const wpmNow = wpmOf(week);
    const wpmPrev = wpmOf(prev);

    // Дни недели, в которые читал — для мини-календаря.
    const activeDays = new Set(
      week.map((s) => localDay(new Date(s.updatedAt ?? s.startedAt ?? now))),
    );

    return { minutes, words, books, wpmNow, wpmPrev, activeDays, sessionCount: week.length };
  }, [sessions, now, weekAgo, prevWeekAgo]);

  // Топ трудных слов из копилки профиля.
  const hardWords = useMemo(() => {
    const h = profile.hardWords ?? {};
    return Object.entries(h)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([w]) => w);
  }, [profile.hardWords]);

  const wpmDelta = stats.wpmNow - stats.wpmPrev;
  const hasData = stats.sessionCount > 0;

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now - (6 - i) * 86400000);
    return { label: ["П", "В", "С", "Ч", "П", "С", "В"][d.getDay() === 0 ? 6 : d.getDay() - 1], active: stats.activeDays.has(localDay(d)) };
  });

  return (
    <div className="card weekly-report p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display font-bold text-ink dark:text-white text-lg">Отчёт за неделю</p>
        <span className="text-xs text-ink-faint">{profile.name}</span>
      </div>

      {!hasData ? (
        <p className="text-sm text-ink-soft dark:text-ink-faint">
          На этой неделе занятий пока не было. Как только {profile.name} почитает,
          здесь появится статистика: сколько времени, какие слова даются тяжело
          и как растёт скорость.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Metric icon={<Clock className="w-4 h-4" />} value={`${stats.minutes}`} unit="мин" label="за неделю" tint="brand" />
            <Metric icon={<BookOpen className="w-4 h-4" />} value={`${stats.books}`} unit={plural(stats.books, "книга", "книги", "книг")} label="дочитано" tint="green" />
            <Metric
              icon={<Gauge className="w-4 h-4" />}
              value={`${stats.wpmNow}`}
              unit="сл/мин"
              label="скорость"
              tint="amber"
              delta={stats.wpmPrev > 0 ? wpmDelta : undefined}
            />
          </div>

          {/* мини-календарь недели */}
          <div className="flex items-center justify-between mb-4 px-1">
            {last7.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1" aria-label={d.active ? "День с чтением" : "День без чтения"}>
                <span
                  className={`w-7 h-7 rounded-xl grid place-items-center text-xs font-bold ${
                    d.active
                      ? "bg-brand-500 text-white"
                      : "bg-black/[0.04] dark:bg-white/5 text-ink-faint"
                  }`}
                >
                  {d.active && <Check size={14} aria-hidden="true" />}
                </span>
                <span className="text-[10px] text-ink-faint">{d.label}</span>
              </div>
            ))}
          </div>

          {hardWords.length > 0 && (
            <div className="rounded-2xl bg-amber-400/10 border border-amber-400/25 p-3">
              <p className="text-sm font-bold text-ink dark:text-white mb-2">
                Слова, над которыми стоит поработать
              </p>
              <div className="flex flex-wrap gap-2">
                {hardWords.map((w) => (
                  <span
                    key={w}
                    className="rounded-full bg-white/70 dark:bg-white/10 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-400"
                  >
                    {w}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-ink-faint mt-2 leading-relaxed">
                Эти слова {profile.name} читал{`а`.slice(0, 0)} с запинками — их можно
                разобрать вместе перед следующим чтением.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  icon, value, unit, label, tint, delta,
}: {
  icon: React.ReactNode; value: string; unit: string; label: string;
  tint: "brand" | "green" | "amber"; delta?: number;
}) {
  return (
    <div className="weekly-metric" data-tone={tint}>
      <div className="flex items-center justify-center gap-1 opacity-70 mb-1">{icon}</div>
      <div className="flex items-baseline justify-center gap-1">
        <span className="font-display font-extrabold text-xl">{value}</span>
        <span className="text-[11px] font-bold opacity-80">{unit}</span>
      </div>
      {delta !== undefined && (
        <div className="flex items-center justify-center gap-0.5 text-[11px] font-bold mt-0.5">
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {delta > 0 ? `+${delta}` : delta}
        </div>
      )}
      <div className="text-[10px] opacity-70 mt-0.5">{label}</div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
