/*
 * Pôquer Texas Hold'em entre nanicos (seção 44 do seguranca.sql): as contas que a tela precisa, puras e testadas em
 * pkRegras.test.ts. Quem decide é o banco (embaralha, guarda as cartas, confere as jogadas e paga); aqui é para mostrar
 * o nome da mão, o que dá para fazer na vez e conferir o baralho: carta k (0 a 51) vai para a posição de
 * HMAC-SHA256(segredo, "pk:<mão>:<k>"), em ordem crescente. A força da mão é a mesma conta do pk_valor5 do banco.
 */
import type { NaipeF, Valor } from "@/features/mesa/CartaFrancesa";
import { carta } from "./bjRegras";

export { carta, hashBate } from "./bjRegras";

export const LUGARES_PK = 6;
export const TEMPO_VEZ_PK_MS = 20_000;
/** big blinds que dá para abrir (o small é a metade) */
export const BLINDS = [10, 20, 50] as const;
export const compraMin = (bb: number) => bb * 20;
export const compraMax = (bb: number) => bb * 100;

export type FasePk = "preflop" | "flop" | "turn" | "river" | "fim";
export type JogadorPk = { lugar: number; userId: string; estado: "ativo" | "desistiu" | "allin"; naRodada: number; total: number; ganhou: number };
export type ShowPk = { lugar: number; cartas: string[] | null; valor: number | null; ganhou: number };
export type MaoPk = {
  id: number;
  fase: FasePk;
  mesa: string[];
  pote: number;
  aposta: number;
  minAumento: number;
  vez: number | null;
  vezAte: number | null;
  botao: number;
  sb: number;
  bb: number;
  fimEm: number | null;
  hash: string;
  segredo: string | null;
  rake: number;
  showdown: boolean;
  mostradas: ShowPk[];
  jogadores: JogadorPk[];
  minhas: string[];
};
export type LugarPk = { lugar: number; userId: string; fichas: number; sair: boolean };
export type EstadoPk = { agora: number; mesa: { id: number; blind: number; criadaPor: string; fechada: boolean }; lugares: LugarPk[]; mao: MaoPk | null };
export type MesaListaPk = { id: number; blind: number; criadaPor: string; emJogo: boolean; lugares: { lugar: number; userId: string; fichas: number }[] };

const quando = (v: unknown) => (typeof v === "string" ? Date.parse(v) : null);
const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

/** Lê o que pk_estado devolveu (o banco é a fonte, mas a tela não confia no formato). */
export function lerEstadoPk(d: unknown): EstadoPk | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const agora = Date.parse(String(o.agora));
  const m = o.mesa as Record<string, unknown> | null;
  if (!Number.isFinite(agora) || !m || typeof m !== "object") return null;
  const lugares: LugarPk[] = Array.isArray(o.lugares)
    ? o.lugares.map((x) => {
        const l = x as Record<string, unknown>;
        return { lugar: Number(l.lugar), userId: String(l.user_id), fichas: Number(l.fichas) || 0, sair: !!l.sair };
      })
    : [];
  const h = o.mao as Record<string, unknown> | null;
  let mao: MaoPk | null = null;
  if (h && typeof h === "object") {
    const res = (h.resultado ?? {}) as Record<string, unknown>;
    mao = {
      id: Number(h.id),
      fase: (["preflop", "flop", "turn", "river", "fim"] as const).find((f) => f === h.fase) ?? "preflop",
      mesa: lista(h.mesa_cartas),
      pote: Number(h.pote) || 0,
      aposta: Number(h.aposta) || 0,
      minAumento: Number(h.min_aumento) || 0,
      vez: h.vez == null ? null : Number(h.vez),
      vezAte: quando(h.vez_ate),
      botao: Number(h.botao),
      sb: Number(h.sb),
      bb: Number(h.bb),
      fimEm: quando(h.fim_em),
      hash: String(h.hash ?? ""),
      segredo: typeof h.segredo === "string" ? h.segredo : null,
      rake: Number(h.rake) || 0,
      showdown: res.showdown === true,
      mostradas: Array.isArray(res.jogadores)
        ? res.jogadores.map((x) => {
            const j = x as Record<string, unknown>;
            return { lugar: Number(j.lugar), cartas: Array.isArray(j.cartas) ? j.cartas.map(String) : null, valor: j.valor == null ? null : Number(j.valor), ganhou: Number(j.ganhou) || 0 };
          })
        : [],
      jogadores: Array.isArray(h.jogadores)
        ? h.jogadores.map((x) => {
            const j = x as Record<string, unknown>;
            return {
              lugar: Number(j.lugar),
              userId: String(j.user_id),
              estado: j.estado === "desistiu" || j.estado === "allin" ? j.estado : "ativo",
              naRodada: Number(j.na_rodada) || 0,
              total: Number(j.total) || 0,
              ganhou: Number(j.ganhou) || 0,
            };
          })
        : [],
      minhas: lista(h.minhas),
    };
  }
  return { agora, mesa: { id: Number(m.id), blind: Number(m.blind) || 0, criadaPor: String(m.criada_por), fechada: !!m.fechada }, lugares, mao };
}

