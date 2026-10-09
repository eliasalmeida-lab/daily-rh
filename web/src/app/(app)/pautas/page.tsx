"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/hooks/useStore";
import { useAuth } from "@/lib/hooks/useAuth";
import { Presentation } from "@/components/Presentation";
import { BulletTextarea } from "@/components/BulletTextarea";
import { canEditArea, canFinalize } from "@/lib/domain/permissions";
import { AREAS, AREA_KEYS } from "@/lib/domain/areas";
import {
  STATUS_META,
  STATUS_ORDER,
  blocksOf,
  filledCount,
  newId,
  initials,
  prioListOf,
  weeksBadge,
} from "@/lib/domain/pauta";
import type { AreaKey, PautaData, PrioEntry, PautaBlock } from "@/types/domain";

type Forms = Record<AreaKey, PautaData>;
type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const inputCls =
  "w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-[13.5px] outline-none transition focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--glow)]";

export default function PautasPage() {
  return (
    <Suspense fallback={null}>
      <Pautas />
    </Suspense>
  );
}

function Pautas() {
  const { ready, workingData } = useStore();
  if (!ready) return <Loading />;
  // Os formulários nascem dos dados já carregados (uma única vez).
  const initial = Object.fromEntries(AREA_KEYS.map((a) => {
      const d = workingData(a);
      return [a, { ...d, sections: blocksOf(a, d), priorities: prioListOf(a, d) }];
    })) as Forms;
  return <PautasInner initialForms={initial} />;
}

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-[13px]" style={{ color: "var(--muted)" }}>
      Carregando pautas…
    </div>
  );
}

