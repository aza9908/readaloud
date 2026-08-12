/**
 * cards.ts — карточки-награды: коллекционная механика поверх чтения.
 *
 * ЗАЧЕМ. Монеты — это «зарплата»: понятная, но предсказуемая. Карточка —
 * сюрприз: ребёнок не знает, что выпадет, и это тянет открыть следующую.
 * Именно на этом держатся коллекционные игры, и именно этого не хватало
 * между «дочитал книгу» и «накопил на героя».
 *
 * ЧЕМ ЭТО НЕ ЯВЛЯЕТСЯ. Здесь намеренно нет платных сундуков и покупки
 * попыток за деньги: это детское приложение, и механика «заплати, чтобы
 * крутить ещё» в нём неуместна. Карточка выдаётся ТОЛЬКО за работу —
 * дочитанную книгу, решённую задачу, выигранный матч. Купить нельзя.
 *
 * Модуль чистый и покрыт тестами: test/cards.test.mjs
 */

export type CardRarity = "common" | "rare" | "epic";

export interface CollectibleCard {
  id: string;
  name: { ru: string; kk: string; en: string };
  /** Короткий познавательный факт — карточка должна чему-то учить. */
  fact: { ru: string; kk: string; en: string };
  emoji: string;
  rarity: CardRarity;
  /** Набор, к которому относится карточка: собрал набор — получил бонус. */
  set: "Космос" | "Природа" | "Казахстан" | "Наука";
}

export const CARD_RARITY_LABEL: Record<CardRarity, string> = {
  common: "Обычная", rare: "Редкая", epic: "Эпическая",
};

export const CARD_RARITY_COLOR: Record<CardRarity, string> = {
  common: "#6B7280", rare: "#6D4AFF", epic: "#F5A623",
};

/** Шансы выпадения. Эпические редки, но не настолько, чтобы стать недостижимыми. */
export const RARITY_CHANCE: Record<CardRarity, number> = {
  common: 0.62, rare: 0.30, epic: 0.08,
};

/** Бонус за собранный набор целиком. */
export const SET_BONUS = 150;

