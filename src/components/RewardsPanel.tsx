import { BookserIcon } from "./BookserIcon";
/**
 * RewardsPanel — explains what the coins are for.
 *
 * The exchange is deliberately framed as parent-mediated ("договорись с
 * родителями"): the app itself does not pay out, so promising money directly
 * to a child would be misleading. The parent sets the rate and the prize.
 */

import { Gift, HandCoins } from "lucide-react";
import type { Language } from "@/lib/types";

const COPY = {
  ru: {
    title: "Зачем нужны монеты",
    lead: "За каждое прочитанное слово ты получаешь 1 монету, а за целую книгу — ещё 50 сверху.",
    exchange: "Монеты можно потратить двумя способами",
    detail: "1) В магазине героев — открыть нового персонажа прямо в приложении. 2) У родителей — обменять на настоящий приз или деньги: договоритесь заранее, сколько стоит монета. Например, 500 монет — поход в кино, 1000 — новая книга или игрушка.",
    parentNote: "Родителям: курс обмена и награду вы устанавливаете сами. Приложение не проводит выплат — это ваша договорённость с ребёнком.",
    rates: [
      { coins: 100, label: "маленький приз" },
      { coins: 500, label: "поход куда-нибудь" },
      { coins: 1000, label: "большая награда" },
    ],
    have: "У тебя сейчас",
  },
  kk: {
    title: "Монеталар не үшін керек",
    lead: "Әр оқыған сөз үшін 1 монета, ал толық кітап үшін тағы 50 монета аласың.",
    exchange: "Монетаны екі жолмен жұмсауға болады",
    detail: "Монеталарды ата-анаңмен айырбастайсың: бір монета қанша тұратынын және қандай сыйлық күтетінін алдын ала келісіңдер. Мысалы, 500 монета — кинотеатрға бару, 1000 — жаңа кітап немесе ойыншық.",
    parentNote: "Ата-аналарға: айырбас бағамы мен сыйлықты өзіңіз белгілейсіз. Қосымша төлем жасамайды — бұл сіздің балаңызбен келісіміңіз.",
    rates: [
      { coins: 100, label: "кішкентай сыйлық" },
      { coins: 500, label: "бір жерге бару" },
      { coins: 1000, label: "үлкен сыйлық" },
    ],
    have: "Сенде қазір",
  },
  en: {
    title: "What the coins are for",
    lead: "You earn 1 coin for every word you read, plus 50 more for finishing a whole book.",
    exchange: "Coins can be spent in two ways",
    detail: "1) In the hero shop — unlock a new character right in the app. 2) With your parents — exchange for a real prize or money: agree in advance what a coin is worth. For example, 500 coins for a cinema trip, 1000 for a new book or toy.",
    parentNote: "For parents: you set the exchange rate and the reward yourself. The app makes no payments — this is your arrangement with your child.",
    rates: [
      { coins: 100, label: "a small prize" },
      { coins: 500, label: "a day out" },
      { coins: 1000, label: "a big reward" },
    ],
    have: "You have",
  },
} as const;

export function RewardsPanel({
  language,
  coins,
}: {
  language: Language;
  coins: number;
}) {
  const c = COPY[language] ?? COPY.ru;

  return (
    <div className="rounded-3xl border-2 border-amber-400/30 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl bg-amber-400/20 grid place-items-center shrink-0">
          <BookserIcon value="coins" size={35} />
        </span>
        <div className="min-w-0">
          <p className="font-display font-bold text-ink dark:text-white leading-tight">
            {c.title}
          </p>
          <p className="text-sm text-ink-soft dark:text-ink-faint mt-0.5">{c.lead}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white/70 dark:bg-white/5 p-3">
        <p className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
          <Gift className="w-4 h-4 shrink-0" strokeWidth={2.4} />
          {c.exchange}
        </p>
        <p className="text-sm text-ink-soft dark:text-ink-faint mt-1.5 leading-relaxed">
          {c.detail}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {c.rates.map((r) => (
          <div
            key={r.coins}
            className={`rounded-2xl p-2.5 text-center transition-colors ${
              coins >= r.coins
                ? "bg-amber-400/25 border border-amber-400/50"
                : "bg-black/[0.03] dark:bg-white/5"
            }`}
          >
            <p className="font-display font-extrabold text-ink dark:text-white">
              {r.coins}
            </p>
            <p className="text-[11px] text-ink-faint leading-tight">{r.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white/70 dark:bg-white/5 px-3 py-2">
        <span className="text-sm font-bold text-ink-soft dark:text-ink-faint">{c.have}</span>
        <span className="flex items-center gap-1.5 font-display font-extrabold text-lg text-amber-600 dark:text-amber-400">
          <HandCoins className="w-5 h-5" strokeWidth={2.2} />
          {coins}
        </span>
      </div>

      <p className="text-[11px] text-ink-faint leading-relaxed">{c.parentNote}</p>
    </div>
  );
}
