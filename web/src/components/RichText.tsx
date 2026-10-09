import type { CSSProperties } from "react";

const BULLET = /^(\s*)([-*•])\s+(.*)$/;

/**
 * Exibe texto de pauta respeitando quebras de linha e listas.
 * Linhas iniciadas por "- ", "* " ou "• " viram marcadores (recuo = 2 espaços por nível).
 */
export function RichText({
  text,
  className = "",
  style,
  bulletColor,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  bulletColor?: string;
}) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const m = line.match(BULLET);
    if (m) {
      const level = Math.min(3, Math.floor(m[1].replace(/\t/g, "  ").length / 2));
      nodes.push(
        <div key={i} className="flex gap-2" style={{ marginLeft: level * 18 }}>
          <span className="mt-[0.55em] h-[5px] w-[5px] flex-shrink-0 rounded-full" style={{ background: bulletColor ?? "currentColor", opacity: bulletColor ? 1 : 0.55 }} />
          <span className="min-w-0 flex-1 break-words">{m[3]}</span>
        </div>,
      );
    } else if (!line.trim()) {
      nodes.push(<div key={i} className="h-2" />);
    } else {
      nodes.push(
        <div key={i} className="break-words">
          {line}
        </div>,
      );
    }
  });

  return (
    <div className={className} style={style}>
      {nodes}
    </div>
  );
}
