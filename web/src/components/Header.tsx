"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useTheme } from "@/lib/theme";
import { useStore } from "@/lib/hooks/useStore";
import { NAV_ITEMS } from "./Sidebar";

export function Header({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { online } = useStore();
  const current = NAV_ITEMS.find((n) => n.href === pathname);

  const btn =
    "flex h-8 w-8 items-center justify-center rounded-md text-[15px] transition-colors hover:bg-[var(--surface3)]";

  return (
    <header
      className="sticky top-0 z-[300] flex h-14 items-center gap-3 border-b px-4 backdrop-blur-xl lg:px-6"
      style={{ borderColor: "var(--border)", background: "var(--topbar)" }}
    >
      <button onClick={onMenu} className={btn} style={{ color: "var(--text2)" }} aria-label="Menu" title="Mostrar/ocultar menu">
        ☰
      </button>
      <div className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: "var(--text)" }}>
        <span>{current?.icon}</span>
        <span>{current?.label ?? "Painel RH"}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span
          className="mr-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
          style={
            online
              ? { background: "var(--surface3)", color: "var(--muted)" }
              : { background: "#d977061f", color: "#b45309" }
          }
          title={online ? "Conectado ao Firebase" : "Sem internet: as alterações ficam salvas neste dispositivo e sincronizam ao reconectar"}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: online ? "#16a34a" : "#d97706" }} />
          {online ? "Sincronizado" : "Sem conexão"}
        </span>
        <button
          onClick={toggle}
          title="Alternar tema"
          suppressHydrationWarning
          className={btn}
          style={{ color: "var(--text2)" }}
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
        {user && (
          <div className="flex items-center gap-2 px-1 text-[13px] font-medium" style={{ color: "var(--text2)" }}>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: "var(--brand-gradient)" }}
            >
              {user.name.substring(0, 2).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{user.name}</span>
          </div>
        )}
        <button onClick={() => logout()} title="Sair" className={btn} style={{ color: "var(--text2)" }}>
          ⏻
        </button>
      </div>
    </header>
  );
}
