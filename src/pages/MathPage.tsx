/**
 * MathPage — раздел «Математика»: задачи 1–4 классов с загрузкой решения
 * фотографией из тетради.
 *
 * Ключевое решение интерфейса: съёмка ТОЛЬКО камерой (capture="environment").
 * На телефоне это открывает камеру сразу, минуя галерею, — уже отсекает
 * большинство попыток загрузить скриншот. Остальное ловит проверка снимка.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Camera, Check, Loader2, Coins, Lightbulb, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, submitMathSolution, awardMathCoins } from "@/lib/firestore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { compressImage } from "@/lib/imageCompress";
import { inspectPhoto } from "@/lib/photoInspect";
import {
  DIFFICULTY_LABEL, DIFFICULTY_COLOR, gradeForAge,
  type Difficulty, type Grade, type MathTask,
} from "@/lib/mathTasks";
import { dailyTasks, DAILY_TASK_LIMIT } from "@/lib/mathGenerator";
import { checkSolution, CHECK_ERROR_MESSAGE, type MathVerdict } from "@/lib/mathCheck";
import { VERDICT_MESSAGE } from "@/lib/photoAuthenticity";
import type { ChildProfile } from "@/lib/types";

const GRADES: Grade[] = [1, 2, 3, 4];
const LEVELS: Difficulty[] = ["A", "B", "C"];

export default function MathPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const profileId = new URLSearchParams(search).get("profile") ?? "";

  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [grade, setGrade] = useState<Grade>(2);
  const [level, setLevel] = useState<Difficulty | "all">("all");
  const [active, setActive] = useState<MathTask | null>(null);

  useEffect(() => {
    if (!user || !profileId) return;
    void getProfile(user.uid, profileId).then((p) => {
      setProfile(p);
      if (p) setGrade(gradeForAge(p.age));
    });
  }, [user, profileId]);

  /**
   * Комплект задач на сегодня. Генерируется от даты, поэтому в течение дня
   * он один и тот же (можно закрыть приложение и вернуться), а назавтра
   * будет другой. Задач ровно шесть — столько же, сколько разрешено
   * проверок в сутки.
   */
  const tasks = useMemo(() => {
    const day = dailyTasks(grade);
    return level === "all" ? day : day.filter((t) => t.difficulty === level);
  }, [grade, level]);

  if (!user || !profile) return null;

  return (
    <div className="min-h-dvh px-4 py-4 max-w-3xl mx-auto pb-16">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center mb-6 gap-2">
        <div className="justify-self-start">
          <button className="btn-ghost !py-2 !px-3"
            onClick={() => navigate(`/library?profile=${profileId}`)} aria-label="Назад">
            <ArrowLeft className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>
        <h1 className="justify-self-center font-display font-extrabold text-lg text-ink dark:text-white">
          Математика
        </h1>
        <div className="justify-self-end"><ThemeToggle /></div>
      </header>

      <div className="card p-3 mb-4 flex items-center gap-3">
        <span className="text-2xl">📅</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink dark:text-white">Задачи на сегодня</p>
          <p className="text-[11px] text-ink-faint">
            Каждый день новые. Проверок с ИИ: {DAILY_TASK_LIMIT} в сутки
          </p>
        </div>
      </div>

      {/* Класс */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-ink-faint shrink-0">Класс:</span>
        {GRADES.map((g) => (
          <button key={g} onClick={() => setGrade(g)}
            className={`chip shrink-0 ${grade === g ? "chip-on" : "chip-off"}`}>
            {g}
          </button>
        ))}
      </div>

      {/* Уровень сложности */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-ink-faint shrink-0">Уровень:</span>
        <button onClick={() => setLevel("all")}
          className={`chip shrink-0 ${level === "all" ? "chip-on" : "chip-off"}`}>Все</button>
        {LEVELS.map((d) => (
          <button key={d} onClick={() => setLevel(d)}
            className={`chip shrink-0 ${level === d ? "chip-on" : "chip-off"}`}>
            {d} · {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tasks.length === 0 && (
          <div className="card p-8 text-center text-ink-faint text-sm">
            Для этого класса и уровня задач пока нет.
          </div>
        )}
        {tasks.map((t) => (
          <button key={t.id} onClick={() => setActive(t)}
            className="card p-4 w-full text-left hover:-translate-y-0.5 hover:shadow-lift transition-all">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-9 h-9 rounded-xl grid place-items-center font-display font-extrabold text-white text-sm"
                style={{ backgroundColor: DIFFICULTY_COLOR[t.difficulty] }}>
                {t.difficulty}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink dark:text-white leading-snug">{t.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-ink-faint">{t.topic}</span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <Coins className="w-3 h-3" strokeWidth={2.4} />{t.coins}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <TaskSheet task={active} uid={user.uid} profileId={profileId}
          onClose={() => setActive(null)} />
      )}
    </div>
  );
}

/** Карточка задачи с загрузкой фотографии решения. */
function TaskSheet({ task, uid, profileId, onClose }: {
  task: MathTask; uid: string; profileId: string; onClose: () => void;
}) {
  const [file, setFile] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<null | { kind: string; text: string; reasons: string[] }>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [ai, setAi] = useState<MathVerdict | null>(null);
  const [aiCoins, setAiCoins] = useState(0);
  const [aiUsed, setAiUsed] = useState(0);
  const [aiError, setAiError] = useState("");

  const onPick = async (f: File | undefined) => {
    if (!f) return;
    setChecking(true);
    setVerdict(null);
    try {
      // Сначала проверяем подлинность — на исходном файле, до сжатия:
      // сжатие стирает данные камеры, по которым и опознаётся скриншот.
      const check = await inspectPhoto(f);
      const small = await compressImage(f);
      setFile(small);
      setVerdict({
        kind: check.verdict,
        text: VERDICT_MESSAGE[check.verdict],
        reasons: check.reasons,
      });
    } finally {
      setChecking(false);
    }
  };

  /**
   * Отправка на проверку. Порядок важен: сначала бесплатная проверка
   * подлинности снимка (скриншот дальше не пойдёт и не потратит платный
   * вызов), и только потом модель смотрит на решение.
   */
  const send = async () => {
    if (!file || !verdict || verdict.kind === "rejected") return;
    setSending(true);
    try {
      const res = await checkSolution({
        profileId,
        photoDataUrl: file,
        taskText: task.text,
        correctAnswer: task.answer,
        difficulty: task.difficulty,
      });

      setAiUsed(res.used);
      if (res.ok && res.verdict) {
        setAi(res.verdict);
        // Монеты начисляем только за верное решение С показанным ходом:
        // иначе достаточно списать ответ, а это ровно то, чего мы избегаем.
        const earned = res.verdict.correct
          ? (res.verdict.hasWorking ? task.coins : Math.round(task.coins / 2))
          : 0;
        setAiCoins(earned);
        if (earned > 0) await awardMathCoins(uid, profileId, earned);
      } else {
        setAiError(CHECK_ERROR_MESSAGE[res.reason ?? "network"]);
      }

      // Работа сохраняется в любом случае — даже если ИИ не ответил,
      // родитель должен увидеть её в дашборде.
      await submitMathSolution(uid, profileId, {
        taskId: task.id, photo: file, difficulty: task.difficulty,
        grade: task.grade, coins: task.coins,
        authenticity: verdict.kind, authenticityReasons: verdict.reasons,
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}>
      <div className="sheet max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold text-white"
            style={{ backgroundColor: DIFFICULTY_COLOR[task.difficulty] }}>
            {task.difficulty} · {DIFFICULTY_LABEL[task.difficulty]}
          </span>
          <button className="text-2xl text-ink-faint w-8 h-8" onClick={onClose}>×</button>
        </div>

        <p className="text-base text-ink dark:text-white leading-relaxed mb-4">{task.text}</p>

        {task.hint && (
          <div className="mb-4">
            {showHint ? (
              <div className="rounded-2xl bg-amber-400/10 border border-amber-400/25 p-3">
                <p className="text-sm text-ink-soft dark:text-ink-faint">{task.hint}</p>
              </div>
            ) : (
              <button className="btn-ghost !py-2 text-sm" onClick={() => setShowHint(true)}>
                <Lightbulb className="w-4 h-4 inline -mt-0.5 mr-1.5" strokeWidth={2.2} />
                Подсказка
              </button>
            )}
          </div>
        )}

        {sent ? (
          <div className="text-center py-4">
            {ai ? (
              <>
                <div className="text-5xl mb-2">{ai.correct ? "🎉" : "💪"}</div>
                <p className="font-display font-bold text-xl text-ink dark:text-white">
                  {ai.correct ? "Верно!" : "Почти получилось"}
                </p>
                <p className="text-sm text-ink-soft dark:text-ink-faint mt-2 leading-relaxed px-2">
                  {ai.feedback}
                </p>

                {!ai.correct && ai.mistake && (
                  <div className="rounded-2xl bg-amber-400/10 border border-amber-400/25 p-3 mt-3 text-left">
                    <p className="text-xs font-bold text-ink dark:text-white mb-1">Где ошибка</p>
                    <p className="text-sm text-ink-soft dark:text-ink-faint">{ai.mistake}</p>
                  </div>
                )}

                {ai.correct && !ai.hasWorking && (
                  <div className="rounded-2xl bg-brand-500/8 border border-brand-500/20 p-3 mt-3">
                    <p className="text-xs text-ink-soft dark:text-ink-faint leading-relaxed">
                      Ответ правильный, но не видно, как ты его получил. Покажи вычисления —
                      и получишь полную награду.
                    </p>
                  </div>
                )}

                {aiCoins > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-400/15 border border-amber-400/30 px-4 py-2 mt-3">
                    <Coins className="w-4 h-4 text-amber-500" strokeWidth={2.4} />
                    <span className="font-display font-extrabold text-lg text-amber-600 dark:text-amber-400">
                      +{aiCoins}
                    </span>
                  </div>
                )}

                <p className="text-[11px] text-ink-faint mt-3">
                  Проверок сегодня: {aiUsed} из {DAILY_TASK_LIMIT}
                </p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">📸</div>
                <p className="font-display font-bold text-lg text-ink dark:text-white">Работа отправлена</p>
                <p className="text-sm text-ink-faint mt-1">{aiError || "Родители проверят решение."}</p>
              </>
            )}
            <button className="btn-primary w-full mt-4" onClick={onClose}>Готово</button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border-2 border-dashed border-brand-400/40 p-4 text-center">
              {file ? (
                <img src={file} alt="решение" className="max-h-56 mx-auto rounded-xl" />
              ) : (
                <>
                  <Camera className="w-10 h-10 mx-auto text-brand-400 mb-2" strokeWidth={1.8} />
                  <p className="text-sm text-ink-soft dark:text-ink-faint">
                    Реши задачу в тетради и сфотографируй
                  </p>
                  <p className="text-[11px] text-ink-faint mt-1">
                    Обязательно покажи, как решал — не только ответ
                  </p>
                </>
              )}

              <label className="btn-primary inline-flex mt-3 cursor-pointer">
                {checking ? (
                  <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />Проверяю…</>
                ) : (
                  <><Camera className="w-4 h-4 inline mr-2" strokeWidth={2.2} />
                  {file ? "Переснять" : "Сфотографировать"}</>
                )}
                {/* capture открывает камеру напрямую, минуя галерею —
                    это отсекает большинство попыток подсунуть скриншот */}
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => void onPick(e.target.files?.[0])} />
              </label>
            </div>

            {verdict && (
              <div className={`mt-3 rounded-2xl p-3 border ${
                verdict.kind === "rejected" ? "bg-red-500/10 border-red-500/30"
                : verdict.kind === "suspicious" ? "bg-amber-400/10 border-amber-400/30"
                : "bg-emerald-500/10 border-emerald-500/30"}`}>
                <p className="text-sm font-bold text-ink dark:text-white flex items-center gap-1.5">
                  {verdict.kind === "rejected" ? <X className="w-4 h-4 text-red-500" strokeWidth={2.6} />
                   : <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.6} />}
                  {verdict.text}
                </p>
              </div>
            )}

            <button className="btn-primary w-full mt-4"
              disabled={!file || checking || sending || verdict?.kind === "rejected"}
              onClick={() => void send()}>
              {sending
                ? <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />Проверяю решение…</>
                : "Отправить на проверку"}
            </button>
            <p className="text-[11px] text-ink-faint mt-3 leading-relaxed">
              Решение проверяют родители. Фотография должна быть из твоей тетради —
              снимки с экрана не принимаются.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
