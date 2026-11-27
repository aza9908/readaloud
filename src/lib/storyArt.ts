import type { Language } from "./types";
import coastCover from "@/assets/worlds/golden-coast-192.webp";
import coastPage from "@/assets/worlds/golden-coast-576.webp";
import turnipCover from "@/assets/worlds/turnip-garden-192.webp";
import turnipPage from "@/assets/worlds/turnip-garden-720.webp";
import rocketCover from "@/assets/worlds/rocket-garden-192.webp";
import rocketPage from "@/assets/worlds/rocket-garden-720.webp";

const coast = { cover: coastCover, page: coastPage };
const plates: Record<string, { cover: string; page: string }> = {
  "kk:алтын балық": coast,
  "ru:сказка о рыбаке и рыбке": coast,
  "ru:репка": { cover: turnipCover, page: turnipPage },
  "en:stars and rockets": { cover: rocketCover, page: rocketPage },
};

export function storyArt(language: Language, title: string) {
  return plates[`${language}:${title.trim().toLowerCase()}`];
}
