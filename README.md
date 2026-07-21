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
