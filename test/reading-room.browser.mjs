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
  { id: "fox", title: "Лиса и журавль", coverEmoji: "🦊", language: "ru", pages: ["Лиса позвала журавля в гости. Они сели у окна и стали читать книгу."] },
  { id: "hare", title: "Батыл қоян", coverEmoji: "🐇", language: "kk", pages: ["Қоян үйіне келді. Ол кітап оқыды."] },
  { id: "boat", title: "Бумажный кораблик", coverEmoji: "⛵", language: "ru", pages: ["По реке плыл маленький бумажный кораблик. На берегу стояла девочка."] },
];
for (const { id, ...book } of books) {
  await db.doc("books/" + id).set({ ownerId: null, isCustom: false, band: "6-7", coverUrl: null, totalWords: book.pages[0].split(" ").length, ...book });
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
  page.setDefaultTimeout(15000);
  const errors = [];
  const network = [];
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
    await button("Новый профиль").click();
    const dialog = page.getByRole("dialog", { name: "Новый профиль" });
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.ok(await button("Новый профиль").evaluate(el => el === document.activeElement), "Profile sheet returns focus");
    await button("Новый профиль").click();
    await page.getByLabel("Имя ребёнка").fill("Ару");
    await button("Лиса").click();
    await button("Создать профиль").click();
    const profile = page.getByRole("button", { name: /Ару.*7 лет/ });
    await profile.waitFor();
    await inspect("profiles");

    await button("Родителям").click();
    await page.getByRole("heading", { name: "Придумайте код" }).waitFor();
    assert.equal(await page.getByText("Книг прочитано", { exact: true }).count(), 0);
    await page.goBack();
    await profile.click();
    const shelf = page.locator('[data-book-id="fox"] button').first();
    await shelf.waitFor();
    await button("Включить тёмную тему").click();
    await inspect("library-dark");
    const lang = page.getByRole("group", { name: "Язык книг" });
    await lang.getByRole("button", { name: /Қазақ/ }).click();
    await page.locator('[data-book-id="hare"]').waitFor();
    await lang.getByRole("button", { name: /Русский/ }).click();
    await shelf.waitFor();
    await button("Занятия").click();
    await page.getByRole("dialog", { name: "Занятия и награды" }).waitFor();
    await button("Герои").click();
    await page.getByText("Магазин героев", { exact: true }).waitFor();
    await button("Закрыть").first().click();
    await shelf.click();
    await page.locator(".karaoke-word").first().waitFor();
    const text = page.locator(".reading-canvas p").first();
    const initial = await text.evaluate(p => parseFloat(getComputedStyle(p).fontSize));
    await button("Больше").click();
    assert.equal(await text.evaluate(p => parseFloat(getComputedStyle(p).fontSize)), initial + 2);
    await button("Включить светлую тему").click();
    await inspect("reader");
    await button("Назад").click();
    await shelf.waitFor();
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
  const failures = [];
  for (const screen of cases) {
    try { await check(screen); }
    catch (error) { console.error(error); failures.push(screen.label); }
  }
  assert.deepEqual(failures, []);
} finally {
  server.httpServer.closeAllConnections();
  await new Promise(resolve => server.httpServer.close(resolve));
  await db.terminate();
}
