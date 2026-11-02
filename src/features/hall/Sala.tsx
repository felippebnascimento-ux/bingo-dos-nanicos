/*
 * O cômodo do hall desenhado em SVG: paredes de tijolinho, piso de lajota e os móveis.
 * Geometria copiada de planejamento/demo/hall.html (`p()` = `tela`, `caixa()`, `naParede()`).
 * As cores são classes `f-<nome>` (preenchimento) e `s-<nome>` (traço), definidas em 22-hall.css.
 * Cada móvel é uma camada própria, para o boneco passar atrás e na frente dele.
 */
import { memo } from "react";
import { MOVEIS, NI, NJ, tela, VB, WH, type Movel } from "./hall";

type Pt = [number, number];
type Forma =
  | { t: "p"; q: Pt[]; f?: string; s?: string; sw?: number }
  | { t: "e"; cx: number; cy: number; rx: number; ry: number; f?: string; s?: string; sw?: number }
  | { t: "l"; a: Pt; b: Pt; s: string; sw: number }
  | { t: "r"; x: number; y: number; w: number; h: number; f: string; o?: number }
  | { t: "txt"; x: number; y: number; rot: number; txt: string; f: string };

export const VIEWBOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
const p = tela;

/* ---------- ajudantes (os mesmos do modelo, empurrando formas numa lista) ---------- */
const poly = (L: Forma[], q: Pt[], f?: string, s?: string, sw = 1) => L.push({ t: "p", q, f, s, sw });

/** Caixa isométrica: canto (i, j), w em i, d em j, altura h, base z. */
function caixa(L: Forma[], i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z = 0, linha = "madeiral") {
  poly(L, [p(i, j + d, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i, j + d, z + h)], esq, linha);
  poly(L, [p(i + w, j, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i + w, j, z + h)], dir, linha);
  poly(L, [p(i, j, z + h), p(i + w, j, z + h), p(i + w, j + d, z + h), p(i, j + d, z + h)], topo, linha);
}

/** Retângulo pintado numa parede: "dir" (j = 0, ao longo de i) ou "esq" (i = 0, ao longo de j). */
const naParede = (L: Forma[], lado: "dir" | "esq", a: number, b: number, z0: number, z1: number, f?: string, s?: string, sw?: number) =>
  lado === "dir"
    ? poly(L, [p(a, 0, z0), p(b, 0, z0), p(b, 0, z1), p(a, 0, z1)], f, s, sw)
    : poly(L, [p(0, a, z0), p(0, b, z0), p(0, b, z1), p(0, a, z1)], f, s, sw);

/* ---------- paredes ---------- */
let semente = 7;
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
      const cor = rnd() < 0.08 ? "tijv" : TIJ[Math.floor(rnd() * TIJ.length)];
      naParede(L, lado, a0 + 0.03, a1 - 0.03, z + 1, Math.min(WH, z + 8), cor);
    }
  return L;
}
const TIJ_ESQ = tijolos("esq", NJ);
const TIJ_DIR = tijolos("dir", NI);

