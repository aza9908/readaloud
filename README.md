# 📖 ReadAloud — Firebase Edition

Геймифицированное приложение для детей 6–10 лет, обучающее чтению вслух.
«Чтение-караоке»: слова подсвечиваются в реальном времени по мере того, как
ребёнок читает, распознавание речи — через браузерный Web Speech API.

Полная миграция с Replit (Express + PostgreSQL + Replit Auth) на
**Firebase-native** стек — без сервера вообще.

## Стек

| Слой | Было (Replit) | Стало (Firebase) |
|------|---------------|------------------|
| Frontend | React 18 + Vite | React 18 + Vite (без изменений) |
| Auth | Replit Auth (OIDC) | **Firebase Auth (Google)** |
| Backend | Express.js + API routes | **Нет — клиент → Firestore напрямую** |
| БД | PostgreSQL + Drizzle | **Cloud Firestore + Security Rules** |
| Изоляция данных | isAuthenticated middleware | **firestore.rules** (`request.auth.uid`) |
| Хостинг | Replit Deployments | **Firebase Hosting** |
| Речь | Web Speech API | Web Speech API (без изменений) |

Плюс — переписанный движок чтения (`useSpeechReader`): подсветка слов идёт
напрямую в DOM без React-рендеров, поэтому лагов при чтении больше нет
(0 ре-рендеров на слово; синхронизация состояния — 1 раз в секунду).

## Модель данных Firestore

```
users/{uid}                                  — аккаунт родителя
users/{uid}/profiles/{pid}                   — профиль ребёнка + агрегаты статистики
users/{uid}/profiles/{pid}/sessions/{sid}    — сессии чтения
users/{uid}/profiles/{pid}/achievements/{id} — полученные значки
books/{bookId}                               — книги; страницы встроены как pages: string[]
                                               ownerId=null → системные (видны всем)
                                               ownerId=uid  → свои книги (видны только семье)
```

## Быстрый старт

Локальный симулятор Bookser в WhatsApp поддерживает казахский и русский языки. Для пробного чтения доступны учебные расшифровки и вымышленные профили. [Запуск симулятора и подключение Meta](whatsapp/README.md)

### 1. Firebase-проект

