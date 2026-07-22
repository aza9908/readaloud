/**
 * fileImport.ts — turns an uploaded file into readable text.
 *
 * Supported: .pdf (pdf.js), .epub (zip + XHTML), .txt / .md.
 * Everything runs in the browser — no upload to any server.
 */

/**
 * pdf.js is ~380 KB, so it is loaded only when someone actually picks a PDF.
 * Everyone else never downloads it.
 */
async function loadPdfjs() {
  const [pdfjsLib, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjsLib;
}

export interface ImportedFile {
  text: string;
  suggestedTitle: string;
  pageCount?: number;
}

const MAX_PDF_PAGES = 60;

/** Re-joins hyphenated line breaks and collapses PDF line noise into paragraphs. */
function tidyExtractedText(raw: string): string {
  return raw
    .replace(/-\n(\p{Ll})/gu, "$1")     // wrap-hyphenation: "при-\nключение"
    .replace(/([^\n])\n(?!\n)/g, "$1 ") // single newline = soft wrap
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\f/g, "\n\n")
    .trim();
}

async function importPdf(file: File): Promise<ImportedFile> {
  const pdfjsLib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
  const chunks: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines using the y-coordinate so sentences don't run together.
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trim());
        line = "";
      }
      line += item.str + " ";
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    chunks.push(lines.join("\n"));
    page.cleanup();
  }

  return {
    text: tidyExtractedText(chunks.join("\n\n")),
    suggestedTitle: file.name.replace(/\.pdf$/i, ""),
    pageCount: doc.numPages,
  };
}

/** Minimal EPUB reader: unzip, read XHTML in spine order, strip tags. */
async function importEpub(file: File): Promise<ImportedFile> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = unzipSync(buf);

  const htmlNames = Object.keys(files)
    .filter((n) => /\.x?html?$/i.test(n))
    .sort();

  const texts = htmlNames.slice(0, 40).map((n) => {
    const html = strFromU8(files[n]);
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&laquo;/g, "«")
      .replace(/&raquo;/g, "»");
  });

  return {
    text: tidyExtractedText(texts.join("\n\n")),
    suggestedTitle: file.name.replace(/\.epub$/i, ""),
  };
}

export async function importFile(file: File): Promise<ImportedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return importPdf(file);
  if (name.endsWith(".epub")) return importEpub(file);
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = await file.text();
    return {
      text: tidyExtractedText(text),
      suggestedTitle: file.name.replace(/\.(txt|md)$/i, ""),
    };
  }
  throw new Error("UNSUPPORTED");
}

export const ACCEPTED_FILE_TYPES = ".pdf,.epub,.txt,.md,text/plain,application/pdf";
