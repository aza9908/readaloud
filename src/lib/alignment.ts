/**
 * alignment.ts — aligns what the child actually said to the words on the page.
 *
 * This is the piece that makes karaoke reading feel correct. It is kept pure
 * (no React, no DOM, no Web Speech types) so it can be tested exhaustively.
 *
 * WHY A REWRITE WAS NEEDED — four real defects in the previous approach:
 *
 *  1. It re-processed the tail of the transcript on every event
 *     (`transcript.split(...).slice(-6)`). The same spoken words were matched
 *     again and again, so the cursor ran ahead of the child.
 *  2. After a page turn, that same tail — words spoken on the *previous* page —
 *     was matched against the *new* page, so the cursor jumped before the
 *     child had read anything.
 *  3. A 3-word lookahead let a single spoken word skip up to three page words.
 *  4. The visible "read this word" prompt came from React state that only
 *     synced once per second, so it lagged behind the highlight.
 *
 * THE MODEL
 * Web Speech API in continuous mode reports a growing list of results. Final
 * results never change; the last result may be interim and keeps changing.
 * So the spoken stream is: [all final tokens] + [current interim tokens].
 *
 * We keep a `consumed` counter over that stream. Only tokens beyond `consumed`
 * are ever aligned, and a page turn simply moves `consumed` to the end of the
 * stream — which is exactly what "ignore everything said before this page"
 * means. Tokens are consumed once and never revisited.
 */

// ───────────────────────── Normalisation (MATCH-01) ─────────────────────────

const NON_WORD = /[^\p{L}\p{N}]+/gu;

export function normalizeWord(raw: string): string {
  return raw
    .toLocaleLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’'`]/g, "")
    .replace(NON_WORD, "");
}

