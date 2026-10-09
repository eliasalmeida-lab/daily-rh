"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LoginPage() {
  const { user, loading, login, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleReset() {
    setErro("");
    setAviso("");
    if (!email) {
      setErro("Digite seu e-mail acima para redefinir a senha.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
    } catch {
      // Ignora erros (ex.: usuário inexistente) para não revelar quais e-mails existem.
    }
    setAviso("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    setBusy(false);
  }

  // Já autenticado → vai para o app.
  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [loading, user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    if (!email || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setBusy(true);
    try {
      await login(email, senha);
      router.replace("/home");
    } catch {
      setErro("E-mail ou senha incorretos.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f8f9] px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white" style={{ background: "linear-gradient(135deg,#7b68ee,#fd71af)" }}>
          RH
        </div>
      </div>
      <form
        onSubmit={handleLogin}
        className="w-[92%] max-w-[400px] rounded-2xl border border-[#e9ebf0] bg-white px-11 py-12 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_32px_-8px_rgba(15,23,42,0.12)]"
      >
        <h1 className="mb-2 text-[24px] font-bold tracking-tight text-[#292d34]">Painel RH</h1>
        <p className="mb-7 text-[13px] font-medium text-[#64748b]">Grão Direto · Acesso restrito</p>

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border border-[#e9ebf0] bg-white px-4 py-3 text-sm text-[#292d34] outline-none focus:border-[#7b68ee]"
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-lg border border-[#e9ebf0] bg-white px-4 py-3 text-sm text-[#292d34] outline-none focus:border-[#7b68ee]"
          autoComplete="current-password"
        />

        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="text-[12px] font-medium text-[#6552d9] hover:underline disabled:opacity-50"
          >
            Esqueci minha senha
          </button>
        </div>

        {erro && <p className="mt-3 text-[13px] font-medium text-red-600">{erro}</p>}
        {aviso && <p className="mt-3 text-[13px] font-medium text-[#6552d9]">{aviso}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-[#7b68ee] py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-[#6552d9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
