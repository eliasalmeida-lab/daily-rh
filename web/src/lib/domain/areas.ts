import type { AreaConfig, AreaKey, TabKey } from "@/types/domain";

/**
 * Configuração das áreas de RH.
 * Migrado de AREAS no index.html original. Na Fase 2 isto passa a ser lido do
 * Firestore para permitir edição sem código.
 */
export const AREAS: Record<AreaKey, AreaConfig> = {
  dp: { key: "dp", name: "Depto. Pessoal", short: "DP", person: "Ana Luísa", color: "#f97316" },
  bp: { key: "bp", name: "Business Partner", short: "BP", person: "Amanda", color: "#3b82f6" },
  rs: { key: "rs", name: "R&S", short: "RS", person: "Amanda", color: "#8b5cf6" },
  est: { key: "est", name: "Estratégico", short: "EST", person: "Ursula", color: "#22c55e" },
};

export const AREA_KEYS: AreaKey[] = ["dp", "bp", "rs", "est"];

/** Quais áreas cada aba da tela de Pautas edita. */
export const TAB_AREAS: Record<TabKey, AreaKey[]> = {
  dp: ["dp"],
  amanda: ["bp", "rs"],
  est: ["est"],
};

export const TAB_KEYS: TabKey[] = ["dp", "amanda", "est"];

/** Rótulo amigável de uma aba. */
export function tabLabel(tab: TabKey): string {
  if (tab === "amanda") return "BP + RS";
  return TAB_AREAS[tab].map((a) => AREAS[a].short).join(" + ");
}
