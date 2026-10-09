"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

/**
 * Script injetado no <head> para aplicar o tema salvo antes da hidratação,
 * evitando "flash" de tema errado. Espelha o comportamento do index.html.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // O ThemeScript já aplicou o data-theme no <html> antes da hidratação, então
  // lemos dele no client (no server cai no padrão "light").
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== "undefined") {
      return (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    }
    return "light";
  });

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch {}
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