1. [console.firebase.google.com](https://console.firebase.google.com) → Add project
2. **Authentication** → Sign-in method → включить **Google**
3. **Firestore Database** → Create database (production mode, регион `europe-west1` или ближайший)
4. Project settings → Your apps → **Web app** → скопировать config

### 2. Локальная настройка

```bash
git clone <this-repo> && cd readaloud
npm install
cp .env.example .env        # вставить значения из шага 1.4
```

В `.firebaserc` заменить `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` на ID проекта.

### 3. Правила и индексы

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore   # rules + indexes
```

### 4. Книги

**Вариант А — перенести книги из Replit** (рекомендуется):

```bash
# DATABASE_URL — из Replit → Tools → Secrets
DATABASE_URL="postgresql://..." npm run export:postgres
# → seed/books.exported.json
```

**Вариант Б — начать с примеров** (3 книги: 🇷🇺 Репка, 🇰🇿 Батыл қоян, 🇬🇧 The Little Cloud) — уже в `seed/books.sample.json`.

Затем залить в Firestore (нужен service account: Project settings →
Service accounts → Generate new private key → сохранить как
`serviceAccountKey.json` в корне; он в .gitignore):

```bash
npm run seed                              # примеры
npm run seed seed/books.exported.json     # ваши книги из Replit
```

Скрипт идемпотентен (id = `system-{lang}-{slug}`) — можно запускать повторно.

### 5. Запуск и деплой

```bash
npm run dev        # http://localhost:5173
npm run deploy     # build + firebase deploy → https://<project>.web.app
```

## Функциональность (соответствие PRD)

- ✅ Google-вход, несколько детских профилей, изоляция семей (AUTH-01…04)
- ✅ Библиотека RU/KK/EN, прогресс по книгам, «Мой прогресс» (LIB-01…05)
- ✅ Караоке-чтение, учительский блок, автостраницы, пропуск, пауза,
  «Стоп, продолжу позже», диалог продолжения, автосейв 15 с, прогресс+WPM
  (READ-01…11)
- ✅ Алгоритм распознавания MATCH-01…07 (нормализация, точное совпадение,
  префикс ≥75 %, Левенштейн ≤1, дефисы, каскад 70 мс)
- ✅ Фейерверк, toast-награды, 8 значков (GAME-01…10)
- ✅ Родительский дашборд: агрегаты, WPM, разбивка по языкам,
  история с фильтром, активность за неделю (DASH-01…07)
- ✅ Тёмная/светлая тема, регулировка шрифта
- ✅ **Новое: свои книги** — родитель вставляет текст или .txt, автоматическая
  разбивка на страницы (~45 слов), emoji-обложка, удаление (LIB-06…09)

## Пуш в GitHub

```bash
git init
git add .
git commit -m "ReadAloud v2.0 — Firebase migration + performance fix + custom books"
git branch -M main
git remote add origin git@github.com:aza9908/readaloud.git
git push -u origin main
```

`.env`, `serviceAccountKey.json` и `seed/books.exported.json` уже в
`.gitignore` — секреты и контент в репозиторий не попадут.

## Замечания

- **Браузеры**: Chrome / Edge (Web Speech API). Safari/Firefox получают
  предупреждение с рекомендацией Chrome (PRD §9).
- **Стоимость**: Firestore Spark (free) хватает с запасом — книга читается
  1 документом, автосейв — 1 запись / 15 с.
- **Казахский язык**: распознавание `kk-KZ` зависит от движка Google в
  Chrome; fuzzy-алгоритм (префикс + Левенштейн) компенсирует неточности.
  Если качество окажется недостаточным — план Б: серверный STT (Yandex
  SpeechKit / Google STT) через Cloud Run, но начинать стоит без него.

## CI/CD — деплой через GitHub

Каждый push в `main` автоматически: `npm ci` → typecheck + build → деплой
Hosting + Firestore rules/indexes (`.github/workflows/deploy.yml`).
Книги заливаются вручную из вкладки **Actions → Seed books into Firestore →
Run workflow** (выбор файла: sample или exported).

Необходимые **GitHub Secrets** (Settings → Secrets and variables → Actions):

| Secret | Откуда |
|--------|--------|
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` (все 6) | Firebase Console → Project settings → Your apps → Web |
| `FIREBASE_SERVICE_ACCOUNT` | Project settings → Service accounts → Generate new private key → вставить **весь JSON** |

После добавления секретов: Actions → Deploy to Firebase → Run workflow →
сайт живёт на `https://<project-id>.web.app`.

## AI-функции

Три функции работают через Cloud Functions (`functions/index.js`), а если они
не задеплоены — автоматически переключаются на офлайн-эвристику, поэтому
приложение работает всегда.

| Функция | Где в UI | Офлайн-запасной вариант |
|---------|----------|--------------------------|
| **Вопросы по книге** | после завершения книги | вопросы строятся из предложений самой книги |
| **Пересказ** | каждые 3 страницы | оценка по совпадению ключевых слов |
| **Подбор книги** | кнопка «Подобрать книгу» в библиотеке | скоринг по возрасту, длине, новизне, вкусу |

### Включить настоящий AI

Требуется тарифный план **Blaze** (Cloud Functions недоступны на Spark):

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY   # вставить ключ
firebase deploy --only functions --project readai-4f87b
```

CI деплоит функции автоматически (шаг помечен `continue-on-error`, поэтому
без Blaze сайт всё равно выкатывается).

## Вход через Google — чек-лист

Если кнопка не работает, проверьте в Firebase Console → Authentication:

1. **Sign-in method → Google** — включён, указан support email
2. **Sign-in method → Anonymous** — включён (для гостевого входа)
3. **Settings → Authorized domains** — есть `readai-4f87b.web.app`

Приложение теперь показывает точную причину ошибки прямо на экране входа
(например «Домен … не разрешён»), а также корректно обрабатывает
redirect-вход через `getRedirectResult` (раньше это был реальный баг: после
возврата с редиректа ничего не происходило).

## Поиск и создание книг

Если в библиотеке нет подходящей книги, помощник предлагает два пути.

**1. Найти в интернете.** Поиск идёт по [Викитеке](https://ru.wikisource.org)
(и её казахской/английской версиям) — это тексты в общественном достоянии,
поэтому их можно законно добавлять в библиотеку. Произвольные сайты
намеренно НЕ парсятся: это затянуло бы в приложение книги под копирайтом.

Найденный текст очищается от вики-разметки и сносок, затем адаптируется:
- с Cloud Functions — Claude пересказывает текст под возраст ребёнка;
- офлайн — текст обрезается по абзацам до объёма, посильного для возраста
  (≈185 слов в 6 лет, ≈365 в 10), и разбивается на страницы.

**2. Придумать сказку.** Оригинальная история по выбранным темам:
- с Cloud Functions — Claude пишет её целиком;
- офлайн — генератор собирает сказку из сценарных шаблонов с учётом темы,
  возраста и (в русском) грамматического рода героя.

Обе книги сохраняются в библиотеку ребёнка (`ownerId = uid`), с пометкой
происхождения и ссылкой на источник.

### Темы

14 тем в каждом языке (животные, волшебство, приключения, смешное, дружба,
герои, природа, космос, море, школа, спорт, еда, загадки, семья) плюс поле
«своя тема» — ребёнок может ввести что угодно, и это учитывается и при
подборе, и при поиске, и при генерации.

## Загрузка файлов и картинки

**Форматы:** PDF, EPUB, TXT/MD. Всё разбирается прямо в браузере
(`src/lib/fileImport.ts`), ничего не отправляется на сервер. PDF читается
через pdf.js с восстановлением строк по координатам и склейкой переносов;
библиотека грузится лениво, только когда пользователь выбрал PDF.
Скан без текстового слоя распознать нельзя — приложение честно об этом
сообщает и предлагает вставить текст вручную.

**Иллюстрации.** Книги, найденные в Викитеке, приходят вместе со своими
иллюстрациями (`generator=images`); сгенерированные сказки иллюстрируются
свободными изображениями с Wikimedia Commons по теме. Картинки
распределяются по страницам равномерно (`distributeImages`) и показываются
во время чтения над текстом. Битые ссылки просто не отображаются.

## Разнообразие сгенерированных сказок

Генератор собирает историю из 6 сюжетных схем × пулов героев, друзей, мест,
проблем, помощников и «сокровищ» для каждой из 14 тем. Пространство
комбинаций — около 3,3 млн, поэтому повторы практически невозможны.
В русском языке соблюдается род героя (глаголы и прилагательные согласуются).
