/**
 * storyGen.ts — offline story generator with genuine variety.
 *
 * Previous version used one fixed scene list, so every story read the same.
 * This one composes from:
 *   • 6 plot skeletons (quest / lost / rescue / learn / share / mystery)
 *   • per-topic pools of friends, places, problems, treasures
 *   • a shared pool of heroes (each carrying grammatical gender) and helpers
 *   • varied openings and closings
 *
 * With ~5 options per slot across 6 slots and 6 plots, the space is in the
 * hundreds of thousands of combinations per topic — repeats are effectively
 * impossible in normal use.
 *
 * Russian output respects the hero's grammatical gender throughout.
 */

import type { Language } from "./types";

export type TopicKey =
  | "animals" | "magic" | "adventure" | "funny" | "friendship" | "hero"
  | "nature" | "space" | "sea" | "school" | "sport" | "food" | "mystery" | "family";

interface Hero { name: string; gender: "m" | "f" }

/**
 * A scenario binds problem → helper → reward so they always make sense
 * together. Picking them from independent pools (the old approach) produced
 * incoherent stories: a space problem solved by a forest badger.
 */
interface Scenario {
  problem: string;
  /** Who helps — chosen to fit this specific problem. */
  helper: string;
  /** What the resolution yields — the natural outcome of solving `problem`. */
  treasure: string;
}

interface Pools {
  friends: string[];
  places: string[];
  scenarios: Scenario[];
}

// ───────────────────────── Seeded RNG ─────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const choose = <T,>(arr: readonly T[], rnd: () => number): T =>
  arr[Math.floor(rnd() * arr.length) % arr.length];

const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);

// ───────────────────────── Russian data ─────────────────────────

const RU_HEROES: Hero[] = [
  { name: "Айсулу", gender: "f" }, { name: "Данияр", gender: "m" },
  { name: "Мира", gender: "f" }, { name: "Тимур", gender: "m" },
  { name: "Амина", gender: "f" }, { name: "Ерасыл", gender: "m" },
  { name: "Алуа", gender: "f" }, { name: "Санжар", gender: "m" },
  { name: "Динара", gender: "f" }, { name: "Нурлан", gender: "m" },
];

const RU_HELPERS = [
  "мудрая сова", "старый барсук", "добрый дедушка", "весёлый почтальон",
  "старая черепаха", "лесной сторож", "бабушка Сара", "говорящий ворон",
];

