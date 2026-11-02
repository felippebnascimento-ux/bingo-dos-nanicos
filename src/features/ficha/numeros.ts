/*
 * Números da ficha (vindos da função ficha-jogos, guardados em jogos_stats): conferir e escrever para a tela.
 * Regra pura, sem React.
 */

export type StatsLol = {
  tier: string | null;
  rank: string | null;
  lp: number | null;
  vitorias: number;
  derrotas: number;
  kda: number | null;
  main: string | null;
  partidas: number;
};
export type StatsSteam = { cs2Horas: number | null; totalHoras: number | null; privado: boolean };
/** CS pelo Leetify: Premier atual e nível da Gamers Club (da última partida na GC). */
export type StatsCs = { premier: number | null; gc: number | null };
export type Fonte<T> = { dados: T | null; erro: string | null; atualizado: number };
export type NumerosFicha = { lol: Fonte<StatsLol> | null; steam: Fonte<StatsSteam> | null; cs: Fonte<StatsCs> | null; avisos: string[] };

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const s = (v: unknown, max = 40) => (typeof v === "string" && v ? v.slice(0, max) : null);

function lerLol(d: Record<string, unknown>): StatsLol | null {
  if (!Object.keys(d).length) return null;
  return {
    tier: s(d.tier, 20),
    rank: s(d.rank, 4),
    lp: n(d.lp),
    vitorias: Math.max(0, n(d.vitorias) ?? 0),
    derrotas: Math.max(0, n(d.derrotas) ?? 0),
    kda: n(d.kda),
    main: s(d.main),
    partidas: Math.max(0, n(d.partidas) ?? 0),
  };
}

function lerSteam(d: Record<string, unknown>): StatsSteam | null {
  if (!Object.keys(d).length) return null;
  return { cs2Horas: n(d.cs2_horas), totalHoras: n(d.total_horas), privado: d.privado === true };
}

function lerCs(d: Record<string, unknown>): StatsCs | null {
  const premier = n(d.premier), gc = n(d.gc);
  return premier === null && gc === null ? null : { premier, gc };
}

/** Confere a resposta da função (vem do servidor, mas confere mesmo assim) e separa por fonte. */
export function lerNumeros(resp: unknown): NumerosFicha {
  const out: NumerosFicha = { lol: null, steam: null, cs: null, avisos: [] };
  if (!resp || typeof resp !== "object") return out;
  const r = resp as { linhas?: unknown; avisos?: unknown };
  if (Array.isArray(r.avisos)) out.avisos = r.avisos.filter((a): a is string => typeof a === "string").map((a) => a.slice(0, 160)).slice(0, 4);
  if (!Array.isArray(r.linhas)) return out;
  for (const l of r.linhas.slice(0, 4)) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    const dados = o.dados && typeof o.dados === "object" ? (o.dados as Record<string, unknown>) : {};
    const base = { erro: s(o.erro, 160), atualizado: Date.parse(String(o.atualizado)) || 0 };
    if (o.fonte === "lol") out.lol = { ...base, dados: lerLol(dados) };
    if (o.fonte === "steam") out.steam = { ...base, dados: lerSteam(dados) };
    if (o.fonte === "cs") out.cs = { ...base, dados: lerCs(dados) };
  }
  return out;
}

const TIER: Record<string, string> = {
  IRON: "Ferro", BRONZE: "Bronze", SILVER: "Prata", GOLD: "Ouro", PLATINUM: "Platina", EMERALD: "Esmeralda",
  DIAMOND: "Diamante", MASTER: "Mestre", GRANDMASTER: "Grão-Mestre", CHALLENGER: "Desafiante",
};
/** Elos de cima não têm divisão (Mestre, Grão-Mestre e Desafiante). */
const SEM_DIVISAO = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

/** "GOLD" + "II" → "Ouro II"; sem ranqueada → "Sem elo". */
export function eloTexto(l: Pick<StatsLol, "tier" | "rank">): string {
  if (!l.tier) return "Sem elo";
  const nome = TIER[l.tier] ?? l.tier;
  return SEM_DIVISAO.has(l.tier) || !l.rank ? nome : `${nome} ${l.rank}`;
}

/** Porcentagem de vitórias (arredondada), ou null sem partidas. */
export function taxaVitoria(v: number, d: number): number | null {
  return v + d > 0 ? Math.round((v / (v + d)) * 100) : null;
}

/** 3.14 → "3,1". */
export const kdaTexto = (k: number) => k.toFixed(1).replace(".", ",");

/** 1284 → "1.284". */
export const horasTexto = (h: number) => String(Math.round(h)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Premier e GC numa linha: "Premier 12.043 · GC nível 13"; null sem nenhum dos dois. */
export function csTexto(c: StatsCs | null | undefined): string | null {
  if (!c) return null;
  const partes = [c.premier !== null ? `Premier ${horasTexto(c.premier)}` : "", c.gc !== null ? `GC nível ${c.gc}` : ""].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

/** "atualizado agora", "há 5 min", "há 3 h", "há 2 dias". */
export function haQuanto(ms: number, agora = Date.now()): string {
  const min = Math.floor(Math.max(0, agora - ms) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}
