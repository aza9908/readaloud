import { localDay } from "./reading.mjs";

const DAY_MS = 86400000;
const WEEK = 7;
const newDay = day => ({
  day, attempts: 0, seconds: 0, matched: 0, total: 0, books: 0,
  measuredReads: 0, rateSum: 0, hardWords: [],
});

function wordKey(word) {
  return word.toLowerCase().normalize("NFC");
}

function practiceCandidates(score) {
  // Only words from the assigned page may reach a parent report. Do not count an
  // unfinished tail as a list of struggles, or count a repeated word twice in one read.
  const struggled = new Set((score.struggledWords ?? []).map(wordKey));
  const candidates = new Set();
  let lastAttempted = score.marks.length - 1;
  while (lastAttempted >= 0 && score.marks[lastAttempted].status === "missed") lastAttempted--;
  for (const [index, mark] of score.marks.entries()) {
    const word = wordKey(mark.text);
    if (struggled.has(word) || (index <= lastAttempted && (mark.status === "substituted" || mark.status === "missed"))) {
      candidates.add(word);
    }
  }
  return candidates;
}

/** Called once inside the same deduplicated worker transaction as scoring and rewards. */
export function recordReading(child, { score, seconds, at, bookFinished = false }) {
  const day = localDay(at);
  const rows = child.reportDays ?? [];
  const latest = Math.max(day, ...rows.map(row => row.day));
  const earliest = latest - (2 * WEEK - 1);
  if (day < earliest) return;
  child.reportDays = rows.filter(row => row.day >= earliest);
  let row = child.reportDays.find(entry => entry.day === day);
  if (!row) {
    row = newDay(day);
    child.reportDays.push(row);
    child.reportDays.sort((a, b) => a.day - b.day);
  }
  row.attempts++;
  row.seconds += seconds;
  row.matched += score.matched;
  row.total += score.total;
  row.books += Number(bookFinished);
  // Bookser's WeeklyReport averages sessions with measurable speed.
  if (score.wcpm > 0) { row.measuredReads++; row.rateSum += score.wcpm; }
  const words = new Map(row.hardWords);
  for (const word of practiceCandidates(score)) words.set(word, (words.get(word) ?? 0) + 1);
  row.hardWords = Array.from(words);
}

function summarize(rows) {
  const sum = key => rows.reduce((n, row) => n + row[key], 0);
  const total = sum("total"), words = sum("matched"), measured = sum("measuredReads");
  return {
    attempts: sum("attempts"), minutes: Math.round(sum("seconds") / 60), words, books: sum("books"),
    averageWcpm: measured ? Math.round(sum("rateSum") / measured) : rows.length ? 0 : null,
    accuracy: total ? Math.round(100 * words / total) : null,
  };
}

function nextPractice(lang, current, words) {
  const kk = lang === "kk";
  if (!current.attempts) return kk
    ? "Бала бір бетті оқығаннан кейін осы жерде алғашқы нәтиже көрінеді."
    : "После первого оценённого чтения здесь появится результат.";
  if (words.length) return kk
    ? "«" + words[0].word + "» сөзін бірге буынға бөліп оқып, содан кейін осы сөз бар сөйлемді қайта оқыңыздар."
    : "Разберите слово «" + words[0].word + "» по слогам, затем вместе перечитайте предложение с ним.";
  if (current.accuracy < 60) return kk
    ? "Алдымен бір сөйлемді балаға оқып беріңіз, содан кейін оны бірге қайталаңыздар."
    : "Прочитайте ребёнку одно предложение вслух, затем попробуйте прочитать его вместе.";
  return kk ? "Келесі жолы баламен бірге жаңа бет таңдап, кезектесіп бір-бір сөйлемнен оқыңыздар."
    : "В следующий раз выберите новую страницу и прочитайте её по очереди, по предложению.";
}

/** A private, on-demand report for one reader, using the last seven Almaty dates. */
export function weeklyReport(child, now = Date.now(), parentLanguage = child.language) {
  const language = parentLanguage === "ru" ? "ru" : "kk";
  const today = localDay(now), first = today - WEEK + 1;
  const rows = child.reportDays ?? [];
  const currentRows = rows.filter(row => row.day >= first && row.day <= today);
  const current = summarize(currentRows);
  const previous = summarize(rows.filter(row => row.day >= first - WEEK && row.day < first));
  const counts = new Map();
  for (const row of currentRows) {
    for (const [word, count] of row.hardWords) counts.set(word, (counts.get(word) ?? 0) + count);
  }
  const practiceWords = Array.from(counts, ([word, count]) => ({ word, count }))
    .filter(entry => entry.count >= 2)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, child.language)).slice(0, 6);
  const locale = language === "ru" ? "ru-RU" : "kk-KZ";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const dateLabel = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const days = Array.from({ length: WEEK }, (_, i) => {
    const day = first + i, date = new Date(day * DAY_MS);
    return { date: date.toISOString().slice(0, 10), label: weekday.format(date), active: currentRows.some(row => row.day === day) };
  });
  return {
    childId: child.id, name: child.name, language, readingLanguage: child.language,
    title: language === "ru" ? "Отчёт за неделю" : "Апталық есеп",
    period: dateLabel.formatRange(new Date(first * DAY_MS), new Date(today * DAY_MS)),
    from: days[0].date, through: days[WEEK - 1].date, days, activeDays: currentRows.length, ...current,
    wcpmDelta: current.averageWcpm !== null && previous.averageWcpm > 0 ? current.averageWcpm - previous.averageWcpm : null,
    accuracyDelta: current.accuracy !== null && previous.accuracy !== null ? current.accuracy - previous.accuracy : null,
    practiceWords, advice: nextPractice(language, current, practiceWords),
  };
}
