/*
 * Desenhos dos móveis do quarto próprio (fase 34): uma tabela id → formas, como a DESENHO do hall (Sala.tsx), em
 * caixas isométricas. Cada desenho recebe o retângulo que o móvel ocupa (já com o giro: largura e fundo trocados)
 * e para onde ele "olha" (a frente fica do lado +j sem giro e do lado +i com giro). As cores são as classes q-<nome>
 * das variáveis --quarto-* de 24-ficha.css (com tema escuro), as mesmas do quarto fixo da ficha.
 */
import { Fragment, useId } from "react";
import type { Retangulo } from "./quarto";

export type Pt = [number, number];
/** g = o degradê suave por cima da face (estilo "macio", escolhido em 03/11/2026): "f" na frente, "l" no lado */
export type Poly = { q: Pt[]; c: string; linha?: boolean; g?: "f" | "l" };
/** ponto (i, j, z) → tela, de quem está desenhando (a cena do quarto ou a prévia da loja) */
export type Proj = (i: number, j: number, z?: number) => Pt;

type Lapis = {
  poly: (q: Pt[], c: string, linha?: boolean) => void;
  box: (i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z?: number) => void;
};

function lapis(L: Poly[], p: Proj): Lapis {
  const poly = (q: Pt[], c: string, linha = false, g?: "f" | "l") => L.push({ q, c, linha, g });
  /* a caixa "macia": a quina de cima chanfrada (parece arredondada) e um degradê nas faces; peça fina fica reta */
  const box = (i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z = 0) => {
    const ch = h >= 5 && w > 0.14 && d > 0.14 ? Math.min(0.06, w / 4, d / 4) : 0;
    const zt = z + h, zb = ch ? zt - Math.min(h * 0.25, 5) : zt;
    poly([p(i, j + d, z), p(i + w, j + d, z), p(i + w, j + d, zb), p(i, j + d, zb)], esq, true, "f");
    poly([p(i + w, j, z), p(i + w, j + d, z), p(i + w, j + d, zb), p(i + w, j, zb)], dir, true, "l");
    if (!ch) return poly([p(i, j, zt), p(i + w, j, zt), p(i + w, j + d, zt), p(i, j + d, zt)], topo, true);
    poly([p(i, j + d, zb), p(i + w, j + d, zb), p(i + w - ch, j + d - ch, zt), p(i, j + d - ch, zt)], topo, true);
    poly([p(i + w, j, zb), p(i + w, j + d, zb), p(i + w - ch, j + d - ch, zt), p(i + w - ch, j, zt)], esq, true);
    poly([p(i, j, zt), p(i + w - ch, j, zt), p(i + w - ch, j + d - ch, zt), p(i, j + d - ch, zt)], topo, true);
  };
  return { poly, box };
}

/**
 * Caixas no referencial do móvel, sem pensar no giro: u corre na largura (W) e v vai do fundo (0) para a frente (D).
 * `boxF` recebe a cor da frente e a do lado (a frente é a face +j sem giro e a +i com giro).
 */
function rel(k: Lapis, r: Retangulo, giro: boolean) {
  const W = giro ? r.d : r.w, D = giro ? r.w : r.d;
  const box = (u: number, v: number, lu: number, lv: number, h: number, t: string, e: string, d: string, z = 0) =>
    giro ? k.box(r.i + v, r.j + u, lv, lu, h, t, e, d, z) : k.box(r.i + u, r.j + v, lu, lv, h, t, e, d, z);
  const boxF = (u: number, v: number, lu: number, lv: number, h: number, t: string, frente: string, lado: string, z = 0) =>
    giro ? box(u, v, lu, lv, h, t, lado, frente, z) : box(u, v, lu, lv, h, t, frente, lado, z);
  return { W, D, box, boxF };
}
/* três tons de uma cor: topo, frente e lado */
const tons = (c: string): [string, string, string] => [c + "0", c + "1", c + "2"];
/* as lombadas dos livros, sempre na mesma ordem (o desenho não pode mudar a cada render) */
const LIVROS: [string, string, string][] = [tons("cadeira"), tons("ouro"), tons("pp-vermelho"), tons("planta"), ["lencol0", "lencol1", "lencol1"], tons("preto")];

/** Uma faixa encostada no lado de trás do retângulo (−j sem giro, −i com giro): encosto, cabeceira, fundo. */
function atras(r: Retangulo, giro: boolean, esp: number) {
  return giro ? { i: r.i, j: r.j, w: esp, d: r.d } : { i: r.i, j: r.j, w: r.w, d: esp };
}

type Desenho = (k: Lapis, r: Retangulo, giro: boolean) => void;
const M = 0.08; /* folga para o móvel não colar no rejunte */