export const CARDS: CollectibleCard[] = [
  // ── Космос ──
  { id: "c_moon", set: "Космос", rarity: "common", emoji: "🌙",
    name: { ru: "Луна", kk: "Ай", en: "Moon" },
    fact: { ru: "Луна всегда повёрнута к Земле одной стороной.",
            kk: "Ай Жерге әрдайым бір жағымен қарайды.",
            en: "The Moon always shows Earth the same side." } },
  { id: "c_sun", set: "Космос", rarity: "common", emoji: "☀️",
    name: { ru: "Солнце", kk: "Күн", en: "Sun" },
    fact: { ru: "Свет от Солнца летит до Земли восемь минут.",
            kk: "Күн сәулесі Жерге сегіз минутта жетеді.",
            en: "Sunlight takes eight minutes to reach Earth." } },
  { id: "c_saturn", set: "Космос", rarity: "rare", emoji: "🪐",
    name: { ru: "Сатурн", kk: "Сатурн", en: "Saturn" },
    fact: { ru: "Кольца Сатурна состоят изо льда и камней.",
            kk: "Сатурнның сақиналары мұз бен тастан тұрады.",
            en: "Saturn's rings are made of ice and rock." } },
  { id: "c_comet", set: "Космос", rarity: "epic", emoji: "☄️",
    name: { ru: "Комета", kk: "Құйрықты жұлдыз", en: "Comet" },
    fact: { ru: "Хвост кометы всегда направлен прочь от Солнца.",
            kk: "Кометаның құйрығы әрқашан Күннен кері бағытта.",
            en: "A comet's tail always points away from the Sun." } },

  // ── Природа ──
  { id: "c_bee", set: "Природа", rarity: "common", emoji: "🐝",
    name: { ru: "Пчела", kk: "Ара", en: "Bee" },
    fact: { ru: "Пчёлы рассказывают друг другу дорогу танцем.",
            kk: "Аралар бір-біріне жолды билеп көрсетеді.",
            en: "Bees tell each other directions by dancing." } },
  { id: "c_oak", set: "Природа", rarity: "common", emoji: "🌳",
    name: { ru: "Дуб", kk: "Емен", en: "Oak" },
    fact: { ru: "Дуб может жить больше пятисот лет.",
            kk: "Емен бес жүз жылдан астам өмір сүреді.",
            en: "An oak can live more than five hundred years." } },
  { id: "c_owl", set: "Природа", rarity: "rare", emoji: "🦉",
    name: { ru: "Сова", kk: "Үкі", en: "Owl" },
    fact: { ru: "Сова поворачивает голову почти на три четверти круга.",
            kk: "Үкі басын шеңбердің үштен екісіне бұрады.",
            en: "An owl turns its head three quarters of a circle." } },
  { id: "c_whale", set: "Природа", rarity: "epic", emoji: "🐋",
    name: { ru: "Синий кит", kk: "Көк кит", en: "Blue Whale" },
    fact: { ru: "Сердце синего кита размером с автомобиль.",
            kk: "Көк киттің жүрегі көлік көлеміндей.",
            en: "A blue whale's heart is the size of a car." } },

  // ── Казахстан ──
  { id: "c_eagle", set: "Казахстан", rarity: "common", emoji: "🦅",
    name: { ru: "Беркут", kk: "Бүркіт", en: "Golden Eagle" },
    fact: { ru: "Беркут видит добычу за два километра.",
            kk: "Бүркіт олжаны екі шақырымнан көреді.",
            en: "A golden eagle spots prey two kilometres away." } },
  { id: "c_yurt", set: "Казахстан", rarity: "common", emoji: "🏕️",
    name: { ru: "Юрта", kk: "Киіз үй", en: "Yurt" },
    fact: { ru: "Юрту можно собрать меньше чем за час.",
            kk: "Киіз үйді бір сағаттан аз уақытта тігуге болады.",
            en: "A yurt can be assembled in under an hour." } },
  { id: "c_dombra", set: "Казахстан", rarity: "rare", emoji: "🪕",
    name: { ru: "Домбра", kk: "Домбыра", en: "Dombra" },
    fact: { ru: "У домбры всего две струны, но сотни мелодий.",
            kk: "Домбыраның екі ішегі бар, бірақ жүздеген күй.",
            en: "The dombra has two strings but hundreds of tunes." } },
  { id: "c_snowleopard", set: "Казахстан", rarity: "epic", emoji: "🐆",
    name: { ru: "Снежный барс", kk: "Қар барысы", en: "Snow Leopard" },
    fact: { ru: "Снежный барс прыгает на шесть метров в длину.",
            kk: "Қар барысы алты метрге секіреді.",
            en: "A snow leopard leaps six metres in one bound." } },

  // ── Наука ──
  { id: "c_magnet", set: "Наука", rarity: "common", emoji: "🧲",
    name: { ru: "Магнит", kk: "Магнит", en: "Magnet" },
    fact: { ru: "Земля — огромный магнит, поэтому работает компас.",
            kk: "Жер — үлкен магнит, сондықтан компас жұмыс істейді.",
            en: "Earth is a giant magnet — that is why compasses work." } },
  { id: "c_rainbow", set: "Наука", rarity: "common", emoji: "🌈",
    name: { ru: "Радуга", kk: "Кемпірқосақ", en: "Rainbow" },
    fact: { ru: "Радуга — это круг, но с земли виден лишь его край.",
            kk: "Кемпірқосақ — шеңбер, бірақ жерден тек шеті көрінеді.",
            en: "A rainbow is a full circle; from the ground we see an arc." } },
  { id: "c_dna", set: "Наука", rarity: "rare", emoji: "🧬",
    name: { ru: "ДНК", kk: "ДНҚ", en: "DNA" },
    fact: { ru: "В одной клетке ДНК длиной около двух метров.",
            kk: "Бір жасушадағы ДНҚ ұзындығы екі метрдей.",
            en: "The DNA in one cell is about two metres long." } },
  { id: "c_blackhole", set: "Наука", rarity: "epic", emoji: "🕳️",
    name: { ru: "Чёрная дыра", kk: "Қара құрдым", en: "Black Hole" },
    fact: { ru: "Из чёрной дыры не может вырваться даже свет.",
            kk: "Қара құрдымнан жарық та шыға алмайды.",
            en: "Not even light can escape a black hole." } },
];

export const CARD_SETS = ["Космос", "Природа", "Казахстан", "Наука"] as const;

export function cardsInSet(set: string): CollectibleCard[] {
  return CARDS.filter((c) => c.set === set);
}

/** Собран ли набор целиком. */
export function isSetComplete(set: string, owned: string[]): boolean {
  const need = cardsInSet(set);
  return need.length > 0 && need.every((c) => owned.includes(c.id));
}

/**
 * Какая карточка выпадет.
 *
 * Выбор детерминирован от seed (обычно это id книги или задачи), поэтому
 * одна и та же работа всегда даёт одну и ту же карточку. Это важно: иначе
 * ребёнок, увидев неинтересную карточку, перезагружал бы страницу ради
 * другой — и превратил бы награду в игровой автомат.
 *
 * Приоритет отдаётся карточкам, которых у ребёнка ещё нет: коллекция должна
 * пополняться, а не выдавать десятого «Дуба».
 */
export function drawCard(seed: string, owned: string[]): CollectibleCard {
  const h = hash(seed);
  const roll = (h % 1000) / 1000;

  const rarity: CardRarity =
    roll < RARITY_CHANCE.epic ? "epic"
    : roll < RARITY_CHANCE.epic + RARITY_CHANCE.rare ? "rare"
    : "common";

  const pool = CARDS.filter((c) => c.rarity === rarity);
  const fresh = pool.filter((c) => !owned.includes(c.id));
  // Если все карточки этой редкости уже собраны — берём любую недостающую,
  // и лишь затем повторную.
  const anyFresh = CARDS.filter((c) => !owned.includes(c.id));
  const target = fresh.length > 0 ? fresh : anyFresh.length > 0 ? anyFresh : pool;

  return target[h % target.length];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
