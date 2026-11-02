/*
 * Hall do Sítio do Mitz: a grade do piso, os móveis, o caminho dos bonecos e a ordem de desenho.
 * Regra pura (sem React), usada pela tela, pelo movimento e pela sala (`cleanPresence`).
 * A geometria é a do modelo em planejamento/demo/hall-v2.html (sala de 14×11).
 */

/** Grade do piso: `i` corre ao longo da parede da direita, `j` ao longo da parede da esquerda. */
export const NI = 14;
export const NJ = 11;
/** Origem, meia largura e meia altura do piso na tela, e altura das paredes (unidades do SVG). */
export const X0 = 700;
export const Y0 = 318;
export const TW = 40;
export const TH = 20;
export const WH = 215;
export type Caixa2D = { x: number; y: number; w: number; h: number };
/**
 * Parte do SVG que aparece. Na tela larga sobra espaço em volta do cômodo para os cantos
 * (quem está na sala, ganhos, carteira); no celular, o cômodo ocupa tudo e os cantos vão para fora.
 */
export const VB_LARGO: Caixa2D = { x: 0, y: 10, w: 1400, h: 860 };
export const VB_ESTREITO: Caixa2D = { x: 240, y: 50, w: 1040, h: 790 };

export type Piso = { i: number; j: number };
export type Sentido = "frente-direita" | "frente-esquerda" | "costas-direita" | "costas-esquerda";

/** Ponto na tela de uma posição do piso (`z` = altura). É a `p()` do modelo. */
export const tela = (i: number, j: number, z = 0): [number, number] => [X0 + (i - j) * TW, Y0 + (i + j) * TH - z];

/** Piso embaixo de um ponto da tela, ou null fora da grade. */
export function pisoNaTela(x: number, y: number): Piso | null {
  const a = (x - X0) / TW;
  const b = (y - Y0) / TH;
  const i = Math.floor((a + b) / 2);
  const j = Math.floor((b - a) / 2);
  return i >= 0 && i < NI && j >= 0 && j < NJ ? { i, j } : null;
}

/** Móvel no chão: canto (i, j) e tamanho (w em i, d em j). Serve para bloquear o piso e para a ordem de desenho. */
export type Movel = { id: string; i: number; j: number; w: number; d: number };

/* Disposição da planta do grupo (02/11/2026), vista de cima: a parede de cima é a da direita (j = 0), com o
   banheiro, o janelão e a churrasqueira no canto; a da esquerda (i = 0) tem o sofá; a cozinha fica encostada
   do lado direito (i = 14) e a entrada é o vão na parede da frente (j = 11). */
export const MOVEIS: readonly Movel[] = [
  { id: "churrasqueira", i: 10.8, j: 0, w: 2.2, d: 1.1 },
  /* cozinha: balcão com pia e fogão, e a geladeira (que é a Loja) na ponta */
  { id: "cozinha", i: 13.05, j: 1.3, w: 0.95, d: 1.75 },
  { id: "geladeira", i: 13.05, j: 3.05, w: 0.95, d: 0.95 },
  { id: "mesa-comprida", i: 3.6, j: 2.8, w: 6.9, d: 1.1 },
  { id: "mesa-jogos", i: 2.5, j: 6.3, w: 2.0, d: 2.0 },
  { id: "mesa-lado", i: 9.1, j: 6.1, w: 1.5, d: 2.8 },
  { id: "sofa-parede", i: 0, j: 6.3, w: 1.05, d: 3.3 },
  { id: "sofa-canto", i: 12.2, j: 7.0, w: 1.75, d: 3.0 },
  { id: "poltrona-1", i: 2.1, j: 9.7, w: 1.0, d: 1.1 },
  { id: "poltrona-2", i: 3.6, j: 9.7, w: 1.0, d: 1.1 },
];

