import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSimulator } from "../whatsapp/build-simulator.mjs";

// The published demo contains fictional books and runs entirely in the browser.
// Only its icons and install manifest are loaded as separate files.
const out = process.argv[2];
if (!out) throw new Error("Usage: node scripts/export-safari-preview.mjs <output-directory>");
const icons = [180, 192, 512];
const policy = [
  "default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'",
  "img-src 'self' data:", "manifest-src 'self'", "connect-src 'none'",
  "base-uri 'none'", "form-action 'none'",
].join("; ");
const head = [
  '<meta http-equiv="Content-Security-Policy" content="' + policy + '">',
  '<meta name="referrer" content="no-referrer">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Bookser">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<link rel="apple-touch-icon" href="./icon-180.png">',
  '<link rel="manifest" href="./manifest.webmanifest">',
].join("\n");
const html = (await buildSimulator("offline")).replace("<head>", () => "<head>\n" + head);
const manifest = {
  name: "Bookser Reading Room", short_name: "Bookser", id: "./", start_url: "./", scope: "./",
  display: "standalone", orientation: "any", background_color: "#fbf9f4", theme_color: "#65467b",
  icons: icons.slice(1).map(size => ({ src: "./icon-" + size + ".png", sizes: size + "x" + size, type: "image/png" })),
};
await mkdir(out, { recursive: true });
await Promise.all([
  writeFile(join(out, "index.html"), html),
  writeFile(join(out, ".nojekyll"), ""),
  writeFile(join(out, "manifest.webmanifest"), JSON.stringify(manifest, null, 2) + "\n"),
  ...icons.map(size => {
    const filename = "icon-" + size + ".png";
    return copyFile(new URL("../public/" + filename, import.meta.url), join(out, filename));
  }),
]);
