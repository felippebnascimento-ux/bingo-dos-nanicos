/*
 * Emblemas conquistados (seção 27 do seguranca.sql). Quem calcula é o banco (emblemas_de); aqui ficam só os
 * nomes, as metas de cada nível (espelhadas do SQL, para mostrar "falta pouco") e a leitura conferida.
 * Cada emblema tem 3 níveis: bronze, prata e ouro.
 */
import { nomeTier, TIERS } from "@/features/ficha/numeros";

export type IdEmblema =
  | "online" | "sequencia" | "tela" | "coroa" | "respeito" | "elo" | "cs" | "trofeu" | "truco" | "bingo" | "cassino" | "cronista"
  | "missao" | "perfeito" | "mao" | "tubarao" | "aviao" | "artilheiro" | "coruja" | "churrasco" | "fenix" | "colecao"
  | "gc";
export type Emblema = { id: IdEmblema; nivel: 1 | 2 | 3; valor: number };

type Def = { nome: string; metas: [number, number, number]; texto: (n: number) => string };
export const EMBLEMAS: Readonly<Record<IdEmblema, Def>> = {
  online: { nome: "Morador do K-FOFO", metas: [10, 50, 200], texto: (n) => `${n} h de site aberto` },
  sequencia: { nome: "Fiel", metas: [7, 30, 100], texto: (n) => `recorde de ${n} dias seguidos` },
  tela: { nome: "Transmissor", metas: [1, 10, 50], texto: (n) => `${n} h de tela compartilhada` },
  coroa: { nome: "Realeza", metas: [1, 24, 100], texto: (n) => `${n} h de coroa ou chapéu na cabeça` },
  respeito: { nome: "Respeitado", metas: [10, 50, 200], texto: (n) => `${n} respeitos recebidos` },
  /* fase 33: o valor é o tier (1 = Ferro … 10 = Desafiante) e o desenho é o brasão oficial; o nível só ordena */
  elo: { nome: "Elo no LoL", metas: [1, 4, 7], texto: (n) => (TIERS[n - 1] ? nomeTier(TIERS[n - 1]) : "sem elo") },
  cs: { nome: "Veterano do CS", metas: [100, 500, 1000], texto: (n) => `${n} h de CS2` },
  trofeu: { nome: "Campeão da semana", metas: [1, 5, 20], texto: (n) => `${n} ${n === 1 ? "troféu" : "troféus"} de 1º lugar` },
  truco: { nome: "Truqueiro", metas: [5, 25, 100], texto: (n) => `${n} vitórias no truco` },
  bingo: { nome: "Bingo!", metas: [1, 10, 50], texto: (n) => `${n} ${n === 1 ? "bingo" : "bingos"}` },
  cassino: { nome: "Apostador", metas: [50, 500, 2000], texto: (n) => `${n} apostas no cassino` },
  cronista: { nome: "Cronista", metas: [5, 25, 100], texto: (n) => `${n} nanicadas cadastradas` },
  /* seção 37: missões, cassino, eventos, Bolsa Cassino e coleção */
  missao: { nome: "Missionário", metas: [10, 50, 200], texto: (n) => `${n} missões do dia feitas` },
  perfeito: { nome: "Dia perfeito", metas: [3, 15, 60], texto: (n) => `${n} ${n === 1 ? "dia" : "dias"} com as 3 missões` },
  mao: { nome: "Mão quente", metas: [25, 250, 1000], texto: (n) => `${n} apostas ganhas no cassino` },
  tubarao: { nome: "Tubarão", metas: [500, 2500, 10000], texto: (n) => `maior prêmio numa aposta: ${n.toLocaleString("pt-BR")} moedas` },
  aviao: { nome: "Pé no chão", metas: [10, 100, 500], texto: (n) => `${n} voos sacados no Aviãozinho` },
  artilheiro: { nome: "Artilheiro", metas: [20, 150, 600], texto: (n) => `${n} gols no Pênalti` },
  coruja: { nome: "Coruja", metas: [1, 10, 50], texto: (n) => `${n} h de happy hour` },
  churrasco: { nome: "Churrasqueiro", metas: [1, 5, 20], texto: (n) => `${n} ${n === 1 ? "espetinho" : "espetinhos"} no churrasco` },
  fenix: { nome: "Fênix", metas: [1, 5, 15], texto: (n) => `${n} ${n === 1 ? "Bolsa Cassino recebida" : "Bolsas Cassino recebidas"}` },
  /* fase 33: o nível da Gamers Club (1 a 20), desenhado no círculo da GC */
  gc: { nome: "Nível da GC", metas: [1, 8, 15], texto: (n) => `GC nível ${n}` },
  colecao: { nome: "Colecionador", metas: [5, 12, 20], texto: (n) => `${n} itens diferentes na mochila` },
};
export const NIVEL = ["", "bronze", "prata", "ouro"] as const;

/** Confere a lista que veio do banco (só ids conhecidos, nível 1 a 3), na ordem de EMBLEMAS. */
export function lerEmblemas(d: unknown): Emblema[] {
  if (!Array.isArray(d)) return [];
  const ordem = Object.keys(EMBLEMAS) as IdEmblema[];
  const out: Emblema[] = [];
  for (const x of d) {
    const o = x as { id?: unknown; nivel?: unknown; valor?: unknown };
    if (typeof o.id !== "string" || !(o.id in EMBLEMAS)) continue;
    const nivel = o.nivel === 1 || o.nivel === 2 || o.nivel === 3 ? o.nivel : null;
    if (!nivel) continue;
    out.push({ id: o.id as IdEmblema, nivel, valor: typeof o.valor === "number" && Number.isFinite(o.valor) ? Math.max(0, Math.floor(o.valor)) : 0 });
  }
  return out.sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
}

/** Quanto falta para o próximo nível: null no ouro e no Elo alto (o elo não é uma conta que sobe aos poucos). */
export function progressoEmblema(e: Emblema): { prox: (typeof NIVEL)[2 | 3]; meta: number; parte: number } | null {
  if (e.nivel === 3 || e.id === "elo" || e.id === "gc") return null;
  const meta = EMBLEMAS[e.id].metas[e.nivel];
  return { prox: NIVEL[(e.nivel + 1) as 2 | 3], meta, parte: Math.min(1, Math.max(0, e.valor / meta)) };
}

/** "Morador do K-FOFO · prata: 63 h de site aberto (ouro com 200)". */
export function descreverEmblema(e: Emblema) {
  const d = EMBLEMAS[e.id];
  /* elo e GC não têm bronze, prata e ouro de verdade: o desenho já é o elo ou o nível */
  if (e.id === "elo" || e.id === "gc") return `${d.nome}: ${d.texto(e.valor)}`;
  const prox = e.nivel < 3 ? ` (${NIVEL[e.nivel + 1]} com ${d.metas[e.nivel as 1 | 2]})` : "";
  return `${d.nome} · ${NIVEL[e.nivel]}: ${d.texto(e.valor)}${prox}`;
}