/** Móveis que abrem alguma coisa, e o ponto (i, j, z) onde fica a placa com o nome. */
export type Clicavel = { id: "tv" | "truco" | "loja" | "salas" | "trofeus"; rotulo: { i: number; j: number; z: number } };
export const CLICAVEIS: readonly Clicavel[] = [
  /* a porta de vidro leva às salas tipo lan house (fase 05) */
  { id: "salas", rotulo: { i: 0, j: 5.6, z: 150 } },
  { id: "tv", rotulo: { i: 0, j: 2.05, z: 160 } },
  /* o quadro dos troféus da semana (fase 21), entre a TV e a porta de vidro */
  { id: "trofeus", rotulo: { i: 0, j: 3.85, z: 160 } },
  /* a mesa de jogos redonda abre o Truco */
  { id: "truco", rotulo: { i: 3.5, j: 7.3, z: 62 } },
  { id: "loja", rotulo: { i: 13.5, j: 4.0, z: 118 } },
];

/** A churrasqueira (a brasa, a fumaça e a placa do churrasco ficam na boca dela, na face j = j + d). */
export const CHURRASQUEIRA = MOVEIS.find((m) => m.id === "churrasqueira")!;

/** Quanto do intervalo [a, a+w] cai dentro do piso k. */
const sobra = (a: number, w: number, k: number) => Math.max(0, Math.min(a + w, k + 1) - Math.max(a, k));

const chave = (i: number, j: number) => `${i},${j}`;

/** Pisos ocupados: o móvel cobre pelo menos metade do piso nas duas direções. */
export const BLOQUEADOS: ReadonlySet<string> = new Set(
  MOVEIS.flatMap((m) => {
    const out: string[] = [];
    for (let i = 0; i < NI; i++)
      for (let j = 0; j < NJ; j++) if (sobra(m.i, m.w, i) >= 0.5 && sobra(m.j, m.d, j) >= 0.5) out.push(chave(i, j));
    return out;
  }),
);

export const livre = (i: number, j: number) => i >= 0 && i < NI && j >= 0 && j < NJ && !BLOQUEADOS.has(chave(i, j));

/** Piso livre embaixo de um ponto da tela (para o destaque do mouse), ou null. */
export function pisoLivreNaTela(x: number, y: number): Piso | null {
  const p = pisoNaTela(x, y);
  return p && livre(p.i, p.j) ? p : null;
}

/** Confere uma posição vinda da sala: `{i, j}` inteiros, dentro da grade e fora dos móveis. */
export function posValida(v: unknown): v is Piso {
  if (!v || typeof v !== "object") return false;
  const { i, j } = v as Record<string, unknown>;
  return Number.isInteger(i) && Number.isInteger(j) && livre(i as number, j as number);
}

/* ---------- assentos: sofás e poltronas ---------- */
/**
 * Um lugar para sentar: o centro do assento (i, j, fracionários, em cima do móvel), o piso livre de onde
 * a pessoa senta (`chegar`, que é o `pos` dela) e para onde o boneco olha sentado.
 */
export type Assento = { id: string; i: number; j: number; chegar: Piso; olha: Sentido };
export const ASSENTOS: readonly Assento[] = [
  /* sofá na parede da esquerda: encosto na parede, olha para a sala */
  { id: "sofa-a", i: 0.62, j: 7.0, chegar: { i: 1, j: 7 }, olha: "frente-direita" },
  { id: "sofa-b", i: 0.62, j: 8.0, chegar: { i: 1, j: 8 }, olha: "frente-direita" },
  { id: "sofa-c", i: 0.62, j: 9.0, chegar: { i: 1, j: 9 }, olha: "frente-direita" },
  /* sofá do canto: encosto do lado da cozinha */
  { id: "canto-a", i: 12.95, j: 7.7, chegar: { i: 11, j: 7 }, olha: "costas-esquerda" },
  { id: "canto-b", i: 12.95, j: 8.6, chegar: { i: 11, j: 8 }, olha: "costas-esquerda" },
  { id: "canto-c", i: 12.95, j: 9.5, chegar: { i: 11, j: 9 }, olha: "costas-esquerda" },
  /* as duas poltronas da frente */
  { id: "poltrona-1", i: 2.6, j: 10.15, chegar: { i: 2, j: 9 }, olha: "costas-direita" },
  { id: "poltrona-2", i: 4.1, j: 10.15, chegar: { i: 4, j: 9 }, olha: "costas-direita" },
];
export const assentoDe = (id: unknown) => (typeof id === "string" ? (ASSENTOS.find((a) => a.id === id) ?? null) : null);

