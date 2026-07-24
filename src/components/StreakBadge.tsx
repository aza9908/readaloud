/**
 * StreakBadge — «дней подряд» в шапке.
 *
 * Самый доказанный механизм удержания в обучающих приложениях: ребёнок
 * возвращается, чтобы не потерять серию. Показываем огонёк со счётчиком и
 * неделю точками, чтобы прогресс был виден с одного взгляда.
 */
import { Flame } from "lucide-react";

export function StreakBadge({ streak, lastReadDay }: { streak: number; lastReadDay?: string }) {
  if (!streak || streak < 1) return null;

  const today = new Date();
  const todayStr = localDay(today);
  const yestStr = localDay(new Date(Date.now() - 86400000));
  // Серия «активна», если читали сегодня или вчера; иначе она вот-вот сгорит.
  const alive = lastReadDay === todayStr || lastReadDay === yestStr;
  const readToday = lastReadDay === todayStr;

  // Семь точек — последние 7 дней, закрашены те, что попадают в текущую серию.
  const dots = Array.from({ length: 7 }).map((_, i) => {
    const daysAgo = 6 - i;
    const inStreak = alive && daysAgo < streak && (readToday || daysAgo >= 1);
    return inStreak;
  });

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl px-3 py-2 border ${
        alive
          ? "bg-orange-400/12 border-orange-400/30"
          : "bg-black/[0.04] dark:bg-white/5 border-transparent"
      }`}
      title={`${streak} ${plural(streak)} подряд`}
    >
      <Flame
        className={alive ? "text-orange-500" : "text-ink-faint"}
        strokeWidth={2.4}
        fill={alive ? "currentColor" : "none"}
        style={{ width: 20, height: 20 }}
      />
      <span
        className={`font-display font-extrabold text-lg tabular-nums ${
          alive ? "text-orange-600 dark:text-orange-400" : "text-ink-faint"
        }`}
      >
        {streak}
      </span>
      <span className="hidden sm:flex items-center gap-1">
        {dots.map((on, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              on ? "bg-orange-500" : "bg-black/15 dark:bg-white/20"
            }`}
          />
        ))}
      </span>
    </div>
  );
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function plural(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "дня";
  return "дней";
}
