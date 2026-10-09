"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useStore } from "@/lib/hooks/useStore";
import { AREAS, AREA_KEYS } from "@/lib/domain/areas";
import {
  STATUS_META,
  filledCount,
  filledSections,
  initials,
  prioritiesOf,
  weeksBadge,
} from "@/lib/domain/pauta";
import { RichText } from "@/components/RichText";
import type { AreaKey, PautaData } from "@/types/domain";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border ${className}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}
    >
      {children}
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="mt-1.5 text-[30px] font-semibold leading-none tracking-tight tabular-nums" style={{ color: "var(--text)" }}>
        {value}
      </div>
      {hint && (
        <div className="mt-2 text-[12px]" style={{ color: "var(--text2)" }}>
          {hint}
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { store, history, meta, ready } = useStore();

  // Última daily por área: subcoleção `history` (mais recente), senão pautaHistory.
  const last = (a: AreaKey): PautaData | null => history[a]?.[0] ?? store[a]?.pautaHistory?.[0] ?? null;
  const lastDaily = AREA_KEYS.map((a) => ({ area: a, data: last(a) }));
  const lastDate = lastDaily.map((l) => l.data?.date).find(Boolean);
  const hasDaily = lastDaily.some((l) => l.data);

  let prios = 0;
  let done = 0;
  let topics = 0;
  for (const { area, data } of lastDaily) {
    if (!data) continue;
    const p = prioritiesOf(area, data);
    prios += p.length;
    done += p.filter((x) => x.status === "done").length;
    topics += filledCount(area, data).filled;
  }
  const conclusao = prios ? Math.round((done / prios) * 100) : 0;

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1);

  if (!ready) {
    return (
      <div className="flex h-64 items-center justify-center text-[13px]" style={{ color: "var(--muted)" }}>
        Carregando dados…
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <div
        className="relative mb-6 overflow-hidden rounded-2xl p-7 text-white sm:p-9"
        style={{ background: "linear-gradient(120deg, #4c3fb8 0%, #7b68ee 55%, #fd71af 130%)" }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-pink-300/20 blur-3xl" />
        <div className="relative">
          <div className="text-[13px] font-medium text-white/80">{todayCap}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight sm:text-[32px]">
            {greeting()}, {user?.name ?? ""} 👋
          </h1>
          <p className="mt-2 max-w-xl text-[14px] text-white/85">
            {hasDaily
              ? `Aqui está o resumo da última daily${lastDate ? `, realizada em ${lastDate}` : ""}.`
              : "Ainda não há daily's finalizadas. Preencha as pautas semanais para começar."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="/pautas"
              className="rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-[#4c3fb8] transition hover:bg-white/90"
            >
              Abrir pautas semanais
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Daily's realizadas" value={String(meta.dailysCount ?? 0)} hint={lastDate ? `Última em ${lastDate}` : "Nenhuma ainda"} accent="#7b68ee" />
        <Kpi label="Assuntos tratados" value={String(topics)} hint="Campos preenchidos na última daily" accent="#fd71af" />
        <Kpi label="Prioridades" value={String(prios)} hint="Definidas na última daily" accent="#2563eb" />
        <Kpi label="Concluídas" value={`${conclusao}%`} hint={`${done} de ${prios} prioridades`} accent="#16a34a" />
      </div>

      {/* Última daily */}
      <SectionTitle>Última daily · principais assuntos</SectionTitle>
      {hasDaily ? (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {lastDaily.map(({ area, data }) => (
            <DailyAreaCard key={area} area={area} data={data} />
          ))}
        </div>
      ) : (
        <Card className="mb-8 px-6 py-14 text-center">
          <div className="mb-2 text-4xl">🗓️</div>
          <div className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
            Nenhuma daily finalizada ainda
          </div>
          <p className="mx-auto mt-1 max-w-sm text-[13px]" style={{ color: "var(--muted)" }}>
            Quando você finalizar a daily em Pautas Semanais, o resumo dos assuntos aparece aqui.
          </p>
        </Card>
      )}

      {/* Semana em andamento */}
      <SectionTitle
        right={
          <Link href="/pautas" className="text-[13px] font-medium hover:underline" style={{ color: "var(--primary-dark)" }}>
            Ver pautas →
          </Link>
        }
      >
        Semana em andamento
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {AREA_KEYS.map((a) => {
          const cfg = AREAS[a];
          const d = store[a]?.current || store[a]?.draft || {};
          const { filled, total } = filledCount(a, d);
          const pct = total ? Math.round((filled / total) * 100) : 0;
          return (
            <Link key={a} href={`/pautas?area=${a}`}>
              <Card className="p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: cfg.color }}
                  >
                    {initials(cfg.person)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                      {cfg.name}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {cfg.person}
                    </div>
                  </div>
                  <span className="ml-auto text-[12px] font-semibold tabular-nums" style={{ color: "var(--text2)" }}>
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface3)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color }} />
                </div>
                <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                  {filled} de {total} campos preenchidos
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DailyAreaCard({ area, data }: { area: AreaKey; data: PautaData | null }) {
  const cfg = AREAS[area];
  const [open, setOpen] = useState(false);

  const prios = data ? prioritiesOf(area, data) : [];
  const sections = data ? filledSections(area, data) : [];
  const all = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.section })));
  const shown = open ? all : all.slice(0, 3);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: cfg.color }}
        >
          {initials(cfg.person)}
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
            {cfg.name}
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {cfg.person}
          </div>
        </div>
        <span
          className="ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: `${cfg.color}1f`, color: cfg.color }}
        >
          {cfg.short}
        </span>
      </div>

      <div className="px-5 py-4">
        {!data || (!prios.length && !all.length) ? (
          <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            Nada registrado na última daily.
          </p>
        ) : (
          <>
            {prios.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Prioridades
                </div>
                <ul className="flex flex-col gap-1.5">
                  {prios.map((p, i) => (
                    <li
                      key={p.key}
                      className="flex items-start gap-2.5 rounded-lg px-3 py-2 text-[13px]"
                      style={{ background: "var(--surface2)", color: "var(--text)" }}
                    >
                      <span
                        className="mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                        style={{ background: `${cfg.color}1f`, color: cfg.color }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1">
                        {p.text}
                        {weeksBadge(p.weeks, p.status) && (
                          <span className="ml-2 text-[11px] font-semibold" style={{ color: weeksBadge(p.weeks, p.status)!.color }}>
                            ⏳ {weeksBadge(p.weeks, p.status)!.text}
                          </span>
                        )}
                      </span>
                      <span
                        className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: `${STATUS_META[p.status].color}1a`, color: STATUS_META[p.status].color }}
                      >
                        {STATUS_META[p.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {shown.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Assuntos tratados
                </div>
                <ul className="flex flex-col gap-2.5">
                  {shown.map((i) => (
                    <li key={i.key} className="text-[13px]">
                      <div className="text-[11.5px] font-medium" style={{ color: "var(--muted)" }}>
                        {i.section} · {i.label}
                      </div>
                      <RichText text={i.value} bulletColor={cfg.color} className={open ? "" : "line-clamp-3"} style={{ color: "var(--text2)" }} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {all.length > 3 && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="mt-4 text-[12.5px] font-semibold hover:underline"
                style={{ color: "var(--primary-dark)" }}
              >
                {open ? "Mostrar menos" : `Ver tudo (${all.length} assuntos)`}
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