/** Posição no hall: o piso e, se estiver sentado, o assento (só vale um assento que sai daquele piso). */
export type PosHall = Piso & { s?: string };
export function posHall(v: unknown): PosHall | null {
  if (!posValida(v)) return null;
  const a = assentoDe((v as { s?: unknown }).s);
  return a && a.chegar.i === v.i && a.chegar.j === v.j ? { i: v.i, j: v.j, s: a.id } : { i: v.i, j: v.j };
}

/** O assento embaixo de um ponto da tela (tocar no sofá ou na poltrona), ou null. */
export function assentoNaTela(x: number, y: number): Assento | null {
  const a = (x - X0) / TW, b = (y - Y0) / TH;
  /* o ponto no chão (contínuo) e um pouco acima, porque o toque costuma cair no encosto ou no assento */
  let melhor: Assento | null = null, dMin = 1.1;
  for (const z of [0, 0.6]) {
    const i = (a + b + z) / 2, j = (b - a + z) / 2;
    for (const s of ASSENTOS) {
      const d = Math.hypot(s.i - i, s.j - j);
      if (d < dMin) {
        dMin = d;
        melhor = s;
      }
    }
  }
  return melhor;
}

/** Vizinhos só em ±i e ±j: assim todo passo é numa das 4 diagonais da tela. */
const PASSOS: readonly Piso[] = [
  { i: 1, j: 0 },
  { i: 0, j: 1 },
  { i: -1, j: 0 },
  { i: 0, j: -1 },
];

/** Menor caminho de `de` até `para` (os dois inclusos), desviando dos móveis. `[]` se não dá para chegar. */
export function caminho(de: Piso, para: Piso): Piso[] {
  if (!livre(para.i, para.j)) return [];
  if (de.i === para.i && de.j === para.j) return [{ ...de }];
  const veio = new Map<string, string | null>([[chave(de.i, de.j), null]]);
  const fila: Piso[] = [de];
  while (fila.length) {
    const a = fila.shift()!;
    for (const d of PASSOS) {
      const b = { i: a.i + d.i, j: a.j + d.j };
      const k = chave(b.i, b.j);
      if (veio.has(k) || !livre(b.i, b.j)) continue;
      veio.set(k, chave(a.i, a.j));
      if (b.i === para.i && b.j === para.j) {
        const out: Piso[] = [];
        for (let c: string | null | undefined = k; c; c = veio.get(c)) {
          const [i, j] = c.split(",").map(Number);
          out.unshift({ i, j });
        }
        return out;
      }
      fila.push(b);
    }
  }
  return [];
}

/** Para onde o boneco olha ao ir de `a` até o vizinho `b`. */
export function sentido(a: Piso, b: Piso, antes: Sentido = "frente-direita"): Sentido {
  if (b.i > a.i) return "frente-direita";
  if (b.j > a.j) return "frente-esquerda";
  if (b.i < a.i) return "costas-esquerda";
  if (b.j < a.j) return "costas-direita";
  return antes;
}

/* ---------- spritesheet (public/arte/bonecos/bonecos.json) ---------- */
export const CEL_W = 84;
export const CEL_H = 134;
/** Ponto do chão embaixo do boneco, dentro da célula. */
export const ANCORA = { x: 42, y: 132 } as const;
/** Linha da folha e se espelha na horizontal, por sentido. */
export const SENTIDOS: Readonly<Record<Sentido, readonly [linha: "frente" | "costas", espelha: boolean]>> = {
  "frente-direita": ["frente", false],
  "frente-esquerda": ["frente", true],
  "costas-direita": ["costas", false],
  "costas-esquerda": ["costas", true],
};
const LINHA = { frente: 0, costas: 1 } as const;

