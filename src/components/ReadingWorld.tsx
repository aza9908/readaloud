import type { PointerEvent, ReactNode } from "react";

import coastSmall from "@/assets/worlds/golden-coast-576.webp";
import coastLarge from "@/assets/worlds/golden-coast-1080.webp";
import librarySmall from "@/assets/worlds/observatory-576.webp";
import libraryLarge from "@/assets/worlds/observatory-1080.webp";

const scenes = {
  coast: {
    small: coastSmall, large: coastLarge,
    alt: "Из страниц книги вырастает дом рыбака. У причала плещется золотая рыбка.",
  },
  observatory: {
    small: librarySmall, large: libraryLarge,
    alt: "На раскрытой книге стоит маленькая библиотека с медной обсерваторией и светящимися окнами.",
  },
};

export function BookserWordmark() {
  return <span className="bookser-wordmark" lang="en"><img src="/icon-180.png" alt="" width={31} height={31} />Bookser</span>;
}

function tilt(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
  const el = event.currentTarget;
  const box = el.getBoundingClientRect();
  el.style.setProperty("--turn", `${((event.clientX - box.left) / box.width - 0.5) * 5}deg`);
  el.style.setProperty("--rise", `${((event.clientY - box.top) / box.height - 0.5) * -4}deg`);
}

export function ReadingWorld({ scene, labelledBy, children, footer }: {
  scene: keyof typeof scenes;
  labelledBy: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const art = scenes[scene];
  return (
    <section className={`reading-world world-${scene}`} aria-labelledby={labelledBy}>
      <div className="world-layout">
        <div className="world-copy">{children}</div>
        <div className="world-stage" onPointerMove={tilt} onPointerLeave={event => {
          event.currentTarget.style.removeProperty("--turn");
          event.currentTarget.style.removeProperty("--rise");
        }}>
          <div className="world-sky" aria-hidden="true" />
          <img className="world-model" src={art.small} srcSet={`${art.small} 576w, ${art.large} 1080w`}
            sizes="(max-width: 639px) 90vw, (max-width: 1199px) 46vw, 535px"
            width={1080} height={720} alt={art.alt} />
        </div>
      </div>
      {footer}
    </section>
  );
}
