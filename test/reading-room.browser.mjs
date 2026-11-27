import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
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
const books = [
  { id: "turnip", title: "Репка", coverEmoji: "🌱", language: "ru", pages: ["Посадил дед репку. Выросла репка большая, пребольшая."] },
  { id: "hare", title: "Батыл қоян", coverEmoji: "🐇", language: "kk", pages: ["Қоян үйіне келді. Ол кітап оқыды."] },
  { id: "boat", title: "Бумажный кораблик", coverEmoji: "⛵", language: "ru", pages: ["По реке плыл маленький бумажный кораблик. На берегу стояла девочка."] },
];
for (const { id, ...book } of books) {
  await db.doc("books/" + id).set({ ownerId: null, isCustom: false, band: "6-7", coverUrl: null, totalWords: book.pages[0].split(" ").length, ...book });
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
  const now = Date.now();
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
  headers: { "Content-Security-Policy": "connect-src 'self' http://127.0.0.1:* http://localhost:*; frame-src 'self' http://127.0.0.1:* http://localhost:*" },
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
    await profile.click();
    const cover = id => page.locator(`[data-book-id="${profileId}-${id}"] .book-jacket img`);
    await cover("atlas").waitFor();
    assert.equal(await cover("atlas").getAttribute("data-object"), "globe");
    assert.equal(await cover("notes").getAttribute("data-object"), "book");
    await cover("atlas").evaluate(img => img.decode());
    await cover("atlas").scrollIntoViewIfNeeded();
    await inspect("jackets");
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
    await page.keyboard.press("Escape");
    await upload.waitFor({ state: "hidden" });
    await button("Подобрать книгу").first().click();
    const guide = page.getByRole("dialog", { name: "Книжный помощник" });
    await guide.getByRole("button", { name: "Животные" }).click();
    await guide.getByRole("button", { name: "Дальше" }).click();
    await guide.getByRole("button", { name: "Назад" }).click();
    await guide.getByRole("button", { name: "Животные" }).waitFor();
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
    await inspect("reader");
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