function PautasInner({ initialForms }: { initialForms: Forms }) {
  const { saveDraft, savePauta, finalizeDaily, store, meta, workingData } = useStore();
  const { user } = useAuth();
  const params = useSearchParams();
  const initialTab = (params.get("area") as AreaKey) || "dp";

  const [tab, setTab] = useState<AreaKey>(AREA_KEYS.includes(initialTab) ? initialTab : "dp");
  const [forms, setForms] = useState<Forms>(initialForms);
  const [dirty, setDirty] = useState<Set<AreaKey>>(new Set());
  const [saveState, setSaveState] = useState<Record<AreaKey, SaveState>>({ dp: "idle", bp: "idle", rs: "idle", est: "idle" });
  const [confirmDaily, setConfirmDaily] = useState(false);
  const [editing, setEditing] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [undo, setUndo] = useState<{ area: AreaKey; sections?: PautaBlock[]; priorities?: PrioEntry[]; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [toast, setToast] = useState("");
  const timers = useRef<Partial<Record<AreaKey, ReturnType<typeof setTimeout>>>>({});
  const formsRef = useRef<Forms>(initialForms);
  const dirtyRef = useRef<Set<AreaKey>>(new Set());
  // savedAt já conhecidos de cada área (carregados ou gravados por mim). Um savedAt
  // diferente vindo do Firestore significa que outra pessoa/aba alterou a pauta.
  const [known, setKnown] = useState<Record<AreaKey, string[]>>(
    () => Object.fromEntries(AREA_KEYS.map((a) => [a, [String(initialForms[a].savedAt ?? "")]])) as Record<AreaKey, string[]>,
  );
  const learn = (a: AreaKey, at: string) => setKnown((p) => ({ ...p, [a]: [...p[a], at] }));
  const markDirty = (a: AreaKey, on: boolean) => {
    const n = new Set(dirtyRef.current);
    if (on) n.add(a);
    else n.delete(a);
    dirtyRef.current = n;
    setDirty(n);
  };

  /** Grava imediatamente os rascunhos que ainda aguardam o debounce. */
  const flushDrafts = () => {
    for (const a of AREA_KEYS) {
      if (!timers.current[a]) continue;
      clearTimeout(timers.current[a]);
      delete timers.current[a];
      const cur = formsRef.current[a];
      const at = new Date().toISOString();
      saveDraft(a, { ...cur, savedAt: at, savedBy: user?.name ?? "" }).catch(() => {});
    }
  };
  const flushRef = useRef(flushDrafts);
  useEffect(() => {
    flushRef.current = flushDrafts;
  });

  // Ao fechar/ocultar a aba: salva o que estiver pendente e avisa se houver risco.
  useEffect(() => {
    const onHide = () => flushRef.current();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.values(timers.current).some(Boolean)) {
        flushRef.current();
        e.preventDefault();
      }
    };
    const onVisibility = () => document.visibilityState === "hidden" && flushRef.current();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Versão mais nova gravada por outra pessoa/aba, se houver.
  const remoteChange = (a: AreaKey) => {
    const r = workingData(a);
    const at = typeof r.savedAt === "string" ? r.savedAt : "";
    return at && !known[a].includes(at) ? r : null;
  };

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach((x) => x && clearTimeout(x));
  }, []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3000);
  };

  function setSave(a: AreaKey, s: SaveState) {
    setSaveState((p) => ({ ...p, [a]: s }));
  }

  function update(a: AreaKey, patch: Partial<PautaData>) {
    if (!canEditArea(user, a)) return;
    setForms((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [a]: { ...prev[a], ...patch } };
      formsRef.current = next;
      return next;
    });
    markDirty(a, true);
    setSave(a, "idle");
    // Autosave do rascunho (debounce).
    clearTimeout(timers.current[a]);
    timers.current[a] = setTimeout(async () => {
      delete timers.current[a];
      const cur = formsRef.current?.[a];
      if (!cur) return;
      const at = new Date().toISOString();
      learn(a, at);
      const write = saveDraft(a, { ...cur, savedAt: at, savedBy: user?.name ?? "" });
      if (!navigator.onLine) {
        // Offline: já está na fila local; sincroniza sozinho ao reconectar.
        setSave(a, "offline");
        write.catch(() => setSave(a, "error"));
        return;
      }
      setSave(a, "saving");
      try {
        await write;
        setSave(a, "saved");
      } catch {
        setSave(a, "error");
      }
    }, 1500);
  }

  /** Aplica uma exclusão guardando o estado anterior para "Desfazer" (8 s). */
  function removeWithUndo(a: AreaKey, patch: Partial<PautaData>, label: string) {
    const f = forms[a];
    setUndo({ area: a, sections: f.sections as PautaBlock[] | undefined, priorities: f.priorities as PrioEntry[] | undefined, label });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
    update(a, patch);
  }

  function doUndo() {
    if (!undo) return;
    clearTimeout(undoTimer.current);
    update(undo.area, { sections: undo.sections, priorities: undo.priorities });
    setUndo(null);
  }

  async function handleSave(a: AreaKey) {
    clearTimeout(timers.current[a]);
    delete timers.current[a];
    const at = new Date().toISOString();
    learn(a, at);
    const write = savePauta(a, { ...forms[a], savedAt: at, savedBy: user?.name ?? "" });
    if (!navigator.onLine) {
      write.catch(() => setSave(a, "error"));
      markDirty(a, false);
      setSave(a, "offline");
      flash("Sem conexão: pauta salva no dispositivo e será sincronizada ao reconectar");
      return;
    }
    setSave(a, "saving");
    try {
      await write;
      markDirty(a, false);
      setSave(a, "saved");
      flash(`Pauta de ${AREAS[a].name} salva`);
    } catch {
      setSave(a, "error");
      flash("Não foi possível salvar. Tente novamente.");
    }
  }

  async function handleFinalize() {
    setConfirmDaily(false);
    AREA_KEYS.forEach((a) => {
      clearTimeout(timers.current[a]);
      delete timers.current[a];
    });
    const at = new Date().toISOString();
    AREA_KEYS.forEach((a) => learn(a, at));
    try {
      // Prioridades não concluídas atravessam a daily e ganham +1 no contador.
      const reset = Object.fromEntries(
        AREA_KEYS.map((a) => {
          const keep: PautaData = {
            priorities: prioListOf(a, forms[a]).map((p) =>
              p.status === "done" ? { ...p, weeks: 0 } : p.text.trim() ? { ...p, weeks: (p.weeks ?? 0) + 1 } : p,
            ),
            sections: blocksOf(a, forms[a]).map((b) => ({ ...b, topics: b.topics.map((t) => ({ ...t, value: "" })) })),
          };
          return [a, keep];
        }),
      ) as Forms;
      await finalizeDaily(forms, at, reset);
      setForms(reset);
      formsRef.current = reset;
      dirtyRef.current = new Set();
      setDirty(new Set());
      flash("Daily finalizada e salva no histórico");
    } catch {
      flash("Erro ao finalizar a daily. Tente novamente.");
    }
  }

  const summary = useMemo(
    () => Object.fromEntries(AREA_KEYS.map((a) => [a, filledCount(a, forms[a])])) as Record<AreaKey, { filled: number; total: number }>,
    [forms],
  );

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Pautas Semanais
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--muted)" }}>
            Cada pessoa registra aqui as pautas e informações da semana para a daily.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPresenting(true)}
            className="rounded-lg border px-4 py-2 text-[13px] font-semibold transition hover:bg-[var(--surface2)]"
            style={{ borderColor: "var(--border2)", color: "var(--text2)" }}
            title="Modo apresentação em tela cheia"
          >
            ▶ Apresentar
          </button>
          {canFinalize(user) && (
            <button
              onClick={() => setConfirmDaily(true)}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}
            >
              Finalizar daily · {(meta.dailysCount ?? 0) + 1}ª
            </button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {AREA_KEYS.map((a) => {
          const cfg = AREAS[a];
          const active = tab === a;
          const s = summary[a];
          return (
            <button
              key={a}
              onClick={() => setTab(a)}
              className="relative flex flex-shrink-0 items-center gap-2.5 px-4 py-3 text-[13.5px] transition-colors"
              style={{ color: active ? "var(--text)" : "var(--muted)", fontWeight: active ? 600 : 500 }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: cfg.color }}
              >
                {initials(cfg.person)}
              </span>
              <span className="text-left leading-tight">
                {cfg.name}
                <span className="block text-[11px] font-normal" style={{ color: "var(--muted)" }}>
                  {cfg.person} · {s.filled}/{s.total}
                </span>
              </span>
              {!canEditArea(user, a) && <span title="Somente leitura">🔒</span>}
              {dirty.has(a) && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} title="Alterações não salvas" />}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: cfg.color }} />}
            </button>
          );
        })}
      </div>

      {/* Editores (todos montados para preservar o estado ao trocar de aba) */}
      {AREA_KEYS.map((a) => (
        <div key={a} hidden={tab !== a}>
          <AreaEditor
            area={a}
            editing={editing}
            readOnly={!canEditArea(user, a)}
            onRemove={(patch, label) => removeWithUndo(a, patch, label)}
            onToggleEdit={() => setEditing((e) => !e)}
            data={forms[a]}
            onChange={(p) => update(a, p)}
            onSave={() => handleSave(a)}
            dirty={dirty.has(a)}
            saveState={saveState[a]}
            history={store[a]?.pautaHistory ?? []}
            remote={remoteChange(a)}
            onTakeRemote={() => {
              const r = remoteChange(a);
              if (!r) return;
              const next = { ...formsRef.current, [a]: { ...r, sections: blocksOf(a, r), priorities: prioListOf(a, r) } };
              formsRef.current = next;
              setForms(next);
              learn(a, String(r.savedAt));
              markDirty(a, false);
              setSave(a, "idle");
            }}
            onKeepMine={() => {
              const r = remoteChange(a);
              if (r) learn(a, String(r.savedAt));
            }}
          />
        </div>
      ))}

      {confirmDaily && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDaily(false)}>
          <div
            className="w-full max-w-md rounded-2xl border p-6"
            style={{ background: "var(--modal)", borderColor: "var(--border)", boxShadow: "var(--card-shadow-hover)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[17px] font-semibold" style={{ color: "var(--text)" }}>
              Finalizar a daily desta semana?
            </h3>
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--text2)" }}>
              As pautas de todas as áreas serão arquivadas no histórico e os campos serão limpos. As prioridades
              continuam para a próxima semana.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDaily(false)}
                className="rounded-lg border px-4 py-2 text-[13px] font-medium"
                style={{ borderColor: "var(--border2)", color: "var(--text2)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalize}
                className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
                style={{ background: "var(--brand-gradient)" }}
              >
                Finalizar daily
              </button>
            </div>
          </div>
        </div>
      )}

      {undo && (
        <div
          className="fixed bottom-6 left-1/2 z-[610] flex -translate-x-1/2 items-center gap-4 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white shadow-lg"
          style={{ background: "#292d34" }}
        >
          <span>{undo.label}</span>
          <button onClick={doUndo} className="font-semibold underline" style={{ color: "#c4b9ff" }}>
            Desfazer
          </button>
        </div>
      )}

      {presenting && <Presentation forms={forms} start={AREA_KEYS.indexOf(tab)} number={(meta.dailysCount ?? 0) + 1} onClose={() => setPresenting(false)} />}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[600] -translate-x-1/2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white shadow-lg"
          style={{ background: "#292d34" }}
        >
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

