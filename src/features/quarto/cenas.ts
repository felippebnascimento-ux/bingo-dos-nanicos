/*
 * Cenas especiais (03/11/2026, desenho do João): a rua, do lado de fora do K-FOFO (gramado, árvore com bancos, 5 carros
 * estacionados e a marca do pênalti x1), e o corredor dos quartos (uma porta para cada nanico: aberta para quem já
 * comprou o quarto, fechada para quem não). As duas são como um quarto: a mesma grade, os mesmos bonecos e a mesma
 * presença (`quarto` = "rua" ou "corredor"). Regra pura e testada.
 */
import type { Friend } from "@/lib/tipos";
import { gradeDoQuarto, type Grade, type MovelGrade } from "./grade";

export const CENAS = ["rua", "corredor", "banheiro", "arena"] as const;
export type CenaEspecial = (typeof CENAS)[number];
export const ehCenaEspecial = (x: unknown): x is CenaEspecial => CENAS.includes(x as CenaEspecial);

/* a arena (seção 58): chão vazio de 10×10 para o jogo de pintar o chão */
export const TAM_CENA: Record<CenaEspecial, number> = { rua: 12, corredor: 9, banheiro: 5, arena: 10 };
export const NOME_CENA: Record<CenaEspecial, string> = { rua: "A rua", corredor: "Corredor dos quartos", banheiro: "Banheiro do K-FOFO", arena: "Arena de pintar o chão" };

/** O banheiro (a porta do canto do K-FOFO): o vaso (dá para sentar) e a pia; as paredes são das pixações (seção 51). */
export const MOVEIS_BANHEIRO: readonly MovelGrade[] = [
  { id: -20, desenho: "vaso", ret: { i: 4, j: 1, w: 1, d: 1 }, giro: true },
  { id: -21, desenho: "pia", ret: { i: 1, j: 4, w: 1, d: 1 }, giro: false },
];

/** A rua: a árvore no meio com 3 bancos, os 5 carros na grama e o gol do pênalti x1. */
export const MOVEIS_RUA: readonly MovelGrade[] = [
  { id: -1, desenho: "arvore", ret: { i: 5, j: 5, w: 2, d: 2 }, giro: false },
  { id: -2, desenho: "banco-praca", ret: { i: 5, j: 3, w: 2, d: 1 }, giro: false },
  { id: -3, desenho: "banco-praca", ret: { i: 3, j: 5, w: 1, d: 2 }, giro: true },
  { id: -4, desenho: "banco-praca", ret: { i: 5, j: 8, w: 2, d: 1 }, giro: false },
  { id: -5, desenho: "carro-vermelho", ret: { i: 1, j: 10, w: 2, d: 1 }, giro: false },
  { id: -6, desenho: "carro-azul", ret: { i: 3, j: 10, w: 2, d: 1 }, giro: false },
  { id: -7, desenho: "carro-branco", ret: { i: 5, j: 10, w: 2, d: 1 }, giro: false },
  { id: -8, desenho: "carro-preto", ret: { i: 7, j: 10, w: 2, d: 1 }, giro: false },
  { id: -9, desenho: "carro-amarelo", ret: { i: 9, j: 10, w: 2, d: 1 }, giro: false },
  { id: -10, desenho: "gol", ret: { i: 11, j: 2, w: 1, d: 3 }, giro: true },
];
/** o gol do pênalti x1 (tocar nele abre o duelo) e a marca do pênalti no gramado */
export const GOL_RUA = -10;
export const MARCA_PENALTI = { i: 8.5, j: 3.5 };

export const moveisDaCena = (c: CenaEspecial): readonly MovelGrade[] => (c === "rua" ? MOVEIS_RUA : c === "banheiro" ? MOVEIS_BANHEIRO : []);

/* ---------- pixações do banheiro (seção 51): onde cada uma fica na parede ---------- */
export const CORES_PIXO = ["preto", "vermelho", "azul", "verde", "rosa", "amarelo"] as const;
export type CorPixo = (typeof CORES_PIXO)[number];
export type LugarPixo = { parede: "esq" | "dir"; a: number; z: number; rot: number };
/** Um lugar sorteado numa das duas paredes do banheiro (longe da porta do piso 0, 0 na parede da direita). */
export function lugarDePixo(r: () => number = Math.random): LugarPixo {
  const parede = r() < 0.5 ? "esq" : "dir";
  const ini = parede === "dir" ? 1.3 : 0.3;
  return { parede, a: Math.round((ini + r() * (4.7 - ini)) * 100) / 100, z: 18 + Math.floor(r() * 116), rot: Math.round(r() * 20 - 10) };
}

const grades = new Map<CenaEspecial, Grade>();
/** A grade de andar de uma cena especial (sempre a mesma). */
export function gradeEspecial(c: CenaEspecial): Grade {
  let g = grades.get(c);
  if (!g) grades.set(c, (g = gradeDoQuarto(TAM_CENA[c], moveisDaCena(c))));
  return g;
}

export type PortaCorredor = { fid: string; nome: string; aberta: boolean; parede: "esq" | "dir"; a: number; b: number };

/**
 * As portas do corredor, uma por nanico (em ordem alfabética): metade na parede da esquerda e o resto na da direita,
 * depois da saída para o K-FOFO (que fica no piso 0, 0). `aberta` = o nanico tem quarto.
 */
export function portasDoCorredor(nanicos: readonly Pick<Friend, "id" | "name" | "user_id">[], temQuarto: (uid: string) => boolean): PortaCorredor[] {
  const n = TAM_CENA.corredor;
  const lista = [...nanicos].sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
  const naEsq = Math.ceil(lista.length / 2);
  return lista.map((f, k) => {
    const esq = k < naEsq;
    const qtd = esq ? naEsq : lista.length - naEsq;
    const pos = esq ? k : k - naEsq;
    /* esquerda: de 0,3 a n − 0,3; direita: depois da saída (1,1 em diante) */
    const ini = esq ? 0.3 : 1.15;
    const passo = (n - 0.3 - ini) / Math.max(1, qtd);
    const a = ini + pos * passo + passo * 0.12;
    return { fid: f.id, nome: f.name, aberta: !!f.user_id && temQuarto(f.user_id), parede: esq ? "esq" : "dir", a, b: a + passo * 0.76 };
  });
}
