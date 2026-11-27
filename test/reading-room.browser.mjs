import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { chromium, devices, webkit } from "playwright-core";
import { preview } from "vite";

const base = "http://127.0.0.1:4173";
const output = "test-results/reading-room";
const firestore = process.env.FIRESTORE_EMULATOR_HOST;
const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
for (const host of [firestore, auth]) assert.match(host ?? "", /^127\.0\.0\.1:\d+$/, "Local emulators required");

const db = getFirestore(initializeApp({ projectId: "demo-bookser" }));
const catalogue = JSON.parse(await readFile(new URL("../src/lib/starterBooks.json", import.meta.url), "utf8"));
const bruno = catalogue.find(book => book.title === "The Bear Who Loved Books");
const brunoPages = bruno.text.trim().split(/\n\s*\n/);
const wordCount = pages => pages.join(" ").trim().split(/\s+/).length;
const savedWords = wordCount(brunoPages.slice(0, 2)) + 4;
const savedPercent = Math.round(100 * savedWords / wordCount(brunoPages));
const books = [
  { id: "bruno", title: bruno.title, language: "en", coverEmoji: bruno.coverEmoji, pages: brunoPages, pageImages: [null, null, "/missing-page-for-test.webp"] },
  { id: "turnip", title: "Репка", coverEmoji: "🌱", language: "ru", pages: ["Посадил дед репку. Выросла репка большая, пребольшая."] },
  { id: "hare", title: "Батыл қоян", coverEmoji: "🐇", language: "kk", pages: ["Қоян үйіне келді. Ол кітап оқыды."] },
  { id: "boat", title: "Бумажный кораблик", coverEmoji: "⛵", language: "ru", pages: ["По реке плыл маленький бумажный кораблик. На берегу стояла девочка."] },
];
for (const { id, ...book } of books) {
  await db.doc("books/" + id).set({ ownerId: null, isCustom: false, band: "6-7", coverUrl: null, totalWords: wordCount(book.pages), ...book });
}

// Exercise the same stored display keys as earlier versions of the app, including private covers.
async function seedHistory(profileId) {
  const profile = (await db.collectionGroup("profiles").get()).docs.find(doc => doc.id === profileId);
  assert.ok(profile, "The signed-in emulator reader has a profile");
  const batch = db.batch();
  const ownerId = profile.ref.parent.parent.id;
  for (const [id, title, coverEmoji] of [["atlas", "Маленький атлас", "🌐"], ["notes", "Дневник открытий", "📖"]]) {
    batch.set(db.doc("books/" + profileId + "-" + id), {
      ownerId, title, coverEmoji, coverUrl: null, isCustom: true, language: "ru", band: "6-7",
      pages: ["Ветер нёс маленький кораблик."], totalWords: 4, createdAt: Date.now(),
    });
  }
  // Older families could save several children with the same starter portrait.
  batch.set(profile.ref.parent.doc("sibling"), { ...profile.data(), name: "Дана", createdAt: profile.data().createdAt + 1 });
  batch.set(db.doc("books/" + profileId + "-photo"), {
    ownerId, title: "Книга с рисунком", language: "ru", coverEmoji: "📖", isCustom: true,
    coverUrl: "/missing-cover-for-test.webp", pageImages: ["/icon-180.png"], band: "6-7", pages: ["У реки рос старый дуб."], totalWords: 5,
  });
  const now = Date.now();
  batch.set(profile.ref.collection("sessions").doc("saved-bruno"), {
    bookId: "bruno", bookTitle: bruno.title, language: "en", startedAt: now - 75000, updatedAt: now,
    durationMs: 72000, currentPage: 2, currentWordIndex: 4, wordsRead: savedWords, wpm: 35, completed: false,
  });
  const badges = ["word_wizard", "century_reader", "bookworm", "first_story", "story_collector", "book_lover", "reading_star", "real_reader"];
  badges.forEach((id, index) => batch.set(profile.ref.collection("achievements").doc(id), { earnedAt: now + index }));
  batch.set(profile.ref.collection("sessions").doc("completed"), {
    bookId: "boat", bookTitle: "Бумажный кораблик", language: "ru", startedAt: now - 60000,
    updatedAt: now, durationMs: 60000, currentPage: 0, currentWordIndex: 30, wordsRead: 30, wpm: 30, completed: true,
  });
  batch.update(profile.ref, { booksCompleted: 1, totalWords: 30, totalMs: 60000, coins: 25, "byLanguage.ru": { books: 1, ms: 60000 } });
  await batch.commit();
}