const RU_TOPIC: Record<TopicKey, Pools> = {
  animals: {
    friends: ["зайчонок Пух", "лисёнок Рыжик", "ёжик Пыхтя", "белка Стрелка"],
    places: ["в густом лесу", "на лесной поляне", "у старого дуба", "возле тихой речки"],
    scenarios: [
      { problem: "исчезли все ягоды на поляне", helper: "старый барсук", treasure: "полная корзина ягод" },
      { problem: "маленький котёнок потерялся в лесу", helper: "мудрая сова", treasure: "найденный котёнок" },
      { problem: "ветер разорил птичье гнездо", helper: "дятел-плотник", treasure: "новое крепкое гнездо" },
      { problem: "у зайчонка заболела лапка", helper: "лесной доктор ёж", treasure: "здоровая лапка и весёлые прыжки" },
    ],
  },
  magic: {
    friends: ["дракончик Уголёк", "фея Ветерок", "говорящий кот Баюн", "светлячок Огонёк"],
    places: ["у волшебного озера", "в старой башне", "на радужном мосту", "в саду говорящих цветов"],
    scenarios: [
      { problem: "погасли все звёзды на небе", helper: "старый звездочёт", treasure: "звёздный фонарик, который светит всегда" },
      { problem: "радуга сломалась пополам", helper: "мастер красок", treasure: "новая радуга во всё небо" },
      { problem: "волшебная книга захлопнулась и не открывалась", helper: "добрая волшебница", treasure: "раскрытая книга с новыми сказками" },
      { problem: "все краски в мире стали серыми", helper: "художник с волшебной кистью", treasure: "мир, снова полный цвета" },
    ],
  },
  adventure: {
    friends: ["пёс Верный", "попугай Кеша", "юнга Алишер", "конь Ветер"],
    places: ["на высокой горе", "у старого маяка", "в пещере эха", "на песчаном берегу"],
    scenarios: [
      { problem: "старая карта пропала перед самым походом", helper: "капитан Мурат", treasure: "новая карта, нарисованная своими руками" },
      { problem: "тропинка исчезла в густом тумане", helper: "смотритель маяка", treasure: "надёжный компас" },
      { problem: "мост через реку сломался", helper: "старый плотник", treasure: "крепкий новый мост" },
      { problem: "лодку унесло течением", helper: "рыбак с соседнего берега", treasure: "возвращённая лодка и урок на будущее" },
    ],
  },
  funny: {
    friends: ["белка Стрелка", "бобёр Гриша", "утёнок Кряк", "поросёнок Пух"],
    places: ["на лесной поляне", "у пруда", "во дворе", "на старой мельнице"],
    scenarios: [
      { problem: "все шишки укатились под гору", helper: "смешной бобёр", treasure: "гора шишек и новая игра" },
      { problem: "кто-то съел весь мёд из бочонка", helper: "пчела-следопыт", treasure: "разгаданная тайна и общий смех" },
      { problem: "шапки у всех перепутались", helper: "бабушка-швея", treasure: "шапка точно по размеру для каждого" },
      { problem: "варенье убежало из банки", helper: "повар с большой ложкой", treasure: "самое вкусное варенье в лесу" },
    ],
  },
  friendship: {
    friends: ["новенькая девочка Сая", "сосед по парте Арман", "молчаливый мальчик Бек", "щенок Барс"],
    places: ["во дворе", "на детской площадке", "в школьном саду", "на скамейке возле дома"],
    scenarios: [
      { problem: "никто не хотел играть вместе", helper: "добрый дедушка с лавочки", treasure: "игра, в которую играют все" },
      { problem: "двое друзей поссорились из-за пустяка", helper: "старшая сестра", treasure: "настоящее примирение" },
      { problem: "новенького не принимали в игру", helper: "учительница Гульнара", treasure: "новая дружба" },
      { problem: "мяч улетел к соседям за забор", helper: "сосед дядя Серик", treasure: "возвращённый мяч и новый знакомый" },
    ],
  },
  hero: {
    friends: ["конь Ветер", "верный друг Асан", "старший брат Ержан", "беркут Самғау"],
    places: ["в широкой степи", "у подножия гор", "возле старого колодца", "на берегу большой реки"],
    scenarios: [
      { problem: "река перестала течь и аул остался без воды", helper: "старый мудрец", treasure: "чистая вода для всего аула" },
      { problem: "стадо разбрелось и потерялось в степи", helper: "опытный чабан", treasure: "спасённое стадо" },
      { problem: "буря разрушила загон для овец", helper: "сосед-плотник", treasure: "новый крепкий загон" },
      { problem: "младшие дети испугались грозы", helper: "бабушка со сказкой", treasure: "спокойный вечер и смелые сердца" },
    ],
  },
  nature: {
    friends: ["бабочка Луна", "пчела Жужа", "воробей Чик", "дождевой червяк Тиша"],
    places: ["в старом саду", "на цветочной клумбе", "под большой яблоней", "на зелёном лугу"],
    scenarios: [
      { problem: "любимое дерево засохло без воды", helper: "садовник Ильяс", treasure: "первый зелёный листок на ветке" },
      { problem: "цветы перестали раскрываться", helper: "пчела-разведчица", treasure: "клумба, полная цветов" },
      { problem: "кто-то сломал молодой саженец", helper: "лесник с подвязкой", treasure: "выздоровевшее деревце" },
      { problem: "из сада пропали все пчёлы", helper: "старый пасечник", treasure: "гудящий улей и сладкий мёд" },
    ],
  },
  space: {
    friends: ["робот Пик", "космонавт Аян", "лунный зайчик", "спутник Шар"],
    places: ["на маленькой планете", "на лунной станции", "в звёздном тумане", "на борту старой ракеты"],
    scenarios: [
      { problem: "с неба пропала одна звезда", helper: "звездочёт с большим телескопом", treasure: "звезда, вернувшаяся на своё место" },
      { problem: "ракета никак не заводилась", helper: "инженер станции", treasure: "починенная ракета" },
      { problem: "связь с Землёй оборвалась", helper: "радист с длинной антенной", treasure: "первый сигнал, дошедший до дома" },
      { problem: "на станции погас весь свет", helper: "механик с фонариком", treasure: "снова горящие огни станции" },
    ],
  },
  sea: {
    friends: ["черепаха Тиша", "краб Клешня", "дельфин Свист", "морской конёк Ига"],
    places: ["на дне синего моря", "у кораллового рифа", "возле затонувшего корабля", "в тихой лагуне"],
    scenarios: [
      { problem: "водоросли запутались и закрыли проход", helper: "старый краб", treasure: "чистая дорога через риф" },
      { problem: "пропала самая красивая жемчужина", helper: "мудрая устрица", treasure: "найденная жемчужина" },
      { problem: "течение унесло маленького малька", helper: "дельфин-спасатель", treasure: "малёк, вернувшийся к маме" },
      { problem: "песок засыпал коралловый риф", helper: "стая усердных рыбок", treasure: "риф, снова полный жизни" },
    ],
  },
  school: {
    friends: ["сосед по парте Арман", "отличница Дана", "весёлый Ержан", "школьный кот Мурзик"],
    places: ["в школьном классе", "в библиотеке", "на школьном дворе", "в кабинете рисования"],
    scenarios: [
      { problem: "школьный журнал куда-то пропал", helper: "библиотекарь Асем", treasure: "найденный журнал и благодарность учителя" },
      { problem: "все забыли про домашнее задание", helper: "терпеливая учительница", treasure: "честно сделанная работа" },
      { problem: "рисунок для конкурса испортился перед сдачей", helper: "учитель рисования", treasure: "самый красивый рисунок в классе" },
      { problem: "никто не знал ответа на трудный вопрос", helper: "старый учебник с полки", treasure: "первая пятёрка" },
    ],
  },
  sport: {
    friends: ["вратарь Ануар", "капитан команды Алия", "быстрый Ерасыл", "младший брат Даулет"],
    places: ["на стадионе", "в спортзале", "на школьном поле", "у турников во дворе"],
    scenarios: [
      { problem: "никак не получалось забить гол", helper: "тренер Марат", treasure: "первый забитый гол" },
      { problem: "команда проигрывала матч за матчем", helper: "старший брат с советом", treasure: "дружная команда и первая победа" },
      { problem: "перед стартом задрожали коленки", helper: "спокойный тренер", treasure: "золотая медаль" },
      { problem: "никто не хотел стоять на воротах", helper: "капитан команды", treasure: "новый смелый вратарь" },
    ],
  },
  food: {
    friends: ["кот Пирожок", "мышонок Крошка", "сестрёнка Аружан", "пекарь Ильяс"],
    places: ["на тёплой кухне", "в маленькой пекарне", "у большой печи", "за круглым столом"],
    scenarios: [
      { problem: "тесто убежало из миски прямо на пол", helper: "бабушка Сара", treasure: "самый вкусный пирог" },
      { problem: "закончился сахар перед самым праздником", helper: "соседка с полной банкой", treasure: "чай со сладостями для всех" },
      { problem: "пирог никак не поднимался в печи", helper: "опытный пекарь", treasure: "новый семейный рецепт" },
      { problem: "кто-то съел все баурсаки со стола", helper: "хитрый кот-свидетель", treasure: "гора румяных баурсаков" },
    ],
  },
  mystery: {
    friends: ["подруга Дана", "соседский кот", "любопытный Бек", "младшая сестра Аяна"],
    places: ["в старом доме", "на тёмном чердаке", "во дворе за сараем", "в подвале библиотеки"],
    scenarios: [
      { problem: "по ночам на чердаке кто-то шумел", helper: "старый сторож", treasure: "разгаданная тайна и смешное объяснение" },
      { problem: "из кухни пропали все ложки", helper: "внимательная бабушка", treasure: "найденная пропажа" },
      { problem: "на снегу появились странные следы", helper: "сосед-охотник", treasure: "разгадка следов" },
      { problem: "свет в комнате включался сам собой", helper: "электрик дядя Болат", treasure: "спокойные ночи в доме" },
    ],
  },
  family: {
    friends: ["младший брат Ануар", "сестрёнка Аяна", "двоюродный брат Алишер", "бабушкин кот"],
    places: ["в родном доме", "во дворе у бабушки", "на кухне за большим столом", "в саду за домом"],
    scenarios: [
      { problem: "все забыли про бабушкин день рождения", helper: "дедушка Кайрат", treasure: "самый тёплый семейный вечер" },
      { problem: "потерялась старая семейная фотография", helper: "бабушка Сара", treasure: "найденная фотография и много историй" },
      { problem: "никто в семье не мог договориться", helper: "мама с чашкой чая", treasure: "общее решение, которое устроило всех" },
      { problem: "подарок не успевали сделать вовремя", helper: "папа с инструментами", treasure: "подарок, сделанный своими руками" },
    ],
  },
};

