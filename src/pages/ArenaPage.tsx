/**
 * ArenaPage — «Матч»: соревнование по математике или чтению.
 *
 * ИНТЕРФЕЙС. За образец взят вид спортивного матча, а не карточного стола:
 * две команды напротив друг друга, крупный таймер посередине, большие
 * кнопки-ответы. От азартных игр сознательно взято только хорошее — понятный
 * ритм раунда и живая реакция на ход соперника. Чего здесь нет намеренно:
 * ставок, «банка», сукна, фишек и любого языка выигрыша-проигрыша денег.
 * Проигравший тоже получает монеты, а таймер показан спокойным кольцом,
 * а не тикающей красной полосой — детей не нужно взвинчивать.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Swords, Users, Loader2, Trophy, Coins } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getProfile, findOrCreateMatch, watchMatch, submitMatchAnswer,
  advanceMatchRound, awardMatchCoins, grantTournamentAvatar, leaveWaitingMatch,
} from "@/lib/firestore";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { dailyTasks } from "@/lib/mathGenerator";
import { gradeForAge, type Grade } from "@/lib/mathTasks";
import {
  ROUND_SECONDS, ROUNDS_PER_MATCH, MODE_SIZE, teamScores, matchWinner,
  roundComplete, roundExpired, rewardFor, type Match, type MatchMode,
} from "@/lib/tournament";
import { TOURNAMENT_AVATARS } from "@/lib/avatars";
import { tapFeedback, successFeedback, celebrateFeedback } from "@/lib/haptics";
import type { ChildProfile } from "@/lib/types";

const MODES: MatchMode[] = ["1v1", "2v2", "3v3"];

export default function ArenaPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const profileId = new URLSearchParams(useSearch()).get("profile") ?? "";

  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user || !profileId) return;
    void getProfile(user.uid, profileId).then(setProfile);
  }, [user, profileId]);

  useEffect(() => {
    if (!matchId) return;
    return watchMatch(matchId, (m) => setMatch(m as unknown as Match | null));
  }, [matchId]);

  const startMatch = async (mode: MatchMode) => {
    if (!profile || joining) return;
    setJoining(true);
    try {
      const grade = gradeForAge(profile.age) as Grade;
      const id = await findOrCreateMatch({
        kind: "math", mode, grade,
        player: { profileId: profile.id, name: profile.name, avatar: profile.avatar },
        buildRounds: (g: number) => buildMathRounds(g as Grade),
      });
      setMatchId(id);
    } finally {
      setJoining(false);
    }
  };

  if (!user || !profile) return null;

  return (
    <div className="min-h-dvh px-4 py-4 max-w-2xl mx-auto pb-16">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center mb-6 gap-2">
        <div className="justify-self-start">
          <button className="btn-ghost !py-2 !px-3"
            onClick={() => {
              // Уходя с поиска, убираем себя из матча — иначе соперник
              // присоединится к комнате, где никого нет.
              if (matchId && match?.status === "waiting" && profile) {
                void leaveWaitingMatch(matchId, profile.id);
              }
              if (matchId) setMatchId(null);
              else navigate(`/library?profile=${profileId}`);
            }}
            aria-label="Назад">
            <ArrowLeft className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>
        <h1 className="justify-self-center font-display font-extrabold text-lg text-ink dark:text-white">
          Матч
        </h1>
        <div className="justify-self-end"><ThemeToggle /></div>
      </header>

      {!matchId ? (
        <Lobby profile={profile} joining={joining} onPick={startMatch} />
      ) : !match ? (
        <Waiting text="Создаём матч…" />
      ) : match.status === "waiting" ? (
        <Waiting
          text="Ищем соперников…"
          players={match.players}
          need={MODE_SIZE[match.mode] * 2}
          onCancel={() => {
            void leaveWaitingMatch(matchId, profile.id);
            setMatchId(null);
          }}
        />
      ) : match.status === "finished" ? (
        <Result match={match} me={profile} uid={user.uid} onExit={() => setMatchId(null)} />
      ) : (
        <Round match={match} me={profile} matchId={matchId} />
      )}
    </div>
  );
}

/** Выбор режима. */
function Lobby({ profile, joining, onPick }: {
  profile: ChildProfile; joining: boolean; onPick: (m: MatchMode) => void;
}) {
  return (
    <>
      <div className="card p-5 text-center mb-5 bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-500/15 dark:to-indigo-500/10">
        <Swords className="w-10 h-10 mx-auto text-brand-500 mb-2" strokeWidth={2} />
        <p className="font-display font-extrabold text-xl text-ink dark:text-white">
          Математический футбол
        </p>
        <p className="text-sm text-ink-soft dark:text-ink-faint mt-1">
          {ROUNDS_PER_MATCH} задач · {ROUND_SECONDS} секунд на каждую
        </p>
      </div>

      <p className="text-sm font-bold text-ink-faint mb-2">Выбери режим</p>
      <div className="space-y-3">
        {MODES.map((m) => (
          <button key={m} disabled={joining} onClick={() => onPick(m)}
            className="card p-4 w-full flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-lift transition-all disabled:opacity-50">
            <span className="w-12 h-12 rounded-2xl bg-brand-500/10 grid place-items-center shrink-0">
              <Users className="w-6 h-6 text-brand-500" strokeWidth={2.2} />
            </span>
            <div className="text-left flex-1">
              <p className="font-display font-bold text-lg text-ink dark:text-white">{m}</p>
              <p className="text-xs text-ink-faint">
                {MODE_SIZE[m] === 1 ? "Один на один" : `Команда из ${MODE_SIZE[m]}`}
              </p>
            </div>
            {joining && <Loader2 className="w-5 h-5 animate-spin text-brand-400" />}
          </button>
        ))}
      </div>

      <div className="card p-4 mt-5">
        <p className="text-sm font-bold text-ink dark:text-white mb-2">Награды за матч</p>
        <div className="flex flex-wrap gap-2">
          {TOURNAMENT_AVATARS().map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/25 px-3 py-1">
              <span className="text-xs font-bold text-red-600 dark:text-red-400">{a.name.ru}</span>
            </span>
          ))}
        </div>
        <p className="text-[11px] text-ink-faint mt-2 leading-relaxed">
          Этих героев нельзя купить за монеты — только выиграть в матче.
        </p>
      </div>
    </>
  );
}

