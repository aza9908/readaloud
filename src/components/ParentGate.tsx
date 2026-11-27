/**
 * ParentGate — экран ввода родительского кода перед дашбордом.
 *
 * Закрывает управление наградами и списание монет от самого ребёнка.
 * При первом заходе предлагает придумать код, дальше — спрашивает его.
 */

import { useEffect, useState } from "react";
import { RoomSheet } from "./RoomControls";
import { Lock, Delete, ShieldCheck } from "lucide-react";
import {
  isValidPin, hashPin, initialGateState, registerFailure, registerSuccess,
  isLockedOut, lockoutSecondsLeft, attemptsLeft, type GateState,
} from "@/lib/parentGate";
import { getParentPinHash, setParentPinHash, clearParentPinHash } from "@/lib/firestore";
import { reauthenticateParent } from "@/lib/auth";

interface Props {
  uid: string;
  onUnlocked: () => void;
  onCancel: () => void;
}

export function ParentGate({ uid, onUnlocked, onCancel }: Props) {
  const [stored, setStored] = useState<string | null | undefined>(undefined);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [stage, setStage] = useState<"enter" | "create" | "confirm">("enter");
  const [gate, setGate] = useState<GateState>(initialGateState());
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  /**
   * Сброс кода через повторный вход в аккаунт. Ребёнок не знает пароля от
   * почты родителя, поэтому это работает как доказательство права.
   */
  const doReset = async () => {
    setResetError("");
    try {
      await reauthenticateParent();
      await clearParentPinHash(uid);
      setStored(null);
      setStage("create");
      setPin(""); setConfirmPin("");
      setResetting(false);
    } catch {
      setResetError("Не удалось подтвердить вход. Попробуйте ещё раз.");
    }
  };

  // Тикаем, пока действует блокировка, чтобы обратный отсчёт был живым.
  useEffect(() => {
    if (!isLockedOut(gate, Date.now())) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [gate]);

  useEffect(() => {
    void getParentPinHash(uid).then((h) => {
      setStored(h);
      setStage(h ? "enter" : "create");
    });
  }, [uid]);

  const locked = isLockedOut(gate, now);

  const press = (digit: string) => {
    if (locked) return;
    setError("");
    const target = stage === "confirm" ? confirmPin : pin;
    if (target.length >= 4) return;
    const next = target + digit;
    if (stage === "confirm") setConfirmPin(next);
    else setPin(next);
    if (next.length === 4) void submit(next);
  };

  const back = () => {
    setError("");
    if (stage === "confirm") setConfirmPin((v) => v.slice(0, -1));
    else setPin((v) => v.slice(0, -1));
  };

  const submit = async (value: string) => {
    if (stage === "create") {
      if (!isValidPin(value)) { setError("Нужны 4 цифры"); setPin(""); return; }
      setStage("confirm");
      return;
    }

    if (stage === "confirm") {
      if (value !== pin) {
        setError("Коды не совпали — попробуйте ещё раз");
        setPin(""); setConfirmPin(""); setStage("create");
        return;
      }
      const h = await hashPin(value, uid);
      await setParentPinHash(uid, h);
      onUnlocked();
      return;
    }

    // stage === "enter"
    const h = await hashPin(value, uid);
    if (h === stored) {
      setGate(registerSuccess());
      onUnlocked();
    } else {
      const next = registerFailure(gate, Date.now());
      setGate(next);
      setPin("");
      setNow(Date.now());
      setError(
        isLockedOut(next, Date.now())
          ? "Слишком много попыток"
          : `Неверный код. Осталось попыток: ${attemptsLeft(next)}`,
      );
    }
  };

  const shown = stage === "confirm" ? confirmPin : pin;
  const title =
    stage === "create" ? "Придумайте код"
    : stage === "confirm" ? "Повторите код"
    : "Родительский код";
  const subtitle =
    stage === "create" ? "Четыре цифры, которые знаете только вы"
    : stage === "confirm" ? "Введите те же цифры ещё раз"
    : "Введите код, чтобы открыть дашборд";

  if (stored === undefined) {
    return (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 backdrop-blur-sm">
        <p className="text-white/80 text-sm">Загружаю…</p>
      </div>
    );
  }

  return (
    <RoomSheet title={title} onClose={onCancel} className="pin-sheet text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 grid place-items-center mx-auto mb-3">
          {stage === "enter"
            ? <Lock className="w-7 h-7 text-brand-500" strokeWidth={2.2} />
            : <ShieldCheck className="w-7 h-7 text-brand-500" strokeWidth={2.2} />}
        </div>
        <h2 className="font-display font-extrabold text-xl text-ink dark:text-white">{title}</h2>
        <p className="text-sm text-ink-faint mt-1 mb-5">{subtitle}</p>

        {/* Точки-индикаторы вместо цифр — чтобы код нельзя было подсмотреть */}
        <div className="flex justify-center gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                i < shown.length ? "bg-brand-500 scale-110" : "bg-black/10 dark:bg-white/15"
              }`}
            />
          ))}
        </div>

        {error && <p role="alert" className="text-sm font-bold text-red-500 mb-3">{error}</p>}
        {locked && (
          <p className="text-sm text-ink-faint mb-3">
            Подождите {lockoutSecondsLeft(gate, now)} сек.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              disabled={locked}
              className="h-14 rounded-2xl bg-black/[0.04] dark:bg-white/5 font-display font-bold text-xl text-ink dark:text-white active:scale-95 transition-transform disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <button onClick={onCancel}
            className="h-14 rounded-2xl text-sm font-bold text-ink-faint">
            Отмена
          </button>
          <button
            onClick={() => press("0")}
            disabled={locked}
            className="h-14 rounded-2xl bg-black/[0.04] dark:bg-white/5 font-display font-bold text-xl text-ink dark:text-white active:scale-95 transition-transform disabled:opacity-40"
          >
            0
          </button>
          <button onClick={back} aria-label="Удалить последнюю цифру" disabled={locked}
            className="h-14 rounded-2xl grid place-items-center text-ink-faint disabled:opacity-40">
            <Delete className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        {stage === "enter" && (
          <>
            <button
              className="text-xs text-brand-500 font-bold mt-4"
              onClick={() => setResetting(true)}
            >
              Забыли код?
            </button>
            <p className="text-[11px] text-ink-faint mt-2 leading-relaxed">
              Код защищает награды и статистику от самого ребёнка.
            </p>
          </>
        )}

        {/* Сброс кода. Право на сброс подтверждается повторным входом в
            аккаунт Google: владелец аккаунта — родитель, а ребёнок пароля
            от почты не знает. Это надёжнее «секретного вопроса», который
            ребёнок наверняка угадает. */}
        {resetting && (
          <div className="mt-4 rounded-2xl border-2 border-brand-500/20 p-4 text-left">
            <p className="text-sm font-bold text-ink dark:text-white mb-1">Сброс кода</p>
            <p className="text-xs text-ink-faint leading-relaxed mb-3">
              Чтобы задать новый код, подтвердите, что вы владелец аккаунта —
              войдите в него ещё раз.
            </p>
            {resetError && <p className="text-xs text-red-500 mb-2">{resetError}</p>}
            <div className="flex gap-2">
              <button
                className="btn-primary flex-1 !py-2 text-sm"
                onClick={() => void doReset()}
              >
                Подтвердить вход
              </button>
              <button className="btn-ghost !py-2 text-sm" onClick={() => setResetting(false)}>
                Отмена
              </button>
            </div>
          </div>
        )}
    </RoomSheet>
  );
}
