import {
  AlarmClock, Backpack, BicepsFlexed, Bike, Bird, BookOpen, CakeSlice, CalendarDays,
  Camera, Candy, Carrot, Castle, Cat, Check, CircleDot, CircleHelp, CircleX, Clipboard, Clock3,
  Cloud, Coins, Crown, Dna, Eclipse, FileText, Fish, Flame, UserRound, Gamepad2, Gauge,
  Gem, Gift, Globe2, HandHeart, Handshake, Hourglass, House, IceCreamCone, Info, Laugh,
  LibraryBig, Lightbulb, LockKeyhole, Magnet, Mic, Moon, Orbit, Palette, PartyPopper, PawPrint,
  Pizza, Popcorn, Rabbit, Rainbow, Rocket, School, Search, ShieldPlus, Ship, Shirt, Smile, Smartphone,
  Sparkles, Speech, Square, Star, Sun, Swords, Ticket, Trash2, TreeDeciduous,
  TriangleAlert, Trophy, Turtle, Upload, Users, Volleyball, Waves, Zap, type LucideIcon,
} from "lucide-react";
import { Bear, Bee, Comet, Dombra, Dragon, Whale, Yurt } from "./StorySymbols";
import { companions } from "@/lib/companions";
import type { Language } from "@/lib/types";
import globe from "@/assets/objects/globe.webp";
import book from "@/assets/objects/book.webp";
import watch from "@/assets/objects/watch.webp";
import pace from "@/assets/objects/pace.webp";
import coins from "@/assets/objects/coins.webp";
import star from "@/assets/objects/star.webp";
import cup from "@/assets/objects/cup.webp";
import satchel from "@/assets/objects/satchel.webp";
import gem from "@/assets/objects/gem.webp";
import crown from "@/assets/objects/crown.webp";
import alarm from "@/assets/objects/alarm.webp";

const miniatures = {
  globe: [globe, Globe2], book: [book, BookOpen], watch: [watch, Clock3], pace: [pace, Gauge],
  coins: [coins, Coins], star: [star, Star], cup: [cup, Trophy], satchel: [satchel, Backpack],
  gem: [gem, Gem], crown: [crown, Crown], alarm: [alarm, AlarmClock],
} as const;

type ObjectName = keyof typeof miniatures;

// Old books, rewards and achievements already store these symbols in Firestore.
const objects = new Map<string, ObjectName>(Object.entries({
  "🌐": "globe", "🌍": "globe", "📖": "book", "📚": "book", "📗": "book", "📘": "book",
  "🕐": "watch", "📈": "pace", "🪙": "coins", "⭐": "star", "🌟": "star", "🏆": "cup",
  "🎒": "satchel", "💎": "gem", "👑": "crown", "⏰": "alarm",
} as const));

const symbols = new Map<string, LucideIcon>(Object.entries({
  "✨": Sparkles, "⚠": TriangleAlert, "❌": CircleX, "✅": Check, "ℹ": Info, "📄": FileText,
  "📋": Clipboard, "⬆": Upload, "⚡": Zap, "⏳": Hourglass, "📅": CalendarDays, "🔒": LockKeyhole,
  "🗑": Trash2, "🎉": PartyPopper, "🔥": Flame, "🤝": Handshake, "💪": BicepsFlexed, "👏": HandHeart,
  "📸": Camera, "🎤": Mic, "⏹": Square, "🗣": Speech, "💡": Lightbulb, "🤔": CircleHelp,
  "🐾": PawPrint, "🏰": Castle, "🚀": Rocket, "😄": Laugh, "😀": Smile, "🙂": Turtle, "👫": Users,
  "🦸": ShieldPlus, "🌳": TreeDeciduous, "🌊": Waves, "🏫": School, "⚽": Volleyball, "🍰": CakeSlice,
  "🔍": Search, "🏠": House, "🍦": IceCreamCone, "🍿": Popcorn, "🎮": Gamepad2, "🍕": Pizza,
  "🎁": Gift, "🧸": Bear, "🚲": Bike, "📱": Smartphone, "🎨": Palette, "🍫": Candy, "🎢": Ticket,
  "🥋": Shirt, "🐻": Bear, "🐇": Rabbit, "🐰": Rabbit, "☁": Cloud, "🟡": CircleDot, "⛵": Ship, "🌱": TreeDeciduous,
  "⚔": Swords, "👧": UserRound, "🐟": Fish, "🥕": Carrot, "🌙": Moon, "☀": Sun, "🪐": Orbit,
  "☄": Comet, "🐝": Bee, "🐋": Whale, "🦅": Bird, "🏕": Yurt, "🪕": Dombra, "🐆": Cat,
  "🧲": Magnet, "🌈": Rainbow, "🧬": Dna, "🕳": Eclipse, "🐉": Dragon,
  "library": LibraryBig,
}));

const pickerLabels: Record<string, string> = {
  "📖": "Книга", "🦊": "Лиса", "🐻": "Медведь", "🚀": "Ракета", "🌟": "Звезда", "🐉": "Дракон",
  "🏰": "Замок", "🌊": "Море", "🦁": "Лев", "🎨": "Палитра", "🍦": "Мороженое", "🍿": "Кино",
  "⚽": "Футбольный мяч", "🎮": "Игра", "🍕": "Пицца", "🎁": "Подарок", "🧸": "Игрушка",
  "🚲": "Велосипед", "📱": "Телефон", "🍫": "Шоколад", "🎢": "Аттракционы",
};

export const iconLabel = (value: string) => pickerLabels[value.replace(/\uFE0F/g, "")] ?? "Иллюстрация";

export function BookserIcon({ value, size = 24, line = false, fallback = "book" }: {
  value?: string; size?: number; line?: boolean; fallback?: "book" | "gift";
}) {
  const key = (value ?? "").replace(/\uFE0F/g, "");
  const object = Object.prototype.hasOwnProperty.call(miniatures, key) ? key as ObjectName : objects.get(key);
  const companion = companions.find(c => c.value === key);
  const Glyph = (object && miniatures[object][1]) || symbols.get(key) || (companion ? PawPrint : undefined);
  const art = object ? miniatures[object][0] : companion?.image;
  if (!line && (art || (!Glyph && fallback === "book"))) {
    return <img className={companion ? "bookser-icon object-portrait" : "bookser-icon object-art"} aria-hidden="true" alt=""
      data-object={object ?? (companion ? "portrait" : "book")} src={art ?? book} width={size} height={size} draggable={false} />;
  }
  const Symbol = Glyph || (fallback === "gift" ? Gift : BookOpen);
  return <span className={line ? "bookser-icon line-icon" : "bookser-icon enamel-icon"} style={{ width: size, height: size }} aria-hidden="true">
    <Symbol size={line ? size : Math.round(size * .65)} strokeWidth={1.8} />
  </span>;
}

export function LanguageMark({ language }: { language: Language }) {
  return <span className="language-mark" aria-hidden="true">{language.toUpperCase()}</span>;
}
