"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { DEFAULT_USERS, useAuth } from "@/lib/hooks/useAuth";
import { MASTER_EMAIL, canManageUsers } from "@/lib/domain/permissions";

interface UserRow {
  email: string;
  name: string;
  admin: boolean;
}

const input =
  "rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-[13.5px] outline-none transition focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--glow)]";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = canManageUsers(user);

  useEffect(() => {
    if (!loading && !allowed) router.replace("/home");
  }, [loading, allowed, router]);

  if (!allowed) return null;
  return <Users />;
}

function Users() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState<UserRow>({ email: "", name: "", admin: false });
  const [err, setErr] = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "rh-daily-users"),
      (snap) => {
        const list = snap.docs.map((d) => ({ email: d.id, ...(d.data() as Omit<UserRow, "email">) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setRows(list);
      },
      () => setRows([]),
    );
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2800);
  };

  async function save(u: UserRow) {
    const data: Record<string, unknown> = { name: u.name.trim(), admin: u.admin };
    await setDoc(doc(db, "rh-daily-users", u.email.trim().toLowerCase()), data);
  }

  async function patch(u: UserRow, p: Partial<UserRow>) {
    try {
      const next = { ...u, ...p };
      await save(next);
      flash("Alteração salva");
    } catch {
      flash("Não foi possível salvar. Verifique as regras do Firestore.");
    }
  }

  async function add() {
    setErr("");
    const email = draft.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Informe um e-mail válido.");
    if (!draft.name.trim()) return setErr("Informe o nome.");
    try {
      await save({ ...draft, email });
      setDraft({ email: "", name: "", admin: false });
      flash("Usuário salvo");
    } catch {
      setErr("Não foi possível salvar. Verifique as regras do Firestore.");
    }
  }

  // Usuários do sistema (definidos no código) que ainda não têm cadastro no Firestore.
  const missing = rows
    ? Object.entries(DEFAULT_USERS).filter(([email]) => !rows.some((r) => r.email.toLowerCase() === email))
    : [];

  async function registerAll() {
    try {
      const batch = writeBatch(db);
      for (const [email, u] of missing) {
        const data: Record<string, unknown> = { name: u.name, admin: u.admin };
        batch.set(doc(db, "rh-daily-users", email), data);
      }
      await batch.commit();
      flash(`${missing.length} usuário(s) cadastrado(s)`);
    } catch {
      flash("Não foi possível cadastrar. Verifique as regras do Firestore.");
    }
  }

  async function remove(u: UserRow) {
    if (!confirm(`Remover o acesso de ${u.name}? (A conta de login continua existindo no Firebase.)`)) return;
    try {
      await deleteDoc(doc(db, "rh-daily-users", u.email));
      flash("Usuário removido");
    } catch {
      flash("Não foi possível remover.");
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          Administração
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--muted)" }}>
          Gerencie quem acessa o sistema e quem é administrador. Todos os usuários editam todas as áreas. Visível apenas para o usuário mestre.
        </p>
      </div>

      {missing.length > 0 && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 text-[13.5px]"
          style={{ background: "#d977061a", borderColor: "#d9770655", color: "var(--text)" }}
        >
          <div>
            <b>{missing.length} usuário(s) do sistema ainda não estão cadastrados:</b>{" "}
            {missing.map(([email, u]) => `${u.name} (${email})`).join(", ")}.
            <div className="mt-1 text-[12.5px]" style={{ color: "var(--text2)" }}>
              O cadastro define o nome exibido e quem é administrador.
            </div>
          </div>
          <button onClick={registerAll} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: "#d97706" }}>
            Cadastrar todos
          </button>
        </div>
      )}

      <section className="mb-6 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <div className="border-b px-5 py-3 text-[13.5px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
          Usuários
        </div>

        {rows === null ? (
          <p className="p-6 text-[13px]" style={{ color: "var(--muted)" }}>
            Carregando…
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-[13px]" style={{ color: "var(--muted)" }}>
            Nenhum usuário cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  <th className="px-5 py-3">Usuário</th>
                  <th className="px-3 py-3">Admin</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const master = u.email.toLowerCase() === MASTER_EMAIL;
                  return (
                    <tr key={u.email} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-5 py-3">
                        <div className="font-semibold" style={{ color: "var(--text)" }}>
                          {u.name}
                          {master && (
                            <span className="ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--sidebar-active)", color: "var(--primary-dark)" }}>
                              Mestre
                            </span>
                          )}
                        </div>
                        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                          {u.email}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={u.admin}
                          disabled={master}
                          onChange={(e) => patch(u, { admin: e.target.checked })}
                          className="h-4 w-4 accent-[var(--primary)]"
                          title={master ? "O usuário mestre é sempre admin" : "Admin edita todas as áreas e finaliza a daily"}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {!master && (
                          <button onClick={() => remove(u)} className="rounded-md px-2 py-1 text-[12px] transition hover:bg-red-500/10 hover:text-red-600" style={{ color: "var(--muted)" }}>
                            🗑 Remover
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
        <div className="border-b px-5 py-3 text-[13.5px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
          Adicionar usuário
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2">
          <input className={input} style={{ borderColor: "var(--border2)", color: "var(--text)" }} placeholder="E-mail" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          <input className={input} style={{ borderColor: "var(--border2)", color: "var(--text)" }} placeholder="Nome (como aparece no app)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <div className="flex flex-wrap items-center gap-1.5 md:col-span-2">
            <label className="ml-4 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text2)" }}>
              <input type="checkbox" checked={draft.admin} onChange={(e) => setDraft({ ...draft, admin: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
              Admin
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <button onClick={add} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: "var(--primary)" }}>
            Salvar usuário
          </button>
          {err && <span className="text-[12.5px] text-red-600">{err}</span>}
          <span className="ml-auto text-[11.5px]" style={{ color: "var(--muted)" }}>
            A conta de login (e-mail e senha) é criada em Firebase › Authentication.
          </span>
        </div>
      </section>

      {msg && (
        <div className="fixed bottom-6 left-1/2 z-[600] -translate-x-1/2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white shadow-lg" style={{ background: "#292d34" }}>
          ✓ {msg}
        </div>
      )}
    </div>
  );
}
