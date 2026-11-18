const almatyClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Almaty", weekday: "short", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", hourCycle: "h23",
});

const ready = {
  kk: "Апталық есеп дайын. Оны ата-ана бөлімінен аша аласыз.",
  ru: "Отчёт за неделю готов. Откройте его в разделе для родителей.",
};

/**
 * An opt-in prompt for the local simulator. The caller records lastWeek together
 * with the notice in one commit. A missed Sunday window is never replayed.
 */
export function weeklyNotice(family, now = Date.now()) {
  const { consent, weeklyReports } = family;
  if (consent?.processing !== true || consent.guardian !== true || consent.withdrawnAt != null ||
      !family.children?.length || weeklyReports?.enabled !== true || !Number.isFinite(now)) return null;
  const parts = Object.fromEntries(almatyClock.formatToParts(now).map(p => [p.type, p.value]));
  if (parts.weekday !== "Sun" || parts.hour !== "19") return null;
  const week = [parts.year, parts.month, parts.day].join("-");
  if (weeklyReports.lastWeek && weeklyReports.lastWeek >= week) return null;
  return { week, body: ready[family.lang === "ru" ? "ru" : "kk"] };
}
