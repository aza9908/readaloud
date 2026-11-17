/**
 * AvatarPortrait — рисует персонажа из каталога.
 *
 * Один параметрический шаблон на всю коллекцию: общая композиция (медальон,
 * плечи, голова), а различия задаются палитрой, причёской, головным убором и
 * аксессуаром. Благодаря этому десять персонажей выглядят как одна серия,
 * а не как случайные картинки, и добавление одиннадцатого — это одна строка
 * данных, а не новый файл с графикой.
 *
 * Стиль — «плюшевая 3D-игрушка»: мягкий объём, пушистые края, крошечные
 * глазки-бусинки, румянец и студийный фон с тенью. Объём даёт не 3D-движок,
 * а SVG-фильтры освещения (feDiffuse/feSpecularLighting по размытой альфе),
 * поэтому каждая деталь — тело, голова, шапка, аксессуар — сама получает
 * блик и тень. Это по-прежнему наш собственный параметрический рисунок
 * (см. инвариант 5 в CLAUDE.md): мы берём стиль, а не чужого персонажа.
 * WebGL-модели здесь не годятся: витрина показывает ~20 портретов сразу,
 * а браузер даёт лишь ~16 WebGL-контекстов на страницу.
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
      /* Заблокированные показываем В ЦВЕТЕ: ребёнок должен видеть награду,
         иначе она не мотивирует. Обесцвечивание делало персонажа похожим
         на сломанную картинку. Достаточно лёгкого приглушения и замка. */
      style={locked ? { filter: "saturate(0.82) brightness(0.97)" } : undefined}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.bg1} />
          <stop offset="100%" stopColor={p.bg2} />
        </linearGradient>
        <radialGradient id={`studio-${uid}`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.06" />
        </radialGradient>
        <radialGradient id={`floor-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`clip-${uid}`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>

        {/* Плюш: пушистый край + ворс + мягкий объём с рассеянным бликом. */}
        <filter id={`plush-${uid}`} x="-20%" y="-20%" width="140%" height="140%"
                colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2"
                        seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5"
                             xChannelSelector="R" yChannelSelector="G" result="fuzzy" />
          <feGaussianBlur in="fuzzy" stdDeviation="0.3" result="soft" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="bump" />
          <feDiffuseLighting in="bump" surfaceScale="7" diffuseConstant="1.15"
                             lightingColor="#ffffff" result="diffuse">
            <feDistantLight azimuth="235" elevation="52" />
          </feDiffuseLighting>
          <feComposite in="soft" in2="diffuse" operator="arithmetic"
                       k1="1.08" k2="0" k3="0" k4="0" result="shaded" />
          <feSpecularLighting in="bump" surfaceScale="7" specularConstant="0.45"
                              specularExponent="9" lightingColor="#fff6ee" result="spec">
            <feDistantLight azimuth="235" elevation="55" />
          </feSpecularLighting>
          <feComposite in="spec" in2="soft" operator="in" result="specIn" />
          <feColorMatrix in="noise" type="matrix"
                         values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.55 0 0 0 -0.3"
                         result="fur" />
          <feComposite in="fur" in2="soft" operator="in" result="furIn" />
          <feMerge>
            <feMergeNode in="shaded" />
            <feMergeNode in="specIn" />
            <feMergeNode in="furIn" />
          </feMerge>
        </filter>

        {/* Глянец: гладкий «пластик/фетр» для шапок и аксессуаров. */}
        <filter id={`gloss-${uid}`} x="-20%" y="-20%" width="140%" height="140%"
                colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="bump" />
          <feDiffuseLighting in="bump" surfaceScale="4" diffuseConstant="1.1"
                             lightingColor="#ffffff" result="diffuse">
            <feDistantLight azimuth="235" elevation="55" />
          </feDiffuseLighting>
          <feComposite in="SourceGraphic" in2="diffuse" operator="arithmetic"
                       k1="1.1" k2="0" k3="0" k4="0" result="shaded" />
          <feSpecularLighting in="bump" surfaceScale="4" specularConstant="0.9"
                              specularExponent="22" lightingColor="#ffffff" result="spec">
            <feDistantLight azimuth="235" elevation="50" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feDropShadow dx="0" dy="1.2" stdDeviation="1" floodColor="#000" floodOpacity="0.22" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="shaded" />
            <feMergeNode in="specIn" />
          </feMerge>
        </filter>

        {/* Мягкая тень, которую голова отбрасывает на тело. */}
        <filter id={`blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>

      <g clipPath={`url(#clip-${uid})`}>
        <rect width="100" height="100" fill={`url(#bg-${uid})`} />
        {/* студийный свет: светлое пятно за героем, виньетка по краям */}
        <rect width="100" height="100" fill={`url(#studio-${uid})`} />
        {/* «стол», на котором сидит игрушка */}
        <ellipse cx="50" cy="97" rx="40" ry="9" fill={`url(#floor-${uid})`} />

        {/* Турнирные герои двигаются: вращающееся сияние и искры.
            Анимация только у них — это визуальный знак того, что героя
            нельзя купить, его выиграли. Уважаем prefers-reduced-motion. */}
        {def.animated && !locked && (
          <g className="avatar-anim">
            <circle cx="50" cy="50" r="46" fill="none" stroke={p.accent}
              strokeWidth="2" strokeDasharray="6 10" opacity="0.7">
              <animateTransform attributeName="transform" type="rotate"
                from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite" />
            </circle>
            <circle cx="50" cy="8" r="2.5" fill={p.accent}>
              <animateTransform attributeName="transform" type="rotate"
                from="0 50 50" to="360 50 50" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </g>
        )}


        {/* аксессуар позади (крылья) */}
        {def.accessory === "wings" && (
          <g fill={p.accent} opacity="0.92" filter={`url(#gloss-${uid})`}>
            <path d="M28 58 Q10 42 16 30 Q30 36 34 54 Z" />
            <path d="M72 58 Q90 42 84 30 Q70 36 66 54 Z" />
          </g>
        )}

        {/* всё, что относится к голове, — крупнее: у игрушки большая голова */}
        <g transform="translate(50 45) scale(1.12) translate(-50 -44)">

        {/* волосы позади */}
        {def.hair.style === "long" && (
          <path d="M26 46 Q24 74 34 78 L66 78 Q76 74 74 46 Z" fill={def.hair.color}
                filter={`url(#plush-${uid})`} />
        )}

        </g>

        {/* плюшевое тело-«фасолинка» */}
        <g filter={`url(#plush-${uid})`}>
          <path d="M17 104 Q15 70 50 67 Q85 70 83 104 Z" fill={p.suit} />
          {/* лапки, лежащие на «столе» */}
          <ellipse cx="33" cy="93" rx="9" ry="6.5" fill={def.skin} />
          <ellipse cx="67" cy="93" rx="9" ry="6.5" fill={def.skin} />
        </g>
        {/* воротник-шарфик */}
        <path d="M36 72 Q50 82 64 72 L62 69 Q50 76 38 69 Z" fill={p.accent}
              filter={`url(#gloss-${uid})`} />

        <g transform="translate(50 45) scale(1.12) translate(-50 -44)">

        {/* тень головы на теле */}
        <ellipse cx="50" cy="66" rx="17" ry="4.5" fill="#000" opacity="0.22"
                 filter={`url(#blur-${uid})`} />

        {/* голова — слегка приплюснутый плюшевый шар */}
        <ellipse cx="50" cy="44" rx="22.5" ry="21" fill={def.skin}
                 filter={`url(#plush-${uid})`} />

        {/* лицо: глазки-бусинки, румянец, маленькая улыбка */}
        <ellipse cx="41" cy="46" rx="2.1" ry="2.7" fill="#1E1A24" />
        <ellipse cx="59" cy="46" rx="2.1" ry="2.7" fill="#1E1A24" />
        <circle cx="41.7" cy="45" r="0.75" fill="#fff" />
        <circle cx="59.7" cy="45" r="0.75" fill="#fff" />
        <path d="M46.6 52 Q50 55 53.4 52" stroke="#1E1A24" strokeWidth="1.5"
              fill="none" strokeLinecap="round" />
        <ellipse cx="34.5" cy="51.5" rx="4.2" ry="2.8" fill="#F27A8A" opacity="0.5"
                 filter={`url(#blur-${uid})`} />
        <ellipse cx="65.5" cy="51.5" rx="4.2" ry="2.8" fill="#F27A8A" opacity="0.5"
                 filter={`url(#blur-${uid})`} />

        {/* волосы спереди — плюшевые пряди */}
        <g filter={`url(#plush-${uid})`}>
        {def.hair.style === "braids" && (
          <g fill={def.hair.color}>
            <path d="M28 46 Q22 70 28 82 Q34 78 33 60 Z" />
            <path d="M72 46 Q78 70 72 82 Q66 78 67 60 Z" />
            <circle cx="28" cy="83" r="3.4" fill={p.accent} />
            <circle cx="72" cy="83" r="3.4" fill={p.accent} />
          </g>
        )}
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

        </g>

        {/* головные уборы — гладкий фетр/металл */}
        <g filter={`url(#gloss-${uid})`}>
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
            <path d="M33 41 L49 41" stroke="#2A2540" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="41" cy="46" r="4.2" fill="#2A2540" />
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
        {def.headwear === "kalpak" && (
          <g>
            {/* ақ қалпақ — белый войлочный колпак с отворотом */}
            <path d="M50 8 L66 34 L34 34 Z" fill="#F5F2E8" />
            <path d="M50 8 L58 34 L34 34 Z" fill="#E4DFCE" />
            <path d="M30 32 Q50 26 70 32 L70 38 Q50 33 30 38 Z" fill="#FFFFFF" />
            <path d="M30 35 Q50 30 70 35" stroke={p.accent} strokeWidth="1.6" fill="none" />
          </g>
        )}
        {def.headwear === "tymak" && (
          <g>
            {/* тымақ — меховая шапка с боковыми отворотами */}
            <path d="M24 42 Q24 16 50 16 Q76 16 76 42 L76 34 Q50 26 24 34 Z" fill={p.suitDark} />
            <path d="M22 34 Q50 24 78 34 Q78 46 72 48 Q50 40 28 48 Q22 46 22 34 Z" fill="#8B5A2B" />
            <ellipse cx="22" cy="48" rx="7" ry="11" fill="#8B5A2B" />
            <ellipse cx="78" cy="48" rx="7" ry="11" fill="#8B5A2B" />
            <ellipse cx="22" cy="48" rx="4.6" ry="8" fill="#A0724A" />
            <ellipse cx="78" cy="48" rx="4.6" ry="8" fill="#A0724A" />
          </g>
        )}
        {def.headwear === "saukele" && (
          <g>
            {/* сәукеле — высокий конический убор с подвесками */}
            <path d="M50 0 L64 34 L36 34 Z" fill={p.suit} />
            <path d="M50 0 L57 34 L36 34 Z" fill={p.suitDark} opacity="0.45" />
            <path d="M38 20 L62 20" stroke={p.accent} strokeWidth="2" />
            <path d="M40 27 L60 27" stroke={p.accent} strokeWidth="2" />
            <circle cx="50" cy="7" r="3" fill={p.accent} />
            <path d="M32 32 Q50 26 68 32 L68 39 Q50 33 32 39 Z" fill={p.accent} />
            {/* подвески по бокам */}
            <g fill={p.accent}>
              <circle cx="33" cy="46" r="2.4" /><circle cx="33" cy="54" r="2.4" />
              <circle cx="67" cy="46" r="2.4" /><circle cx="67" cy="54" r="2.4" />
            </g>
            <path d="M33 42 v14 M67 42 v14" stroke={p.accent} strokeWidth="1" />
          </g>
        )}
        {def.headwear === "saka_helmet" && (
          <g>
            {/* сакский шлем с золотым навершием */}
            <path d="M27 44 Q27 18 50 18 Q73 18 73 44 L73 40 Q73 24 50 24 Q27 24 27 40 Z"
                  fill={p.accent} />
            <path d="M27 44 Q27 18 50 18 L50 24 Q27 24 27 40 Z" fill="#D9A404" />
            <rect x="25" y="38" width="50" height="6" rx="3" fill={p.suitDark} />
            {/* навершие в виде стрелы */}
            <path d="M50 4 L54 16 L50 13 L46 16 Z" fill={p.accent} />
            <rect x="48.8" y="12" width="2.4" height="8" fill="#D9A404" />
            {/* нащёчники */}
            <path d="M27 44 Q26 58 32 62 L36 50 Z" fill={p.accent} />
            <path d="M73 44 Q74 58 68 62 L64 50 Z" fill={p.accent} />
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

        </g>
        </g>

        {/* аксессуары спереди */}
        <g filter={`url(#gloss-${uid})`}>
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
        {def.accessory === "eagle" && (
          <g transform="translate(4 44)">
            {/* беркут на руке — силуэт с раскрытым крылом */}
            <path d="M14 22 Q6 10 12 2 Q20 8 20 20 Z" fill="#6B4423" />
            <ellipse cx="17" cy="24" rx="8" ry="10" fill="#7C4A1E" />
            <circle cx="17" cy="15" r="6" fill="#8B5A2B" />
            <path d="M12 14 L6 16 L12 18 Z" fill="#E5A50A" />
            <circle cx="15" cy="13.6" r="1.5" fill="#1F1A17" />
            <path d="M13 33 l0 5 M21 33 l0 5" stroke="#E5A50A" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        {def.accessory === "kobyz" && (
          <g transform="rotate(-18 18 64)">
            {/* қобыз — смычковый инструмент с округлым корпусом */}
            <path d="M12 60 Q10 78 20 80 Q30 78 28 60 Q20 56 12 60 Z" fill="#6B4423" />
            <ellipse cx="20" cy="70" rx="6.5" ry="7.5" fill="#3E2A18" />
            <rect x="18.4" y="40" width="3.2" height="22" rx="1.6" fill="#8B5A2B" />
            <path d="M17 40 q3 -5 6 0" fill="none" stroke="#8B5A2B" strokeWidth="2.4" />
            <line x1="19.4" y1="44" x2="19.4" y2="62" stroke="#E8DCC0" strokeWidth="0.7" />
            <line x1="20.8" y1="44" x2="20.8" y2="62" stroke="#E8DCC0" strokeWidth="0.7" />
          </g>
        )}
        {def.accessory === "shanyrak" && (
          <g transform="translate(72 52)">
            {/* шаңырақ — навершие юрты, символ дома */}
            <circle cx="10" cy="10" r="9.5" fill="none" stroke={p.accent} strokeWidth="2.4" />
            <circle cx="10" cy="10" r="5" fill="none" stroke={p.accent} strokeWidth="1.4" />
            <path d="M10 0.5 v19 M0.5 10 h19 M3.2 3.2 l13.6 13.6 M16.8 3.2 L3.2 16.8"
                  stroke={p.accent} strokeWidth="1.2" />
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
      </g>

      {/* ободок медальона */}
      <circle cx="50" cy="50" r="49" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.7" />

      {/* значок замка — понятная метка «ещё не открыт», без выцветания */}
      {locked && (
        <g>
          <circle cx="79" cy="79" r="15" fill="#2A2540" opacity="0.82" />
          <circle cx="79" cy="79" r="15" fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.85" />
          <rect x="73" y="78" width="12" height="9.5" rx="2.2" fill="#ffffff" />
          <path d="M75.6 78 v-3.2 a3.4 3.4 0 0 1 6.8 0 V78"
                fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
});
