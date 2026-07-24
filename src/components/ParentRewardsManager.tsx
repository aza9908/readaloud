/**
 * ParentRewardsManager — родительская панель наград в дашборде.
 *
 * Две задачи: (1) вести список настоящих наград и их цену в монетах,
 * (2) подтверждать или отклонять запросы детей. Монеты списываются только
 * при подтверждении (транзакцией на стороне firestore).
 */

import { useEffect, useRef, useState } from "react";
import { Coins, Plus, Trash2, Check, X, Gift, Bell, Camera, Loader2 } from "lucide-react";
import {
  getRewards, addReward, deleteReward,
  getPendingRequests, approveRewardRequest, declineRewardRequest,
} from "@/lib/firestore";
import { compressImage, ACCEPTED_IMAGE_TYPES } from "@/lib/imageCompress";
import { useToast } from "@/components/Toast";
import type { ParentReward, RewardRequest } from "@/lib/types";

/** Быстрый выбор эмодзи для новой награды. */
const EMOJI_CHOICES = ["🍦", "🍿", "⚽️", "🎮", "🍕", "🎁", "🧸", "🚲", "📱", "🎨", "🍫", "🎢"];

/** Готовые примеры — чтобы родителю было с чего начать. */
const PRESETS: { emoji: string; title: string; price: number }[] = [
  { emoji: "🍦", title: "Мороженое", price: 300 },
  { emoji: "🎮", title: "30 минут PlayStation", price: 500 },
  { emoji: "🍿", title: "Поход в кино", price: 4000 },
  { emoji: "⚽️", title: "Футбольный мяч", price: 5000 },
];

