import { BookserIcon } from "@/components/BookserIcon";
/**
 * ArenaPage — «Матч»: соревнование по математике или чтению.
 *
 * ИНТЕРФЕЙС. Визуально это стол для карточной игры — сукно, «сданные»
 * карты для вопроса и итога, ответы оформлены как карты с номиналом в
 * уголке. Это осознанный разворот более раннего решения (см. историю
 * коммитов), которое сознательно избегало карточного стола из-за
 * ассоциаций с азартными играми у детей 6–10 лет — теперь взят только
 * ВИЗУАЛЬНЫЙ язык карточного стола, а не его лексика и механики.
 *
 * Что по-прежнему исключено намеренно, даже с картами на столе: ставок,
 * «банка», фишек и любого языка выигрыша-проигрыша денег в тексте.
 * Проигравший команда всё так же получает монеты, а таймер — спокойное
 * кольцо, а не тикающая красная полоса: детей не нужно взвинчивать.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ChevronRight, Swords, Loader2, Trophy, Coins } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getProfile, findOrCreateMatch, watchMatch, submitMatchAnswer,
  advanceMatchRound, awardMatchCoins, grantTournamentAvatar, leaveWaitingMatch,
} from "@/lib/firestore";
import { useFamilyReaders } from "@/components/FamilyReaders";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SectionHeader } from "@/components/RoomControls";
import { dailyTasks } from "@/lib/mathGenerator";
import { gradeForAge, type Grade } from "@/lib/mathTasks";
import {
  ROUND_SECONDS, ROUNDS_PER_MATCH, MODE_SIZE, teamScores, matchWinner,
  roundComplete, roundExpired, rewardFor, type Match, type MatchMode,
} from "@/lib/tournament";
import { TOURNAMENT_AVATARS } from "@/lib/avatars";
import { tapFeedback, successFeedback, celebrateFeedback } from "@/lib/haptics";
import type { ChildProfile } from "@/lib/types";

/** Один формат стола — 2×2. Хватает азарта, не требует собирать шестерых. */
const DEFAULT_MODE: MatchMode = "2v2";

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

  const { portrait } = useFamilyReaders();
  const startMatch = async () => {
    if (!profile || joining) return;
    setJoining(true);
    try {
      const grade = gradeForAge(profile.age) as Grade;
      const id = await findOrCreateMatch({
        kind: "math", mode: DEFAULT_MODE, grade,
        player: { profileId: profile.id, name: profile.name, avatar: portrait(profile.id, profile.avatar) },
        buildRounds: (g: number) => buildMathRounds(g as Grade),
      });
      setMatchId(id);
    } finally {
      setJoining(false);
    }
  };

  if (!user || !profile) return null;

  return (
    <main className="section-shell arena-shell">
      <SectionHeader title="Матч" onBack={() => {
        if (matchId && match?.status === "waiting") {
          void leaveWaitingMatch(matchId, profile.id);
        }
        if (matchId) setMatchId(null);
        else navigate(`/library?profile=${profileId}`);
      }} />

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
    </main>
  );
}

