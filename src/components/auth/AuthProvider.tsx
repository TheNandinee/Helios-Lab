"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useLabStore, type Role } from "@/store/useLabStore";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useLabStore((s) => s.setAuth);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAuth(null, "guest");
        return;
      }
      const token = await u.getIdTokenResult();
      const role = (token.claims.role as Role) ?? "student";

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName ?? u.email?.split("@")[0] ?? "user",
            created_at: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error("User profile sync failed:", err);
      }

      setAuth({ uid: u.uid, email: u.email, displayName: u.displayName }, role);
    });
    return unsub;
  }, [setAuth]);

  return <>{children}</>;
}