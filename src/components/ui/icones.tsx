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
/** Troféus: prato vazio (Feeder), mapa (Turista), piano, controle (Viciado), interrogação (Sumido) e taça. */
export const IcPrato = (p: P) => (
  <Base {...p}>
    <ellipse cx="12" cy="13" rx="9" ry="5" />
    <ellipse cx="12" cy="12.5" rx="5" ry="2.5" />
    <path d="M8 4l1.5 3M16 4l-1.5 3" />
  </Base>
);
export const IcMapa = (p: P) => (
  <Base {...p}>
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
    <path d="M9 4v14M15 6v14" />
  </Base>
);
export const IcPiano = (p: P) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M8 6v7M12 6v7M16 6v7" />
  </Base>
);
export const IcControle = (p: P) => (
  <Base {...p}>
    <path d="M7 8h10a4 4 0 0 1 4 4l-1 4a2 2 0 0 1-3.4 1l-1.6-2h-6l-1.6 2A2 2 0 0 1 4 16l-1-4a4 4 0 0 1 4-4z" />
    <path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" />
  </Base>
);
export const IcPergunta = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01" />
  </Base>
);
export const IcTaca = (p: P) => (
  <Base {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9 17h6" />
  </Base>
);
/** Chama (dias seguidos no Sítio). */
export const IcChama = (p: P) => (
  <Base {...p}>
    <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z" />
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
/** Painel (Início): uma tela com o resumo do dia; a casinha é do Sítio. */
export const IcInicio = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M10 9.5V20" />
  </Base>
);
/** Pódio (Ranking de moedas). */
export const IcRanking = (p: P) => (
  <Base {...p}>
    <path d="M9 20V9h6v11M3.5 20v-6H9M15 20v-8h5.5v8M2.5 20h19" />
    <path d="M12 3.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" />
  </Base>
);
/** Sacola (Loja). */
export const IcLoja = (p: P) => (
  <Base {...p}>
    <path d="M5 8h14l-1 12H6z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
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
/** Mídias: moldura de foto com montanha. */
export const IcMidias = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 16l-5-5-8 8" />
  </Base>
);
/** Moeda (carteira). */
export const IcMochila = (p: P) => (
  <Base {...p}>
    <path d="M9 6V5a3 3 0 0 1 6 0v1M6 9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM9 13h6v3H9z" />
  </Base>
);
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
export const IcAmigos = (p: P) => (
  <Base {...p}>
    <circle cx="10" cy="8" r="3.2" />
    <path d="M4.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
    <path d="M18 8v6M15 11h6" />
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
/** Alto-falante cortado (som desligado). */
export const IcSemSom = (p: P) => (
  <Base {...p}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Base>
);
export const IcAjustes = (p: P) => (
  <Base {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Base>
);
/** engrenagem: abre as Configurações (como a do Discord, embaixo do menu) */
export const IcEngrenagem = (p: P) => (
  <Base {...p}>
    <path d="M10.3 3.5h3.4l.5 2.4 1.7 1 2.3-.8 1.7 2.9-1.8 1.6v2l1.8 1.6-1.7 2.9-2.3-.8-1.7 1-.5 2.4h-3.4l-.5-2.4-1.7-1-2.3.8-1.7-2.9 1.8-1.6v-2L4.1 9l1.7-2.9 2.3.8 1.7-1z" />
    <circle cx="12" cy="12" r="2.8" />
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
/** Voz e canais (estilo Discord): microfone, fone, desligar, # do canal de texto e a seta de recolher. */
export const IcMic = (p: P) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </Base>
);
export const IcMicDesligado = (p: P) => (
  <Base {...p}>
    <path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5" />
    <path d="M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11a6.4 6.4 0 0 1-.5 2.4M12 17.5V21M4 4l16 16" />
  </Base>
);
export const IcFone = (p: P) => (
  <Base {...p}>
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <rect x="3.5" y="14" width="4" height="6" rx="1.5" />
    <rect x="16.5" y="14" width="4" height="6" rx="1.5" />
  </Base>
);
export const IcFoneDesligado = (p: P) => (
  <Base {...p}>
    <path d="M4 15v-3a8 8 0 0 1 12.6-6.5M19.4 9A8 8 0 0 1 20 12v3" />
    <rect x="3.5" y="14" width="4" height="6" rx="1.5" />
    <rect x="16.5" y="14" width="4" height="6" rx="1.5" />
    <path d="M4 4l16 16" />
  </Base>
);
export const IcDesligar = (p: P) => (
  <Base {...p}>
    <path d="M3.5 14.5c4.7-4.7 12.3-4.7 17 0l-2 2.5-3.2-1.3v-2.4a10 10 0 0 0-6.6 0v2.4L5.5 17z" />
  </Base>
);
export const IcHash = (p: P) => (
  <Base {...p}>
    <path d="M9 4L7 20M17 4l-2 16M4.5 9h16M3.5 15h16" />
  </Base>
);
export const IcChat = (p: P) => (
  <Base {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.2 3.6c-.3.3-.8 0-.8-.4z" />
  </Base>
);
export const IcSeta = (p: P) => (
  <Base strokeWidth={2.4} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Base>
);
/** estrela da casa LIVRE da cartela */
export const IcEstrela = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2.5l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.8l-5.8 3.5 1.6-6.6-5.2-4.4 6.8-.5z" />
  </svg>
);

/** Voz no estilo Discord: transmitir a tela, sinal da conexão, supressão de ruído, grade, olho (quem assiste) e chat. */
export const IcTela = (p: P) => (
  <Base {...p}>
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M8 21h8M12 17v4M12 13.5V8m-2.8 2.8L12 8l2.8 2.8" />
  </Base>
);
export const IcSinal = (p: P) => (
  <Base strokeWidth={0} fill="currentColor" {...p}>
    <rect x="3" y="15" width="4" height="6" rx="1" />
    <rect x="10" y="10" width="4" height="11" rx="1" />
    <rect x="17" y="4" width="4" height="17" rx="1" />
  </Base>
);
export const IcOndas = (p: P) => (
  <Base strokeWidth={2.2} {...p}>
    <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
  </Base>
);
export const IcGrade = (p: P) => (
  <Base {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Base>
);
export const IcOlho = (p: P) => (
  <Base {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);
export const IcMais3 = (p: P) => (
  <Base strokeWidth={3} {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </Base>
);
/** Quarto próprio: a casinha com a cama (quem está num quarto, na lista de membros). */
export const IcQuarto = (p: P) => (
  <Base {...p}>
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M8 17v-3h8v3M8 14.5h3" />
  </Base>
);
