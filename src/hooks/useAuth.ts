import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const login = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      // Popup blocked (mobile in-app browsers) → try redirect flow.
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch { /* fall through to error */ }
      }
      if (code === "auth/unauthorized-domain") {
        setError(
          "Домен не авторизован для Google-входа. Добавьте его в Firebase → Authentication → Settings → Authorized domains, либо войдите как гость.",
        );
      } else if (code === "auth/popup-closed-by-user") {
        setError(null); // user just closed it
      } else {
        setError("Не удалось войти через Google. Попробуйте гостевой вход.");
      }
    }
  };

  /** Demo / guest mode — real uid, no domain whitelisting needed. */
  const loginAsGuest = async () => {
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/operation-not-allowed") {
        setError(
          "Гостевой вход выключен. Включите Anonymous в Firebase → Authentication → Sign-in method.",
        );
      } else {
        setError("Не удалось войти как гость.");
      }
    }
  };

  const logout = () => signOut(auth);

  return { user, loading, error, login, loginAsGuest, logout };
}