function Panel({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <section
      className="mb-5 rounded-xl border"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}
    >
      <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
        {accent && <span className="h-3.5 w-1 rounded-full" style={{ background: accent }} />}
        <h3 className="text-[13.5px] font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function AreaEditor({
  area,
  editing,
  readOnly,
  onRemove,
  onToggleEdit,
  data,
  onChange,
  onSave,
  dirty,
  saveState,
  history,
  remote,
  onTakeRemote,
  onKeepMine,
}: {
  area: AreaKey;
  editing: boolean;
  readOnly: boolean;
  onRemove: (patch: Partial<PautaData>, label: string) => void;
  onToggleEdit: () => void;
  data: PautaData;
  onChange: (p: Partial<PautaData>) => void;
  onSave: () => void;
  dirty: boolean;
  saveState: SaveState;
  history: PautaData[];
  remote: PautaData | null;
  onTakeRemote: () => void;
  onKeepMine: () => void;
}) {
  const cfg = AREAS[area];
  const [showHist, setShowHist] = useState(false);

  const prios = prioListOf(area, data);
  const setPrios = (next: PrioEntry[]) => onChange({ priorities: next });
  const patchPrio = (id: string, p: Partial<PrioEntry>) => setPrios(prios.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const removePrio = (id: string) => onRemove({ priorities: prios.filter((x) => x.id !== id) }, "Prioridade excluída");
  const addPrio = () => setPrios([...prios, { id: newId(), text: "", status: "pending" }]);

  const blocks = blocksOf(area, data);
  const setBlocks = (next: PautaBlock[]) => onChange({ sections: next });
  const patchBlock = (id: string, p: Partial<PautaBlock>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const removeBlock = (id: string) =>
    onRemove({ sections: blocks.filter((b) => b.id !== id) }, `Pauta "${blocks.find((b) => b.id === id)?.title || "sem título"}" excluída`);
  const addBlock = () =>
    setBlocks([...blocks, { id: newId(), title: "Nova pauta", topics: [{ id: newId(), label: "Tópico", value: "" }] }]);
  const addTopic = (id: string) =>
    patchBlock(id, { topics: [...(blocks.find((b) => b.id === id)?.topics ?? []), { id: newId(), label: "Novo tópico", value: "" }] });
  const patchTopic = (id: string, tid: string, p: Partial<PautaBlock["topics"][number]>) =>
    patchBlock(id, { topics: (blocks.find((b) => b.id === id)?.topics ?? []).map((t) => (t.id === tid ? { ...t, ...p } : t)) });
  const removeTopic = (id: string, tid: string) =>
    onRemove(
      { sections: blocks.map((b) => (b.id === id ? { ...b, topics: b.topics.filter((t) => t.id !== tid) } : b)) },
      "Tópico removido",
    );

  const stateLabel =
    saveState === "saving"
      ? "Salvando…"
      : saveState === "offline"
        ? "Sem conexão · salvo no dispositivo, sincroniza ao reconectar"
        : saveState === "error"
        ? "Erro ao salvar"
        : saveState === "saved" && !dirty
          ? "Pauta salva"
          : saveState === "saved"
            ? "Rascunho salvo"
            : dirty
              ? "Alterações não salvas"
              : "";

  return (
    <div>
      {readOnly && (
        <div className="mb-5 rounded-xl border px-4 py-2.5 text-[13px]" style={{ background: "var(--surface2)", borderColor: "var(--border)", color: "var(--text2)" }}>
          🔒 Somente leitura — esta área pertence a {cfg.person}.
        </div>
      )}
      <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
      {remote && (
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[13px]"
          style={{ background: "#d977061a", borderColor: "#d9770655", color: "var(--text)" }}
        >
          <span>
            ⚠️ <b>{typeof remote.savedBy === "string" && remote.savedBy ? remote.savedBy : "Outra pessoa"}</b> alterou esta
            pauta{remote.savedAt ? ` às ${new Date(String(remote.savedAt)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}.
            {dirty ? " Você tem alterações não salvas." : ""}
          </span>
          <span className="flex gap-2">
            <button onClick={onTakeRemote} className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white" style={{ background: "#d97706" }}>
              Carregar versão atualizada
            </button>
            <button onClick={onKeepMine} className="rounded-lg border px-3 py-1.5 text-[12.5px] font-medium" style={{ borderColor: "var(--border2)", color: "var(--text2)" }}>
              Manter a minha
            </button>
          </span>
        </div>
      )}

      {/* Prioridades */}
      <Panel title="Prioridades da semana" accent={cfg.color}>
        <div className="flex flex-col gap-3">
          {prios.length === 0 && (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              Nenhuma prioridade.{editing ? "" : " Use o lápis para adicionar."}
            </p>
          )}
          {prios.map((pr, i) => (
            <div key={pr.id} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
                style={{ background: `${cfg.color}1f`, color: cfg.color }}
              >
                {i + 1}
              </span>
              <input
                className={inputCls}
                style={{ borderColor: "var(--border2)", color: "var(--text)" }}
                placeholder={`Prioridade ${i + 1}`}
                value={pr.text}
                onChange={(e) => patchPrio(pr.id, { text: e.target.value })}
              />
              {weeksBadge(pr.weeks, pr.status) && (
                <span
                  className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: `${weeksBadge(pr.weeks, pr.status)!.color}1a`, color: weeksBadge(pr.weeks, pr.status)!.color }}
                  title="Prioridade pendente há várias dailies"
                >
                  ⏳ {weeksBadge(pr.weeks, pr.status)!.text}
                </span>
              )}
              <div className="flex flex-shrink-0 rounded-lg border p-0.5" style={{ borderColor: "var(--border2)", background: "var(--surface2)" }}>
                {STATUS_ORDER.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => patchPrio(pr.id, { status: st })}
                    className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition"
                    style={pr.status === st ? { background: STATUS_META[st].color, color: "#fff" } : { color: "var(--muted)" }}
                  >
                    {STATUS_META[st].label}
                  </button>
                ))}
              </div>
              {editing && (
                <button
                  onClick={() => removePrio(pr.id)}
                  title="Excluir prioridade"
                  className="flex-shrink-0 rounded-md px-2 py-1 text-[13px] transition hover:bg-red-500/10 hover:text-red-600"
                  style={{ color: "var(--muted)" }}
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
        {editing && (
          <button onClick={addPrio} className="mt-4 text-[12.5px] font-semibold hover:underline" style={{ color: "var(--primary-dark)" }}>
            + Adicionar prioridade
          </button>
        )}
      </Panel>

      {/* Quadros de pauta */}
      {blocks.map((b) => (
        <section
          key={b.id}
          className="mb-5 rounded-xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}
        >
          <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
            <span className="h-3.5 w-1 flex-shrink-0 rounded-full" style={{ background: cfg.color }} />
            {editing ? (
              <>
                <input
                  value={b.title}
                  onChange={(e) => patchBlock(b.id, { title: e.target.value })}
                  placeholder="Título da pauta"
                  className="min-w-0 flex-1 rounded-md border bg-[var(--surface2)] px-2 py-1 text-[14px] font-semibold outline-none focus:border-[var(--primary)]"
                  style={{ color: "var(--text)", borderColor: "var(--border2)" }}
                />
                <button
                  onClick={() => removeBlock(b.id)}
                  title="Excluir pauta"
                  className="rounded-md px-2 py-1 text-[12px] font-medium transition hover:bg-red-500/10 hover:text-red-600"
                  style={{ color: "var(--muted)" }}
                >
                  🗑 Excluir
                </button>
              </>
            ) : (
              <h3 className="text-[13.5px] font-semibold" style={{ color: "var(--text)" }}>
                {b.title}
              </h3>
            )}
          </div>
          <div className="p-5">
            <div className={`grid gap-4 ${b.topics.length > 1 ? "md:grid-cols-2" : ""}`}>
              {b.topics.map((t) => (
                <div key={t.id}>
                  <div className="mb-1.5 flex items-center gap-1">
                    {editing ? (
                      <>
                        <input
                          value={t.label}
                          onChange={(e) => patchTopic(b.id, t.id, { label: e.target.value })}
                          placeholder="Tópico"
                          className="min-w-0 flex-1 rounded-md border bg-[var(--surface2)] px-2 py-0.5 text-[12px] font-medium outline-none focus:border-[var(--primary)]"
                          style={{ color: "var(--text2)", borderColor: "var(--border2)" }}
                        />
                        <button
                          onClick={() => removeTopic(b.id, t.id)}
                          title="Remover tópico"
                          className="px-1.5 text-[13px] hover:text-red-600"
                          style={{ color: "var(--muted)" }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="block text-[12px] font-medium" style={{ color: "var(--text2)" }}>
                        {t.label}
                      </span>
                    )}
                  </div>
                  <BulletTextarea
                    className={`${inputCls} min-h-[84px] resize-y pb-8 [field-sizing:content]`}
                    style={{ borderColor: "var(--border2)", color: "var(--text)" }}
                    value={t.value}
                    onChange={(v) => patchTopic(b.id, t.id, { value: v })}
                    placeholder="Escreva aqui… (use o botão • Lista para marcadores)"
                  />
                </div>
              ))}
            </div>
            {editing && (
              <button onClick={() => addTopic(b.id)} className="mt-4 text-[12.5px] font-semibold hover:underline" style={{ color: "var(--primary-dark)" }}>
                + Adicionar tópico
              </button>
            )}
          </div>
        </section>
      ))}

      {editing && (
        <button
          onClick={addBlock}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-[13.5px] font-semibold transition hover:bg-[var(--surface2)]"
          style={{ borderColor: "var(--border2)", color: "var(--text2)" }}
        >
          + Nova pauta
        </button>
      )}

      </fieldset>

      {/* Lápis: edição da estrutura (pautas, tópicos e prioridades) */}
      <div className={`mb-5 flex justify-end ${readOnly ? "hidden" : ""}`}>
        <button
          onClick={onToggleEdit}
          title={editing ? "Concluir edição da estrutura" : "Editar estrutura (incluir/excluir pautas, tópicos e prioridades)"}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition"
          style={editing ? { background: "var(--primary)", color: "#fff" } : { color: "var(--text2)", background: "var(--surface3)" }}
        >
          <span>✏️</span>
          <span>{editing ? "Concluir edição" : "Editar pautas"}</span>
        </button>
      </div>

      {/* Histórico */}
      {history.length > 0 && (
        <div className="mb-5">
          <button
            onClick={() => setShowHist((s) => !s)}
            className="text-[13px] font-semibold hover:underline"
            style={{ color: "var(--primary-dark)" }}
          >
            {showHist ? "Ocultar" : "Ver"} pautas anteriores ({history.length})
          </button>
          {showHist && (
            <div className="mt-3 flex flex-col gap-2">
              {history.slice(0, 8).map((h, i) => {
                const { filled, total } = filledCount(area, h);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-[13px]"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text2)" }}
                  >
                    <span className="font-medium" style={{ color: "var(--text)" }}>
                      {h.date ?? "—"}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      {filled}/{total} campos
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barra de ação */}
      <div
        className={`sticky bottom-0 -mx-1 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 backdrop-blur-xl ${readOnly ? "hidden" : ""}`}
        style={{ background: "var(--topbar)", borderColor: "var(--border)", boxShadow: "var(--card-shadow-hover)" }}
      >
        <span className="text-[12.5px]" style={{ color: saveState === "error" ? "#dc2626" : "var(--muted)" }}>
          {stateLabel}
        </span>
        <button
          onClick={onSave}
          disabled={saveState === "saving"}
          className="rounded-lg px-5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: cfg.color }}
        >
          Salvar pauta
        </button>
      </div>
    </div>
  );
}
