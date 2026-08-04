/**
 * parentGate.ts — четырёхзначный код, закрывающий родительский дашборд.
 *
 * ЗАЧЕМ. Дашборд показывает статистику ребёнка, управление наградами и списание
 * монет. Без замка ребёнок может сам себе выдать награду — то есть вся система
 * мотивации обесценивается.
 *
 * ЧТО ЭТО НЕ ЕСТЬ. Это не защита от взломщика: код хранится в Firestore, а
 * приложение открытое. Это замок «от ребёнка» — ровно та задача, которая здесь
 * и стоит. Поэтому код не отправляется в открытом виде: хранится хеш, чтобы
 * ребёнок не подсмотрел цифры даже открыв консоль браузера.
 *
 * Модуль чистый и покрыт тестами: test/parentGate.test.mjs
 */

/** Сколько неверных попыток подряд до временной блокировки. */
export const MAX_ATTEMPTS = 5;

/** На сколько блокируем ввод после исчерпания попыток. */
export const LOCKOUT_MS = 60_000;

/** Код ровно из четырёх цифр. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Хеш кода. Соль — идентификатор аккаунта, чтобы одинаковые коды у разных
 * семей давали разные хеши, и по базе нельзя было найти «всех с кодом 1234».
 *
 * Используем SubtleCrypto (есть во всех современных браузерах). Это не защита
 * от подбора четырёх цифр — их всего 10 000, — а защита от подглядывания.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`bookser:${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface GateState {
  /** Сколько неверных попыток подряд. */
  attempts: number;
  /** До какого времени ввод заблокирован (0 — не заблокирован). */
  lockedUntil: number;
}

export function initialGateState(): GateState {
  return { attempts: 0, lockedUntil: 0 };
}

/** Заблокирован ли ввод прямо сейчас. */
export function isLockedOut(state: GateState, now: number): boolean {
  return state.lockedUntil > now;
}

/** Сколько секунд осталось до разблокировки. */
export function lockoutSecondsLeft(state: GateState, now: number): number {
  return Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
}

/** Регистрирует неверную попытку и при переборе включает паузу. */
export function registerFailure(state: GateState, now: number): GateState {
  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    // Пауза важнее счётчика: ребёнок не станет ждать минуту ради подбора,
    // а родитель, ошибшийся пару раз, не окажется заперт навсегда.
    return { attempts: 0, lockedUntil: now + LOCKOUT_MS };
  }
  return { attempts, lockedUntil: 0 };
}

/** Сбрасывает состояние после верного ввода. */
export function registerSuccess(): GateState {
  return initialGateState();
}

/** Сколько попыток осталось до паузы. */
export function attemptsLeft(state: GateState): number {
  return Math.max(0, MAX_ATTEMPTS - state.attempts);
}

/**
 * Как долго разрешение действует после верного ввода. Родителю не нужно
 * набирать код на каждый чих, но и оставлять дашборд открытым навсегда нельзя —
 * ребёнок возьмёт телефон следом.
 */
export const UNLOCK_TTL_MS = 10 * 60_000;

export function isUnlockFresh(unlockedAt: number | null, now: number): boolean {
  return unlockedAt !== null && now - unlockedAt < UNLOCK_TTL_MS;
}
