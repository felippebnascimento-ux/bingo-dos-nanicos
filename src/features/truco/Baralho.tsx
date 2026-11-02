/*
 * Desenho próprio do baralho espanhol (40 cartas: 1 a 7, sota 10, cavalo 11 e rei 12) em SVG.
 * Carta de 60×90: moldura com as "pintas" do baralho espanhol (ouros sem corte, copas com 1, espadas com 2,
 * bastos com 3 cortes nas linhas de cima e de baixo), número nos cantos e, no meio, os naipes no arranjo
 * clássico ou a figura. As cores são as classes `cf-<nome>`, definidas em 20-truco.css (variáveis `--carta-*`).
 */
import type { ReactNode } from "react";
import type { Naipe } from "./engine";

/* ---------- os naipes, desenhados em volta do (0, 0), com uns 16 de altura ---------- */
function Ouro() {
  return (
    <>
      <circle r="7.2" className="cf-ouro cf-traco" />
      <circle r="5" className="cf-ouro2" />
      <circle r="5" className="cf-traco cf-vazio" />
      <circle r="1.8" className="cf-vermelho" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <circle key={a} r=".7" cx={3.4 * Math.cos((a * Math.PI) / 180)} cy={3.4 * Math.sin((a * Math.PI) / 180)} className="cf-vermelho" />
      ))}
    </>
  );
}
function Copa() {
  return (
    <>
      <path d="M-6.5-7.5h13c0 5.5-2.6 8.4-6.5 8.8-3.9-.4-6.5-3.3-6.5-8.8z" className="cf-ouro cf-traco" />
      <ellipse cy="-7.5" rx="6.5" ry="1.6" className="cf-vermelho cf-traco" />
      <path d="M-1.2 1.3h2.4v3.6h-2.4z" className="cf-ouro cf-traco" />
      <path d="M-4.5 7.8c.4-2.2 2.2-3 4.5-3s4.1.8 4.5 3z" className="cf-ouro cf-traco" />
      <circle cy="-2.6" r="1.1" className="cf-vermelho" />
    </>
  );
}
function Espada() {
  return (
    <>
      <path d="M-1.3-8.6 0-11l1.3 2.4V3h-2.6z" className="cf-azul cf-traco" />
      <path d="M0-9v11.5" className="cf-traco cf-vazio cf-fio" />
      <path d="M-5 3.1h10" className="cf-traco-ouro" />
      <path d="M-.9 3.6h1.8v4.6h-1.8z" className="cf-madeira cf-traco" />
      <circle cy="9.4" r="1.4" className="cf-ouro cf-traco" />
    </>
  );
}
function Basto() {
  return (
    <>
      <path d="M-2.6-9.8c1.9-1.3 5-.6 5 1.6L1.3 8.6c-.2 1.6-2.4 1.6-2.6 0L-3.6-6.8c0-1.3.3-2.3 1-3z" className="cf-verde cf-traco" />
      <path d="M-1.3-5.6l-1.8-1.3M.4-1.6l2-1.1M-.4 3.1l-1.8-.9" className="cf-traco cf-vazio" />
      <path d="M2.4-8.2c1.4-.4 2.4.3 2.4 1.4-1.4.3-2.3-.3-2.4-1.4z" className="cf-vermelho cf-traco" />
    </>
  );
}
const NAIPE: Record<Naipe, () => ReactNode> = { o: Ouro, c: Copa, e: Espada, b: Basto };