await mkdir(output, { recursive: true });
const server = await preview({ logLevel: "error", preview: {
  host: "127.0.0.1", port: 4173, strictPort: true,
  headers: { "Content-Security-Policy": "connect-src 'self' http://127.0.0.1:* http://localhost:* https://ru.wikisource.org; frame-src 'self' http://127.0.0.1:* http://localhost:*" },
} });
const cases = [
  { label: "iphone", browser: webkit, options: { ...devices["iPhone 13"], deviceScaleFactor: 1 } },
  { label: "ipad", browser: webkit, options: { ...devices["iPad Pro 11"], deviceScaleFactor: 1 } },
  { label: "macbook", browser: webkit, options: { viewport: { width: 1440, height: 900 } } },
  { label: "compact", browser: chromium, options: { viewport: { width: 320, height: 650 }, isMobile: true, hasTouch: true } },
];

async function check(screen) {
  const browser = await screen.browser.launch();
  const context = await browser.newContext({ ...screen.options, locale: "ru-RU", colorScheme: "light", reducedMotion: "reduce" });
  await context.addInitScript(({ firestore, auth }) => {
    window.__FIREBASE_DEFAULTS__ = { emulatorHosts: { firestore, auth } };
  }, { firestore, auth });
  const page = await context.newPage();
  // Local Firestore may return a WebKit long poll at the end of its 30-second window.
  page.setDefaultTimeout(65000);
  await page.route("https://ru.wikisource.org/**", route => route.fulfill({
    json: { query: { search: [{ title: "Теремок", snippet: "Лесная сказка" }, { title: "Карта путешественника", snippet: "Атлас" }] } },
    headers: { "access-control-allow-origin": "*" },
  }));
  await page.route("**/missing-*-for-test.webp", route => route.fulfill({ status: 404, body: "" }));
  const errors = [];
  const network = [];
  page.on("request", req => { const url = new URL(req.url()); if (url.port === "8080") network.push([req.method(), url.pathname]); });
  page.on("requestfailed", req => network.push([req.method(), new URL(req.url()).pathname, req.failure()?.errorText]));
  page.on("response", res => { if (res.status() >= 400) network.push([res.status(), new URL(res.url()).pathname]); });
  page.on("console", msg => { if (msg.type() === "error" || msg.type() === "warning") network.push(msg.text().split("?")[0].slice(0, 220)); });
  page.on("pageerror", err => errors.push(err.message));

  async function inspect(name) {
    const model = page.locator(".world-model");
    if (await model.count()) {
      await model.evaluate(img => img.decode());
      assert.ok((await model.boundingBox()).height >= 100);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), name + " overflows horizontally");
    await page.screenshot({ path: `${output}/${screen.label}-${name}.png`, scale: "css", animations: "disabled" });
  }

  const button = (name) => page.getByRole("button", { name, exact: true });
  try {
    await page.goto(base);
    await button("Попробовать без входа").waitFor();
    // The emulator adds its own persistent overlay above all application controls.
    await page.addStyleTag({ content: ".firebase-emulator-warning { display: none !important; }" });
    await page.evaluate(async () => { await document.fonts.ready; });
    assert.match(await page.locator("#welcome-title").evaluate(h => getComputedStyle(h).fontFamily), /PT Serif/);
    await inspect("welcome");
    await button("Включить подсветку слов").click();
    await page.waitForFunction(() => document.querySelector(".sample-word-current")?.textContent === "старик");
    await button("Приостановить подсветку").click();
    await button("Попробовать без входа").click();
    await page.getByText("Добавь свой первый профиль", { exact: false }).waitFor({ timeout: 65000 });
    await button("Новый профиль").click();
    const dialog = page.getByRole("dialog", { name: "Новый профиль" });
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Новый профиль");
    await button("Новый профиль").click();
    await page.getByLabel("Имя ребёнка").fill("Ару");
    await button("Лиса").click();
    assert.equal(await dialog.locator(".companion-choices img").count(), 10);
    await inspect("avatars");
    await button("Создать профиль").click();
    const profile = page.getByRole("button", { name: /Ару.*7 лет/ });
    await profile.waitFor({ timeout: 65000 });
    await inspect("profiles");

    await button("Родителям").click();
    await page.getByRole("heading", { name: "Придумайте код" }).waitFor();
    assert.equal(await page.getByText("Книг прочитано", { exact: true }).count(), 0);
    await page.goBack();
    await profile.click();
    const shelf = page.locator('[data-book-id="turnip"] button').first();
    await shelf.waitFor();
    const profileId = new URL(page.url()).searchParams.get("profile");
    await seedHistory(profileId);
    await button("Читатели").click();
    const sibling = page.getByRole("button", { name: /Дана.*7 лет/ });
    await sibling.waitFor();
    assert.notEqual(await profile.locator("img").getAttribute("src"), await sibling.locator("img").getAttribute("src"));
    await page.locator(".profile-grid").evaluate(el => el.scrollIntoView({ block: "center" }));
    await inspect("siblings");
    await button("Новый профиль").click();
    const suggested = dialog.locator(".companion-choices button[aria-pressed=true] img");
    const existingPortraits = await page.locator(".reader-ticket img").evaluateAll(items => items.map(img => img.src));
    assert.ok(!existingPortraits.includes(await suggested.evaluate(img => img.src)));
    assert.equal(await dialog.getByRole("button", { name: "Лиса" }).isDisabled(), true);
    await inspect("family-animals");
    await page.keyboard.press("Escape");
    await sibling.click();
    await page.locator('.library-reader img[alt="Лев"]').waitFor();
    await button("Читатели").click();
    await profile.click();
    const cover = id => page.locator(`[data-book-id="${profileId}-${id}"] .book-jacket img`);
    await cover("atlas").waitFor();
    assert.equal(await cover("atlas").locator("..").getAttribute("data-art"), "atlas-desk");
    assert.equal(await cover("notes").locator("..").getAttribute("data-art"), "reading-desk");
    await cover("photo").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-book-id$="-photo"] .book-jacket img')?.src.endsWith("/icon-180.png"));
    await cover("atlas").evaluate(img => img.decode());
    await page.locator(".shelf-books").evaluate(el => el.scrollIntoView({ block: "start" }));
    await inspect("jackets");
    await page.getByRole("group", { name: "Возраст читателя" }).getByRole("button", { name: "10–12 лет" }).click();
    await page.locator(".jacket-preview img").first().evaluate(img => img.decode());
    await button("Показать все").click();
    const progress = page.getByRole("dialog", { name: "Мои успехи" });
    await button("Успехи").click();
    await progress.waitFor();
    await progress.locator(".achievement-badge").last().waitFor();
    assert.equal(await progress.locator(".achievement-badge").count(), 8);
    await progress.locator(".reading-metric").last().waitFor();
    await inspect("progress");
    await progress.locator(".achievement-badge").last().scrollIntoViewIfNeeded();
    const closeBox = await progress.getByRole("button", { name: "Закрыть" }).boundingBox();
    assert.ok(closeBox && closeBox.y >= 0 && closeBox.height >= 44, "The close button stays within reach while browsing awards");
    await inspect("awards");
    await button("Закрыть").click();
    await progress.waitFor({ state: "hidden" });
    await button("Добавить свою книгу").click();
    const upload = page.getByRole("dialog", { name: "Добавить свою книгу" });
    await upload.getByRole("button", { name: "Ракета", exact: true }).click();
    assert.equal(await upload.getByRole("button", { name: "Ракета" }).getAttribute("aria-pressed"), "true");
    await upload.locator('.cover-composer > .book-jacket[data-art="rocket-garden"] img').evaluate(img => img.decode());
    await page.keyboard.press("Escape");
    await upload.waitFor({ state: "hidden" });
    await button("Подобрать книгу").first().click();
    const guide = page.getByRole("dialog", { name: "Книжный помощник" });
    await guide.getByRole("button", { name: "Животные" }).click();
    await guide.getByRole("button", { name: "Дальше" }).click();
    await guide.getByRole("button", { name: "Назад" }).click();
    await guide.getByRole("button", { name: "Дальше" }).click();
    await guide.getByRole("button", { name: /Обычную/ }).click();
    await guide.getByRole("button", { name: "Дальше" }).click();
    await guide.getByRole("button", { name: /Как обычно/ }).click();
    await guide.getByRole("button", { name: "Дальше" }).click();
    await guide.getByRole("button", { name: "Подобрать книгу" }).click();
    await guide.locator("button .book-jacket img").first().evaluate(img => img.decode());
    await guide.getByRole("button", { name: "Поискать в интернете" }).click();
    await guide.getByText("Карта путешественника", { exact: true }).waitFor();
    await guide.locator('[data-art="teremok"] img').evaluate(img => img.decode());
    await page.keyboard.press("Escape");
    await guide.waitFor({ state: "hidden" });
    for (const [activity, label] of [["Математика", "math"], ["Матч", "arena"]]) {
      await button("Занятия").click();
      await button(activity).click();
      await page.getByRole("heading", { name: activity, exact: true }).waitFor();
      await inspect(label);
      if (label === "math") {
        await page.locator(".task-list button").first().click();
        const task = page.getByRole("dialog", { name: "Задача" });
        await task.waitFor();
        await page.keyboard.press("Escape");
        await task.waitFor({ state: "hidden" });
      }
      await button("Назад").click();
      await shelf.waitFor();
    }
    await button("Включить тёмную тему").click();
    await inspect("library-dark");
    await shelf.scrollIntoViewIfNeeded();
    await inspect("shelf");
    const lang = page.getByRole("group", { name: "Язык книг" });
    await lang.getByRole("button", { name: /Қазақ/ }).click();
    await page.locator('[data-book-id="hare"]').waitFor();
    await lang.getByRole("button", { name: /Русский/ }).click();
    await shelf.waitFor();
    await button("Занятия").click();
    await page.getByRole("dialog", { name: "Занятия и награды" }).waitFor();
    await button("Герои").click();
    await page.getByRole("dialog", { name: "Магазин героев" }).waitFor();
    await button("Сова").click();
    await page.waitForFunction(() => document.querySelector('.hero-owner img')?.alt === "Сова");
    await button("Закрыть").first().click();
    await page.locator('.library-reader img[alt="Сова"]').waitFor();
    await shelf.click();
    await page.locator(".karaoke-word").first().waitFor();
    await page.locator(".story-bookplate img").evaluate(img => img.decode());
    const text = page.locator(".reading-canvas p").first();
    const initial = await text.evaluate(p => parseFloat(getComputedStyle(p).fontSize));
    await button("Больше").click();
    assert.equal(await text.evaluate(p => parseFloat(getComputedStyle(p).fontSize)), initial + 2);
    await button("Включить светлую тему").click();
    await page.getByText("Герой выбран", { exact: true }).waitFor({ state: "hidden" });
    await inspect("reader");
    await button("Назад").click();
    await shelf.waitFor();
    await lang.getByRole("button", { name: /English/ }).click();
    await page.locator('[data-book-id="bruno"] .shelf-choice').click();
    const resume = page.getByRole("dialog", { name: "Продолжить чтение?" });
    await resume.locator('[data-art="bruno-library"] img').evaluate(img => img.decode());
    await resume.getByRole("button", { name: "Продолжить", exact: true }).click();
    const scene = page.locator('.reader-illustration[data-art="bruno-discovery"] img');
    await scene.evaluate(img => img.decode());
    const meter = page.getByRole("progressbar", { name: "Прочитано" });
    await page.waitForFunction(expected => document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow") === String(expected), savedPercent);
    assert.match(await meter.getAttribute("aria-valuetext"), /страница 3 из 6/);
    assert.equal(await text.evaluate(p => parseFloat(getComputedStyle(p).fontSize)), initial + 2);
    const fontOK = await page.evaluate(async () => {
      const text = document.querySelector(".reading-canvas p");
      const fonts = await document.fonts.load('20px "Source Sans 3 Variable"', "Бруно Қоян English");
      return fonts.length > 0 && getComputedStyle(text).fontFamily.includes("Source Sans 3");
    });
    assert.equal(fontOK, true);
    await inspect("bruno");
    await button("Включить тёмную тему").click();
    await inspect("bruno-night");
    if (screen.label === "iphone" || screen.label === "compact") {
      await scene.evaluate(img => img.scrollIntoView({ block: "center" }));
      const bounds = await scene.boundingBox();
      const dock = await page.locator(".reader-controls").boundingBox();
      assert.ok(bounds.y + bounds.height <= dock.y + 1, "The whole illustration can be viewed above the controls");
      await inspect("bruno-illustration");
    }
    for (let size = initial + 2; size > 16; size -= 2) await button("Меньше").click();
    assert.equal(await button("Меньше").isDisabled(), true);
    assert.ok((await button("Больше").boundingBox()).height >= 44);
    for (let size = 16; size < 30; size += 2) await button("Больше").click();
    assert.equal(await button("Больше").isDisabled(), true);
    await inspect("large-type");
    await button("Включить светлую тему").click();
    await button("Назад").click();
    await shelf.waitFor();
    await button("Читатели").click();
    await button("Родителям").click();
    await page.getByRole("heading", { name: "Придумайте код" }).waitFor();
    for (const digit of "2580") await button(digit).click();
    await page.getByRole("heading", { name: "Повторите код" }).waitFor();
    for (const digit of "2580") await button(digit).click();
    await page.getByText("Книг прочитано", { exact: true }).waitFor();
    await page.locator('img.companion-portrait[alt="Сова"]').waitFor();
    const metrics = page.locator(".report-overview .reading-metric");
    assert.deepEqual(await metrics.locator("img").evaluateAll(imgs => imgs.map(img => img.dataset.object)), ["book", "watch", "pace", "coins"]);
    await metrics.last().scrollIntoViewIfNeeded();
    await inspect("report");
    await page.locator(".achievement-badge").first().waitFor();
    await button("Включить тёмную тему").click();
    await inspect("report-dark");
    assert.deepEqual(errors, []);
    console.log(screen.label + " passed the reading flow");
  } catch (error) {
    console.error(screen.label, new URL(page.url()).pathname, (await page.locator("body").innerText()).slice(-1400), errors, network.slice(-15));
    await page.screenshot({ path: `${output}/${screen.label}-failure.png`, scale: "css" });
    throw error;
  } finally {
    await browser.close();
  }
}

try {
  const outcomes = await Promise.allSettled(cases.map(check));
  const failures = outcomes.flatMap((result, i) => {
    if (result.status === "fulfilled") return [];
    console.error(result.reason);
    return [cases[i].label];
  });
  assert.deepEqual(failures, []);
} finally {
  server.httpServer.closeAllConnections();
  await new Promise(resolve => server.httpServer.close(resolve));
  await db.terminate();
}
