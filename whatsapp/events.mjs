import { ALIASES, AVATARS, command } from "./bot.mjs";
import { copy } from "./copy.mjs";

export const DEMO_USER = "KZ.BOOKSER_DEMO";
const list = v => Array.isArray(v) ? v : [];
const short = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max;

/** Only inbound messages enter the worker. Neither phone numbers nor contact names are copied. */
export function parseWebhook(payload) {
  if (payload?.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) throw new TypeError("Expected a WhatsApp webhook envelope");
  const events = [];
  for (const entry of payload.entry) {
    for (const change of list(entry?.changes)) {
      if (change?.field !== "messages") continue;
      const value = change.value;
      for (const msg of list(value?.messages)) {
        if (!msg || !short(msg.id, 512)) continue;
        const at = Number(msg.timestamp) * 1000;
        if (!Number.isSafeInteger(at) || at <= 0 || at > 8640000000000000) continue;
        if (msg.type === "system") {
          const sys = msg.system;
          if (["user_changed_user_id", "user_changed_number"].includes(sys?.type) &&
              short(sys.previous_user_id, 160) && short(sys.user_id, 160)) {
            events.push({ kind: "identity", user: sys.previous_user_id, newUser: sys.user_id, id: msg.id, at });
          }
          continue;
        }
        const user = msg.from_user_id || list(value.contacts).find(c => msg.from && c?.wa_id === msg.from)?.user_id;
        if (!short(user, 160)) continue;
        const event = { user, id: msg.id, at, kind: "other" };
        if (msg.type === "text") {
          event.kind = "text";
          event.value = String(msg.text?.body ?? "").slice(0, 240);
          if (!command(event)) event.value = "";
        } else if (msg.type === "interactive") {
          const choice = msg.interactive?.button_reply ?? msg.interactive?.list_reply;
          if (short(choice?.id, 160)) { event.kind = "button"; event.value = choice.id; }
        } else if (msg.type === "audio" && short(msg.audio?.id, 512)) {
          event.kind = "audio";
          event.media = msg.audio.id;
        }
        events.push(event);
      }
    }
  }
  return events;
}

export function demoEnvelope(input, id, at) {
  const msg = { from_user_id: DEMO_USER, id, timestamp: String(Math.floor(at / 1000)) };
  if (input.kind === "text") Object.assign(msg, { type: "text", text: { body: input.value } });
  else if (input.kind === "button") Object.assign(msg, { type: "interactive", interactive: { type: "button_reply", button_reply: { id: input.value } } });
  else if (input.kind === "audio") Object.assign(msg, { type: "audio", audio: { id: "sample-custom", voice: true, mime_type: "audio/ogg" } });
  else throw new TypeError("Unknown simulator message");
  return { object: "whatsapp_business_account", entry: [{ id: "DEMO", changes: [{ field: "messages", value: { messaging_product: "whatsapp", messages: [msg] } }] }] };
}

/** Structured consent/profile fields are trusted only at the local simulator boundary. */
export async function simulateTurn(runtime, input, deliver, at = Date.now()) {
  if (!short(input?.id, 160)) throw new TypeError("A message ID is required");
  const { id, kind } = input;
  const prior = runtime.family(DEMO_USER);
  let accepted;
  if (kind === "consent" || kind === "profile") {
    const fields = kind === "consent"
      ? { guardian: input.guardian === true, processing: input.processing === true, crossBorder: input.crossBorder === true }
      : prior.consent && ALIASES.includes(input.name) && AVATARS.includes(input.avatar) &&
        Number.isInteger(input.age) && input.age >= 6 && input.age <= 12 && ["kk", "ru"].includes(input.language)
        ? { name: input.name, age: input.age, language: input.language, avatar: input.avatar } : {};
    accepted = await runtime.enqueue([{ id, user: DEMO_USER, at, kind, ...fields }]);
  } else {
    if ((kind === "text" || kind === "button") && !short(input.value, 240)) throw new TypeError("Invalid message text");
    let fixture;
    if (kind === "audio" && prior.consent) {
      if (typeof input.transcript !== "string" || input.transcript.length > 5000 || !Number.isFinite(input.seconds) ||
          input.seconds < 0 || input.seconds > 3600) throw new TypeError("Invalid mock recording");
      fixture = { transcript: input.transcript, seconds: input.seconds, language: ["kk", "ru"].includes(input.language) ? input.language : undefined };
    }
    accepted = await deliver(demoEnvelope(input, id, at), fixture);
  }
  await runtime.drain();
  const family = runtime.family(DEMO_USER);
  const deleted = accepted && (kind === "button" || kind === "text") && command(input) === "delete";
  return { accepted, family, notice: deleted ? copy[prior.lang ?? "kk"].deleted : undefined };
}
