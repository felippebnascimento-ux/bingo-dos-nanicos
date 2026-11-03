/*
 * Blackjack ao vivo (seção 43 do seguranca.sql): as contas que a tela precisa, puras e testadas em bjRegras.test.ts.
 * Quem decide é o banco (dá as cartas, conta os pontos e paga); aqui é só para mostrar e para conferir o sapato:
 * cada carta k (0 a 311, 6 baralhos) vai para a posição de HMAC-SHA256(segredo, "bj:<rodada>:<k>"), em ordem crescente.
 */
import type { NaipeF, Valor } from "@/features/mesa/CartaFrancesa";

export type EstadoMao = "aposta" | "jogando" | "parou" | "estourou" | "blackjack";
export type MaoBj = { id: number; userId: string; lugar: number; mao: 1 | 2; aposta: number; cartas: string[]; pontos: number; estado: EstadoMao; dobrou: boolean; pagou: number | null };
export type RodadaBj = {
  id: number;
  fase: "apostas" | "jogo" | "fim";
  fechaEm: number;
  vezAte: number | null;
  fimEm: number | null;
  hash: string;
  segredo: string | null;
  /** a segunda carta do dealer vem "X" até a vez dele */
  dealer: string[];
  dealerPontos: number;
  vez: number | null;
};
export type EstadoBj = { agora: number; rodada: RodadaBj | null; maos: MaoBj[] };

export const APOSTA_MIN = 5;
export const APOSTA_MAX = 200;
export const LUGARES = 5;
export const TEMPO_APOSTAS_MS = 10_000;
export const TEMPO_VEZ_MS = 15_000;

const VALORES: Valor[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const NAIPES: NaipeF[] = ["s", "h", "d", "c"];

/** "10h" → valor "10" e naipe "h" (ou null, para a carta escondida "X"). */
export function carta(c: string): { v: Valor; n: NaipeF } | null {
  const v = c.slice(0, -1) as Valor, n = c.slice(-1) as NaipeF;
  return VALORES.includes(v) && NAIPES.includes(n) ? { v, n } : null;
}

/** Pontos de uma mão: Ás vale 11 ou 1, figuras 10 (cartas escondidas não contam). */
export function pontos(cartas: string[]): { total: number; macio: boolean } {
  let t = 0, ases = 0;
  for (const c of cartas) {
    const k = carta(c);
    if (!k) continue;
    if (k.v === "A") {
      t += 11;
      ases++;
    } else t += ["J", "Q", "K", "10"].includes(k.v) ? 10 : Number(k.v);
  }
  while (t > 21 && ases > 0) {
    t -= 10;
    ases--;
  }
  return { total: t, macio: ases > 0 };
}

/** Valor para dividir (10, J, Q e K contam igual). */
export const valorDividir = (c: string) => {
  const k = carta(c);
  if (!k) return 0;
  return k.v === "A" ? 11 : ["J", "Q", "K", "10"].includes(k.v) ? 10 : Number(k.v);
};

/** O que dá para fazer na minha vez (o banco confere de novo). */
export function opcoes(m: MaoBj, maos: MaoBj[]) {
  const duas = m.cartas.length === 2;
  const jaDividiu = maos.some((x) => x.userId === m.userId && x.mao === 2);
  return {
    pedir: true,
    parar: true,
    dobrar: duas && !m.dobrou,
    dividir: duas && m.mao === 1 && !jaDividiu && valorDividir(m.cartas[0]) === valorDividir(m.cartas[1]),
  };
}

/** Lê o que bj_estado devolveu (o banco é a fonte, mas a tela não confia no formato). */
export function lerEstado(d: unknown): EstadoBj | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const agora = Date.parse(String(o.agora));
  if (!Number.isFinite(agora)) return null;
  const r = o.rodada as Record<string, unknown> | null;
  const quando = (v: unknown) => (typeof v === "string" ? Date.parse(v) : null);
  const rodada: RodadaBj | null =
    r && typeof r === "object"
      ? {
          id: Number(r.id),
          fase: r.fase === "jogo" || r.fase === "fim" ? r.fase : "apostas",
          fechaEm: quando(r.fecha_em) ?? agora,
          vezAte: quando(r.vez_ate),
          fimEm: quando(r.fim_em),
          hash: String(r.hash ?? ""),
          segredo: typeof r.segredo === "string" ? r.segredo : null,
          dealer: Array.isArray(r.dealer) ? r.dealer.map(String) : [],
          dealerPontos: Number(r.dealer_pontos) || 0,
          vez: r.vez == null ? null : Number(r.vez),
        }
      : null;
  const maos: MaoBj[] = Array.isArray(o.maos)
    ? o.maos.map((x) => {
        const m = x as Record<string, unknown>;
        return {
          id: Number(m.id),
          userId: String(m.user_id),
          lugar: Number(m.lugar),
          mao: m.mao === 2 ? 2 : 1,
          aposta: Number(m.aposta) || 0,
          cartas: Array.isArray(m.cartas) ? m.cartas.map(String) : [],
          pontos: Number(m.pontos) || 0,
          estado: (["aposta", "jogando", "parou", "estourou", "blackjack"] as const).find((e) => e === m.estado) ?? "aposta",
          dobrou: !!m.dobrou,
          pagou: m.pagou == null ? null : Number(m.pagou),
        };
      })
    : [];
  return { agora, rodada, maos };
}

/** Como a mão terminou, para o selo em cima dela. */
export function resultado(m: MaoBj): "blackjack" | "ganhou" | "empate" | "perdeu" | "estourou" | null {
  if (m.pagou === null) return m.estado === "estourou" ? "estourou" : m.estado === "blackjack" ? "blackjack" : null;
  if (m.estado === "estourou") return "estourou";
  if (m.estado === "blackjack" && m.pagou > m.aposta) return "blackjack";
  if (m.pagou > m.aposta) return "ganhou";
  if (m.pagou === m.aposta) return "empate";
  return "perdeu";
}

/* ---------- conferir o sapato ---------- */
const hex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((b) => parseInt(b, 16)));
function compara(a: Uint8Array, b: Uint8Array) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

/** Refaz o sapato da rodada a partir do segredo revelado (o mesmo que o banco montou). */
export async function sapato(segredoHex: string, rodada: number): Promise<string[]> {
  const chave = await crypto.subtle.importKey("raw", hex(segredoHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const enc = new TextEncoder();
  const lista: { c: string; h: Uint8Array }[] = [];
  for (let k = 0; k < 312; k++) {
    const h = new Uint8Array(await crypto.subtle.sign("HMAC", chave, enc.encode(`bj:${rodada}:${k}`)));
    lista.push({ c: VALORES[k % 13] + NAIPES[Math.floor(k / 13) % 4], h });
  }
  return lista.sort((a, b) => compara(a.h, b.h)).map((x) => x.c);
}

/** O sha256 do segredo bate com o hash mostrado antes da rodada? */
export async function hashBate(segredoHex: string, hash: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", hex(segredoHex)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("") === hash;
}