function paredes(): Forma[] {
  const L: Forma[] = [];
  for (const lado of ["esq", "dir"] as const) {
    const n = lado === "dir" ? NI : NJ;
    /* faixa cinza (viga pintada), pilares e rodapé */
    naParede(L, lado, 0, n, 150, 162, lado === "dir" ? "viga" : "viga2", "vigal");
    for (const a of lado === "dir" ? [3.6, 7.9] : [3.8]) naParede(L, lado, a, a + 0.32, 0, WH, lado === "dir" ? "viga" : "viga2", "vigal");
    naParede(L, lado, 0, n, 0, 6, lado === "dir" ? "rodape" : "rodape2");
    /* beiral de madeira (forro inclinado) com a viga de tronco em cima */
    naParede(L, lado, 0, n, WH, WH + 34, lado === "dir" ? "beiral" : "beiral2", "ripa");
    for (let a = 0.35; a < n; a += 0.35) naParede(L, lado, a, a + 0.02, WH, WH + 34, "ripa");
    naParede(L, lado, 0, n, WH + 26, WH + 38, "tronco", "troncol");
  }
  /* quina das paredes */
  const [qx, qy] = p(0, 0);
  poly(L, [p(0, 0, 0), p(0, 0, WH + 38), [qx + 3, p(0, 0, WH + 38)[1]], [qx + 3, qy]], "quina");

  /* parede da esquerda: quadro de carros, porta de vidro para o gramado e janelas velhas penduradas */
  naParede(L, "esq", 3.0, 3.7, 95, 120, "quadro", "quadrol", 2);
  naParede(L, "esq", 3.05, 3.65, 98, 117, "ceu");
  naParede(L, "esq", 3.05, 3.65, 98, 104, "mato");
  naParede(L, "esq", 4.6, 6.8, 0, 140, "madeira", "madeiral", 3);
  naParede(L, "esq", 4.7, 6.7, 4, 136, "vidro");
  naParede(L, "esq", 4.7, 6.7, 4, 60, "grama");
  naParede(L, "esq", 5.2, 5.9, 60, 128, "grama2");
  naParede(L, "esq", 5.7, 5.74, 4, 136, "madeira");
  const janela = (lado: "dir" | "esq", a: number, b: number, z0: number, z1: number) => {
    naParede(L, lado, a, b, z0, z1, undefined, "janela", 4);
    naParede(L, lado, (a + b) / 2 - 0.02, (a + b) / 2 + 0.02, z0, z1, "janela");
    naParede(L, lado, a, b, (z0 + z1) / 2 - 1, (z0 + z1) / 2 + 1, "janela");
  };
  janela("esq", 1.2, 2.0, 170, 208);
  janela("esq", 2.4, 3.1, 170, 208);

  /* parede da direita: janelas, quadro com bandeirinhas, relógio e a porta de tábuas com a placa */
  for (const [a, b] of [[0.9, 1.8], [2.2, 3.0], [4.3, 5.2]]) janela("dir", a, b, 168, 210);
  naParede(L, "dir", 1.2, 2.9, 96, 128, "quadro2", "quadro2l", 2);
  naParede(L, "dir", 1.25, 2.85, 99, 125, "ceu2");
  naParede(L, "dir", 1.25, 2.85, 99, 108, "ceu3");
  ["bandv", "bandb", "banda"].forEach((cor, k) => naParede(L, "dir", 1.5 + k * 0.45, 1.75 + k * 0.45, 100, 106, cor));
  const [rx, ry] = p(4.6, 0, 128);
  L.push({ t: "e", cx: rx, cy: ry + 9, rx: 15, ry: 17, f: "relogio", s: "relogiol", sw: 3 });
  L.push({ t: "l", a: [rx, ry + 9], b: [rx + 1, ry - 2], s: "relogiol", sw: 2 });
  L.push({ t: "l", a: [rx, ry + 9], b: [rx + 8, ry + 11], s: "relogiol", sw: 2 });
  naParede(L, "dir", 8.25, 10.6, 0, 138, "tabua", "ripa", 2);
  for (let a = 8.45; a < 10.6; a += 0.22) naParede(L, "dir", a, a + 0.02, 0, 138, "ripa");
  naParede(L, "dir", 8.9, 10.0, 144, 160, "placa", "placal", 2);
  const [sx, sy] = p(9.45, 0, 151);
  L.push({ t: "txt", x: sx, y: sy + 4, rot: 26.6, txt: "K-FOFO 2018", f: "placat" });

  /* piso de lajota clara e o tapete listrado perto da porta */
  for (let i = 0; i < NI; i++)
    for (let j = 0; j < NJ; j++) poly(L, [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], (i + j) % 2 ? "piso0" : "piso1", "pisol");
  poly(L, [p(1.2, 4.4), p(3.2, 4.4), p(3.2, 7.4), p(1.2, 7.4)], "tapete", "tapetel");
  for (let k = 0; k < 6; k++) poly(L, [p(1.2, 4.6 + k * 0.5), p(3.2, 4.6 + k * 0.5), p(3.2, 4.8 + k * 0.5), p(1.2, 4.8 + k * 0.5)], "tapete2");
  return L;
}
const PAREDES = paredes();

/* ---------- móveis ---------- */
function colchao(L: Forma[], m: Movel) {
  caixa(L, m.i, m.j, m.w, m.d, 9, "colch0", "colch1", "colch2", 0, "colchl");
  for (let a = m.i + 0.3; a < m.i + m.w; a += 0.45)
    for (let b = m.j + 0.25; b < m.j + m.d; b += 0.4) {
      const [x, y] = p(a, b, 9);
      L.push({ t: "e", cx: x, cy: y, rx: 4, ry: 2, f: "colch1" });
    }
}

