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

interface Pools {
  heroes: Hero[];
  helpers: string[];
  friends: string[];
  places: string[];
  problems: string[];
  treasures: string[];
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

const RU_TOPIC: Record<TopicKey, Partial<Pools>> = {
  animals: {
    friends: ["зайчонок Пух", "лисёнок Рыжик", "ёжик Пыхтя", "белка Стрелка", "барсучок Тиша"],
    places: ["в густом лесу", "на лесной поляне", "у старого дуба", "возле тихой речки", "в берёзовой роще"],
    problems: ["исчезли все ягоды", "пропал маленький котёнок", "кто-то разорил птичье гнездо", "звери перестали здороваться", "у зайчонка заболела лапка"],
    treasures: ["полная корзина ягод", "новое гнездо для птиц", "тёплая нора на зиму", "весёлый лесной праздник"],
  },
  magic: {
    friends: ["дракончик Уголёк", "фея Ветерок", "говорящий кот Баюн", "светлячок Огонёк", "гном Тик"],
    places: ["у волшебного озера", "в старой башне", "на радужном мосту", "в саду говорящих цветов", "у зеркального ручья"],
    problems: ["погасли все звёзды", "исчезла радуга", "заклинание перепуталось", "волшебная книга закрылась", "все краски стали серыми"],
    treasures: ["звёздный фонарик", "новая радуга", "поющая шкатулка", "перо жар-птицы"],
  },
  adventure: {
    friends: ["пёс Верный", "капитан Мурат", "попугай Кеша", "юнга Алишер", "конь Ветер"],
    places: ["на высокой горе", "у старого маяка", "в пещере эха", "на песчаном берегу", "в дремучем ущелье"],
    problems: ["пропала старая карта", "тропинка исчезла в тумане", "мост через реку сломался", "компас показывал не туда", "лодку унесло течением"],
    treasures: ["древний компас", "сундук с ракушками", "нарисованная карта", "флаг для новой команды"],
  },
  funny: {
    friends: ["белка Стрелка", "бобёр Гриша", "утёнок Кряк", "поросёнок Пух", "козлёнок Мемеша"],
    places: ["на лесной поляне", "у пруда", "во дворе", "на старой мельнице", "возле большой лужи"],
    problems: ["все шишки укатились под гору", "кто-то съел весь мёд", "шапки перепутались", "качели заскрипели так, что распугали птиц", "варенье убежало из банки"],
    treasures: ["гора орехов", "самый громкий смех в лесу", "новая смешная песенка", "самая большая лужа для прыжков"],
  },
  friendship: {
    friends: ["новенькая девочка Сая", "сосед по парте Арман", "молчаливый мальчик Бек", "двойняшки Аян и Аяна", "щенок Барс"],
    places: ["во дворе", "на детской площадке", "у подъезда", "в школьном саду", "на скамейке возле дома"],
    problems: ["никто не хотел играть вместе", "друзья поссорились из-за пустяка", "новенького не приняли в игру", "мяч улетел к соседям", "все разошлись по домам"],
    treasures: ["новая дружба", "общая игра для всех", "самое честное правило", "секретное рукопожатие"],
  },
  hero: {
    friends: ["конь Ветер", "верный друг Асан", "старший брат Ержан", "беркут Самғау", "пастуший пёс Актос"],
    places: ["в широкой степи", "у подножия гор", "возле старого колодца", "на берегу большой реки", "у юрты на холме"],
    problems: ["река перестала течь", "потерялось стадо", "буря разрушила загон", "младшие испугались грозы", "колодец пересох"],
    treasures: ["чистая вода для аула", "спасённое стадо", "новый крепкий загон", "уважение всех соседей"],
  },
  nature: {
    friends: ["бабочка Луна", "пчела Жужа", "садовник Ильяс", "воробей Чик", "дождевой червяк Тиша"],
    places: ["в старом саду", "на цветочной клумбе", "под большой яблоней", "возле тёплой теплицы", "на зелёном лугу"],
    problems: ["засохло любимое дерево", "цветы перестали раскрываться", "кто-то сломал молодой саженец", "исчезли все пчёлы", "в саду завяла трава"],
    treasures: ["первый зелёный листок", "сад, полный цветов", "новое деревце", "самое сладкое яблоко"],
  },
  space: {
    friends: ["робот Пик", "космонавт Аян", "лунный зайчик", "спутник Шар", "маленькая комета"],
    places: ["на маленькой планете", "на лунной станции", "в звёздном тумане", "у кратера Тишины", "на борту старой ракеты"],
    problems: ["потерялась одна звезда", "ракета не заводилась", "связь с Землёй пропала", "погас свет на станции", "метеорит закрыл дорогу"],
    treasures: ["карта звёздного неба", "починенная ракета", "первый сигнал с Земли", "новое созвездие"],
  },
  sea: {
    friends: ["черепаха Тиша", "краб Клешня", "дельфин Свист", "морской конёк Ига", "осьминог Восьмик"],
    places: ["на дне синего моря", "у кораллового рифа", "возле старого затонувшего корабля", "в тихой лагуне", "под большой скалой"],
    problems: ["запутались водоросли", "пропала жемчужина", "течение унесло малька", "риф засыпало песком", "вода стала мутной"],
    treasures: ["блестящая жемчужина", "чистая вода у рифа", "спасённый малёк", "самая красивая ракушка"],
  },
  school: {
    friends: ["сосед по парте Арман", "отличница Дана", "весёлый Ержан", "школьный кот Мурзик", "библиотекарь Асем"],
    places: ["в школьном классе", "в библиотеке", "на школьном дворе", "в кабинете рисования", "у доски"],
    problems: ["потерялся школьный журнал", "все забыли про домашнее задание", "мелки закончились", "никто не знал ответа", "рисунок для конкурса испортился"],
    treasures: ["первая пятёрка", "самый красивый рисунок", "новая книга из библиотеки", "грамота для всего класса"],
  },
  sport: {
    friends: ["тренер Марат", "вратарь Ануар", "капитан команды Алия", "быстрый Ерасыл", "младший брат Даулет"],
    places: ["на стадионе", "в спортзале", "на школьном поле", "у турников во дворе", "на беговой дорожке"],
    problems: ["не получалось забить гол", "команда проигрывала", "мяч всё время улетал", "никто не хотел быть вратарём", "перед стартом задрожали коленки"],
    treasures: ["золотая медаль", "первый забитый гол", "дружная команда", "новый рекорд двора"],
  },
  food: {
    friends: ["кот Пирожок", "бабушка Сара", "пекарь Ильяс", "мышонок Крошка", "сестрёнка Аружан"],
    places: ["на тёплой кухне", "в маленькой пекарне", "у большой печи", "за круглым столом", "возле открытого окна с запахом хлеба"],
    problems: ["убежало тесто", "закончился сахар", "пирог никак не поднимался", "кто-то съел все баурсаки", "молоко сбежало из кастрюли"],
    treasures: ["самый вкусный пирог", "гора румяных баурсаков", "новый семейный рецепт", "чай для всех соседей"],
  },
  mystery: {
    friends: ["подруга Дана", "соседский кот", "любопытный Бек", "старый сторож", "младшая сестра Аяна"],
    places: ["в старом доме", "на тёмном чердаке", "во дворе за сараем", "в подвале библиотеки", "у заброшенной калитки"],
    problems: ["по ночам кто-то шумел", "пропали все ложки", "на снегу появились странные следы", "свет включался сам собой", "из-за двери слышался шёпот"],
    treasures: ["разгаданная тайна", "найденная пропажа", "старая шкатулка с письмами", "новое смешное объяснение"],
  },
  family: {
    friends: ["младший брат Ануар", "сестрёнка Аяна", "бабушка Сара", "дедушка Кайрат", "двоюродный брат Алишер"],
    places: ["в родном доме", "во дворе у бабушки", "на кухне за большим столом", "в саду за домом", "на веранде"],
    problems: ["все забыли про праздник", "потерялась старая фотография", "никто не мог договориться", "бабушка загрустила", "подарок не успевали сделать"],
    treasures: ["самый тёплый вечер", "найденная фотография", "общий семейный праздник", "подарок своими руками"],
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

const KK_TOPIC: Record<TopicKey, Partial<Pools>> = {
  animals: { friends: ["қоян Үлпек", "түлкі Қызылшақа", "кірпі Пысқақ", "тиін Жебе"], places: ["қалың орманда", "орман алаңында", "кәрі емен түбінде", "тынық өзен жағасында"], problems: ["барлық жидек жоғалды", "кішкентай мысық адасып кетті", "құс ұясы бұзылды", "аңдар амандаспай кетті"], treasures: ["толы себет жидек", "құстарға жаңа ұя", "қысқа жылы ін", "көңілді орман мерекесі"] },
  magic: { friends: ["айдаһар Шоқ", "пері Желбір", "сөйлейтін мысық", "от шыбын Жалын"], places: ["сиқырлы көл жағасында", "ескі мұнарада", "кемпірқосақ көпірінде", "сөйлейтін гүлдер бағында"], problems: ["жұлдыздар сөніп қалды", "кемпірқосақ жоғалды", "сиқыр шатасып кетті", "сиқырлы кітап жабылды"], treasures: ["жұлдызды шам", "жаңа кемпірқосақ", "әндетер сандық", "самұрық қауырсыны"] },
  adventure: { friends: ["ит Адал", "капитан Мұрат", "тотықұс Кеша", "жүйрік ат Жел"], places: ["биік тауда", "ескі шамшырақ жанында", "жаңғырық үңгірінде", "құмды жағада"], problems: ["ескі карта жоғалды", "соқпақ тұманға сіңіп кетті", "көпір сынды", "компас адастырды"], treasures: ["көне компас", "бақалшақ толы сандық", "жаңа карта", "команда туы"] },
  funny: { friends: ["тиін Жебе", "құндыз Гриша", "үйрек Қаңқ", "лақ Мекеш"], places: ["орман алаңында", "тоған жағасында", "аулада", "ескі диірменде"], problems: ["барлық бүршік домалап кетті", "біреу балды жеп қойды", "бөріктер шатасты", "әткеншек шиқылдап құстарды үркітті"], treasures: ["жаңғақ үйіндісі", "ормандағы ең қатты күлкі", "жаңа күлкілі ән", "секіруге ең үлкен шалшық"] },
  friendship: { friends: ["жаңа көрші қыз Сая", "партадағы досы Арман", "үндемес бала Бек", "күшік Барыс"], places: ["аулада", "балалар алаңында", "мектеп бағында", "үй жанындағы орындықта"], problems: ["ешкім бірге ойнағысы келмеді", "достар ұсақ нәрсеге ұрысып қалды", "жаңа баланы ойынға алмады", "доп көршіге ұшып кетті"], treasures: ["жаңа достық", "бәріне ортақ ойын", "ең әділ ереже", "құпия қол алысу"] },
  hero: { friends: ["жүйрік ат Жел", "адал дос Асан", "үлкен ағасы Ержан", "бүркіт Самғау"], places: ["кең далада", "тау бөктерінде", "ескі құдық жанында", "үлкен өзен жағасында"], problems: ["өзен ағуын тоқтатты", "мал жоғалды", "дауыл қораны бұзды", "кішілер найзағайдан қорықты"], treasures: ["ауылға таза су", "құтқарылған мал", "жаңа берік қора", "көршілердің құрметі"] },
  nature: { friends: ["көбелек Ай", "ара Зуза", "бағбан Ілияс", "торғай Шық"], places: ["ескі бақта", "гүлзарда", "үлкен алма ағашының түбінде", "жасыл шалғында"], problems: ["сүйікті ағаш қурап қалды", "гүлдер ашылмай қойды", "жас көшетті сындырды", "аралар жоғалды"], treasures: ["алғашқы жасыл жапырақ", "гүлге толы бақ", "жаңа көшет", "ең тәтті алма"] },
  space: { friends: ["робот Пик", "ғарышкер Аян", "ай қоянчығы", "серік Шар"], places: ["кішкентай планетада", "ай станциясында", "жұлдызды тұманда", "ескі зымыран бортында"], problems: ["бір жұлдыз жоғалды", "зымыран қосылмады", "Жермен байланыс үзілді", "станцияда жарық сөнді"], treasures: ["жұлдызды аспан картасы", "жөнделген зымыран", "Жерден алғашқы сигнал", "жаңа шоқжұлдыз"] },
  sea: { friends: ["тасбақа Тыныш", "шаян Қысқыш", "дельфин Ысқырық", "теңіз ат Иға"], places: ["көк теңіз түбінде", "маржан рифінде", "батқан кеме жанында", "тыныш шығанақта"], problems: ["балдырлар шатасып қалды", "меруерт жоғалды", "ағыс шабақты алып кетті", "рифті құм басты"], treasures: ["жарқыраған меруерт", "риф жанындағы таза су", "құтқарылған шабақ", "ең әдемі бақалшақ"] },
  school: { friends: ["партадағы досы Арман", "үздік оқушы Дана", "көңілді Ержан", "кітапханашы Әсем"], places: ["мектеп сыныбында", "кітапханада", "мектеп ауласында", "сурет кабинетінде"], problems: ["сынып журналы жоғалды", "бәрі үй тапсырмасын ұмытты", "бор таусылды", "ешкім жауапты білмеді"], treasures: ["алғашқы бестік", "ең әдемі сурет", "кітапханадан жаңа кітап", "сыныпқа мадақтама"] },
  sport: { friends: ["жаттықтырушы Марат", "қақпашы Ануар", "команда капитаны Әлия", "жүйрік Ерасыл"], places: ["стадионда", "спортзалда", "мектеп алаңында", "аулада турник жанында"], problems: ["гол сала алмады", "команда ұтылып жатты", "доп үнемі ұшып кетті", "ешкім қақпашы болғысы келмеді"], treasures: ["алтын медаль", "алғашқы гол", "ынтымақты команда", "жаңа рекорд"] },
  food: { friends: ["мысық Бауырсақ", "Сара әже", "наубайшы Ілияс", "тышқан Үгінді"], places: ["жылы асханада", "кішкентай наубайханада", "үлкен пеш жанында", "дөңгелек үстел басында"], problems: ["қамыр қашып кетті", "қант таусылды", "бәліш көтерілмеді", "біреу бауырсақты жеп қойды"], treasures: ["ең дәмді бәліш", "қызарған бауырсақ үйіндісі", "жаңа отбасылық рецепт", "көршілерге шай"] },
  mystery: { friends: ["досы Дана", "көрші мысығы", "қызыққұмар Бек", "кәрі күзетші"], places: ["ескі үйде", "қараңғы шатырда", "қора артындағы аулада", "кітапхана жертөлесінде"], problems: ["түнде біреу шуылдады", "барлық қасық жоғалды", "қарда оғаш іздер пайда болды", "жарық өздігінен жанды"], treasures: ["шешілген құпия", "табылған зат", "хаттар салынған ескі сандық", "жаңа күлкілі түсінік"] },
  family: { friends: ["інісі Ануар", "қарындасы Аяна", "Сара әже", "Қайрат ата"], places: ["туған үйде", "әженің ауласында", "үлкен үстел басында", "үй артындағы бақта"], problems: ["бәрі мерекені ұмытып кетті", "ескі сурет жоғалды", "ешкім келісе алмады", "әже мұңайып қалды"], treasures: ["ең жылы кеш", "табылған сурет", "ортақ отбасылық мереке", "өз қолымен жасалған сыйлық"] },
};

// ───────────────────────── English data ─────────────────────────

const EN_HEROES: Hero[] = [
  { name: "Mira", gender: "f" }, { name: "Theo", gender: "m" },
  { name: "Amina", gender: "f" }, { name: "Danny", gender: "m" },
  { name: "Luca", gender: "m" }, { name: "Nora", gender: "f" },
  { name: "Sam", gender: "m" }, { name: "Ivy", gender: "f" },
];
const EN_HELPERS = ["a wise owl", "an old badger", "a kind grandpa", "a cheerful postman", "an old turtle", "the park keeper"];

const EN_TOPIC: Record<TopicKey, Partial<Pools>> = {
  animals: { friends: ["Pip the rabbit", "Rusty the fox cub", "Puffin the hedgehog", "Zip the squirrel"], places: ["deep in the forest", "in a sunny clearing", "under the old oak", "beside a quiet stream"], problems: ["all the berries had vanished", "a small kitten was lost", "a bird's nest had fallen", "the animals stopped saying hello"], treasures: ["a basket full of berries", "a brand-new nest", "a warm burrow for winter", "a happy forest party"] },
  magic: { friends: ["Ember the little dragon", "Breeze the fairy", "a talking cat", "Flicker the firefly"], places: ["beside a magic lake", "in an old tower", "on a rainbow bridge", "in a garden of talking flowers"], problems: ["every star had gone dark", "the rainbow disappeared", "a spell got tangled", "the magic book snapped shut"], treasures: ["a lantern full of starlight", "a brand-new rainbow", "a singing music box", "a glowing feather"] },
  adventure: { friends: ["Trusty the dog", "Captain Murat", "Kesha the parrot", "a horse named Wind"], places: ["high on a mountain", "by the old lighthouse", "in the echo cave", "on a sandy shore"], problems: ["the old map went missing", "the path vanished in fog", "the bridge broke", "the compass pointed the wrong way"], treasures: ["an ancient compass", "a chest of seashells", "a hand-drawn map", "a flag for the new crew"] },
  funny: { friends: ["Zip the squirrel", "Gus the beaver", "Quack the duckling", "Momo the goat"], places: ["in a sunny clearing", "by the pond", "in the yard", "at the old mill"], problems: ["all the pinecones rolled downhill", "someone ate the honey", "the hats got mixed up", "the swing squeaked so loudly it scared the birds"], treasures: ["a mountain of nuts", "the loudest laugh in the woods", "a funny new song", "the best puddle for jumping"] },
  friendship: { friends: ["a new girl named Saya", "his deskmate Arman", "a quiet boy named Bek", "Scout the puppy"], places: ["in the yard", "at the playground", "in the school garden", "on the bench by the door"], problems: ["nobody wanted to play together", "two friends argued over nothing", "the new kid was left out", "the ball flew over the fence"], treasures: ["a brand-new friendship", "a game everyone can play", "the fairest rule of all", "a secret handshake"] },
  hero: { friends: ["a horse named Wind", "a loyal friend Asan", "big brother Erzhan", "an eagle named Samgau"], places: ["on the wide steppe", "at the foot of the mountains", "beside the old well", "on the riverbank"], problems: ["the river stopped flowing", "the herd went missing", "a storm broke the fence", "the little ones were afraid of thunder"], treasures: ["clean water for the village", "the rescued herd", "a strong new fence", "the respect of every neighbor"] },
  nature: { friends: ["Luna the butterfly", "Buzz the bee", "Ilyas the gardener", "Chirp the sparrow"], places: ["in an old garden", "in the flower bed", "under the big apple tree", "on a green meadow"], problems: ["her favorite tree dried up", "the flowers would not open", "a young sapling was broken", "all the bees disappeared"], treasures: ["the first green leaf", "a garden full of flowers", "a little new tree", "the sweetest apple"] },
  space: { friends: ["Pik the robot", "Ayan the astronaut", "a moon bunny", "Orb the satellite"], places: ["on a tiny planet", "at the moon station", "in a cloud of stars", "aboard an old rocket"], problems: ["one star went missing", "the rocket would not start", "contact with Earth was lost", "the station lights went out"], treasures: ["a map of the night sky", "the mended rocket", "the first signal from Earth", "a brand-new constellation"] },
  sea: { friends: ["Tish the turtle", "Pinch the crab", "Whistle the dolphin", "Iga the seahorse"], places: ["at the bottom of the blue sea", "by the coral reef", "near an old sunken ship", "in a quiet lagoon"], problems: ["the seaweed was tangled", "a pearl went missing", "the current carried a baby fish away", "sand covered the reef"], treasures: ["a shining pearl", "clear water by the reef", "the rescued baby fish", "the prettiest shell"] },
  school: { friends: ["his deskmate Arman", "top student Dana", "cheerful Erzhan", "Asem the librarian"], places: ["in the classroom", "in the library", "in the schoolyard", "in the art room"], problems: ["the class notebook disappeared", "everyone forgot the homework", "the chalk ran out", "nobody knew the answer"], treasures: ["her first top mark", "the prettiest drawing", "a new book from the library", "a certificate for the whole class"] },
  sport: { friends: ["Coach Marat", "Anuar the goalkeeper", "team captain Aliya", "speedy Erasyl"], places: ["at the stadium", "in the gym", "on the school field", "at the bars in the yard"], problems: ["he could not score a goal", "the team kept losing", "the ball flew away every time", "nobody wanted to be goalkeeper"], treasures: ["a gold medal", "the first goal", "a team that sticks together", "a new yard record"] },
  food: { friends: ["Muffin the cat", "grandma Sara", "Ilyas the baker", "Crumb the mouse"], places: ["in a warm kitchen", "in a tiny bakery", "beside the big oven", "at the round table"], problems: ["the dough ran away", "the sugar ran out", "the pie would not rise", "someone ate all the buns"], treasures: ["the tastiest pie of all", "a mountain of golden buns", "a new family recipe", "tea for all the neighbors"] },
  mystery: { friends: ["her friend Dana", "the neighbor's cat", "curious Bek", "the old watchman"], places: ["in an old house", "in the dark attic", "behind the shed", "in the library basement"], problems: ["something rustled every night", "all the spoons went missing", "strange tracks appeared in the snow", "the light turned on by itself"], treasures: ["a solved mystery", "the missing things, found", "an old box of letters", "a funny new explanation"] },
  family: { friends: ["her little brother Anuar", "her sister Ayana", "grandma Sara", "grandpa Kairat"], places: ["at home", "in grandma's yard", "at the big kitchen table", "in the garden behind the house"], problems: ["everyone forgot the holiday", "an old photo went missing", "nobody could agree", "grandma looked sad"], treasures: ["the warmest evening", "the photo, found at last", "a family celebration", "a handmade gift"] },
};

const DATA = {
  ru: { heroes: RU_HEROES, helpers: RU_HELPERS, topic: RU_TOPIC },
  kk: { heroes: KK_HEROES, helpers: KK_HELPERS, topic: KK_TOPIC },
  en: { heroes: EN_HEROES, helpers: EN_HELPERS, topic: EN_TOPIC },
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
  const pool = data.topic[topic] ?? {};
  const fallback = data.topic.friendship;

  const cast: Cast = {
    hero: choose(data.heroes, rnd),
    friend: choose(pool.friends ?? fallback.friends!, rnd),
    place: choose(pool.places ?? fallback.places!, rnd),
    problem: choose(pool.problems ?? fallback.problems!, rnd),
    helper: choose(data.helpers, rnd),
    treasure: choose(pool.treasures ?? fallback.treasures!, rnd),
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