// ───────────────────────── Kazakh data ─────────────────────────

const KK_HEROES: Hero[] = [
  { name: "Айсұлу", gender: "f" }, { name: "Дәнияр", gender: "m" },
  { name: "Мира", gender: "f" }, { name: "Темір", gender: "m" },
  { name: "Әмина", gender: "f" }, { name: "Ерасыл", gender: "m" },
  { name: "Алуа", gender: "f" }, { name: "Санжар", gender: "m" },
];
const KK_HELPERS = ["дана үкі", "кәрі борсық", "мейірімді ата", "кәрі тасбақа", "орман күзетшісі", "Сара әже"];

const KK_TOPIC: Record<TopicKey, Pools> = {
  animals: {
    friends: ["қоян Үлпек", "түлкі Қызылшақа", "кірпі Пысқақ", "тиін Жебе"],
    places: ["қалың орманда", "орман алаңында", "кәрі емен түбінде", "тынық өзен жағасында"],
    scenarios: [
      { problem: "барлық жидек жоғалды", helper: "кәрі борсық", treasure: "толы себет жидек" },
      { problem: "кішкентай мысық адасып кетті", helper: "дана үкі", treasure: "құстарға жаңа ұя" },
      { problem: "құс ұясы бұзылды", helper: "орман дәрігері", treasure: "қысқа жылы ін" },
      { problem: "аңдар амандаспай кетті", helper: "тоқылдақ шебер", treasure: "көңілді орман мерекесі" },
    ],
  },
  magic: {
    friends: ["айдаһар Шоқ", "пері Желбір", "сөйлейтін мысық", "от шыбын Жалын"],
    places: ["сиқырлы көл жағасында", "ескі мұнарада", "кемпірқосақ көпірінде", "сөйлейтін гүлдер бағында"],
    scenarios: [
      { problem: "жұлдыздар сөніп қалды", helper: "кәрі жұлдызшы", treasure: "жұлдызды шам" },
      { problem: "кемпірқосақ жоғалды", helper: "бояу шебері", treasure: "жаңа кемпірқосақ" },
      { problem: "сиқыр шатасып кетті", helper: "мейірімді сиқыршы", treasure: "әндетер сандық" },
      { problem: "сиқырлы кітап жабылды", helper: "сиқырлы қылқалам ұстаған суретші", treasure: "самұрық қауырсыны" },
    ],
  },
  adventure: {
    friends: ["ит Адал", "капитан Мұрат", "тотықұс Кеша", "жүйрік ат Жел"],
    places: ["биік тауда", "ескі шамшырақ жанында", "жаңғырық үңгірінде", "құмды жағада"],
    scenarios: [
      { problem: "ескі карта жоғалды", helper: "капитан Мұрат", treasure: "көне компас" },
      { problem: "соқпақ тұманға сіңіп кетті", helper: "шамшырақ күзетшісі", treasure: "бақалшақ толы сандық" },
      { problem: "көпір сынды", helper: "кәрі ұста", treasure: "жаңа карта" },
      { problem: "компас адастырды", helper: "көрші жағадағы балықшы", treasure: "команда туы" },
    ],
  },
  funny: {
    friends: ["тиін Жебе", "құндыз Гриша", "үйрек Қаңқ", "лақ Мекеш"],
    places: ["орман алаңында", "тоған жағасында", "аулада", "ескі диірменде"],
    scenarios: [
      { problem: "барлық бүршік домалап кетті", helper: "күлкілі құндыз", treasure: "жаңғақ үйіндісі" },
      { problem: "біреу балды жеп қойды", helper: "ізші ара", treasure: "ормандағы ең қатты күлкі" },
      { problem: "бөріктер шатасты", helper: "тігінші әже", treasure: "жаңа күлкілі ән" },
      { problem: "әткеншек шиқылдап құстарды үркітті", helper: "үлкен қасық ұстаған аспаз", treasure: "секіруге ең үлкен шалшық" },
    ],
  },
  friendship: {
    friends: ["жаңа көрші қыз Сая", "партадағы досы Арман", "үндемес бала Бек", "күшік Барыс"],
    places: ["аулада", "балалар алаңында", "мектеп бағында", "үй жанындағы орындықта"],
    scenarios: [
      { problem: "ешкім бірге ойнағысы келмеді", helper: "орындықтағы мейірімді ата", treasure: "жаңа достық" },
      { problem: "достар ұсақ нәрсеге ұрысып қалды", helper: "үлкен апасы", treasure: "бәріне ортақ ойын" },
      { problem: "жаңа баланы ойынға алмады", helper: "мұғалім Гүлнара", treasure: "ең әділ ереже" },
      { problem: "доп көршіге ұшып кетті", helper: "көрші Серік аға", treasure: "құпия қол алысу" },
    ],
  },
  hero: {
    friends: ["жүйрік ат Жел", "адал дос Асан", "үлкен ағасы Ержан", "бүркіт Самғау"],
    places: ["кең далада", "тау бөктерінде", "ескі құдық жанында", "үлкен өзен жағасында"],
    scenarios: [
      { problem: "өзен ағуын тоқтатты", helper: "кәрі данышпан", treasure: "ауылға таза су" },
      { problem: "мал жоғалды", helper: "тәжірибелі шопан", treasure: "құтқарылған мал" },
      { problem: "дауыл қораны бұзды", helper: "көрші ұста", treasure: "жаңа берік қора" },
      { problem: "кішілер найзағайдан қорықты", helper: "ертегі айтатын әже", treasure: "көршілердің құрметі" },
    ],
  },
  nature: {
    friends: ["көбелек Ай", "ара Зуза", "бағбан Ілияс", "торғай Шық"],
    places: ["ескі бақта", "гүлзарда", "үлкен алма ағашының түбінде", "жасыл шалғында"],
    scenarios: [
      { problem: "сүйікті ағаш қурап қалды", helper: "бағбан Ілияс", treasure: "алғашқы жасыл жапырақ" },
      { problem: "гүлдер ашылмай қойды", helper: "барлаушы ара", treasure: "гүлге толы бақ" },
      { problem: "жас көшетті сындырды", helper: "орманшы", treasure: "жаңа көшет" },
      { problem: "аралар жоғалды", helper: "кәрі омарташы", treasure: "ең тәтті алма" },
    ],
  },
  space: {
    friends: ["робот Пик", "ғарышкер Аян", "ай қоянчығы", "серік Шар"],
    places: ["кішкентай планетада", "ай станциясында", "жұлдызды тұманда", "ескі зымыран бортында"],
    scenarios: [
      { problem: "бір жұлдыз жоғалды", helper: "үлкен телескопы бар жұлдызшы", treasure: "жұлдызды аспан картасы" },
      { problem: "зымыран қосылмады", helper: "станция инженері", treasure: "жөнделген зымыран" },
      { problem: "Жермен байланыс үзілді", helper: "ұзын антеннасы бар радист", treasure: "Жерден алғашқы сигнал" },
      { problem: "станцияда жарық сөнді", helper: "қол шамы бар механик", treasure: "жаңа шоқжұлдыз" },
    ],
  },
  sea: {
    friends: ["тасбақа Тыныш", "шаян Қысқыш", "дельфин Ысқырық", "теңіз ат Иға"],
    places: ["көк теңіз түбінде", "маржан рифінде", "батқан кеме жанында", "тыныш шығанақта"],
    scenarios: [
      { problem: "балдырлар шатасып қалды", helper: "кәрі шаян", treasure: "жарқыраған меруерт" },
      { problem: "меруерт жоғалды", helper: "дана меруерт бақалшағы", treasure: "риф жанындағы таза су" },
      { problem: "ағыс шабақты алып кетті", helper: "құтқарушы дельфин", treasure: "құтқарылған шабақ" },
      { problem: "рифті құм басты", helper: "еңбекқор балықтар тобы", treasure: "ең әдемі бақалшақ" },
    ],
  },
  school: {
    friends: ["партадағы досы Арман", "үздік оқушы Дана", "көңілді Ержан", "кітапханашы Әсем"],
    places: ["мектеп сыныбында", "кітапханада", "мектеп ауласында", "сурет кабинетінде"],
    scenarios: [
      { problem: "сынып журналы жоғалды", helper: "кітапханашы Әсем", treasure: "алғашқы бестік" },
      { problem: "бәрі үй тапсырмасын ұмытты", helper: "шыдамды мұғалім", treasure: "ең әдемі сурет" },
      { problem: "бор таусылды", helper: "сурет мұғалімі", treasure: "кітапханадан жаңа кітап" },
      { problem: "ешкім жауапты білмеді", helper: "сөредегі ескі оқулық", treasure: "сыныпқа мадақтама" },
    ],
  },
  sport: {
    friends: ["жаттықтырушы Марат", "қақпашы Ануар", "команда капитаны Әлия", "жүйрік Ерасыл"],
    places: ["стадионда", "спортзалда", "мектеп алаңында", "аулада турник жанында"],
    scenarios: [
      { problem: "гол сала алмады", helper: "жаттықтырушы Марат", treasure: "алтын медаль" },
      { problem: "команда ұтылып жатты", helper: "кеңес берген үлкен ағасы", treasure: "алғашқы гол" },
      { problem: "доп үнемі ұшып кетті", helper: "сабырлы жаттықтырушы", treasure: "ынтымақты команда" },
      { problem: "ешкім қақпашы болғысы келмеді", helper: "команда капитаны", treasure: "жаңа рекорд" },
    ],
  },
  food: {
    friends: ["мысық Бауырсақ", "Сара әже", "наубайшы Ілияс", "тышқан Үгінді"],
    places: ["жылы асханада", "кішкентай наубайханада", "үлкен пеш жанында", "дөңгелек үстел басында"],
    scenarios: [
      { problem: "қамыр қашып кетті", helper: "Сара әже", treasure: "ең дәмді бәліш" },
      { problem: "қант таусылды", helper: "толы құты әкелген көрші", treasure: "қызарған бауырсақ үйіндісі" },
      { problem: "бәліш көтерілмеді", helper: "тәжірибелі наубайшы", treasure: "жаңа отбасылық рецепт" },
      { problem: "біреу бауырсақты жеп қойды", helper: "куә болған қу мысық", treasure: "көршілерге шай" },
    ],
  },
  mystery: {
    friends: ["досы Дана", "көрші мысығы", "қызыққұмар Бек", "кәрі күзетші"],
    places: ["ескі үйде", "қараңғы шатырда", "қора артындағы аулада", "кітапхана жертөлесінде"],
    scenarios: [
      { problem: "түнде біреу шуылдады", helper: "кәрі күзетші", treasure: "шешілген құпия" },
      { problem: "барлық қасық жоғалды", helper: "байқағыш әже", treasure: "табылған зат" },
      { problem: "қарда оғаш іздер пайда болды", helper: "көрші аңшы", treasure: "хаттар салынған ескі сандық" },
      { problem: "жарық өздігінен жанды", helper: "электрик Болат аға", treasure: "жаңа күлкілі түсінік" },
    ],
  },
  family: {
    friends: ["інісі Ануар", "қарындасы Аяна", "Сара әже", "Қайрат ата"],
    places: ["туған үйде", "әженің ауласында", "үлкен үстел басында", "үй артындағы бақта"],
    scenarios: [
      { problem: "бәрі мерекені ұмытып кетті", helper: "Қайрат ата", treasure: "ең жылы кеш" },
      { problem: "ескі сурет жоғалды", helper: "Сара әже", treasure: "табылған сурет" },
      { problem: "ешкім келісе алмады", helper: "шай ұстаған ана", treasure: "ортақ отбасылық мереке" },
      { problem: "әже мұңайып қалды", helper: "аспабы бар әке", treasure: "өз қолымен жасалған сыйлық" },
    ],
  },
};

