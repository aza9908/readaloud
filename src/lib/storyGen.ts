/**
 * storyGen.ts — offline story generator.
 *
 * Used when (a) nothing suitable is found online, and (b) the AI function
 * isn't available. It composes an original, age-appropriate story from the
 * child's chosen topics using a scene-based template with varied slots, so
 * two runs with the same topics don't produce identical text.
 *
 * The output is deliberately simple: short sentences, concrete nouns,
 * repetition of the hero's name — which is what early readers need anyway.
 */

import type { Language } from "./types";

type TopicKey = "animals" | "magic" | "adventure" | "funny" | "friendship" | "hero" | "nature" | "space" | "sea" | "school" | "sport" | "food" | "mystery" | "family";

interface Cast {
  hero: string;
  /** Grammatical gender of `hero` — Russian verbs/adjectives must agree. */
  gender: "m" | "f";
  heroTrait: string;
  friend: string;
  place: string;
  problem: string;
  helper: string;
  treasure: string;
}

const pick = <T,>(arr: readonly T[], seed: number) => arr[seed % arr.length];

/** Capitalises the first letter — needed when a name opens a sentence. */
const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);

// ───────────────────────── Vocabulary ─────────────────────────

const RU: Record<TopicKey, Partial<Cast>> & { base: Cast } = {
  base: {
    hero: "Айсулу", gender: "f", heroTrait: "добрая", friend: "щенок Барс", place: "у большого дуба",
    problem: "потерялся маленький котёнок", helper: "мудрая сова", treasure: "тёплая дружба",
  },
  animals: { hero: "лисёнок Рыжик", gender: "m", heroTrait: "любопытный", friend: "зайчонок Пух", place: "в густом лесу", problem: "исчезли все ягоды", helper: "старый барсук", treasure: "полная корзина ягод" },
  magic:   { hero: "Алина", gender: "f", heroTrait: "смелая", friend: "маленький дракон Уголёк", place: "у волшебного озера", problem: "погасли все звёзды", helper: "добрая волшебница", treasure: "звёздный фонарик" },
  adventure:{ hero: "Тимур", gender: "m", heroTrait: "храбрый", friend: "пёс Верный", place: "на высокой горе", problem: "пропала старая карта", helper: "горный орёл", treasure: "древний компас" },
  funny:   { hero: "ёжик Пыхтя", gender: "m", heroTrait: "весёлый", friend: "белка Стрелка", place: "на лесной поляне", problem: "все шишки укатились", helper: "смешной бобёр", treasure: "гора орехов" },
  friendship:{ hero: "Данияр", gender: "m", heroTrait: "верный", friend: "новенькая девочка Сая", place: "во дворе", problem: "никто не хотел играть вместе", helper: "добрый дедушка", treasure: "новая дружба" },
  hero:    { hero: "батыр Ерлан", gender: "m", heroTrait: "сильный", friend: "конь Ветер", place: "в широкой степи", problem: "река перестала течь", helper: "старый мудрец", treasure: "чистая вода для аула" },
  nature:  { hero: "Мира", gender: "f", heroTrait: "заботливая", friend: "бабочка Луна", place: "в старом саду", problem: "засохло любимое дерево", helper: "садовник Ильяс", treasure: "первый зелёный листок" },
  space:   { hero: "Нурлан", gender: "m", heroTrait: "мечтательный", friend: "робот Пик", place: "на маленькой планете", problem: "потерялась одна звезда", helper: "капитан ракеты", treasure: "карта звёздного неба" },
  sea:     { hero: "рыбка Искорка", gender: "f", heroTrait: "быстрая", friend: "черепаха Тиша", place: "на дне синего моря", problem: "запутались водоросли", helper: "старый краб", treasure: "блестящая жемчужина" },
  school:  { hero: "Амина", gender: "f", heroTrait: "внимательная", friend: "сосед по парте Арман", place: "в школьном классе", problem: "потерялся школьный журнал", helper: "учительница Гульнара", treasure: "первая пятёрка" },
  sport:   { hero: "Ерасыл", gender: "m", heroTrait: "упорный", friend: "тренер Марат", place: "на стадионе", problem: "не получалось забить гол", helper: "старший брат", treasure: "золотая медаль" },
  food:    { hero: "поварёнок Аружан", gender: "f", heroTrait: "старательная", friend: "кот Пирожок", place: "на тёплой кухне", problem: "убежало тесто", helper: "бабушка", treasure: "самый вкусный пирог" },
  mystery: { hero: "Санжар", gender: "m", heroTrait: "наблюдательный", friend: "подруга Дана", place: "в старом доме", problem: "по ночам кто-то шумел", helper: "соседский кот", treasure: "разгаданная тайна" },
  family:  { hero: "Алуа", gender: "f", heroTrait: "ласковая", friend: "младший брат Ануар", place: "в родном доме", problem: "все забыли про праздник", helper: "мама", treasure: "самый тёплый вечер" },
};

