/**
 * KaraokeText — word spans highlighted by direct DOM class toggling
 * from useSpeechReader. Memoized: re-renders only on page turn or
 * font-size change; the 1-second progress tick costs ~0 here.
 */
import { memo } from "react";

interface KaraokeTextProps {
  words: string[];
  paragraphSizes?: number[];
  registerWordEl: (index: number, el: HTMLElement | null) => void;
  fontSizePx: number;
}

function KaraokeTextInner({ words, paragraphSizes, registerWordEl, fontSizePx }: KaraokeTextProps) {
  const sizes = paragraphSizes?.length ? paragraphSizes : [words.length];
  let cursor = 0;
  return (
    <div className="select-none">
      {sizes.map((size, pIdx) => {
        const base = cursor;
        const slice = words.slice(cursor, cursor + size);
        cursor += size;
        return (
          <p key={pIdx} className="leading-loose mb-6" style={{ fontSize: fontSizePx }}>
            {slice.map((word, i) => {
              const wordIndex = base + i;
              return (
                <span key={wordIndex}>
                  <span
                    ref={(el) => registerWordEl(wordIndex, el)}
                    className="karaoke-word word-pending"
                    data-word-index={wordIndex}
                  >
                    {word}
                  </span>{" "}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

export const KaraokeText = memo(
  KaraokeTextInner,
  (prev, next) => prev.words === next.words && prev.fontSizePx === next.fontSizePx,
);
