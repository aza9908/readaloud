const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
export function pinField(title, name, creating) {
  const label = el("label", "field-label", title), input = el("input", "pin");
  Object.assign(input, { type: "password", name, inputMode: "numeric", pattern: "[0-9]{4}", minLength: 4,
    maxLength: 4, required: true, autocomplete: creating ? "new-password" : "current-password" });
  label.append(input);
  return label;
}

function reportBody(report, c) {
  const body = el("section", "report-body");
  body.append(el("p", "hint", report.period + " · " + c.attempts + " " + report.attempts));
  if (!report.attempts) { body.append(el("p", "empty-report", c.empty)); return body; }
  const grid = el("dl", "report-grid");
  for (const [name, value] of [[c.days, report.activeDays], [c.minutes, report.minutes], [c.words, report.words], [c.books, report.books],
    [c.speed, report.averageWcpm ?? "—"], [c.accuracy, report.accuracy == null ? "—" : report.accuracy + "%"]]) {
    const tile = el("div"); tile.append(el("dt", "", name), el("dd", "", value)); grid.append(tile);
  }
  const days = el("ul", "report-days");
  for (const day of report.days) {
    const item = el("li", day.active ? "active" : "", day.label);
    const info = day.date + " · " + (day.active ? c.active : c.inactive);
    item.title = info; item.setAttribute("aria-label", info); days.append(item);
  }
  body.append(grid, days);
  const changes = [];
  function addChange(label, value, suffix) {
    if (value != null) changes.push(label + " " + (value > 0 ? "+" : "") + value + suffix);
  }
  addChange(c.speed, report.wcpmDelta, ""); addChange(c.accuracy, report.accuracyDelta, c.points);
  body.append(el("p", "hint", changes.length ? c.trend + " · " + changes.join(" · ") : c.noTrend));
  if (report.practiceWords.length) {
    const list = el("ul", "word-list");
    for (const item of report.practiceWords) list.append(el("li", "", item.word + " ×" + item.count));
    body.append(el("h3", "", c.wordsToPractise), list);
  }
  body.append(el("p", "report-advice", report.advice));
  return body;
}

