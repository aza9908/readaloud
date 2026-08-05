/**
 * auth.ts — подтверждение личности родителя для чувствительных действий.
 *
 * Используется при сбросе родительского кода: ребёнок не знает пароля от
 * почты родителя, поэтому повторный вход в аккаунт — надёжное доказательство
 * права. «Секретный вопрос» здесь не годится: ребёнок из той же семьи знает
 * и кличку собаки, и девичью фамилию мамы.
 */

import {
  reauthenticateWithPopup,
  signInWithPopup,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

/**
 * Требует от родителя заново войти в аккаунт.
 * Для анонимных сессий переавторизация невозможна — тогда просто выполняем
 * обычный вход, что тоже подтверждает владение аккаунтом.
 */
export async function reauthenticateParent(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("not-signed-in");

  if (user.isAnonymous) {
    await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    return;
  }
  await reauthenticateWithPopup(user, googleProvider, browserPopupRedirectResolver);
}
