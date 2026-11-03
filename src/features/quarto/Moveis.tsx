/*
 * Desenhos dos móveis do quarto próprio (fase 34): uma tabela id → formas, como a DESENHO do hall (Sala.tsx), em
 * caixas isométricas. Cada desenho recebe o retângulo que o móvel ocupa (já com o giro: largura e fundo trocados)
 * e para onde ele "olha" (a frente fica do lado +j sem giro e do lado +i com giro). As cores são as classes q-<nome>
 * das variáveis --quarto-* de 24-ficha.css (com tema escuro), as mesmas do quarto fixo da ficha.
 */
import type { Retangulo } from "./quarto";

export type Pt = [number, number];
export type Poly = { q: Pt[]; c: string; linha?: boolean };
/** ponto (i, j, z) → tela, de quem está desenhando (a cena do quarto ou a prévia da loja) */
export type Proj = (i: number, j: number, z?: number) => Pt;

type Lapis = {
  poly: (q: Pt[], c: string, linha?: boolean) => void;
  box: (i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z?: number) => void;
};

function lapis(L: Poly[], p: Proj): Lapis {
  const poly = (q: Pt[], c: string, linha = false) => L.push({ q, c, linha });
  const box = (i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z = 0) => {
    poly([p(i, j + d, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i, j + d, z + h)], esq, true);
    poly([p(i + w, j, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i + w, j, z + h)], dir, true);
    poly([p(i, j, z + h), p(i + w, j, z + h), p(i + w, j + d, z + h), p(i, j + d, z + h)], topo, true);
  };
  return { poly, box };
}

/** Uma faixa encostada no lado de trás do retângulo (−j sem giro, −i com giro): encosto, cabeceira, fundo. */
function atras(r: Retangulo, giro: boolean, esp: number) {
  return giro ? { i: r.i, j: r.j, w: esp, d: r.d } : { i: r.i, j: r.j, w: r.w, d: esp };
}

type Desenho = (k: Lapis, r: Retangulo, giro: boolean) => void;
const M = 0.08; /* folga para o móvel não colar no rejunte */

const DESENHO_QUARTO: Record<string, Desenho> = {
  cama: (k, r, giro) => {
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 16, "madeira0", "madeira1", "madeira2");
    k.box(r.i + M + 0.04, r.j + M + 0.04, r.w - 2 * M - 0.08, r.d - 2 * M - 0.08, 8, "lencol0", "lencol1", "lencol1", 16);
    const c = atras(r, giro, 0.18);
    k.box(c.i + M, c.j + M, c.w - (giro ? 0 : 2 * M), c.d - (giro ? 2 * M : 0), 44, "madeira0", "madeira1", "madeira2");
    const t = atras(r, giro, 0.55);
    k.box(t.i + M + (giro ? 0.2 : 0.1), t.j + M + (giro ? 0.1 : 0.2), giro ? 0.3 : t.w - 0.36, giro ? t.d - 0.36 : 0.3, 6, "lencol0", "lencol1", "lencol1", 24);
  },
  "cama-casal": (k, r, giro) => DESENHO_QUARTO.cama(k, r, giro),
  sofa: (k, r, giro) => {
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 18, "cadeira0", "cadeira1", "cadeira2");
    const c = atras(r, giro, 0.3);
    k.box(c.i + M, c.j + M, c.w - (giro ? 0 : 2 * M), c.d - (giro ? 2 * M : 0), 40, "cadeira0", "cadeira1", "cadeira2");
  },
  poltrona: (k, r, giro) => DESENHO_QUARTO.sofa(k, r, giro),
  pc: (k, r, giro) => {
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 44, "preto0", "preto1", "preto2");
    /* a faixa RGB nas laterais, logo abaixo do tampo */
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 3, "preto0", "rgb2", "rgb3", 38);
    const f = atras(r, giro, 0.12);
    const n = giro ? r.d : r.w;
    for (let x = 0; x < 2; x++) {
      const a = 0.2 + (x * (n - 0.4)) / 2;
      const len = (n - 0.6) / 2;
      if (giro) k.box(f.i + 0.15, r.j + a, 0.1, len, 36, "preto0", "ceu", "preto1", 46);
      else k.box(r.i + a, f.j + 0.15, len, 0.1, 36, "preto0", "ceu", "preto1", 46);
    }
  },
  tv: (k, r, giro) => {
    k.box(r.i + M, r.j + M + (giro ? 0 : 0.1), r.w - 2 * M - (giro ? 0.2 : 0), r.d - 2 * M - (giro ? 0 : 0.2), 22, "madeira0", "madeira1", "madeira2");
    const f = atras(r, giro, 0.12);
    if (giro) k.box(f.i + 0.25, r.j + 0.2, 0.08, r.d - 0.4, 50, "preto0", "ceu", "preto1", 24);
    else k.box(r.i + 0.2, f.j + 0.25, r.w - 0.4, 0.08, 50, "preto0", "ceu", "preto1", 24);
  },
  estante: (k, r) => {
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 90, "madeira0", "madeira1", "madeira2");
    for (const z of [30, 60]) k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 3, "madeira0", "madeira0", "madeira0", z);
    k.box(r.i + 0.35, r.j + 0.35, 0.25, 0.25, 12, "ouro0", "ouro1", "ouro2", 90);
  },
  frigobar: (k, r) => {
    k.box(r.i + 0.15, r.j + 0.15, r.w - 0.3, r.d - 0.3, 58, "cinza0", "cinza1", "cinza2");
    k.box(r.i + 0.15, r.j + 0.15, r.w - 0.3, r.d - 0.3, 2, "cinza1", "cinza2", "cinza2", 40);
  },
  mesinha: (k, r) => {
    for (const [a, b] of [[0.2, 0.2], [0.72, 0.2], [0.2, 0.72], [0.72, 0.72]]) k.box(r.i + a, r.j + b, 0.08, 0.08, 16, "madeira1", "madeira1", "madeira2");
    k.box(r.i + 0.15, r.j + 0.15, r.w - 0.3, r.d - 0.3, 4, "madeira0", "madeira1", "madeira2", 16);
  },
  puff: (k, r) => {
    k.box(r.i + 0.25, r.j + 0.25, r.w - 0.5, r.d - 0.5, 16, "pelucia1", "pelucia0", "pelucia0");
  },
  luminaria: (k, r) => {
    k.box(r.i + 0.4, r.j + 0.4, 0.2, 0.2, 4, "preto0", "preto1", "preto2");
    k.box(r.i + 0.47, r.j + 0.47, 0.06, 0.06, 80, "preto0", "preto1", "preto2", 4);
    k.box(r.i + 0.3, r.j + 0.3, 0.4, 0.4, 16, "neon-ouro", "ouro1", "ouro2", 80);
  },
  "guarda-roupa": (k, r, giro) => {
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 110, "madeira0", "madeira1", "madeira2");
    const n = giro ? r.d : r.w;
    if (giro) k.box(r.i + r.w - M - 0.01, r.j + n / 2 - 0.02, 0.02, 0.04, 90, "madeira2", "madeira2", "madeira2", 10);
    else k.box(r.i + n / 2 - 0.02, r.j + r.d - M - 0.01, 0.04, 0.02, 90, "madeira2", "madeira2", "madeira2", 10);
  },
  /* os itens de piso que já existiam (fase 11) */
  "cadeira-gamer": (k, r, giro) => cadeira(k, r, giro, ["preto0", "preto1", "preto2"], 70),
  "cadeira-trono": (k, r, giro) => cadeira(k, r, giro, ["ouro0", "ouro1", "ouro2"], 90),
  "mesa-rgb": (k, r, giro) => DESENHO_QUARTO.pc(k, r, giro),
  "tapete-rift": (k, r) => tapete(k, r, "rift0", "rift1"),
  "tapete-pelucia": (k, r) => tapete(k, r, "pelucia0", "pelucia1"),
  "planta-samambaia": (k, r) => planta(k, r, "planta0", "planta1", "planta2", 5),
  "planta-cacto": (k, r) => {
    k.box(r.i + 0.3, r.j + 0.3, 0.4, 0.4, 20, "madeira0", "madeira1", "madeira2");
    k.box(r.i + 0.4, r.j + 0.4, 0.2, 0.2, 56, "cacto0", "cacto1", "cacto1", 20);
  },
};

