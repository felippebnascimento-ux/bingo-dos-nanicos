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
  /* a caixa: tom chapado, contorno escuro, luz de cima e da esquerda (topo claro, frente média, lado escuro), a quina de
     cima chanfrada e um brilho fino na quina da frente do tampo (05/11/2026; antes era o degradê "macio") */
  const box = (i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z = 0) => {
    const ch = h >= 5 && w > 0.14 && d > 0.14 ? Math.min(0.06, w / 4, d / 4) : 0;
    const zt = z + h, zb = ch ? zt - Math.min(h * 0.25, 5) : zt;
    poly([p(i, j + d, z), p(i + w, j + d, z), p(i + w, j + d, zb), p(i, j + d, zb)], esq, true);
    poly([p(i + w, j, z), p(i + w, j + d, z), p(i + w, j + d, zb), p(i + w, j, zb)], dir, true);
    if (!ch) poly([p(i, j, zt), p(i + w, j, zt), p(i + w, j + d, zt), p(i, j + d, zt)], topo, true);
    else {
      poly([p(i, j + d, zb), p(i + w, j + d, zb), p(i + w - ch, j + d - ch, zt), p(i, j + d - ch, zt)], topo, true);
      poly([p(i + w, j, zb), p(i + w, j + d, zb), p(i + w - ch, j + d - ch, zt), p(i + w - ch, j, zt)], esq, true);
      poly([p(i, j, zt), p(i + w - ch, j, zt), p(i + w - ch, j + d - ch, zt), p(i, j + d - ch, zt)], topo, true);
    }
    if (h >= 3 && w >= 0.3 && d >= 0.3) {
      const a = i + Math.min(0.06, w / 8), b = i + w - ch - Math.min(0.06, w / 8), e = j + d - ch;
      poly([p(a, e, zt), p(b, e, zt), p(b, e, zt - 0.9), p(a, e, zt - 0.9)], "brilho");
    }
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
  /* cama (05/11/2026, redesenhada): postes torneados na cabeceira, painel estofado com botões, estrado com veios, colchão
     com costura, travesseiros, o cobertor com a dobra do lençol e a pezeira baixa com dois pés torneados */
  cama: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    const pt = ponto(r, giro), c = tons("cadeira");
    for (const u of [M + 0.07, W - M - 0.07]) pernaR(k, ...pt(u, M + 0.07), 0, 62, 0.07, MAD);
    box(M + 0.12, M + 0.02, W - 2 * M - 0.24, 0.1, 52, ...MAD, 4);
    boxF(M + 0.2, M + 0.12, W - 2 * M - 0.4, 0.025, 30, ...c, 20);
    for (let u = M + 0.32; u < W - M - 0.25; u += 0.28) for (const z of [28, 40]) boxF(u, M + 0.145, 0.03, 0.004, 2, "cadeira2", "cadeira2", "cadeira2", z);
    box(M, M + 0.14, W - 2 * M, D - 2 * M - 0.14, 8, ...MAD, 6);
    veiosR(k, ...absR(r, giro, M, M + 0.14, W - 2 * M, D - 2 * M - 0.14), 7, 13, 21, "madeirav");
    box(M + 0.03, M + 0.16, W - 2 * M - 0.06, D - 2 * M - 0.2, 9, "lencol0", "lencol1", "lencol1", 14);
    boxF(M + 0.03, D - M - 0.04, W - 2 * M - 0.06, 0.004, 1, "lencol1", "lencol1", "lencol1", 18);
    /* travesseiros: um só bloco macio cada, encostado na cabeceira */
    const nt = W >= 1.5 ? 2 : 1, tw = (W - 2 * M - 0.24 - (nt - 1) * 0.1) / nt;
    for (let x = 0; x < nt; x++) box(M + 0.12 + x * (tw + 0.1), M + 0.22, tw, 0.3, 5, "lencol0", "lencol1", "lencol1", 23);
    /* o cobertor cobre a metade da frente, só um pouco mais alto que o colchão, com a borda do lençol dobrada por cima */
    const vc = M + 0.18 + (D - 2 * M - 0.2) * 0.45;
    box(M + 0.01, vc - 0.07, W - 2 * M - 0.02, 0.09, 10, "lencol0", "lencol1", "lencol1", 14);
    box(M + 0.01, vc, W - 2 * M - 0.02, D - M - 0.03 - vc, 9.6, ...c, 14);
    box(M + 0.06, D - M - 0.06, W - 2 * M - 0.12, 0.06, 18, ...MAD, 4);
    for (const u of [M + 0.06, W - M - 0.06]) pernaR(k, ...pt(u, D - M - 0.04), 0, 24, 0.055, MAD);
  },
  "cama-casal": (k, r, giro) => DESENHO_QUARTO.cama(k, r, giro),
  /* sofá (05/11/2026, redesenhado): pés torneados de madeira, a base com o friso, o encosto com almofadas capitonê, os braços
     com o rolo em cima, os assentos com o vivo na frente e uma almofada dourada */
  sofa: (k, r, giro) => estofado(k, r, giro, false),
  poltrona: (k, r, giro) => estofado(k, r, giro, true),
  /* mesa do PC: pés, gabinete com a faixa RGB e o vidro, tampo com a faixa RGB, mousepad, dois monitores acesos (com as
     janelas na tela), teclado com as fileiras de teclas e o mouse */
  pc: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    for (const [u, v] of [[M, M], [W - M - 0.07, M]]) box(u, v, 0.07, 0.07, 40, "preto0", "preto1", "preto2");
    boxF(W - M - 0.42, M + 0.12, 0.26, D - 2 * M - 0.24, 34, "preto0", "preto1", "preto2");
    boxF(W - M - 0.4, D - M - 0.13, 0.22, 0.008, 24, "preto0", "teclado", "preto2", 6);
    boxF(W - M - 0.38, D - M - 0.126, 0.04, 0.004, 18, "rgb1", "rgb1", "rgb1", 9);
    boxF(W - M - 0.42, D - M - 0.13, 0.26, 0.01, 2, "preto0", "rgb2", "rgb3", 4);
    for (const [u, v] of [[M, D - M - 0.07], [W - M - 0.07, D - M - 0.07]]) box(u, v, 0.07, 0.07, 40, "preto0", "preto1", "preto2");
    box(M, M, W - 2 * M, D - 2 * M, 3, "preto0", "rgb2", "rgb3", 37);
    box(M, M, W - 2 * M, D - 2 * M, 4, "preto0", "preto1", "preto2", 40);
    box(W / 2 - 0.5, D - M - 0.42, 1.06, 0.3, 0.6, "roxo0", "roxo0", "roxo0", 44);
    const len = (W - 0.6) / 2;
    for (let x = 0; x < 2; x++) {
      const a = 0.2 + (x * (W - 0.4)) / 2;
      box(a + len / 2 - 0.06, M + 0.14, 0.12, 0.08, 2, "preto1", "preto1", "preto2", 44);
      box(a + len / 2 - 0.02, M + 0.16, 0.04, 0.04, 8, "preto1", "preto1", "preto2", 46);
      boxF(a, M + 0.12, len, 0.08, 34, "preto0", "preto1", "preto2", 52);
      boxF(a + 0.03, M + 0.2, len - 0.06, 0.01, 28, "preto0", "ceu", "preto2", 55);
      /* a tela: uma janela clara, linhas de texto e a barra embaixo */
      boxF(a + 0.07, M + 0.211, len * 0.55, 0.004, 16, "ceu-claro", "ceu-claro", "ceu-claro", 63);
      for (const z of [74, 70, 66]) boxF(a + 0.1, M + 0.216, len * 0.4, 0.002, 1, "cadeira1", "cadeira1", "cadeira1", z);
      boxF(a + 0.03, M + 0.211, len - 0.06, 0.004, 3, "preto1", "preto1", "preto1", 55);
    }
    box(W / 2 - 0.32, D - M - 0.36, 0.64, 0.16, 2, "teclado", "preto1", "preto2", 44);
    for (let f = 0; f < 3; f++) for (let t = 0; t < 10; t++) box(W / 2 - 0.3 + t * 0.06, D - M - 0.34 + f * 0.045, 0.045, 0.035, 1, "preto1", "preto2", "preto2", 46);
    box(W / 2 + 0.42, D - M - 0.32, 0.08, 0.12, 2, "preto0", "preto1", "preto2", 44);
    boxF(W / 2 + 0.44, D - M - 0.28, 0.04, 0.004, 0.6, "rgb1", "rgb1", "rgb1", 46);
  },
  /* rack de madeira com veios e duas portas, e a TV de tela fina no pé, acesa com um céu e um morro */
  tv: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    for (const u of [M + 0.04, W - M - 0.1]) box(u, D - M - 0.12, 0.06, 0.06, 4, ...MAD);
    box(M, M + 0.1, W - 2 * M, D - 2 * M - 0.1, 18, ...MAD, 4);
    veiosR(k, ...absR(r, giro, M, M + 0.1, W - 2 * M, D - 2 * M - 0.1), 6, 21, 33, "madeirav");
    const pw = (W - 2 * M - 0.12) / 2;
    for (let x = 0; x < 2; x++) {
      boxF(M + 0.04 + x * (pw + 0.04), D - M, pw, 0.01, 12, "madeira0", "madeira0", "madeira1", 7);
      boxF(M + 0.08 + x * (pw + 0.04), D - M + 0.01, pw - 0.08, 0.004, 8, "madeira1", "madeira1", "madeira2", 9);
      boxF(M + 0.04 + x * (pw + 0.04) + (x ? 0.06 : pw - 0.1), D - M + 0.014, 0.04, 0.01, 3, "ouro0", "ouro1", "ouro2", 13);
    }
    box(W / 2 - 0.2, M + 0.2, 0.4, 0.14, 2, "preto1", "preto1", "preto2", 22);
    box(W / 2 - 0.03, M + 0.24, 0.06, 0.04, 8, "preto1", "preto1", "preto2", 24);
    boxF(0.2, M + 0.22, W - 0.4, 0.06, 48, "preto0", "preto1", "preto2", 30);
    boxF(0.24, M + 0.28, W - 0.48, 0.01, 42, "preto0", "ceu", "preto2", 33);
    boxF(0.24, M + 0.291, W - 0.48, 0.004, 14, "planta1", "planta1", "planta1", 33);
    boxF(0.3, M + 0.292, (W - 0.48) * 0.45, 0.004, 9, "planta0", "planta0", "planta0", 47);
    boxF(W - 0.5, M + 0.292, 0.08, 0.004, 7, "neon-ouro", "neon-ouro", "neon-ouro", 64);
    boxF(0.2, M + 0.282, W - 0.4, 0.004, 0.8, "rgb3", "rgb3", "rgb3", 30);
  },
  /* estante aberta: fundo e laterais com veios, prateleiras com livros (com a faixa dourada na lombada) e o troféu em cima */
  estante: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    box(M, M, W - 2 * M, 0.05, 92, "madeira1", "madeira1", "madeira2");
    box(M, M, 0.05, D - 2 * M, 92, ...MAD);
    let n = 0;
    for (const z of [0, 31, 61]) {
      box(M, M, W - 2 * M, D - 2 * M, 3, ...MAD, z);
      for (let u = M + 0.09; u < W - M - 0.14; n++) {
        const lw = 0.06 + ((n * 7) % 4) * 0.015, h = 17 + ((n * 5) % 4) * 2.5;
        const deita = n % 9 === 5;
        if (deita) boxF(u, M + 0.1, 0.2, D - 2 * M - 0.22, 5, ...LIVROS[n % LIVROS.length], z + 3);
        else {
          boxF(u, M + 0.1, lw, D - 2 * M - 0.22, h, ...LIVROS[n % LIVROS.length], z + 3);
          if (n % 3 === 0) boxF(u, D - M - 0.12, lw, 0.004, 1.4, "ouro0", "ouro0", "ouro0", z + 3 + h - 5);
        }
        u += (deita ? 0.2 : lw) + 0.012;
      }
    }
    box(W - M - 0.05, M, 0.05, D - 2 * M, 92, ...MAD);
    veiosR(k, ...absR(r, giro, W - M - 0.05, M, 0.05, D - 2 * M), 4, 90, 17, "madeirav");
    box(M - 0.02, M - 0.02, W - 2 * M + 0.04, D - 2 * M + 0.04, 4, ...MAD, 92);
    /* o troféu: base, pé e a taça */
    const [ci, cj] = ponto(r, giro)(W / 2, D / 2);
    k.box(ci - 0.1, cj - 0.1, 0.2, 0.2, 5, ...MAD, 96);
    redondo(k, ci, cj, 0.03, 101, 7, "ouro0", "ouro1", "ouro2");
    redondo(k, ci, cj, 0.09, 108, 4, "ouro0", "ouro1", "ouro2");
    redondo(k, ci, cj, 0.11, 112, 7, "ouro0", "ouro1", "ouro2");
  },
  /* frigobar com a porta, o puxador comprido, a linha do congelador, o logo e dois ímãs */
  frigobar: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    box(0.17, 0.15, W - 0.34, D - 0.3, 3, "preto1", "preto1", "preto2");
    box(0.15, 0.15, W - 0.3, D - 0.32, 58, "cinza0", "cinza1", "cinza2", 3);
    boxF(0.16, D - 0.17, W - 0.32, 0.02, 54, "cinza0", "cinza0", "cinza1", 4);
    boxF(0.16, D - 0.15, W - 0.32, 0.005, 1.5, "cinza2", "cinza2", "cinza2", 42);
    boxF(W - 0.28, D - 0.15, 0.04, 0.03, 30, "cinza1", "cinza2", "cinza2", 12);
    boxF(0.26, D - 0.148, 0.12, 0.003, 3, "preto1", "preto1", "preto1", 49);
    boxF(0.3, D - 0.148, 0.05, 0.003, 5, "fogo2", "fogo2", "fogo2", 30);
    boxF(0.42, D - 0.148, 0.05, 0.003, 5, "ouro0", "ouro0", "ouro0", 24);
  },
  /* mesinha de centro: pés torneados, a travessa embaixo, tampo com veios, um livro e a caneca */
  mesinha: (k, r, giro) => {
    const { W, D, box } = rel(k, r, giro);
    const pt = ponto(r, giro);
    for (const [a, b] of [[0.24, 0.24], [W - 0.24, 0.24], [0.24, D - 0.24], [W - 0.24, D - 0.24]]) pernaR(k, ...pt(a, b), 0, 16, 0.05, MAD);
    box(0.22, 0.22, W - 0.44, D - 0.44, 2, ...MAD, 5);
    box(0.15, 0.15, W - 0.3, D - 0.3, 5, ...MAD, 16);
    veiosR(k, ...absR(r, giro, 0.15, 0.15, W - 0.3, D - 0.3), 16, 21, 9, "madeirav");
    box(0.3, 0.32, 0.26, 0.18, 3, ...LIVROS[2], 21);
    box(0.32, 0.34, 0.22, 0.14, 1, ...LIVROS[1], 24);
    const [ci, cj] = pt(W - 0.36, D - 0.38);
    redondo(k, ci, cj, 0.06, 21, 8, "lencol0", "lencol1", "lencol1");
    redondo(k, ci, cj, 0.045, 29, 0, "madeirav", "madeirav", "madeirav", false);
  },
  /* puff redondo de pelúcia: o corpo em gomos, o tampo fofo e o botão no meio */
  puff: (k, r) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    redondo(k, ci, cj, 0.28, 0, 11, "pelucia1", "pelucia0", "pelucia0");
    redondo(k, ci, cj, 0.3, 11, 4, "pelucia1", "pelucia0", "pelucia0");
    redondo(k, ci, cj, 0.26, 15, 2, "pelucia1", "pelucia1", "pelucia0");
    redondo(k, ci, cj, 0.035, 17, 1, "pelucia0", "pelucia0", "pelucia0");
  },
  /* luminária de pé: base redonda, a haste dourada e a cúpula acesa, com a luz caindo no chão */
  luminaria: (k, r) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    const [x, y] = projAtual(ci, cj, 0);
    const e = escalaPx();
    k.poly([[x - 30 * e, y], [x, y - 14 * e], [x + 30 * e, y], [x, y + 14 * e]], "luzq");
    redondo(k, ci, cj, 0.16, 0, 3, "preto0", "preto1", "preto2");
    redondo(k, ci, cj, 0.09, 3, 2, "preto0", "preto1", "preto2");
    k.box(ci - 0.02, cj - 0.02, 0.04, 0.04, 76, "ouro1", "ouro1", "ouro2", 5);
    for (let n = 0; n < 5; n++) redondo(k, ci, cj, 0.24 - n * 0.025, 80 + n * 3.4, 3.4, "neon-ouro", "ouro1", "ouro2", false);
    redondo(k, ci, cj, 0.12, 97, 0, "luzq", "luzq", "luzq", false);
  },
  /* guarda-roupa: rodapé, corpo com veios, portas com moldura e a almofada rebaixada, puxadores dourados redondos e a
     cornija em dois degraus */
  "guarda-roupa": (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    box(M + 0.03, M + 0.03, W - 2 * M - 0.06, D - 2 * M - 0.06, 5, "madeira2", "madeira2", "madeira2");
    box(M, M, W - 2 * M, D - 2 * M, 100, ...MAD, 5);
    veiosR(k, ...absR(r, giro, M, M, W - 2 * M, D - 2 * M), 8, 100, 29, "madeirav");
    const np = W - 2 * M >= 1.4 ? 3 : 2, pw = (W - 2 * M - 0.06 - (np - 1) * 0.03) / np;
    for (let x = 0; x < np; x++) {
      const u = M + 0.03 + x * (pw + 0.03);
      for (const [z, h] of [[12, 38], [58, 38]]) {
        boxF(u + 0.04, D - M, pw - 0.08, 0.012, h, "madeira0", "madeira0", "madeira1", z);
        boxF(u + 0.08, D - M + 0.012, pw - 0.16, 0.006, h - 8, "madeira1", "madeira1", "madeira2", z + 4);
      }
      const [ci, cj] = ponto(r, giro)(u + (x % 2 ? 0.07 : pw - 0.07), D - M + 0.02);
      redondo(k, ci, cj, 0.025, 50, 3, "ouro0", "ouro1", "ouro2");
    }
    box(M - 0.02, M - 0.02, W - 2 * M + 0.04, D - 2 * M + 0.04, 4, ...MAD, 105);
    box(M - 0.04, M - 0.04, W - 2 * M + 0.08, D - 2 * M + 0.08, 3, ...MAD, 109);
  },
  /* móveis que fazem algo (seção 53): o número do dado, a luz e o bilhete vêm do estado (QuartoCena) */
  /* dado gigante de pelúcia: cubo com a quina arredondada e as bolinhas nas duas faces que aparecem (o número de cima
     vem do estado, EstadoMovel) */
  dado: (k, r) => {
    const i = r.i + 0.28, j = r.j + 0.28, w = 0.44;
    k.box(i, j, w, w, 26, "lencol0", "lencol1", "cinza0");
    const pf = (u: number, z: number) => k.poly([projAtual(i + u - 0.035, j + w, z - 2.6), projAtual(i + u + 0.035, j + w, z - 2.6), projAtual(i + u + 0.035, j + w, z + 2.6), projAtual(i + u - 0.035, j + w, z + 2.6)], "preto1");
    const pl = (v: number, z: number) => k.poly([projAtual(i + w, j + v - 0.035, z - 2.6), projAtual(i + w, j + v + 0.035, z - 2.6), projAtual(i + w, j + v + 0.035, z + 2.6), projAtual(i + w, j + v - 0.035, z + 2.6)], "preto1");
    /* frente: o 2; lado: o 5 */
    pf(0.13, 19); pf(0.31, 7);
    pl(0.12, 20); pl(0.32, 20); pl(0.22, 13); pl(0.12, 6); pl(0.32, 6);
  },
  /* regulador de luz: base redonda, haste e a cúpula de LED colorida (a cor do quarto vem do estado) */
  regulador: (k, r) => {
    const ci = r.i + 0.5, cj = r.j + 0.5;
    redondo(k, ci, cj, 0.16, 0, 3, "preto0", "preto1", "preto2");
    k.box(ci - 0.025, cj - 0.025, 0.05, 0.05, 30, "cinza0", "cinza1", "cinza2", 3);
    k.box(ci - 0.12, cj - 0.12, 0.24, 0.24, 6, "preto0", "preto1", "preto2", 33);
    for (const [c, z] of [["rgb1", 39], ["rgb2", 42], ["rgb3", 45]] as const) redondo(k, ci, cj, 0.1, z, 3, c, c, c, false);
    redondo(k, ci, cj, 0.06, 48, 1, "lencol0", "lencol0", "lencol0", false);
  },
  /* quadro de recados: o cavalete de madeira (dois pés e a travessa) e o quadro de cortiça com a moldura e os papéis
     presos (o bilhete escrito vem do estado) */
  recado: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    for (const u of [0.24, W - 0.3]) {
      box(u, D / 2 - 0.02, 0.06, 0.06, 66, ...MAD);
      box(u, D / 2 + 0.16, 0.06, 0.06, 34, ...MAD);
    }
    box(0.24, D / 2 - 0.02, W - 0.48, 0.24, 2, ...MAD, 22);
    boxF(0.16, D / 2 + 0.04, W - 0.32, 0.04, 44, ...MAD, 28);
    boxF(0.2, D / 2 + 0.08, W - 0.4, 0.004, 38, "cortica", "cortica", "cortica", 31);
    const notas: [number, number, string][] = [[0.28, 52, "lencol0"], [0.5, 44, "ouro0"], [0.62, 58, "lencol0"], [0.36, 36, "rgb2"]];
    for (const [u, z, c] of notas) {
      boxF(u, D / 2 + 0.086, 0.12, 0.003, 10, c, c, c, z);
      boxF(u + 0.05, D / 2 + 0.09, 0.02, 0.002, 2, "fogo2", "fogo2", "fogo2", z + 8);
    }
  },
  /* caixa de som de chão: o gabinete preto, o alto-falante grande e o pequeno na frente, com a tela, e a luz em cima */
  caixa: (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    box(0.28, 0.3, W - 0.56, D - 0.6, 52, "preto0", "preto1", "preto2");
    const f = D - 0.3;
    boxF(0.33, f, W - 0.66, 0.006, 22, "teclado", "teclado", "teclado", 6);
    boxF(0.38, f + 0.006, W - 0.76, 0.006, 14, "preto2", "preto2", "preto2", 10);
    boxF(0.44, f + 0.012, W - 0.88, 0.006, 6, "cinza1", "cinza1", "cinza1", 14);
    boxF(0.38, f, W - 0.76, 0.006, 12, "teclado", "teclado", "teclado", 33);
    boxF(0.44, f + 0.006, W - 0.88, 0.006, 6, "preto2", "preto2", "preto2", 36);
    boxF(0.33, f, W - 0.66, 0.006, 3, "rgb3", "rgb3", "rgb3", 47);
    box(0.36, 0.36, W - 0.72, D - 0.72, 2, "cinza1", "cinza1", "cinza2", 52);
  },
  /* raros (seção 55) */
  /* a Estátua Dourada do Nanico: pedestal de madeira escura em degraus com a plaquinha, a coluna e a taça de ouro com
     as alças e a estrela em cima */
  estatua: (k, r, giro) => {
    const { W, D, boxF } = rel(k, r, giro);
    const pt = ponto(r, giro);
    boxF(0.16, 0.16, W - 0.32, D - 0.32, 8, ...MAD);
    boxF(0.22, 0.22, W - 0.44, D - 0.44, 18, ...MAD, 8);
    boxF(W / 2 - 0.12, D - 0.225, 0.24, 0.006, 8, "ouro0", "ouro0", "ouro1", 13);
    boxF(0.19, 0.19, W - 0.38, D - 0.38, 3, ...MAD, 26);
    const [ci, cj] = pt(W / 2, D / 2);
    redondo(k, ci, cj, 0.16, 29, 4, "ouro0", "ouro1", "ouro2");
    redondo(k, ci, cj, 0.05, 33, 14, "ouro0", "ouro1", "ouro2");
    redondo(k, ci, cj, 0.1, 47, 3, "ouro0", "ouro1", "ouro2");
    /* a taça: fatias cada vez mais largas, de baixo para cima */
    for (const [rr, z, h] of [[0.12, 50, 4], [0.16, 54, 5], [0.19, 59, 6], [0.21, 65, 7]] as const) redondo(k, ci, cj, rr, z, h, "ouro0", "ouro1", "ouro2", true, false);
    redondo(k, ci, cj, 0.22, 72, 0, "ouro2", "ouro2", "ouro2");
    /* as alças nos dois lados */
    for (const du of [-0.27, 0.23]) boxF(W / 2 + du, D / 2 - 0.02, 0.04, 0.04, 12, "ouro0", "ouro1", "ouro2", 58);
    /* a estrela em cima */
    const [x, y] = projAtual(ci, cj, 82);
    const e = escalaPx();
    const pts: Pt[] = Array.from({ length: 10 }, (_, n) => {
      const a = -Math.PI / 2 + (n * Math.PI) / 5, rr = (n % 2 ? 3 : 7) * e;
      return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
    });
    k.poly(pts, "neon-ouro", true);
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
  "cadeira-gamer": (k, r, giro) => {
    cadeira(k, r, giro, ["preto0", "preto1", "preto2"], 70);
    /* as faixas vermelhas do encosto e do assento */
    const { W, boxF } = rel(k, r, giro);
    boxF(W / 2 - 0.07, 0.335, 0.14, 0.006, 34, "pelucia0", "pelucia0", "pelucia1", 30);
    boxF(W / 2 - 0.05, 0.31, 0.1, 0.006, 8, "pelucia0", "pelucia0", "pelucia1", 72);
  },
  "cadeira-trono": (k, r, giro) => trono(k, r, giro),
  "cadeira-escritorio": (k, r, giro) => cadeira(k, r, giro, ["cadeira0", "cadeira1", "cadeira2"], 60),
  "mesa-rgb": (k, r, giro) => DESENHO_QUARTO.pc(k, r, giro),
  "tapete-rift": (k, r) => tapete(k, r, "rift0", "rift1"),
  "tapete-pelucia": (k, r) => tapete(k, r, "pelucia0", "pelucia1"),
  "planta-samambaia": (k, r) => samambaia(k, r),
  /* cacto: vaso de barro redondo, o corpo em gomos com dois braços e uma flor em cima */
  "planta-cacto": (k, r) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    redondo(k, ci, cj, 0.2, 0, 16, "vaso0", "vaso1", "vaso2");
    redondo(k, ci, cj, 0.22, 16, 4, "vaso0", "vaso1", "vaso2");
    redondo(k, ci, cj, 0.18, 19, 1, "madeirav", "madeirav", "madeirav", false);
    k.box(ci - 0.26, cj - 0.04, 0.12, 0.08, 6, "cacto0", "cacto1", "cacto1", 38);
    k.box(ci - 0.26, cj - 0.04, 0.08, 0.08, 18, "cacto0", "cacto1", "cacto1", 38);
    for (let n = 0; n < 6; n++) redondo(k, ci, cj, n === 5 ? 0.08 : 0.11, 20 + n * 9, 9, "cacto0", "cacto1", "cacto1");
    k.box(ci + 0.12, cj - 0.04, 0.12, 0.08, 6, "cacto0", "cacto1", "cacto1", 50);
    k.box(ci + 0.18, cj - 0.04, 0.08, 0.08, 16, "cacto0", "cacto1", "cacto1", 50);
    const [x, y] = projAtual(ci, cj, 74);
    const e = escalaPx();
    for (const [dx, dy] of [[-4, 0], [4, 0], [0, -3], [0, 3]]) k.poly([[x + (dx - 2.5) * e, y + dy * e], [x + dx * e, y + (dy - 2.5) * e], [x + (dx + 2.5) * e, y + dy * e], [x + dx * e, y + (dy + 2.5) * e]], "fogo2");
    k.poly([[x - 1.5 * e, y], [x, y - 1.5 * e], [x + 1.5 * e, y], [x, y + 1.5 * e]], "neon-ouro");
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
  /* o banheiro (05/11/2026, redesenhado): o vaso com o pé, a bacia redonda, o assento, a tampa aberta encostada na caixa
     acoplada e o botão de descarga; a pia de coluna com a cuba funda, a borda e a torneira cromada */
  vaso: (k, r, giro) => {
    const { W, D, boxF } = rel(k, r, giro);
    const pt = ponto(r, giro);
    /* a caixa acoplada, encostada atrás: corpo, tampa um pouco maior e o botão de descarga */
    boxF(W / 2 - 0.2, 0.14, 0.4, 0.16, 34, "louca0", "louca1", "louca2", 4);
    boxF(W / 2 - 0.22, 0.12, 0.44, 0.2, 3, "louca0", "louca0", "louca1", 38);
    const [bi, bj] = pt(W / 2, 0.22);
    redondo(k, bi, bj, 0.035, 41, 1.2, "cinza0", "cinza1", "cinza2");
    /* o pé e a bacia na frente, ligados à caixa */
    boxF(W / 2 - 0.12, 0.28, 0.24, 0.2, 18, "louca0", "louca1", "louca2");
    const [ci, cj] = pt(W / 2, 0.52);
    redondo(k, ci, cj, 0.12, 0, 10, "louca0", "louca1", "louca2");
    redondo(k, ci, cj, 0.21, 10, 8, "louca0", "louca1", "louca2");
    /* o assento (um anel mais claro), o fundo e a água */
    redondo(k, ci, cj, 0.22, 18, 2, "louca0", "louca0", "louca1");
    redondo(k, ci, cj, 0.15, 20.05, 0, "louca2", "louca2", "louca2", false);
    redondo(k, ci, cj, 0.1, 20.1, 0, "agua", "agua", "agua", false);
    void D;
  },
  pia: (k, r, giro) => {
    const { W, D, boxF } = rel(k, r, giro);
    const pt = ponto(r, giro);
    const [ci, cj] = pt(W / 2, D / 2 - 0.1);
    redondo(k, ci, cj, 0.14, 0, 3, "louca0", "louca1", "louca2");
    redondo(k, ci, cj, 0.09, 3, 26, "louca0", "louca1", "louca2");
    boxF(W / 2 - 0.34, D / 2 - 0.36, 0.68, 0.48, 8, "louca0", "louca1", "louca2", 28);
    /* a cuba funda no tampo */
    boxF(W / 2 - 0.24, D / 2 - 0.24, 0.48, 0.3, 0.4, "louca2", "louca2", "louca2", 36);
    boxF(W / 2 - 0.18, D / 2 - 0.2, 0.36, 0.22, 0.3, "agua", "agua", "agua", 36.2);
    /* a torneira: o pé, o bico e as manoplas */
    const [ti, tj] = pt(W / 2, D / 2 - 0.3);
    redondo(k, ti, tj, 0.035, 36, 8, "cinza0", "cinza1", "cinza2");
    boxF(W / 2 - 0.02, D / 2 - 0.3, 0.04, 0.12, 2.5, "cinza0", "cinza1", "cinza2", 43);
    for (const du of [-0.11, 0.11]) {
      const [mi, mj] = pt(W / 2 + du, D / 2 - 0.3);
      redondo(k, mi, mj, 0.03, 36, 4, "cinza0", "cinza1", "cinza2");
    }
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

  /* ---------- coleção rústica (05/11/2026): madeira com veios, tábuas, pés torneados, pedra e ferro ---------- */
  "mesa-rustica": (k, r) => {
    const { i, j, w, d } = r;
    for (const [a, b] of [[i + 0.2, j + 0.2], [i + w - 0.2, j + 0.2], [i + 0.2, j + d - 0.2], [i + w - 0.2, j + d - 0.2]]) pernaR(k, a, b, 0, 21, 0.08);
    k.box(i + 0.12, j + 0.12, w - 0.24, d - 0.24, 5, ...RMAD, 20);
    veiosR(k, i + 0.12, j + 0.12, w - 0.24, d - 0.24, 20, 25, 11);
    tabuasR(k, i + 0.04, j + 0.04, w - 0.08, d - 0.08, 25, 5, 3, 13);
  },
  "banco-rustico": (k, r) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    for (const [a, b] of [[ci - 0.2, cj - 0.2], [ci + 0.2, cj - 0.2], [ci - 0.2, cj + 0.2], [ci + 0.2, cj + 0.2]]) pernaR(k, a, b, 0, 12, 0.05);
    redondo(k, ci, cj, 0.34, 12, 4, ...RMAD);
  },
  "estante-rustica": (k, r, giro) => {
    const { W, D, box, boxF } = rel(k, r, giro);
    const fundo = 0.32;
    box(0.08, 0.1, W - 0.16, 0.06, 92, ...RMAD);
    box(0.08, 0.1, 0.08, fundo + 0.1, 92, ...RMAD);
    box(W - 0.16, 0.1, 0.08, fundo + 0.1, 92, ...RMAD);
    for (const z of [0, 30, 60, 88]) box(0.08, 0.1, W - 0.16, fundo + 0.1, 4, ...RMAD, z);
    /* livros nas duas prateleiras de baixo e um pote e uma vela na de cima */
    let u = 0.2;
    for (let n = 0; u < W - 0.28; n++) {
      const l = 0.07 + ((n * 37) % 5) * 0.012, alt = 18 + ((n * 53) % 4) * 2;
      boxF(u, 0.2, l, fundo - 0.06, alt, ...LIVROS[n % LIVROS.length], 4);
      boxF(u + 0.03, 0.2, l, fundo - 0.06, alt - 2, ...LIVROS[(n + 2) % LIVROS.length], 34);
      u += l + 0.015;
    }
    boxF(0.25, 0.22, 0.14, 0.14, 10, "ferro0", "ferro1", "ferro2", 64);
    vela(k, giro ? r.i + 0.3 : r.i + W - 0.3, giro ? r.j + W - 0.3 : r.j + 0.3, 64, 10);
    void D;
  },
  abajur: (k, r) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    redondo(k, ci, cj, 0.22, 0, 4, ...RMAD);
    pernaR(k, ci, cj, 4, 52, 0.06);
    /* a cúpula: tronco de cone em fatias, mais larga embaixo */
    for (let n = 0; n < 6; n++) redondo(k, ci, cj, 0.3 - n * 0.025, 56 + n * 4, 4, "cupula0", "cupula1", "cupula2", false);
    const [x, y] = projAtual(ci, cj, 56);
    k.poly([[x - 9, y], [x + 9, y], [x + 4, y + 5], [x - 4, y + 5]], "luzq");
  },
  candelabro: (k, r) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    redondo(k, ci, cj, 0.24, 0, 4, ...RMAD);
    pernaR(k, ci, cj, 4, 40, 0.07);
    k.box(ci - 0.34, cj - 0.03, 0.68, 0.06, 3, "ferro0", "ferro1", "ferro2", 44);
    k.box(ci - 0.03, cj - 0.34, 0.06, 0.68, 3, "ferro0", "ferro1", "ferro2", 44);
    for (const [a, b] of [[ci, cj - 0.3], [ci + 0.3, cj], [ci - 0.3, cj], [ci, cj + 0.3]]) {
      redondo(k, a, b, 0.07, 47, 2, "ferro0", "ferro1", "ferro2");
      vela(k, a, b, 49, 12);
    }
    vela(k, ci, cj, 47, 18);
  },
  barril: (k, r) => {
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    barril(k, ci, cj, 0.34, 0, 34);
  },
  "bar-barril": (k, r) => {
    /* barril de bar: um tampo de tábuas em cima e as garrafas e um copo */
    const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
    barril(k, ci, cj, 0.32, 0, 30);
    tabuasR(k, ci - 0.4, cj - 0.4, 0.8, 0.8, 30, 3, 3, 31);
    const garrafas: [number, number, string][] = [[-0.18, -0.12, "garrafa"], [0.0, -0.2, "garrafb"], [0.16, -0.06, "garrafa"], [-0.06, 0.08, "garrafb"]];
    for (const [di, dj, c] of garrafas) {
      redondo(k, ci + di, cj + dj, 0.06, 33, 13, c + "0", c + "1", c + "2");
      redondo(k, ci + di, cj + dj, 0.025, 46, 6, c + "0", c + "1", c + "2");
    }
    redondo(k, ci + 0.2, cj + 0.18, 0.05, 33, 6, "cupula0", "cupula1", "cupula2");
  },
  lareira: (k, r, giro) => {
    const { W, D, boxF } = rel(k, r, giro);
    /* base de pedra, a boca com o fogo, o console de madeira e a chaminé */
    boxF(0.05, 0.05, W - 0.1, D - 0.15, 48, ...PEDRA);
    pedrasR(k, r, giro, W, D - 0.1, 0, 48);
    boxF(W / 2 - 0.42, D - 0.12, 0.84, 0.02, 30, "brasa", "brasa", "brasa", 4);
    boxF(W / 2 - 0.36, D - 0.11, 0.72, 0.02, 12, "fogo2", "fogo2", "fogo2", 4);
    boxF(W / 2 - 0.26, D - 0.1, 0.52, 0.02, 16, "fogo1", "fogo1", "fogo1", 6);
    boxF(W / 2 - 0.14, D - 0.09, 0.28, 0.02, 12, "fogo0", "fogo0", "fogo0", 8);
    boxF(0, 0, W, D - 0.02, 5, ...RMAD, 48);
    boxF(0.4, 0.05, W - 0.8, D - 0.5, 62, ...PEDRA, 53);
    pedrasR(k, r, giro, W - 0.7, D - 0.45, 53, 115, 0.35);
    boxF(0.34, 0.02, W - 0.68, D - 0.44, 6, "pedra1", "pedra1", "pedra2", 115);
  },
  "bau-rustico": (k, r, giro) => {
    const { W, D, boxF } = rel(k, r, giro);
    const [i, j, w, d] = absR(r, giro, 0.12, 0.2, W - 0.24, D - 0.4);
    boxF(0.12, 0.2, W - 0.24, D - 0.4, 22, ...RMAD);
    veiosR(k, i, j, w, d, 2, 21, 23);
    boxF(0.1, 0.18, W - 0.2, D - 0.36, 8, ...RMAD, 22);
    /* duas cintas de ferro finas e o fecho dourado na frente */
    /* cada cinta é só uma tira na frente e outra por cima da tampa (uma caixa cheia cobriria o lado do baú) */
    for (const u of [0.24, W - 0.3]) {
      boxF(u, D - 0.2, 0.06, 0.015, 30, "ferro1", "ferro1", "ferro2");
      boxF(u, 0.18, 0.06, D - 0.36, 0.8, "ferro1", "ferro1", "ferro2", 30);
    }
    boxF(W / 2 - 0.06, D - 0.2, 0.12, 0.02, 8, "garrafb0", "garrafb0", "garrafb1", 16);
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
/* samambaia num vaso de barro: as folhas compridas saem do meio e caem para os lados, em dois tons */
function samambaia(k: Lapis, r: Retangulo) {
  const ci = r.i + r.w / 2, cj = r.j + r.d / 2;
  redondo(k, ci, cj, 0.2, 0, 18, "vaso0", "vaso1", "vaso2");
  redondo(k, ci, cj, 0.23, 18, 4, "vaso0", "vaso1", "vaso2");
  redondo(k, ci, cj, 0.2, 21, 1, "madeirav", "madeirav", "madeirav", false);
  const [x, y] = projAtual(ci, cj, 22);
  const e = escalaPx();
  /* as de trás primeiro (sobem e caem para longe), as da frente por último */
  const folhas = 14;
  const ordem = Array.from({ length: folhas }, (_, n) => (n / folhas) * Math.PI * 2 + 0.2).sort((a, b) => Math.sin(a) - Math.sin(b));
  ordem.forEach((t, n) => {
    const alto = n % 3 === 0;
    const comp = (alto ? 26 : 34) * e, cai = (alto ? -30 : -6) * e;
    const px = x + Math.cos(t) * comp, py = y + Math.sin(t) * comp * 0.5 + cai + 12 * e;
    const nx = -Math.sin(t) * 5 * e, ny = Math.cos(t) * 2.5 * e;
    const meio: Pt = [(x + px) / 2, (y - 10 * e + py) / 2 - 10 * e];
    k.poly([[x, y - 6 * e], [meio[0] + nx, meio[1] + ny], [px, py], [meio[0] - nx, meio[1] - ny]], n % 2 ? "planta1" : "planta0", true);
  });
  for (let n = 0; n < 5; n++) {
    const t = (n / 5) * Math.PI * 2;
    k.poly([[x, y - 6 * e], [x + (Math.cos(t) * 6 - 3) * e, y - 26 * e], [x + Math.cos(t) * 10 * e, y - (40 + n * 2) * e], [x + (Math.cos(t) * 6 + 3) * e, y - 26 * e]], "planta2", true);
  }
}
function tapete(k: Lapis, r: Retangulo, a: string, b: string) {
  k.poly([p0(r.i + 0.1, r.j + 0.1), p0(r.i + r.w - 0.1, r.j + 0.1), p0(r.i + r.w - 0.1, r.j + r.d - 0.1), p0(r.i + 0.1, r.j + r.d - 0.1)], a);
  k.poly([p0(r.i + 0.18, r.j + 0.18), p0(r.i + r.w - 0.18, r.j + 0.18), p0(r.i + r.w - 0.18, r.j + r.d - 0.18), p0(r.i + 0.18, r.j + r.d - 0.18)], b);
  k.poly([p0(r.i + 0.26, r.j + 0.26), p0(r.i + r.w - 0.26, r.j + 0.26), p0(r.i + r.w - 0.26, r.j + r.d - 0.26), p0(r.i + 0.26, r.j + r.d - 0.26)], a);
  k.poly([p0(r.i + 0.32, r.j + 0.32), p0(r.i + r.w - 0.32, r.j + 0.32), p0(r.i + r.w - 0.32, r.j + r.d - 0.32), p0(r.i + 0.32, r.j + r.d - 0.32)], b);
  /* as franjas nas duas pontas */
  for (let a2 = r.j + 0.16; a2 < r.j + r.d - 0.12; a2 += 0.07) {
    risco(k, p0(r.i + 0.1, a2), p0(r.i + 0.02, a2), "lencol1");
    risco(k, p0(r.i + r.w - 0.1, a2), p0(r.i + r.w - 0.02, a2), "lencol1");
  }
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
  return lista.map((d, k) => <polygon key={k} points={d.q.map((v) => v.join(",")).join(" ")} className={`q-${d.c}` + (d.linha ? " q-linha" : "")} />);
}

/* ---------- kit rústico ---------- */
const RMAD: [string, string, string] = ["rmad0", "rmad1", "rmad2"];
const MAD: [string, string, string] = ["madeira0", "madeira1", "madeira2"];
/** Quanto vale 1 px do desenho na projeção atual (o quarto tem meio piso de 46 px; a prévia da loja, outro tamanho). */
const escalaPx = () => (projAtual(1, 0)[0] - projAtual(0, 0)[0]) / 46;
/** Ponto da cena a partir do referencial (u, v) do móvel. */
const ponto = (r: Retangulo, giro: boolean) => (u: number, v: number): [number, number] => (giro ? [r.i + v, r.j + u] : [r.i + u, r.j + v]);
const PEDRA: [string, string, string] = ["pedra0", "pedra1", "pedra2"];

/** Retângulo do móvel em coordenadas da cena, a partir do referencial (u, v) dele. */
function absR(r: Retangulo, giro: boolean, u: number, v: number, lu: number, lv: number): [number, number, number, number] {
  return giro ? [r.i + v, r.j + u, lv, lu] : [r.i + u, r.j + v, lu, lv];
}
/** Uma linha fina (faixa de ~0,8 px) entre dois pontos, na cor c: veio, fresta, rejunte. */
function risco(k: Lapis, a: Pt, b: Pt, c: string) {
  const em_pe = Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]);
  const [dx, dy] = em_pe ? [0.8, 0] : [0, 0.8];
  k.poly([a, b, [b[0] + dx, b[1] + dy], [a[0] + dx, a[1] + dy]], c);
}
/** Sorteio fixo (a mesma semente desenha sempre os mesmos veios). */
const sorteio = (n: number) => () => (n = (n * 16807) % 2147483647) / 2147483647;
/** Veios nas duas faces visíveis de uma caixa (frente j + d e lado i + w). */
function veiosR(k: Lapis, i: number, j: number, w: number, d: number, z0: number, z1: number, semente: number, cor = "rmadv") {
  const r = sorteio(semente), p = projAtual;
  const n = Math.max(1, Math.floor((z1 - z0) / 4));
  for (let q = 0; q < n; q++) {
    const z = z0 + ((q + 0.5) * (z1 - z0)) / n;
    const a = i + r() * w * 0.4, c = Math.min(i + w - 0.04, a + w * (0.3 + r() * 0.5));
    risco(k, p(a, j + d, z), p(c, j + d, z + (r() - 0.5)), cor);
    const e = j + r() * d * 0.4, f = Math.min(j + d - 0.04, e + d * (0.3 + r() * 0.5));
    risco(k, p(i + w, e, z), p(i + w, f, z + (r() - 0.5)), cor);
  }
}
/** Tampo de n tábuas no sentido comprido, com fresta entre elas e veios por cima. */
function tabuasR(k: Lapis, i: number, j: number, w: number, d: number, z: number, h: number, n: number, semente: number) {
  const r = sorteio(semente), p = projAtual, fresta = 0.035, comp = w >= d;
  const larg = ((comp ? d : w) - fresta * (n - 1)) / n;
  for (let q = 0; q < n; q++) {
    const o = q * (larg + fresta);
    const [ti, tj, tw, td] = comp ? [i, j + o, w, larg] : [i + o, j, larg, d];
    k.box(ti, tj, tw, td, h, ...RMAD, z);
    for (let v = 1; v <= 2; v++) {
      const f = v / 3 + (r() - 0.5) * 0.1;
      if (comp) risco(k, p(ti + 0.06 + r() * 0.2, tj + td * f, z + h), p(ti + tw - 0.1 - r() * 0.3, tj + td * f, z + h), "rmadv");
      else risco(k, p(ti + tw * f, tj + 0.06 + r() * 0.2, z + h), p(ti + tw * f, tj + td - 0.1 - r() * 0.3, z + h), "rmadv");
    }
  }
}
/** Disco (cilindro baixo) em fatias: o lado e a tampa; `linha` = com contorno. */
function redondo(k: Lapis, ci: number, cj: number, raio: number, z: number, h: number, topo: string, lado: string, _esc: string, linha = true, tampa = true) {
  const p = projAtual, n = 20;
  const anel = (zz: number) => Array.from({ length: n }, (_, q) => p(ci + raio * Math.cos((q / n) * Math.PI * 2), cj + raio * Math.sin((q / n) * Math.PI * 2), zz));
  if (h > 0) {
    /* o lado: a metade da frente do anel de baixo e a de cima, ligadas */
    const baixo = anel(z), cima = anel(z + h);
    const frente = (l: Pt[]) => l.filter((_, q) => { const t = (q / n) * Math.PI * 2; return Math.cos(t - Math.PI / 4) > -0.05; });
    const fb = frente(baixo), fc = frente(cima);
    const ordem = (l: Pt[]) => [...l].sort((a, b) => a[0] - b[0]);
    k.poly([...ordem(fb), ...ordem(fc).reverse()], lado, linha);
  }
  if (tampa) k.poly(anel(z + h), topo, linha);
}
/** Perna torneada: pé, haste com anéis, bojo no meio e bloco de cima. */
function pernaR(k: Lapis, ci: number, cj: number, z0: number, h: number, g: number, c: [string, string, string] = RMAD) {
  const b = z0 + Math.min(4, h * 0.18), t = z0 + h - Math.min(5, h * 0.2), f = g * 0.55;
  k.box(ci - g, cj - g, g * 2, g * 2, b - z0, ...c, z0);
  k.box(ci - f, cj - f, f * 2, f * 2, t - b, ...c, b);
  if (t - b > 6) {
    redondo(k, ci, cj, g * 1.15, b + (t - b) * 0.3, (t - b) * 0.3, ...c);
    redondo(k, ci, cj, g * 0.9, b + 1, 1.5, ...c);
    redondo(k, ci, cj, g * 0.9, t - 2.5, 1.5, ...c);
  }
  k.box(ci - g, cj - g, g * 2, g * 2, z0 + h - t, ...c, t);
}
/** Vela grossa com a chama. */
function vela(k: Lapis, ci: number, cj: number, z: number, h: number) {
  redondo(k, ci, cj, 0.06, z, h, "vela0", "vela1", "vela2");
  const [x, y] = projAtual(ci, cj, z + h);
  k.poly([[x, y - 7], [x + 2.2, y - 2.5], [x, y], [x - 2.2, y - 2.5]], "chama");
}
/** Barril em pé: o bojo (mais largo no meio), as aduelas e duas cintas finas de ferro; a tampa por último. */
function barril(k: Lapis, ci: number, cj: number, raio: number, z: number, h: number) {
  const fatias = [0.88, 0.96, 1, 1, 0.96, 0.88];
  const fh = h / fatias.length;
  fatias.forEach((f, n) => redondo(k, ci, cj, raio * f, z + n * fh, fh, ...RMAD, false, false));
  /* as aduelas: riscos em pé na metade da frente */
  for (const a of [0.2, 0.5, 0.8, 1.1, 1.4]) {
    const t = Math.PI / 4 + (a - 0.8) * 1.6;
    const [x0, y0] = projAtual(ci + raio * 0.92 * Math.cos(t), cj + raio * 0.92 * Math.sin(t), z + 2);
    const [x1, y1] = projAtual(ci + raio * 0.92 * Math.cos(t), cj + raio * 0.92 * Math.sin(t), z + h - 2);
    risco(k, [x0, y0], [x1, y1], "rmadv");
  }
  for (const zz of [z + h * 0.16, z + h * 0.76]) redondo(k, ci, cj, raio * 0.99, zz, 2, "ferro1", "ferro1", "ferro2", true, false);
  redondo(k, ci, cj, raio * 0.88, z + h, 0, "rmad0", "rmad0", "rmad0");
  redondo(k, ci, cj, raio * 0.74, z + h + 0.1, 0, "rmadv", "rmadv", "rmadv", false);
}
/** Rejunte das pedras na frente de uma caixa de pedra (do referencial u, v para a cena). */
function pedrasR(k: Lapis, r: Retangulo, giro: boolean, W: number, D: number, z0: number, z1: number, u0 = 0.05) {
  const [i, j, w, d] = absR(r, giro, u0, 0.05, W - 0.1, D - 0.05);
  const p = projAtual;
  for (let z = z0 + 8, n = 0; z < z1; z += 8, n++) {
    if (giro) risco(k, p(i + w, j, z), p(i + w, j + d, z), "pedral");
    else risco(k, p(i, j + d, z), p(i + w, j + d, z), "pedral");
    for (let a = (n % 2) * 0.12 + 0.1; a < (giro ? d : w) - 0.05; a += 0.24) {
      if (giro) risco(k, p(i + w, j + a, z - 8), p(i + w, j + a, z - 0.5), "pedral");
      else risco(k, p(i + a, j + d, z - 8), p(i + a, j + d, z - 0.5), "pedral");
    }
  }
}

