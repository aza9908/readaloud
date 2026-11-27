/**
 * AvatarShop — витрина персонажей, которых ребёнок открывает за монеты.
 *
 * Монеты можно потратить двумя способами: здесь (сразу, внутри приложения)
 * или обменять у родителей на настоящий приз. Внутриигровая награда даёт
 * мгновенное подкрепление, родительская — крупную цель.
 */

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Coins, Check, Lock, X } from "lucide-react";
import {
  AVATARS, RARITY_COLOR, RARITY_LABEL, toAvatarValue, isAvatarId, fromAvatarValue,
  type AvatarDef, type Rarity,
} from "@/lib/avatars";
import { useFamilyReaders } from "@/components/FamilyReaders";
import { CompanionPicker } from "@/components/CompanionPicker";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { purchaseAvatar, setProfileAvatar } from "@/lib/firestore";
import { useToast } from "@/components/Toast";
import type { ChildProfile, Language } from "@/lib/types";

const COPY = {
  ru: {
    title: "Магазин героев", starters: "Стартовые герои", close: "Закрыть", saveError: "Не удалось сохранить выбор",
    sub: "Читай книги — открывай персонажей",
    yours: "У тебя",
    owned: "Открыт",
    equipped: "Надет",
    wear: "Надеть",
    buy: "Открыть",
    need: "не хватает",
    bought: "Новый герой открыт!",
    notEnough: "Пока не хватает монет",
    keepReading: "Дочитай ещё немного — и герой твой",
    equipped_toast: "Герой выбран",
    all: "Все", plush: "Плюшевые", girls: "Для девочек", boys: "Для мальчиков",
    hint: "Монеты можно потратить здесь или обменять у родителей на настоящий приз.",
  },
  kk: {
    title: "Кейіпкерлер дүкені", starters: "Бастапқы кейіпкерлер", close: "Жабу", saveError: "Таңдауды сақтау мүмкін болмады",
    sub: "Кітап оқы — кейіпкер аш",
    yours: "Сенде",
    owned: "Ашылған",
    equipped: "Киілген",
    wear: "Кию",
    buy: "Ашу",
    need: "жетпейді",
    bought: "Жаңа кейіпкер ашылды!",
    notEnough: "Әзірге монета жетпейді",
    keepReading: "Тағы біраз оқы — кейіпкер сенікі болады",
    equipped_toast: "Кейіпкер таңдалды",
    all: "Барлығы", plush: "Жұмсақ ойыншықтар", girls: "Қыздарға", boys: "Ұлдарға",
    hint: "Монетаны осында жұмсауға немесе ата-анаңнан нағыз сыйлыққа айырбастауға болады.",
  },
  en: {
    title: "Hero shop", starters: "Starter companions", close: "Close", saveError: "Couldn’t save your selection",
    sub: "Read books — unlock characters",
    yours: "You have",
    owned: "Unlocked",
    equipped: "Worn",
    wear: "Wear",
    buy: "Unlock",
    need: "short by",
    bought: "New hero unlocked!",
    notEnough: "Not enough coins yet",
    keepReading: "Read a bit more and the hero is yours",
    equipped_toast: "Hero selected",
    all: "All", plush: "Plush", girls: "For girls", boys: "For boys",
    hint: "Coins can be spent here or exchanged with your parents for a real prize.",
  },
} as const;

const FILTERS = ["all", "plush", "girls", "boys"] as const;

interface Props {
  open: boolean;
  uid: string;
  profile: ChildProfile;
  language: Language;
  onClose: () => void;
  onChanged: (avatar: string, purchase?: { id: string; coins: number }) => void;
}