const KK: Record<TopicKey, Partial<Cast>> & { base: Cast } = {
  base: { hero: "Айсұлу", gender: "f", heroTrait: "добрая", friend: "күшік Барыс", place: "үлкен емен түбінде", problem: "кішкентай мысық адасып кетті", helper: "дана үкі", treasure: "жылы достық" },
  animals: { hero: "түлкі Қызылшақа", heroTrait: "қызық", friend: "қоян Үлпек", place: "қалың орманда", problem: "барлық жидек жоғалды", helper: "кәрі борсық", treasure: "толы себет жидек" },
  magic: { hero: "Әлия", heroTrait: "батыл", friend: "кішкентай айдаһар Шоқ", place: "сиқырлы көл жағасында", problem: "жұлдыздар сөніп қалды", helper: "мейірімді сиқыршы", treasure: "жұлдызды шам" },
  adventure: { hero: "Темір", heroTrait: "ержүрек", friend: "ит Адал", place: "биік тауда", problem: "ескі карта жоғалды", helper: "тау бүркіті", treasure: "көне компас" },
  funny: { hero: "кірпі Пысқақ", heroTrait: "көңілді", friend: "тиін Жебе", place: "орман алаңында", problem: "барлық бүршік домалап кетті", helper: "күлкілі құндыз", treasure: "жаңғақ үйіндісі" },
  friendship: { hero: "Дәнияр", heroTrait: "адал", friend: "жаңа көрші қыз Сая", place: "аулада", problem: "ешкім бірге ойнағысы келмеді", helper: "мейірімді ата", treasure: "жаңа достық" },
  hero: { hero: "батыр Ерлан", heroTrait: "күшті", friend: "жүйрік ат Жел", place: "кең далада", problem: "өзен ағуын тоқтатты", helper: "кәрі данышпан", treasure: "ауылға таза су" },
  nature: { hero: "Мира", heroTrait: "қамқор", friend: "көбелек Ай", place: "ескі бақта", problem: "сүйікті ағаш қурап қалды", helper: "бағбан Ілияс", treasure: "алғашқы жасыл жапырақ" },
  space: { hero: "Нұрлан", heroTrait: "армандаушы", friend: "робот Пик", place: "кішкентай планетада", problem: "бір жұлдыз жоғалды", helper: "зымыран капитаны", treasure: "жұлдызды аспан картасы" },
  sea: { hero: "балық Ұшқын", heroTrait: "жылдам", friend: "тасбақа Тыныш", place: "көк теңіз түбінде", problem: "балдырлар шатасып қалды", helper: "кәрі шаян", treasure: "жарқыраған меруерт" },
  school: { hero: "Әмина", heroTrait: "зейінді", friend: "партадағы досы Арман", place: "мектеп сыныбында", problem: "сынып журналы жоғалды", helper: "мұғалім Гүлнара", treasure: "алғашқы бестік" },
  sport: { hero: "Ерасыл", heroTrait: "табанды", friend: "жаттықтырушы Марат", place: "стадионда", problem: "гол сала алмады", helper: "үлкен ағасы", treasure: "алтын медаль" },
  food: { hero: "аспаз Аружан", heroTrait: "тырысқақ", friend: "мысық Бауырсақ", place: "жылы асханада", problem: "қамыр қашып кетті", helper: "әже", treasure: "ең дәмді бәліш" },
  mystery: { hero: "Санжар", heroTrait: "байқағыш", friend: "досы Дана", place: "ескі үйде", problem: "түнде біреу шуылдады", helper: "көрші мысығы", treasure: "шешілген құпия" },
  family: { hero: "Алуа", heroTrait: "мейірбан", friend: "інісі Ануар", place: "туған үйде", problem: "бәрі мерекені ұмытып кетті", helper: "ана", treasure: "ең жылы кеш" },
};

