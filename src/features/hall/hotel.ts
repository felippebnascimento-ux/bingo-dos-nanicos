/*
 * O boneco do Nanico Hotel (pacote de 05/11/2026, `public/arte/hotel/<slug>.webp`): um atlas por nanico com 40 desenhos
 * numa grade de 5 colunas × 8 linhas (célula de 256 × 256, o pé em 128, 240), e 16 ações em 4 direções. As direções da
 * direita (SE, NE) são o espelho das da esquerda (SW, NW), como no andar de antes. Regra pura e testada: qual desenho
 * mostrar para a ação, o sentido e o instante; Boneco.tsx (K-FOFO) e QuartoCena.tsx (quartos) só desenham.
 * Os índices e tempos são os do `avatar.json` do pacote (iguais nos 15 nanicos).
 */
import type { Sentido } from "./hall";

/** o atlas: colunas, linhas e o tamanho de cada célula (px da imagem) */
export const HOTEL_COLS = 5;
export const HOTEL_LINHAS = 8;
export const HOTEL_CEL = 256;
/** o pé dentro da célula (px da imagem) */
export const HOTEL_PE = { x: 128, y: 240 } as const;
/** quanto vale 1 px do atlas nas medidas do código (o corpo de 208 px vira ~125, a altura dos bonecos de antes) */
export const HOTEL_ESC = 0.6;

export type AcaoHotel =
  | "idle"
  | "walk"
  | "sit"
  | "drink"
  | "smoke"
  | "hold"
  | "wave"
  | "clap"
  | "cheer"
  | "point"
  | "phone"
  | "dance"
  | "laugh"
  | "eat"
  | "lie"
  | "sleep";

type Anim = { frente: readonly number[]; costas: readonly number[]; ms: number; loop: boolean };
/* frente = SW (e SE espelhado); costas = NW (e NE espelhado) */
const ANIM: Readonly<Record<AcaoHotel, Anim>> = {
  idle: { frente: [1], costas: [3], ms: 800, loop: true },
  walk: { frente: [5, 1, 6, 1], costas: [7, 3, 8, 3], ms: 120, loop: true },
  sit: { frente: [9], costas: [10], ms: 900, loop: true },
  drink: { frente: [11, 12, 12, 11], costas: [26, 27, 27, 26], ms: 280, loop: false },
  smoke: { frente: [13, 14, 14, 13], costas: [28, 29, 29, 28], ms: 360, loop: false },
  hold: { frente: [11], costas: [26], ms: 900, loop: true },
  wave: { frente: [1, 15, 15, 1], costas: [25, 30, 30, 25], ms: 220, loop: false },
  clap: { frente: [1, 16, 1, 16, 1, 16], costas: [25, 31, 25, 31, 25, 31], ms: 140, loop: false },
  cheer: { frente: [1, 17, 17, 1], costas: [25, 32, 32, 25], ms: 260, loop: false },
  point: { frente: [1, 18, 18, 1], costas: [25, 33, 33, 25], ms: 260, loop: false },
  phone: { frente: [19], costas: [34], ms: 1000, loop: true },
  dance: { frente: [20, 21], costas: [35, 36], ms: 260, loop: true },
  laugh: { frente: [1, 22, 22, 1], costas: [25, 37, 37, 25], ms: 200, loop: false },
  eat: { frente: [11, 23, 23, 11], costas: [26, 38, 38, 26], ms: 260, loop: false },
  lie: { frente: [24], costas: [39], ms: 1000, loop: true },
  sleep: { frente: [24], costas: [39], ms: 1000, loop: true },
};

/** o lado do sentido do site: de costas (NW/NE) ou de frente (SW/SE), e se espelha (SE/NE, os da direita) */
export function direcaoHotel(s: Sentido) {
  return { costas: s.startsWith("costas"), espelha: s.endsWith("direita") };
}

/**
 * As ações do site (acoes.ts e o sentar dos assentos) no pacote. As de uma vez só (acenar, rir…) repetem enquanto
 * a ação dura no site: no pacote elas param no fim, aqui o boneco segue o gesto até a ação acabar.
 */
export const ACAO_DO_SITE: Readonly<Record<string, AcaoHotel>> = {
  sentar: "sit",
  acena: "wave",
  danca: "dance",
  deita: "lie",
  ri: "laugh",
  joinha: "point",
  pula: "cheer",
  chao: "sit",
  aplaude: "clap",
  celular: "phone",
  dorme: "sleep",
};