export function AvatarShop({ open, uid, profile, language, onClose, onChanged }: Props) {
  const c = COPY[language] ?? COPY.ru;
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [coins, setCoins] = useState(profile.coins ?? 0);
  const [owned, setOwned] = useState<string[]>(profile.unlockedAvatars ?? []);
  const { portrait, otherAnimals } = useFamilyReaders();
  const [choice, setEquipped] = useState<string | null>(null);
  const equipped = portrait(profile.id, choice ?? profile.avatar);

  const list = useMemo(() => {
    /**
     * Турнирные герои в продажу не попадают: их нельзя купить, только
     * выиграть. Уже открытые показываем — ребёнок должен видеть свой трофей
     * в коллекции.
     */
    const sellable = AVATARS.filter((a) => !a.tournamentOnly || owned.includes(a.id));
    const arr = sellable.filter((a) => {
      if (filter === "plush") return a.collection === "plush";
      return filter === "all" || a.appeal === filter || a.appeal === "neutral";
    });
    // Доступные к покупке — выше, чтобы цель была видна сразу.
    const order: Record<Rarity, number> = { common: 0, rare: 1, legendary: 2, mythic: 3 };
    return [...arr].sort((a, b) => {
      const ao = owned.includes(a.id) ? 1 : 0;
      const bo = owned.includes(b.id) ? 1 : 0;
      if (ao !== bo) return ao - bo;
      return order[a.rarity] - order[b.rarity] || a.price - b.price;
    });
  }, [filter, owned]);

  if (!open) return null;

  const buy = async (def: AvatarDef) => {
    if (busy) return;
    setBusy(def.id);
    try {
      const res = await purchaseAvatar(uid, profile.id, def.id, def.price);
      if (res.ok) {
        setCoins(res.coinsLeft);
        setOwned((o) => [...o, def.id]);
        await setProfileAvatar(uid, profile.id, toAvatarValue(def.id));
        setEquipped(toAvatarValue(def.id));
        toast({ icon: "🎉", title: c.bought, description: def.name[language] ?? def.name.ru });
        onChanged(toAvatarValue(def.id), { id: def.id, coins: res.coinsLeft });
      } else if (res.reason === "not_enough") {
        toast({ icon: "🪙", title: c.notEnough, description: c.keepReading });
        if (res.coinsLeft !== undefined) setCoins(res.coinsLeft);
      }
    } finally {
      setBusy(null);
    }
  };

  const wear = async (value: string) => {
    if (busy || value === equipped) return;
    setBusy(value);
    try {
      await setProfileAvatar(uid, profile.id, value);
      setEquipped(value);
      toast({ icon: "✨", title: c.equipped_toast });
      onChanged(value);
    } catch {
      toast({ icon: "⚠️", title: c.saveError });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="room-scrim" />
        <Dialog.Content className="room-sheet hero-shop" aria-describedby={undefined}>
          <div className="sheet-heading">
            <Dialog.Title>{c.title}</Dialog.Title>
            <Dialog.Close className="round-control" aria-label={c.close}><X size={18} /></Dialog.Close>
          </div>
          <div className="hero-owner">
            <ProfileAvatar value={equipped} size={64} language={language} />
            <strong>{profile.name}</strong>
            <span className="flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 px-3 py-1">
              <Coins className="w-4 h-4 text-amber-500" strokeWidth={2.4} />
              <span className="font-display font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {coins}
              </span>
            </span>
          </div>
          <fieldset className="starter-display">
            <legend>{c.starters}</legend>
            <CompanionPicker value={equipped} taken={otherAnimals(profile.id)} onSelect={v => void wear(v)} language={language} disabled={!!busy} />
          </fieldset>
          <div className="hero-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`chip ${filter === f ? "chip-on" : "chip-off"}`}
              >
                {c[f]}
              </button>
            ))}
          </div>

          <div className="shop-collection">
            {list.map((def) => {
              const isOwned = owned.includes(def.id);
              const isOn = isAvatarId(equipped) && fromAvatarValue(equipped) === def.id;
              const affordable = coins >= def.price;
              const short = def.price - coins;
              return (
                <div
                  key={def.id}
                  className={`card p-3 flex flex-col items-center text-center transition-all ${
                    isOn ? "ring-2 ring-brand-500" : ""
                  }`}
                >
                  <AvatarPortrait def={def} size={78} locked={!isOwned} language={language} />
                  <p className="font-display font-bold text-sm text-ink dark:text-white mt-2 leading-tight">
                    {def.name[language] ?? def.name.ru}
                  </p>
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-wide mt-0.5"
                    style={{ color: RARITY_COLOR[def.rarity] }}
                  >
                    {RARITY_LABEL[def.rarity][language] ?? RARITY_LABEL[def.rarity].ru}
                  </span>

                  {def.tournamentOnly && !isOwned ? (
                    <span className="mt-2 text-[11px] font-bold text-red-500">
                      Только за победу в турнире
                    </span>
                  ) : isOwned ? (
                    isOn ? (
                      <span className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-500">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} /> {c.equipped}
                      </span>
                    ) : (
                      <button
                        className="btn-ghost mt-2 !py-1.5 !px-4 text-xs w-full"
                        disabled={!!busy}
                        onClick={() => void wear(toAvatarValue(def.id))}
                      >
                        {c.wear}
                      </button>
                    )
                  ) : (
                    <>
                      <span className="mt-2 flex items-center gap-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                        <Coins className="w-3.5 h-3.5" strokeWidth={2.4} /> {def.price}
                      </span>
                      <button
                        className={`mt-1.5 w-full rounded-2xl py-1.5 px-3 text-xs font-bold transition-all ${
                          affordable
                            ? "bg-brand-500 text-white hover:bg-brand-600"
                            : "bg-black/[0.05] dark:bg-white/10 text-ink-faint"
                        }`}
                        disabled={!!busy}
                        onClick={() => void buy(def)}
                      >
                        {affordable ? (
                          c.buy
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            <Lock className="w-3 h-3" strokeWidth={2.6} /> {c.need} {short}
                          </span>
                        )}
                      </button>
                      {!affordable && (
                        <div className="mt-1.5 w-full h-1 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all"
                            style={{ width: `${Math.min(100, (coins / def.price) * 100)}%` }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-ink-faint leading-relaxed mt-4">{c.hint}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
