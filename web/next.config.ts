import type { NextConfig } from "next";

/**
 * Publicação no GitHub Pages: o app é 100% client-side (Firebase), então é
 * exportado como site estático. Em produção o site vive em /<repositório>,
 * definido pelo workflow em NEXT_PUBLIC_BASE_PATH (vazio no desenvolvimento).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // Fixa a raiz do Turbopack neste diretório (evita que um package-lock.json
  // fora do repositório seja detectado como raiz do projeto).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