function mesa(L: Forma[], m: Movel, h: number, toalha: string, borda: string, borda2: string) {
  const { i, j, w, d } = m;
  for (const [a, b] of [[i + 0.1, j + 0.1], [i + w - 0.2, j + 0.1], [i + 0.1, j + d - 0.2], [i + w - 0.2, j + d - 0.2]])
    caixa(L, a, b, 0.1, 0.1, h - 4, "perna0", "perna1", "perna2");
  caixa(L, i, j, w, d, 4, toalha, borda, borda2, h - 4);
}

/** Cadeira de plástico branca; o encosto fica do lado de `vira`. */
function cadeira(L: Forma[], m: Movel, vira: "i" | "j") {
  const { i, j } = m;
  for (const [a, b] of [[i, j], [i + 0.5, j], [i, j + 0.5], [i + 0.5, j + 0.5]]) caixa(L, a, b, 0.08, 0.08, 22, "cad0", "cad1", "cad2", 0, "cadl");
  caixa(L, i, j, 0.58, 0.58, 3, "cad0", "cad3", "cad2", 22, "cadl");
  if (vira === "j") caixa(L, i, j, 0.58, 0.08, 26, "cad0", "cad3", "cad2", 25, "cadl");
  else caixa(L, i, j, 0.08, 0.58, 26, "cad0", "cad3", "cad2", 25, "cadl");
}

function churrasqueira(L: Forma[], m: Movel) {
  caixa(L, m.i, m.j, m.w, m.d, 88, "churr0", "churr1", "churr2");
  poly(L, [p(5.85, 1.1, 22), p(7.35, 1.1, 22), p(7.35, 1.1, 70), p(5.85, 1.1, 70)], "boca", "tvl");
  for (let k = 0; k < 4; k++) poly(L, [p(5.9, 1.1, 30 + k * 9), p(7.3, 1.1, 30 + k * 9), p(7.3, 1.1, 32 + k * 9), p(5.9, 1.1, 32 + k * 9)], "grelha");
  /* juntas dos tijolos */
  for (let z = 9; z < 88; z += 9) {
    if (z > 20 && z < 72) continue;
    poly(L, [p(5.5, 1.1, z), p(7.7, 1.1, z)], undefined, "junta1");
    poly(L, [p(7.7, 0, z), p(7.7, 1.1, z)], undefined, "junta2");
  }
  for (let z = 6; z < 60; z += 9) poly(L, [p(7.7, 0, z), p(7.7, 1.1, z)], undefined, "junta2");
  /* coifa */
  caixa(L, 5.8, 0, 1.6, 0.7, 60, "churr1", "churr1", "churr2", 88);
  for (let z = 97; z < 148; z += 9) {
    poly(L, [p(5.8, 0.7, z), p(7.4, 0.7, z)], undefined, "junta1");
    poly(L, [p(7.4, 0, z), p(7.4, 0.7, z)], undefined, "junta2");
  }
  caixa(L, 6.1, 0, 1.0, 0.45, WH - 148, "churr3", "churr3", "churr4", 148);
}

const DESENHO: Record<string, (L: Forma[], m: Movel) => void> = {
  churrasqueira,
  geladeira: (L, m) => {
    caixa(L, m.i, m.j, m.w, m.d, 92, "gel0", "gel1", "gel2", 0, "gell");
    poly(L, [p(m.i, m.j + m.d, 60), p(m.i + m.w, m.j + m.d, 60)], undefined, "gell");
  },
  freezer: (L, m) => caixa(L, m.i, m.j, m.w, m.d, 58, "gel0", "gel1", "gel2", 0, "gell"),
  "colchao-fundo": colchao,
  "colchao-frente": colchao,
  "cadeira-verde": (L, m) => cadeira(L, m, "j"),
  "cadeira-canto": (L, m) => cadeira(L, m, "i"),
  "cadeira-frente": (L, m) => cadeira(L, m, "j"),
  "mesa-verde": (L, m) => {
    mesa(L, m, 32, "verde0", "verde1", "verde2");
    const [x, y] = p(8.0, 3.6, 32);
    L.push({ t: "r", x: x - 4, y: y - 14, w: 7, h: 14, f: "grama2" });
    L.push({ t: "r", x: x + 8, y: y - 10, w: 6, h: 10, f: "tela2" });
  },
  "mesa-comprida": (L, m) => {
    mesa(L, m, 30, "bege0", "bege1", "bege2");
    for (let a = 3.4; a < 6.5; a += 0.5) {
      const [x, y] = p(a, 6.9, 30);
      L.push({ t: "e", cx: x, cy: y, rx: 3, ry: 3, f: "ponto" });
    }
    const [x, y] = p(4.4, 6.8, 30);
    L.push({ t: "r", x: x - 5, y: y - 20, w: 10, h: 20, f: "copo", o: 0.9 });
  },
};

