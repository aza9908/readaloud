/**
 * AvatarPortrait — рисует персонажа из каталога.
 *
 * Один параметрический шаблон на всю коллекцию: общая композиция (медальон,
 * плечи, голова), а различия задаются палитрой, причёской, головным убором и
 * аксессуаром. Благодаря этому десять персонажей выглядят как одна серия,
 * а не как случайные картинки, и добавление одиннадцатого — это одна строка
 * данных, а не новый файл с графикой.
 */

import { memo } from "react";
import type { AvatarDef } from "@/lib/avatars";

export const AvatarPortrait = memo(function AvatarPortrait({
  def,
  size = 88,
  locked = false,
  className = "",
}: {
  def: AvatarDef;
  size?: number;
  locked?: boolean;
  className?: string;
}) {
  const p = def.palette;
  const uid = def.id;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={def.name.ru}
      style={locked ? { filter: "grayscale(1)", opacity: 0.45 } : undefined}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.bg1} />
          <stop offset="100%" stopColor={p.bg2} />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>

      <g clipPath={`url(#clip-${uid})`}>
        <rect width="100" height="100" fill={`url(#bg-${uid})`} />

        {/* лёгкое свечение за персонажем */}
        <circle cx="50" cy="46" r="30" fill="#ffffff" opacity="0.28" />

        {/* аксессуар позади (крылья) */}
        {def.accessory === "wings" && (
          <g fill={p.accent} opacity="0.85">
            <path d="M28 58 Q10 42 16 30 Q30 36 34 54 Z" />
            <path d="M72 58 Q90 42 84 30 Q70 36 66 54 Z" />
          </g>
        )}

        {/* плечи */}
        <path d="M18 100 Q20 74 50 74 Q80 74 82 100 Z" fill={p.suit} />
        <path d="M18 100 Q20 74 50 74 L50 100 Z" fill={p.suitDark} opacity="0.35" />
        {/* воротник */}
        <path d="M40 76 Q50 84 60 76 L58 74 Q50 79 42 74 Z" fill={p.accent} />

        {/* волосы позади */}
        {def.hair.style === "long" && (
          <path d="M26 46 Q24 78 34 84 L66 84 Q76 78 74 46 Z" fill={def.hair.color} />
        )}
        {def.hair.style === "braids" && (
          <g fill={def.hair.color}>
            <path d="M28 46 Q22 70 28 82 Q34 78 33 60 Z" />
            <path d="M72 46 Q78 70 72 82 Q66 78 67 60 Z" />
            <circle cx="28" cy="83" r="3.4" fill={p.accent} />
            <circle cx="72" cy="83" r="3.4" fill={p.accent} />
          </g>
        )}

        {/* шея */}
        <rect x="44" y="60" width="12" height="16" rx="5" fill={def.skin} />
        <rect x="44" y="60" width="12" height="6" rx="3" fill="#000" opacity="0.08" />

        {/* голова */}
        <circle cx="50" cy="44" r="21" fill={def.skin} />

        {/* волосы спереди */}
        {def.hair.style === "short" && (
          <path d="M29 42 Q30 22 50 22 Q70 22 71 42 Q66 32 50 31 Q34 32 29 42 Z"
                fill={def.hair.color} />
        )}
        {(def.hair.style === "long" || def.hair.style === "braids") && (
          <path d="M29 42 Q29 21 50 21 Q71 21 71 42 Q67 30 50 30 Q33 30 29 42 Z"
                fill={def.hair.color} />
        )}
        {def.hair.style === "curly" && (
          <g fill={def.hair.color}>
            <circle cx="36" cy="28" r="9" />
            <circle cx="50" cy="24" r="10" />
            <circle cx="64" cy="28" r="9" />
            <circle cx="30" cy="38" r="7" />
            <circle cx="70" cy="38" r="7" />
          </g>
        )}
        {def.hair.style === "bun" && (
          <>
            <circle cx="50" cy="20" r="8" fill={def.hair.color} />
            <path d="M29 42 Q29 22 50 22 Q71 22 71 42 Q67 31 50 31 Q33 31 29 42 Z"
                  fill={def.hair.color} />
          </>
        )}

        {/* лицо */}
        <g fill="#2A2540">
          <circle cx="42" cy="45" r="2.6" />
          <circle cx="58" cy="45" r="2.6" />
        </g>
        <circle cx="42.9" cy="44.1" r="0.9" fill="#fff" />
        <circle cx="58.9" cy="44.1" r="0.9" fill="#fff" />
        <path d="M44 53 Q50 58 56 53" stroke="#2A2540" strokeWidth="2"
              fill="none" strokeLinecap="round" />
        <circle cx="35" cy="51" r="3.2" fill="#F08A8A" opacity="0.4" />
        <circle cx="65" cy="51" r="3.2" fill="#F08A8A" opacity="0.4" />

        {/* головные уборы */}
        {def.headwear === "helmet" && (
          <>
            <path d="M27 44 Q27 19 50 19 Q73 19 73 44 L73 40 Q73 24 50 24 Q27 24 27 40 Z"
                  fill={p.suit} />
            <path d="M27 44 A23 23 0 0 1 73 44 L73 46 Q50 40 27 46 Z"
                  fill="#BFE3FF" opacity="0.55" />
            <rect x="24" y="42" width="52" height="5" rx="2.5" fill={p.accent} />
          </>
        )}
        {def.headwear === "crown" && (
          <path d="M32 26 L38 15 L44 24 L50 12 L56 24 L62 15 L68 26 Z"
                fill={p.accent} stroke="#B8860B" strokeWidth="0.8" />
        )}
        {def.headwear === "wizard" && (
          <>
            <path d="M50 2 L70 32 L30 32 Z" fill={p.suit} />
            <rect x="26" y="30" width="48" height="6" rx="3" fill={p.suitDark} />
            <circle cx="50" cy="14" r="2.6" fill={p.accent} />
            <circle cx="43" cy="24" r="1.6" fill={p.accent} />
            <circle cx="58" cy="22" r="1.4" fill={p.accent} />
          </>
        )}
        {def.headwear === "pirate" && (
          <>
            <path d="M26 30 Q50 12 74 30 Q50 24 26 30 Z" fill={p.suitDark} />
            <rect x="24" y="28" width="52" height="7" rx="3.5" fill={p.suit} />
            <circle cx="50" cy="24" r="3" fill={p.accent} />
            <path d="M36 41 L48 41" stroke="#2A2540" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="42" cy="45" r="4" fill="#2A2540" />
          </>
        )}
        {def.headwear === "ninja" && (
          <>
            <path d="M27 44 Q27 20 50 20 Q73 20 73 44 L73 38 Q50 33 27 38 Z" fill={p.suit} />
            <rect x="27" y="36" width="46" height="7" rx="3" fill={p.suitDark} />
            <path d="M28 50 Q50 46 72 50 L72 62 Q50 68 28 62 Z" fill={p.suit} />
            <rect x="70" y="38" width="14" height="4" rx="2" fill={p.accent} />
          </>
        )}
        {def.headwear === "goggles" && (
          <g>
            <rect x="28" y="30" width="44" height="8" rx="4" fill={p.suitDark} />
            <circle cx="39" cy="34" r="6.5" fill={p.accent} opacity="0.85" />
            <circle cx="61" cy="34" r="6.5" fill={p.accent} opacity="0.85" />
            <circle cx="39" cy="34" r="6.5" fill="none" stroke={p.suitDark} strokeWidth="2" />
            <circle cx="61" cy="34" r="6.5" fill="none" stroke={p.suitDark} strokeWidth="2" />
          </g>
        )}
        {def.headwear === "takiya" && (
          <>
            {/* казахская тюбетейка */}
            <path d="M30 32 Q50 14 70 32 Z" fill={p.suit} />
            <rect x="28" y="30" width="44" height="7" rx="3.5" fill={p.suitDark} />
            <path d="M36 30 L40 24 M50 28 L50 21 M64 30 L60 24"
                  stroke={p.accent} strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="50" cy="18" r="2.4" fill={p.accent} />
          </>
        )}

        {/* аксессуары спереди */}
        {def.accessory === "stars" && (
          <g fill={p.accent}>
            <path d="M14 20 l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" />
            <path d="M86 30 l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z" opacity="0.8" />
          </g>
        )}
        {def.accessory === "wand" && (
          <g>
            <rect x="76" y="52" width="3" height="26" rx="1.5"
                  fill="#8B5A2B" transform="rotate(18 77 65)" />
            <path d="M84 46 l2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z"
                  fill={p.accent} />
          </g>
        )}
        {def.accessory === "sword" && (
          <g transform="rotate(-20 80 70)">
            <rect x="78" y="44" width="4" height="30" rx="1" fill="#D7DEE8" />
            <rect x="78" y="44" width="2" height="30" fill="#F2F6FA" />
            <rect x="72" y="72" width="16" height="4" rx="2" fill={p.accent} />
            <rect x="78.5" y="76" width="3" height="9" rx="1.5" fill="#8B5A2B" />
          </g>
        )}
        {def.accessory === "book" && (
          <g transform="translate(6 60)">
            <rect x="0" y="0" width="20" height="15" rx="2" fill={p.accent} />
            <rect x="0" y="0" width="9.4" height="15" rx="2" fill="#fff" opacity="0.9" />
            <rect x="10.6" y="0" width="9.4" height="15" rx="2" fill="#fff" opacity="0.9" />
            <line x1="10" y1="1" x2="10" y2="14" stroke={p.suitDark} strokeWidth="1.2" />
          </g>
        )}
        {def.accessory === "gear" && (
          <g transform="translate(74 56)" fill={p.accent}>
            <circle cx="9" cy="9" r="6.5" />
            <circle cx="9" cy="9" r="2.6" fill={p.suitDark} />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <rect key={a} x="7.6" y="-0.6" width="2.8" height="4.2" rx="1"
                    transform={`rotate(${a} 9 9)`} />
            ))}
          </g>
        )}
        {def.accessory === "dombra" && (
          <g transform="rotate(-24 20 66)">
            <ellipse cx="18" cy="72" rx="9" ry="11" fill="#C58B4A" />
            <ellipse cx="18" cy="72" rx="9" ry="11" fill="none" stroke="#8B5A2B" strokeWidth="1.2" />
            <circle cx="18" cy="70" r="2.6" fill="#6B4423" />
            <rect x="16.6" y="44" width="3" height="26" rx="1.4" fill="#8B5A2B" />
            <rect x="15.4" y="41" width="5.4" height="5" rx="1.6" fill="#6B4423" />
          </g>
        )}
      </g>

      {/* ободок медальона */}
      <circle cx="50" cy="50" r="49" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
    </svg>
  );
});