const EN: Record<TopicKey, Partial<Cast>> & { base: Cast } = {
  base: { hero: "Mira", gender: "f", heroTrait: "kind", friend: "a puppy named Scout", place: "by the big oak tree", problem: "a little kitten was lost", helper: "a wise owl", treasure: "a warm friendship" },
  animals: { hero: "Rusty the fox cub", heroTrait: "curious", friend: "Pip the rabbit", place: "deep in the forest", problem: "all the berries had vanished", helper: "an old badger", treasure: "a basket full of berries" },
  magic: { hero: "Elsie", heroTrait: "brave", friend: "a small dragon named Ember", place: "beside a magic lake", problem: "every star had gone dark", helper: "a gentle wizard", treasure: "a lantern full of starlight" },
  adventure: { hero: "Theo", heroTrait: "bold", friend: "a dog named Trusty", place: "high on a mountain", problem: "the old map went missing", helper: "a mountain eagle", treasure: "an ancient compass" },
  funny: { hero: "Puffin the hedgehog", heroTrait: "cheerful", friend: "Zip the squirrel", place: "in a sunny clearing", problem: "all the pinecones rolled away", helper: "a silly beaver", treasure: "a mountain of nuts" },
  friendship: { hero: "Danny", heroTrait: "loyal", friend: "a new girl named Saya", place: "in the yard", problem: "nobody wanted to play together", helper: "a kind grandpa", treasure: "a brand-new friendship" },
  hero: { hero: "brave Erlan", heroTrait: "strong", friend: "a horse named Wind", place: "on the wide steppe", problem: "the river stopped flowing", helper: "an old sage", treasure: "clean water for the village" },
  nature: { hero: "Maya", heroTrait: "caring", friend: "a butterfly named Luna", place: "in an old garden", problem: "her favorite tree had dried up", helper: "Ilyas the gardener", treasure: "the first green leaf" },
  space: { hero: "Nolan", heroTrait: "dreamy", friend: "a robot named Pik", place: "on a tiny planet", problem: "one star had gone missing", helper: "a rocket captain", treasure: "a map of the night sky" },
  sea: { hero: "Sparkle the fish", heroTrait: "quick", friend: "Tish the turtle", place: "at the bottom of the blue sea", problem: "the seaweed was all tangled", helper: "an old crab", treasure: "a shining pearl" },
  school: { hero: "Amina", heroTrait: "attentive", friend: "her deskmate Arman", place: "in the classroom", problem: "the class notebook disappeared", helper: "Miss Gulnara", treasure: "her first top mark" },
  sport: { hero: "Eric", heroTrait: "determined", friend: "Coach Marat", place: "at the stadium", problem: "he could not score a goal", helper: "his big brother", treasure: "a gold medal" },
  food: { hero: "little cook Aru", heroTrait: "hardworking", friend: "a cat named Muffin", place: "in a warm kitchen", problem: "the dough ran away", helper: "grandma", treasure: "the tastiest pie of all" },
  mystery: { hero: "Sanjar", heroTrait: "observant", friend: "his friend Dana", place: "in an old house", problem: "something rustled every night", helper: "the neighbor's cat", treasure: "a solved mystery" },
  family: { hero: "Alua", heroTrait: "gentle", friend: "her little brother Anuar", place: "at home", problem: "everyone forgot the holiday", helper: "mom", treasure: "the warmest evening" },
};

