/*
 * Quarto próprio (fase 34): a regra pura (sem React). "Cabe" é a mesma regra do banco (quarto_cabe, seção 42 do
 * seguranca.sql), conferida pelos dois lados com quarto-cabe.fixture.json: dentro do quarto, fora da porta (piso 0,0)
 * e sem encostar em cima de outro móvel. Só serve para MOSTRAR (verde ou vermelho); quem decide é o banco.
 */
import type { EstadoMovel } from "./interativo";
import { ordemZ, type Caixa } from "@/features/hall/hall";

/** Um retângulo no piso do quarto: canto (i, j), largura em i (w) e fundo em j (d). */
export type Retangulo = { i: number; j: number; w: number; d: number };
/** Um móvel colocado (quarto_moveis). */
/** `estado`: o do dado, da luminária, do regulador ou do recado (interativo.ts, seção 53) */
export type MovelNoQuarto = { id: number; userId: string; itemId: string; i: number; j: number; giro: boolean; estado?: EstadoMovel };

export const TAMANHOS = [6, 9, 12] as const;
export type Tamanho = (typeof TAMANHOS)[number];
/** a porta fica sempre no piso (0, 0), que não muda quando o quarto cresce */
export const PORTA = { i: 0, j: 0 } as const;
export const MAX_MOVEL = 4;

/** O piso que o móvel ocupa, com o giro (que troca largura e fundo). */
export const pisoDo = (w: number, d: number, giro: boolean) => (giro ? { w: d, d: w } : { w, d });

/** Cabe aí? A mesma regra de quarto_cabe no banco. */
export function cabe(tam: number, ocupados: readonly Retangulo[], r: Retangulo): boolean {
  if (r.i < 0 || r.j < 0 || r.w < 1 || r.d < 1 || r.i + r.w > tam || r.j + r.d > tam) return false;
  if (r.i === PORTA.i && r.j === PORTA.j) return false;
  return !ocupados.some((o) => r.i < o.i + o.w && o.i < r.i + r.w && r.j < o.j + o.d && o.j < r.j + r.d);
}

/** Quanto custa trocar de quarto (só a diferença); null se o novo não for maior que o atual. */
export function diferenca(precoNovo: number, tamNovo: number, atual: { tamanho: number; preco: number } | null): number | null {
  if (!atual) return precoNovo;
  if (tamNovo <= atual.tamanho) return null;
  return precoNovo - atual.preco;
}

/** Dá para comprar esse quarto? Devolve o motivo para o botão (o banco confere de novo). */
export function podeComprarQuarto(tamNovo: number, tamAtual: number | null): { ok: boolean; motivo?: string } {
  if (tamAtual === null) return { ok: true };
  if (tamAtual === tamNovo) return { ok: false, motivo: "É o seu quarto" };
  if (tamAtual > tamNovo) return { ok: false, motivo: "Você já tem um maior" };
  return { ok: true };
}

/** Ordem de desenho dos móveis (do fundo para a frente), com a mesma conta do hall. */
export function camadasQuarto(rets: readonly Retangulo[]): number[] {
  const caixas: Caixa[] = rets.map((r) => ({ i0: r.i, i1: r.i + r.w, j0: r.j, j1: r.j + r.d }));
  return ordemZ(caixas);
}