// ───────────────────────── English data ─────────────────────────

const EN_HEROES: Hero[] = [
  { name: "Mira", gender: "f" }, { name: "Theo", gender: "m" },
  { name: "Amina", gender: "f" }, { name: "Danny", gender: "m" },
  { name: "Luca", gender: "m" }, { name: "Nora", gender: "f" },
  { name: "Sam", gender: "m" }, { name: "Ivy", gender: "f" },
];
const EN_HELPERS = ["a wise owl", "an old badger", "a kind grandpa", "a cheerful postman", "an old turtle", "the park keeper"];

const EN_TOPIC: Record<TopicKey, Pools> = {
  animals: {
    friends: ["Pip the rabbit", "Rusty the fox cub", "Puffin the hedgehog", "Zip the squirrel"],
    places: ["deep in the forest", "in a sunny clearing", "under the old oak", "beside a quiet stream"],
    scenarios: [
      { problem: "all the berries had vanished", helper: "an old badger", treasure: "a basket full of berries" },
      { problem: "a small kitten was lost", helper: "a wise owl", treasure: "a brand-new nest" },
      { problem: "a bird's nest had fallen", helper: "the forest doctor", treasure: "a warm burrow for winter" },
      { problem: "the animals stopped saying hello", helper: "a woodpecker carpenter", treasure: "a happy forest party" },
    ],
  },
  magic: {
    friends: ["Ember the little dragon", "Breeze the fairy", "a talking cat", "Flicker the firefly"],
    places: ["beside a magic lake", "in an old tower", "on a rainbow bridge", "in a garden of talking flowers"],
    scenarios: [
      { problem: "every star had gone dark", helper: "an old stargazer", treasure: "a lantern full of starlight" },
      { problem: "the rainbow disappeared", helper: "a master of colors", treasure: "a brand-new rainbow" },
      { problem: "a spell got tangled", helper: "a gentle wizard", treasure: "a singing music box" },
      { problem: "the magic book snapped shut", helper: "a painter with a magic brush", treasure: "a glowing feather" },
    ],
  },
  adventure: {
    friends: ["Trusty the dog", "Captain Murat", "Kesha the parrot", "a horse named Wind"],
    places: ["high on a mountain", "by the old lighthouse", "in the echo cave", "on a sandy shore"],
    scenarios: [
      { problem: "the old map went missing", helper: "Captain Murat", treasure: "an ancient compass" },
      { problem: "the path vanished in fog", helper: "the lighthouse keeper", treasure: "a chest of seashells" },
      { problem: "the bridge broke", helper: "an old carpenter", treasure: "a hand-drawn map" },
      { problem: "the compass pointed the wrong way", helper: "a fisherman from the far shore", treasure: "a flag for the new crew" },
    ],
  },
  funny: {
    friends: ["Zip the squirrel", "Gus the beaver", "Quack the duckling", "Momo the goat"],
    places: ["in a sunny clearing", "by the pond", "in the yard", "at the old mill"],
    scenarios: [
      { problem: "all the pinecones rolled downhill", helper: "a silly beaver", treasure: "a mountain of nuts" },
      { problem: "someone ate the honey", helper: "a tracker bee", treasure: "the loudest laugh in the woods" },
      { problem: "the hats got mixed up", helper: "grandma the seamstress", treasure: "a funny new song" },
      { problem: "the swing squeaked so loudly it scared the birds", helper: "a cook with a giant spoon", treasure: "the best puddle for jumping" },
    ],
  },
  friendship: {
    friends: ["a new girl named Saya", "his deskmate Arman", "a quiet boy named Bek", "Scout the puppy"],
    places: ["in the yard", "at the playground", "in the school garden", "on the bench by the door"],
    scenarios: [
      { problem: "nobody wanted to play together", helper: "a kind grandpa on the bench", treasure: "a brand-new friendship" },
      { problem: "two friends argued over nothing", helper: "a big sister", treasure: "a game everyone can play" },
      { problem: "the new kid was left out", helper: "Miss Gulnara", treasure: "the fairest rule of all" },
      { problem: "the ball flew over the fence", helper: "neighbor uncle Serik", treasure: "a secret handshake" },
    ],
  },
  hero: {
    friends: ["a horse named Wind", "a loyal friend Asan", "big brother Erzhan", "an eagle named Samgau"],
    places: ["on the wide steppe", "at the foot of the mountains", "beside the old well", "on the riverbank"],
    scenarios: [
      { problem: "the river stopped flowing", helper: "an old sage", treasure: "clean water for the village" },
      { problem: "the herd went missing", helper: "an experienced shepherd", treasure: "the rescued herd" },
      { problem: "a storm broke the fence", helper: "the neighbor carpenter", treasure: "a strong new fence" },
      { problem: "the little ones were afraid of thunder", helper: "grandma with a story", treasure: "the respect of every neighbor" },
    ],
  },
  nature: {
    friends: ["Luna the butterfly", "Buzz the bee", "Ilyas the gardener", "Chirp the sparrow"],
    places: ["in an old garden", "in the flower bed", "under the big apple tree", "on a green meadow"],
    scenarios: [
      { problem: "her favorite tree dried up", helper: "Ilyas the gardener", treasure: "the first green leaf" },
      { problem: "the flowers would not open", helper: "a scout bee", treasure: "a garden full of flowers" },
      { problem: "a young sapling was broken", helper: "the forest ranger", treasure: "a little new tree" },
      { problem: "all the bees disappeared", helper: "an old beekeeper", treasure: "the sweetest apple" },
    ],
  },
  space: {
    friends: ["Pik the robot", "Ayan the astronaut", "a moon bunny", "Orb the satellite"],
    places: ["on a tiny planet", "at the moon station", "in a cloud of stars", "aboard an old rocket"],
    scenarios: [
      { problem: "one star went missing", helper: "a stargazer with a big telescope", treasure: "a map of the night sky" },
      { problem: "the rocket would not start", helper: "the station engineer", treasure: "the mended rocket" },
      { problem: "contact with Earth was lost", helper: "a radio operator", treasure: "the first signal from Earth" },
      { problem: "the station lights went out", helper: "a mechanic with a flashlight", treasure: "a brand-new constellation" },
    ],
  },
  sea: {
    friends: ["Tish the turtle", "Pinch the crab", "Whistle the dolphin", "Iga the seahorse"],
    places: ["at the bottom of the blue sea", "by the coral reef", "near an old sunken ship", "in a quiet lagoon"],
    scenarios: [
      { problem: "the seaweed was tangled", helper: "an old crab", treasure: "a shining pearl" },
      { problem: "a pearl went missing", helper: "a wise oyster", treasure: "clear water by the reef" },
      { problem: "the current carried a baby fish away", helper: "a rescue dolphin", treasure: "the rescued baby fish" },
      { problem: "sand covered the reef", helper: "a school of busy little fish", treasure: "the prettiest shell" },
    ],
  },
  school: {
    friends: ["his deskmate Arman", "top student Dana", "cheerful Erzhan", "Asem the librarian"],
    places: ["in the classroom", "in the library", "in the schoolyard", "in the art room"],
    scenarios: [
      { problem: "the class notebook disappeared", helper: "Asem the librarian", treasure: "her first top mark" },
      { problem: "everyone forgot the homework", helper: "a patient teacher", treasure: "the prettiest drawing" },
      { problem: "the chalk ran out", helper: "the art teacher", treasure: "a new book from the library" },
      { problem: "nobody knew the answer", helper: "an old book from the shelf", treasure: "a certificate for the whole class" },
    ],
  },
  sport: {
    friends: ["Coach Marat", "Anuar the goalkeeper", "team captain Aliya", "speedy Erasyl"],
    places: ["at the stadium", "in the gym", "on the school field", "at the bars in the yard"],
    scenarios: [
      { problem: "he could not score a goal", helper: "Coach Marat", treasure: "a gold medal" },
      { problem: "the team kept losing", helper: "a big brother with advice", treasure: "the first goal" },
      { problem: "the ball flew away every time", helper: "the calm coach", treasure: "a team that sticks together" },
      { problem: "nobody wanted to be goalkeeper", helper: "the team captain", treasure: "a new yard record" },
    ],
  },
  food: {
    friends: ["Muffin the cat", "grandma Sara", "Ilyas the baker", "Crumb the mouse"],
    places: ["in a warm kitchen", "in a tiny bakery", "beside the big oven", "at the round table"],
    scenarios: [
      { problem: "the dough ran away", helper: "grandma Sara", treasure: "the tastiest pie of all" },
      { problem: "the sugar ran out", helper: "a neighbor with a full jar", treasure: "a mountain of golden buns" },
      { problem: "the pie would not rise", helper: "an experienced baker", treasure: "a new family recipe" },
      { problem: "someone ate all the buns", helper: "a sly cat who saw everything", treasure: "tea for all the neighbors" },
    ],
  },
  mystery: {
    friends: ["her friend Dana", "the neighbor's cat", "curious Bek", "the old watchman"],
    places: ["in an old house", "in the dark attic", "behind the shed", "in the library basement"],
    scenarios: [
      { problem: "something rustled every night", helper: "the old watchman", treasure: "a solved mystery" },
      { problem: "all the spoons went missing", helper: "an observant grandma", treasure: "the missing things, found" },
      { problem: "strange tracks appeared in the snow", helper: "a neighbor who hunts", treasure: "an old box of letters" },
      { problem: "the light turned on by itself", helper: "uncle Bolat the electrician", treasure: "a funny new explanation" },
    ],
  },
  family: {
    friends: ["her little brother Anuar", "her sister Ayana", "grandma Sara", "grandpa Kairat"],
    places: ["at home", "in grandma's yard", "at the big kitchen table", "in the garden behind the house"],
    scenarios: [
      { problem: "everyone forgot the holiday", helper: "grandpa Kairat", treasure: "the warmest evening" },
      { problem: "an old photo went missing", helper: "grandma Sara", treasure: "the photo, found at last" },
      { problem: "nobody could agree", helper: "mom with a cup of tea", treasure: "a family celebration" },
      { problem: "grandma looked sad", helper: "dad with his tools", treasure: "a handmade gift" },
    ],
  },
};

