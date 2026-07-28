/**
 * useSttEscalation — оркестратор платного распознавания казахского.
 *
 * Связывает три части, каждая из которых проверена отдельно:
 *   • политику из sttEscalation.ts (когда вообще звать платный движок),
 *   • запись фрагмента из freedomStt.ts (recordSegment),
 *   • серверный прокси (transcribeSegment), где ключ и бюджет минут.
 *
 * Почему отдельный микрофонный поток. Web Speech API держит микрофон сам и не
 * отдаёт сырое аудио. Поэтому для записи фрагмента открываем ПАРАЛЛЕЛЬНЫЙ поток
 * getUserMedia. Он лёгкий и живёт только пока включён платный режим.
 *
 * Весь модуль устроен так, что любая ошибка приводит к «ничего не делаем»:
 * платное распознавание — подстраховка, а не критический путь. Отвалилось —
 * ребёнок продолжает читать на бесплатном браузерном движке.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  shouldEscalate, recordEscalation, resetForNewBook, disableEscalation,
  initialEscalationState, type EscalationState,
} from "@/lib/sttEscalation";
import { recordSegment, transcribeSegment } from "@/lib/freedomStt";
import type { Language } from "@/lib/types";

interface Options {
  /** Включена ли функция (флаг сборки + тариф Blaze). */
  enabled: boolean;
  language: Language;
  profileId: string;
  bookId: string;
  /** Куда отдать распознанный платным движком текст — обычно во выравниватель. */
  onTranscript: (text: string) => void;
}

export function useSttEscalation({ enabled, language, profileId, bookId, onTranscript }: Options) {
  const stateRef = useRef<EscalationState>(initialEscalationState());
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);

  // Открываем/закрываем параллельный микрофонный поток по мере включения.
  useEffect(() => {
    // Только казахский и только при включённой функции — иначе поток не нужен.
    if (!enabled || language !== "kk") return;

    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
      })
      .catch(() => {
        // Нет доступа к микрофону для второго потока — отключаем платный путь.
        stateRef.current = disableEscalation(stateRef.current);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [enabled, language]);

  // Сброс лимита обращений при смене книги.
  useEffect(() => {
    stateRef.current = resetForNewBook(stateRef.current);
  }, [bookId]);

  /**
   * Вызывается движком чтения при застревании. Здесь принимается финальное
   * решение (политика), и только если она разрешает — пишем фрагмент и шлём
   * его прокси.
   */
  const handleStall = useCallback(async () => {
    if (busyRef.current) return;
    const stream = streamRef.current;
    if (!stream) return;

    const decision = shouldEscalate({
      language,
      consecutiveMisses: 999,          // движок зовёт нас уже по факту застревания
      cursorAdvancedRecently: false,
      now: Date.now(),
      state: stateRef.current,
      featureEnabled: enabled,
    });
    if (!decision.escalate) return;

    busyRef.current = true;
    try {
      const seg = await recordSegment(stream, decision.segmentSeconds);
      if (!seg) return;
      stateRef.current = recordEscalation(stateRef.current, Date.now());
      const text = await transcribeSegment(profileId, seg);
      if (text) onTranscript(text);
    } finally {
      busyRef.current = false;
    }
  }, [enabled, language, profileId, onTranscript]);

  return { handleStall };
}
