import { BookserIcon } from "./BookserIcon";

export function ReadingMetrics({ books, time, pace, coins }: { books: number; time: string; pace: number; coins: number }) {
  const entries = [
    { name: "book", value: books, label: "Книг прочитано" },
    { name: "watch", value: time, label: "Время чтения" },
    { name: "pace", value: pace, label: "Слов в минуту" },
    { name: "coins", value: coins, label: "Монет" },
  ];
  return <dl className="reading-metrics">{entries.map(({ name, value, label }) => (
    <div className="reading-metric" key={name} data-metric={name}>
      <BookserIcon value={name} size={54} />
      <dt>{label}</dt><dd>{value}</dd>
    </div>
  ))}</dl>;
}

export function AchievementBadge({ badge }: { badge: { icon: string; title: string; description: string } }) {
  return <div className="achievement-badge">
    <span className="badge-setting"><BookserIcon value={badge.icon} size={42} /></span>
    <div><strong>{badge.title}</strong><p>{badge.description}</p></div>
  </div>;
}