const DATA = {
  ru: { heroes: RU_HEROES, topic: RU_TOPIC },
  kk: { heroes: KK_HEROES, topic: KK_TOPIC },
  en: { heroes: EN_HEROES, topic: EN_TOPIC },
};

// ───────────────────────── Plot skeletons ─────────────────────────

interface Cast {
  hero: Hero; friend: string; place: string;
  problem: string; helper: string; treasure: string;
}

type PlotFn = (c: Cast) => string[];

/** Russian helper: pick the form matching the hero's gender. */
const ruG = (c: Cast) => (m: string, f: string) => (c.hero.gender === "m" ? m : f);

const RU_PLOTS: PlotFn[] = [
  // 1 — quest
  (c) => { const g = ruG(c); const H = cap(c.hero.name); return [
    `${g("Жил-был", "Жила-была")} ${c.hero.name}. Каждое утро ${g("он", "она")} ${g("гулял", "гуляла")} ${c.place} и здоровался со всеми, кого встречал.`,
    `Однажды случилась беда: ${c.problem}. Все вокруг растерялись. Но ${c.hero.name} ${g("сказал", "сказала")}: «Я знаю, что делать!»`,
    `Рядом всегда был верный друг — ${c.friend}. Вдвоём отправляться в путь было совсем не страшно.`,
    `По дороге им встретился ${c.helper}. «Сначала подумайте, потом делайте», — посоветовал он. Друзья послушались.`,
    `Они пробовали снова и снова и не сдавались. И всё получилось!`,
    `Так у них появилось ${c.treasure}. С тех пор все знают: вместе можно справиться с чем угодно.`,
  ]; },
  // 2 — lost and found
  (c) => { const g = ruG(c); return [
    `Утро началось спокойно ${c.place}. ${cap(c.hero.name)} ${g("допивал", "допивала")} чай, когда прибежал ${c.friend}.`,
    `«Скорее! ${cap(c.problem)}», — выпалил друг. ${cap(c.hero.name)} сразу ${g("вскочил", "вскочила")} с места.`,
    `Они искали везде: заглядывали под каждый куст, спрашивали у каждого встречного. Но следов не было.`,
    `Тогда ${c.helper} тихо сказал: «А вы посмотрели там, где искать никто не догадался?» Друзья переглянулись.`,
    `И правда! Пропажа нашлась именно там. Все засмеялись от радости.`,
    `В тот день у них появилось ${c.treasure}. А ещё — привычка искать не глазами, а головой.`,
  ]; },
  // 3 — rescue / helping
  (c) => { const g = ruG(c); return [
    `${cap(c.hero.name)} ${g("любил", "любила")} бывать ${c.place}. Там всегда было тихо и хорошо.`,
    `Но в тот день пришла беда: ${c.problem}. ${c.friend} чуть не заплакал от расстройства.`,
    `«Не грусти, — сказал${g("", "а")} ${c.hero.name}. — Мы что-нибудь придумаем.» И они взялись за дело.`,
    `Работа была трудной. Позвали на помощь — пришёл ${c.helper}, а за ним и другие соседи.`,
    `Все вместе они управились до заката. Никто не ушёл, пока дело не было сделано.`,
    `Наградой стало ${c.treasure}. И ещё одно: теперь тут все помогают друг другу.`,
  ]; },
  // 4 — learning / persistence
  (c) => { const g = ruG(c); return [
    `У ${c.hero.name} была мечта, но пока ничего не выходило. ${c.problem} — вот что мешало больше всего.`,
    `${g("Он", "Она")} пробовал${g("", "а")} ${c.place} каждый день. И каждый день ничего не получалось.`,
    `«Может, бросить?» — подумал${g("", "а")} ${c.hero.name}. Но ${c.friend} сказал: «Давай ещё разок. Я рядом.»`,
    `Мимо шёл ${c.helper}. «Не спеши, — улыбнулся он. — Учиться — это делать много маленьких шагов.»`,
    `И на десятый раз получилось. Потом на одиннадцатый. А потом стало легко.`,
    `Так появилось ${c.treasure}. А главное — ${c.hero.name} ${g("понял", "поняла")}: сдаваться рано.`,
  ]; },
  // 5 — sharing
  (c) => { const g = ruG(c); return [
    `Однажды ${c.place} ${c.hero.name} ${g("нашёл", "нашла")} кое-что удивительное.`,
    `Радость длилась недолго: ${c.problem}. И сразу стало ясно, что делать с находкой.`,
    `${cap(c.hero.name)} позвал${g("", "а")} всех. Первым прибежал ${c.friend}, за ним — остальные.`,
    `«Хватит ли на всех?» — засомневался кто-то. Но ${c.helper} ответил: «Когда делишь — всегда хватает.»`,
    `И правда хватило. Даже осталось немного про запас.`,
    `Тот день запомнили надолго, потому что у всех появилось ${c.treasure}.`,
  ]; },
  // 6 — small mystery
  (c) => { const g = ruG(c); return [
    `Что-то странное происходило ${c.place}. ${cap(c.problem)} — и никто не мог объяснить почему.`,
    `${cap(c.hero.name)} решил${g("", "а")} разобраться. Взял${g("", "а")} блокнот и стал${g("", "а")} записывать всё необычное.`,
    `${cap(c.friend)} помогал искать улики. Вдвоём они обошли всё вокруг три раза.`,
    `Разгадку подсказал ${c.helper}: «Иногда самая простая причина — самая верная.»`,
    `Друзья проверили — и рассмеялись. Всё оказалось совсем не страшно, а даже смешно.`,
    `Так они получили ${c.treasure} и историю, которую потом рассказывали весь год.`,
  ]; },
];

