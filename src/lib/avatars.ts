/**
 * avatars.ts — каталог персонажей, которые ребёнок открывает за монеты.
 *
 * Почему рисуем сами, а не импортируем чужое:
 *   • скины Roblox/Minecraft и подобных — чужая интеллектуальная собственность,
 *     их использование в монетизируемом продукте нарушает права правообладателя;
 *   • собственные персонажи принадлежат проекту: их нельзя «отозвать»,
 *     они не требуют хостинга изображений и работают без сети;
 *   • SVG весит сотни байт вместо сотен килобайт.
 *
 * Все персонажи собираются из одного параметрического шаблона, поэтому
 * выглядят как единая коллекция, а не как случайный набор картинок.
 */

export type Rarity = "common" | "rare" | "legendary";

export interface AvatarDef {
  id: string;
  name: { ru: string; kk: string; en: string };
  price: number;
  rarity: Rarity;
  /** Ориентировочная адресация, чтобы витрина была сбалансированной. */
  appeal: "girls" | "boys" | "neutral";
  palette: { bg1: string; bg2: string; suit: string; suitDark: string; accent: string };
  skin: string;
  hair: { color: string; style: HairStyle };
  headwear?: Headwear;
  accessory?: Accessory;
}

type HairStyle = "short" | "long" | "braids" | "bun" | "curly" | "none";
type Headwear =
  | "helmet" | "crown" | "wizard" | "pirate" | "ninja" | "goggles"
  | "takiya"      // тюбетейка
  | "saukele"     // сәукеле — высокий свадебный головной убор
  | "tymak"       // тымақ — меховая шапка охотника
  | "saka_helmet" // сакский шлем с золотым навершием
  | "kalpak"      // ақ қалпақ — белый войлочный колпак
  | "none";
type Accessory =
  | "stars" | "wand" | "sword" | "book" | "gear" | "wings" | "dombra"
  | "eagle"    // беркут на руке
  | "kobyz"    // қобыз
  | "shanyrak" // шаңырақ
  | "none";

const SKIN = { light: "#F3C9A6", mid: "#DBA477", tan: "#C98B5E", deep: "#9C6640" };

