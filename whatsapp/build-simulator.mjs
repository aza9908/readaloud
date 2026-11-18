import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";
import loadConfig from "tailwindcss/loadConfig.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LockKeyhole, Mic, Moon, Send, Sun, UsersRound } from "lucide-react";
import { sampleLibrary } from "./reading.mjs";

const here = path => new URL(path, import.meta.url);
const icons = { moon: Moon, sun: Sun, lock: LockKeyhole, mic: Mic, send: Send, readers: UsersRound };
function bookserTheme() {
  const { colors, borderRadius, boxShadow, fontFamily } = loadConfig(fileURLToPath(here("../tailwind.config.ts"))).theme.extend;
  const variables = {
    brand: colors.brand[500], "brand-strong": colors.brand[700], tint: colors.brand[50], accent: colors.amber[500],
    ink: colors.ink.DEFAULT, muted: colors.paper.muted, canvas: colors.paper.DEFAULT, card: colors.paper.card,
    radius: borderRadius["3xl"], "input-radius": borderRadius.xl, shadow: boxShadow.card, lift: boxShadow.lift,
    display: fontFamily.display.join(","), sans: fontFamily.sans.join(","),
  };
  return ":root{" + Object.entries(variables).map(([name, value]) => "--" + name + ":" + value).join(";") + "}";
}
export async function loadLibrary() {
  return sampleLibrary(JSON.parse(await readFile(here("../seed/books.sample.json"), "utf8")));
}
export async function buildSimulator(transport = "offline", library) {
  const [template, css, portrait, icon, js, books] = await Promise.all([
    readFile(here("simulator/index.html"), "utf8"), readFile(here("simulator/style.css"), "utf8"),
    readFile(here("../src/assets/avatars/page-pal.webp")), readFile(here("../public/icon-180.png")),
    build({ entryPoints: [fileURLToPath(here("simulator/client.mjs"))], bundle: true, write: false,
      format: "iife", target: "es2020", minify: true, legalComments: "none" }),
    library ?? loadLibrary(),
  ]);
  const slots = {
    TRANSPORT: transport === "http" ? "http" : "offline", CSS: bookserTheme() + css,
    PORTRAIT: portrait.toString("base64"), ICON: icon.toString("base64"),
    LIBRARY: JSON.stringify(books).replace(/</g, "\\u003c"),
    BUNDLE: js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
  };
  return template.replace(/<span class="icon (\w+)" aria-hidden="true"><\/span>/g, (_, name) =>
    renderToStaticMarkup(createElement(icons[name], { className: "icon " + name, size: 19, strokeWidth: 2.2, "aria-hidden": true })))
    .replace(/@@(TRANSPORT|CSS|PORTRAIT|ICON|LIBRARY|BUNDLE)@@/g, (_, key) => slots[key]);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!process.argv[2]) throw new Error("Usage: npm run whatsapp:export -- path/to/simulator.html");
  await writeFile(process.argv[2], await buildSimulator());
  console.log("Wrote " + process.argv[2]);
}
