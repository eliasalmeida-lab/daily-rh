"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FbUser,
} from "firebase/auth";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import type { AppUser } from "@/types/domain";

/**
 * Usuários padrão (bootstrap). Se a coleção `rh-daily-users` estiver vazia no
 * primeiro login, ela é semeada com estes registros — igual ao index.html.
 */
const DEFAULT_USERS: Record<string, { name: string; admin: boolean; areas?: AppUser["areas"] }> = {
  "elias.almeida@graodireto.com.br": { name: "Elias", admin: true },
  "ana.silva@graodireto.com.br": { name: "Ana Luísa", admin: false, areas: ["dp"] },
  "amanda@graodireto.com": { name: "Amanda", admin: false },
  "ursula@graodireto.com": { name: "Ursula", admin: false },
};

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
});

async function resolveAppUser(fb: FbUser): Promise<AppUser> {
  let map = DEFAULT_USERS;
  try {
    const snap = await getDocs(collection(db, "rh-daily-users"));
    if (!snap.empty) {
      map = {};
      snap.forEach((d) => {
        map[d.id] = d.data() as { name: string; admin: boolean; areas?: AppUser["areas"] };
      });
    } else {
      // Semeia a coleção na primeira vez.
      await Promise.all(
        Object.entries(DEFAULT_USERS).map(([email, u]) =>
          setDoc(doc(db, "rh-daily-users", email), u),
        ),
      );
    }
  } catch {
    // Sem acesso ao Firestore: cai no mapa padrão.
  }
  const email = fb.email ?? "";
  const lower = email.toLowerCase();
  // Usuários embutidos valem mesmo que ainda não estejam cadastrados no Firestore.
  const found = map[email] ?? map[lower] ?? DEFAULT_USERS[lower];
  return found
    ? { email, name: found.name, admin: found.admin, areas: found.areas }
    : { email, name: email.split("@")[0] || "Usuário", admin: false };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      if (fb) {
        const appUser = await resolveAppUser(fb);
        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), senha);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    auth.languageCode = "pt-BR";
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, logout, resetPassword }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