const MOVEL_FORMAS: Record<string, Forma[]> = Object.fromEntries(
  MOVEIS.map((m) => {
    const L: Forma[] = [];
    DESENHO[m.id]?.(L, m);
    return [m.id, L];
  }),
);

/* ---------- desenho ---------- */
const cls = (f?: string, s?: string) => [f && `f-${f}`, s && `s-${s}`].filter(Boolean).join(" ") || undefined;
const pts = (q: Pt[]) => q.map((v) => v.join(",")).join(" ");

function Formas({ lista }: { lista: Forma[] }) {
  return lista.map((d, k) => {
    switch (d.t) {
      case "p":
        return <polygon key={k} points={pts(d.q)} className={cls(d.f, d.s)} fill={d.f ? undefined : "none"} strokeWidth={d.s ? d.sw : undefined} />;
      case "e":
        return <ellipse key={k} cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry} className={cls(d.f, d.s)} strokeWidth={d.s ? d.sw : undefined} />;
      case "l":
        return <line key={k} x1={d.a[0]} y1={d.a[1]} x2={d.b[0]} y2={d.b[1]} className={cls(undefined, d.s)} strokeWidth={d.sw} />;
      case "r":
        return <rect key={k} x={d.x} y={d.y} width={d.w} height={d.h} rx={2} className={cls(d.f)} opacity={d.o} />;
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
  naParede(L, "esq", 1.0, 2.7, 92, 148, "tv", "tvl", 2);
  if (aoVivo) {
    naParede(L, "esq", 1.08, 2.62, 96, 144, "tela0");
    naParede(L, "esq", 1.08, 2.62, 96, 112, "tela1");
    naParede(L, "esq", 1.6, 2.2, 110, 126, "tela2");
  } else naParede(L, "esq", 1.08, 2.62, 96, 144, "telaoff");
  return <Formas lista={L} />;
}

/** Paredes, piso, tapete e o que fica pendurado (sempre atrás de tudo). */
export const Fundo = memo(function Fundo({ aoVivo }: { aoVivo: boolean }) {
  return (
    <svg className="hall-camada hall-fundo" viewBox={VIEWBOX} aria-hidden="true">
      <g className="parede-esq">
        <Formas lista={TIJ_ESQ} />
      </g>
      <Formas lista={TIJ_DIR} />
      <Formas lista={PAREDES} />
      <Tv aoVivo={aoVivo} />
    </svg>
  );
});

/** Um móvel na sua camada; `z` vem da ordem de desenho (`ordemZ`). */
export const MovelCamada = memo(function MovelCamada({ id, z }: { id: string; z: number }) {
  return (
    <svg className="hall-camada" viewBox={VIEWBOX} aria-hidden="true" style={{ zIndex: z }}>
      <Formas lista={MOVEL_FORMAS[id] || []} />
    </svg>
  );
});

/** Retângulo da TV em % do hall, para o botão e o selo "AO VIVO". */
export const TV_CAIXA = (() => {
  const [xa, ya] = p(0, 1.0, 148); /* canto de cima, à direita */
  const [xb, yb] = p(0, 2.7, 92); /* canto de baixo, à esquerda */
  return {
    left: ((xb - VB.x) / VB.w) * 100,
    top: ((ya - VB.y) / VB.h) * 100,
    width: ((xa - xb) / VB.w) * 100,
    height: ((yb - ya) / VB.h) * 100,
  };
})();
