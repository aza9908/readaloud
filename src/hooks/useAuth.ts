import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      // Popup blocked (common in mobile in-app browsers) → redirect flow.
      await signInWithRedirect(auth, googleProvider);
    }
  };

  const logout = () => signOut(auth);

  return { user, loading, login, logout };
}