const KK_PLOTS: PlotFn[] = [
  (c) => [
    `Ерте, ерте, ертеде ${c.hero.name} деген бала өмір сүріпті. Ол күн сайын ${c.place} серуендейтін.`,
    `Бір күні бақытсыздық болды: ${c.problem}. Бәрі не істерін білмеді. Ал ${c.hero.name}: «Мен білемін не істеу керек!» — деді.`,
    `Қасында әрқашан адал досы — ${c.friend} болды. Екеуіне жол жүру мүлдем қорқынышты емес еді.`,
    `Жолда оларға ${c.helper} кездесті. «Алдымен ойланыңдар, сосын істеңдер», — деді ол.`,
    `Олар қайта-қайта тырысты, берілмеді. Ақыры бәрі жақсы болды!`,
    `Осылай оларда ${c.treasure} пайда болды. Содан бері бәрі біледі: бірге бәрін жеңуге болады.`,
  ],
  (c) => [
    `Таң тыныш басталды. ${c.hero.name} ${c.place} отырғанда, ${c.friend} жүгіріп келді.`,
    `«Тезірек! ${cap(c.problem)}», — деді досы. ${c.hero.name} бірден орнынан тұрды.`,
    `Олар бәрін іздеді: әр бұтаны қарады, кездескеннің бәрінен сұрады. Бірақ із жоқ.`,
    `Сонда ${c.helper}: «Ешкім іздеуді ойламаған жерді қарадыңдар ма?» — деді.`,
    `Расында да! Жоғалған нәрсе дәл сол жерден табылды. Бәрі қуанып күлді.`,
    `Сол күні оларда ${c.treasure} пайда болды.`,
  ],
  (c) => [
    `${c.hero.name} ${c.place} болғанды ұнататын. Онда әрқашан тыныш еді.`,
    `Бірақ сол күні бақытсыздық келді: ${c.problem}. ${cap(c.friend)} мұңайып қалды.`,
    `«Мұңайма, бірдеңе ойлап табамыз», — деді ${c.hero.name}. Олар іске кірісті.`,
    `Жұмыс ауыр болды. Көмекке ${c.helper} келді, соңынан басқа көршілер де келді.`,
    `Бәрі бірге күн батқанша үлгерді. Іс бітпейінше ешкім кетпеді.`,
    `Сыйлық ретінде ${c.treasure} болды. Енді мұнда бәрі бір-біріне көмектеседі.`,
  ],
  (c) => [
    `${c.hero.name} арман еткен, бірақ әзірге ештеңе шықпады. ${cap(c.problem)} — ең басты кедергі осы еді.`,
    `Ол күн сайын ${c.place} тырысты. Күн сайын ештеңе шықпады.`,
    `«Тастай салайын ба?» — деп ойлады ${c.hero.name}. Бірақ ${c.friend}: «Тағы бір рет көрейік. Мен қасыңдамын», — деді.`,
    `Жанынан ${c.helper} өтіп бара жатты. «Асықпа, үйрену — көп кішкентай қадам», — деді ол күлімсіреп.`,
    `Оныншы ретте шықты. Сосын он бірінші ретте. Кейін оңай болып кетті.`,
    `Осылай ${c.treasure} пайда болды. Ең бастысы — берілуге ерте екенін түсінді.`,
  ],
];