export function ParentRewardsManager({ uid }: { uid: string }) {
  const toast = useToast();
  const [rewards, setRewards] = useState<ParentReward[]>([]);
  const [requests, setRequests] = useState<RewardRequest[]>([]);
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState("🍦");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch {
      toast({ icon: "⚠️", title: "Не удалось обработать фото" });
    } finally {
      setUploading(false);
    }
  };

  const reload = async () => {
    const [r, q] = await Promise.all([getRewards(uid), getPendingRequests(uid)]);
    setRewards(r);
    setRequests(q);
  };
  useEffect(() => { void reload(); }, [uid]);

  const create = async (preset?: typeof PRESETS[number]) => {
    const t = preset?.title ?? title.trim();
    const p = preset?.price ?? parseInt(price, 10);
    const e = preset?.emoji ?? emoji;
    if (!t || !p || p < 1) {
      toast({ icon: "⚠️", title: "Заполни название и цену" });
      return;
    }
    setBusy(true);
    try {
      await addReward(uid, { title: t, emoji: e, price: p, ...(photo ? { photo } : {}) });
      setTitle(""); setPrice(""); setPhoto(null); setAdding(false);
      await reload();
      toast({ icon: "🎁", title: "Награда добавлена" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: ParentReward) => {
    await deleteReward(uid, r.id);
    await reload();
  };

  const approve = async (req: RewardRequest) => {
    setBusy(true);
    try {
      const res = await approveRewardRequest(uid, req);
      if (res.ok) {
        toast({ icon: "✅", title: "Награда выдана", description: `${req.rewardTitle} · −${req.price} монет` });
      } else if (res.reason === "not_enough") {
        toast({ icon: "🪙", title: "У ребёнка не хватает монет" });
      } else if (res.reason === "already_resolved") {
        toast({ icon: "ℹ️", title: "Запрос уже обработан" });
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const decline = async (req: RewardRequest) => {
    await declineRewardRequest(uid, req.id);
    await reload();
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display font-bold text-ink dark:text-white text-lg flex items-center gap-2">
          <Gift className="w-5 h-5 text-brand-500" strokeWidth={2.2} /> Награды за монеты
        </p>
        {!adding && (
          <button className="chip chip-on !py-1.5" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={2.6} />Добавить
          </button>
        )}
      </div>

      {/* Ожидающие запросы — самое важное, показываем вверху */}
      {requests.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-bold text-brand-600 dark:text-brand-300 flex items-center gap-1.5">
            <Bell className="w-4 h-4" strokeWidth={2.4} /> Запросы детей ({requests.length})
          </p>
          {requests.map((req) => (
            <div key={req.id} className="rounded-2xl bg-brand-500/8 border border-brand-500/25 p-3 flex items-center gap-3">
              {req.rewardPhoto ? (
                <img src={req.rewardPhoto} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
              ) : (
                <span className="text-3xl shrink-0">{req.rewardEmoji}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink dark:text-white truncate">{req.rewardTitle}</p>
                <p className="text-xs text-ink-faint">
                  {req.profileName} · {req.price} монет
                </p>
              </div>
              <button
                className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500 text-white grid place-items-center disabled:opacity-50"
                disabled={busy} onClick={() => void approve(req)} aria-label="Выдать"
              >
                <Check className="w-5 h-5" strokeWidth={2.6} />
              </button>
              <button
                className="shrink-0 w-9 h-9 rounded-xl bg-black/[0.06] dark:bg-white/10 text-ink-soft grid place-items-center disabled:opacity-50"
                disabled={busy} onClick={() => void decline(req)} aria-label="Отклонить"
              >
                <X className="w-5 h-5" strokeWidth={2.6} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Форма добавления */}
      {adding && (
        <div className="rounded-2xl border-2 border-brand-500/20 p-4 mb-4 space-y-3">
          {/* Фото награды или выбор эмодзи */}
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                className="hidden"
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-brand-400/40 grid place-items-center overflow-hidden bg-black/[0.02] dark:bg-white/5"
                aria-label="Загрузить фото награды"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                ) : photo ? (
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Camera className="w-6 h-6 text-brand-400 mx-auto" strokeWidth={2} />
                    <span className="text-[10px] text-ink-faint">Фото</span>
                  </div>
                )}
              </button>
              {photo && (
                <button
                  className="text-[11px] text-ink-faint mt-1 w-full text-center"
                  onClick={() => setPhoto(null)}
                >
                  Убрать
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-faint mb-1.5">
                {photo ? "Фото загружено" : "Или выберите значок:"}
              </p>
              {!photo && (
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_CHOICES.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-xl text-xl grid place-items-center transition-all ${
                        emoji === e ? "bg-brand-500/15 ring-2 ring-brand-500" : "bg-black/[0.04] dark:bg-white/5"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <input
            className="input w-full"
            placeholder="Название: Мороженое, Поход в кино…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
          />
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Coins className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={2.4} />
              <input
                className="input w-full !pl-9"
                placeholder="Цена в монетах"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button className="btn-primary !py-2.5" disabled={busy || uploading} onClick={() => void create()}>
              Добавить
            </button>
            <button className="btn-ghost !py-2.5" onClick={() => { setAdding(false); setPhoto(null); }}>Отмена</button>
          </div>
        </div>
      )}

      {/* Пресеты, если наград ещё нет */}
      {rewards.length === 0 && !adding && (
        <div className="mb-2">
          <p className="text-sm text-ink-soft dark:text-ink-faint mb-2">
            Добавьте настоящие награды — ребёнок будет копить на них монеты за чтение.
            Быстрый старт:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.title}
                className="card !shadow-none border border-line p-3 flex items-center gap-2 text-left hover:border-brand-400 transition-colors"
                disabled={busy}
                onClick={() => void create(p)}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink dark:text-white truncate">{p.title}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{p.price} монет</p>
                </div>
                <Plus className="w-4 h-4 text-brand-400 ml-auto shrink-0" strokeWidth={2.6} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Список наград */}
      {rewards.length > 0 && (
        <div className="space-y-2">
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-black/[0.02] dark:bg-white/5 p-3">
              {r.photo ? (
                <img src={r.photo} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
              ) : (
                <span className="text-2xl shrink-0 w-10 text-center">{r.emoji}</span>
              )}
              <p className="flex-1 font-bold text-ink dark:text-white truncate">{r.title}</p>
              <span className="flex items-center gap-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                <Coins className="w-3.5 h-3.5" strokeWidth={2.4} /> {r.price}
              </span>
              <button
                className="shrink-0 w-8 h-8 rounded-xl bg-black/[0.04] dark:bg-white/10 text-ink-faint grid place-items-center"
                onClick={() => void remove(r)} aria-label="Удалить"
              >
                <Trash2 className="w-4 h-4" strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
