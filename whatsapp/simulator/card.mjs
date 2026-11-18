const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const COLORS = { correct: "#4a29bf", close: "#80530a", flagged: "#a33234", neutral: "#2a2540" };

/** A self-contained feedback image using the original page's punctuation and word offsets. */
export function feedbackSvg(card, pageLabel) {
  const lines = [[]];
  let width = 0;
  const chunks = card.text.match(/\S+/gu) ?? [];
  let position = 0, markIndex = 0;
  for (const chunk of chunks) {
    const start = card.text.indexOf(chunk, position);
    const end = start + chunk.length;
    if (width && width + 1 + chunk.length > 43) { lines.push([]); width = 0; }
    const fragments = [];
    let cursor = start;
    while (markIndex < card.marks.length && card.marks[markIndex].offset < end) {
      const m = card.marks[markIndex++];
      fragments.push(esc(card.text.slice(cursor, m.offset)));
      const color = m.flag ? COLORS.flagged : COLORS[m.status] ?? COLORS.neutral;
      const emphasis = m.flag ? ' text-decoration="underline"' : m.status === "close" ? ' font-style="italic"' : "";
      fragments.push('<tspan fill="' + color + '"' + emphasis + '>' + esc(m.text) + '</tspan>');
      cursor = m.offset + m.text.length;
    }
    fragments.push(esc(card.text.slice(cursor, end)));
    lines.at(-1).push(fragments.join(""));
    width += (width ? 1 : 0) + chunk.length;
    position = end;
  }
  const h = 121 + lines.length * 31;
  const title = esc(card.title) + " · " + esc(pageLabel) + " " + card.page;
  const lineText = lines.map((line, i) => '<text x="26" y="' + (98 + i * 31) + '">' + line.join(" ") + '</text>').join("");
  return '<svg xmlns="http://www.w3.org/2000/svg" width="580" height="' + h + '" viewBox="0 0 580 ' + h + '" role="img">' +
    '<title>' + title + '</title><rect width="580" height="' + h + '" rx="24" fill="#fffdf8"/>' +
    '<path d="M26 63H554" stroke="#e7e0ff"/><text x="26" y="42" fill="#2a2540" font-family="Baloo 2,system-ui,sans-serif" font-weight="700" font-size="22">' + title + '</text>' +
    '<text x="554" y="42" text-anchor="end" fill="#9b6511" font-size="24">' + "★".repeat(card.stars) + '</text>' +
    '<g xml:space="preserve" fill="' + COLORS.neutral + '" font-size="19" font-family="Nunito,system-ui,sans-serif">' + lineText + '</g></svg>';
}
