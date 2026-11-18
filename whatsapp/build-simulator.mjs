import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";
import { sampleLibrary } from "./reading.mjs";

const here = path => new URL(path, import.meta.url);
export async function loadLibrary() {
  return sampleLibrary(JSON.parse(await readFile(here("../seed/books.sample.json"), "utf8")));
}
export async function buildSimulator(transport = "offline", library) {
  const [template, css, portrait, js, books] = await Promise.all([
    readFile(here("simulator/index.html"), "utf8"), readFile(here("simulator/style.css"), "utf8"),
    readFile(here("../src/assets/avatars/page-pal.webp")),
    build({ entryPoints: [fileURLToPath(here("simulator/client.mjs"))], bundle: true, write: false,
      format: "iife", target: "es2020", minify: true, legalComments: "none" }),
    library ?? loadLibrary(),
  ]);
  const slots = {
    TRANSPORT: transport === "http" ? "http" : "offline", CSS: css, PORTRAIT: portrait.toString("base64"),
    LIBRARY: JSON.stringify(books).replace(/</g, "\\u003c"),
    BUNDLE: js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
  };
  return template.replace(/@@(TRANSPORT|CSS|PORTRAIT|LIBRARY|BUNDLE)@@/g, (_, key) => slots[key]);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!process.argv[2]) throw new Error("Usage: npm run whatsapp:export -- path/to/simulator.html");
  await writeFile(process.argv[2], await buildSimulator());
  console.log("Wrote " + process.argv[2]);
}
