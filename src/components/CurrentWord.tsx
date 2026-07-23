/**
 * CurrentWord — the big "read this aloud" prompt.
 *
 * It subscribes directly to the reader's cursor instead of reading the
 * throttled React state, so it updates the instant the highlight moves.
 * Reading `currentIndex` here made the prompt lag up to a second behind the
 * highlighted word — the desync visible in testing.
 *
 * Isolated in its own component so these frequent updates re-render only
 * this small subtree, never the reading surface.
 */
import { useEffect, useState } from "react";

export function CurrentWord({
  words,
  subscribeCursor,
}: {
  words: string[];
  subscribeCursor: (fn: (index: number) => void) => () => void;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => subscribeCursor(setIndex), [subscribeCursor]);

  const raw = words[Math.min(index, Math.max(words.length - 1, 0))] ?? "";
  const clean = raw.toLowerCase().replace(/[^\p{L}\p{N}-]+$/gu, "");

  return (
    <p className="font-display font-extrabold text-3xl text-brand-500 truncate leading-tight">
      {clean}
    </p>
  );
}
