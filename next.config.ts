import type { NextConfig } from "next";

/* Site estático: `next build` gera a pasta `out/`, que a Vercel publica.
   Os cabeçalhos de segurança (CSP etc.) continuam no vercel.json. */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