function Waiting({ text, players, need, onCancel }: {
  text: string; players?: Match["players"]; need?: number; onCancel?: () => void;
}) {
  return (
    <div className="card p-8 text-center">
      <Loader2 className="w-10 h-10 mx-auto text-brand-400 animate-spin mb-4" />
      <p className="font-display font-bold text-lg text-ink dark:text-white">{text}</p>
      {players && need && (
        <>
          <p className="text-sm text-ink-faint mt-1">{players.length} из {need}</p>
          <div className="flex justify-center flex-wrap gap-3 mt-4">
            {players.map((p) => (
              <div key={p.profileId} className="text-center">
                <ProfileAvatar value={p.avatar} size={44} />
                <p className="text-xs font-bold text-ink dark:text-white mt-1">{p.name}</p>
              </div>
            ))}
            {Array.from({ length: need - players.length }).map((_, i) => (
              <div key={`e${i}`} className="text-center opacity-40">
                <div className="w-11 h-11 rounded-full border-2 border-dashed border-ink-faint" />
                <p className="text-xs text-ink-faint mt-1">ждём</p>
              </div>
            ))}
          </div>
        </>
      )}
      {onCancel && (
        <>
          <p className="text-xs text-ink-faint mt-5 leading-relaxed">
            Соперник появится, когда кто-то ещё нажмёт «Играть».
            Позови друга — вы попадёте в один матч.
          </p>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отменить поиск</button>
        </>
      )}
    </div>
  );
}

