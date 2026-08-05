/**
 * tournament.ts — матчи «математический футбол» и чтение на скорость.
 *
 * АРХИТЕКТУРА. Матч — это один документ в Firestore, за которым следят все
 * участники через onSnapshot. Отдельного сервера не нужно: раунды короткие,
 * а участников максимум шестеро. Каждый игрок пишет ТОЛЬКО свой ответ, а
 * победитель раунда вычисляется на клиенте из общего документа одинаково у
 * всех — поэтому расхождений быть не может.
 *
 * ЧЕСТНОСТЬ. Задачи и правильные ответы кладутся в документ при СОЗДАНИИ
 * матча, но ответы не показываются: клиент получает их вместе с задачей.
 * Это осознанный компромисс — школьник теоретически может открыть консоль и
 * подсмотреть. Прятать ответы на сервере означало бы вызов функции на каждый
 * раунд (деньги и задержка), а цена жульничества здесь — виртуальные монеты
 * в детской игре. Если понадобится, ответы легко перенести в функцию.
 *
 * ОТКЛЮЧЕНИЯ. У раунда есть срок (deadline). Если игрок не ответил до него,
 * раунд закрывается без его ответа — матч не может зависнуть из-за того, что
 * кто-то закрыл вкладку.
 */

import type { Grade } from "./mathTasks";

/** Сколько секунд даётся на задачу. */
export const ROUND_SECONDS = 20;

/** Раундов в матче. */
export const ROUNDS_PER_MATCH = 5;

export type MatchMode = "1v1" | "2v2" | "3v3";
export type MatchKind = "math" | "reading";
export type MatchStatus = "waiting" | "playing" | "finished";

export const MODE_SIZE: Record<MatchMode, number> = { "1v1": 1, "2v2": 2, "3v3": 3 };

export interface MatchPlayer {
  profileId: string;
  name: string;
  avatar: string;
  team: "A" | "B";
}

export interface MatchRound {
  /** Условие, которое видят все. */
  question: string;
  /** Варианты ответа — на время отвечать текстом слишком долго. */
  options: string[];
  /** Индекс правильного варианта. */
  correct: number;
}

export interface MatchAnswer {
  option: number;
  /** Сколько миллисекунд ушло — при равенстве очков решает скорость. */
  ms: number;
}

export interface Match {
  id: string;
  kind: MatchKind;
  mode: MatchMode;
  grade: Grade;
  status: MatchStatus;
  players: MatchPlayer[];
  rounds: MatchRound[];
  /** Номер текущего раунда, от 0. */
  currentRound: number;
  /** Когда истекает текущий раунд (мс эпохи) — общий для всех. */
  roundDeadline: number;
  /** Ответы: `${round}:${profileId}` → ответ. */
  answers: Record<string, MatchAnswer>;
  createdAt: number;
}

/** Очки команды по всем сыгранным раундам. */
export function teamScores(match: Match): { A: number; B: number } {
  const score = { A: 0, B: 0 };
  for (let r = 0; r < match.rounds.length; r++) {
    const correct = match.rounds[r]?.correct;
    for (const p of match.players) {
      const a = match.answers[`${r}:${p.profileId}`];
      if (a && a.option === correct) score[p.team] += 1;
    }
  }
  return score;
}

/** Суммарное время команды — тай-брейк при равенстве очков. */
export function teamTime(match: Match, team: "A" | "B"): number {
  let total = 0;
  for (let r = 0; r < match.rounds.length; r++) {
    for (const p of match.players.filter((x) => x.team === team)) {
      const a = match.answers[`${r}:${p.profileId}`];
      total += a ? a.ms : ROUND_SECONDS * 1000;
    }
  }
  return total;
}

export type MatchOutcome = "A" | "B" | "draw";

export function matchWinner(match: Match): MatchOutcome {
  const s = teamScores(match);
  if (s.A !== s.B) return s.A > s.B ? "A" : "B";
  // Ничья по очкам — сравниваем время: кто решал быстрее, тот и выиграл.
  const tA = teamTime(match, "A");
  const tB = teamTime(match, "B");
  if (tA === tB) return "draw";
  return tA < tB ? "A" : "B";
}

/** Все ли ответили в текущем раунде — тогда не ждём таймер. */
export function roundComplete(match: Match): boolean {
  return match.players.every(
    (p) => match.answers[`${match.currentRound}:${p.profileId}`] !== undefined,
  );
}

/** Истёк ли срок текущего раунда. */
export function roundExpired(match: Match, now: number): boolean {
  return now >= match.roundDeadline;
}

/**
 * Награда за матч. Победа даёт заметно больше — иначе нет смысла стараться,
 * но и проигравший получает немного, чтобы поражение не отбивало охоту
 * играть снова. Это детская игра, а не спорт на выбывание.
 */
export const MATCH_REWARD = {
  win: 120,
  draw: 60,
  loss: 25,
} as const;

export function rewardFor(outcome: MatchOutcome, myTeam: "A" | "B"): number {
  if (outcome === "draw") return MATCH_REWARD.draw;
  return outcome === myTeam ? MATCH_REWARD.win : MATCH_REWARD.loss;
}