const DESENHO_QUARTO: Record<string, Desenho> = {
  /* cama: pés, cabeceira estofada, colchão, dois travesseiros e o cobertor dobrado na metade da frente */
  cama: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    for (const [u, v] of [[M + 0.04, M + 0.04], [W - M - 0.12, M + 0.04], [M + 0.04, D - M - 0.12], [W - M - 0.12, D - M - 0.12]]) box(u, v, 0.08, 0.08, 5, "madeira1", "madeira1", "madeira2");
    box(M, M, W - 2 * M, 0.14, 54, "madeira0", "madeira1", "madeira2");
    boxF(M + 0.08, M + 0.14, W - 2 * M - 0.16, 0.03, 32, "cadeira0", "cadeira1", "cadeira2", 16);
    box(M, M + 0.17, W - 2 * M, D - 2 * M - 0.17, 11, "madeira0", "madeira1", "madeira2", 5);
    box(M + 0.04, M + 0.19, W - 2 * M - 0.08, D - 2 * M - 0.23, 10, "lencol0", "lencol1", "lencol1", 16);
    const nt = W >= 1.5 ? 2 : 1, tw = (W - 2 * M - 0.2 - (nt - 1) * 0.08) / nt;
    for (let x = 0; x < nt; x++) box(M + 0.1 + x * (tw + 0.08), M + 0.26, tw, 0.32, 7, "lencol0", "lencol1", "lencol1", 26);
    const vc = M + 0.19 + (D - 2 * M - 0.23) * 0.42;
    box(M + 0.02, vc, W - 2 * M - 0.04, D - M - 0.02 - vc, 13, "cadeira0", "cadeira1", "cadeira2", 14);
    box(M + 0.02, vc, W - 2 * M - 0.04, 0.1, 14, "lencol0", "lencol1", "lencol1", 14);
  },
  "cama-casal": (k, r, giro) => DESENHO_QUARTO.cama(k, r, giro),
  /* sofá: pezinhos, base, encosto com almofadas, braços dos dois lados, assentos separados e uma almofada dourada */
  sofa: (k, r, giro) => {
    const { W, D, box } = rel(k, r, giro);
    const c = tons("cadeira");
    for (const [u, v] of [[M + 0.06, M + 0.06], [W - M - 0.12, M + 0.06], [M + 0.06, D - M - 0.12], [W - M - 0.12, D - M - 0.12]]) box(u, v, 0.06, 0.06, 4, "preto0", "preto1", "preto2");
    box(M, M, W - 2 * M, D - 2 * M, 14, ...c, 4);
    box(M, M, W - 2 * M, 0.24, 36, ...c, 4);
    const bw = 0.17, a0 = M + bw, a1 = W - M - bw;
    const n = W - 2 * M >= 1.5 ? 3 : W - 2 * M >= 1 ? 2 : 1, sw = (a1 - a0 - (n - 1) * 0.03) / n;
    for (let x = 0; x < n; x++) box(a0 + x * (sw + 0.03), M + 0.24, sw, 0.16, 22, ...c, 18);
    box(M, M + 0.04, bw, D - 2 * M - 0.04, 14, ...c, 18);
    for (let x = 0; x < n; x++) box(a0 + x * (sw + 0.03) + 0.01, M + 0.4, sw - 0.02, D - 2 * M - 0.42, 7, ...c, 18);
    box(a0 + 0.05, M + 0.4, Math.min(0.22, sw - 0.1), 0.08, 10, ...tons("ouro"), 25);
    box(a1, M + 0.04, bw, D - 2 * M - 0.04, 14, ...c, 18);
  },
  poltrona: (k, r, giro) => DESENHO_QUARTO.sofa(k, r, giro),
  /* mesa do PC: pés, gabinete com a faixa RGB, tampo com a faixa RGB, dois monitores, teclado e mouse */
  pc: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    for (const [u, v] of [[M, M], [W - M - 0.07, M]]) box(u, v, 0.07, 0.07, 40, "preto0", "preto1", "preto2");
    boxF(W - M - 0.42, M + 0.12, 0.26, D - 2 * M - 0.24, 34, "preto0", "preto1", "preto2");
    boxF(W - M - 0.42, D - M - 0.13, 0.26, 0.01, 26, "preto0", "rgb2", "rgb3", 4);
    for (const [u, v] of [[M, D - M - 0.07], [W - M - 0.07, D - M - 0.07]]) box(u, v, 0.07, 0.07, 40, "preto0", "preto1", "preto2");
    box(M, M, W - 2 * M, D - 2 * M, 3, "preto0", "rgb2", "rgb3", 37);
    box(M, M, W - 2 * M, D - 2 * M, 4, "preto0", "preto1", "preto2", 40);
    const len = (W - 0.6) / 2;
    for (let x = 0; x < 2; x++) {
      const a = 0.2 + (x * (W - 0.4)) / 2;
      box(a + len / 2 - 0.06, M + 0.14, 0.12, 0.08, 2, "preto1", "preto1", "preto2", 44);
      box(a + len / 2 - 0.02, M + 0.16, 0.04, 0.04, 8, "preto1", "preto1", "preto2", 46);
      boxF(a, M + 0.12, len, 0.08, 34, "preto0", "preto1", "preto2", 52);
      boxF(a + 0.03, M + 0.2, len - 0.06, 0.01, 28, "preto0", "ceu", "preto2", 55);
    }
    box(W / 2 - 0.32, D - M - 0.36, 0.64, 0.16, 2, "teclado", "preto1", "preto2", 44);
    box(W / 2 + 0.42, D - M - 0.32, 0.08, 0.12, 2, "preto0", "preto1", "preto2", 44);
  },
  /* rack com duas portas e a TV de tela fina no pé, acesa */
  tv: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    for (const u of [M + 0.04, W - M - 0.1]) box(u, D - M - 0.12, 0.06, 0.06, 4, "madeira1", "madeira1", "madeira2");
    box(M, M + 0.1, W - 2 * M, D - 2 * M - 0.1, 18, "madeira0", "madeira1", "madeira2", 4);
    const pw = (W - 2 * M - 0.12) / 2;
    for (let x = 0; x < 2; x++) {
      boxF(M + 0.04 + x * (pw + 0.04), D - M, pw, 0.01, 12, "madeira0", "madeira0", "madeira1", 7);
      boxF(M + 0.04 + x * (pw + 0.04) + (x ? 0.06 : pw - 0.1), D - M + 0.01, 0.04, 0.01, 3, "ouro0", "ouro1", "ouro2", 13);
    }
    box(W / 2 - 0.2, M + 0.2, 0.4, 0.14, 2, "preto1", "preto1", "preto2", 22);
    box(W / 2 - 0.03, M + 0.24, 0.06, 0.04, 8, "preto1", "preto1", "preto2", 24);
    boxF(0.2, M + 0.22, W - 0.4, 0.06, 48, "preto0", "preto1", "preto2", 30);
    boxF(0.24, M + 0.28, W - 0.48, 0.01, 42, "preto0", "ceu", "preto2", 33);
  },
  /* estante aberta: fundo, laterais, prateleiras com livros de várias cores e o troféu em cima */
  estante: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    box(M, M, W - 2 * M, 0.05, 92, "madeira1", "madeira1", "madeira2");
    box(M, M, 0.05, D - 2 * M, 92, "madeira0", "madeira1", "madeira2");
    let n = 0;
    for (const z of [0, 31, 61]) {
      box(M, M, W - 2 * M, D - 2 * M, 3, "madeira0", "madeira1", "madeira2", z);
      for (let u = M + 0.09; u < W - M - 0.14; n++) {
        const lw = 0.06 + ((n * 7) % 4) * 0.015, h = 17 + ((n * 5) % 4) * 2.5;
        const deita = n % 9 === 5;
        if (deita) boxF(u, M + 0.1, 0.2, D - 2 * M - 0.22, 5, ...LIVROS[n % LIVROS.length], z + 3);
        else boxF(u, M + 0.1, lw, D - 2 * M - 0.22, h, ...LIVROS[n % LIVROS.length], z + 3);
        u += (deita ? 0.2 : lw) + 0.012;
      }
    }
    box(W - M - 0.05, M, 0.05, D - 2 * M, 92, "madeira0", "madeira1", "madeira2");
    box(M, M, W - 2 * M, D - 2 * M, 3, "madeira0", "madeira1", "madeira2", 92);
    box(W / 2 - 0.08, D / 2 - 0.08, 0.16, 0.16, 4, "madeira1", "madeira1", "madeira2", 95);
    box(W / 2 - 0.05, D / 2 - 0.05, 0.1, 0.1, 10, ...tons("ouro"), 99);
    box(W / 2 - 0.09, D / 2 - 0.06, 0.18, 0.12, 6, ...tons("ouro"), 109);
  },
  /* frigobar com a porta, o puxador e a borracha do congelador */
  frigobar: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    box(0.17, 0.15, W - 0.34, D - 0.3, 3, "preto1", "preto1", "preto2");
    box(0.15, 0.15, W - 0.3, D - 0.32, 58, "cinza0", "cinza1", "cinza2", 3);
    boxF(0.16, D - 0.17, W - 0.32, 0.02, 54, "cinza0", "cinza0", "cinza1", 4);
    boxF(0.16, D - 0.15, W - 0.32, 0.005, 1.5, "cinza2", "cinza2", "cinza2", 42);
    boxF(W - 0.28, D - 0.15, 0.04, 0.03, 22, "cinza1", "cinza2", "cinza2", 16);
  },
  /* mesinha de centro: pés torneados, tampo e um livro com a caneca em cima */
  mesinha: (k, r, giro) => {
    const { W, D, box } = rel(k, r, giro);
    for (const [a, b] of [[0.2, 0.2], [W - 0.28, 0.2], [0.2, D - 0.28], [W - 0.28, D - 0.28]]) box(a, b, 0.08, 0.08, 16, "madeira1", "madeira1", "madeira2");
    box(0.22, 0.22, W - 0.44, D - 0.44, 2, "madeira1", "madeira1", "madeira2", 5);
    box(0.15, 0.15, W - 0.3, D - 0.3, 5, "madeira0", "madeira1", "madeira2", 16);
    box(0.3, 0.32, 0.26, 0.18, 3, ...LIVROS[2], 21);
    box(W - 0.42, D - 0.44, 0.1, 0.1, 7, "lencol0", "lencol1", "lencol1", 21);
  },
  /* puff: dois gomos de pelúcia e o botão no meio */
  puff: (k, r) => {
    k.box(r.i + 0.25, r.j + 0.25, r.w - 0.5, r.d - 0.5, 12, "pelucia1", "pelucia0", "pelucia0");
    k.box(r.i + 0.23, r.j + 0.23, r.w - 0.46, r.d - 0.46, 7, "pelucia1", "pelucia0", "pelucia0", 11);
    k.box(r.i + r.w / 2 - 0.03, r.j + r.d / 2 - 0.03, 0.06, 0.06, 1.5, "pelucia0", "pelucia0", "pelucia0", 18);
  },
  /* luminária de pé: base redonda, haste e cúpula acesa */
  luminaria: (k, r) => {
    k.box(r.i + 0.36, r.j + 0.36, 0.28, 0.28, 3, "preto0", "preto1", "preto2");
    k.box(r.i + 0.41, r.j + 0.41, 0.18, 0.18, 3, "preto0", "preto1", "preto2", 3);
    k.box(r.i + 0.475, r.j + 0.475, 0.05, 0.05, 76, "ouro1", "ouro1", "ouro2", 6);
    k.box(r.i + 0.3, r.j + 0.3, 0.4, 0.4, 14, "neon-ouro", "ouro1", "ouro2", 80);
    k.box(r.i + 0.36, r.j + 0.36, 0.28, 0.28, 4, "neon-ouro", "ouro1", "ouro2", 94);
  },
  /* guarda-roupa: rodapé, corpo, portas almofadadas com puxadores dourados e a cornija em cima */
  "guarda-roupa": (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    box(M + 0.03, M + 0.03, W - 2 * M - 0.06, D - 2 * M - 0.06, 5, "madeira2", "madeira2", "madeira2");
    box(M, M, W - 2 * M, D - 2 * M, 100, "madeira0", "madeira1", "madeira2", 5);
    const np = W - 2 * M >= 1.4 ? 3 : 2, pw = (W - 2 * M - 0.06 - (np - 1) * 0.03) / np;
    for (let x = 0; x < np; x++) {
      const u = M + 0.03 + x * (pw + 0.03);
      boxF(u + 0.04, D - M, pw - 0.08, 0.012, 38, "madeira0", "madeira0", "madeira1", 12);
      boxF(u + 0.04, D - M, pw - 0.08, 0.012, 38, "madeira0", "madeira0", "madeira1", 58);
      boxF(u + (x % 2 ? 0.04 : pw - 0.08), D - M + 0.012, 0.04, 0.012, 12, "ouro0", "ouro1", "ouro2", 50);
    }
    box(M - 0.02, M - 0.02, W - 2 * M + 0.04, D - 2 * M + 0.04, 6, "madeira0", "madeira1", "madeira2", 105);
  },
  /* móveis que fazem algo (seção 53): o número do dado, a luz e o bilhete vêm do estado (QuartoCena) */
  dado: (k, r) => {
    k.box(r.i + 0.28, r.j + 0.28, 0.44, 0.44, 26, "louca0", "louca1", "louca2");
  },
  regulador: (k, r) => {
    k.box(r.i + 0.36, r.j + 0.36, 0.28, 0.28, 34, "preto0", "preto1", "preto2");
    k.box(r.i + 0.4, r.j + 0.4, 0.2, 0.2, 6, "ouro0", "ouro1", "ouro2", 34);
  },
  recado: (k, r, giro) => {
    const f = atras(r, giro, 0.12);
    if (giro) k.box(f.i + 0.3, r.j + 0.12, 0.08, r.d - 0.24, 66, "madeira0", "madeira1", "madeira2");
    else k.box(r.i + 0.12, f.j + 0.3, r.w - 0.24, 0.08, 66, "madeira0", "madeira1", "madeira2");
    if (giro) k.box(f.i + 0.38, r.j + 0.3, 0.02, 0.4, 30, "ouro0", "ouro0", "ouro1", 26);
    else k.box(r.i + 0.3, f.j + 0.38, 0.4, 0.02, 30, "ouro0", "ouro1", "ouro0", 26);
  },
  caixa: (k, r) => {
    k.box(r.i + 0.28, r.j + 0.3, 0.44, 0.4, 52, "preto0", "preto1", "preto2");
    k.box(r.i + 0.36, r.j + 0.36, 0.28, 0.28, 3, "cinza1", "cinza1", "cinza2", 52);
  },
  /* raros (seção 55) */
  estatua: (k, r) => {
    k.box(r.i + 0.22, r.j + 0.22, 0.56, 0.56, 22, "madeira0", "madeira1", "madeira2");
    k.box(r.i + 0.36, r.j + 0.36, 0.28, 0.28, 46, "ouro0", "ouro1", "ouro2", 22);
    k.box(r.i + 0.33, r.j + 0.33, 0.34, 0.12, 8, "ouro0", "ouro1", "ouro2", 56);
    k.box(r.i + 0.39, r.j + 0.39, 0.22, 0.22, 20, "ouro0", "ouro1", "ouro2", 68);
  },
  plasma: (k, r) => {
    k.box(r.i + 0.3, r.j + 0.3, 0.4, 0.4, 14, "preto0", "preto1", "preto2");
    k.box(r.i + 0.27, r.j + 0.27, 0.46, 0.46, 34, "plasma", "plasma", "plasma", 14);
    k.box(r.i + 0.45, r.j + 0.45, 0.1, 0.1, 22, "neon-ouro", "neon-ouro", "neon-ouro", 20);
  },
  /* ---------- a Pirapó 114 (cenas.ts), desenhada das fotos do apartamento ---------- */
  /* meia-parede entre os cômodos (como no Habbo): reboco bege, topo branco; a da sala tem a luz laranja da sanca */
  "meia-parede": (k, r) => {
    k.box(r.i, r.j, r.w, r.d, 34, "pp-branco0", "pp-parede1", "pp-parede2");
    k.box(r.i, r.j, r.w, r.d, 4, "pp-branco0", "pp-branco1", "pp-branco2");
  },
  "meia-parede-sanca": (k, r) => {
    k.box(r.i, r.j, r.w, r.d, 34, "pp-branco0", "pp-parede1", "pp-parede2");
    k.box(r.i, r.j, r.w, r.d, 4, "pp-branco0", "pp-branco1", "pp-branco2");
    k.box(r.i + 0.1, r.j + 0.1, r.w - 0.2, r.d - 0.2, 2, "pp-sanca", "pp-sanca", "pp-sanca", 34);
  },
  /* o lado de fora do prédio: só bloqueia o andar (o chão escuro vem do fundo) */
  fora: () => {},
  /* cozinha */
  "mesa-branca": (k, r) => {
    for (const [a, b] of [[0.12, 0.12], [r.w - 0.2, 0.12], [0.12, r.d - 0.2], [r.w - 0.2, r.d - 0.2]]) k.box(r.i + a, r.j + b, 0.08, 0.08, 26, "pp-branco1", "pp-branco1", "pp-branco2");
    k.box(r.i + 0.06, r.j + 0.06, r.w - 0.12, r.d - 0.12, 3, "pp-branco0", "pp-branco1", "pp-branco2", 26);
    /* o prato giratório de madeira no meio */
    k.box(r.i + r.w / 2 - 0.22, r.j + r.d / 2 - 0.22, 0.44, 0.44, 2, "madeira0", "madeira1", "madeira2", 29);
  },
  "cadeira-vermelha": (k, r, giro) => {
    for (const [a, b] of [[0.22, 0.22], [0.72, 0.22], [0.22, 0.72], [0.72, 0.72]]) k.box(r.i + a, r.j + b, 0.06, 0.06, 18, "pp-creme0", "pp-creme1", "pp-creme2");
    k.box(r.i + 0.2, r.j + 0.2, 0.6, 0.6, 6, "pp-vermelho0", "pp-vermelho1", "pp-vermelho2", 18);
    const a = atras({ i: r.i + 0.2, j: r.j + 0.2, w: 0.6, d: 0.6 }, giro, 0.1);
    k.box(a.i, a.j, a.w, a.d, 30, "pp-vermelho0", "pp-vermelho1", "pp-vermelho2", 24);
  },
  balcao: (k, r) => {
    k.box(r.i + 0.05, r.j, r.w - 0.1, r.d, 40, "pp-branco0", "pp-branco1", "pp-branco2");
    k.box(r.i, r.j, r.w, r.d, 3, "pp-granito-claro", "pp-granito-claro", "pp-granito-claro", 40);
  },
  geladeira: (k, r) => {
    k.box(r.i + 0.1, r.j + 0.1, r.w - 0.2, r.d - 0.2, 100, "pp-branco0", "pp-branco1", "pp-branco2");
    k.box(r.i + 0.1, r.j + 0.1, r.w - 0.2, r.d - 0.2, 1.5, "pp-branco2", "pp-branco2", "pp-branco2", 66);
  },
  "armario-alto": (k, r) => {
    k.box(r.i + 0.08, r.j + 0.05, r.w - 0.16, r.d - 0.1, 116, "pp-branco0", "pp-branco1", "pp-branco2");
    k.box(r.i + 0.08, r.j + 0.05, r.w - 0.16, r.d - 0.1, 1.5, "pp-vidro", "pp-vidro", "pp-vidro", 84);
  },
  /* sacada: a mureta de madeira na frente, com a grade de ferro em cima das pontas */
  mureta: (k, r) => {
    k.box(r.i, r.j + 0.55, r.w, 0.3, 46, "pp-mureta0", "pp-mureta1", "pp-mureta2");
    for (let x = 0; x <= r.w; x += 0.5) k.box(r.i + Math.min(x, r.w - 0.05), r.j + 0.6, 0.04, 0.04, 20, "preto0", "preto1", "preto2", 46);
    k.box(r.i, r.j + 0.6, r.w, 0.04, 2, "preto0", "preto1", "preto2", 66);
  },
  /* quarto */
  "cama-baixa": (k, r) => {
    k.box(r.i + 0.05, r.j + 0.05, r.w - 0.1, r.d - 0.1, 6, "pp-cinza-azul", "pp-cinza-azul", "pp-cinza-azul");
    k.box(r.i + 0.1, r.j + 0.1, r.w - 0.2, r.d - 0.2, 10, "lencol0", "lencol1", "lencol1", 6);
    k.box(r.i + 0.15, r.j + 0.15, 0.6, r.d - 0.3, 6, "pp-almofada", "pp-almofada", "pp-almofada", 16);
  },
  "rack-tv": (k, r, giro) => {
    k.box(r.i + 0.05, r.j + 0.05, r.w - 0.1, r.d - 0.1, 18, "pp-branco0", "pp-branco1", "pp-branco2");
    const f = atras(r, giro, 0.12);
    if (giro) {
      k.box(f.i, r.j + 0.4, 0.1, r.d - 0.8, 64, "preto0", "preto1", "preto2", 18);
      k.box(f.i + 0.1, r.j + 0.6, 0.04, r.d - 1.2, 36, "preto2", "ceu", "preto1", 30);
    } else {
      k.box(r.i + 0.4, f.j, r.w - 0.8, 0.1, 64, "preto0", "preto1", "preto2", 18);
      k.box(r.i + 0.6, f.j + 0.1, r.w - 1.2, 0.04, 36, "preto2", "preto1", "ceu", 30);
    }
  },
  guitarra: (k, r) => {
    k.box(r.i + 0.35, r.j + 0.4, 0.3, 0.12, 30, "pp-guitarra", "pp-guitarra", "pp-guitarra2");
    k.box(r.i + 0.44, r.j + 0.42, 0.12, 0.06, 14, "pp-branco0", "pp-branco0", "pp-branco1", 10);
    k.box(r.i + 0.47, r.j + 0.43, 0.06, 0.06, 40, "madeira0", "madeira1", "madeira2", 30);
  },
  gaveteiro: (k, r) => {
    k.box(r.i + 0.15, r.j + 0.15, r.w - 0.3, r.d - 0.3, 30, "pp-branco0", "pp-branco1", "pp-branco2");
    k.box(r.i + 0.1, r.j + 0.1, r.w - 0.2, r.d - 0.2, 2, "pp-vidro", "pp-vidro", "pp-vidro", 32);
  },
  "cadeira-gamer-vermelha": (k, r, giro) => cadeira(k, r, giro, ["preto0", "pp-vermelho1", "preto2"], 72),
  "guarda-roupa-creme": (k, r, giro) => {
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 120, "pp-creme0", "pp-creme1", "pp-creme2");
    /* as 4 portas e os puxadores na frente */
    const n = giro ? r.d : r.w;
    for (let x = 1; x < 4; x++) {
      const a = M + ((n - 2 * M) * x) / 4;
      if (giro) k.box(r.i + r.w - M - 0.01, r.j + a - 0.01, 0.02, 0.02, 116, "pp-creme2", "pp-creme2", "pp-creme2", 2);
      else k.box(r.i + a - 0.01, r.j + r.d - M - 0.01, 0.02, 0.02, 116, "pp-creme2", "pp-creme2", "pp-creme2", 2);
    }
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 1.5, "pp-creme2", "pp-creme2", "pp-creme2", 84);
  },
  /* o fim do corredor: a estante branca com as letras e os enfeites */
  "estante-branca": (k, r) => {
    k.box(r.i + 0.08, r.j + 0.1, r.w - 0.16, r.d - 0.2, 118, "pp-branco0", "pp-branco1", "pp-branco2");
    for (const z of [30, 58, 86]) k.box(r.i + 0.1, r.j + 0.12, r.w - 0.2, r.d - 0.24, 2, "pp-branco2", "pp-branco2", "pp-branco2", z);
    k.box(r.i + 0.3, r.j + 0.3, 0.3, 0.3, 10, "pp-branco0", "pp-branco1", "pp-branco1", 88);
    k.box(r.i + 0.35, r.j + 0.5, 0.2, 0.2, 8, "madeira1", "madeira1", "madeira2", 60);
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
  /* ---------- a rua (cenas.ts): árvore, banco de praça, carros e o gol do pênalti x1 ---------- */
  arvore: (k, r) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    k.box(ci - 0.18, cj - 0.18, 0.36, 0.36, 70, "tronco0", "tronco1", "tronco2");
    /* a copa em camadas, mais larga embaixo, com um tom mais claro em cima (luz de cima à esquerda) */
    k.box(ci - 0.95, cj - 0.95, 1.9, 1.9, 40, "folha0", "folha1", "folha2", 62);
    k.box(ci - 0.75, cj - 0.75, 1.5, 1.5, 34, "folha3", "folha1", "folha2", 100);
    k.box(ci - 0.45, cj - 0.45, 0.9, 0.9, 26, "folha3", "folha0", "folha1", 132);
  },
  "banco-praca": (k, r, giro) => {
    const pe = (i: number, j: number) => k.box(i, j, 0.1, 0.1, 14, "ferro0", "ferro1", "ferro1");
    if (giro) {
      pe(r.i + 0.2, r.j + 0.15);
      pe(r.i + 0.2, r.j + r.d - 0.25);
      pe(r.i + 0.7, r.j + 0.15);
      pe(r.i + 0.7, r.j + r.d - 0.25);
    } else {
      pe(r.i + 0.15, r.j + 0.2);
      pe(r.i + r.w - 0.25, r.j + 0.2);
      pe(r.i + 0.15, r.j + 0.7);
      pe(r.i + r.w - 0.25, r.j + 0.7);
    }
    k.box(r.i + M, r.j + M, r.w - 2 * M, r.d - 2 * M, 4, "madeira0", "madeira1", "madeira2", 14);
    const c = atras(r, giro, 0.12);
    k.box(c.i + M, c.j + M, c.w - (giro ? 0 : 2 * M), c.d - (giro ? 2 * M : 0), 22, "madeira0", "madeira1", "madeira2", 18);
  },
  /* o portão da garagem na rua: dois pilares, as folhas de grade abertas para dentro e a placa em cima */
  "portao-garagem": (k, r, giro) => {
    const { W, box } = rel(k, r, giro);
    box(0.05, 0.35, 0.3, 0.3, 96, ...tons("cinza"));
    for (const [u, v] of [[0.35, 0.05], [W - 0.41, 0.05]]) {
      box(u, v, 0.06, 0.3, 4, "ferro0", "ferro1", "ferro1", 4);
      for (let x = 0; x < 3; x++) box(u + 0.01, v + 0.03 + x * 0.1, 0.04, 0.04, 64, "ferro0", "ferro1", "ferro1", 4);
      box(u, v, 0.06, 0.3, 4, "ferro0", "ferro1", "ferro1", 68);
    }
    box(W - 0.35, 0.35, 0.3, 0.3, 96, ...tons("cinza"));
    box(0.05, 0.4, W - 0.1, 0.2, 20, "placa-kfofo", "placa-kfofo", "preto1", 96);
    box(0.25, 0.6, W - 0.5, 0.01, 6, "ouro0", "ouro0", "ouro1", 103);
  },
  /* garagem: a guarita (paredes claras, janela, telhado vermelho), a cancela levantada e os postes */
  guarita: (k, r) => {
    k.box(r.i + 0.1, r.j + 0.1, 0.8, 0.8, 60, "pp-branco0", "pp-branco1", "pp-branco2");
    k.box(r.i + 0.2, r.j + 0.9, 0.6, 0.01, 22, "vidro", "vidro", "vidro", 30);
    k.box(r.i + 0.9, r.j + 0.2, 0.01, 0.6, 22, "vidro", "vidro", "vidro", 30);
    k.box(r.i + 0.04, r.j + 0.04, 0.92, 0.92, 7, ...tons("pp-vermelho"), 60);
  },
  cancela: (k, r) => {
    k.box(r.i + 0.35, r.j + 0.35, 0.3, 0.3, 34, "pp-branco0", "pp-branco1", "pp-branco2");
    for (let n = 0; n < 6; n++) k.box(r.i + 0.46, r.j + 0.46, 0.08, 0.08, 14, ...(n % 2 ? tons("pp-branco") : tons("pp-vermelho")), 34 + n * 14);
  },
  poste: (k, r) => {
    k.box(r.i + 0.4, r.j + 0.4, 0.2, 0.2, 6, "ferro0", "ferro1", "ferro1");
    k.box(r.i + 0.46, r.j + 0.46, 0.08, 0.08, 120, "ferro0", "ferro1", "ferro1", 6);
    k.box(r.i + 0.36, r.j + 0.36, 0.28, 0.28, 8, "ferro0", "ferro1", "ferro1", 126);
    k.box(r.i + 0.4, r.j + 0.4, 0.2, 0.2, 4, "neon-ouro", "neon-ouro", "neon-ouro", 122);
  },
  /* o banheiro: vaso sanitário (com a caixa encostada atrás) e a pia com o espelho em cima */
  vaso: (k, r, giro) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    k.box(ci - 0.2, cj - 0.22, 0.4, 0.44, 16, "louca0", "louca1", "louca2");
    k.box(ci - 0.24, cj - 0.26, 0.48, 0.52, 3, "louca0", "louca1", "louca2", 16);
    const c = atras(r, giro, 0.2);
    k.box(c.i + (giro ? 0.05 : 0.2), c.j + (giro ? 0.2 : 0.05), giro ? 0.2 : 0.6, giro ? 0.6 : 0.2, 30, "louca0", "louca1", "louca2", 10);
  },
  pia: (k, r) => {
    k.box(r.i + 0.4, r.j + 0.15, 0.2, 0.2, 30, "louca1", "louca1", "louca2");
    k.box(r.i + 0.1, r.j + 0.05, 0.8, 0.5, 8, "louca0", "louca1", "louca2", 30);
  },
  gol: (k, r) => {
    /* as traves na linha de fundo (i = fim do retângulo) e a rede caindo para trás */
    const i = r.i + r.w - 0.15;
    const [a, b] = [r.j + 0.1, r.j + r.d - 0.1];
    k.box(i - 0.4, a, 0.4, b - a, 46, "rede", "rede", "rede", 0);
    k.box(i - 0.06, a, 0.08, 0.08, 52, "gol", "gol", "gol");
    k.box(i - 0.06, b - 0.08, 0.08, 0.08, 52, "gol", "gol", "gol");
    k.box(i - 0.06, a, 0.08, b - a, 6, "gol", "gol", "gol", 48);
  },
};

