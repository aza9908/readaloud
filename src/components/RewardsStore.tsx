/**
 * RewardsStore — витрина «хотелок», которые добавил родитель.
 *
 * Отличие от магазина героев: героя ребёнок открывает сам и мгновенно, а
 * настоящую награду (мороженое, поход в кино) выдаёт родитель. Поэтому здесь
 * ребёнок не тратит монеты напрямую, а отправляет запрос — монеты спишутся,
 * когда родитель подтвердит выдачу. Так ребёнок не может «купить» пломбир,
 * который родитель не собирался покупать.
 */

import { useEffect, useMemo, useState } from "react";
import { Coins, Gift, Check, Hourglass } from "lucide-react";
import { getRewards, requestReward, getPendingRequests } from "@/lib/firestore";
import { useToast } from "@/components/Toast";
import type { ChildProfile, ParentReward } from "@/lib/types";

export function RewardsStore({
  open, uid, profile, onClose,
}: {
  open: boolean;
  uid: string;
  profile: ChildProfile;
  onClose: () => void;
}) {
  const toast = useToast();
  const [rewards, setRewards] = useState<ParentReward[] | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const coins = profile.coins ?? 0;

  useEffect(() => {
    if (!open) return;
    void Promise.all([getRewards(uid), getPendingRequests(uid)]).then(([r, reqs]) => {
      setRewards(r.filter((x) => x.active));
      setPendingIds(
        new Set(reqs.filter((q) => q.profileId === profile.id).map((q) => q.rewardId)),
      );
    });
  }, [open, uid, profile.id]);

  const sorted = useMemo(
    () => (rewards ? [...rewards].sort((a, b) => a.price - b.price) : null),
    [rewards],
  );

  if (!open) return null;

  const request = async (r: ParentReward) => {
    if (busy) return;
    setBusy(r.id);
    try {
      const res = await requestReward(uid, profile, r);
      if (res.ok) {
        setPendingIds((s) => new Set(s).add(r.id));
        toast({ icon: "✨", title: "Запрос отправлен родителям", description: r.title });
      } else if (res.reason === "not_enough") {
        toast({ icon: "🪙", title: "Пока не хватает монет", description: "Почитай ещё немного" });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[66] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="sheet max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="eyebrow mb-1">Мои хотелки</p>
            <p className="text-sm text-ink-soft dark:text-ink-faint">Копи монеты и выбирай награду</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 px-3 py-1">
              <Coins className="w-4 h-4 text-amber-500" strokeWidth={2.4} />
              <span className="font-display font-bold text-amber-600 dark:text-amber-400 tabular-nums">{coins}</span>
            </span>
            <button className="text-2xl text-ink-faint w-8 h-8" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
        </div>

        {sorted === null ? (
          <p className="text-sm text-ink-faint text-center py-8">Загружаю…</p>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8">
            <Gift className="w-12 h-12 mx-auto text-brand-300 mb-3" strokeWidth={1.6} />
            <p className="text-ink-soft dark:text-ink-faint">
              Здесь появятся награды, которые добавят твои родители.
            </p>
            <p className="text-sm text-ink-faint mt-1">
              Покажи им приложение — пусть добавят твои любимые хотелки!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((r) => {
              const affordable = coins >= r.price;
              const pending = pendingIds.has(r.id);
              const progress = Math.min(100, (coins / r.price) * 100);
              return (
                <div key={r.id} className="card p-4 flex items-center gap-4">
                  {r.photo ? (
                    <img src={r.photo} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                  ) : (
                    <span className="text-4xl shrink-0 w-14 text-center">{r.emoji}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-ink dark:text-white truncate">{r.title}</p>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                      <Coins className="w-3.5 h-3.5" strokeWidth={2.4} /> {r.price}
                    </div>
                    {!affordable && !pending && (
                      <div className="mt-2 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                  {pending ? (
                    <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-brand-500 rounded-full bg-brand-500/10 px-3 py-2">
                      <Hourglass className="w-3.5 h-3.5" strokeWidth={2.4} /> Ждёт
                    </span>
                  ) : (
                    <button
                      className={`shrink-0 rounded-2xl py-2 px-4 text-sm font-bold transition-all ${
                        affordable
                          ? "bg-brand-500 text-white hover:bg-brand-600"
                          : "bg-black/[0.05] dark:bg-white/10 text-ink-faint"
                      }`}
                      disabled={busy === r.id || !affordable}
                      onClick={() => void request(r)}
                    >
                      {affordable ? "Хочу!" : `−${r.price - coins}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-ink-faint leading-relaxed mt-4">
          Когда монет хватит, нажми «Хочу!» — родители получат запрос и выдадут награду.
          Монеты спишутся после подтверждения.
        </p>
      </div>
    </div>
  );
}
