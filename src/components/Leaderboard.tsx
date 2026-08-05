/**
 * Leaderboard — общий рейтинг детей по монетам.
 *
 * Зачем: соревнование с ровесниками — сильнейший мотиватор в этом возрасте,
 * и именно на нём держатся Duolingo и подобные приложения.
 *
 * ПРИВАТНОСТЬ. Показываем только имя и монеты — ничего, по чему можно найти
 * ребёнка. Возраст, язык, книги и статистика в рейтинг не попадают: это
 * детское приложение, и лишние данные наружу выносить нельзя.
 */

import { useEffect, useState } from "react";
import { Trophy, Medal, Coins } from "lucide-react";
import { getLeaderboard, type LeaderboardRow } from "@/lib/firestore";
import { ProfileAvatar } from "@/components/ProfileAvatar";

export function Leaderboard({
  open, currentProfileId, onClose,
}: { open: boolean; currentProfileId: string; onClose: () => void }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    void getLeaderboard(50).then(setRows);
  }, [open]);

  if (!open) return null;

  const myIndex = rows?.findIndex((r) => r.profileId === currentProfileId) ?? -1;

  return (
    <div className="fixed inset-0 z-[68] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}>
      <div className="sheet max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="eyebrow mb-1">Рейтинг</p>
            <p className="text-sm text-ink-soft dark:text-ink-faint">Лучшие читатели по монетам</p>
          </div>
          <button className="text-2xl text-ink-faint w-8 h-8" onClick={onClose}>×</button>
        </div>

        {rows === null ? (
          <p className="text-sm text-ink-faint text-center py-8">Загружаю…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-faint text-center py-8">Пока никого нет — стань первым!</p>
        ) : (
          <>
            {/* Чемпион — отдельной большой карточкой */}
            <ChampionCard row={rows[0]} isMe={rows[0].profileId === currentProfileId} />

            <div className="space-y-2 mt-3">
              {rows.slice(1).map((r, i) => {
                const place = i + 2;
                const isMe = r.profileId === currentProfileId;
                return (
                  <div key={r.profileId}
                    className={`flex items-center gap-3 rounded-2xl p-3 ${
                      isMe ? "bg-brand-500/10 ring-2 ring-brand-400" : "bg-black/[0.02] dark:bg-white/5"
                    }`}>
                    <span className="w-7 text-center font-display font-extrabold text-ink-faint shrink-0">
                      {place <= 3 ? <Medal className="w-5 h-5 mx-auto text-amber-500" strokeWidth={2.2} /> : place}
                    </span>
                    <ProfileAvatar value={r.avatar} size={32} />
                    <span className="flex-1 font-bold text-ink dark:text-white truncate">
                      {r.name}{isMe && " (ты)"}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 text-sm">
                      <Coins className="w-3.5 h-3.5" strokeWidth={2.4} />{r.coins}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Если ребёнок не попал в показанный список — покажем его место
                отдельно, иначе рейтинг демотивирует вместо того чтобы тянуть. */}
            {myIndex === -1 && (
              <p className="text-xs text-ink-faint text-center mt-4">
                Читай больше — и попадёшь в список лучших!
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Карточка чемпиона — с трофеем и приветствием. */
function ChampionCard({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  return (
    <div className="rounded-3xl p-5 text-center bg-gradient-to-br from-amber-100 to-yellow-50 dark:from-amber-500/15 dark:to-yellow-500/10 border-2 border-amber-400/40">
      <Trophy className="w-10 h-10 mx-auto text-amber-500 mb-2" strokeWidth={2} fill="currentColor" />
      <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Чемпион
      </p>
      <div className="flex items-center justify-center gap-2 mt-2">
        <ProfileAvatar value={row.avatar} size={44} />
        <p className="font-display font-extrabold text-2xl text-ink dark:text-white">{row.name}</p>
      </div>
      <p className="flex items-center justify-center gap-1.5 mt-1 font-bold text-amber-600 dark:text-amber-400">
        <Coins className="w-4 h-4" strokeWidth={2.4} />{row.coins}
      </p>
      {isMe && (
        <p className="mt-2 text-sm font-bold text-amber-700 dark:text-amber-300">
          Привет, чемпион! 🏆
        </p>
      )}
    </div>
  );
}
