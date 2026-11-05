/*
 * O cômodo do hall desenhado em SVG: paredes de tijolinho, porta do banheiro, janelão com árvores, piso de
 * lajota e os móveis, na disposição da planta do grupo (02/11/2026). Geometria do planejamento/demo/hall-v2.html
 * (`p()` = `tela`, `caixa()`, `naParede()`).
 * As cores são classes `f-<nome>` (preenchimento) e `s-<nome>` (traço), definidas em 22-hall.css.
 * Cada móvel é uma camada própria, para o boneco passar atrás e na frente dele.
 */
import { memo } from "react";
import { MOVEIS, NI, NJ, tela, WH, type Caixa2D, type Movel, type Piso } from "./hall";

type Pt = [number, number];
type Forma =
  | { t: "p"; q: Pt[]; f?: string; s?: string; sw?: number }
  | { t: "e"; cx: number; cy: number; rx: number; ry: number; f?: string; s?: string; sw?: number }
  | { t: "c"; cx: number; cy: number; r: number; f: string }
  | { t: "l"; a: Pt; b: Pt; s: string; sw: number }
  | { t: "r"; x: number; y: number; w: number; h: number; f: string; s?: string; rx?: number; rot?: number }
  | { t: "txt"; x: number; y: number; rot: number; txt: string; f: string };