/** Приглашение сесть за стол — один формат, без выбора режима. */
function Lobby({ profile, joining, onPick }: {
  profile: ChildProfile; joining: boolean; onPick: () => void;
}) {
  return (
    <>
      <div className="arena-table match-invite">
        <BookserIcon value="cup" size={70} />
        <p className="font-display font-extrabold text-xl text-white">
          Приглашение за стол
        </p>
        <p className="text-sm text-white/70 mt-1">
          Математический футбол · {ROUNDS_PER_MATCH} задач · {ROUND_SECONDS} секунд на каждую ·
          команда из {MODE_SIZE[DEFAULT_MODE]}
        </p>
        <button disabled={joining} onClick={onPick}
          className="btn-primary mt-5 disabled:opacity-60">
          {joining
            ? <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />Садимся за стол…</>
            : <>Сесть за стол <ChevronRight size={17} aria-hidden="true" /></>}
        </button>
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
    <div className="arena-table p-8 text-center">
      <Loader2 className="w-10 h-10 mx-auto text-amber-300 animate-spin mb-4" />
      <p className="font-display font-bold text-lg text-white">{text}</p>
      {players && need && (
        <>
          <p className="text-sm text-white/60 mt-1">Заняли места: {players.length} из {need}</p>
          <div className="flex justify-center flex-wrap gap-3 mt-4">
            {players.map((p) => (
              <div key={p.profileId} className="text-center">
                <ProfileAvatar profileId={p.profileId} value={p.avatar} size={44} />
                <p className="text-xs font-bold text-white mt-1">{p.name}</p>
              </div>
            ))}
            {Array.from({ length: need - players.length }).map((_, i) => (
              <div key={`e${i}`} className="text-center">
                <div className="arena-seat-empty w-11 h-11 rounded-full" />
                <p className="text-xs text-white/50 mt-1">место свободно</p>
              </div>
            ))}
          </div>
        </>
      )}
      {onCancel && (
        <>
          <p className="text-xs text-white/60 mt-5 leading-relaxed">
            Соперник появится, когда кто-то ещё нажмёт «Играть».
            Позови друга — вы попадёте за один стол.
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
    <div className="arena-table p-4">
      {/* Табло: две команды и счёт, как карты, сданные каждой стороне стола */}
      <div className="arena-card px-4 py-3 mb-4">
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

      {/* Таймер — спокойное кольцо в цвет золотой окантовки стола */}
      <div className="flex justify-center mb-5">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8"
              className="stroke-white/15" />
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" strokeLinecap="round"
              className={frac > 0.3 ? "stroke-amber-300" : "stroke-amber-500"}
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - frac)}
              style={{ transition: "stroke-dashoffset 100ms linear" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-display font-extrabold text-2xl text-white tabular-nums">
              {secs}
            </span>
          </div>
        </div>
      </div>

      {/* Вопрос — карта, сданная в центр стола */}
      <div className="arena-card p-5 mb-4 text-center">
        <p className="text-lg text-ink dark:text-white leading-relaxed">{round?.question}</p>
      </div>

      {/* Ответы — карты с номиналом в уголке, крупные, попасть пальцем легко */}
      <div className="grid grid-cols-2 gap-3">
        {round?.options.map((opt, i) => {
          const picked = myAnswer?.option === i;
          const revealed = myAnswer !== undefined;
          const isRight = revealed && i === round.correct;
          return (
            <button key={i} onClick={() => answer(i)} disabled={revealed}
              className={`arena-answer relative p-5 font-display font-extrabold text-xl transition-all active:scale-95 ${
                isRight ? "!bg-emerald-500 !border-emerald-300 text-white"
                : picked ? "!bg-red-400 !border-red-300 text-white"
                : revealed ? "opacity-45"
                : "text-ink dark:text-white hover:-translate-y-0.5"
              }`}>
              <span className={`absolute top-2 left-3 text-[11px] font-black ${
                isRight || picked ? "text-white/70" : "text-ink-faint/70 dark:text-white/30"
              }`}>{opt}</span>
              {opt}
            </button>
          );
        })}
      </div>

      {myAnswer && (
        <p className="text-center text-sm text-white/60 mt-4">
          Ответ принят — ждём остальных…
        </p>
      )}
    </div>
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
              <ProfileAvatar profileId={p.profileId} value={p.avatar} size={36} />
              {answered && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 grid place-items-center text-white text-[10px] font-bold">
                  <BookserIcon value="✅" size={12} line />
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
    <div className="arena-table p-4">
      <div className="arena-card p-8 text-center">
        <div className="text-6xl mb-3"><BookserIcon value={won ? "cup" : outcome === "draw" ? "🤝" : "💪"} size={76} /></div>
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
