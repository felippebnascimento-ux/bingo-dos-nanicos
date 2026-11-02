/*
 * Cassino: as regras da roleta europeia (iguais às do SQL, só para mostrar e testar) e a conferência
 * "provably fair": com a semente revelada, qualquer um recalcula o número de cada aposta.
 * Quem sorteia de verdade é o banco (apostar_roleta); o navegador nunca decide resultado.
 */

export type TipoAposta = "numero" | "cor" | "paridade" | "metade";
export type Cor = "vermelho" | "preto" | "verde";

export const APOSTA_MIN = 5;
export const APOSTA_MAX = 100;
export const FICHAS = [5, 10, 25, 50, 100] as const;

/** Casas vermelhas da roleta europeia. */
export const VERMELHAS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const corDa = (casa: number): Cor => (casa === 0 ? "verde" : VERMELHAS.has(casa) ? "vermelho" : "preto");

/** Quanto volta para a pessoa (aposta incluída): 36× no número certo, 2× nas outras; o 0 perde cor, paridade e metade. */
export function pagamentoRoleta(tipo: TipoAposta, valor: number, casa: number, aposta: number): number {
  let ganha = false;
  if (tipo === "numero") ganha = casa === valor;
  else if (casa !== 0) {
    if (tipo === "cor") ganha = (corDa(casa) === "vermelho") === (valor === 0);
    if (tipo === "paridade") ganha = casa % 2 === valor;
    if (tipo === "metade") ganha = (casa <= 18) === (valor === 0);
  }
  return ganha ? aposta * (tipo === "numero" ? 36 : 2) : 0;
}

/** Quanto volta, em média, de cada moeda apostada (RTP), contando as 37 casas. */
export function rtpRoleta(tipo: TipoAposta, valor: number): number {
  let total = 0;
  for (let casa = 0; casa <= 36; casa++) total += pagamentoRoleta(tipo, valor, casa, 1);
  return total / 37;
}

/** Quanto a casa leva, em %: 1 − 36/37 = 2,7%. */
export const vantagemDaCasa = () => Math.round((1 - rtpRoleta("cor", 0)) * 1000) / 10;

const hexParaBytes = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((b) => parseInt(b, 16)));

/**
 * O número sorteado de uma aposta: os primeiros 52 bits de HMAC-SHA256(semente do servidor, "cliente:nonce"),
 * em [0, 1). É exatamente a conta do SQL (cassino_numero).
 */
export async function conferir(sementeHex: string, cliente: string, nonce: number): Promise<number> {
  const chave = await crypto.subtle.importKey("raw", hexParaBytes(sementeHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`${cliente}:${nonce}`)));
  const hex = [...assinatura.slice(0, 7)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 13);
  return parseInt(hex, 16) / 2 ** 52;
}

/** A casa da roleta para um número u em [0, 1). */
export const casaDaRoleta = (u: number) => Math.floor(u * 37);

/** O hash (SHA-256) da semente revelada, para comparar com o que era mostrado antes das apostas. */
export async function hashDaSemente(sementeHex: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", hexParaBytes(sementeHex)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- limbo: resultado = max(1, floor(0,97 / (1 − u) × 100) / 100) ---------- */
export const ALVO_MIN = 1.01;
export const ALVO_MAX = 100;
/** O resultado do limbo para um número u (a mesma conta do SQL). */
export const valorLimbo = (u: number) => Math.max(1, Math.floor((0.97 / (1 - u)) * 100) / 100);
/** Chance de o resultado passar do alvo: 0,97 / alvo. */
export const chanceLimbo = (alvo: number) => Math.min(1, 0.97 / alvo);
export const pagamentoLimbo = (alvo: number, resultado: number, aposta: number) => (resultado >= alvo ? Math.floor(aposta * alvo) : 0);

/* ---------- maior ou menor: número de 0 a 9999 ---------- */
export type Lado = "abaixo" | "acima";
export const chanceDado = (lado: Lado, n: number) => (lado === "abaixo" ? n / 10000 : (9999 - n) / 10000);
/** Quanto volta se ganhar (aposta × 0,97 / chance). */
export const pagamentoDado = (lado: Lado, n: number, aposta: number) => Math.floor((aposta * 0.97) / chanceDado(lado, n));
export const numeroDado = (u: number) => Math.floor(u * 10000);
export const chanceValida = (c: number) => c >= 0.01 && c <= 0.95;

/* ---------- caça-níquel: pesos e pagamentos vêm do banco (cassino_rolos e cassino_pagamentos) ---------- */
export type Rolo = { simbolo: string; peso: number; ordem: number };
export type Pagamentos = Record<string, number>;

/** Quanto paga uma combinação (a mesma regra de cassino_slot_mult). */
export function multSlot(a: string, b: string, c: string, tabela: Pagamentos): number {
  if (a === b && b === c) return tabela[a === "bola" ? "tres_bola" : a === "moeda" ? "tres_moeda" : "tres_rosto"] ?? 0;
  const moedas = [a, b, c].filter((s) => s === "moeda").length;
  return moedas === 2 ? (tabela.duas_moedas ?? 0) : moedas === 1 ? (tabela.uma_moeda ?? 0) : 0;
}

/** O símbolo de um rolo para um número u: anda pelos pesos na ordem (a mesma regra de cassino_simbolo). */
export function simboloSlot(u: number, rolos: readonly Rolo[]): string {
  const ord = [...rolos].sort((x, y) => x.ordem - y.ordem);
  const total = ord.reduce((s, r) => s + r.peso, 0);
  const x = Math.floor(u * total);
  let acum = 0;
  for (const r of ord) {
    acum += r.peso;
    if (x < acum) return r.simbolo;
  }
  return ord[ord.length - 1]?.simbolo ?? "";
}

/** RTP exato do caça-níquel: soma de todas as combinações com os pesos. */
export function rtpSlot(rolos: readonly Rolo[], tabela: Pagamentos): number {
  const total = rolos.reduce((s, r) => s + r.peso, 0);
  let soma = 0;
  for (const a of rolos) for (const b of rolos) for (const c of rolos) soma += a.peso * b.peso * c.peso * multSlot(a.simbolo, b.simbolo, c.simbolo, tabela);
  return soma / total ** 3;
}

/** Refaz o resultado de uma aposta com a semente revelada (para a conferência), como texto comparável. */
export async function refazer(
  jogo: string,
  nonce: number,
  sementeHex: string,
  cliente: string,
  rolos: readonly Rolo[],
): Promise<string> {
  const u = await conferir(sementeHex, cliente, nonce);
  if (jogo === "roleta") return String(casaDaRoleta(u));
  if (jogo === "limbo") return valorLimbo(u).toFixed(2);
  if (jogo === "dado") return String(numeroDado(u));
  if (jogo === "slot") {
    const s = [u, await conferir(sementeHex, cliente, nonce + 1), await conferir(sementeHex, cliente, nonce + 2)];
    return s.map((x) => simboloSlot(x, rolos)).join(",");
  }
  return "";
}

/** O resultado guardado de uma aposta, no mesmo formato de `refazer`. */
export function resultadoGuardado(jogo: string, r: Record<string, unknown>): string {
  if (jogo === "roleta") return String(r.casa);
  if (jogo === "limbo") return Number(r.valor).toFixed(2);
  if (jogo === "dado") return String(r.numero);
  if (jogo === "slot") return Array.isArray(r.simbolos) ? r.simbolos.join(",") : "";
  return "";
}
