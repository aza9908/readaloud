// The highlighter splits paragraphs and words on whitespace. These offsets use the same boundaries.
export function pageWordOffsets(pages: string[]) {
  const offsets = [0];
  for (const page of pages) {
    offsets.push(offsets[offsets.length - 1] + (page.match(/\S+/g)?.length ?? 0));
  }
  return offsets;
}

export function positionPercent(offsets: number[], page = 0, word = 0) {
  const total = offsets[offsets.length - 1];
  if (!total) return 0;
  const index = Math.max(0, Math.min(page, offsets.length - 2));
  const position = Math.min(offsets[index + 1], offsets[index] + Math.max(0, word));
  return position >= total ? 100 : Math.min(99, Math.round(100 * position / total));
}
