import type { MetadataRoute } from "next";

/* "Instalar o app": o navegador lê isto e oferece o Bingo dos Nanicos como um app, com ícone no Dock e na tela inicial
   do celular, abrindo sem a barra do navegador. */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bingo dos Nanicos",
    short_name: "Nanicos",
    description: "O site dos nanicos: call, chat, K-FOFO, cassino e bingo.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#2E2E2D",
    theme_color: "#2E2E2D",
    lang: "pt-BR",
    icons: [
      { src: "/icones/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/app-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/app-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