export function lerListaPk(d: unknown): MesaListaPk[] {
  if (!Array.isArray(d)) return [];
  return d.map((x) => {
    const m = x as Record<string, unknown>;
    return {
      id: Number(m.id),
      blind: Number(m.blind) || 0,
      criadaPor: String(m.criada_por),
      emJogo: !!m.em_jogo,
      lugares: Array.isArray(m.lugares)
        ? m.lugares.map((y) => {
            const l = y as Record<string, unknown>;
            return { lugar: Number(l.lugar), userId: String(l.user_id), fichas: Number(l.fichas) || 0 };
          })
        : [],
    };
  });
}

/* ---------- a força da mão (igual ao pk_valor5 e pk_melhor do banco) ---------- */
const rank = (c: string) => {
  const v = c.slice(0, -1);
  return v === "A" ? 14 : v === "K" ? 13 : v === "Q" ? 12 : v === "J" ? 11 : Number(v);
};

/** Força de 5 cartas num número só (maior = melhor): categoria e os desempates em base 15. */
export function valor5(c: string[]): number {
  const r = c.map(rank).sort((a, b) => b - a);
  const flush = new Set(c.map((x) => x.slice(-1))).size === 1;
  const conta = new Map<number, number>();
  for (const k of r) conta.set(k, (conta.get(k) ?? 0) + 1);
  const grupos = [...conta.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const g = grupos.map((x) => x[0]), n = grupos.map((x) => x[1]);
  let seq = 0;
  if (g.length === 5) {
    if (r[0] - r[4] === 4) seq = r[0];
    else if (r[0] === 14 && r[1] === 5 && r[4] === 2) seq = 5;
  }
  let cat: number, t: number[];
  if (seq && flush) [cat, t] = [8, [seq]];
  else if (n[0] === 4) [cat, t] = [7, g];
  else if (n[0] === 3 && n[1] === 2) [cat, t] = [6, g];
  else if (flush) [cat, t] = [5, r];
  else if (seq) [cat, t] = [4, [seq]];
  else if (n[0] === 3) [cat, t] = [3, g];
  else if (n[0] === 2 && n[1] === 2) [cat, t] = [2, g];
  else if (n[0] === 2) [cat, t] = [1, g];
  else [cat, t] = [0, r];
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 15 + (t[i] ?? 0);
  return v;
}

/** A melhor mão de 5 entre 5, 6 ou 7 cartas: o valor e quais cartas (para acender na mesa). */
export function melhor(c: string[]): { valor: number; cartas: string[] } | null {
  const ok = c.filter((x) => carta(x));
  if (ok.length < 5) return null;
  let m: { valor: number; cartas: string[] } | null = null;
  const escolher = (ini: number, sel: string[]) => {
    if (sel.length === 5) {
      const v = valor5(sel);
      if (!m || v > m.valor) m = { valor: v, cartas: [...sel] };
      return;
    }
    for (let i = ini; i < ok.length; i++) escolher(i + 1, [...sel, ok[i]]);
  };
  escolher(0, []);
  return m;
}

const NOME_RANK: Record<number, [string, string]> = {
  14: ["Ás", "Ases"], 13: ["Rei", "Reis"], 12: ["Dama", "Damas"], 11: ["Valete", "Valetes"], 10: ["10", "10"], 9: ["9", "9"], 8: ["8", "8"],
  7: ["7", "7"], 6: ["6", "6"], 5: ["5", "5"], 4: ["4", "4"], 3: ["3", "3"], 2: ["2", "2"],
};
/** "Par de Reis", "Trinca de 7", "Sequência até o 9"… a partir do valor (o do banco ou o de valor5). */
export function nomeDaMao(valor: number): string {
  const d: number[] = [];
  let v = valor;
  for (let i = 0; i < 5; i++) {
    d.unshift(v % 15);
    v = Math.floor(v / 15);
  }
  const um = (k: number) => NOME_RANK[k]?.[0] ?? String(k), muitos = (k: number) => NOME_RANK[k]?.[1] ?? String(k);
  switch (v) {
    case 8: return d[0] === 14 ? "Royal flush" : `Straight flush até o ${um(d[0])}`;
    case 7: return `Quadra de ${muitos(d[0])}`;
    case 6: return `Full house: ${muitos(d[0])} com ${muitos(d[1])}`;
    case 5: return `Flush, ${um(d[0])} alto`;
    case 4: return `Sequência até o ${um(d[0])}`;
    case 3: return `Trinca de ${muitos(d[0])}`;
    case 2: return `Dois pares: ${muitos(d[0])} e ${muitos(d[1])}`;
    case 1: return `Par de ${muitos(d[0])}`;
    default: return `Carta alta: ${um(d[0])}`;
  }
}

/** Só com as 2 da mão, antes do flop: "Par de Ases" ou nada. */
export function nomeParcial(minhas: string[], mesa: string[]): string | null {
  const m = melhor([...minhas, ...mesa]);
  if (m) return nomeDaMao(m.valor);
  const ok = minhas.filter((x) => carta(x));
  if (ok.length === 2 && rank(ok[0]) === rank(ok[1])) return `Par de ${NOME_RANK[rank(ok[0])][1]}`;
  return null;
}

/** O que dá para fazer na vez (o banco confere de novo). */
export function opcoesPk(mao: MaoPk, fichas: number, lugar: number) {
  const j = mao.jogadores.find((x) => x.lugar === lugar);
  const na = j?.naRodada ?? 0;
  const deve = Math.max(0, mao.aposta - na);
  const max = na + fichas;
  const min = Math.min(max, mao.aposta + mao.minAumento);
  return {
    passar: deve === 0,
    pagar: deve > 0 ? Math.min(deve, fichas) : 0,
    /** dá para aumentar (até um total de min a max nesta rodada) */
    aumentar: max > mao.aposta,
    min,
    max,
    deve,
  };
}

/** Sugestões de aumento pelo pote (½, ¾, pote), como nos sites de pôquer: total na rodada, entre min e max. */
export function sugestoes(mao: MaoPk, o: ReturnType<typeof opcoesPk>) {
  const pote = mao.pote + o.deve;
  const alvo = (f: number) => Math.max(o.min, Math.min(o.max, mao.aposta + Math.round(pote * f)));
  return [
    { nome: "½ pote", valor: alvo(0.5) },
    { nome: "¾ pote", valor: alvo(0.75) },
    { nome: "Pote", valor: alvo(1) },
  ];
}

/* ---------- conferir o baralho ---------- */
const VALORES: Valor[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const NAIPES: NaipeF[] = ["s", "h", "d", "c"];
const hex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((b) => parseInt(b, 16)));
function compara(a: Uint8Array, b: Uint8Array) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

/** Refaz o baralho da mão a partir do segredo revelado (o mesmo que o banco montou). */
export async function baralhoPk(segredoHex: string, mao: number): Promise<string[]> {
  const chave = await crypto.subtle.importKey("raw", hex(segredoHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const enc = new TextEncoder();
  const l: { c: string; h: Uint8Array }[] = [];
  for (let k = 0; k < 52; k++) l.push({ c: VALORES[k % 13] + NAIPES[Math.floor(k / 13)], h: new Uint8Array(await crypto.subtle.sign("HMAC", chave, enc.encode(`pk:${mao}:${k}`))) });
  return l.sort((a, b) => compara(a.h, b.h)).map((x) => x.c);
}
