"use client";
/*
 * O cavalo de corrida (05/11/2026): a ilustração do galope em 8 quadros (public/arte/corrida/cavalo-<pelagem>.webp, feita
 * por scripts/importar-cavalo.py e scripts/pelagens-cavalo.py). A seda, o capacete, o capuz e o pano vêm em cinza na folha
 * e a cor da raia é pintada por cima, multiplicando, pela máscara cavalo-seda.webp; o número vai no pano.
 * `DesenhoCavalo` é o cavalo solto (Haras, listas, loja); a pista desenha o mesmo cavalo dentro do SVG (`CavaloSvg`).
 */
import type { CSSProperties } from "react";
import type { Pelagem } from "./corridaRegras";

export const QUADROS = 8;
/** Duração de um passo de galope inteiro (os 8 quadros). */
export const GALOPE_MS = 560;
/** Tamanho de um quadro na folha e o centro do pano da sela nele. */
export const QW = 400;
export const QH = 280;
const PANO = { x: 172, y: 124 };

export const folhaDe = (p: Pelagem) => `/arte/corrida/cavalo-${p}.webp`;
export const MASCARA_SEDA = "/arte/corrida/cavalo-seda.webp";

/** Quanto o cavalo anda num galope inteiro, em larguras do quadro dele na tela. */
export const PASSADA = 1;
/** O quadro do galope pelo caminho já percorrido (`px` na tela), para a pata acompanhar o chão; `desloc` separa as raias. */
export function quadroNaPista(px: number, larg: number, desloc = 0) {
  const q = Math.floor((px / (larg * PASSADA) + desloc) * QUADROS);
  return ((q % QUADROS) + QUADROS) % QUADROS;
}

export function DesenhoCavalo({
  pelagem,
  raia,
  correndo = false,
  semJoquei = false,
  quadro = 0,
}: {
  pelagem: Pelagem;
  raia?: number;
  correndo?: boolean;
  /** sem raia: o jóquei vai com a seda dourada da casa */
  semJoquei?: boolean;
  quadro?: number;
}) {
  const estilo = { "--q": quadro, "--folha": `url(${folhaDe(pelagem)})` } as CSSProperties;
  return (
    <span className={"cav" + (raia !== undefined && !semJoquei ? ` raia-${raia + 1}` : "") + (correndo ? " cav-corre" : "")} style={estilo} aria-hidden="true">
      <i className="cav-folha" />
      <i className="cav-seda" />
      {raia !== undefined && !semJoquei && <b className="cav-num">{raia + 1}</b>}
    </span>
  );
}

/** O mesmo cavalo dentro de um SVG: `x`, `y` é o casco no chão e `larg` a largura do quadro na tela. */
export function CavaloSvg({ pelagem, raia, quadro, x, y, larg, idMascara }: { pelagem: Pelagem; raia: number; quadro: number; x: number; y: number; larg: number; idMascara: string }) {
  const alt = (larg * QH) / QW;
  return (
    <svg x={x - larg * 0.5} y={y - alt * 0.965} width={larg} height={alt} viewBox={`${quadro * QW} 0 ${QW} ${QH}`} className={`raia-${raia + 1}`}>
      <image href={folhaDe(pelagem)} width={QW * QUADROS} height={QH} />
      <rect width={QW * QUADROS} height={QH} mask={`url(#${idMascara})`} className="p3-seda" />
      <text x={quadro * QW + PANO.x} y={PANO.y} className="p3-num" textAnchor="middle" dominantBaseline="central">
        {raia + 1}
      </text>
    </svg>
  );
}
