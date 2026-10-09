"use client";

import { useRef, type CSSProperties } from "react";

const BULLET = /^(\s*)([-*•])\s+(.*)$/;

/**
 * Textarea de pauta com marcadores:
 * - botão "•" alterna marcadores nas linhas selecionadas;
 * - Enter numa linha com marcador continua a lista; Enter num marcador vazio encerra.
 * Quebras de linha são preservadas (o texto é guardado como está, com "- ").
 */
export function BulletTextarea({
  value,
  onChange,
  className,
  style,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const apply = (next: string, selStart: number, selEnd = selStart) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  function toggleBullets() {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s0, selectionEnd: e0 } = el;
    const start = value.lastIndexOf("\n", s0 - 1) + 1;
    let end = value.indexOf("\n", e0);
    if (end === -1) end = value.length;
    const lines = value.slice(start, end).split("\n");
    const filled = lines.filter((l) => l.trim());
    const allBullets = filled.length > 0 && filled.every((l) => BULLET.test(l));
    const out = lines.map((l) => {
      if (!l.trim()) return l;
      const m = l.match(BULLET);
      if (allBullets) return m ? m[1] + m[3] : l;
      return m ? l : `- ${l}`;
    });
    const joined = out.join("\n");
    apply(value.slice(0, start) + joined + value.slice(end), start, start + joined.length);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const pos = el.selectionStart;
    if (pos !== el.selectionEnd) return;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    const lineEnd = value.indexOf("\n", pos);
    const line = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);
    const m = line.match(BULLET);
    // Também reconhece marcador vazio ("- ") para encerrar a lista.
    const empty = line.match(/^(\s*)([-*•])\s*$/);
    if (empty && pos === lineStart + line.length) {
      e.preventDefault();
      apply(value.slice(0, lineStart) + value.slice(lineStart + line.length), lineStart);
      return;
    }
    if (m && pos >= lineStart + m[1].length + 2) {
      e.preventDefault();
      const ins = `\n${m[1]}${m[2]} `;
      apply(value.slice(0, pos) + ins + value.slice(pos), pos + ins.length);
    }
  }

  return (
    <div className="group relative">
      <textarea
        ref={ref}
        className={className}
        style={style}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleBullets}
        title="Marcadores (lista com •)"
        className="absolute bottom-2 right-2 flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold opacity-50 transition hover:opacity-100 group-focus-within:opacity-100"
        style={{ background: "var(--surface)", borderColor: "var(--border2)", color: "var(--text2)" }}
      >
        <span className="text-[14px] leading-none">•</span> Lista
      </button>
    </div>
  );
}
