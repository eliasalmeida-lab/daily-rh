import { AREAS } from "./areas";
import { FIELD_MAP } from "./fields";
import type { AreaKey, PautaData, PrioStatus, PrioEntry, PautaBlock } from "@/types/domain";

export const STATUS_META: Record<PrioStatus, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "#d97706" },
  progress: { label: "Em andamento", color: "#2563eb" },
  done: { label: "Concluída", color: "#16a34a" },
};

export const STATUS_ORDER: PrioStatus[] = ["pending", "progress", "done"];

export const prioKey = (a: AreaKey, n: number) => `${a}_p${n}`;

export interface PrioItem {
  key: string;
  text: string;
  status: PrioStatus;
  weeks?: number;
}

/**
 * Lista de prioridades de uma área. Usa a lista salva (priorities); em pautas do
 * formato antigo, monta as 3 prioridades fixas (<area>_p1..p3) preservando textos e status.
 */
export function prioListOf(area: AreaKey, d: PautaData): PrioEntry[] {
  if (Array.isArray(d.priorities)) return d.priorities;
  const st = (d.prioStatus as Record<string, PrioStatus> | undefined) ?? {};
  return [1, 2, 3].map((n) => {
    const key = prioKey(area, n);
    return { id: key, text: typeof d[key] === "string" ? (d[key] as string) : "", status: st[key] ?? ("pending" as PrioStatus) };
  });
}

/** Prioridades preenchidas de uma pauta (para resumos). */
export function prioritiesOf(area: AreaKey, d: PautaData): PrioItem[] {
  return prioListOf(area, d)
    .filter((p) => p.text.trim())
    .map((p) => ({ key: p.id, text: p.text.trim(), status: p.status, weeks: p.weeks }));
}

export interface FilledSection {
  section: string;
  items: { key: string; label: string; value: string }[];
}

export const newId = () => Math.random().toString(36).slice(2, 9);

/**
 * Quadros de pauta de uma área. Usa os quadros salvos (sections); se a pauta
 * ainda é do formato antigo (campos fixos), monta os quadros a partir de
 * FIELD_MAP preservando os textos já digitados.
 */
export function blocksOf(area: AreaKey, d: PautaData): PautaBlock[] {
  if (Array.isArray(d.sections)) return d.sections;
  return FIELD_MAP[area].map((s) => ({
    id: newId(),
    title: s.section,
    topics: s.fields.map((f) => ({ id: f.key, label: f.label, value: typeof d[f.key] === "string" ? (d[f.key] as string) : "" })),
  }));
}

/** Quadros com apenas os tópicos preenchidos (para exibir resumos). */
export function filledSections(area: AreaKey, d: PautaData): FilledSection[] {
  return blocksOf(area, d)
    .map((b) => ({
      section: b.title,
      items: b.topics.filter((t) => t.value.trim()).map((t) => ({ key: t.id, label: t.label, value: t.value.trim() })),
    }))
    .filter((x) => x.items.length);
}

export function filledCount(area: AreaKey, d: PautaData): { filled: number; total: number } {
  const topics = blocksOf(area, d).flatMap((b) => b.topics);
  return { filled: topics.filter((t) => t.value.trim()).length, total: topics.length };
}

export const personOf = (a: AreaKey) => AREAS[a].person;

export function initials(name: string) {
  return name.substring(0, 2).toUpperCase();
}

/** Primeira linha útil de um texto, cortada em `n` caracteres. */
export function snippet(s: string, n = 120) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n).trimEnd() + "…" : one;
}

/** Rótulo de "prioridade antiga" (pendente através de várias dailies). */
export function weeksBadge(weeks?: number, status?: PrioStatus): { text: string; color: string } | null {
  if (!weeks || weeks < 1 || status === "done") return null;
  return {
    text: `há ${weeks} daily's`,
    color: weeks >= 3 ? "#dc2626" : weeks >= 2 ? "#ea580c" : "#d97706",
  };
}
