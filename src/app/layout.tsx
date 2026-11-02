import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";
/* a ordem importa: as regras de baixo sobrescrevem as de cima, igual ao CSS do site antigo */
import "@/styles/01-base.css";
import "@/styles/02-blocos.css";
import "@/styles/03-cartela.css";
import "@/styles/04-nanicadas.css";
import "@/styles/05-nanicos-perfil.css";
import "@/styles/06-portas.css";
import "@/styles/07-ao-vivo.css";
import "@/styles/08-menu.css";
import "@/styles/09-ao-vivo-painel.css";
import "@/styles/10-log.css";
import "@/styles/11-fome.css";
import "@/styles/12-ao-vivo-controles.css";
import "@/styles/13-camera.css";
import "@/styles/14-riot.css";
import "@/styles/15-reacoes.css";
import "@/styles/16-montar.css";
import "@/styles/17-desenho.css";
import "@/styles/18-ao-vivo-icones.css";
import "@/styles/19-cameras-faixa.css";
import "@/styles/20-truco.css";
import "@/styles/21-sala.css";
import "@/styles/22-hall.css";
import "@/styles/23-moedas.css";
import "@/styles/24-ficha.css";
import "@/styles/25-salas.css";
import "@/styles/26-cassino.css";
import "@/styles/28-trofeus.css";
import "@/styles/29-canais.css";
import "@/styles/30-loja.css";
import "@/styles/31-missoes.css";
import "@/styles/32-midias.css";
import "@/styles/33-celular.css";

/* fontes servidas pelo próprio site (a CSP não precisa liberar o Google Fonts) */
const unbounded = Unbounded({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-unbounded", display: "swap" });
const onest = Onest({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: "Bingo dos Nanicos",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${unbounded.variable} ${onest.variable}`}>
      <body>{children}</body>
    </html>
  );
}
