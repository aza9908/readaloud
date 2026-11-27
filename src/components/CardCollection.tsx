import { BookserIcon } from "@/components/BookserIcon";
import { RoomSheet, CloseButton } from "@/components/RoomControls";
/**
 * CardCollection — коллекция карточек ребёнка.
 *
 * Показываем ВСЕ карточки, включая неполученные: пустые места в альбоме
 * тянут собрать сильнее, чем список того, что уже есть. Это та же логика,
 * по которой в магазине героев заблокированные показаны в цвете.
 */

import { useMemo } from "react";
import { Sparkles, Lock } from "lucide-react";
import {
  CARDS, CARD_SETS, CARD_RARITY_COLOR, CARD_RARITY_LABEL,
  cardsInSet, isSetComplete, SET_BONUS,
} from "@/lib/cards";
import type { Language } from "@/lib/types";

export function CardCollection({
  open, owned, language, onClose,
}: { open: boolean; owned: string[]; language: Language; onClose: () => void }) {
  const stats = useMemo(() => ({
    have: owned.length, total: CARDS.length,
    sets: CARD_SETS.filter((s) => isSetComplete(s, owned)).length,
  }), [owned]);

  if (!open) return null;

  return (
    <RoomSheet title="Коллекция" onClose={onClose}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="eyebrow mb-1">Коллекция</p>
            <p className="text-sm text-ink-soft dark:text-ink-faint">
              Собрано {stats.have} из {stats.total}
              {stats.sets > 0 && ` · наборов: ${stats.sets}`}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {CARD_SETS.map((set) => {
          const cards = cardsInSet(set);
          const complete = isSetComplete(set, owned);
          return (
            <div key={set} className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-display font-bold text-ink dark:text-white">{set}</p>
                {complete ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={2.4} />
                    набор собран · +{SET_BONUS}
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-faint">
                    {cards.filter((c) => owned.includes(c.id)).length} из {cards.length}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {cards.map((c) => {
                  const has = owned.includes(c.id);
                  return (
                    <div key={c.id}
                      className={`rounded-2xl p-2 text-center border-2 transition-all ${
                        has ? "bg-white dark:bg-[var(--surface)] shadow-soft" : "bg-black/[0.03] dark:bg-white/5"
                      }`}
                      style={{ borderColor: has ? CARD_RARITY_COLOR[c.rarity] : "transparent" }}
                      title={has ? c.fact[language] ?? c.fact.ru : "Ещё не найдена"}>
                      <div className="text-3xl">{has ? <BookserIcon value={c.emoji} size={35} /> : <Lock className="w-6 h-6 mx-auto text-ink-faint" strokeWidth={2} />}</div>
                      <p className={`text-[10px] font-bold mt-1 truncate ${has ? "text-ink dark:text-white" : "text-ink-faint"}`}>
                        {has ? (c.name[language] ?? c.name.ru) : "???"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <p className="text-[11px] text-ink-faint leading-relaxed">
          Карточки нельзя купить — они выпадают за дочитанные книги, решённые
          задачи и выигранные матчи. Собери набор целиком и получи {SET_BONUS} монет.
        </p>
    </RoomSheet>
  );
}

/** Всплывающая карточка в момент получения. */
export function CardReveal({
  card, language, onClose,
}: { card: (typeof CARDS)[number] | null; language: Language; onClose: () => void }) {
  if (!card) return null;
  return (
    <RoomSheet title="Новая карточка" onClose={onClose} className="small-sheet text-center">
        <p className="eyebrow mb-2">Новая карточка!</p>
        <div className="rounded-3xl p-6 border-4 mb-3"
          style={{ borderColor: CARD_RARITY_COLOR[card.rarity] }}>
          <div className="text-6xl mb-2"><BookserIcon value={card.emoji} size={80} /></div>
          <p className="font-display font-extrabold text-xl text-ink dark:text-white">
            {card.name[language] ?? card.name.ru}
          </p>
          <span className="text-[11px] font-extrabold uppercase tracking-wide"
            style={{ color: CARD_RARITY_COLOR[card.rarity] }}>
            {CARD_RARITY_LABEL[card.rarity]}
          </span>
        </div>
        <p className="text-sm text-ink-soft dark:text-ink-faint leading-relaxed px-1">
          {card.fact[language] ?? card.fact.ru}
        </p>
        <button className="btn-primary w-full mt-4" onClick={onClose}>Здорово!</button>
    </RoomSheet>
  );
}