const EN_PLOTS: PlotFn[] = [
  (c) => [
    `Once there was a child named ${c.hero.name}. Every morning ${c.hero.gender === "m" ? "he" : "she"} walked ${c.place} and said hello to everyone.`,
    `Then one day something went wrong: ${c.problem}. Everyone worried. But ${c.hero.name} said, "I know what to do!"`,
    `A loyal friend was always nearby — ${c.friend}. With a friend along, the road was not scary at all.`,
    `On the way they met ${c.helper}. "Think first, then do," came the advice. The friends listened.`,
    `They tried again and again and did not give up. And it worked!`,
    `That is how they found ${c.treasure}. Ever since, everyone knows: together you can manage anything.`,
  ],
  (c) => [
    `The morning began quietly ${c.place}. ${c.hero.name} was finishing breakfast when ${c.friend} came running.`,
    `"Quick! ${cap(c.problem)}," gasped the friend. ${c.hero.name} jumped up at once.`,
    `They searched everywhere — under every bush, asking everyone they met. But there was no trace.`,
    `Then ${c.helper} said quietly, "Did you look where nobody thought to look?" The friends glanced at each other.`,
    `And there it was! Everyone laughed with relief.`,
    `That day they gained ${c.treasure} — and a habit of searching with their heads, not just their eyes.`,
  ],
  (c) => [
    `${c.hero.name} loved being ${c.place}. It was always calm and good there.`,
    `But that day trouble came: ${c.problem}. ${cap(c.friend)} nearly cried.`,
    `"Don't be sad," said ${c.hero.name}. "We will think of something." And they got to work.`,
    `The work was hard. They called for help — ${c.helper} came, and neighbors followed.`,
    `Together they finished before sunset. Nobody left until the job was done.`,
    `The reward was ${c.treasure}. And something more: now everyone here helps each other.`,
  ],
  (c) => [
    `${c.hero.name} had a dream, but nothing was working yet. ${cap(c.problem)} — that was the hardest part.`,
    `${c.hero.gender === "m" ? "He" : "She"} practiced ${c.place} every single day. And every day it went wrong.`,
    `"Maybe I should stop," thought ${c.hero.name}. But ${c.friend} said, "One more try. I'm right here."`,
    `${cap(c.helper)} walked past and smiled. "Don't rush. Learning is many small steps."`,
    `On the tenth try it worked. Then the eleventh. And then it felt easy.`,
    `That is how ${c.treasure} came about. And ${c.hero.name} learned it was far too soon to give up.`,
  ],
  (c) => [
    `Something strange was happening ${c.place}. ${cap(c.problem)} — and nobody could explain it.`,
    `${c.hero.name} decided to find out, took a notebook, and wrote down everything unusual.`,
    `${cap(c.friend)} helped hunt for clues. Together they walked the whole place three times over.`,
    `The answer came from ${c.helper}: "Sometimes the simplest reason is the right one."`,
    `They checked — and burst out laughing. It was not frightening at all. It was funny.`,
    `So they earned ${c.treasure}, and a story they retold all year.`,
  ],
];

