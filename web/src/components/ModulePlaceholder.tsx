/**
 * Placeholder para módulos ainda não implementados (fases futuras do roteiro).
 * Mantém a navegação funcional enquanto cada módulo é construído.
 */
export function ModulePlaceholder({
  icon,
  title,
  phase,
  description,
}: {
  icon: string;
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border px-8 py-20 text-center"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mb-4 text-5xl">{icon}</div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h1>
      <span
        className="mb-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
        style={{ background: "var(--surface3)", color: "var(--muted)" }}
      >
        {phase}
      </span>
      <p className="max-w-md text-sm" style={{ color: "var(--text2)" }}>
        {description}
      </p>
    </div>
  );
}
