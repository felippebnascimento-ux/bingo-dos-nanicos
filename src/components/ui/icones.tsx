/* Ícones do site (traço de 2 px, 24×24). Reaproveite em vez de desenhar outro parecido. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { tam?: number };

const Base = ({ tam = 20, children, ...p }: P) => (
  <svg
    viewBox="0 0 24 24"
    width={tam}
    height={tam}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    {children}
  </svg>
);

export const IcVoltar = (p: P) => (
  <Base {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Base>
);
/** Coroa de moedas (1º lugar do ranking). */
export const IcCoroa = (p: P) => (
  <Base {...p} fill="currentColor" strokeWidth={1.5}>
    <path d="M3 17l2-9 4.5 4L12 6l2.5 6L19 8l2 9z" />
    <circle cx="12" cy="4.5" r="1.5" />
    <path d="M4 19.5h16" />
  </Base>
);
/** Casinha (Início). */
export const IcInicio = (p: P) => (
  <Base {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h12V10" />
    <path d="M10 20v-5h4v5" />
  </Base>
);
/** Ficha de cassino (aba Cassino). */
export const IcCassino = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
  </Base>
);
/** Moeda (carteira). */
export const IcMoeda = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.6 9.2c-.5-.8-1.5-1.3-2.6-1.3-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2.1 2.6.9 2.6 2.1-1.1 2-2.6 2c-1.1 0-2.1-.5-2.6-1.3M12 6.5v1.4M12 16.1v1.4" />
  </Base>
);
/** Casa do sítio (aba Sítio). */
export const IcSitio = (p: P) => (
  <Base {...p}>
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-5.5h4V20" />
  </Base>
);
export const IcJogar = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" />
  </Base>
);
export const IcNanicadas = (p: P) => (
  <Base {...p}>
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
  </Base>
);
export const IcNanicos = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
    <circle cx="17" cy="9" r="2.6" />
    <path d="M15.5 14.6c2.6-.3 4.6 1.1 5 4.4" />
  </Base>
);
export const IcAoVivo = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" />
  </Base>
);
export const IcTruco = (p: P) => (
  <Base {...p}>
    <rect x="3" y="6" width="10" height="15" rx="2" transform="rotate(-12 8 13.5)" />
    <rect x="10" y="3" width="10" height="15" rx="2" transform="rotate(10 15 10.5)" />
  </Base>
);
export const IcPerfil = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
  </Base>
);
export const IcCamera = (p: P) => (
  <Base {...p}>
    <path d="M15 10l4.6-2.6a.9.9 0 0 1 1.4.8v7.6a.9.9 0 0 1-1.4.8L15 14" />
    <rect x="3" y="6" width="12" height="12" rx="2.5" />
  </Base>
);
/** janela flutuante (picture-in-picture) */
export const IcJanela = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <rect x="12" y="11" width="7" height="6" rx="1.2" fill="currentColor" stroke="none" />
  </Base>
);
export const IcReagir = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
    <path d="M9 9.5h.01M15 9.5h.01" strokeWidth={3} />
  </Base>
);
export const IcLapis = (p: P) => (
  <Base {...p}>
    <path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z" />
    <path d="M14 6l3 3" />
  </Base>
);
export const IcVolume = (p: P) => (
  <Base {...p}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Base>
);
export const IcAjustes = (p: P) => (
  <Base {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Base>
);
/** tela cheia: o CSS mostra `.fs-in` ou `.fs-out` conforme o botão tem `.on` */
export const IcTelaCheia = (p: P) => (
  <Base {...p}>
    <path className="fs-in" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    <path className="fs-out" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Base>
);
export const IcFome = (p: P) => (
  <Base tam={22} {...p}>
    <path d="M4 11h16a8 8 0 0 1-16 0z" />
    <path d="M5 11c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    <path d="M3 15h18M9 7.5v.01M12 6.5v.01M15 7.5v.01" />
  </Base>
);
export const IcFechar = (p: P) => (
  <Base strokeWidth={3} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);
/** abrir numa janela flutuante (setas para fora) */
export const IcExpandir = (p: P) => (
  <Base strokeWidth={2.4} {...p}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </Base>
);
/** estrela da casa LIVRE da cartela */
export const IcEstrela = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2.5l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.8l-5.8 3.5 1.6-6.6-5.2-4.4 6.8-.5z" />
  </svg>
);