const VOCAB = { ru: RU, kk: KK, en: EN };

// ───────────────────── Scene templates ─────────────────────

const SCENES = {
  ru: (c: Cast) => {
    const m = c.gender === "m";
    const g = (male: string, female: string) => (m ? male : female);
    const H = cap(c.hero);            // capitalised for sentence starts
    const pron = g("он", "она");
    return [
      `${g("Жил-был", "Жила-была")} ${c.heroTrait} ${c.hero}. Больше всего на свете ${c.hero} ${g("любил", "любила")} своих друзей. Каждое утро ${pron} ${g("просыпался", "просыпалась")} с улыбкой и ${g("гулял", "гуляла")} ${c.place}.`,
      `Однажды случилась беда: ${c.problem}. Все вокруг растерялись и не знали, что делать. Но ${c.hero} ${g("сказал", "сказала")}: «Я обязательно помогу!»`,
      `Рядом всегда был верный друг — ${c.friend}. Вместе они отправились в путь. Дорога была длинной, но вдвоём было совсем не страшно.`,
      `По пути им встретился ${c.helper}. «Не спешите, — сказал он. — Сначала подумайте, а потом делайте.» Друзья прислушались к доброму совету.`,
      `Они думали, пробовали и не сдавались. И вот наконец всё получилось! ${H} и ${c.friend} обрадовались и захлопали в ладоши.`,
      `С того дня у них появилось самое главное — ${c.treasure}. И теперь каждый в округе знает: если помогать друг другу, получится всё на свете.`,
    ];
  },
  kk: (c: Cast) => [
    `Ерте, ерте, ертеде ${c.heroTrait} ${c.hero} өмір сүріпті. ${c.hero} достарын бәрінен де жақсы көретін. Күн сайын таңертең ол ${c.place} жүгіріп баратын.`,
    `Бір күні бақытсыздық болды: ${c.problem}. Бәрі не істерін білмей абдырап қалды. Ал ${c.hero}: «Мен міндетті түрде көмектесемін!» — деді.`,
    `${cap(c.hero)} өзімен бірге ${c.friend} шақырды. Екеуі бірге жолға шықты. Жол ұзақ болды, бірақ бірге жүргенде мүлдем қорықпадық.`,
    `Жолда оларға ${c.helper} кездесті. «Асықпаңдар, — деді ол. — Алдымен ойланыңдар, содан кейін істеңдер.» Достар жақсы кеңеске құлақ асты.`,
    `Олар ойланды, тырысты және берілмеді. Ақыры бәрі жақсы болды! ${cap(c.hero)} мен ${c.friend} қуанып, қол шапалақтады.`,
    `Сол күннен бастап оларда ең маңыздысы пайда болды — ${c.treasure}. Енді айналадағылардың бәрі біледі: бір-біріне көмектессең, бәрі де болады.`,
  ],
  en: (c: Cast) => [
    `Once upon a time there was a ${c.heroTrait} friend named ${c.hero}. More than anything, ${c.hero} loved being with friends. Every morning she woke up smiling and ran ${c.place}.`,
    `One day something went wrong: ${c.problem}. Everyone was worried and no one knew what to do. But ${c.hero} said, "I will help. I know we can fix this."`,
    `${cap(c.hero)} called for ${c.friend}. Together they set off down the path. The road was long, but with a friend beside her it was not scary at all.`,
    `Along the way they met ${c.helper}. "Do not rush," he said. "First think, then do." The two friends listened carefully to the kind advice.`,
    `They thought, they tried, and they did not give up. And at last it worked! ${cap(c.hero)} and ${c.friend} cheered and clapped their hands.`,
    `From that day on they had the most important thing of all — ${c.treasure}. And now everyone knows: when friends help each other, anything is possible.`,
  ],
};