/**
 * Sofá e poltrona (05/11/2026, refeitos): pés torneados de madeira, a base com o friso, os braços baixos com o tampo
 * arredondado, o encosto mais alto com as almofadas capitonê e os assentos com o vivo na frente. A poltrona tem os
 * braços mais finos e um assento só, largo. O assento termina na altura 18 (onde o boneco senta).
 */
function estofado(k: Lapis, r: Retangulo, giro: boolean, poltrona: boolean) {
  const { W, D, box, boxF } = rel(k, r, giro);
  const pt = ponto(r, giro), c = tons("cadeira");
  for (const [u, v] of [[M + 0.08, M + 0.08], [W - M - 0.08, M + 0.08], [M + 0.08, D - M - 0.08], [W - M - 0.08, D - M - 0.08]]) pernaR(k, ...pt(u, v), 0, 5, 0.045, MAD);
  const bw = poltrona ? 0.15 : 0.16, a0 = M + bw, a1 = W - M - bw;
  const n = poltrona ? 1 : W - 2 * M >= 1.5 ? 3 : 2, sw = (a1 - a0 - (n - 1) * 0.025) / n;
  /* de trás para a frente: encosto, braço do fundo, base, almofadas, braço da frente */
  box(M, M, W - 2 * M, 0.2, 28, ...c, 4);
  box(M + 0.01, M, W - 2 * M - 0.02, 0.2, 3, c[0], c[0], c[1], 32);
  const braco = (u: number) => {
    box(u, M + 0.02, bw, D - 2 * M - 0.02, 18, ...c, 4);
    box(u - 0.005, M + 0.01, bw + 0.01, D - 2 * M, 3, c[0], c[0], c[1], 22);
  };
  braco(M);
  box(a0, M + 0.2, a1 - a0, D - 2 * M - 0.2, 8, ...c, 4);
  for (let x = 0; x < n; x++) {
    const u = a0 + x * (sw + 0.025);
    /* almofada de encosto, com os botões */
    box(u + 0.01, M + 0.2, sw - 0.02, 0.13, 15, ...c, 12);
    for (const du of poltrona ? [0.3, 0.7] : [0.5]) boxF(u + sw * du - 0.012, M + 0.33, 0.024, 0.004, 1.6, "cadeira2", "cadeira2", "cadeira2", 21);
    /* assento fofo com o vivo na frente */
    box(u + 0.005, M + 0.33, sw - 0.01, D - 2 * M - 0.35, 6, ...c, 12);
    boxF(u + 0.005, D - M - 0.03, sw - 0.01, 0.008, 1, "cadeira0", "cadeira0", "cadeira0", 16);
  }
  boxF(M, D - M - 0.012, W - 2 * M, 0.012, 2, ...MAD, 5);
  braco(a1);
}