/** Os quadros e o tempo de cada um da ação no lado (de frente ou de costas). */
export const sequenciaHotel = (acao: AcaoHotel, costas: boolean) => {
  const a = ANIM[acao];
  return { q: costas ? a.costas : a.frente, ms: a.ms, loop: a.loop };
};

/** O desenho (coluna e linha do atlas) da ação no instante `t` (ms desde o começo dela). Fora do loop, repete. */
export function quadroHotel(acao: AcaoHotel, costas: boolean, t: number) {
  const s = sequenciaHotel(acao, costas);
  const k = s.q.length === 1 ? 0 : Math.floor(Math.max(0, t) / s.ms) % s.q.length;
  const i = s.q[k];
  return { col: i % HOTEL_COLS, lin: Math.floor(i / HOTEL_COLS) };
}

/** O desenho do andar pelo passo do site (`quadro` 1 a 4, contado pela distância andada; bonecos.ts). */
export function quadroAndando(costas: boolean, quadro: number) {
  const q = costas ? ANIM.walk.costas : ANIM.walk.frente;
  const i = q[(((quadro - 1) % 4) + 4) % 4];
  return { col: i % HOTEL_COLS, lin: Math.floor(i / HOTEL_COLS) };
}

/** background-position (em %) de uma célula do atlas. */
export const posicaoHotel = ({ col, lin }: { col: number; lin: number }) =>
  `${(col / (HOTEL_COLS - 1)) * 100}% ${(lin / (HOTEL_LINHAS - 1)) * 100}%`;

/* ---------- consumíveis na mão (loja/consumoSala.ts) ---------- */
export type Consumindo = "drink" | "smoke" | "eat";
const COMIDA: ReadonlySet<string> = new Set(["pipoca", "pizza", "acai"]);
/** O jeito de consumir o item: fumar (cigarrinho, charuto, palheiro), comer (pipoca, pizza, açaí) ou beber (o resto). */
export const jeitoDeConsumir = (anim: string, item: string): Consumindo =>
  anim === "fumar" || anim === "charuto" ? "smoke" : COMIDA.has(item) ? "eat" : "drink";

/** Um ciclo do consumo: segura o item e, no fim, leva à boca (um gole, um trago, uma mordida). */
export const CICLO_CONSUMO = 5200;
export const NA_BOCA = 1300;
/* [segurando, na boca] de frente e de costas */
const QUADROS_CONSUMO: Readonly<Record<Consumindo, { frente: readonly [number, number]; costas: readonly [number, number] }>> = {
  drink: { frente: [11, 12], costas: [26, 27] },
  smoke: { frente: [13, 14], costas: [28, 29] },
  eat: { frente: [11, 23], costas: [26, 38] },
};
/** a mão em cada desenho do consumo (px da célula, num boneco de altura normal; do pacote) */
const MAO: Readonly<Record<number, readonly [number, number]>> = {
  11: [111, 135], 12: [112, 86], 13: [115, 123], 14: [118, 86], 23: [115, 89],
  26: [113, 134], 27: [113, 84], 28: [114, 121], 29: [119, 85], 38: [116, 88],
};

/** O desenho do consumo no instante `t` (ms desde o começo) e onde fica a mão (px da célula). `altura` = 0,8 no pin. */
export function quadroConsumo(tipo: Consumindo, costas: boolean, t: number, altura = 1) {
  const c = ((Math.max(0, t) % CICLO_CONSUMO) + CICLO_CONSUMO) % CICLO_CONSUMO;
  const [segura, boca] = costas ? QUADROS_CONSUMO[tipo].costas : QUADROS_CONSUMO[tipo].frente;
  const i = c >= CICLO_CONSUMO - NA_BOCA ? boca : segura;
  const m = MAO[i];
  return {
    col: i % HOTEL_COLS,
    lin: Math.floor(i / HOTEL_COLS),
    naBoca: i === boca,
    mao: [HOTEL_PE.x + (m[0] - HOTEL_PE.x) * altura, HOTEL_PE.y + (m[1] - HOTEL_PE.y) * altura] as const,
  };
}

/** A altura do boneco no atlas (o pin é o único mais baixo; o desenho já vem menor, isso só acerta a mão). */
export const alturaHotel = (atlas: string | null) => (atlas?.endsWith("/pin.webp") ? 0.8 : 1);
