import { createServer } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildSimulator, loadLibrary } from "./build-simulator.mjs";
import { DEMO_USER, parseWebhook, simulateTurn } from "./events.mjs";
import { ReadingRuntime } from "./runtime.mjs";

export function signature(raw, secret) {
  return "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
}
const equal = (a, b) => a.length === b.length && timingSafeEqual(a, b);
const httpError = (status, message) => Object.assign(new Error(message), { status });

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= 128 * 1024) chunks.push(chunk);
  }
  if (size > 128 * 1024) throw httpError(413, "Body too large");
  return Buffer.concat(chunks);
}
function json(raw) {
  try { return JSON.parse(raw.toString("utf8")); }
  catch { throw httpError(400, "Invalid JSON"); }
}
export function localStore(filename) {
  const dir = dirname(filename);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return {
    state: existsSync(filename) ? JSON.parse(readFileSync(filename, "utf8")) : undefined,
    save(snapshot) {
      const temp = filename + ".tmp";
      writeFileSync(temp, JSON.stringify(snapshot), { mode: 0o600 });
      renameSync(temp, filename);
    },
  };
}
export function createWhatsAppServer({ runtime, html, appSecret = randomBytes(32).toString("hex"),
  verifyToken = randomBytes(24).toString("hex") }) {
  async function ingest(raw, header, fixture) {
    if (typeof header !== "string" || !/^sha256=[a-f\d]{64}$/.test(header) ||
        !equal(Buffer.from(header), Buffer.from(signature(raw, appSecret)))) throw httpError(403, "Invalid signature");
    const payload = json(raw);
    let messages;
    try { messages = parseWebhook(payload); } catch { throw httpError(400, "Invalid webhook envelope"); }
    if (fixture) for (const event of messages) if (event.kind === "audio") event.fixture = fixture;
    return runtime.enqueue(messages);
  }
  return createServer(async (req, res) => {
    function send(status, body, type = "text/plain; charset=utf-8") {
      res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" });
      res.end(body);
    }
    const sendJson = value => send(200, JSON.stringify(value), "application/json; charset=utf-8");
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/webhook" && req.method === "GET") {
        const token = url.searchParams.get("hub.verify_token") ?? "";
        if (url.searchParams.get("hub.mode") !== "subscribe" || !url.searchParams.has("hub.challenge") ||
            !equal(Buffer.from(token), Buffer.from(verifyToken))) throw httpError(403, "Verification failed");
        return send(200, url.searchParams.get("hub.challenge"));
      }
      if (url.pathname === "/webhook" && req.method === "POST") {
        await ingest(await readBody(req), req.headers["x-hub-signature-256"]);
        send(200, "OK");
        setImmediate(() => runtime.drain().catch(() => console.error("Local worker could not commit its queue")));
        return;
      }
      // Simulator controls belong to the local browser, including when the webhook is being tested.
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? "")) throw httpError(403, "Local host required");
      if (req.headers.origin && req.headers.origin !== "http://" + req.headers.host) throw httpError(403, "Local origin required");
      if (req.method === "GET" && url.pathname === "/") return send(200, html, "text/html; charset=utf-8");
      if (req.method === "GET" && url.pathname === "/api/family") return sendJson(runtime.family(DEMO_USER));
      if (req.method === "POST" && url.pathname === "/api/simulate") {
        if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] ?? "")) throw httpError(415, "JSON required");
        const input = json(await readBody(req));
        const result = await simulateTurn(runtime, input, (envelope, fixture) => {
          const raw = Buffer.from(JSON.stringify(envelope));
          return ingest(raw, signature(raw, appSecret), fixture);
        }, runtime.now());
        return sendJson(result);
      }
      send(404, "Not found");
    } catch (error) {
      const status = error.status ?? (error instanceof TypeError ? 400 : 500);
      send(status, status === 500 ? "Local storage or worker error" : error.message);
    }
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.env.PORT ?? 4286);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("Invalid port");
  const filename = fileURLToPath(new URL(".local/simulator-" + port + ".json", import.meta.url));
  const library = await loadLibrary();
  const runtime = new ReadingRuntime({ library, ...localStore(filename) });
  const server = createWhatsAppServer({ runtime, html: await buildSimulator("http", library),
    appSecret: process.env.WA_APP_SECRET || undefined, verifyToken: process.env.WA_VERIFY_TOKEN || undefined });
  server.listen(port, "127.0.0.1", () => {
    console.log("Bookser WhatsApp simulator is ready at http://127.0.0.1:" + port);
    runtime.drain().catch(() => console.error("Could not recover the local queue"));
  });
}