export const viewBox = (vb: Caixa2D) => `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
const p = tela;
const pts = (q: Pt[]) => q.map((v) => v.join(",")).join(" ");

/* ---------- ajudantes (os mesmos do modelo, empurrando formas numa lista) ---------- */
const poly = (L: Forma[], q: Pt[], f?: string, s?: string, sw = 1) => L.push({ t: "p", q, f, s, sw });

/** Caixa isométrica: canto (i, j), w em i, d em j, altura h, base z. Tom chapado (sem degradê), contorno escuro e a
    luz de cima e da esquerda: tampo claro, face da esquerda (j + d) média, face da direita (i + w) escura, e um brilho
    fino na quina da frente do tampo. Na paleta, o tom "1" (`esc`) é o mais escuro e o "2" (`med`) o médio. */
function caixa(L: Forma[], i: number, j: number, w: number, d: number, h: number, topo: string, esc: string, med: string, z = 0, linha = "madeiral", cham?: number) {
  const ch = cham !== undefined ? Math.min(cham, w / 3, d / 3) : h >= 5 && w > 0.14 && d > 0.14 ? Math.min(0.06, w / 4, d / 4) : 0;
  const zt = z + h, zb = ch ? zt - Math.min(h * (cham !== undefined ? 0.45 : 0.25), 5) : zt;
  poly(L, [p(i, j + d, z), p(i + w, j + d, z), p(i + w, j + d, zb), p(i, j + d, zb)], med, linha);
  poly(L, [p(i + w, j, z), p(i + w, j + d, z), p(i + w, j + d, zb), p(i + w, j, zb)], esc, linha);
  if (!ch) poly(L, [p(i, j, zt), p(i + w, j, zt), p(i + w, j + d, zt), p(i, j + d, zt)], topo, linha);
  else {
    poly(L, [p(i, j + d, zb), p(i + w, j + d, zb), p(i + w - ch, j + d - ch, zt), p(i, j + d - ch, zt)], topo, linha);
    poly(L, [p(i + w, j, zb), p(i + w, j + d, zb), p(i + w - ch, j + d - ch, zt), p(i + w - ch, j, zt)], med, linha);
    poly(L, [p(i, j, zt), p(i + w - ch, j, zt), p(i + w - ch, j + d - ch, zt), p(i, j + d - ch, zt)], topo, linha);
  }
  /* o brilho: na quina de cima da face da esquerda, de ponta a ponta (só nas peças que têm tamanho para isso) */
  if (h >= 3 && w >= 0.3 && d >= 0.3) {
    const m = Math.min(0.08, w / 6);
    L.push({ t: "l", a: p(i + m, j + d - ch, zt), b: p(i + w - ch - m, j + d - ch, zt), s: "brilho", sw: 1 });
  }
}

/** Pontos de um retângulo numa parede: "dir" (j = 0, ao longo de i) ou "esq" (i = 0, ao longo de j). */
const naParedeP = (lado: "dir" | "esq", a: number, b: number, z0: number, z1: number): Pt[] =>
  lado === "dir" ? [p(a, 0, z0), p(b, 0, z0), p(b, 0, z1), p(a, 0, z1)] : [p(0, a, z0), p(0, b, z0), p(0, b, z1), p(0, a, z1)];
const naParede = (L: Forma[], lado: "dir" | "esq", a: number, b: number, z0: number, z1: number, f?: string, s?: string, sw?: number) =>
  poly(L, naParedeP(lado, a, b, z0, z1), f, s, sw);

/* ---------- paredes ---------- */
let semente = 11;
const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
const TIJ = ["tij0", "tij1", "tij2", "tij3", "tij4"];

/** Os tijolos de uma parede. A da esquerda fica num grupo um pouco mais escuro (sombra). */
function tijolos(lado: "dir" | "esq", n: number): Forma[] {
  const L: Forma[] = [];
  naParede(L, lado, 0, n, 0, WH, "rejunte");
  for (let r = 0, z = 0; z < WH; r++, z += 9)
    for (let a = r % 2 ? -0.25 : 0; a < n; a += 0.5) {
      const a0 = Math.max(0, a);
      const a1 = Math.min(n, a + 0.5);
      if (a1 <= a0) continue;
      const cor = rnd() < 0.07 ? "tijv" : TIJ[Math.floor(rnd() * TIJ.length)];
      naParede(L, lado, a0 + 0.03, a1 - 0.03, z + 1, Math.min(WH, z + 8), cor);
    }
  return L;
}
const TIJ_ESQ = tijolos("esq", NJ);
const TIJ_DIR = tijolos("dir", NI);

/* janelão na parede da esquerda, em cima do sofá (remodelação de 03/11/2026; antes ficava na da direita, onde
   hoje está o Mural) */
const JL = "esq" as const;
const JA = 6.55, JB = 10.25, JZ0 = 70, JZ1 = 182;
const VAO_JANELA = naParedeP(JL, JA, JB, JZ0, JZ1);
/* a TV, na parede da direita, entre a porta do banheiro e o Mural */
const TA = 2.75, TB = 4.65, TZ0 = 84, TZ1 = 142;

function paredes(): Forma[] {
  const L: Forma[] = [];
  for (const lado of ["esq", "dir"] as const) {
    const n = lado === "dir" ? NI : NJ;
    /* faixa cinza (viga pintada), pilares e rodapé */
    naParede(L, lado, 0, n, 150, 162, lado === "dir" ? "viga" : "viga2", "vigal");
    for (const a of lado === "dir" ? [2.45, 9.5] : [4.6, 10.45]) naParede(L, lado, a, a + 0.32, 0, WH, lado === "dir" ? "viga" : "viga2", "vigal");
    naParede(L, lado, 0, n, 0, 6, lado === "dir" ? "rodape" : "rodape2");
    /* beiral de madeira (forro inclinado) com a viga de tronco em cima */
    naParede(L, lado, 0, n, WH, WH + 34, lado === "dir" ? "beiral" : "beiral2", "beiralb");
    for (let a = 0.35; a < n; a += 0.35) naParede(L, lado, a, a + 0.02, WH, WH + 34, "ripa");
    naParede(L, lado, 0, n, WH + 26, WH + 38, "tronco", "troncol");
  }
  const [qx, qy] = p(0, 0);
  poly(L, [p(0, 0, 0), p(0, 0, WH + 38), [qx + 3, p(0, 0, WH + 38)[1]], [qx + 3, qy]], "quina");
  /* moldura do janelão (a paisagem vem por cima, recortada) */
  naParede(L, JL, JA - 0.12, JB + 0.12, JZ0 - 10, JZ1 + 10, "janela", "beiralb", 2);
  return L;
}

/** O que fica na frente da paisagem do janelão e nas paredes (desenhado depois dela). */
function enfeites(): Forma[] {
  const L: Forma[] = [];
  /* caixilho, peitoril e cortinas do janelão */
  for (const a of [JA + (JB - JA) / 3, JA + (2 * (JB - JA)) / 3]) naParede(L, JL, a - 0.04, a + 0.04, JZ0, JZ1, "janela");
  naParede(L, JL, JA, JB, (JZ0 + JZ1) / 2 - 2, (JZ0 + JZ1) / 2 + 2, "janela");
  naParede(L, JL, JA - 0.2, JB + 0.2, JZ0 - 14, JZ0 - 8, "peitoril", "beiralb");
  naParede(L, JL, JA - 0.42, JA - 0.14, JZ0 - 6, JZ1 + 16, "cortina", "cortinal");
  naParede(L, JL, JB + 0.14, JB + 0.42, JZ0 - 6, JZ1 + 16, "cortina", "cortinal");

  /* parede da direita: o suporte da TV (o Mural, entre a TV e a churrasqueira, fica numa camada própria: Mural.tsx) */
  naParede(L, "dir", (TA + TB) / 2 - 0.06, (TA + TB) / 2 + 0.06, 60, TZ0, "suporte");
  /* parede da esquerda: porta de vidro e janelas velhas */
  naParede(L, "esq", 4.95, 6.25, 0, 140, "madeira", "madeiral", 3);
  naParede(L, "esq", 5.05, 6.15, 4, 136, "vidro");
  naParede(L, "esq", 5.05, 6.15, 4, 60, "grama");
  naParede(L, "esq", 5.3, 5.85, 60, 128, "grama2");
  naParede(L, "esq", 5.58, 5.62, 4, 136, "madeira");
  const janela = (lado: "dir" | "esq", a: number, b: number, z0: number, z1: number) => {
    naParede(L, lado, a, b, z0, z1, undefined, "janela", 4);
    naParede(L, lado, (a + b) / 2 - 0.02, (a + b) / 2 + 0.02, z0, z1, "janela");
    naParede(L, lado, a, b, (z0 + z1) / 2 - 1, (z0 + z1) / 2 + 1, "janela");
  };
  janela("esq", 1.3, 2.1, 172, 208);
  janela("esq", 2.5, 3.2, 172, 208);

  /* parede da direita: a porta do banheiro (no canto), a placa K-FOFO e o relógio perto da churrasqueira */
  naParede(L, "dir", 0.55, 2.25, 0, 140, "madeira", "madeiral", 3);
  naParede(L, "dir", 0.65, 2.15, 4, 136, "tabua", "beiralb", 2);
  for (let a = 0.85; a < 2.1; a += 0.3) naParede(L, "dir", a, a + 0.02, 4, 136, "beiralb");
  const [mx, my] = p(1.95, 0, 66);
  L.push({ t: "c", cx: mx, cy: my, r: 4, f: "relogiol" });
  naParede(L, "dir", 1.0, 1.8, 104, 120, "placa", "placal", 2);
  const [bx, by] = p(1.4, 0, 112);
  L.push({ t: "txt", x: bx, y: by + 4, rot: 26.6, txt: "BANHEIRO", f: "placat" });
  naParede(L, "dir", 2.85, 3.95, 144, 160, "placa", "placal", 2);
  const [sx, sy] = p(3.4, 0, 151);
  L.push({ t: "txt", x: sx, y: sy + 4, rot: 26.6, txt: "K-FOFO 2018", f: "placat" });
  const [rx, ry] = p(10.15, 0, 140);
  L.push({ t: "e", cx: rx, cy: ry + 9, rx: 15, ry: 17, f: "relogio", s: "relogiol", sw: 3 });
  L.push({ t: "l", a: [rx, ry + 9], b: [rx + 1, ry - 2], s: "relogiol", sw: 2 });
  L.push({ t: "l", a: [rx, ry + 9], b: [rx + 8, ry + 11], s: "relogiol", sw: 2 });

  /* piso de lajota, a luz do janelão no chão e o tapete listrado perto da porta de vidro */
  for (let i = 0; i < NI; i++)
    for (let j = 0; j < NJ; j++) poly(L, [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], (i + j) % 2 ? "piso0" : "piso1", "pisol");
  /* a luz do janelão (parede da esquerda) entra deitada no chão, na frente do sofá */
  poly(L, [p(1.1, JA + 0.6), p(1.1, Math.min(NJ, JB + 0.5)), p(3.6, Math.min(NJ, JB + 1.6)), p(3.6, JA + 1.7)], "solchao");
  /* tapete listrado embaixo da mesa de jogos */
  poly(L, [p(1.9, 5.8), p(5.1, 5.8), p(5.1, 8.9), p(1.9, 8.9)], "tapete", "tapetel");
  for (let k = 0; k < 6; k++) poly(L, [p(1.9, 6.0 + k * 0.5), p(5.1, 6.0 + k * 0.5), p(5.1, 6.2 + k * 0.5), p(1.9, 6.2 + k * 0.5)], "tapete2");
  /* tapete mostarda na frente do sofá do canto, com a barra e um losango no meio */
  const ret = (a0: number, b0: number, a1: number, b1: number): Pt[] => [p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1)];
  poly(L, ret(10.85, 6.95, 12.05, 10.0), "almof1", "almofl", 1.5);
  poly(L, ret(11.0, 7.12, 11.9, 9.83), "almof0", "almofl", 0.9);
  poly(L, [p(11.45, 7.6), p(11.75, 8.47), p(11.45, 9.35), p(11.15, 8.47)], "almof2", "almofl", 0.9);
  /* quadro na parede da esquerda, entre o do Pedro e a porta de vidro: um sítio num dia de sol */
  naParede(L, "esq", 2.8, 4.6, 84, 132, "mad1", "madl", 2);
  naParede(L, "esq", 2.92, 4.48, 89, 127, "carta");
  naParede(L, "esq", 3.02, 4.38, 94, 122, "vidro");
  naParede(L, "esq", 3.02, 4.38, 94, 105, "grama");
  naParede(L, "esq", 3.45, 3.95, 105, 112, "grama2");
  const [qx, qy] = p(0, 3.3, 116);
  L.push({ t: "c", cx: qx, cy: qy, r: 3.5, f: "almof0" });
  return L;
}

/** Paisagem do janelão: céu, sol, morro e árvores (recortada pela moldura). */
function paisagem(): Forma[] {
  const L: Forma[] = [];
  /* o retângulo do vão na tela (vale para qualquer parede) */
  const xs = VAO_JANELA.map((v) => v[0]), ys = VAO_JANELA.map((v) => v[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys) - 40;
  L.push({ t: "r", x: x0 - 10, y: y0 - 10, w: x1 - x0 + 20, h: y1 - y0 + 60, f: "url-ceu" });
  L.push({ t: "c", cx: x0 + 40, cy: y0 + 40, r: 16, f: "sol" });
  L.push({ t: "e", cx: (x0 + x1) / 2, cy: y1 + 30, rx: (x1 - x0) * 0.8, ry: 85, f: "morro" });
  L.push({ t: "e", cx: x0 + 30, cy: y1 + 10, rx: 120, ry: 60, f: "morro2" });
  const arvore = (x: number, y: number, r: number, c1: string, c2: string) => {
    L.push({ t: "r", x: x - 3, y, w: 6, h: r * 1.3, f: "tronco2" });
    L.push({ t: "c", cx: x, cy: y - r * 0.2, r, f: c1 });
    L.push({ t: "c", cx: x - r * 0.55, cy: y + r * 0.15, r: r * 0.7, f: c2 });
    L.push({ t: "c", cx: x + r * 0.6, cy: y + r * 0.1, r: r * 0.72, f: c1 });
    L.push({ t: "c", cx: x - r * 0.1, cy: y - r * 0.75, r: r * 0.6, f: c2 });
  };
  arvore(x0 + 70, y0 + 95, 24, "folha0", "folha1");
  arvore(x0 + 115, y0 + 112, 18, "folha2", "folha3");
  arvore(x0 + 168, y0 + 128, 28, "folha0", "folha4");
  arvore(x1 - 40, y1 - 34, 20, "folha2", "folha3");
  arvore(x1 - 10, y1 - 12, 26, "folha0", "folha1");
  return L;
}

const PAREDES = paredes();
const ENFEITES = enfeites();
const PAISAGEM = paisagem();

/* ---------- móveis ---------- */
/* Redesenhados em 05/11/2026 para combinar com os bonecos (que são desenhos com contorno e sombra): madeira com
   veios, almofadas separadas com costura, pés de madeira, couro, ferro e coisas em cima das mesas. A base de cada
   móvel continua a mesma (MOVEIS), então ninguém fica preso e o assento continua na mesma altura. */

/** Traço reto entre dois pontos (costura, veio da madeira). */
const traco = (L: Forma[], a: Pt, b: Pt, s: string, sw = 0.9) => L.push({ t: "l", a, b, s, sw });

const TECIDOS = {
  colch: ["colch0", "colch1", "colch2", "colchl"],
  almof: ["almof0", "almof1", "almof2", "almofl"],
  couro: ["couro0", "couro1", "couro2", "courol"],
} as const;

/** Almofada: caixa com a quina bem arredondada e, nas grandes, a costura em volta do tampo. */
function almofada(L: Forma[], i: number, j: number, w: number, d: number, h: number, z: number, tecido: keyof typeof TECIDOS) {
  const [t, e, r, l] = TECIDOS[tecido];
  const ch = Math.min(0.09, w / 3, d / 3);
  caixa(L, i, j, w, d, h, t, e, r, z, l, ch);
  if (tecido !== "colch" || w < 0.3 || d < 0.3) return;
  const zt = z + h, m = 0.07;
  poly(L, [p(i + m, j + m, zt), p(i + w - ch - m, j + m, zt), p(i + w - ch - m, j + d - ch - m, zt), p(i + m, j + d - ch - m, zt)], undefined, "colchc", 0.9);
}

/** Sorteio fixo por móvel (a mesma semente desenha sempre os mesmos veios). */
const sorteio = (n: number) => () => (n = (n * 16807) % 2147483647) / 2147483647;

/** Veios da madeira nas duas faces de uma caixa (esquerda em j + d, direita em i + w): risquinhos deitados, de
    tamanhos e alturas variados, num tom mais escuro que a face. */
function veios(L: Forma[], i: number, j: number, w: number, d: number, z0: number, z1: number, semente: number) {
  const r = sorteio(semente);
  const linhas = Math.max(1, Math.floor((z1 - z0) / 4));
  for (let k = 0; k < linhas; k++) {
    const z = z0 + ((k + 0.5) * (z1 - z0)) / linhas + (r() - 0.5);
    const a = i + r() * w * 0.4, c = Math.min(i + w - 0.04, a + w * (0.3 + r() * 0.5));
    traco(L, p(a, j + d, z), p(c, j + d, z + (r() - 0.5) * 0.8), "madv", 0.8);
    const e = j + r() * d * 0.4, f = Math.min(j + d - 0.04, e + d * (0.3 + r() * 0.5));
    traco(L, p(i + w, e, z), p(i + w, f, z + (r() - 0.5) * 0.8), "madv", 0.8);
  }
}

/** Tampo de tábuas: n tábuas no sentido comprido, com uma fresta escura entre elas e os veios em cada uma. */
function tabuas(L: Forma[], i: number, j: number, w: number, d: number, z: number, h: number, n: number, semente: number) {
  const r = sorteio(semente);
  const fresta = 0.035;
  const comp = w >= d;
  const larg = ((comp ? d : w) - fresta * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    const o = k * (larg + fresta);
    const [ti, tj, tw, td] = comp ? [i, j + o, w, larg] : [i + o, j, larg, d];
    caixa(L, ti, tj, tw, td, h, "mad0", "mad1", "mad2", z, "madl");
    /* dois veios compridos e um nó de vez em quando */
    for (let v = 1; v <= 2; v++) {
      const q = v / 3 + (r() - 0.5) * 0.1;
      if (comp) traco(L, p(ti + 0.06 + r() * 0.2, tj + td * q, z + h), p(ti + tw - 0.1 - r() * 0.3, tj + td * q, z + h), "madv");
      else traco(L, p(ti + tw * q, tj + 0.06 + r() * 0.2, z + h), p(ti + tw * q, tj + td - 0.1 - r() * 0.3, z + h), "madv");
    }
    if (r() > 0.55) {
      const [x, y] = comp ? p(ti + 0.3 + r() * (tw - 0.6), tj + td / 2, z + h) : p(ti + tw / 2, tj + 0.3 + r() * (td - 0.6), z + h);
      L.push({ t: "e", cx: x, cy: y, rx: 2.2, ry: 1.1, f: "madv" });
    }
  }
}

/** Perna torneada (como balaústre): pé quadrado, a haste fina com dois anéis e o bojo no meio, e o bloco de cima. */
function perna(L: Forma[], ci: number, cj: number, z0: number, h: number, g = 0.07) {
  caixa(L, ci - g, cj - g, g * 2, g * 2, Math.min(4, h * 0.18), "mad0", "mad1", "mad2", z0, "madl");
  const b = z0 + Math.min(4, h * 0.18), t = z0 + h - Math.min(5, h * 0.2);
  const f = g * 0.6;
  caixa(L, ci - f, cj - f, f * 2, f * 2, t - b, "mad0", "mad1", "mad2", b, "madl");
  const [x, y] = p(ci + f * 0.2, cj + f * 0.2, b + (t - b) * 0.45);
  const rx = (g + f) * 32;
  L.push({ t: "e", cx: x, cy: y, rx, ry: Math.max(3, (t - b) * 0.2), f: "mad2", s: "madl", sw: 1.2 });
  L.push({ t: "e", cx: x - rx * 0.35, cy: y - 1, rx: rx * 0.25, ry: Math.max(1.4, (t - b) * 0.08), f: "mad0" });
  for (const z of [b + 1.5, t - 1.5]) {
    const [ax, ay] = p(ci, cj, z);
    L.push({ t: "e", cx: ax, cy: ay, rx: rx * 0.8, ry: 1.6, f: "mad1", s: "madl", sw: 1 });
  }
  caixa(L, ci - g, cj - g, g * 2, g * 2, z0 + h - t, "mad0", "mad1", "mad2", t, "madl");
}

/** Mesa de madeira no estilo rústico: pernas torneadas, a saia com veios e o tampo de tábuas separadas. */
function mesa(L: Forma[], m: Movel, h: number) {
  const { i, j, w, d } = m;
  const semente = Math.round((i * 31 + j * 17) * 100) + 7;
  for (const [a, b] of [[i + 0.16, j + 0.16], [i + w - 0.16, j + 0.16], [i + 0.16, j + d - 0.16], [i + w - 0.16, j + d - 0.16]]) perna(L, a, b, 0, h - 9, 0.08);
  caixa(L, i + 0.07, j + 0.07, w - 0.14, d - 0.14, 5, "mad0", "mad1", "mad2", h - 10, "madl");
  veios(L, i + 0.07, j + 0.07, w - 0.14, d - 0.14, h - 10, h - 5, semente);
  tabuas(L, i, j, w, d, h - 5, 5, Math.max(3, Math.round(Math.min(w, d) / 0.36)), semente + 3);
}
/** Caneca de café em cima da mesa (no ponto i, j, altura z). */
function caneca(L: Forma[], i: number, j: number, z: number) {
  const [x, y] = p(i, j, z);
  L.push({ t: "r", x: x + 2.5, y: y - 6.5, w: 3, h: 4, f: "caneca", s: "cartal", rx: 1.5 });
  L.push({ t: "r", x: x - 3.5, y: y - 8, w: 7, h: 8, f: "caneca", s: "cartal", rx: 1.2 });
  L.push({ t: "e", cx: x, cy: y - 8, rx: 3.5, ry: 1.7, f: "cafe" });
}
/** Prato raso. */
function prato(L: Forma[], i: number, j: number, z: number) {
  const [x, y] = p(i, j, z);
  L.push({ t: "e", cx: x, cy: y, rx: 7, ry: 3.5, f: "caneca", s: "cartal", sw: 0.8 });
  L.push({ t: "e", cx: x, cy: y, rx: 4.2, ry: 2, f: "carta" });
}
/** Vasinho com planta (em cima da mesa do lado). */
function vasinho(L: Forma[], i: number, j: number, z: number) {
  const [x, y] = p(i, j, z);
  L.push({ t: "r", x: x - 5, y: y - 9, w: 10, h: 9, f: "vaso", s: "madl", rx: 2 });
  for (const [dx, dy, r, f] of [[-5, -13, 4.5, "folhav2"], [5, -14, 4.5, "folhav2"], [-2, -18, 5, "folhav"], [3, -20, 4, "folhav"], [0, -13, 4, "folhav"]] as const)
    L.push({ t: "c", cx: x + dx, cy: y + dy, r, f });
}

/**
 * Sofá ou poltrona: pés de madeira, a estrutura de tecido, as almofadas do assento e do encosto separadas (com
 * costura) e uma almofada mostarda no canto. O encosto virado para a câmera (i1, j1) vai em `F`, a camada da frente,
 * por cima de quem está sentado. O assento termina na altura 15, como antes.
 */
function sofa(L: Forma[], m: Movel, encosto: "i0" | "i1" | "j1", F: Forma[] = L) {
  const { i, j, w, d } = m;
  const E = 0.3, B = 0.22, ZB = 3;
  const tecido = (lista: Forma[], a: number, b: number, ww: number, dd: number, h: number, z: number) =>
    caixa(lista, a, b, ww, dd, h, "colch0", "colch1", "colch2", z, "colchl");
  /* os pés: uma faixa de madeira escura embaixo de tudo */
  caixa(L, i + 0.04, j + 0.04, w - 0.08, d - 0.08, ZB, "madl", "mad1", "mad2", 0, "madl");
  /* almofadas em fila: no assento (deitadas) ou no encosto (em pé, finas) */
  const fila = (lista: Forma[], a: number, b: number, ww: number, dd: number, ao: "i" | "j", h: number, z: number) => {
    const len = ao === "j" ? dd : ww;
    const n = Math.max(1, Math.round(len / 1.05));
    const pedaco = len / n;
    for (let k = 0; k < n; k++)
      if (ao === "j") almofada(lista, a, b + k * pedaco + 0.025, ww, pedaco - 0.05, h, z, "colch");
      else almofada(lista, a + k * pedaco + 0.025, b, pedaco - 0.05, dd, h, z, "colch");
  };
  if (encosto === "i0") {
    tecido(L, i, j, E, d, 31, ZB);
    tecido(L, i + E, j, w - E, B, 21, ZB);
    tecido(L, i + E, j + B, w - E, d - 2 * B, 5, ZB);
    fila(L, i + E - 0.02, j + B, 0.16, d - 2 * B, "j", 18, 12);
    fila(L, i + E + 0.1, j + B, w - E - 0.12, d - 2 * B, "j", 7, 8);
    almofada(L, i + E + 0.14, j + d - B - 0.52, 0.14, 0.42, 12, 15, "almof");
    tecido(L, i + E, j + d - B, w - E, B, 21, ZB);
  } else if (encosto === "i1") {
    tecido(L, i, j, w - E, B, 21, ZB);
    tecido(L, i, j + B, w - E, d - 2 * B, 5, ZB);
    fila(L, i + 0.02, j + B, w - E - 0.12, d - 2 * B, "j", 7, 8);
    tecido(L, i, j + d - B, w - E, B, 21, ZB);
    almofada(F, i + w - E - 0.28, j + d - B - 0.52, 0.14, 0.42, 12, 15, "almof");
    fila(F, i + w - E - 0.14, j + B, 0.16, d - 2 * B, "j", 18, 12);
    tecido(F, i + w - E, j, E, d, 31, ZB);
  } else {
    tecido(L, i, j, B, d - E, 21, ZB);
    tecido(L, i + B, j, w - 2 * B, d - E, 5, ZB);
    fila(L, i + B, j + 0.02, w - 2 * B, d - E - 0.12, "i", 7, 8);
    tecido(L, i + w - B, j, B, d - E, 21, ZB);
    fila(F, i + B, j + d - E - 0.14, w - 2 * B, 0.16, "i", 18, 12);
    tecido(F, i, j + d - E, w, E, 31, ZB);
  }
}

/** Banquinho da mesa verde: 4 pernas de madeira e o assento de couro (em cima, na altura 19 como antes). */
function banco(L: Forma[], m: Movel) {
  const { i, j, w, d } = m;
  for (const [a, b] of [[i + 0.1, j + 0.1], [i + w - 0.1, j + 0.1], [i + 0.1, j + d - 0.1], [i + w - 0.1, j + d - 0.1]]) perna(L, a, b, 0, 12, 0.05);
  caixa(L, i + 0.02, j + 0.02, w - 0.04, d - 0.04, 3, "mad0", "mad1", "mad2", 12, "madl");
  almofada(L, i, j, w, d, 4, 15, "couro");
}

/** Ponto de um círculo deitado no piso (centro ci, cj, raio r, altura z). */
const roda = (ci: number, cj: number, r: number, z: number, n = 28): Pt[] =>
  Array.from({ length: n }, (_, k) => p(ci + r * Math.cos((2 * Math.PI * k) / n), cj + r * Math.sin((2 * Math.PI * k) / n), z));

const DESENHO: Record<string, (L: Forma[], m: Movel, F: Forma[]) => void> = {
  /* o baú dos Campeões Selados: madeira, tampa, duas cintas de ferro e a tranca dourada */
  bau: (L, { i, j, w, d }) => {
    caixa(L, i, j, w, d, 26, "mad2", "mad1", "mad2", 0, "madl");
    /* as tábuas do corpo (frestas deitadas) e os veios */
    for (const z of [9, 18]) {
      traco(L, p(i, j + d, z), p(i + w, j + d, z), "madl", 1.1);
      traco(L, p(i + w, j, z), p(i + w, j + d, z), "madl", 1.1);
    }
    veios(L, i, j, w, d, 1, 25, 41);
    caixa(L, i, j, w, d, 9, "mad0", "mad1", "mad2", 26, "madl");
    veios(L, i, j, w, d, 27, 34, 43);
    traco(L, p(i + w, j + 0.05, 26), p(i + w, j + d - 0.05, 26), "madl", 1.4);
    for (const b of [j + 0.32, j + d - 0.42])
      poly(L, [p(i + w, b, 0), p(i + w, b + 0.1, 0), p(i + w, b + 0.1, 33), p(i + w, b, 33)], "ferro", "ferrol", 1);
    for (const a of [i + 0.18, i + w - 0.28])
      poly(L, [p(a, j + d, 0), p(a + 0.1, j + d, 0), p(a + 0.1, j + d, 33), p(a, j + d, 33)], "ferro", "ferrol", 1);
    const frente = i + w, meio = j + d / 2;
    poly(L, [p(frente, meio - 0.11, 18), p(frente, meio + 0.11, 18), p(frente, meio + 0.11, 30), p(frente, meio - 0.11, 30)], "tranca", "madl", 1.2);
    const [x, y] = p(frente, meio, 22);
    L.push({ t: "r", x: x - 1, y: y - 1, w: 2, h: 4, f: "madl", rx: 1 });
  },
  /* churrasqueira de tijolo (05/11/2026, redesenhada): o corpo de tijolinho com o rejunte, o peitoril de concreto embaixo
     da boca, a boca escura com o fundo de tijolo e a grelha, a verga de concreto em cima, o lenheiro com as toras e a
     coifa afunilando até a chaminé. A boca continua de i + 0,35 a i + 1,85, da altura 22 a 70 (a brasa e a fumaça do
     churrasco, EventosTela, usam essas medidas). */
  churrasqueira: (L, m) => {
    const { i, j, w, d } = m;
    const f = j + d;
    caixa(L, i, j, w, d, 88, "tijr0", "tijr1", "tijr2", 0, "tijrl");
    /* rejunte: fiadas a cada 7 de altura, as juntas em pé desencontradas, na frente e no lado */
    for (let z = 7, n = 0; z < 88; z += 7, n++) {
      traco(L, p(i, f, z), p(i + w, f, z), "tijrj", 0.9);
      traco(L, p(i + w, j, z), p(i + w, f, z), "tijrj", 0.9);
      for (let a = (n % 2) * 0.14 + 0.07; a < w; a += 0.28) traco(L, p(i + a, f, z - 7), p(i + a, f, z), "tijrj", 0.9);
      for (let b = (n % 2) * 0.14 + 0.07; b < d; b += 0.28) traco(L, p(i + w, j + b, z - 7), p(i + w, j + b, z), "tijrj", 0.9);
    }
    /* o lenheiro embaixo, com as pontas das toras */
    poly(L, [p(i + 0.45, f, 3), p(i + 1.75, f, 3), p(i + 1.75, f, 15), p(i + 0.45, f, 15)], "boca", "tijrl", 1.2);
    for (const [a, z] of [[0.62, 6.5], [0.86, 6.5], [1.1, 6.5], [1.34, 6.5], [1.58, 6.5], [0.74, 11.5], [0.98, 11.5], [1.22, 11.5], [1.46, 11.5]] as const) {
      const [x, y] = p(i + a, f, z);
      L.push({ t: "e", cx: x, cy: y, rx: 4.6, ry: 4, f: "mad0", s: "madl", sw: 1 });
      L.push({ t: "e", cx: x, cy: y, rx: 1.6, ry: 1.4, f: "madv" });
    }
    /* o peitoril de concreto, saindo um pouco para a frente */
    caixa(L, i + 0.25, f - 0.02, 1.7, 0.12, 4, "concreto0", "concreto1", "concreto2", 18, "tijrl");
    /* a boca: escura, com o fundo de tijolo e a grelha com os espetos */
    poly(L, [p(i + 0.35, f, 22), p(i + 1.85, f, 22), p(i + 1.85, f, 70), p(i + 0.35, f, 70)], "boca", "tijrl", 1.5);
    poly(L, [p(i + 0.42, f, 22), p(i + 1.78, f, 22), p(i + 1.78, f, 64), p(i + 0.42, f, 64)], "tijr1");
    for (let z = 29; z < 64; z += 7) traco(L, p(i + 0.42, f, z), p(i + 1.78, f, z), "boca", 0.8);
    for (let k = 0; k < 4; k++) poly(L, [p(i + 0.4, f, 30 + k * 9), p(i + 1.8, f, 30 + k * 9), p(i + 1.8, f, 32 + k * 9), p(i + 0.4, f, 32 + k * 9)], "grelha");
    for (const a of [0.7, 1.05, 1.4]) traco(L, p(i + a, f, 40), p(i + a + 0.18, f, 46), "ferrol", 1.4);
    /* a verga de concreto em cima da boca */
    caixa(L, i + 0.28, f - 0.03, 1.64, 0.1, 7, "concreto0", "concreto1", "concreto2", 70, "tijrl");
    /* o tampo do corpo e a coifa afunilando até a chaminé */
    caixa(L, i - 0.04, j, w + 0.08, d + 0.04, 5, "concreto0", "concreto1", "concreto2", 88, "tijrl");
    caixa(L, i + 0.25, 0, 1.7, 0.82, 22, "tijr0", "tijr1", "tijr2", 93, "tijrl");
    caixa(L, i + 0.45, 0, 1.3, 0.6, 22, "tijr0", "tijr1", "tijr2", 115, "tijrl");
    caixa(L, i + 0.65, 0, 0.9, 0.45, WH - 137, "tijr0", "tijr1", "tijr2", 137, "tijrl");
    for (const [z0, z1, a0, a1, dd] of [[93, 115, 0.25, 1.95, 0.82], [115, 137, 0.45, 1.75, 0.6], [137, WH, 0.65, 1.55, 0.45]] as const)
      for (let z = z0 + 7; z < z1; z += 7) traco(L, p(i + a0, dd, z), p(i + a1, dd, z), "tijrj", 0.9);
  },
  /* balcão da cozinha: armário de madeira, tampo, pia e fogão de duas bocas */
  cozinha: (L, m) => {
    const { i, j, w, d } = m;
    caixa(L, i, j, w, d, 40, "bege0", "madeira", "madeira", 0, "madeiral");
    for (let b = j + 0.45; b < j + d; b += 0.45) poly(L, [p(i, b, 4), p(i, b, 36)], undefined, "madeiral");
    caixa(L, i, j, w, d, 3, "bege2", "bege1", "bege1", 40);
    poly(L, [p(i + 0.2, j + 0.15, 43), p(i + 0.75, j + 0.15, 43), p(i + 0.75, j + 0.75, 43), p(i + 0.2, j + 0.75, 43)], "gel1", "gell");
    caixa(L, i + 0.7, j + 0.4, 0.06, 0.06, 14, "gel2", "gel2", "gel2", 43, "gell");
    for (const b of [j + 1.05, j + 1.45]) poly(L, roda(i + 0.48, b, 0.14, 43, 14), "perna0");
  },
  geladeira: (L, m) => {
    caixa(L, m.i, m.j, m.w, m.d, 96, "gel0", "gel1", "gel2", 0, "gell", 0.08);
    poly(L, [p(m.i, m.j + m.d, 62), p(m.i + m.w, m.j + m.d, 62)], undefined, "gell");
    const [x, y] = p(m.i + 0.15, m.j + m.d, 70);
    L.push({ t: "r", x: x - 2, y: y - 6, w: 4, h: 22, f: "puxador", s: "gell", rx: 2 });
    const [x2, y2] = p(m.i + 0.15, m.j + m.d, 82);
    L.push({ t: "r", x: x2 - 2, y: y2 - 2, w: 4, h: 10, f: "puxador", s: "gell", rx: 2 });
    /* os ímãs de geladeira e um bilhetinho */
    for (const [a, z, f] of [[0.5, 50, "ima0"], [0.68, 44, "ima1"], [0.42, 36, "ima2"]] as const) {
      const [xi, yi] = p(m.i + a, m.j + m.d, z);
      L.push({ t: "r", x: xi - 2.5, y: yi - 2.5, w: 5, h: 5, f, rx: 1.5 });
    }
    const [xb, yb] = p(m.i + 0.62, m.j + m.d, 80);
    L.push({ t: "r", x: xb - 6, y: yb - 4, w: 12, h: 10, f: "carta", s: "cartal", rx: 1, rot: -4 });
    L.push({ t: "r", x: xb - 1.5, y: yb - 6, w: 3, h: 3, f: "ima0", rx: 1.5 });
  },
  "mesa-comprida": (L, m) => {
    mesa(L, m, 30);
    let k = 0;
    for (let a = m.i + 0.4; a < m.i + m.w - 0.2; a += 0.6, k++) {
      if (k % 3 === 1) caneca(L, a, m.j + 0.5, 30);
      else prato(L, a, m.j + 0.55, 30);
    }
  },
  "mesa-lado": (L, m) => {
    mesa(L, m, 30);
    vasinho(L, m.i + 0.75, m.j + m.d - 0.55, 30);
    caneca(L, m.i + 0.6, m.j + 0.6, 30);
  },
  /* mesa de jogos redonda com pano verde e as cartas do truco */
  "mesa-jogos": (L, m) => {
    const ci = m.i + m.w / 2, cj = m.j + m.d / 2, r = m.w / 2;
    /* pé em cruz, coluna de madeira, a borda de madeira e o feltro verde */
    caixa(L, ci - 0.45, cj - 0.07, 0.9, 0.14, 3, "mad1", "mad1", "mad2", 0, "madl");
    caixa(L, ci - 0.07, cj - 0.45, 0.14, 0.9, 3, "mad1", "mad1", "mad2", 0, "madl");
    perna(L, ci, cj, 3, 25, 0.13);
    poly(L, roda(ci, cj, r, 28), "mad1", "madl", 1.5);
    poly(L, roda(ci, cj, r, 31.5), "mad0", "madl", 1.5);
    poly(L, roda(ci, cj, r - 0.12, 32), "verde0", "verde1");
    poly(L, roda(ci, cj, r - 0.22, 32), undefined, "verde1", 0.8);
    /* as cartas no feltro ficam numa camada própria (FeltroTruco): as de enfeite ou as da partida em jogo */
    const [x, y] = p(ci - 0.4, cj + 0.45, 32);
    L.push({ t: "r", x: x - 3, y: y - 13, w: 6, h: 13, f: "grama2", rx: 2 });
  },
  /* banquinhos da mesa verde (fase 32): assento de madeira em 4 pernas */
  "banco-truco-0": banco,
  "banco-truco-1": banco,
  "banco-truco-2": banco,
  "banco-truco-3": banco,
  "sofa-parede": (L, m) => sofa(L, m, "i0"),
  "sofa-canto": (L, m, F) => sofa(L, m, "i1", F),
  "poltrona-1": (L, m, F) => sofa(L, m, "j1", F),
  "poltrona-2": (L, m, F) => sofa(L, m, "j1", F),
};

/* cada móvel desenhado uma vez: o corpo e, nos de ENCOSTO_NA_FRENTE, o encosto à parte */
const MOVEL_FORMAS: Record<string, Forma[]> = {};
const ENCOSTO_FORMAS: Record<string, Forma[]> = {};
for (const m of MOVEIS) {
  const L: Forma[] = [], F: Forma[] = [];
  DESENHO[m.id]?.(L, m, F);
  MOVEL_FORMAS[m.id] = L;
  if (F.length) ENCOSTO_FORMAS[m.id] = F;
}

/* ---------- desenho ---------- */
/* "url-ceu" = o degradê do céu (definido no <defs> do Fundo) */
const preenche = (f?: string) => (f === "url-ceu" ? { fill: "url(#hall-ceu)" } : {});
const cls = (f?: string, s?: string) => [f && f !== "url-ceu" && `f-${f}`, s && `s-${s}`].filter(Boolean).join(" ") || undefined;

function Formas({ lista }: { lista: Forma[] }) {
  return lista.map((d, k) => {
    switch (d.t) {
      case "p":
        return <polygon key={k} points={pts(d.q)} className={cls(d.f, d.s)} fill={d.f ? undefined : "none"} strokeWidth={d.s ? d.sw : undefined} />;
      case "e":
        return <ellipse key={k} cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry} className={cls(d.f, d.s)} strokeWidth={d.s ? d.sw : undefined} />;
      case "c":
        return <circle key={k} cx={d.cx} cy={d.cy} r={d.r} className={cls(d.f)} />;
      case "l":
        return <line key={k} x1={d.a[0]} y1={d.a[1]} x2={d.b[0]} y2={d.b[1]} className={cls(undefined, d.s)} strokeWidth={d.sw} />;
      case "r":
        return (
          <rect
            key={k}
            x={d.x}
            y={d.y}
            width={d.w}
            height={d.h}
            rx={d.rx}
            className={cls(d.f, d.s)}
            {...preenche(d.f)}
            transform={d.rot ? `rotate(${d.rot} ${d.x + d.w / 2} ${d.y + d.h / 2})` : undefined}
          />
        );
      case "txt":
        return (
          <text key={k} x={d.x} y={d.y} textAnchor="middle" className={cls(d.f)} transform={`rotate(${d.rot} ${d.x} ${d.y - 4})`}>
            {d.txt}
          </text>
        );
    }
  });
}

/** TV na parede da direita: apagada, ou com a imagem colorida quando alguém está ao vivo. */
function Tv({ aoVivo }: { aoVivo: boolean }) {
  const L: Forma[] = [];
  naParede(L, "dir", TA, TB, TZ0, TZ1, "tv", "tvl", 2);
  if (aoVivo) {
    naParede(L, "dir", TA + 0.08, TB - 0.08, TZ0 + 4, TZ1 - 4, "tela0");
    naParede(L, "dir", TA + 0.08, TB - 0.08, TZ1 - 22, TZ1 - 4, "tela1");
    naParede(L, "dir", (TA + TB) / 2 - 0.3, (TA + TB) / 2 + 0.3, TZ0 + 18, TZ0 + 36, "tela2");
  } else naParede(L, "dir", TA + 0.08, TB - 0.08, TZ0 + 4, TZ1 - 4, "telaoff");
  return <Formas lista={L} />;
}

/** Paredes, janelão, porta do banheiro, piso, tapete e o que fica pendurado (sempre atrás de tudo). */
export const Fundo = memo(function Fundo({ aoVivo, vb }: { aoVivo: boolean; vb: Caixa2D }) {
  return (
    <svg className="hall-camada hall-fundo" viewBox={viewBox(vb)} aria-hidden="true">
      <defs>
        <linearGradient id="hall-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="st-ceu0" />
          <stop offset=".7" className="st-ceu1" />
          <stop offset="1" className="st-ceu2" />
        </linearGradient>
        <clipPath id="hall-clip-janela">
          <polygon points={pts(VAO_JANELA)} />
        </clipPath>
      </defs>
      <g className="parede-esq">
        <Formas lista={TIJ_ESQ} />
      </g>
      <Formas lista={TIJ_DIR} />
      <Formas lista={PAREDES} />
      <g clipPath="url(#hall-clip-janela)">
        <Formas lista={PAISAGEM} />
      </g>
      <Formas lista={ENFEITES} />
      <SombrasMoveis />
      <Tv aoVivo={aoVivo} />
    </svg>
  );
});

/** Sombra de cada móvel no chão: a luz vem de cima à esquerda, então a sombra cai um pouco para a direita (o piso de
    cada móvel deslocado no sentido +i). Dura e achatada, sem desfoque. Fica no fundo, por baixo de todos os móveis. */
const SombrasMoveis = memo(function SombrasMoveis() {
  return (
    <g className="hall-sombras">
      {MOVEIS.map((m) => (
        <polygon key={m.id} points={pts([p(m.i + 0.12, m.j + 0.04), p(m.i + m.w + 0.16, m.j + 0.04), p(m.i + m.w + 0.16, m.j + m.d + 0.08), p(m.i + 0.12, m.j + m.d + 0.08)])} />
      ))}
    </g>
  );
});

/** Contorno branco no piso embaixo do mouse (camada logo acima do piso, abaixo dos móveis). */
export const Destaque = memo(function Destaque({ piso, vb, pisca }: { piso: Piso | null; vb: Caixa2D; pisca: number }) {
  if (!piso) return null;
  const { i, j } = piso;
  return (
    <svg className="hall-camada hall-destaque" viewBox={viewBox(vb)} aria-hidden="true">
      <polygon key={pisca} className={pisca ? "pisca" : undefined} points={pts([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)])} />
    </svg>
  );
});

/** Um móvel na sua camada (ou, com `encosto`, só o encosto da frente); `z` vem de `camadasHall`. */
export const MovelCamada = memo(function MovelCamada({ id, z, vb, encosto = false }: { id: string; z: number; vb: Caixa2D; encosto?: boolean }) {
  const formas = (encosto ? ENCOSTO_FORMAS : MOVEL_FORMAS)[id];
  if (!formas?.length) return null;
  return (
    <svg className="hall-camada" viewBox={viewBox(vb)} aria-hidden="true" style={{ zIndex: z }}>
      <Formas lista={formas} />
    </svg>
  );
});

/** Retângulo da TV em % do hall, para o botão invisível em cima dela. */
export function tvCaixa(vb: Caixa2D) {
  const [xb, ya] = p(TA, 0, TZ1); /* canto de cima, à esquerda */
  const [xa, yb] = p(TB, 0, TZ0); /* canto de baixo, à direita */
  return {
    left: ((xb - vb.x) / vb.w) * 100,
    top: ((ya - vb.y) / vb.h) * 100,
    width: ((xa - xb) / vb.w) * 100,
    height: ((yb - ya) / vb.h) * 100,
  };
}

/** Ponto (i, j, z) em % do hall: onde fica a ponta de baixo de uma placa. */
export function emPorcento(vb: Caixa2D, i: number, j: number, z: number) {
  const [x, y] = p(i, j, z);
  return { left: ((x - vb.x) / vb.w) * 100, top: ((y - vb.y) / vb.h) * 100 };
}

/* ---------- cartas no feltro da mesa verde (fase 32) ---------- */
const MESA_VERDE = MOVEIS.find((m) => m.id === "mesa-jogos")!;
const CV = { i: MESA_VERDE.i + MESA_VERDE.w / 2, j: MESA_VERDE.j + MESA_VERDE.d / 2 };
/** As 3 cartas de enfeite, quando não há partida. */
const ENFEITE: readonly [number, number, number][] = [[-0.3, -0.1, -14], [0.1, 0.2, 8], [0.35, -0.2, 22]];

/**
 * As cartas em cima da mesa verde, na camada logo depois dela. Sem partida, as 3 de enfeite (de frente); com
 * partida, as jogadas na mão, de verso, cada uma puxada para o lado de quem jogou (`cadeira` 0..3). Nunca a face.
 */
export const FeltroTruco = memo(function FeltroTruco({ z, vb, jogadas }: { z: number; vb: Caixa2D; jogadas: { cadeira: number; vaza: number }[] | null }) {
  const L: Forma[] = [];
  if (!jogadas)
    for (const [a, b, rot] of ENFEITE) {
      const [x, y] = p(CV.i + a, CV.j + b, 32);
      L.push({ t: "r", x: x - 6, y: y - 4, w: 12, h: 9, f: "carta", s: "cartal", rx: 1.5, rot });
    }
  else
    jogadas.forEach(({ cadeira, vaza }, k) => {
      /* frente (+j), direita (+i), fundo (−j), esquerda (−i) */
      const [di, dj] = [[0, 1], [1, 0], [0, -1], [-1, 0]][cadeira] ?? [0, 0];
      const [x, y] = p(CV.i + di * 0.42 + vaza * 0.05, CV.j + dj * 0.42 - vaza * 0.05, 32 + vaza);
      L.push({ t: "r", x: x - 6, y: y - 4, w: 12, h: 9, f: "cartaverso", s: "cartal", rx: 1.5, rot: (k * 37) % 30 - 15 });
    });
  return (
    <svg className="hall-camada" viewBox={viewBox(vb)} aria-hidden="true" style={{ zIndex: z }}>
      <Formas lista={L} />
    </svg>
  );
});
