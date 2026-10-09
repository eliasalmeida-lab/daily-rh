"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { AREA_KEYS } from "@/lib/domain/areas";
import type { AreaDoc, AreaKey, DailyHistoryEntry, MetaDoc, PautaData } from "@/types/domain";

type Store = Partial<Record<AreaKey, AreaDoc>>;
type History = Partial<Record<AreaKey, DailyHistoryEntry[]>>;

interface StoreCtx {
  store: Store;
  history: History;
  meta: MetaDoc;
  /** true depois que todas as áreas responderam pela primeira vez. */
  ready: boolean;
  /** Conexão do navegador. Offline, as gravações ficam no dispositivo e sincronizam ao voltar. */
  online: boolean;
  /** Conteúdo vigente de uma área (current, senão draft). */
  activeData: (area: AreaKey) => PautaData;
  /** Versão mais recente entre rascunho e pauta salva — usada para editar. */
  workingData: (area: AreaKey) => PautaData;
  saveDraft: (area: AreaKey, data: PautaData) => Promise<void>;
  savePauta: (area: AreaKey, data: PautaData) => Promise<void>;
  finalizeDaily: (all: Record<AreaKey, PautaData>, savedAt: string, next: Record<AreaKey, PautaData>) => Promise<void>;
}

const noop = async () => {};

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

const Ctx = createContext<StoreCtx>({
  store: {},
  history: {},
  meta: {},
  ready: false,
  online: true,
  activeData: () => ({}),
  workingData: () => ({}),
  saveDraft: noop,
  savePauta: noop,
  finalizeDaily: noop,
});

const todayBR = () =>
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Remove chaves undefined (Firestore rejeita). */
function clean<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

/**
 * Assina em tempo real `rh-daily/{area}`, a subcoleção `history` de cada área
 * e `rh-daily/_meta`. Também expõe as ações de gravação (rascunho, pauta e
 * finalização da daily), espelhando o fluxo do index.html original.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>({});
  const [history, setHistory] = useState<History>({});
  const [meta, setMeta] = useState<MetaDoc>({});
  const [ready, setReady] = useState(false);
  const seen = useRef(new Set<AreaKey>());
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    const unsubs = AREA_KEYS.map((a) =>
      onSnapshot(doc(db, "rh-daily", a), (snap) => {
        const data = snap.exists() ? (snap.data() as AreaDoc) : {};
        setStore((prev) => ({
          ...prev,
          [a]: {
            draft: data.draft ?? null,
            current: data.current ?? null,
            pautaHistory: data.pautaHistory ?? [],
            prioHistory: data.prioHistory ?? [],
          },
        }));
        seen.current.add(a);
        if (seen.current.size === AREA_KEYS.length) setReady(true);
      }),
    );

    const unsubHist = AREA_KEYS.map((a) =>
      onSnapshot(collection(db, "rh-daily", a, "history"), (snap) => {
        const list = snap.docs.map((d) => d.data() as DailyHistoryEntry);
        list.sort((x, y) => String(y.savedAt ?? "").localeCompare(String(x.savedAt ?? "")));
        setHistory((prev) => ({ ...prev, [a]: list }));
      }),
    );

    const unsubMeta = onSnapshot(doc(db, "rh-daily", "_meta"), (snap) => {
      if (snap.exists()) setMeta(snap.data() as MetaDoc);
    });

    return () => {
      unsubs.forEach((u) => u());
      unsubHist.forEach((u) => u());
      unsubMeta();
    };
  }, []);

  const activeData = (area: AreaKey): PautaData => store[area]?.current || store[area]?.draft || {};

  const workingData = (area: AreaKey): PautaData => {
    const { draft, current } = store[area] ?? {};
    if (draft && current) {
      return new Date(current.savedAt ?? 0) >= new Date(draft.savedAt ?? 0) ? current : draft;
    }
    return draft || current || {};
  };

  const saveDraft = useCallback(async (area: AreaKey, data: PautaData) => {
    await setDoc(doc(db, "rh-daily", area), { draft: clean(data) }, { merge: true });
  }, []);

  /** Grava a pauta vigente e atualiza (ou cria) a entrada do dia no histórico. */
  const savePauta = useCallback(
    async (area: AreaKey, data: PautaData) => {
      const d: PautaData = clean({ ...data, finalized: true, date: todayBR(), savedAt: data.savedAt ?? new Date().toISOString() });
      const hist = [...(store[area]?.pautaHistory ?? [])];
      const idx = hist.findIndex((h) => h?.date === d.date);
      if (idx >= 0) hist[idx] = { ...hist[idx], ...d };
      else hist.unshift(d);
      // Uma única escrita (pauta + histórico) evita corrida com o onSnapshot.
      await setDoc(doc(db, "rh-daily", area), { current: d, pautaHistory: hist, draft: null }, { merge: true });
    },
    [store],
  );

  /** Arquiva todas as áreas como uma daily, zera as pautas e conta +1. */
  const finalizeDaily = useCallback(
    async (all: Record<AreaKey, PautaData>, savedAt: string, next: Record<AreaKey, PautaData>) => {
      const date = todayBR();
      for (const a of AREA_KEYS) {
        const d: PautaData = clean({ ...all[a], finalized: true, date, savedAt });
        await addDoc(collection(db, "rh-daily", a, "history"), d);
        const hist = [d, ...(store[a]?.pautaHistory ?? []).filter((h) => h?.date !== date)];
        await setDoc(
          doc(db, "rh-daily", a),
          {
            pautaHistory: hist,
            current: null,
            draft: clean({ ...next[a], savedAt }),
          },
          { merge: true },
        );
      }
      await setDoc(doc(db, "rh-daily", "_meta"), { dailysCount: (meta.dailysCount ?? 0) + 1 }, { merge: true });
    },
    [store, meta.dailysCount],
  );

  return (
    <Ctx.Provider
      value={{ store, history, meta, ready, online, activeData, workingData, saveDraft, savePauta, finalizeDaily }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);
