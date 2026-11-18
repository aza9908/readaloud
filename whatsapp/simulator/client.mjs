import { ALIASES, AVATARS, command, familyStart, welcome } from "../bot.mjs";
import { copy } from "../copy.mjs";
import { DEMO_USER, parseWebhook, simulateTurn } from "../events.mjs";
import { ReadingRuntime, readerSummary } from "../runtime.mjs";
import { feedbackSvg } from "./card.mjs";
import { labels } from "./strings.mjs";
import { createParentPanel, pinField } from "./parent-panel.mjs";
import { parentAction } from "../parent.mjs";

const $ = id => document.getElementById(id);
const library = JSON.parse($("books").textContent);
const offline = document.documentElement.dataset.transport === "offline";
const runtime = offline ? new ReadingRuntime({ library }) : null;
let family = familyStart(), busy = false, lastNote = null, pageKey = "", statusTimer;
const t = () => copy[family.lang ?? "kk"];
const ui = () => labels[family.lang ?? "en"];
const parentPanel = createParentPanel({
  family: () => family, strings: ui,
  request: input => offline ? parentAction(runtime, DEMO_USER, input) : api("/api/parent", input),
  onDelete(data, previousLang) {
    family = data; lastNote = null; pageKey = ""; $("message").value = ""; loadPreset(null);
    $("reply-announcement").replaceChildren(); window.speechSynthesis?.cancel();
    render(); status(copy[previousLang ?? "kk"].deleted);
  },
});
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
    keepalive: path === "/api/parent" && data.action === "lock",
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
  if (!replay && !family.consent && (input.kind === "text" || input.kind === "button") && command(input) === "delete" &&
      !window.confirm(t().confirmDelete)) return;
  busy = true;
  const packet = { id: crypto.randomUUID(), ...input };
  try {
    const result = offline ? await simulateTurn(runtime, packet, deliver) : await api("/api/simulate", packet);
    family = result.family;
    if (packet.kind === "audio" && result.accepted) lastNote = packet;
    if (result.notice) { lastNote = null; status(result.notice); }
    else if (replay && !result.accepted) status(ui().replayed);
    render();
    if (result.accepted && !result.notice) {
      const reply = family.history.at(-1)?.reply;
      $("reply-announcement").lang = reply?.language ?? family.lang ?? "kk";
      $("reply-announcement").textContent = reply?.body ?? "";
    } else if (result.notice) $("reply-announcement").textContent = "";
  } catch { status(ui().failed); }
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
    const cUi = ui(), fields = make("div", "pin-fields");
    fields.append(pinField(cUi.pin, "pin", true), pinField(cUi.confirmPin, "confirmPin", true));
    form.append(make("strong", "form-title", c.consentLabel), check(c.guardian, "guardian", true),
      check(c.process, "processing", true), check(c.border, "crossBorder", false), make("p", "hint", cUi.pinHint), fields);
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
    if (kind === "consent") {
      const pin = values.get("pin"), confirmPin = values.get("confirmPin");
      if (pin !== confirmPin) { status(ui().mismatch); form.elements.confirmPin.focus(); return; }
      form.elements.pin.value = ""; form.elements.confirmPin.value = "";
      send({ kind, guardian: values.has("guardian"), processing: values.has("processing"), crossBorder: values.has("crossBorder"), pin, confirmPin });
    }
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
    const close = card.marks.filter(m => m.status === "close").map(m => m.text);
    img.alt = [card.title, card.text, close.length ? (el.lang === "ru" ? "Почти верно" : "Дұрысқа жақын") + " — " + close.join(", ") : "",
      marked.length ? c.again + " — " + marked.join(", ") : ""].filter(Boolean).join(". ");
    const legend = make("div", "key");
    legend.append(document.createTextNode(el.lang === "ru" ? "Фиолетовый — верно · " : "Күлгін — дұрыс · "),
      make("em", "", el.lang === "ru" ? "курсив — близко" : "көлбеу — жақын"),
      document.createTextNode(" · "), make("b", "", el.lang === "ru" ? "подчёркнуто — повтори" : "асты сызылған — қайтала"));
    el.append(img, legend);
  }
  if (latest) {
    if (reply.form) addForm(el, reply.form);
    if (reply.narration) narration(el, reply.narration);
    const actions = make("div", "actions");
    if (reply.parentAction) actions.append(button(ui().enterParent, () => parentPanel.open(reply.parentAction)));
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
  $("transcript").readOnly = mode === "adult";
  $("transcript").value = mode === "silence" || mode === "adult" ? "" : mode === "perfect" ? (reader?.text ?? "") : words.filter((_, i) => i % 5 !== 2).join(" ");
  $("seconds").value = "30";
}
function renderNotice(notice) {
  $("weekly-notice").hidden = !notice?.body;
  $("notice-text").textContent = notice?.body ?? "";
}
async function refreshNotice() {
  if (document.hidden || busy || !family.consent) return;
  const current = family;
  try {
    if (offline) runtime.checkWeekly();
    const data = offline ? runtime.publicFamily(DEMO_USER) : await api("/api/family");
    if (current !== family || busy) return;
    if (!data.consent) {
      parentPanel.close(); family = data; lastNote = null; pageKey = ""; loadPreset(null); render();
    } else renderNotice(data.weeklyNotice);
  } catch { /* The next visible refresh will retry without interrupting a reading turn. */ }
}
function render() {
  const thread = $("thread");
  const history = family.history;
  const c = ui();
  renderNotice(family.weeklyNotice);
  document.documentElement.lang = family.lang ?? "en";
  document.title = "Bookser · " + c.title + " · WhatsApp";
  thread.setAttribute("aria-label", c.chat);
  for (const node of document.querySelectorAll("[data-i]")) node.textContent = c[node.dataset.i];
  for (const [id, key] of [["theme","theme"],["menu","choose"],["smaller","smaller"],["larger","larger"],["close-parent","close"]]) {
    $(id).setAttribute("aria-label", c[key]); $(id).title = c[key];
  }
  document.querySelector(".send-text").setAttribute("aria-label", c.send);
  $("transcript").placeholder = c.placeholder;
  thread.classList.toggle("welcome", !history.length);
  const fragment = document.createDocumentFragment();
  if (!history.length) {
    const portrait = make("img", "welcome-art"); portrait.alt = ""; portrait.src = document.querySelector(".portrait").src;
    fragment.append(portrait, replyBubble(welcome(), true));
  }
  for (const [i, row] of history.entries()) {
    if (row.incoming) fragment.append(make("div", "bubble in", row.incoming));
    fragment.append(replyBubble(row.reply, i === history.length - 1));
  }
  thread.replaceChildren(fragment); thread.scrollTop = thread.scrollHeight;
  const r = readerSummary(family, library);
  const ready = !!r && ["read", "passed"].includes(family.stage);
  const key = r ? family.active + ":" + r.page : "";
  if (key !== pageKey) { loadPreset(r); pageKey = key; }
  $("mode").textContent = offline ? c.offline : c.local;
  $("lab-fields").disabled = !ready;
  $("lab-hint").textContent = ready ? r.title + " · " + r.page + " / " + r.pages + " · " + (r.language === "kk" ? "Қазақша" : "Русский")
    : r ? c.resume : c.first;
  $("reader-name").textContent = r?.name ?? c.noReader;
  $("reader-avatar").textContent = r?.avatar ?? "📖"; $("coins").textContent = r?.coins ?? "—"; $("streak").textContent = r?.streak ?? "—";
  $("rewards").hidden = !r; $("type-size").hidden = !r; $("page-position").hidden = !r;
  $("book-title").textContent = r ? [r.title, library[r.language].hint?.[family.lang]].filter(Boolean).join(" · ") : "";
  $("page-count").textContent = r ? r.page + " / " + r.pages : "";
  $("page-progress").max = r?.pages ?? 1; $("page-progress").value = r?.page ?? 0;
  $("page-progress").setAttribute("aria-label", $("book-title").textContent + " " + $("page-count").textContent);
  $("replay").disabled = !lastNote;
  $("parent").disabled = !family.consent;
  $("menu").disabled = !family.children.length;
}
$("composer").addEventListener("submit", e => {
  e.preventDefault();
  const value = $("message").value.trim();
  if (value) { $("message").value = ""; send({ kind: "text", value }); }
});
$("menu").addEventListener("click", () => send({ kind: "button", value: "readers" }));
$("parent").addEventListener("click", () => parentPanel.open());
$("weekly-notice").addEventListener("click", () => parentPanel.open());
document.addEventListener("visibilitychange", refreshNotice);
window.setInterval(refreshNotice, 60000);
let readSize = 20;
function setReadSize(size) {
  readSize = Math.max(16, Math.min(size, 30)); document.documentElement.style.setProperty("--read-size", readSize + "px");
  $("smaller").disabled = readSize === 16; $("larger").disabled = readSize === 30;
}
$("smaller").addEventListener("click", () => setReadSize(readSize - 2));
$("larger").addEventListener("click", () => setReadSize(readSize + 2));
function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark); $("theme").setAttribute("aria-pressed", String(dark));
  document.querySelector('meta[name="theme-color"]').content = dark ? "#17141f" : "#fbf9f4";
}
let dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
try {
  const theme = localStorage.getItem("theme");
  if (theme === "dark" || theme === "light") dark = theme === "dark";
} catch {}
applyTheme(dark);
$("theme").addEventListener("click", () => {
  const next = !document.documentElement.classList.contains("dark");
  applyTheme(next);
  try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
});
$("replay").addEventListener("click", () => { if (lastNote) send(lastNote, true); });
$("preset").addEventListener("change", () => loadPreset(readerSummary(family, library)));
$("send-note").addEventListener("click", () => {
  if (!$("seconds").reportValidity() || $("seconds").value === "") return;
  const flagged = $("preset").value === "adult";
  send({ kind: "audio", transcript: flagged ? "" : $("transcript").value, flagged, seconds: Number($("seconds").value), language: readerSummary(family, library)?.language });
});
if (offline) render();
else api("/api/family").then(data => { family = data; render(); }).catch(e => status(e.message));
