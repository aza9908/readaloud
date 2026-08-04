/**
 * АРХИТЕКТУРНЫЙ КРИТИК.
 *
 * Проверяет инварианты, которые уже нарушались в этом проекте и доходили
 * до пользователя. Каждая проверка родилась из реальной ошибки, а не из
 * общих соображений:
 *
 *   1. Компонент импортирован, но не отрисован.
 *      Так панель родительских наград месяц пролежала в дашборде невидимой:
 *      импорт был, разметки не было, и сборка молчала.
 *
 *   2. Переименование сделано не везде.
 *      Название сменили на главной, а на экране профилей осталось старое.
 *
 *   3. Заголовок центрируется через justify-between.
 *      Это не центрирует: при разной ширине боковых кнопок заголовок
 *      съезжает (замерено смещение 20px).
 *
 *   4. Секрет попал в клиентский бандл.
 *      Ключ платного API в браузере — это чужие деньги.
 *
 *   5. Монеты начисляются больше чем в одном месте.
 *      Иначе ограничения на повторы обходятся.
 *
 * Запуск: node test/architecture.test.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok || !detail ? "" : `\n         ${detail}`}`);
  ok ? pass++ : fail++;
};

const readAll = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? readAll(join(dir, e.name))
    : /\.(tsx|ts)$/.test(e.name) ? [join(dir, e.name)] : [],
  );

const files = readAll("src");
const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

console.log("\n── 1. Импортированные компоненты действительно отрисованы ──");
{
  let problems = [];
  for (const [file, src] of sources) {
    // Локальные компоненты вида: import { Foo } from "@/components/Foo"
    const imports = [...src.matchAll(/import\s+\{([^}]+)\}\s+from\s+"@\/components\/[^"]+"/g)]
      .flatMap((m) => m[1].split(",").map((s) => s.trim().split(" as ").pop().trim()))
      .filter((n) => /^[A-Z]/.test(n));
    for (const name of imports) {
      // Ищем использование как JSX-тега
      const used = new RegExp(`<${name}[\\s/>]`).test(src);
      if (!used) problems.push(`${file}: ${name} импортирован, но не отрисован`);
    }
  }
  check("нет импортированных, но неиспользуемых компонентов",
        problems.length === 0, problems.join("\n         "));
}

console.log("\n── 2. Название бренда единообразно ──");
{
  const OLD = /Read\s*Aloud|ReadAloud/;
  const offenders = [...sources.entries()]
    .filter(([f, s]) => OLD.test(s))
    .map(([f]) => f);
  // index.html тоже
  if (existsSync("index.html") && OLD.test(readFileSync("index.html", "utf8"))) {
    offenders.push("index.html");
  }
  check("старое название нигде не осталось", offenders.length === 0, offenders.join(", "));
}

console.log("\n── 3. Заголовки центрируются надёжно ──");
{
  /**
   * Проблема возникает не от самого justify-between, а от попытки
   * отцентрировать СРЕДНИЙ элемент между двумя боковыми разной ширины.
   * Если в шапке два элемента (логотип слева, кнопка справа) —
   * justify-between правильный выбор. Считаем прямых потомков.
   */
  const countTopLevelChildren = (block) => {
    let depth = 0, count = 0;
    const tags = [...block.matchAll(/<\/?([A-Za-z][\w.]*)[^>]*?(\/?)>/g)];
    for (const [full, , selfClose] of tags) {
      const isClosing = full.startsWith("</");
      if (isClosing) { depth--; continue; }
      if (depth === 1) count++;
      if (!selfClose && !full.endsWith("/>")) depth++;
    }
    return count;
  };

  const bad = [];
  for (const [file, src] of sources) {
    if (!/pages\//.test(file)) continue;
    const start = src.indexOf("<header");
    if (start === -1) continue;
    const end = src.indexOf("</header>", start);
    if (end === -1) continue;
    const block = src.slice(start, end);
    const clsMatch = block.match(/className="([^"]*)"/);
    const cls = clsMatch ? clsMatch[1] : "";
    if (!cls.includes("justify-between") || cls.includes("grid-cols-")) continue;

    // Три и более прямых потомка => средний должен быть по центру,
    // а justify-between его не центрирует.
    const children = countTopLevelChildren(block);
    if (children >= 3) {
      bad.push(`${file}: шапка с ${children} элементами на justify-between — средний съедет`);
    }
  }
  check("шапки с центральным заголовком используют сетку",
        bad.length === 0, bad.join("\n         "));
}