export function createParentPanel({ family, strings, request, onDelete }) {
  const dialog = document.getElementById("parent-dialog");
  const panel = document.getElementById("parent-content");
  const heading = document.getElementById("parent-heading");
  const error = document.getElementById("parent-error");
  let generation = 0, token = "", expires = 0, timer, countdown, mode;
  const isOpen = () => dialog.hasAttribute("open");
  const forget = id => { if (id) void request({ action: "lock", token: id }).catch(() => {}); };
  function close() {
    ++generation; clearTimeout(timer); clearInterval(countdown); countdown = undefined;
    forget(token); token = ""; expires = 0;
    panel.replaceChildren(); heading.replaceChildren(); error.replaceChildren(); error.hidden = true;
    if (isOpen()) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }
  function problem(text) { error.hidden = false; error.textContent = text; }
  function gate() {
    const c = strings(), creating = !family().hasParentPin;
    heading.textContent = creating ? c.setup : c.pin;
    const form = el("form", "gate-form");
    form.append(el("p", "hint", creating ? c.pinHint : c.enterHint), pinField(c.pin, "pin", creating));
    if (creating) form.append(pinField(c.confirmPin, "confirmPin", true));
    const submit = el("button", "primary", creating ? c.setupButton : c.unlock);
    submit.type = "submit"; form.append(submit); panel.replaceChildren(form);
    form.elements.pin.focus();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (submit.disabled) return;
      error.hidden = true;
      const pin = form.elements.pin.value, confirmPin = form.elements.confirmPin?.value;
      form.reset();
      if (creating && pin !== confirmPin) { problem(c.mismatch); form.elements.pin.focus(); return; }
      submit.disabled = true;
      const version = generation;
      try {
        const data = await request(creating ? { action: "setup", pin, confirmPin } : { action: "unlock", pin });
        if (version !== generation) { forget(data.token); return; }
        if (!data.ok) {
          if (data.code === "locked" && data.retryAfter > 0) {
            const until = Date.now() + data.retryAfter * 1000;
            form.elements.pin.disabled = true;
            const tick = () => {
              const seconds = Math.ceil((until - Date.now()) / 1000);
              if (seconds > 0) { problem(c.locked + " " + seconds + " " + c.seconds); return; }
              clearInterval(countdown); countdown = undefined; error.hidden = true;
              submit.disabled = false; form.elements.pin.disabled = false; form.elements.pin.focus();
            };
            countdown = setInterval(tick, 1000); tick();
          } else {
            const info = data.code === "wrong" && Number.isInteger(data.remaining) ? " · " + data.remaining : "";
            problem((c[data.code] ?? c.unavailable) + info); form.elements.pin.focus();
          }
          return;
        }
        family().hasParentPin = true; token = data.token; expires = data.expiresAt;
        timer = setTimeout(close, Math.max(0, expires - Date.now()));
        if (mode === "delete") await erase(); else await showReport();
      } catch { if (version === generation) problem(c.failed); }
      finally { if (!countdown) submit.disabled = false; }
    });
  }
  async function protectedRequest(input) {
    const version = generation, c = strings();
    if (!token || Date.now() >= expires) { close(); return null; }
    const data = await request({ ...input, token });
    if (version !== generation) return null;
    if (!data.ok) {
      if (data.code === "expired" || data.code === "unavailable") {
        clearTimeout(timer); token = ""; expires = 0; gate();
      }
      problem(c[data.code] ?? c.unavailable); return null;
    }
    return data;
  }
  async function erase() {
    if (!window.confirm(strings().eraseConfirm)) { if (mode === "delete") close(); return; }
    const data = await protectedRequest({ action: "delete" });
    if (data) { const old = family().lang; close(); onDelete(data.family, old); }
  }
  async function showReport() {
    const c = strings(), f = family();
    heading.textContent = c.report;
    const label = el("label", "field-label", c.chooseReader), select = el("select");
    for (const child of f.children) {
      const option = el("option", "", child.name); option.value = child.id; option.selected = child.id === f.active;
      select.append(option);
    }
    label.append(select);
    const body = el("div"), remove = el("button", "text-button danger", c.erase);
    remove.id = "erase"; remove.type = "button"; remove.addEventListener("click", () => erase().catch(() => problem(c.failed)));
    panel.replaceChildren();
    if (f.children.length) panel.append(label);
    panel.append(body, remove);
    let loadId = 0;
    const load = async () => {
      const n = ++loadId, version = generation;
      body.replaceChildren(el("p", "hint", c.loading));
      try {
        const data = await protectedRequest({ action: "report", childId: select.value });
        if (data && n === loadId) {
          const opt = el("label", "check weekly-setting"), input = el("input");
          input.type = "checkbox"; input.checked = (data.weeklyEnabled ?? data.report.weeklyEnabled) === true;
          input.addEventListener("change", async () => {
            const enabled = input.checked;
            input.disabled = true; select.disabled = true; error.hidden = true;
            try {
              const saved = await protectedRequest({ action: "weekly", enabled });
              input.checked = saved ? saved.weeklyEnabled === true : !enabled;
            } catch { input.checked = !enabled; if (version === generation) problem(c.failed); }
            finally { input.disabled = false; select.disabled = false; }
          });
          opt.append(input, document.createTextNode(c.weekly)); body.replaceChildren(reportBody(data.report, c), opt);
          const reviewItems = data.reviewItems ?? data.report.reviewItems ?? [];
          if (reviewItems.length) {
            const list = el("ul", "review-items");
            const timestamp = new Intl.DateTimeFormat(f.lang === "ru" ? "ru-RU" : "kk-KZ",
              { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Almaty" });
            for (const item of reviewItems) {
              const row = el("li"), resolve = el("button", "ghost", c.reviewed);
              resolve.type = "button";
              resolve.addEventListener("click", async () => {
                resolve.disabled = true;
                try {
                  const result = await protectedRequest({ action: "review", childId: data.report.childId, itemId: item.id });
                  if (result && n === loadId) await load();
                } catch { if (version === generation) problem(c.failed); }
                finally { resolve.disabled = false; }
              });
              row.append(el("span", "", timestamp.format(item.at)), resolve); list.append(row);
            }
            body.append(el("h3", "review-title", c.reviewItems + " · " + reviewItems.length), list);
          }
        }
      } catch { if (version === generation && n === loadId) body.replaceChildren(el("p", "form-error", c.failed)); }
    };
    select.addEventListener("change", load);
    if (f.children.length) await load(); else body.append(el("p", "hint", c.empty));
  }
  function open(action = "report") {
    if (isOpen()) return;
    mode = action; generation++; error.hidden = true;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    gate();
  }
  dialog.addEventListener("cancel", e => { e.preventDefault(); close(); });
  document.getElementById("close-parent").addEventListener("click", close);
  document.addEventListener("visibilitychange", () => { if (document.hidden && isOpen()) close(); });
  window.addEventListener("pagehide", close);
  return { open, close };
}
