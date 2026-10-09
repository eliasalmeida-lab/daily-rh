"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { StoreProvider } from "@/lib/hooks/useStore";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

const COLLAPSE_KEY = "painel-rh:sidebar-collapsed";
const collapseListeners = new Set<() => void>();
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};
function setCollapsedPersist(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {}
  collapseListeners.forEach((l) => l());
}
const subscribeCollapsed = (cb: () => void) => {
  collapseListeners.add(cb);
  return () => void collapseListeners.delete(cb);
};

/**
 * Layout do app autenticado. Guarda o acesso: sem usuário → redireciona ao login.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  // Telas grandes: recolhe/expande a barra e a página estende. Telas pequenas: abre/fecha o menu.
  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsedPersist(!collapsed);
    else setMenuOpen((o) => !o);
  };

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ color: "var(--muted)" }}>
        Carregando…
      </div>
    );
  }

  return (
    <StoreProvider>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar open={menuOpen} collapsed={collapsed} onClose={() => setMenuOpen(false)} onCollapse={() => setCollapsedPersist(true)} />
        <div className={`transition-[padding] duration-200 ${collapsed ? "" : "lg:pl-[var(--sidebar-w)]"}`}>
          <Header onMenu={toggleMenu} />
          <main className="mx-auto max-w-[1900px] px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </StoreProvider>
  );
}
