"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { canManageUsers } from "@/lib/domain/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Visível só para o usuário mestre. */
  masterOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/pautas", label: "Pautas Semanais", icon: "📋" },
  { href: "/admin", label: "Admin", icon: "⚙️", masterOnly: true },
];

export function Sidebar({ open, collapsed, onClose, onCollapse }: { open: boolean; collapsed: boolean; onClose: () => void; onCollapse: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = NAV_ITEMS.filter((n) => !n.masterOnly || canManageUsers(user));

  return (
    <>
      {open && <div className="fixed inset-0 z-[310] bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-[320] flex w-[var(--sidebar-w)] flex-col border-r transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:-translate-x-full" : "lg:translate-x-0"}`}
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--border)" }}
      >
        <div className="flex h-14 items-center gap-2.5 px-3.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            RH
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14px] font-semibold" style={{ color: "var(--text)" }}>
              Painel RH
            </div>
            <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>
              Grão Direto
            </div>
          </div>
          <button
            onClick={onCollapse}
            title="Recolher menu"
            className="ml-auto hidden h-7 w-7 items-center justify-center rounded-md text-[14px] transition-colors hover:bg-[var(--sidebar-hover)] lg:flex"
            style={{ color: "var(--muted)" }}
          >
            «
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 pb-4 pt-2">
          <div
            className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--muted)" }}
          >
            Espaço
          </div>
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] transition-colors hover:bg-[var(--sidebar-hover)]"
                    style={
                      active
                        ? { background: "var(--sidebar-active)", color: "var(--primary-dark)", fontWeight: 600 }
                        : { color: "var(--text2)", fontWeight: 500 }
                    }
                  >
                    <span className="w-5 text-center text-[15px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