function cadeira(k: Lapis, r: Retangulo, giro: boolean, c: [string, string, string], encosto: number) {
  k.box(r.i + 0.2, r.j + 0.2, r.w - 0.4, r.d - 0.4, 24, c[0], c[1], c[2]);
  const a = atras({ i: r.i + 0.2, j: r.j + 0.2, w: r.w - 0.4, d: r.d - 0.4 }, giro, 0.14);
  k.box(a.i, a.j, a.w, a.d, encosto, c[0], c[1], c[2], 24);
}
function tapete(k: Lapis, r: Retangulo, a: string, b: string) {
  k.poly([p0(r.i + 0.1, r.j + 0.1), p0(r.i + r.w - 0.1, r.j + 0.1), p0(r.i + r.w - 0.1, r.j + r.d - 0.1), p0(r.i + 0.1, r.j + r.d - 0.1)], a);
  k.poly([p0(r.i + 0.25, r.j + 0.25), p0(r.i + r.w - 0.25, r.j + 0.25), p0(r.i + r.w - 0.25, r.j + r.d - 0.25), p0(r.i + 0.25, r.j + r.d - 0.25)], b);
}
function planta(k: Lapis, r: Retangulo, f0: string, f1: string, f2: string, n: number) {
  k.box(r.i + 0.3, r.j + 0.3, 0.4, 0.4, 20, "madeira0", "madeira1", "madeira2");
  for (let x = 0; x < n; x++) k.box(r.i + 0.25 + (x % 3) * 0.12, r.j + 0.25 + ((x * 2) % 3) * 0.12, 0.22, 0.22, 14, f0, f1, f2, 20 + x * 7);
}
/* o tapete é desenhado no chão: guarda a projeção atual para os polígonos planos */
let projAtual: Proj = () => [0, 0];
const p0 = (i: number, j: number): Pt => projAtual(i, j, 0);

/** id do desenho de um item (os móveis novos têm `desenho`; os antigos usam o próprio id). */
export const desenhoDo = (it: { id: string; dados: { desenho?: string } }) => it.dados.desenho ?? it.id;
export const temDesenho = (id: string) => id in DESENHO_QUARTO;

/** As formas de um móvel no retângulo r (com o giro já aplicado em w e d), na projeção p. */
export function desenharMovel(p: Proj, desenho: string, r: Retangulo, giro: boolean): Poly[] {
  const L: Poly[] = [];
  const f = DESENHO_QUARTO[desenho];
  if (!f) return L;
  projAtual = p;
  f(lapis(L, p), r, giro);
  return L;
}

export function Poligonos({ lista }: { lista: Poly[] }) {
  return (
    <>
      {lista.map((d, k) => (
        <polygon key={k} points={d.q.map((v) => v.join(",")).join(" ")} className={`q-${d.c}` + (d.linha ? " q-linha" : "")} />
      ))}
    </>
  );
}
