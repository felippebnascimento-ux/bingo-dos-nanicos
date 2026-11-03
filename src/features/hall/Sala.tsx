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

/** Caixa isométrica: canto (i, j), w em i, d em j, altura h, base z. */
function caixa(L: Forma[], i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z = 0, linha = "madeiral") {
  poly(L, [p(i, j + d, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i, j + d, z + h)], esq, linha);
  poly(L, [p(i + w, j, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i + w, j, z + h)], dir, linha);
  poly(L, [p(i, j, z + h), p(i + w, j, z + h), p(i + w, j + d, z + h), p(i, j + d, z + h)], topo, linha);
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

/* janelão no meio da parede do fundo (a da direita) */
const JA = 4.45, JB = 8.95, JZ0 = 52, JZ1 = 178;
const VAO_JANELA = naParedeP("dir", JA, JB, JZ0, JZ1);

function paredes(): Forma[] {
  const L: Forma[] = [];
  for (const lado of ["esq", "dir"] as const) {
    const n = lado === "dir" ? NI : NJ;
    /* faixa cinza (viga pintada), pilares e rodapé */
    naParede(L, lado, 0, n, 150, 162, lado === "dir" ? "viga" : "viga2", "vigal");
    for (const a of lado === "dir" ? [2.45, 9.5] : [4.6, 8.7]) naParede(L, lado, a, a + 0.32, 0, WH, lado === "dir" ? "viga" : "viga2", "vigal");
    naParede(L, lado, 0, n, 0, 6, lado === "dir" ? "rodape" : "rodape2");
    /* beiral de madeira (forro inclinado) com a viga de tronco em cima */
    naParede(L, lado, 0, n, WH, WH + 34, lado === "dir" ? "beiral" : "beiral2", "beiralb");
    for (let a = 0.35; a < n; a += 0.35) naParede(L, lado, a, a + 0.02, WH, WH + 34, "ripa");
    naParede(L, lado, 0, n, WH + 26, WH + 38, "tronco", "troncol");
  }
  const [qx, qy] = p(0, 0);
  poly(L, [p(0, 0, 0), p(0, 0, WH + 38), [qx + 3, p(0, 0, WH + 38)[1]], [qx + 3, qy]], "quina");
  /* moldura do janelão (a paisagem vem por cima, recortada) */
  naParede(L, "dir", JA - 0.12, JB + 0.12, JZ0 - 10, JZ1 + 10, "janela", "beiralb", 2);
  return L;
}

/** O que fica na frente da paisagem do janelão e nas paredes (desenhado depois dela). */
function enfeites(): Forma[] {
  const L: Forma[] = [];
  /* caixilho, peitoril e cortinas do janelão */
  for (const a of [JA + (JB - JA) / 3, JA + (2 * (JB - JA)) / 3]) naParede(L, "dir", a - 0.04, a + 0.04, JZ0, JZ1, "janela");
  naParede(L, "dir", JA, JB, (JZ0 + JZ1) / 2 - 2, (JZ0 + JZ1) / 2 + 2, "janela");
  naParede(L, "dir", JA - 0.2, JB + 0.2, JZ0 - 14, JZ0 - 8, "peitoril", "beiralb");
  naParede(L, "dir", JA - 0.42, JA - 0.14, JZ0 - 6, JZ1 + 16, "cortina", "cortinal");
  naParede(L, "dir", JB + 0.14, JB + 0.42, JZ0 - 6, JZ1 + 16, "cortina", "cortinal");

  /* parede da esquerda: suporte da TV, porta de vidro e janelas velhas (entre a TV e a porta fica o
     quadro dos troféus, numa camada própria: QuadroTrofeus.tsx) */
  naParede(L, "esq", 2.0, 2.12, 58, 90, "suporte");
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
  poly(L, [p(JA + 0.6, 0), p(JB + 0.9, 0), p(JB + 2.2, 3.2), p(JA + 1.6, 3.2)], "solchao");
  /* tapete listrado embaixo da mesa de jogos */
  poly(L, [p(1.9, 5.8), p(5.1, 5.8), p(5.1, 8.9), p(1.9, 8.9)], "tapete", "tapetel");
  for (let k = 0; k < 6; k++) poly(L, [p(1.9, 6.0 + k * 0.5), p(5.1, 6.0 + k * 0.5), p(5.1, 6.2 + k * 0.5), p(1.9, 6.2 + k * 0.5)], "tapete2");
  return L;
}

/** Paisagem do janelão: céu, sol, morro e árvores (recortada pela moldura). */
function paisagem(): Forma[] {
  const L: Forma[] = [];
  const [x0, y0] = p(JA, 0, JZ1 + 10);
  const [x1, y1] = p(JB, 0, JZ0 - 10);
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
function mesa(L: Forma[], m: Movel, h: number, toalha: string, borda: string, borda2: string) {
  const { i, j, w, d } = m;
  for (const [a, b] of [[i + 0.1, j + 0.1], [i + w - 0.2, j + 0.1], [i + 0.1, j + d - 0.2], [i + w - 0.2, j + d - 0.2]])
    caixa(L, a, b, 0.1, 0.1, h - 4, "perna0", "perna1", "perna2");
  caixa(L, i, j, w, d, 4, toalha, borda, borda2, h - 4);
}

/**
 * Sofá ou poltrona de tecido azul: assento, encosto do lado `encosto` e braços nas outras pontas.
 * O encosto virado para a câmera (i1, j1) vai em `F`, a camada da frente, por cima de quem está sentado.
 */
function sofa(L: Forma[], m: Movel, encosto: "i0" | "i1" | "j1", F: Forma[] = L) {
  const { i, j, w, d } = m;
  const E = 0.3, B = 0.22;
  const cx = (a: number, b: number, ww: number, dd: number, h: number, z = 0, lista = L) => caixa(lista, a, b, ww, dd, h, "colch0", "colch1", "colch2", z, "colchl");
  if (encosto === "j1") {
    cx(i, j, B, d - E, 24);
    cx(i + B, j, w - 2 * B, d - E, 15);
    cx(i + w - B, j, B, d - E, 24);
    cx(i, j + d - E, w, E, 36, 0, F);
  } else {
    const a0 = encosto === "i0" ? i + E : i;
    if (encosto === "i0") cx(i, j, E, d, 36);
    cx(a0, j, w - E, B, 24);
    cx(a0, j + B, w - E, d - 2 * B, 15);
    cx(a0, j + d - B, w - E, B, 24);
    if (encosto === "i1") cx(i + w - E, j, E, d, 36, 0, F);
  }
}

/** Banquinho da mesa verde: 4 pernas e o assento a 18 de altura. */
function banco(L: Forma[], m: Movel) {
  const { i, j, w, d } = m;
  for (const [a, b] of [[i + 0.06, j + 0.06], [i + w - 0.14, j + 0.06], [i + 0.06, j + d - 0.14], [i + w - 0.14, j + d - 0.14]])
    caixa(L, a, b, 0.08, 0.08, 15, "perna0", "perna1", "perna2");
  caixa(L, i, j, w, d, 4, "bege1", "madeira", "madeira", 15);
}

/** Ponto de um círculo deitado no piso (centro ci, cj, raio r, altura z). */
const roda = (ci: number, cj: number, r: number, z: number, n = 28): Pt[] =>
  Array.from({ length: n }, (_, k) => p(ci + r * Math.cos((2 * Math.PI * k) / n), cj + r * Math.sin((2 * Math.PI * k) / n), z));

const DESENHO: Record<string, (L: Forma[], m: Movel, F: Forma[]) => void> = {
  churrasqueira: (L, m) => {
    const { i, j, w, d } = m;
    caixa(L, i, j, w, d, 88, "churr0", "churr1", "churr2");
    const f = j + d;
    poly(L, [p(i + 0.35, f, 22), p(i + 1.85, f, 22), p(i + 1.85, f, 70), p(i + 0.35, f, 70)], "boca", "tvl");
    for (let k = 0; k < 4; k++) poly(L, [p(i + 0.4, f, 30 + k * 9), p(i + 1.8, f, 30 + k * 9), p(i + 1.8, f, 32 + k * 9), p(i + 0.4, f, 32 + k * 9)], "grelha");
    caixa(L, i + 0.3, 0, 1.6, 0.7, 60, "churr1", "churr1", "churr2", 88);
    caixa(L, i + 0.6, 0, 1.0, 0.45, WH - 148, "churr3", "churr3", "churr4", 148);
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
    caixa(L, m.i, m.j, m.w, m.d, 96, "gel0", "gel1", "gel2", 0, "gell");
    poly(L, [p(m.i, m.j + m.d, 62), p(m.i + m.w, m.j + m.d, 62)], undefined, "gell");
    const [x, y] = p(m.i + 0.15, m.j + m.d, 70);
    L.push({ t: "r", x: x - 2, y: y - 6, w: 4, h: 22, f: "puxador", rx: 2 });
  },
  "mesa-comprida": (L, m) => {
    mesa(L, m, 30, "bege0", "bege1", "bege2");
    for (let a = m.i + 0.4; a < m.i + m.w - 0.2; a += 0.6) {
      const [x, y] = p(a, m.j + 0.55, 30);
      L.push({ t: "e", cx: x, cy: y, rx: 3, ry: 3, f: "ponto" });
    }
  },
  "mesa-lado": (L, m) => mesa(L, m, 30, "bege0", "bege1", "bege2"),
  /* mesa de jogos redonda com pano verde e as cartas do truco */
  "mesa-jogos": (L, m) => {
    const ci = m.i + m.w / 2, cj = m.j + m.d / 2, r = m.w / 2;
    caixa(L, ci - 0.12, cj - 0.12, 0.24, 0.24, 28, "perna0", "perna1", "perna2");
    poly(L, roda(ci, cj, 0.55, 0), "perna1");
    poly(L, roda(ci, cj, r, 28), "verde1", "verde1");
    poly(L, roda(ci, cj, r, 32), "verde0", "verde1");
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

/** TV na parede da esquerda: apagada, ou com a imagem colorida quando alguém está ao vivo. */
function Tv({ aoVivo }: { aoVivo: boolean }) {
  const L: Forma[] = [];
  naParede(L, "esq", 1.1, 3.0, 90, 150, "tv", "tvl", 2);
  if (aoVivo) {
    naParede(L, "esq", 1.18, 2.92, 94, 146, "tela0");
    naParede(L, "esq", 1.18, 2.92, 94, 112, "tela1");
    naParede(L, "esq", 1.75, 2.35, 110, 128, "tela2");
  } else naParede(L, "esq", 1.18, 2.92, 94, 146, "telaoff");
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
      <Tv aoVivo={aoVivo} />
    </svg>
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
  const [xa, ya] = p(0, 1.1, 150); /* canto de cima, à direita */
  const [xb, yb] = p(0, 3.0, 90); /* canto de baixo, à esquerda */
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