/** MATCH-06: a hyphenated word may be read as its parts. */
export function expandHyphens(raw: string): string[] {
  if (raw.includes("-")) {
    const parts = raw.split("-").map(normalizeWord).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  const n = normalizeWord(raw);
  return n ? [n] : [];
}

export function tokenize(text: string): string[] {
  return text.split(/\s+/).map(normalizeWord).filter(Boolean);
}

// ───────────────────────── Similarity ─────────────────────────

/** Levenshtein distance capped at 1 — O(n), all MATCH-05 requires. */
export function withinDistanceOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (la === lb) {
      i++;
      j++;
    } else if (la > lb) {
      i++;
    } else {
      j++;
    }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

export type MatchStrength = "none" | "weak" | "strong";

/**
 * How confidently `spoken` corresponds to `target`.
 *  - strong: exact, or one edit away — safe to act on, including skips
 *  - weak:   a long-enough prefix — accept in place, but never skip on it
 *
 * Short words demand exactness (MATCH-03): "и" vs "в" must not match, or the
 * cursor drifts constantly on Russian and Kazakh text.
 */
export function matchStrength(target: string, spoken: string): MatchStrength {
  if (!target || !spoken) return "none";
  if (target === spoken) return "strong";
  if (target.length <= 2) return "none";
  if (withinDistanceOne(target, spoken)) return "strong";
  if (target.length >= 4) {
    const need = Math.ceil(target.length * 0.75);
    if (spoken.length >= need && (target.startsWith(spoken) || spoken.startsWith(target))) {
      return "weak";
    }
  }
  return "none";
}

/** Best strength across a target's variants (hyphen parts). */
function strengthAgainst(variants: string[], spoken: string): MatchStrength {
  let best: MatchStrength = "none";
  for (const v of variants) {
    const s = matchStrength(v, spoken);
    if (s === "strong") return "strong";
    if (s === "weak") best = "weak";
  }
  return best;
}

// ───────────────────────── The aligner ─────────────────────────

export interface AlignerOptions {
  /**
   * Allow moving past a single word the child skipped or mumbled, but only
   * when the NEXT word matches strongly. Default true.
   */
  allowSingleSkip?: boolean;
  /**
   * After this many consecutive unmatched tokens the aligner enters recovery
   * and searches a wider window to resync. Default 3.
   *
   * Rationale: strict matching alone never runs ahead, but on poor recognition
   * (noisy room, weaker Kazakh models) it can stall — the child keeps reading
   * while the cursor sits still. Recovery trades a little strictness for the
   * ability to catch up, and only engages once the strict path has clearly
   * lost the thread.
   */
  recoveryAfterMisses?: number;
  /** How far ahead recovery may look. Default 6. */
  recoveryWindow?: number;
}

export interface FeedResult {
  /** Cursor position after this batch. */
  index: number;
  /** How many words the cursor moved. */
  advanced: number;
}

export class ReadingAligner {
  /** Normalised variants for each word on the current page. */
  private targets: string[][] = [];
  /** Index of the word the child should read next. */
  private index = 0;
  /** Tokens from results already marked final — these never change. */
  private committed: string[] = [];
  /** Tokens from the current, still-changing interim result. */
  private interim: string[] = [];
  /** How many tokens of (committed + interim) have been aligned already. */
  private consumed = 0;
  private readonly allowSingleSkip: boolean;
  private readonly recoveryAfterMisses: number;
  private readonly recoveryWindow: number;
  /** Consecutive spoken tokens that matched nothing — drives recovery. */
  private misses = 0;

  constructor(opts: AlignerOptions = {}) {
    this.allowSingleSkip = opts.allowSingleSkip ?? true;
    this.recoveryAfterMisses = opts.recoveryAfterMisses ?? 3;
    this.recoveryWindow = opts.recoveryWindow ?? 6;
  }

  /**
   * Load a new page. Everything spoken so far is discarded from alignment —
   * this is the barrier that stops the previous page's speech from advancing
   * the new page (bug 1).
   */
  setPage(words: string[], startIndex = 0): void {
    this.targets = words.map(expandHyphens);
    this.index = Math.max(0, Math.min(startIndex, Math.max(words.length - 1, 0)));
    this.misses = 0;
    this.dropPendingSpeech();
  }

  /** Forget any speech not yet aligned (page turn, resume, manual seek). */
  dropPendingSpeech(): void {
    this.committed = [...this.committed, ...this.interim];
    this.interim = [];
    this.consumed = this.committed.length;
  }

  /** Move the cursor without consuming speech (skip button, restore). */
  seek(index: number): void {
    this.index = Math.max(0, Math.min(index, Math.max(this.targets.length - 1, 0)));
    this.misses = 0;
  }

  get cursor(): number {
    return this.index;
  }

  get pageLength(): number {
    return this.targets.length;
  }

  get isPageComplete(): boolean {
    return this.index >= this.targets.length;
  }

  /**
   * Feed the recogniser's current view of the utterance.
   *
   * @param finalText  concatenated transcript of all results marked final
   * @param interimText transcript of the trailing interim result ("" if none)
   */
  feed(finalText: string, interimText: string): FeedResult {
    const finalTokens = tokenize(finalText);

    // Finals only ever grow. If the recogniser restarts (Chrome does this on
    // its own), the list can shrink — treat that as a fresh stream and keep
    // the consumed pointer within bounds.
    if (finalTokens.length < this.committed.length) {
      this.consumed = Math.min(this.consumed, finalTokens.length);
    }
    this.committed = finalTokens;
    this.interim = tokenize(interimText);

    const stream = this.committed.concat(this.interim);
    if (this.consumed > stream.length) this.consumed = stream.length;

    const fresh = stream.slice(this.consumed);
    if (fresh.length === 0) return { index: this.index, advanced: 0 };

    const before = this.index;

    for (const spoken of fresh) {
      if (this.index >= this.targets.length) break;
      this.consumeToken(spoken);
    }

    // Interim tokens are provisional: the recogniser may revise them, so we
    // only permanently consume what is final. Anything matched from the
    // interim tail stays re-checkable until it is finalised.
    this.consumed = Math.max(this.consumed, this.committed.length);

    return { index: this.index, advanced: this.index - before };
  }

  /**
   * Align one spoken token against the cursor.
   *
   * Normal path is deliberately strict: match the current word, or skip at
   * most one on a strong match. That is what keeps the cursor from running
   * ahead of the child.
   *
   * If several tokens in a row match nothing, the strict path has lost the
   * thread (badly mangled recognition, or the child read on while we stalled).
   * Recovery then searches a wider window so the cursor can catch up instead
   * of freezing until the child presses "skip".
   */
  private consumeToken(spoken: string): void {
    const cur = this.targets[this.index];

    if (strengthAgainst(cur, spoken) !== "none") {
      this.index += 1;
      this.misses = 0;
      return;
    }

    // The child repeated the word just read — very common. Not a miss.
    if (this.index > 0 && strengthAgainst(this.targets[this.index - 1], spoken) === "strong") {
      return;
    }

    // Skipped or mumbled exactly one word.
    if (this.allowSingleSkip && this.index + 1 < this.targets.length) {
      if (strengthAgainst(this.targets[this.index + 1], spoken) === "strong") {
        this.index += 2;
        this.misses = 0;
        return;
      }
    }

    this.misses += 1;

    // ── Recovery ──
    if (this.misses >= this.recoveryAfterMisses) {
      const end = Math.min(this.index + this.recoveryWindow, this.targets.length);
      for (let w = this.index + 2; w < end; w++) {
        if (strengthAgainst(this.targets[w], spoken) === "strong") {
          this.index = w + 1;
          this.misses = 0;
          return;
        }
      }
    }
    // Otherwise hold position — unrecognised noise must not move the cursor.
  }
}
