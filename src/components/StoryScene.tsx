/**
 * StoryScene — a generated illustration used when a book has no photograph.
 *
 * Every book therefore shows a visual on its first page, with no network
 * request and no licensing question. The palette and decorations are derived
 * deterministically from the book title, so a given book always looks the
 * same, and different books look different.
 */

import { memo } from "react";

const PALETTES = [
  { sky: ["#dbeafe", "#eff6ff"], hill: "#bfdbfe", accent: "#93c5fd", sun: "#fcd34d" },
  { sky: ["#fce7f3", "#fdf2f8"], hill: "#fbcfe8", accent: "#f9a8d4", sun: "#fbbf24" },
  { sky: ["#dcfce7", "#f0fdf4"], hill: "#bbf7d0", accent: "#86efac", sun: "#facc15" },
  { sky: ["#ede9fe", "#f5f3ff"], hill: "#ddd6fe", accent: "#c4b5fd", sun: "#fde68a" },
  { sky: ["#ffedd5", "#fff7ed"], hill: "#fed7aa", accent: "#fdba74", sun: "#fbbf24" },
  { sky: ["#cffafe", "#ecfeff"], hill: "#a5f3fc", accent: "#67e8f9", sun: "#fde047" },
];

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
}: {
  title: string;
  emoji: string;
  className?: string;
}) {
  const h = hashString(title || emoji);
  const p = PALETTES[h % PALETTES.length];
  const cloudSeed = h % 5;
  const treeCount = 3 + (h % 3);

  return (
    <svg
      viewBox="0 0 400 200"
      className={className}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`sky-${h}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sky[0]} />
          <stop offset="100%" stopColor={p.sky[1]} />
        </linearGradient>
      </defs>

      <rect width="400" height="200" fill={`url(#sky-${h})`} />

      {/* sun */}
      <circle cx={330 - cloudSeed * 12} cy={44} r="20" fill={p.sun} opacity="0.9" />

      {/* clouds */}
      <g fill="#ffffff" opacity="0.75">
        <ellipse cx={70 + cloudSeed * 10} cy="46" rx="26" ry="13" />
        <ellipse cx={95 + cloudSeed * 10} cy="50" rx="20" ry="11" />
        <ellipse cx={210 - cloudSeed * 8} cy="34" rx="20" ry="10" />
      </g>

      {/* rolling hills */}
      <path d="M0 150 Q 70 112 150 148 T 400 138 L400 200 L0 200 Z" fill={p.hill} />
      <path d="M0 172 Q 110 140 220 172 T 400 164 L400 200 L0 200 Z" fill={p.accent} opacity="0.85" />

      {/* simple trees along the ridge */}
      <g>
        {Array.from({ length: treeCount }).map((_, i) => {
          const x = 40 + i * (320 / treeCount) + (h % 17);
          const scale = 0.85 + ((h >> i) % 4) * 0.1;
          return (
            <g key={i} transform={`translate(${x} 158) scale(${scale})`}>
              <rect x="-3" y="-14" width="6" height="16" rx="2" fill="#a16207" opacity="0.55" />
              <circle cx="0" cy="-22" r="14" fill="#4ade80" opacity="0.65" />
              <circle cx="-9" cy="-16" r="10" fill="#22c55e" opacity="0.55" />
              <circle cx="9" cy="-16" r="10" fill="#22c55e" opacity="0.55" />
            </g>
          );
        })}
      </g>

      {/* the book's emoji, sitting on the hill as the subject of the scene */}
      <text
        x="200"
        y="150"
        textAnchor="middle"
        fontSize="62"
        style={{ dominantBaseline: "middle" }}
      >
        {emoji}
      </text>
    </svg>
  );
});