function Pinta({ s, x, y, k = 1, rot = 0 }: { s: Naipe; x: number; y: number; k?: number; rot?: number }) {
  const N = NAIPE[s];
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${k})`}>
      <N />
    </g>
  );
}

/* ---------- arranjo dos naipes nas cartas de 1 a 7 (x, y no miolo da carta) ---------- */
const ARRANJO: Record<number, [number, number][]> = {
  2: [[30, 26], [30, 64]],
  3: [[30, 21], [30, 45], [30, 69]],
  4: [[19, 27], [41, 27], [19, 63], [41, 63]],
  5: [[19, 23], [41, 23], [30, 45], [19, 67], [41, 67]],
  6: [[19, 22], [41, 22], [19, 45], [41, 45], [19, 68], [41, 68]],
  7: [[19, 20], [41, 20], [30, 33], [19, 48], [41, 48], [19, 70], [41, 70]],
};
/* tamanho dos naipes conforme a quantidade (cabem sem encostar; espada e basto são compridos, ficam menores) */
const TAM: Record<number, number> = { 2: 1.6, 3: 1.35, 4: 1.45, 5: 1.3, 6: 1.15, 7: 1.05 };

/* ---------- figuras: sota (10), cavalo (11) e rei (12), desenho simples e próprio ---------- */
function Sota({ s }: { s: Naipe }) {
  return (
    <>
      <path d="M26 66h3v11h-3zM31 66h3v11h-3z" className="cf-madeira" />
      <path d="M22 41h16l3 26H19z" className={"cf-roupa-" + s + " cf-traco"} />
      <path d="M22 41h16l-1 6H23z" className="cf-ouro cf-traco" />
      <path d="M28 41h4v26h-4z" className="cf-ouro2" />
      <circle cx="30" cy="33" r="5.4" className="cf-pele cf-traco" />
      <path d="M24.4 31.5c.6-4.6 10.6-4.6 11.2 0-3.6-1.2-7.6-1.2-11.2 0z" className={"cf-roupa-" + s + " cf-traco"} />
      <circle cx="28" cy="33.4" r=".6" className="cf-tinta" />
      <circle cx="32" cy="33.4" r=".6" className="cf-tinta" />
      <Pinta s={s} x={42} y={52} k={0.75} />
    </>
  );
}
function Cavalo({ s }: { s: Naipe }) {
  return (
    <>
      <path d="M19 62h3v14h-3zM24 63h3v13h-3zM35 63h3v13h-3zM40 62h3v14h-3z" className="cf-cavalo cf-traco" />
      <ellipse cx="31" cy="59" rx="14" ry="7.5" className="cf-cavalo cf-traco" />
      <path d="M41 56c2-7 3-12 7-14l3 3c-1 3-2 5-5 6l-2 7z" className="cf-cavalo cf-traco" />
      <path d="M47 42l-1-3 3 2z" className="cf-cavalo cf-traco" />
      <path d="M17 57c-3 2-4 7-3 10" className="cf-traco cf-vazio cf-crina" />
      <path d="M24 53h14v8H24z" className={"cf-roupa-" + s + " cf-traco"} />
      <path d="M26 39h9l1 14H25z" className={"cf-roupa-" + s + " cf-traco"} />
      <circle cx="30.5" cy="33" r="4.6" className="cf-pele cf-traco" />
      <path d="M25.6 31.4c.8-4 9-4 9.8 0z" className="cf-ouro cf-traco" />
      <Pinta s={s} x={19} y={39} k={0.7} rot={-12} />
    </>
  );
}
function Rei({ s }: { s: Naipe }) {
  return (
    <>
      <path d="M21 37h18l6 41H15z" className={"cf-roupa-" + s + " cf-traco"} />
      <path d="M27 37h6l2 41h-10z" className="cf-ouro2 cf-traco" />
      <path d="M21 37h18v4H21z" className="cf-ouro cf-traco" />
      <circle cx="30" cy="30" r="5.6" className="cf-pele cf-traco" />
      <path d="M25 33c1 5 9 5 10 0-1 2-9 2-10 0z" className="cf-barba cf-traco" />
      <path d="M24.4 26.4l1.4-6 2.6 3.2 1.6-4.2 1.6 4.2 2.6-3.2 1.4 6z" className="cf-ouro cf-traco" />
      <circle cx="28" cy="29.6" r=".6" className="cf-tinta" />
      <circle cx="32" cy="29.6" r=".6" className="cf-tinta" />
      <Pinta s={s} x={42} y={50} k={0.75} />
    </>
  );
}

/* ---------- moldura com as pintas (cortes nas linhas de cima e de baixo) ---------- */
const CORTES: Record<Naipe, number> = { o: 0, c: 1, e: 2, b: 3 };
function linhaComCortes(y: number, n: number) {
  const x0 = 4.5, x1 = 55.5, gap = 3;
  if (!n) return `M${x0} ${y}H${x1}`;
  const passo = (x1 - x0) / (n + 1);
  let d = `M${x0} ${y}`;
  for (let k = 1; k <= n; k++) {
    const meio = x0 + passo * k;
    d += `H${meio - gap / 2}M${meio + gap / 2} ${y}`;
  }
  return d + `H${x1}`;
}

/** A frente da carta, ocupando todo o espaço do `.tc`. */
export function FrenteCarta({ n, s }: { n: number; s: Naipe }) {
  const cortes = CORTES[s];
  return (
    <svg className="tc-face" viewBox="0 0 60 90" aria-hidden="true">
      <rect x=".5" y=".5" width="59" height="89" rx="6" className="cf-papel" />
      <path d={`${linhaComCortes(4.5, cortes)}${linhaComCortes(85.5, cortes)}M4.5 4.5V85.5M55.5 4.5V85.5`} className={"cf-moldura-" + s} />
      <text x="7.5" y="13" className={"cf-num cf-num-" + s}>
        {n}
      </text>
      <text x="7.5" y="13" className={"cf-num cf-num-" + s} transform="rotate(180 30 45)">
        {n}
      </text>
      {n === 1 ? (
        <Pinta s={s} x={30} y={45} k={2.3} rot={s === "e" || s === "b" ? -20 : 0} />
      ) : n <= 7 ? (
        ARRANJO[n].map(([x, y], k) => <Pinta key={k} s={s} x={x} y={y} k={TAM[n] * (s === "e" || s === "b" ? (n === 3 || n >= 6 ? 0.78 : 0.9) : 1)} rot={s === "b" ? (k % 2 ? 12 : -12) : 0} />)
      ) : (
        /* as figuras um pouco maiores, para encher a carta */
        <g transform="translate(30 47) scale(1.08) translate(-30 -50)">{n === 10 ? <Sota s={s} /> : n === 11 ? <Cavalo s={s} /> : <Rei s={s} />}</g>
      )}
    </svg>
  );
}