/* cadeira de escritório: estrela com rodinhas, pistão, assento, braços e o encosto com a almofada de cabeça */
function cadeira(k: Lapis, r: Retangulo, giro: boolean, c: [string, string, string], encosto: number) {
  const { W, D, box, boxF } = rel(k, r, giro);
  const cu = W / 2, cv = D / 2;
  for (const [u, v] of [[cu - 0.32, cv - 0.04], [cu + 0.24, cv - 0.04], [cu - 0.04, cv - 0.32], [cu - 0.04, cv + 0.24]]) box(u, v, 0.08, 0.08, 3, "preto1", "preto1", "preto2");
  box(cu - 0.3, cv - 0.03, 0.6, 0.06, 2, "preto0", "preto1", "preto2", 3);
  box(cu - 0.03, cv - 0.3, 0.06, 0.6, 2, "preto0", "preto1", "preto2", 3);
  box(cu - 0.035, cv - 0.035, 0.07, 0.07, 12, "cinza0", "cinza1", "cinza2", 5);
  box(0.2, 0.2, W - 0.4, 0.13, encosto - 24, ...c, 24);
  boxF(0.3, 0.33, W - 0.6, 0.012, encosto - 36, c[0], c[0], c[1], 30);
  box(0.28, 0.19, W - 0.56, 0.12, 12, ...c, encosto + 2);
  box(0.18, 0.36, 0.06, 0.3, 14, "preto0", "preto1", "preto2", 22);
  box(0.2, 0.2, W - 0.4, D - 0.4, 9, ...c, 15);
  box(W - 0.24, 0.36, 0.06, 0.3, 14, "preto0", "preto1", "preto2", 22);
}
function tapete(k: Lapis, r: Retangulo, a: string, b: string) {
  k.poly([p0(r.i + 0.1, r.j + 0.1), p0(r.i + r.w - 0.1, r.j + 0.1), p0(r.i + r.w - 0.1, r.j + r.d - 0.1), p0(r.i + 0.1, r.j + r.d - 0.1)], a);
  k.poly([p0(r.i + 0.18, r.j + 0.18), p0(r.i + r.w - 0.18, r.j + 0.18), p0(r.i + r.w - 0.18, r.j + r.d - 0.18), p0(r.i + 0.18, r.j + r.d - 0.18)], b);
  k.poly([p0(r.i + 0.26, r.j + 0.26), p0(r.i + r.w - 0.26, r.j + 0.26), p0(r.i + r.w - 0.26, r.j + r.d - 0.26), p0(r.i + 0.26, r.j + r.d - 0.26)], a);
  k.poly([p0(r.i + 0.32, r.j + 0.32), p0(r.i + r.w - 0.32, r.j + 0.32), p0(r.i + r.w - 0.32, r.j + r.d - 0.32), p0(r.i + 0.32, r.j + r.d - 0.32)], b);
}
/* vaso com borda e terra, e as folhas em tufos que sobem e se abrem (de trás para a frente) */
function planta(k: Lapis, r: Retangulo, f0: string, f1: string, f2: string, n: number) {
  k.box(r.i + 0.32, r.j + 0.32, 0.36, 0.36, 17, "madeira0", "madeira1", "madeira2");
  k.box(r.i + 0.3, r.j + 0.3, 0.4, 0.4, 4, "madeira0", "madeira1", "madeira2", 16);
  k.box(r.i + 0.34, r.j + 0.34, 0.32, 0.32, 1, "tronco2", "tronco2", "tronco2", 19);
  const tufos: [number, number, number, number][] = [
    [0.36, 0.36, 26, 0.2], [0.5, 0.3, 30, 0.18], [0.3, 0.5, 30, 0.18], [0.42, 0.42, 40, 0.24],
    [0.56, 0.48, 24, 0.18], [0.48, 0.56, 24, 0.18], [0.44, 0.44, 54, 0.16],
  ];
  for (const [a, b, z, s] of tufos.slice(0, n + 2)) k.box(r.i + a, r.j + b, s, s, 14, f0, f1, f2, z);
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
  /* os degradês ficam junto de cada desenho: um id compartilhado sumiria se a cena que o define estivesse escondida */
  const id = useId();
  const temG = lista.some((d) => d.g);
  return (
    <>
      {temG && (
        <defs>
          <linearGradient id={id + "f"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="q-st-brilho" />
            <stop offset="1" className="q-st-escuro" />
          </linearGradient>
          <linearGradient id={id + "l"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="q-st-nada" />
            <stop offset="1" className="q-st-escuro2" />
          </linearGradient>
        </defs>
      )}
      {lista.map((d, k) => {
        const pts = d.q.map((v) => v.join(",")).join(" ");
        return (
          <Fragment key={k}>
            <polygon points={pts} className={`q-${d.c}` + (d.linha ? " q-linha" : "")} />
            {d.g && <polygon points={pts} fill={`url(#${id}${d.g})`} pointerEvents="none" />}
          </Fragment>
        );
      })}
    </>
  );
}