// ───────────────────── Topic detection ─────────────────────

const TOPIC_HINTS: Record<TopicKey, string[]> = {
  animals: ["животн", "звер", "лес", "жануар", "аң", "animal", "forest", "creature", "лис", "заяц", "кот", "собак"],
  magic: ["волшеб", "сказ", "маг", "дракон", "сиқыр", "ертег", "magic", "fairy", "dragon", "wizard"],
  adventure: ["приключ", "путешеств", "оқиға", "саяхат", "adventure", "travel", "journey", "гор", "карт"],
  funny: ["смешн", "весел", "весёл", "хитрост", "күлкі", "қулық", "funny", "silly", "joke", "laugh"],
  friendship: ["дружб", "друз", "помощ", "достық", "көмек", "friend", "help", "together"],
  hero: ["герой", "батыр", "смелост", "ерлік", "hero", "brave", "courage", "knight"],
  nature: ["природ", "сад", "цвет", "дерев", "табиғат", "бақ", "nature", "garden", "tree", "flower"],
  space: ["космос", "звезд", "звёзд", "планет", "ракет", "ғарыш", "жұлдыз", "space", "star", "planet", "rocket"],
  sea: ["мор", "океан", "рыб", "вод", "теңіз", "балық", "sea", "ocean", "fish", "water"],
  school: ["школ", "класс", "учит", "урок", "мектеп", "сынып", "school", "class", "teacher", "lesson"],
  sport: ["спорт", "футбол", "бег", "игр", "доп", "sport", "football", "soccer", "run", "game", "medal"],
  food: ["еда", "готов", "торт", "пирог", "кухн", "тағам", "ас", "food", "cook", "cake", "kitchen", "bake"],
  mystery: ["тайн", "загадк", "детект", "құпия", "жұмбақ", "mystery", "secret", "detective", "puzzle"],
  family: ["сем", "мам", "пап", "брат", "сестр", "отбасы", "ана", "family", "mom", "dad", "brother", "sister"],
};

function detectTopic(text: string): TopicKey {
  const t = text.toLocaleLowerCase();
  let best: TopicKey = "friendship";
  let bestScore = 0;
  for (const [key, hints] of Object.entries(TOPIC_HINTS) as [TopicKey, string[]][]) {
    const score = hints.reduce((n, h) => (t.includes(h) ? n + 1 : n), 0);
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}

// ───────────────────────── Generate ─────────────────────────

const TITLE_TPL = {
  ru: (c: Cast) => `${cap(c.hero)} и ${c.treasure}`,
  kk: (c: Cast) => `${cap(c.hero)} және ${c.treasure}`,
  en: (c: Cast) => `${cap(c.hero)} and ${c.treasure}`,
};

/**
 * Builds an original story from the child's topics.
 * `age` controls how many scenes are kept (younger → shorter).
 */
export function generateStoryOffline(
  topicsText: string,
  language: Language,
  age: number,
): { title: string; pages: string[] } {
  const topic = detectTopic(topicsText);
  const vocab = VOCAB[language] ?? RU;
  const cast: Cast = { ...vocab.base, ...(vocab[topic] ?? {}) } as Cast;

  // Vary wording run-to-run without needing randomness in the templates.
  const seed = Math.floor(Math.random() * 1000);
  cast.helper = pick(
    [cast.helper, vocab.base.helper, (vocab.nature as Cast)?.helper ?? cast.helper],
    seed,
  );

  const scenes = SCENES[language](cast);
  const sceneCount = age <= 6 ? 4 : age <= 8 ? 5 : 6;
  const pages = scenes.slice(0, sceneCount);

  return { title: TITLE_TPL[language](cast), pages };
}
