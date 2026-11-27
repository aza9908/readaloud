import starters from "./starterBooks.json";
import type { Book, Language } from "./types";
import coastCover from "@/assets/worlds/golden-coast-192.webp";
import coastPage from "@/assets/worlds/golden-coast-576.webp";
import turnipCover from "@/assets/worlds/turnip-garden-192.webp";
import turnipPage from "@/assets/worlds/turnip-garden-720.webp";
import rocketCover from "@/assets/worlds/rocket-garden-192.webp";
import rocketPage from "@/assets/worlds/rocket-garden-720.webp";

export type JacketBook = Pick<Book, "language" | "title"> & Partial<Pick<Book, "coverEmoji" | "coverUrl" | "pageImages" | "isCustom">>;
export interface StoryArt {
  id: string;
  cover: string;
  page: string;
  alt: string;
  kind: "scene" | "model";
  language: Language;
}

const pictures = import.meta.glob<string>("../assets/stories/*.webp", { eager: true, import: "default" });
function scene(id: string, alt: string, language: Language = "ru"): StoryArt {
  return { id, alt, language, kind: "scene", cover: pictures[`../assets/stories/${id}-360.webp`], page: pictures[`../assets/stories/${id}-840.webp`] };
}

const bruno = [
  scene("bruno-library", "Bruno visits the forest library.", "en"),
  scene("bruno-oak", "Bruno reads beneath the old oak tree.", "en"),
  scene("bruno-discovery", "Bruno finds an old star atlas behind a shelf.", "en"),
  scene("bruno-atlas", "Bruno traces the constellations in the open atlas.", "en"),
  scene("bruno-night", "Bruno looks up at the stars above the forest.", "en"),
  scene("bruno-friends", "Bruno shares his book with his woodland friends.", "en"),
];
const coast: StoryArt = { id: "golden-coast", cover: coastCover, page: coastPage, kind: "model", language: "kk", alt: "Теңіз жағасындағы балықшының үйі." };
const rocket: StoryArt = { id: "rocket-garden", cover: rocketCover, page: rocketPage, kind: "model", language: "en", alt: "A rocket stands ready to explore the stars." };
const turnip: StoryArt = { id: "turnip-garden", cover: turnipCover, page: turnipPage, kind: "model", language: "ru", alt: "Большая репка в огороде." };

const woodland = scene("woodland-path", "Тропинка в сказочном лесу.");
const underwater = scene("underwater", "Small golden fish swim through a sunlit coral reef.", "en");
const steppe = scene("open-steppe", "Далада шөптің арасымен бұлақ ағып жатыр.", "kk");
const desk = scene("reading-desk", "Открытая книга в уголке для чтения.");
const atlas = scene("atlas-desk", "Глобус и атлас на столе путешественника.");
const fox = scene("fox-hare", "Қоян мен түлкі орман соқпағында.", "kk");
const dragon = scene("ember", "Ember the little dragon reads a book.", "en");
const bunny = scene("benny", "Benny the rabbit sets out on his adventure.", "en");
const cottage = scene("teremok", "Лесные звери собираются у теремка.");

const titles: Record<string, StoryArt> = {
  "ru:колобок": scene("kolobok", "Колобок на подоконнике, за ним видна лесная тропинка."),
  "ru:теремок": cottage,
  "ru:маша и медведь": scene("masha", "Маша и медведь у лесной избушки."),
  "ru:репка": turnip,
  "ru:сказка о рыбаке и рыбке": { ...coast, language: "ru", alt: "Домик рыбака на берегу моря." },
  "en:stars and rockets": rocket,
  "en:dragon's reading quest": dragon,
  "en:the bear who loved books": bruno[0],
  "en:friends under the sea": underwater,
  "en:bunny's big adventure": bunny,
  "kk:ер төстік": scene("ertostik", "Ер Төстік атпен сапарға шығады.", "kk"),
  "kk:алдар көсе": scene("aldar", "Алдар Көсе ауылда әңгіме айтып отыр.", "kk"),
  "kk:қоян мен түлкі": fox,
  "kk:алтын балық": coast,
  "kk:ақылды қыз": scene("aisulu", "Қыз киіз үйдің алдында кітап оқып отыр.", "kk"),
};

const stars = scene("star-dome", "Латунный телескоп на холме под звёздами.");
const castle = scene("storybook-castle", "Каменный мост ведёт к замку с медными башнями.");
const lion = scene("lion-grove", "Львёнок наблюдает за бабочкой под акацией.");
const studio = scene("paint-studio", "Кисточки, краски и деревянная птица на столе художника.");

const motifs: Record<string, StoryArt> = {
  "🌐": atlas, "🗺️": atlas, "🎨": studio, "📖": desk, "📚": desk, "🦊": fox, "🐰": bunny,
  "🐇": bunny, "🐻": woodland, "🦁": lion, "🏠": cottage, "🏰": castle, "🐉": dragon,
  "🚀": rocket, "🌟": stars, "🌊": underwater, "🐟": underwater, "⚔️": steppe, "✨": stars, "⛵": underwater,
};

const subjectCovers: [RegExp, StoryArt][] = [
  [/космос|ракет|rocket|ғарыш|зымыран/i, rocket],
  [/зв[её]зд|созвезд|астроном|star |stars|constellation|жұлдыз/i, stars],
  [/океан|подвод|морск|ocean|undersea|coral|теңіз|мұхит/i, underwater],
  [/дракон|dragon|айдаһар/i, dragon],
  [/замок|замке|castle|қамал/i, castle],
  [/заяц|зайч|rabbit|bunny|қоян/i, bunny],
  [/forest|woodland|лесн|медве|орман|аю/i, woodland],
  [/степь|степи|steppe|дала/i, steppe],
  [/атлас|atlas|географ|geograph|карта/i, atlas],
  [/худож|краски|paint|сурет/i, studio],
];

function titleKey(language: Language, title: string) {
  return language + ":" + title.trim().toLowerCase().replace(/[’‘]/g, "'");
}
const starterMotifs = new Map(starters.map(book => [titleKey(book.language as Language, book.title), book.coverEmoji]));

export function jacketArt(book: JacketBook): StoryArt {
  const key = titleKey(book.language, book.title);
  const catalog = titles[key];
  const generic = !book.coverEmoji || ["📖", "📚", "🌐", "✨"].includes(book.coverEmoji);
  if (catalog && (!book.isCustom || generic || book.coverEmoji === starterMotifs.get(key))) return catalog;
  // Imported books often carry only the old generic book or globe symbol.
  const motif = book.coverEmoji;
  if (generic) {
    const subject = subjectCovers.find(([match]) => match.test(book.title));
    if (subject) return subject[1];
  }
  return motif && Object.prototype.hasOwnProperty.call(motifs, motif) ? motifs[motif] : desk;
}

const brunoPassages = [/visit the forest library/i, /under the big oak/i, /hidden behind a tall shelf/i,
  /each star had a name/i, /that night, bruno/i, /shared the star book/i];

export function readingArt(book: Book, page: number): StoryArt {
  const cover = jacketArt(book);
  if (titles[titleKey(book.language, book.title)] !== bruno[0]) return cover;
  const passage = book.pages[page] ?? "";
  const matched = brunoPassages.findIndex(cue => cue.test(passage));
  const position = Math.round(page * (bruno.length - 1) / Math.max(1, book.pages.length - 1));
  return bruno[matched >= 0 ? matched : position] ?? cover;
}
