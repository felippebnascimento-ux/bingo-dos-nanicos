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
