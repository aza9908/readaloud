/**
 * StoryScene — the illustration shown for a book that has no photograph.
 *
 * Design intent: a composed "book plate" rather than a clip-art landscape.
 * The subject sits inside a medallion on a calm, layered background, which
 * reads as deliberate at any size and — critically — never crops. The
 * previous version used `preserveAspectRatio="slice"`, which cut the sun off
 * the top and the subject off the bottom.
 *
 * The palette and ornament placement derive deterministically from the
 * title, so a book always looks like itself, and two books look different.
 */

import { memo } from "react";

interface Palette {
  from: string;
  to: string;
  ring: string;
  ornament: string;
  medallion: string;
}

const PALETTES: Palette[] = [
  { from: "#EEF2FF", to: "#E0E7FF", ring: "#C7D2FE", ornament: "#A5B4FC", medallion: "#FFFFFF" },
  { from: "#FFF1F2", to: "#FFE4E6", ring: "#FECDD3", ornament: "#FDA4AF", medallion: "#FFFFFF" },
  { from: "#ECFDF5", to: "#D1FAE5", ring: "#A7F3D0", ornament: "#6EE7B7", medallion: "#FFFFFF" },
  { from: "#FFFBEB", to: "#FEF3C7", ring: "#FDE68A", ornament: "#FCD34D", medallion: "#FFFFFF" },
  { from: "#F5F3FF", to: "#EDE9FE", ring: "#DDD6FE", ornament: "#C4B5FD", medallion: "#FFFFFF" },
  { from: "#ECFEFF", to: "#CFFAFE", ring: "#A5F3FC", ornament: "#67E8F9", medallion: "#FFFFFF" },
];

const DARK_PALETTES: Palette[] = PALETTES.map((p) => ({
  from: "#232032",
  to: "#1B1826",
  ring: p.ornament,
  ornament: p.ring,
  medallion: "#2A2539",
}));

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const StoryScene = memo(function StoryScene({
  title,
  emoji,
  className = "",
  dark = false,
}: {
  title: string;
  emoji: string;
  className?: string;
  dark?: boolean;
}) {
  const h = hashString(title || emoji);
  const p = (dark ? DARK_PALETTES : PALETTES)[h % PALETTES.length];
  const id = `s${h % 100000}`;

  // Deterministic ornament placement — same book, same composition.
  const dots = Array.from({ length: 7 }).map((_, i) => {
    const seed = (h >> (i * 3)) % 1000;
    return {
      cx: 30 + ((seed * 7) % 340),
      cy: 22 + ((seed * 13) % 176),
      r: 2 + (seed % 4),
      o: 0.18 + ((seed % 5) * 0.06),
    };
  });

  return (
    <svg
      viewBox="0 0 400 220"
      className={className}
      role="img"
      aria-label={title}
      /* `meet` guarantees the whole composition is always visible. */
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.from} />
          <stop offset="100%" stopColor={p.to} />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={dark ? "0.10" : "0.85"} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`soft-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0" dy="4" stdDeviation="6"
            floodColor="#2a2540" floodOpacity={dark ? "0.35" : "0.12"}
          />
        </filter>
      </defs>

      <rect width="400" height="220" fill={`url(#bg-${id})`} />

      {/* Two calm arcs give depth without clutter */}
      <path
        d="M -40 190 Q 120 140 200 168 T 440 150 L440 240 L-40 240 Z"
        fill={p.ornament}
        opacity={dark ? "0.18" : "0.30"}
      />
      <path
        d="M -40 208 Q 140 168 240 196 T 440 184 L440 240 L-40 240 Z"
        fill={p.ring}
        opacity={dark ? "0.22" : "0.45"}
      />

      {/* Scattered dots — quiet texture, deterministic */}
      <g fill={p.ornament}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} opacity={d.o} />
        ))}
      </g>

      {/* Soft light behind the subject */}
      <circle cx="200" cy="100" r="86" fill={`url(#glow-${id})`} />

      {/* Medallion holding the subject — generous padding, never clipped */}
      <g filter={`url(#soft-${id})`}>
        <circle cx="200" cy="100" r="54" fill={p.medallion} />
        <circle
          cx="200" cy="100" r="54"
          fill="none" stroke={p.ring} strokeWidth="2.5" opacity="0.9"
        />
        <circle
          cx="200" cy="100" r="62"
          fill="none" stroke={p.ring} strokeWidth="1.5"
          strokeDasharray="3 7" opacity="0.55"
        />
      </g>

      {/* The subject, optically centred inside the medallion */}
      <text
        x="200"
        y="100"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="52"
      >
        {emoji}
      </text>
    </svg>
  );
});
