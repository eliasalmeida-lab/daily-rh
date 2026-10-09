import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixa a raiz do Turbopack neste diretório (evita que um package-lock.json
  // fora do repositório seja detectado como raiz do projeto).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
