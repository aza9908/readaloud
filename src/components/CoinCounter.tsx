/**
 * CoinCounter — live coin total during reading.
 *
 * Coins are earned per word, so the number changes constantly. To avoid
 * re-rendering the reading surface, the parent passes a plain number that
 * only updates on the throttled 1-second tick; the "+N" flourish is driven
 * locally from changes to that number.
 */

import { memo, useEffect, useRef, useState } from "react";
import { Coins } from "lucide-react";

export const CoinCounter = memo(function CoinCounter({ coins }: { coins: number }) {
  const [delta, setDelta] = useState<number | null>(null);
  const prev = useRef(coins);

  useEffect(() => {
    const gained = coins - prev.current;
    prev.current = coins;
    if (gained > 0) {
      setDelta(gained);
      const t = setTimeout(() => setDelta(null), 900);
      return () => clearTimeout(t);
    }
  }, [coins]);

  return (
    <div className="relative flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 px-3 py-1">
      <Coins className="w-4 h-4 text-amber-500" strokeWidth={2.5} />
      <span className="font-display font-bold text-sm text-amber-600 dark:text-amber-400 tabular-nums">
        {coins}
      </span>
      {delta !== null && (
        <span
          key={coins}
          className="absolute -top-4 right-1 text-xs font-bold text-amber-500 animate-coin-pop pointer-events-none"
        >
          +{delta}
        </span>
      )}
    </div>
  );
});
