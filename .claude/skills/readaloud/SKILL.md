---
name: readaloud
description: Work on the ReadAloud children's read-aloud app (React + Vite + Firebase, RU/KK/EN karaoke reading for ages 6-10). Use when the task touches this repo — reading engine, speech recognition, karaoke highlighting, book library, custom uploads, Wikisource import, story generation, coins, quizzes, retelling, Firestore rules, or the GitHub Actions deploy to Firebase Hosting.
---

# ReadAloud

Gamified web app teaching children 6–10 to read aloud. Words highlight in real
time as the child speaks (Web Speech API). Russian, Kazakh, English.

Live: `https://readai-4f87b.web.app` · Repo: `aza9908/readaloud` · Project: `readai-4f87b`

## Architecture — read this before changing anything

**There is no backend server.** The client talks to Firestore directly;
`firestore.rules` is the security boundary, not middleware. Cloud Functions
exist only for optional AI and require the Blaze plan.

```
src/hooks/useSpeechReader.ts   ← reading engine. Performance-critical.
src/lib/firestore.ts           ← all data access (replaces the old Express API)
src/lib/ai.ts                  ← AI calls + offline fallbacks
src/lib/storyGen.ts            ← offline story generator
src/lib/bookSources.ts         ← Wikisource search/fetch + images
functions/index.js             ← optional Cloud Functions (Blaze only)
firestore.rules                ← per-family data isolation
```

Firestore model:
```
users/{uid}/profiles/{pid}/sessions|achievements
books/{bookId}   ownerId=null → shared, ownerId=uid → that family only
                 pages: string[]  (embedded — one read loads a whole book)
```

## Invariants — violating these has caused real bugs

1. **Never call setState per speech event.** `onresult` fires 5–15×/sec.
   Highlighting toggles CSS classes directly on word `<span>`s; React state
   syncs on a 1-second tick. Breaking this reintroduces the reading lag.
2. **Exactly one word may hold `word-current`.** `useSpeechReader` tracks the
   cursor element and releases it explicitly, and cancels stale cascade
   timers on each advance. Skipping this produced the "two cursors" bug.
3. **`ReadingSurface` and `KaraokeText` are memoized on `words` identity.**
   Derive `words`/`paragraphSizes` in a `useMemo` keyed on page content, or
   the per-second tick re-renders the whole reading surface.
4. **Every AI feature needs an offline fallback.** Cloud Functions require
   Blaze; the app must work without them. See `ai.ts` — each function tries
   the callable, then falls back to a local heuristic.
5. **Only import public-domain text.** Wikisource only. Do not add general
   web scraping — it would pull copyrighted books into the product.
6. **Generated stories draw problem/helper/reward as one bound `Scenario`.**
   Drawing them from independent pools produces incoherent stories.
7. **Russian output must respect grammatical gender.** Heroes carry
   `gender: "m" | "f"`; verbs and adjectives agree.

## Deploy

Push to `main` → GitHub Actions builds and deploys Hosting + Firestore rules.
Functions deploy is `continue-on-error` (needs Blaze + `ANTHROPIC_API_KEY`).

Required secret: `FIREBASE_SERVICE_ACCOUNT` (full service-account JSON).
The workflow validates it and fails with an explicit message if malformed.

A build stamp renders at the bottom of the login screen — use it to confirm
which build is live before debugging "my change didn't appear" (it is almost
always browser cache; hard-refresh).

## Verifying work

```bash
npm ci && npx tsc --noEmit && npm run build
```
- React DevTools Profiler: `KaraokeText` must show **0 renders** while reading.
- Reading a fast sentence must leave exactly one highlighted word.
- Test with an empty library — several bugs came from components assuming
  books exist (the guide silently no-oped when `books.length === 0`).

## Known constraints

- `kk-KZ` speech recognition quality depends on Chrome's engine; the fuzzy
  matcher (prefix ≥75% + Levenshtein ≤1) compensates.
- Scanned PDFs without a text layer cannot be imported; say so explicitly.
- Firebase console settings (auth providers, authorized domains, IAM roles)
  cannot be changed from code — surface precise, actionable errors instead.
