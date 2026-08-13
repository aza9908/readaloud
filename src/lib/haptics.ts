/**
 * haptics.ts — тактильный отклик.
 *
 * ЧЕСТНО О ПОДДЕРЖКЕ. Vibration API работает в Chrome на Android и не
 * работает в Safari на iOS — Apple его не реализовала для веба. Поэтому на
 * айфоне вибрации не будет, и это ограничение платформы, а не недоделка.
 * Функции написаны так, что молча ничего не делают там, где API нет.
 *
 * ЗАЧЕМ ВООБЩЕ. Короткий отклик на правильный ответ или полученную монету
 * заметно усиливает ощущение отзывчивости. Длинные и частые вибрации,
 * наоборот, раздражают, поэтому здесь только короткие и только на значимые
 * события — не на каждое касание.
 */

const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/** Уважаем системную настройку «меньше движения» как знак чувствительности. */
function allowed(): boolean {
  if (!canVibrate()) return false;
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Лёгкое касание: нажатие кнопки, выбор варианта. */
export function tapFeedback(): void {
  if (allowed()) navigator.vibrate(8);
}

/** Успех: верный ответ, полученная монета, открытая карточка. */
export function successFeedback(): void {
  if (allowed()) navigator.vibrate([12, 40, 18]);
}

/** Мягкое «не получилось». Намеренно короче успеха: ошибка не должна
 *  ощущаться наказанием — ребёнок и так расстроен. */
export function gentleFeedback(): void {
  if (allowed()) navigator.vibrate(14);
}

/** Победа в матче — единственный случай, где отклик заметнее. */
export function celebrateFeedback(): void {
  if (allowed()) navigator.vibrate([16, 50, 16, 50, 28]);
}