/** Recorte da folha: `quadro` 0 = parado, 1 a 4 = andando. */
export function quadroSprite(s: Sentido, quadro: number) {
  const [linha, espelha] = SENTIDOS[s];
  return { x: -quadro * CEL_W, y: -LINHA[linha] * CEL_H, espelha };
}

/* ---------- entrada ---------- */
/** Pisos livres no vão da entrada (parede da frente), onde quem chega aparece. */
export const ENTRADA: readonly Piso[] = [
  { i: 5, j: 10 },
  { i: 6, j: 10 },
  { i: 7, j: 10 },
  { i: 5, j: 9 },
  { i: 6, j: 9 },
  { i: 7, j: 9 },
];

export const entradaSorteada = (rnd = Math.random) => ({ ...ENTRADA[Math.floor(rnd() * ENTRADA.length) % ENTRADA.length] });

/** Lugar fixo para quem não manda posição (ex.: quem está no site antigo): todo mundo vê no mesmo piso. */
export function entradaDe(key: string): Piso {
  let h = 0;
  for (let k = 0; k < key.length; k++) h = (h * 31 + key.charCodeAt(k)) >>> 0;
  return { ...ENTRADA[h % ENTRADA.length] };
}

/* ---------- ordem de desenho ---------- */
/** Pegada no chão de algo desenhado (móvel ou boneco), em unidades do piso. */
export type Caixa = { i0: number; i1: number; j0: number; j1: number };

export const caixaDoMovel = (m: Movel): Caixa => ({ i0: m.i, i1: m.i + m.w, j0: m.j, j1: m.j + m.d });
/** Boneco no piso (i, j), que pode ser fracionário no meio de um passo: uma pegada pequena no centro. */
export const caixaDoBoneco = (i: number, j: number): Caixa => ({ i0: i + 0.4, i1: i + 0.6, j0: j + 0.4, j1: j + 0.6 });

const soma = (c: Caixa) => c.i0 + c.i1 + c.j0 + c.j1;

/** `a` fica atrás de `b`? Vale quando um plano do piso separa os dois e `a` está do lado do fundo. */
function atras(a: Caixa, b: Caixa): boolean {
  const aAtras = a.i1 <= b.i0 || a.j1 <= b.j0;
  const bAtras = b.i1 <= a.i0 || b.j1 <= a.j0;
  if (aAtras !== bAtras) return aAtras;
  return soma(a) < soma(b);
}

/** Folga na horizontal (em pisos): metade da largura do boneco (42 px ÷ 40). */
const FOLGA = 1.1;

/** Os dois podem se cruzar na tela (na horizontal)? Só esses precisam de ordem entre si. */
function cruzam(a: Caixa, b: Caixa) {
  return a.i0 - a.j1 - FOLGA < b.i1 - b.j0 && b.i0 - b.j1 - FOLGA < a.i1 - a.j0;
}

/**
 * Ordem de desenho, do fundo para a frente: devolve os índices de `caixas`.
 * Quem está mais na frente fica por cima, inclusive em relação aos móveis
 * (o boneco passa atrás da mesa e na frente dela).
 */
export function ordemZ(caixas: readonly Caixa[]): number[] {
  const n = caixas.length;
  const antes = caixas.map(() => new Set<number>());
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      if (!cruzam(caixas[a], caixas[b])) continue;
      if (atras(caixas[a], caixas[b])) antes[b].add(a);
      else antes[a].add(b);
    }
  const feito = new Set<number>();
  const out: number[] = [];
  while (out.length < n) {
    let esc = -1;
    for (let k = 0; k < n; k++) {
      if (feito.has(k) || [...antes[k]].some((x) => !feito.has(x))) continue;
      if (esc < 0 || soma(caixas[k]) < soma(caixas[esc])) esc = k;
    }
    /* ciclo (raro, com pegadas encostadas): sai o que está mais no fundo */
    if (esc < 0) for (let k = 0; k < n; k++) if (!feito.has(k) && (esc < 0 || soma(caixas[k]) < soma(caixas[esc]))) esc = k;
    feito.add(esc);
    out.push(esc);
  }
  return out;
}
