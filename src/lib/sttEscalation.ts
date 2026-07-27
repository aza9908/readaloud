/**
 * sttEscalation.ts — решает, когда обращаться к платному распознаванию.
 *
 * Это самый дорогой модуль в приложении по последствиям: каждое лишнее
 * обращение стоит денег (2,5 ₸/мин). Расчёт показал разброс в 35 раз между
 * наивной и продуманной стратегией:
 *
 *   всё аудио через Freedom STT      — 278 ₸/ребёнка/мес (20% выручки)
 *   только казахский                 —  69 ₸
 *   казахский + только при сбое      —  22 ₸
 *   + отправлять только фрагмент     —   8 ₸ (0,5% выручки)
 *
 * Поэтому здесь четыре ограничителя, и каждый существенно снижает счёт:
 *
 *   1. ЯЗЫК. Только казахский. Русский и английский браузер распознаёт
 *      приемлемо (83% и 92% против 66% на казахском) и бесплатно.
 *   2. ТОЛЬКО ПРИ СБОЕ. Бесплатный движок работает первым. Платный
 *      включается, лишь когда выравнивание застряло и встроенное
 *      восстановление не помогло.
 *   3. ФРАГМЕНТ. Отправляем короткое окно вокруг проблемного места,
 *      а не всю сессию.
 *   4. ЧАСТОТА. Не чаще, чем раз в N секунд, и не больше K раз за книгу —
 *      чтобы шумный микрофон не устроил шквал платных запросов.
 *
 * Модуль чистый и покрыт тестами: test/sttEscalation.test.mjs
 */

import type { Language } from "./types";

/** Сколько секунд аудио отправляем при одном обращении. */
export const SEGMENT_SECONDS = 12;

/** Не обращаться к платному движку чаще, чем раз в столько миллисекунд. */
export const MIN_INTERVAL_MS = 20_000;

/** Максимум обращений за одну книгу. */
export const MAX_ESCALATIONS_PER_BOOK = 4;

/**
 * Сколько подряд неудачных попыток выравнивания считаем сбоем.
 * Порог выше, чем у встроенного восстановления (3), — сначала пусть
 * отработает бесплатный механизм, и только если он не помог, платим.
 */
export const STALL_THRESHOLD = 8;

export interface EscalationState {
  /** Когда в последний раз обращались к платному движку. */
  lastEscalationAt: number;
  /** Сколько раз обратились за текущую книгу. */
  escalationsThisBook: number;
  /** Отключено ли обращение до конца сессии (бюджет исчерпан, ошибки). */
  disabled: boolean;
}

export function initialEscalationState(): EscalationState {
  return { lastEscalationAt: 0, escalationsThisBook: 0, disabled: false };
}

export interface EscalationInput {
  language: Language;
  /** Сколько спорных токенов подряд не удалось сопоставить. */
  consecutiveMisses: number;
  /** Двигался ли курсор за последнее время. */
  cursorAdvancedRecently: boolean;
  now: number;
  state: EscalationState;
  /** Включена ли функция вообще (флаг + платный тариф). */
  featureEnabled: boolean;
}

export type EscalationDecision =
  | { escalate: false; reason: "disabled" | "language" | "no_stall" | "too_soon" | "book_limit" }
  | { escalate: true; segmentSeconds: number };

/**
 * Главное решение. Намеренно консервативное: при любых сомнениях
 * возвращаем «не обращаться» — бесплатный движок продолжит работать,
 * а деньги останутся у проекта.
 */
export function shouldEscalate(input: EscalationInput): EscalationDecision {
  const { language, consecutiveMisses, cursorAdvancedRecently, now, state, featureEnabled } = input;

  if (!featureEnabled || state.disabled) return { escalate: false, reason: "disabled" };

  // Ограничитель 1: только казахский.
  if (language !== "kk") return { escalate: false, reason: "language" };

  // Ограничитель 2: только при настоящем сбое. Если курсор двигается,
  // бесплатный движок справляется — платить не за что.
  if (cursorAdvancedRecently || consecutiveMisses < STALL_THRESHOLD) {
    return { escalate: false, reason: "no_stall" };
  }

  // Ограничитель 4a: не чаще, чем раз в интервал.
  if (now - state.lastEscalationAt < MIN_INTERVAL_MS) {
    return { escalate: false, reason: "too_soon" };
  }

  // Ограничитель 4b: не больше K раз за книгу.
  if (state.escalationsThisBook >= MAX_ESCALATIONS_PER_BOOK) {
    return { escalate: false, reason: "book_limit" };
  }

  return { escalate: true, segmentSeconds: SEGMENT_SECONDS };
}

/** Фиксирует состоявшееся обращение. */
export function recordEscalation(state: EscalationState, now: number): EscalationState {
  return {
    ...state,
    lastEscalationAt: now,
    escalationsThisBook: state.escalationsThisBook + 1,
  };
}

/** Сброс на новой книге. */
export function resetForNewBook(state: EscalationState): EscalationState {
  return { ...state, escalationsThisBook: 0 };
}

/** Выключает платный путь до конца сессии (бюджет исчерпан или сбои). */
export function disableEscalation(state: EscalationState): EscalationState {
  return { ...state, disabled: true };
}

/**
 * Оценка стоимости сессии — чтобы можно было показать её в админке
 * и следить, что реальность совпадает с моделью.
 */
export const TENGE_PER_MINUTE = 2.5;

export function estimateSessionCost(escalations: number): number {
  return (escalations * SEGMENT_SECONDS / 60) * TENGE_PER_MINUTE;
}
