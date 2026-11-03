/*
 * Baralho francês (pôquer e blackjack) em SVG próprio, no mesmo capricho do espanhol do truco (Baralho.tsx):
 * carta de 60×84 com o valor e o naipe nos cantos, os naipes no arranjo clássico (de 2 a 10), um naipe grande no Ás
 * e um retrato com moldura nas figuras (J, Q, K). O verso tem o "N" dourado dos Nanicos.
 * As cores são as variáveis --carta-* (36-mesas.css): a carta é de papel, clara também no tema escuro.
 */
import type { ReactNode } from "react";

export type NaipeF = "s" | "h" | "d" | "c";
export type Valor = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
const NOME_NAIPE: Record<NaipeF, string> = { s: "espadas", h: "copas", d: "ouros", c: "paus" };
const NOME_VALOR: Partial<Record<Valor, string>> = { A: "Ás", J: "Valete", Q: "Dama", K: "Rei" };
export const nomeCartaF = (v: Valor, n: NaipeF) => `${NOME_VALOR[v] ?? v} de ${NOME_NAIPE[n]}`;
export const vermelha = (n: NaipeF) => n === "h" || n === "d";

/* naipes desenhados em volta do (0, 0), com uns 20 de altura */
export function Naipe({ n }: { n: NaipeF }) {
  if (n === "h") return <path d="M0 9C-3-1-10-2-10-6.3-10-10 -6.6-11.5-4.6-11.2-2.4-10.9-.9-9.3 0-7.3.9-9.3 2.4-10.9 4.6-11.2 6.6-11.5 10-10 10-6.3 10-2 3-1 0 9Z" />;
  if (n === "d") return <path d="M0-11 8 0 0 11-8 0Z" />;
  if (n === "s")
    return (
      <path d="M0-11C-2.5-6.5-10-3.4-10 1.3-10 4.4-7.6 6.2-5.2 6.2-3.6 6.2-2.3 5.4-1.4 4.3-1.6 7-2.6 9.3-4.6 11H4.6C2.6 9.3 1.6 7 1.4 4.3 2.3 5.4 3.6 6.2 5.2 6.2 7.6 6.2 10 4.4 10 1.3 10-3.4 2.5-6.5 0-11Z" />
    );
  return (
    <path d="M0-11C-3-11-5-8.8-5-6.2-5-4.9-4.5-3.8-3.7-3-4.5-3.4-5.4-3.6-6.3-3.6-9.1-3.6-11-1.4-11 1.4-11 4.2-9 6.4-6.2 6.4-4.4 6.4-2.8 5.5-1.6 4-1.8 7-2.8 9.3-4.7 11H4.7C2.8 9.3 1.8 7 1.6 4 2.8 5.5 4.4 6.4 6.2 6.4 9 6.4 11 4.2 11 1.4 11-1.4 9.1-3.6 6.3-3.6 5.4-3.6 4.5-3.4 3.7-3 4.5-3.8 5-4.9 5-6.2 5-8.8 3-11 0-11Z" />
  );
}

/* posições dos naipes no meio (em uma área de 36×56, centro em 30,42), como nas cartas de verdade */
const L = 19, C = 30, R = 41;
const ARRANJO: Partial<Record<Valor, [number, number, boolean?][]>> = {
  "2": [[C, 22], [C, 62, true]],
  "3": [[C, 22], [C, 42], [C, 62, true]],
  "4": [[L, 22], [R, 22], [L, 62, true], [R, 62, true]],
  "5": [[L, 22], [R, 22], [C, 42], [L, 62, true], [R, 62, true]],
  "6": [[L, 22], [R, 22], [L, 42], [R, 42], [L, 62, true], [R, 62, true]],
  "7": [[L, 22], [R, 22], [C, 32], [L, 42], [R, 42], [L, 62, true], [R, 62, true]],
  "8": [[L, 22], [R, 22], [C, 32], [L, 42], [R, 42], [C, 52, true], [L, 62, true], [R, 62, true]],
  "9": [[L, 20], [R, 20], [L, 34], [R, 34], [C, 42], [L, 50, true], [R, 50, true], [L, 64, true], [R, 64, true]],
  "10": [[L, 20], [R, 20], [C, 27], [L, 34], [R, 34], [L, 50, true], [R, 50, true], [C, 57, true], [L, 64, true], [R, 64, true]],
};

function Miolo({ v, n }: { v: Valor; n: NaipeF }): ReactNode {
  const pos = ARRANJO[v];
  if (pos)
    return pos.map(([x, y, vira], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(.5)${vira ? " rotate(180)" : ""}`} className="cfr-naipe">
        <Naipe n={n} />
      </g>
    ));
  if (v === "A")
    return (
      <g transform="translate(30 42) scale(1.25)" className="cfr-naipe">
        <Naipe n={n} />
      </g>
    );
  /* figuras: moldura dourada, a letra grande e o naipe, como um retrato */
  return (
    <>
      <rect x="13" y="16" width="34" height="52" rx="3" className="cfr-moldura" />
      <rect x="15.5" y="18.5" width="29" height="47" rx="2" className="cfr-retrato" />
      <text x="30" y="47" className="cfr-figura">
        {v}
      </text>
      <g transform="translate(30 26) scale(.36)" className="cfr-naipe">
        <Naipe n={n} />
      </g>
      <g transform="translate(30 58) scale(.36) rotate(180)" className="cfr-naipe">
        <Naipe n={n} />
      </g>
    </>
  );
}

type Props = { v?: Valor; n?: NaipeF; costas?: boolean; className?: string; ganha?: boolean };

/** Uma carta do baralho francês (ou o verso, com `costas`). */
export function CartaFrancesa({ v, n, costas, className = "", ganha }: Props) {
  if (costas || !v || !n)
    return (
      <span className={"cfr costas " + className} aria-label="Carta virada" role="img">
        <svg viewBox="0 0 60 84" aria-hidden="true">
          <rect x=".5" y=".5" width="59" height="83" rx="5" className="cfr-verso" />
          <rect x="4" y="4" width="52" height="76" rx="3" className="cfr-verso-fio" />
          <path d="M8 8h44v68H8z" className="cfr-verso-trama" />
          <circle cx="30" cy="42" r="12" className="cfr-verso-selo" />
          <text x="30" y="47.5" className="cfr-verso-n">
            N
          </text>
        </svg>
      </span>
    );
  return (
    <span className={"cfr " + (vermelha(n) ? "vermelha " : "") + (ganha ? "ganha " : "") + className} aria-label={nomeCartaF(v, n)} role="img">
      <svg viewBox="0 0 60 84" aria-hidden="true">
        <rect x=".5" y=".5" width="59" height="83" rx="5" className="cfr-papel" />
        <g className="cfr-canto">
          <text x="7.5" y="13" className="cfr-valor">
            {v}
          </text>
          <g transform="translate(7.5 20) scale(.28)" className="cfr-naipe">
            <Naipe n={n} />
          </g>
        </g>
        <g className="cfr-canto" transform="rotate(180 30 42)">
          <text x="7.5" y="13" className="cfr-valor">
            {v}
          </text>
          <g transform="translate(7.5 20) scale(.28)" className="cfr-naipe">
            <Naipe n={n} />
          </g>
        </g>
        <Miolo v={v} n={n} />
      </svg>
    </span>
  );
}
