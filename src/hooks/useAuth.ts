import { useEffect, useState } from "react";
import {
  browserPopupRedirectResolver,
  getRedirectResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

/** Maps Firebase auth error codes to actionable Russian messages. */
function describeAuthError(code: string, host: string): string | null {
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null; // user cancelled — not an error worth showing
    case "auth/unauthorized-domain":
      return `Домен ${host} не разрешён для входа. Firebase Console → Authentication → Settings → Authorized domains → добавьте ${host}.`;
    case "auth/operation-not-allowed":
      return "Провайдер входа выключен. Firebase Console → Authentication → Sign-in method → включите Google и Anonymous.";
    case "auth/network-request-failed":
      return "Нет связи с сервером. Проверьте интернет и попробуйте снова.";
    case "auth/internal-error":
      return "Firebase вернул внутреннюю ошибку. Обычно это значит, что Google-провайдер не настроен до конца (нужен support email в Firebase → Authentication → Google).";
    default:
      return `Не удалось войти (${code || "неизвестная ошибка"}). Попробуйте гостевой вход.`;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // CRITICAL: without this, the signInWithRedirect flow silently does nothing
    // when the user comes back to the page. This was a real bug.
    getRedirectResult(auth).catch((e: { code?: string }) => {
      const msg = describeAuthError(e?.code ?? "", window.location.hostname);
      if (msg) setError(msg);
    });

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = async () => {
    setError(null);
    setBusy(true);
    try {
      // Popup first — best UX on desktop.
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      // Popup blocked / unsupported (in-app browsers, some mobile) → redirect.
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return; // page navigates away
        } catch (e2) {
          const msg = describeAuthError((e2 as { code?: string })?.code ?? "", window.location.hostname);
          if (msg) setError(msg);
        }
      } else {
        const msg = describeAuthError(code, window.location.hostname);
        if (msg) setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  /** Guest mode — real uid, works without domain whitelisting. */
  const loginAsGuest = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInAnonymously(auth);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      setError(
        code === "auth/operation-not-allowed"
          ? "Гостевой вход выключен. Firebase Console → Authentication → Sign-in method → включите Anonymous."
          : describeAuthError(code, window.location.hostname) ?? "Не удалось войти как гость.",
      );
    } finally {
      setBusy(false);
    }
  };

  const logout = () => signOut(auth);

  return { user, loading, busy, error, login, loginAsGuest, logout };
}
