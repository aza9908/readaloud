import lion from "@/assets/companions/lion.webp";
import dolphin from "@/assets/companions/dolphin.webp";
import fox from "@/assets/companions/fox.webp";
import panda from "@/assets/companions/panda.webp";
import unicorn from "@/assets/companions/unicorn.webp";
import frog from "@/assets/companions/frog.webp";
import butterfly from "@/assets/companions/butterfly.webp";
import tiger from "@/assets/companions/tiger.webp";
import koala from "@/assets/companions/koala.webp";
import owl from "@/assets/companions/owl.webp";

// Existing profiles store the original emoji. Its portrait is a presentation choice.
export const companions = [
  { value: "🦁", image: lion, name: { ru: "Лев", kk: "Арыстан", en: "Lion" } },
  { value: "🐬", image: dolphin, name: { ru: "Дельфин", kk: "Дельфин", en: "Dolphin" } },
  { value: "🦊", image: fox, name: { ru: "Лиса", kk: "Түлкі", en: "Fox" } },
  { value: "🐼", image: panda, name: { ru: "Панда", kk: "Панда", en: "Panda" } },
  { value: "🦄", image: unicorn, name: { ru: "Единорог", kk: "Бірмүйіз", en: "Unicorn" } },
  { value: "🐸", image: frog, name: { ru: "Лягушка", kk: "Бақа", en: "Frog" } },
  { value: "🦋", image: butterfly, name: { ru: "Бабочка", kk: "Көбелек", en: "Butterfly" } },
  { value: "🐯", image: tiger, name: { ru: "Тигр", kk: "Жолбарыс", en: "Tiger" } },
  { value: "🐨", image: koala, name: { ru: "Коала", kk: "Коала", en: "Koala" } },
  { value: "🦉", image: owl, name: { ru: "Сова", kk: "Үкі", en: "Owl" } },
];
