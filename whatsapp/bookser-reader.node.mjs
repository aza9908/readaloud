import { tsImport } from "tsx/esm/api";

// Node 20 needs a TypeScript loader. Scope it to this import; esbuild resolves
// the TypeScript entry directly when bundling the standalone browser demo.
export const { ReadingAligner, normalizeWrittenWord, matchStrength, wordsPerMinute, bandForText, BAND_HINT, pinGate } =
  await tsImport("./bookser-reader.ts", import.meta.url);