/** O trono dourado: pés de leão, o assento de veludo vermelho, os braços de ouro e o espaldar alto com a coroa em cima. */
function trono(k: Lapis, r: Retangulo, giro: boolean) {
  const { W, D, box, boxF } = rel(k, r, giro);
  const pt = ponto(r, giro);
  const OURO: [string, string, string] = ["ouro0", "ouro1", "ouro2"];
  const VEL: [string, string, string] = ["veludo0", "veludo1", "veludo2"];
  for (const [u, v] of [[0.22, 0.22], [W - 0.22, 0.22], [0.22, D - 0.2], [W - 0.22, D - 0.2]]) pernaR(k, ...pt(u, v), 0, 14, 0.05, OURO);
  box(0.16, 0.18, W - 0.32, D - 0.34, 4, ...OURO, 14);
  box(0.2, 0.3, W - 0.4, D - 0.5, 5, ...VEL, 18);
  /* o espaldar: moldura de ouro, o veludo e a coroa de três pontas */
  box(0.16, 0.14, W - 0.32, 0.12, 74, ...OURO, 18);
  boxF(0.24, 0.26, W - 0.48, 0.006, 58, ...VEL, 26);
  for (let x = 0; x < 3; x++) {
    const u = 0.2 + x * ((W - 0.48) / 2);
    box(u, 0.15, 0.08, 0.1, x === 1 ? 16 : 10, ...OURO, 92);
    const [ci, cj] = pt(u + 0.04, 0.2);
    redondo(k, ci, cj, 0.035, 92 + (x === 1 ? 16 : 10), 3, ...VEL);
  }
  /* os braços de ouro */
  for (const u of [0.14, W - 0.22]) {
    box(u, 0.26, 0.08, D - 0.46, 14, ...OURO, 18);
    box(u - 0.01, 0.26, 0.1, D - 0.44, 3, ...OURO, 32);
  }
}