console.log("\n── 4. Секреты не попадают в клиент ──");
{
  const leaked = [];
  for (const [file, src] of sources) {
    // Ключи платных сервисов не должны упоминаться в клиентском коде
    if (/FREEDOM_STT_KEY|ANTHROPIC_API_KEY\s*=\s*"/.test(src)) {
      leaked.push(`${file}: упоминается серверный секрет`);
    }
    // Захардкоженные адреса RunPod ломаются при перезапуске пода
    if (/proxy\.runpod\.net/.test(src)) {
      leaked.push(`${file}: захардкожен адрес RunPod (меняется при перезапуске)`);
    }
  }
  check("в клиентском коде нет серверных секретов", leaked.length === 0, leaked.join("\n         "));

  // И в собранном бандле, если он есть
  if (existsSync("dist/assets")) {
    const bundles = readdirSync("dist/assets").filter((f) => f.endsWith(".js"));
    const dirty = bundles.filter((b) => {
      const c = readFileSync(join("dist/assets", b), "utf8");
      return /FREEDOM_STT_KEY|sk-ant-|proxy\.runpod\.net/.test(c);
    });
    check("в собранном бандле нет секретов", dirty.length === 0, dirty.join(", "));
  }
}

console.log("\n── 5. Монеты начисляются только через проверенные функции ──");
{
  const fs = readFileSync("src/lib/firestore.ts", "utf8");

  /**
   * Раньше правило было «ровно одно место начисления», потому что вся награда
   * выдавалась при завершении книги. Это оказалось вредно: книга на 10 000 слов
   * не приносила монет почти три месяца, и дети бросали чтение. Теперь начислений
   * два — за страницу и за книгу, — но оба обязаны идти через модуль coins.ts
   * и проверять, не оплачена ли эта территория раньше. Иначе вернётся накрутка.
   */
  const awards = (fs.match(/coins:\s*increment\(/g) || []).length;
  check("начислений не больше двух (страница и книга)", awards <= 2,
        `найдено ${awards}`);

  check("награда за страницу считается в coins.ts", fs.includes("awardForPage("));
  check("награда за книгу считается в coins.ts", fs.includes("awardForCompletion("));

  // Главная защита: страница не должна оплачиваться дважды.
  check("оплаченные страницы отслеживаются", fs.includes("pagesAwarded"));
  check("проверяется, оплачена ли страница раньше", /alreadyAwarded/.test(fs));

  // Начисления обязаны быть транзакционными.
  const pageAwardBlock = fs.slice(fs.indexOf("export async function awardPage"));
  check("начисление за страницу транзакционно",
        pageAwardBlock.slice(0, 600).includes("runTransaction"));

  const savesCoins = /saveSessionProgress[\s\S]{0,800}coins:\s*increment/.test(fs);
  check("промежуточное сохранение не начисляет напрямую", !savesCoins);
}

console.log("\n── 6. Правила стоимости не ослаблены ──");
{
  const stt = existsSync("src/lib/sttEscalation.ts")
    ? readFileSync("src/lib/sttEscalation.ts", "utf8") : "";
  if (stt) {
    const stall = Number((stt.match(/STALL_THRESHOLD = (\d+)/) || [])[1] || 0);
    check("платный движок включается только после явного сбоя", stall >= 6,
          `порог ${stall} — слишком низкий, будут лишние платные запросы`);
    const perBook = Number((stt.match(/MAX_ESCALATIONS_PER_BOOK = (\d+)/) || [])[1] || 0);
    check("есть потолок обращений на книгу", perBook > 0 && perBook <= 6,
          `лимит ${perBook}`);
    check("платный путь только для казахского", /language !== "kk"/.test(stt));
  }
}

console.log(`\n${pass} прошло, ${fail} упало\n`);
if (fail > 0) {
  console.log("Критик нашёл нарушения. Это те же классы ошибок, что уже");
  console.log("доходили до пользователя — чинить до деплоя.\n");
}
process.exit(fail ? 1 : 0);
