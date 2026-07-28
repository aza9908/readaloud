---
name: readaloud
description: Work on the Bookser children's read-aloud app (React + Vite + Firebase, RU/KK/EN karaoke reading for ages 6-10). Use when the task touches this repo — reading engine, speech recognition, karaoke highlighting, book library, custom uploads, Wikisource import, story generation, coins, quizzes, retelling, Firestore rules, or the GitHub Actions deploy to Firebase Hosting.
---

# Bookser (ранее ReadAloud)

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
   The same rule covers artwork: never import third-party game skins or
   character art (Roblox, Minecraft, Disney and the like). Reward characters
   in `src/lib/avatars.ts` are original parametric SVG owned by the project.
6. **Generated stories draw problem/helper/reward as one bound `Scenario`.**
   Drawing them from independent pools produces incoherent stories.
7. **Russian output must respect grammatical gender.** Heroes carry
   `gender: "m" | "f"`; verbs and adjectives agree. Never interpolate a noun
   where the sentence needs a non-nominative case — restructure instead
   (this produced "нашла полная корзина ягод").
8. **Alignment lives in `src/lib/alignment.ts`, not in the hook.** It is pure
   and covered by `npm test`. Never re-scan the transcript tail: tokens are
   consumed once via a `consumed` pointer. A page turn calls `setPage`, which
   drops pending speech — without that, the previous page's words advance the
   new page instantly.
9. **Never skip more than one word, and only on a `strong` match.** A `weak`
   (prefix) match is accepted at the cursor but must never cause a skip.
10. **The reading prompt subscribes to the cursor** (`subscribeCursor`), it
    does not read throttled state — otherwise it lags a second behind.
11. **Strictness and stalling are a trade-off — measure both.** Strict matching
    alone never runs ahead but freezes on poor recognition. `recoveryAfterMisses`
    widens the search only after repeated misses. `node test/accuracy.sim.mjs`
    reports both drift and page-completion; a change that improves one at the
    cost of the other is not an improvement.

## Rewards economy

Coins come from `awardForCompletion` (~50 for a typical book). Hero prices are
set against that: common 160–280 (3–6 books), rare 320–480 (6–10), legendary
800–960 (16–19). Whole collection ≈ 125 books. If the earning rate changes,
rebalance hero prices and the parent-reward presets together, or progression
silently breaks.
15 characters, 7 of them Kazakh-themed; keep the girls/boys/neutral split
roughly even when adding more.

Locked characters render in **colour** with a padlock badge — not greyed out.
Desaturating them killed the motivation to earn them; a child has to see the
prize clearly for it to be a prize.
Purchases run through `purchaseAvatar`, which uses a Firestore transaction —
without it a double tap would deduct coins twice.

`profile.avatar` holds either an emoji or `av:<id>`; always render it through
`<ProfileAvatar>` rather than printing the field directly.

Two separate reward tracks, do not conflate them:
- **Hero shop** (`AvatarShop`): child spends coins instantly on avatars they own.
- **Parent rewards** (`ParentRewardsManager` / `RewardsStore`): the parent adds
  real-world rewards (ice cream, cinema, PS5 time) and prices them in coins.
  The child *requests*; coins are deducted only when the parent approves, via
  `approveRewardRequest` (a transaction — never deduct on request, and never
  outside a transaction, or a double tap double-charges). Rewards and requests
  live at account level (`users/{uid}/rewards`, `users/{uid}/rewardRequests`),
  since one parent sets the list for all their children.

## Architecture critic

`npm test` ends with `test/architecture.test.mjs`, which checks invariants that
have already broken in production here — each rule exists because that exact
bug shipped:

- a component imported but never rendered (the parent rewards panel sat invisible
  in the dashboard; the build stayed silent),
- a rename applied to some pages only,
- a centred header built on `justify-between` (measured 20px off-centre),
- a server secret or a hardcoded RunPod URL reaching the client bundle
  (pod ids change on restart — one already changed mid-integration),
- coins awarded from more than one place, which would bypass the re-read limits.

The rules are deliberately precise rather than broad: an earlier version flagged
every `justify-between` header, including the landing page where the logo is
correctly left-aligned. A critic that cries wolf gets ignored. Validate any new
rule by reintroducing the bug it targets and confirming it fires.

## Kazakh recognition

`normalizeWord` folds Kazakh-specific letters (ә ғ қ ң ө ұ ү һ і) to their
Russian look-alikes on **both** sides of every comparison. This is not cosmetic:
Chrome's kk-KZ recogniser routinely returns Kazakh words spelled with Russian
letters ("бүркітші" comes back as "буркитши"), and 21% of words in real Kazakh
books carry two or more Kazakh letters — more than the one edit `matchStrength`
tolerates. Without folding those words never matched at all and the cursor
froze. Measured in isolation: page completion went 76% → 100% for a child
reading perfectly. Losing the "қар"/"кар" distinction is harmless here — we
match speech against a known page, not disambiguate meaning.

## Reading level & coin economy

Two pure, tested modules own these rules. Do not scatter the logic elsewhere.

**`src/lib/readingLevel.ts`** — a book's age band (`4-5` / `6-7` / `8-9` / `10-12`)
is computed **from its text**, never from `ageMin`/`ageMax` (those are legacy and
hardcoded to 6 nearly everywhere). Syllables-per-word differs systematically by
language (en ~1.6, ru ~2.0, kk ~2.25), so word complexity is measured *relative to
that language's baseline* — otherwise every Kazakh book reads as "hard" purely
from orthography. Very short texts damp the complexity terms: six long words are
still only six words. `bandForBook()` prefers a stored `book.band`, else computes.

**`src/lib/coins.ts`** — the single place deciding coin awards. Rates: 0.25/word
plus a completion bonus that grows with band (8/18/30/45), so a typical book pays
~50 (it paid ~180 before, which let a child buy a real parent reward in under two
books). Four anti-farm rules: re-reads pay 100%/30%/0, below-level books pay 35%,
above-level pay 115%, and a 260/day cap.

**Coins are awarded only on book completion** (`completeSession`, transactional).
Never award per word during reading again — that path let a child re-read pages
and bypass every limit above.

`pickBlockReason()` blocks two below-level books in a row. It is a hard block, not
just reduced pay: a child who finds a profitable loop will use it even for few
coins. Always surface `PICK_BLOCK_MESSAGE` so the block is explained, never silent.

## Retention & parent value

- **Streak** (`StreakBadge` + `updateStreakAndHardWords`): consecutive reading
  days, counted by local date (not UTC). Grows if last read was yesterday,
  holds for same-day, resets on a gap.
- **Weekly report** (`WeeklyReport`): minutes, books, WPM trend, and the words
  the child struggled on. Those come from the aligner: `feed()` returns a
  `struggled` array (a cursor word that took >=3 misses to pass), the hook
  dedupes them, and `updateStreakAndHardWords` banks them in `profile.hardWords`.
  Never fabricate this list — if empty, say there is not enough data yet.

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
