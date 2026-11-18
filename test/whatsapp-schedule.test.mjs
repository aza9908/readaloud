import { test } from "node:test";
import assert from "node:assert/strict";
import { weeklyNotice } from "../whatsapp/report-schedule.mjs";

const family = () => ({
  lang: "kk", children: [{ name: "Ару", lastWcpm: 123, reportDays: [] }],
  consent: { guardian: true, processing: true }, weeklyReports: { enabled: true },
});
const sunday = Date.parse("2026-11-22T14:00:00Z"); // Sunday 19:00 Asia/Almaty
const hour = 3600000, week = 7 * 24 * hour;

test("a weekly notice is offered only in the local Sunday 19:00 hour", () => {
  const f = family();
  for (const time of [sunday - 1, sunday + hour, sunday + 24 * hour, sunday - 24 * hour]) {
    assert.equal(weeklyNotice(f, time), null);
  }
  assert.equal(weeklyNotice(f, sunday).week, "2026-11-22");
  assert.deepEqual(weeklyNotice(f, sunday + hour - 1), weeklyNotice(f, sunday));
});

test("a persisted receipt suppresses repeats across restarts and clock rollbacks", () => {
  const f = family(), before = structuredClone(f);
  const notice = weeklyNotice(f, sunday);
  assert.deepEqual(f, before);
  f.weeklyReports.lastWeek = notice.week;
  const afterRestart = JSON.parse(JSON.stringify(f));
  assert.equal(weeklyNotice(afterRestart, sunday + 60000), null);
  assert.equal(weeklyNotice(afterRestart, sunday - week), null);
  assert.equal(weeklyNotice(afterRestart, sunday + week).week, "2026-11-29");
});

test("unconsented families, withdrawn consent, no readers and opt-out suppress the prompt", () => {
  const f = family();
  for (const change of [{ consent: null }, { consent: { guardian: true, processing: false } },
    { consent: { processing: true, guardian: false } }, { consent: { ...f.consent, withdrawnAt: sunday } },
    { children: [] }, { weeklyReports: undefined }, { weeklyReports: { enabled: false } }]) {
    assert.equal(weeklyNotice({ ...f, ...change }, sunday), null);
  }
});

test("Kazakh and Russian notices contain only the private report invitation", () => {
  const f = family(), kk = weeklyNotice(f, sunday), ru = weeklyNotice({ ...f, lang: "ru" }, sunday);
  assert.deepEqual(Object.keys(kk).sort(), ["body", "week"]);
  assert.match(kk.body, /Апталық есеп/);
  assert.match(ru.body, /Отчёт за неделю/);
  assert.doesNotMatch(kk.body + ru.body, /Ару|123|%|мин/);
});
