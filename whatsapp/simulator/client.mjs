import { ALIASES, AVATARS, command, familyStart, welcome } from "../bot.mjs";
import { copy } from "../copy.mjs";
import { DEMO_USER, parseWebhook, simulateTurn } from "../events.mjs";
import { ReadingRuntime, readerSummary } from "../runtime.mjs";
import { feedbackSvg } from "./card.mjs";

const $ = id => document.getElementById(id);
const library = JSON.parse($("books").textContent);
const offline = document.documentElement.dataset.transport === "offline";
const runtime = offline ? new ReadingRuntime({ library }) : null;
let family = familyStart(), busy = false, lastNote = null, pageKey = "", statusTimer;
const t = () => copy[family.lang ?? "kk"];
const make = (tag, cls, value) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (value !== undefined) el.textContent = value;
  return el;
};
function button(title, onClick, cls) {
  const b = make("button", cls, title);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
function status(message) {
  clearTimeout(statusTimer);
  $("status").textContent = message;
  $("status").hidden = false;
  statusTimer = setTimeout(() => { $("status").hidden = true; }, 6500);
}
async function api(path, data) {
  const res = await fetch(path, data === undefined ? undefined : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("The local server returned " + res.status);
  return res.json();
}
async function deliver(envelope, fixture) {
  const events = parseWebhook(envelope);
  if (fixture) for (const event of events) if (event.kind === "audio") event.fixture = fixture;
  return runtime.enqueue(events);
}
async function send(input, replay = false) {
  if (busy) return;
  if (!replay && (input.kind === "text" || input.kind === "button") && command(input) === "delete" &&
      !window.confirm(t().confirmDelete)) return;
  busy = true;
  const packet = { id: crypto.randomUUID(), ...input };
  try {
    const result = offline ? await simulateTurn(runtime, packet, deliver) : await api("/api/simulate", packet);
    family = result.family;
    if (packet.kind === "audio" && result.accepted) lastNote = packet;
    if (result.notice) { lastNote = null; status(result.notice); }
    else if (replay && !result.accepted) status("This voice note was already scored. Replay earned 0 coins.");
    render();
    if (result.accepted && !result.notice) {
      const reply = family.history.at(-1)?.reply;
      $("reply-announcement").lang = reply?.language ?? family.lang ?? "kk";
      $("reply-announcement").textContent = reply?.body ?? "";
    } else if (result.notice) $("reply-announcement").textContent = "";
  } catch (error) { status("Could not complete this turn. " + error.message); }
  finally { busy = false; }
}
function check(label, name, required) {
  const row = make("label", "check"), input = make("input");
  input.type = "checkbox"; input.name = name; input.required = required;
  row.append(input, document.createTextNode(label));
  return row;
}
function selectField(label, name, options, selected) {
  const row = make("label", "field-label", label), select = make("select");
  select.name = name;
  for (const [value, title] of options) {
    const opt = make("option", "", title);
    opt.value = value; opt.selected = String(selected) === String(value);
    select.append(opt);
  }
  row.append(select); return row;
}
function addForm(bubble, kind) {
  const form = make("form", "chat-form"), c = t();
  if (kind === "consent") {
    form.append(make("strong", "form-title", c.consentLabel), check(c.guardian, "guardian", true),
      check(c.process, "processing", true), check(c.border, "crossBorder", false));
  } else {
    const fields = make("div", "profile-fields");
    const options = values => values.map(v => [v, String(v)]);
    fields.append(selectField(c.alias, "name", options(ALIASES), ALIASES[family.children.length]),
      selectField(c.age, "age", options([6, 7, 8, 9, 10, 11, 12]), 8),
      selectField(c.readingLanguage, "language", [["kk", "Қазақша"], ["ru", "Русский"]], family.lang),
      selectField(c.avatar, "avatar", options(AVATARS), AVATARS[family.children.length]));
    form.append(fields);
  }
  const submit = make("button", "primary", kind === "consent" ? c.accept : c.save);
  submit.type = "submit"; form.append(submit);
  form.addEventListener("submit", e => {
    e.preventDefault();
    const values = new FormData(form);
    if (kind === "consent") send({ kind, guardian: values.has("guardian"), processing: values.has("processing"), crossBorder: values.has("crossBorder") });
    else send({ kind, name: values.get("name"), age: Number(values.get("age")), language: values.get("language"), avatar: values.get("avatar") });
  });
  bubble.append(form);
}
function narration(container, sample) {
  const c = copy[sample.language], synth = window.speechSynthesis;
  container.append(make("p", "sheet", sample.text));
  const play = button("▶ " + c.listen, () => {
    const voice = synth?.getVoices().find(v => v.localService && v.lang.toLowerCase().split(/[-_]/)[0] === sample.language);
    if (!voice) { status(c.fallbackVoice); return; }
    const utterance = new SpeechSynthesisUtterance(sample.text);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.85;
    synth.cancel(); synth.speak(utterance);
  });
  const row = make("div", "actions"); row.append(play); container.append(row);
}
function replyBubble(reply, latest) {
  const el = make("div", "bubble");
  el.lang = reply.language ?? family.lang ?? "kk";
  const c = copy[el.lang];
  el.append(make("p", "", reply.body));
  if (reply.page) {
    const p = reply.page, sheet = make("div", "sheet");
    sheet.lang = p.language;
    sheet.append(make("strong", "", p.title + " · " + c.bookPage + " " + p.number + "/" + p.count), make("p", "", p.text));
    el.append(sheet);
  }
  if (reply.card) {
    const card = reply.card, img = make("img", "feedback");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(feedbackSvg(card, c.bookPage));
    const marked = card.marks.filter(m => m.flag).map(m => m.text);
    img.alt = card.title + ". " + card.text + (marked.length ? " · " + c.again + " — " + marked.join(", ") : "");
    const legend = make("div", "key");
    legend.append(document.createTextNode(el.lang === "ru" ? "Зелёный — верно · " : "Жасыл — дұрыс · "),
      make("em", "", el.lang === "ru" ? "охра — близко" : "сары — жақын"),
      document.createTextNode(" · "), make("b", "", el.lang === "ru" ? "подчёркнуто — повтори" : "асты сызылған — қайтала"));
    el.append(img, legend);
  }
  if (latest) {
    if (reply.form) addForm(el, reply.form);
    if (reply.narration) narration(el, reply.narration);
    const actions = make("div", "actions");
    for (const act of reply.buttons ?? []) actions.append(button(act.title, () => send({ kind: "button", value: act.id })));
    if (reply.openBookser) {
      const link = make("a", "", c.open + " ↗"); link.href = "https://readai-4f87b.web.app/"; link.target = "_blank"; link.rel = "noopener noreferrer"; actions.append(link);
    }
    if (actions.childElementCount) el.append(actions);
  }
  return el;
}
function loadPreset(reader) {
  const mode = $("preset").value;
  const words = reader?.text.split(/\s+/u) ?? [];
  $("transcript").value = mode === "silence" ? "" : mode === "perfect" ? (reader?.text ?? "") : words.filter((_, i) => i % 5 !== 2).join(" ");
  $("seconds").value = "30";
}
function render() {
  const thread = $("thread");
  const history = family.history;
  const fragment = document.createDocumentFragment();
  if (!history.length) fragment.append(replyBubble(welcome(), true));
  for (const [i, row] of history.entries()) {
    if (row.incoming) fragment.append(make("div", "bubble in", row.incoming));
    fragment.append(replyBubble(row.reply, i === history.length - 1));
  }
  thread.replaceChildren(fragment); thread.scrollTop = thread.scrollHeight;
  const r = readerSummary(family, library);
  const ready = !!r && ["read", "passed"].includes(family.stage);
  const key = r ? family.active + ":" + r.page : "";
  if (key !== pageKey) { loadPreset(r); pageKey = key; }
  $("mode").textContent = offline ? "Offline demo" : "Local webhook";
  $("lab-fields").disabled = !ready;
  $("lab-hint").textContent = ready ? r.title + " · " + r.page + " / " + r.pages + " · " + (r.language === "kk" ? "Қазақша" : "Русский")
    : r ? "Return to a reading page in the chat to send a sample." : "Add a reader in the chat to unlock the sample transcript.";
  $("reader-name").textContent = r?.name ?? "No reader selected";
  $("reader-avatar").textContent = r?.avatar ?? "☷"; $("coins").textContent = r?.coins ?? "—"; $("streak").textContent = r?.streak ?? "—";
  $("speed").textContent = family.children.find(child => child.id === family.active)?.lastWcpm ?? "—";
  $("replay").disabled = !lastNote;
  $("erase").disabled = !history.length;
  $("menu").disabled = !family.children.length;
}
$("composer").addEventListener("submit", e => {
  e.preventDefault();
  const value = $("message").value.trim();
  if (value) { $("message").value = ""; send({ kind: "text", value }); }
});
$("menu").addEventListener("click", () => send({ kind: "button", value: "readers" }));
$("erase").addEventListener("click", () => send({ kind: "button", value: "delete" }));
$("replay").addEventListener("click", () => { if (lastNote) send(lastNote, true); });
$("preset").addEventListener("change", () => loadPreset(readerSummary(family, library)));
$("send-note").addEventListener("click", () => {
  if (!$("seconds").reportValidity() || $("seconds").value === "") return;
  send({ kind: "audio", transcript: $("transcript").value, seconds: Number($("seconds").value), language: readerSummary(family, library)?.language });
});
if (offline) render();
else api("/api/family").then(data => { family = data; render(); }).catch(e => status(e.message));