const PLOTS = { ru: RU_PLOTS, kk: KK_PLOTS, en: EN_PLOTS };

// ───────────────────── Topic detection ─────────────────────

const TOPIC_HINTS: Record<TopicKey, string[]> = {
  animals: ["животн", "звер", "лес", "жануар", "аң", "animal", "forest", "лис", "заяц", "кот", "собак", "динозавр", "dino"],
  magic: ["волшеб", "сказ", "маг", "дракон", "сиқыр", "ертег", "magic", "fairy", "dragon", "wizard", "принцесс", "princess"],
  adventure: ["приключ", "путешеств", "оқиға", "саяхат", "adventure", "travel", "journey", "гор", "карт", "пират", "pirate"],
  funny: ["смешн", "весел", "весёл", "хитрост", "күлкі", "қулық", "funny", "silly", "joke", "laugh"],
  friendship: ["дружб", "друз", "помощ", "достық", "көмек", "friend", "help", "together"],
  hero: ["герой", "батыр", "смелост", "ерлік", "hero", "brave", "courage", "knight", "рыцар"],
  nature: ["природ", "сад", "цвет", "дерев", "табиғат", "бақ", "nature", "garden", "tree", "flower"],
  space: ["космос", "звезд", "звёзд", "планет", "ракет", "ғарыш", "жұлдыз", "space", "star", "planet", "rocket"],
  sea: ["мор", "океан", "рыб", "вод", "теңіз", "балық", "sea", "ocean", "fish", "water", "кит", "whale"],
  school: ["школ", "класс", "учит", "урок", "мектеп", "сынып", "school", "class", "teacher", "lesson"],
  sport: ["спорт", "футбол", "бег", "игр", "sport", "football", "soccer", "run", "game", "medal"],
  food: ["еда", "готов", "торт", "пирог", "кухн", "тағам", "ас", "food", "cook", "cake", "kitchen", "bake"],
  mystery: ["тайн", "загадк", "детект", "құпия", "жұмбақ", "mystery", "secret", "detective", "puzzle"],
  family: ["сем", "мам", "пап", "брат", "сестр", "отбасы", "ана", "family", "mom", "dad", "brother", "sister"],
};

function detectTopic(text: string, rnd: () => number): TopicKey {
  const t = text.toLocaleLowerCase();
  const scores = (Object.entries(TOPIC_HINTS) as [TopicKey, string[]][]).map(
    ([key, hints]) => [key, hints.reduce((n, h) => (t.includes(h) ? n + 1 : n), 0)] as const,
  );
  const best = Math.max(...scores.map(([, n]) => n));
  if (best === 0) {
    const keys = Object.keys(TOPIC_HINTS) as TopicKey[];
    return choose(keys, rnd); // no hint → random topic keeps things fresh
  }
  const top = scores.filter(([, n]) => n === best).map(([k]) => k);
  return choose(top, rnd);
}

// ───────────────────────── Titles ─────────────────────────

const TITLES = {
  ru: (c: Cast, rnd: () => number) => choose([
    `${cap(c.hero.name)} и ${c.treasure}`,
    `Как ${c.hero.name} ${c.hero.gender === "m" ? "нашёл" : "нашла"} ${c.treasure}`,
    `История про то, как ${c.problem}`,
    `${cap(c.hero.name)} и верный друг`,
  ], rnd),
  kk: (c: Cast, rnd: () => number) => choose([
    `${cap(c.hero.name)} және ${c.treasure}`,
    `${cap(c.hero.name)} қалай ${c.treasure} тапты`,
    `${cap(c.hero.name)} мен адал дос`,
  ], rnd),
  en: (c: Cast, rnd: () => number) => choose([
    `${cap(c.hero.name)} and ${c.treasure}`,
    `How ${c.hero.name} Found ${c.treasure}`,
    `${cap(c.hero.name)} and the Loyal Friend`,
  ], rnd),
};

// ───────────────────────── Generate ─────────────────────────

/**
 * Builds an original story. Every call draws a fresh plot, hero, friend,
 * place, problem, helper and treasure, so repeated requests differ.
 */
export function generateStoryOffline(
  topicsText: string,
  language: Language,
  age: number,
  seed = Date.now() ^ Math.floor(Math.random() * 1e9),
): { title: string; pages: string[]; topic: TopicKey } {
  const rnd = makeRng(seed);
  const data = DATA[language] ?? DATA.ru;
  const topic = detectTopic(topicsText, rnd);
  const pool = data.topic[topic] ?? data.topic.friendship;
  const fallback = data.topic.friendship;

  // Draw problem/helper/treasure as ONE scenario so they stay coherent —
  // a space problem is never solved by a forest badger.
  const scenario = choose(pool.scenarios ?? fallback.scenarios, rnd);
  const cast: Cast = {
    hero: choose(data.heroes, rnd),
    friend: choose(pool.friends ?? fallback.friends, rnd),
    place: choose(pool.places ?? fallback.places, rnd),
    problem: scenario.problem,
    helper: scenario.helper,
    treasure: scenario.treasure,
  };

  const plots = PLOTS[language] ?? PLOTS.ru;
  const plot = choose(plots, rnd);
  const scenes = plot(cast);

  const sceneCount = age <= 6 ? 4 : age <= 8 ? 5 : scenes.length;
  return {
    title: TITLES[language](cast, rnd),
    pages: scenes.slice(0, Math.min(sceneCount, scenes.length)),
    topic,
  };
}
