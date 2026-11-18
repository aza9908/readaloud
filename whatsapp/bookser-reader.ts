// The CLI and standalone demo both use the web reader's actual implementation.
export { ReadingAligner, normalizeWrittenWord, matchStrength, wordsPerMinute } from "../src/lib/alignment";
export { bandForText, BAND_HINT } from "../src/lib/readingLevel";
export * as pinGate from "../src/lib/parentGate";
