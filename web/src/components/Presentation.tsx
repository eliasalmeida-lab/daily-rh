"use client";

import { useEffect, useState } from "react";
import { AREAS, AREA_KEYS } from "@/lib/domain/areas";
import { STATUS_META, filledCount, filledSections, initials, prioritiesOf, weeksBadge } from "@/lib/domain/pauta";
import { RichText } from "./RichText";
import type { AreaKey, PautaData } from "@/types/domain";

type Slide = "cover" | AreaKey;
const SLIDES: Slide[] = ["cover", ...AREA_KEYS];

/**
 * Modo apresentação: tela cheia para conduzir a daily.
 * Capa + um slide por área. Navegação pelos botões, pelas abas do topo ou pelas setas.
 */
export function Presentation({
  forms,
  start = 0,
  number,
  onClose,
}: {
  forms: Record<AreaKey, PautaData>;
  /** Índice da área inicial (0 = primeira área). */
  start?: number;
  /** Número da daily (ex.: 12). */
  number: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(start + 1);
  const total = SLIDES.length;
  const slide = SLIDES[i];

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setI((x) => Math.min(total - 1, x + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setI((x) => Math.max(0, x - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  const color = slide === "cover" ? "#7b68ee" : AREAS[slide].color;
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div
      className="fixed inset-0 z-[700] flex flex-col overflow-hidden"
      style={{
        color: "var(--text)",
        background: `radial-gradient(900px 520px at 88% -8%, ${color}2e, transparent 60%), radial-gradient(700px 480px at -6% 108%, ${color}1f, transparent 60%), var(--bg)`,
        transition: "background .5s ease",
      }}
    >
      {/* Progresso */}
      <div className="h-1 w-full" style={{ background: "var(--border)" }}>
        <div className="h-full transition-all duration-500" style={{ width: `${((i + 1) / total) * 100}%`, background: color }} />
      </div>

      {/* Topo */}
      <header className="flex items-center gap-4 px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold text-white" style={{ background: "var(--brand-gradient)" }}>
            RH
          </span>
          <span className="hidden text-[14px] font-semibold sm:inline">Daily #{number}</span>
        </div>

        <nav className="mx-auto flex items-center gap-1 rounded-full border p-1" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {SLIDES.map((s, n) => {
            const c = s === "cover" ? "#7b68ee" : AREAS[s].color;
            const active = n === i;
            return (
              <button
                key={s}
                onClick={() => setI(n)}
                className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition"
                style={active ? { background: c, color: "#fff" } : { color: "var(--text2)" }}
              >
                {!active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />}
                {s === "cover" ? "Capa" : AREAS[s].short}
              </button>
            );
          })}
        </nav>

        <button
          onClick={onClose}
          className="rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition hover:bg-[var(--surface2)]"
          style={{ borderColor: "var(--border2)", color: "var(--text2)" }}
        >
          ✕ Sair
        </button>
      </header>

      {/* Conteúdo */}
      <main key={slide} className="flex-1 overflow-y-auto px-6 pb-6 pt-2 lg:px-12" style={{ animation: "fadeUp .45s ease both" }}>
        {slide === "cover" ? (
          <Cover forms={forms} todayCap={todayCap} number={number} onPick={(a) => setI(SLIDES.indexOf(a))} />
        ) : (
          <AreaSlide area={slide} data={forms[slide]} />
        )}
      </main>

      {/* Rodapé */}
      <footer className="flex items-center justify-between px-6 py-4 lg:px-12">
        <button
          onClick={() => setI((x) => Math.max(0, x - 1))}
          disabled={i === 0}
          className="rounded-xl border px-5 py-2.5 text-[13.5px] font-semibold transition hover:bg-[var(--surface2)] disabled:opacity-30"
          style={{ borderColor: "var(--border2)", color: "var(--text2)" }}
        >
          ← Anterior
        </button>
        <span className="text-[12.5px] tabular-nums" style={{ color: "var(--muted)" }}>
          {i + 1} / {total}
        </span>
        <button
          onClick={() => (i === total - 1 ? onClose() : setI((x) => x + 1))}
          className="rounded-xl px-6 py-2.5 text-[13.5px] font-semibold text-white shadow-lg transition hover:brightness-110"
          style={{ background: color, boxShadow: `0 8px 24px -8px ${color}` }}
        >
          {i === total - 1 ? "Concluir ✓" : "Próxima →"}
        </button>
      </footer>
    </div>
  );
}

function Cover({
  forms,
  todayCap,
  number,
  onPick,
}: {
  forms: Record<AreaKey, PautaData>;
  todayCap: string;
  number: number;
  onPick: (a: AreaKey) => void;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-[1200px] flex-col justify-center py-6">
      <div className="mb-2 text-[14px] font-medium" style={{ color: "var(--muted)" }}>
        {todayCap}
      </div>
      <h1 className="text-[64px] font-bold leading-none tracking-tight sm:text-[84px]">
        Daily{" "}
        <span style={{ background: "var(--brand-gradient)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          #{number}
        </span>
      </h1>
      <p className="mt-4 max-w-xl text-[18px]" style={{ color: "var(--text2)" }}>
        Pautas e informações da semana de RH.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {AREA_KEYS.map((a) => {
          const cfg = AREAS[a];
          const prios = prioritiesOf(a, forms[a]).length;
          const { filled } = filledCount(a, forms[a]);
          return (
            <button
              key={a}
              onClick={() => onPick(a)}
              className="group relative overflow-hidden rounded-2xl border p-6 text-left transition hover:-translate-y-1"
              style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: cfg.color }} />
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl" style={{ background: cfg.color }} />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ background: cfg.color }}>
                {initials(cfg.person)}
              </span>
              <div className="relative mt-4 text-[19px] font-semibold">{cfg.name}</div>
              <div className="relative text-[13px]" style={{ color: "var(--muted)" }}>
                {cfg.person}
              </div>
              <div className="relative mt-5 flex gap-4 text-[13px]" style={{ color: "var(--text2)" }}>
                <span>
                  <b className="text-[18px]" style={{ color: cfg.color }}>
                    {prios}
                  </b>{" "}
                  prioridades
                </span>
                <span>
                  <b className="text-[18px]" style={{ color: cfg.color }}>
                    {filled}
                  </b>{" "}
                  assuntos
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AreaSlide({ area, data }: { area: AreaKey; data: PautaData }) {
  const cfg = AREAS[area];
  const prios = prioritiesOf(area, data);
  const sections = filledSections(area, data);
  const topics = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Cabeçalho da área */}
      <div className="mb-8 flex flex-wrap items-center gap-5">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-full text-[26px] font-bold text-white"
          style={{ background: cfg.color, boxShadow: `0 0 0 6px ${cfg.color}26, 0 12px 32px -10px ${cfg.color}` }}
        >
          {initials(cfg.person)}
        </span>
        <div>
          <h2 className="text-[44px] font-bold leading-none tracking-tight">{cfg.name}</h2>
          <div className="mt-2 text-[16px]" style={{ color: "var(--muted)" }}>
            {cfg.person} · Pauta da semana
          </div>
        </div>
        <div className="ml-auto flex gap-3">
          {[
            { n: prios.length, l: "prioridades" },
            { n: topics, l: "assuntos" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border px-5 py-3 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="text-[26px] font-bold leading-none" style={{ color: cfg.color }}>
                {s.n}
              </div>
              <div className="mt-1 text-[11.5px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {prios.length === 0 && sections.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed text-[18px]" style={{ borderColor: "var(--border2)", color: "var(--muted)" }}>
          Nada registrado para esta área.
        </div>
      ) : (
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {prios.length > 0 && (
            <section>
              <h3 className="mb-4 text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: cfg.color }}>
                Prioridades da semana
              </h3>
              <ul className="flex flex-col gap-3">
                {prios.map((p, n) => {
                  const wb = weeksBadge(p.weeks, p.status);
                  return (
                    <li
                      key={p.key}
                      className="flex items-start gap-4 rounded-2xl border p-5"
                      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}
                    >
                      <span
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[17px] font-bold"
                        style={{ background: `${cfg.color}1f`, color: cfg.color }}
                      >
                        {n + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[21px] font-medium leading-snug">{p.text}</div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-3 py-1 text-[12.5px] font-semibold"
                            style={{ background: `${STATUS_META[p.status].color}1a`, color: STATUS_META[p.status].color }}
                          >
                            ● {STATUS_META[p.status].label}
                          </span>
                          {wb && (
                            <span className="rounded-full px-3 py-1 text-[12.5px] font-semibold" style={{ background: `${wb.color}1a`, color: wb.color }}>
                              ⏳ {wb.text}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {sections.length > 0 && (
            <section className={prios.length ? "" : "xl:col-span-2"}>
              <h3 className="mb-4 text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: cfg.color }}>
                Assuntos tratados
              </h3>
              <div className="columns-1 gap-5 2xl:columns-2">
                {sections.map((s) => (
                  <div
                    key={s.section}
                    className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}
                  >
                    <div className="border-b px-6 py-3.5 text-[16px] font-semibold" style={{ borderColor: "var(--border)", borderTop: `3px solid ${cfg.color}` }}>
                      {s.section}
                    </div>
                    <ul className="flex flex-col gap-5 p-6">
                      {s.items.map((it) => (
                        <li key={it.key}>
                          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                            {it.label}
                          </div>
                          <RichText text={it.value} bulletColor={cfg.color} className="text-[19px] leading-relaxed" style={{ color: "var(--text)" }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