export const AVATARS: AvatarDef[] = [
  {
    id: "cosmonaut",
    name: { ru: "Космонавт", kk: "Ғарышкер", en: "Astronaut" },
    price: 440, rarity: "common", appeal: "neutral",
    palette: { bg1: "#DBEAFE", bg2: "#BFDBFE", suit: "#E8EDF5", suitDark: "#C3CEDE", accent: "#3B82F6" },
    skin: SKIN.mid, hair: { color: "#3B2E2A", style: "short" },
    headwear: "helmet", accessory: "stars",
  },
  {
    id: "batyr",
    name: { ru: "Батыр", kk: "Батыр", en: "Batyr" },
    price: 560, rarity: "common", appeal: "boys",
    palette: { bg1: "#FEF3C7", bg2: "#FDE68A", suit: "#1E5A8E", suitDark: "#14456D", accent: "#D4A017" },
    skin: SKIN.tan, hair: { color: "#1F1A17", style: "short" },
    headwear: "takiya", accessory: "sword",
  },
  {
    id: "sorceress",
    name: { ru: "Волшебница", kk: "Сиқыршы", en: "Sorceress" },
    price: 500, rarity: "common", appeal: "girls",
    palette: { bg1: "#EDE9FE", bg2: "#DDD6FE", suit: "#7C3AED", suitDark: "#5B21B6", accent: "#F5A623" },
    skin: SKIN.light, hair: { color: "#8B4513", style: "long" },
    headwear: "wizard", accessory: "wand",
  },
  {
    id: "inventor",
    name: { ru: "Изобретатель", kk: "Өнертапқыш", en: "Inventor" },
    price: 610, rarity: "common", appeal: "neutral",
    palette: { bg1: "#D1FAE5", bg2: "#A7F3D0", suit: "#0F9D58", suitDark: "#0A7A44", accent: "#F59E0B" },
    skin: SKIN.deep, hair: { color: "#2B2220", style: "curly" },
    headwear: "goggles", accessory: "gear",
  },
  {
    id: "pirate",
    name: { ru: "Капитан", kk: "Капитан", en: "Captain" },
    price: 890, rarity: "rare", appeal: "boys",
    palette: { bg1: "#FFEDD5", bg2: "#FED7AA", suit: "#8B2E2E", suitDark: "#6B2020", accent: "#F5C518" },
    skin: SKIN.mid, hair: { color: "#4A2C1A", style: "short" },
    headwear: "pirate", accessory: "sword",
  },
  {
    id: "aruzhan",
    name: { ru: "Аружан", kk: "Аружан", en: "Aruzhan" },
    price: 950, rarity: "rare", appeal: "girls",
    palette: { bg1: "#FCE7F3", bg2: "#FBCFE8", suit: "#C2185B", suitDark: "#9A1349", accent: "#D4A017" },
    skin: SKIN.tan, hair: { color: "#1F1A17", style: "braids" },
    headwear: "crown", accessory: "dombra",
  },
  {
    id: "ninja",
    name: { ru: "Ниндзя", kk: "Ниндзя", en: "Ninja" },
    price: 1000, rarity: "rare", appeal: "neutral",
    palette: { bg1: "#E0E7FF", bg2: "#C7D2FE", suit: "#2F3B52", suitDark: "#1F2838", accent: "#EF4444" },
    skin: SKIN.light, hair: { color: "#111827", style: "none" },
    headwear: "ninja", accessory: "none",
  },
  {
    id: "fairy",
    name: { ru: "Фея", kk: "Пері", en: "Fairy" },
    price: 1060, rarity: "rare", appeal: "girls",
    palette: { bg1: "#CFFAFE", bg2: "#A5F3FC", suit: "#EC4899", suitDark: "#BE185D", accent: "#FDE047" },
    skin: SKIN.light, hair: { color: "#E8B4B8", style: "bun" },
    headwear: "none", accessory: "wings",
  },
  {
    id: "dragon_rider",
    name: { ru: "Драконий всадник", kk: "Айдаһар мінген", en: "Dragon Rider" },
    price: 2220, rarity: "legendary", appeal: "boys",
    palette: { bg1: "#FEE2E2", bg2: "#FECACA", suit: "#B91C1C", suitDark: "#7F1D1D", accent: "#F59E0B" },
    skin: SKIN.mid, hair: { color: "#3B2E2A", style: "long" },
    headwear: "helmet", accessory: "wings",
  },
  {
    id: "star_reader",
    name: { ru: "Звёздный читатель", kk: "Жұлдызды оқырман", en: "Star Reader" },
    price: 2450, rarity: "legendary", appeal: "neutral",
    palette: { bg1: "#1E1B4B", bg2: "#312E81", suit: "#4C1D95", suitDark: "#2E1065", accent: "#FDE047" },
    skin: SKIN.deep, hair: { color: "#1F1A17", style: "curly" },
    headwear: "crown", accessory: "book",
  },
  // ── Казахская коллекция ──
  {
    id: "aldar",
    name: { ru: "Алдар Косе", kk: "Алдар Көсе", en: "Aldar Kose" },
    price: 670, rarity: "common", appeal: "neutral",
    palette: { bg1: "#FEF9C3", bg2: "#FEF08A", suit: "#B45309", suitDark: "#8A3F07", accent: "#DC2626" },
    skin: SKIN.tan, hair: { color: "#2B2018", style: "short" },
    headwear: "kalpak", accessory: "none",
  },
  {
    id: "akyn",
    name: { ru: "Акын", kk: "Ақын", en: "Akyn" },
    price: 780, rarity: "common", appeal: "neutral",
    palette: { bg1: "#E0F2FE", bg2: "#BAE6FD", suit: "#0E7490", suitDark: "#0A566B", accent: "#D4A017" },
    skin: SKIN.tan, hair: { color: "#1F1A17", style: "short" },
    headwear: "takiya", accessory: "kobyz",
  },
  {
    id: "burkitshi",
    name: { ru: "Беркутчи", kk: "Бүркітші", en: "Eagle Hunter" },
    price: 1220, rarity: "rare", appeal: "boys",
    palette: { bg1: "#FEF3C7", bg2: "#FDE68A", suit: "#7C4A1E", suitDark: "#5C3614", accent: "#D97706" },
    skin: SKIN.tan, hair: { color: "#1F1A17", style: "short" },
    headwear: "tymak", accessory: "eagle",
  },
  {
    id: "kyz_zhibek",
    name: { ru: "Кыз Жибек", kk: "Қыз Жібек", en: "Kyz Zhibek" },
    price: 1330, rarity: "rare", appeal: "girls",
    palette: { bg1: "#FDF2F8", bg2: "#FBCFE8", suit: "#9D174D", suitDark: "#7A1039", accent: "#D4A017" },
    skin: SKIN.light, hair: { color: "#1F1A17", style: "braids" },
    headwear: "saukele", accessory: "shanyrak",
  },
  {
    id: "tomiris",
    name: { ru: "Томирис", kk: "Томирис", en: "Tomyris" },
    price: 2670, rarity: "legendary", appeal: "girls",
    palette: { bg1: "#FEF3C7", bg2: "#FCD34D", suit: "#92400E", suitDark: "#6B2D06", accent: "#F5C518" },
    skin: SKIN.tan, hair: { color: "#1F1A17", style: "braids" },
    headwear: "saka_helmet", accessory: "sword",
  },
];

export const RARITY_LABEL: Record<Rarity, { ru: string; kk: string; en: string }> = {
  common: { ru: "Обычный", kk: "Қарапайым", en: "Common" },
  rare: { ru: "Редкий", kk: "Сирек", en: "Rare" },
  legendary: { ru: "Легендарный", kk: "Аңызға айналған", en: "Legendary" },
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#6B7280",
  rare: "#6D4AFF",
  legendary: "#F5A623",
};

export const avatarById = (id: string): AvatarDef | undefined =>
  AVATARS.find((a) => a.id === id);

/** Значения поля profile.avatar: эмодзи, либо "av:<id>" для персонажа. */
export const AVATAR_PREFIX = "av:";
export const isAvatarId = (v: string) => v.startsWith(AVATAR_PREFIX);
export const toAvatarValue = (id: string) => `${AVATAR_PREFIX}${id}`;
export const fromAvatarValue = (v: string) => v.slice(AVATAR_PREFIX.length);