/** Раунд: вопрос, таймер, ответы, команды по краям. */
function Round({ match, me, matchId }: { match: Match; me: ChildProfile; matchId: string }) {
  const round = match.rounds[match.currentRound];
  const myKey = `${match.currentRound}:${me.id}`;
  const myAnswer = match.answers?.[myKey];
  const [now, setNow] = useState(Date.now());
  const startedRef = useRef(Date.now());

  useEffect(() => {
    startedRef.current = Date.now();
  }, [match.currentRound]);

  // Тик таймера. Раз в 100 мс — достаточно плавно для кольца и дёшево.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, match.roundDeadline - now);
  const secs = Math.ceil(left / 1000);
  const frac = Math.max(0, Math.min(1, left / (ROUND_SECONDS * 1000)));

  // Переводим раунд, когда все ответили или вышло время. Вызвать может
  // любой клиент — на сервере стоит защита от двойного перевода.
  useEffect(() => {
    if (roundComplete(match) || roundExpired(match, now)) {
      void advanceMatchRound(matchId, match.currentRound, match.rounds.length);
    }
  }, [match, now, matchId]);

  const answer = (option: number) => {
    if (myAnswer) return;
    // Отклик сразу по нажатию, до сетевого запроса: ждать ответа сервера,
    // чтобы дать тактильный сигнал, значит потерять ощущение мгновенности.
    if (option === round?.correct) successFeedback();
    else tapFeedback();
    void submitMatchAnswer(matchId, match.currentRound, me.id, option, Date.now() - startedRef.current);
  };

  const teamA = match.players.filter((p) => p.team === "A");
  const teamB = match.players.filter((p) => p.team === "B");
  const myTeam = match.players.find((p) => p.profileId === me.id)?.team ?? "A";
  const score = teamScores(match);

  return (
    <>
      {/* Табло: две команды и счёт, как на спортивном матче */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <TeamStrip players={teamA} match={match} highlight={myTeam === "A"} />
          <div className="text-center shrink-0">
            <p className="font-display font-extrabold text-2xl text-ink dark:text-white tabular-nums">
              {score.A} : {score.B}
            </p>
            <p className="text-[10px] text-ink-faint">
              раунд {match.currentRound + 1} из {match.rounds.length}
            </p>
          </div>
          <TeamStrip players={teamB} match={match} highlight={myTeam === "B"} align="right" />
        </div>
      </div>

      {/* Таймер — спокойное кольцо, а не тревожная полоса */}
      <div className="flex justify-center mb-5">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8"
              className="stroke-black/[0.06] dark:stroke-white/10" />
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" strokeLinecap="round"
              className={frac > 0.3 ? "stroke-brand-500" : "stroke-amber-500"}
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - frac)}
              style={{ transition: "stroke-dashoffset 100ms linear" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-display font-extrabold text-2xl text-ink dark:text-white tabular-nums">
              {secs}
            </span>
          </div>
        </div>
      </div>

      {/* Вопрос */}
      <div className="card p-5 mb-4 text-center">
        <p className="text-lg text-ink dark:text-white leading-relaxed">{round?.question}</p>
      </div>

      {/* Ответы — крупные кнопки, попасть пальцем должно быть легко */}
      <div className="grid grid-cols-2 gap-3">
        {round?.options.map((opt, i) => {
          const picked = myAnswer?.option === i;
          const revealed = myAnswer !== undefined;
          const isRight = revealed && i === round.correct;
          return (
            <button key={i} onClick={() => answer(i)} disabled={revealed}
              className={`rounded-3xl p-5 font-display font-extrabold text-xl transition-all active:scale-95 ${
                isRight ? "bg-emerald-500 text-white"
                : picked ? "bg-red-400 text-white"
                : revealed ? "bg-black/[0.04] dark:bg-white/5 text-ink-faint"
                : "bg-white dark:bg-[#211d2e] text-ink dark:text-white shadow-soft hover:-translate-y-0.5"
              }`}>
              {opt}
            </button>
          );
        })}
      </div>

      {myAnswer && (
        <p className="text-center text-sm text-ink-faint mt-4">
          Ответ принят — ждём остальных…
        </p>
      )}
    </>
  );
}

/** Полоска команды: аватары и отметка, кто уже ответил. */
function TeamStrip({ players, match, highlight, align = "left" }: {
  players: Match["players"]; match: Match; highlight: boolean; align?: "left" | "right";
}) {
  return (
    <div className={`flex-1 flex gap-2 min-w-0 ${align === "right" ? "justify-end" : ""}`}>
      {players.map((p) => {
        const answered = match.answers?.[`${match.currentRound}:${p.profileId}`] !== undefined;
        return (
          <div key={p.profileId} className="text-center">
            <div className={`relative rounded-full ${highlight ? "ring-2 ring-brand-400" : ""}`}>
              <ProfileAvatar value={p.avatar} size={36} />
              {answered && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 grid place-items-center text-white text-[10px] font-bold">
                  ✓
                </span>
              )}
            </div>
            <p className="text-[10px] text-ink-faint truncate max-w-[52px]">{p.name}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Итог матча с наградой. */
function Result({ match, me, uid, onExit }: {
  match: Match; me: ChildProfile; uid: string; onExit: () => void;
}) {
  const myTeam = match.players.find((p) => p.profileId === me.id)?.team ?? "A";
  const outcome = matchWinner(match);
  const won = outcome === myTeam;
  const coins = rewardFor(outcome, myTeam);
  const score = teamScores(match);
  const grantedRef = useRef(false);
  const [trophy, setTrophy] = useState<string | null>(null);

  // Награду выдаём один раз: экран может перерисоваться, а монеты — нет.
  useEffect(() => {
    if (grantedRef.current) return;
    grantedRef.current = true;
    void awardMatchCoins(uid, me.id, match.id, coins);
    if (won) celebrateFeedback();
    if (won) {
      // Победа открывает турнирного героя — того, которого ещё нет.
      const pool = TOURNAMENT_AVATARS();
      const owned = me.unlockedAvatars ?? [];
      const next = pool.find((a) => !owned.includes(a.id));
      if (next) {
        void grantTournamentAvatar(uid, me.id, next.id).then((granted) => {
          if (granted) setTrophy(next.name.ru);
        });
      }
    }
  }, [uid, me, coins, won]);

  return (
    <div className="card p-8 text-center">
      <div className="text-6xl mb-3">{won ? "🏆" : outcome === "draw" ? "🤝" : "💪"}</div>
      <p className="font-display font-extrabold text-2xl text-ink dark:text-white">
        {won ? "Победа!" : outcome === "draw" ? "Ничья!" : "Хорошая игра!"}
      </p>
      <p className="text-lg font-bold text-ink-soft dark:text-ink-faint mt-1 tabular-nums">
        {score.A} : {score.B}
      </p>

      <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-400/15 border border-amber-400/30 px-4 py-2 mt-4">
        <Coins className="w-5 h-5 text-amber-500" strokeWidth={2.4} />
        <span className="font-display font-extrabold text-xl text-amber-600 dark:text-amber-400">
          +{coins}
        </span>
      </div>

      {trophy && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/25 p-4 mt-4">
          <Trophy className="w-8 h-8 mx-auto text-red-500 mb-1" strokeWidth={2} />
          <p className="font-display font-bold text-ink dark:text-white">Новый герой!</p>
          <p className="text-sm text-red-600 dark:text-red-400 font-bold">{trophy}</p>
          <p className="text-[11px] text-ink-faint mt-1">Его нельзя купить — только выиграть</p>
        </div>
      )}

      {!won && outcome !== "draw" && (
        <p className="text-sm text-ink-faint mt-4">
          Монеты начислены всё равно — за игру и старание.
        </p>
      )}

      <button className="btn-primary w-full mt-5" onClick={onExit}>Играть ещё</button>
    </div>
  );
}

/**
 * Готовит раунды матча из задач дня.
 *
 * Задачи те же, что в разделе математики, но с вариантами ответа: за 20 секунд
 * писать решение в тетради невозможно, а выбрать — можно. Неверные варианты
 * строятся близкими к правильному, чтобы угадать было нельзя.
 */
function buildMathRounds(grade: Grade) {
  const pool = dailyTasks(grade);
  const rounds = [];
  for (let i = 0; i < ROUNDS_PER_MATCH; i++) {
    const task = pool[i % pool.length];
    // Берём первое число из ответа как правильный вариант.
    const num = parseInt((task.answer.match(/-?\d+/) ?? ["0"])[0], 10);
    const distractors = [num + 1, num - 1, num + (num > 10 ? 10 : 2)]
      .filter((n) => n !== num && n >= 0);
    const options = [String(num), ...distractors.slice(0, 3).map(String)];
    // Перемешиваем детерминированно от номера раунда, чтобы правильный
    // ответ не оказывался всегда первым.
    const shift = (i * 7) % options.length;
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];
    rounds.push({
      question: task.text,
      options: rotated,
      correct: rotated.indexOf(String(num)),
    });
  }
  return rounds;
}
