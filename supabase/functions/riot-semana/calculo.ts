// Hall da fama da semana (LoL e CS2): a regra pura do cálculo (sem Riot, sem Leetify, sem banco), testada no site
// com Vitest (src/features/trofeus/calculo.test.ts). A função riot-semana só junta as partidas e chama aqui.
// Desde 03/11/2026 (pedido do João) os troféus são: quem mais venceu, quem mais perdeu e o melhor KDA, em cada jogo.
// Os antigos (feeder, turista, piano, viciado, sumido) continuam no banco só como histórico.

export type Jogo = "lol" | "cs";
/** Os números de um nanico numa partida (só dos nanicos: nada de terceiros). `v`: venceu (null = empate no CS). */
export type NanicoNaPartida = { fid: string; k: number; d: number; a: number; visao?: number; v?: boolean | null };
/** Uma partida da semana: o jogo, a duração em segundos (só o LoL tem) e os nanicos que estavam nela. */
export type PartidaSemana = { id: string; jogo?: Jogo; duracao: number; nanicos: NanicoNaPartida[] };

export type TrofeuId = "lol_vitorias" | "lol_derrotas" | "lol_kda" | "cs_vitorias" | "cs_derrotas" | "cs_kda";
export type LinhaTrofeu = { trofeu: TrofeuId; posicao: number; fid: string; valor: number; partidas: number };

/** O melhor KDA só vale com pelo menos 3 partidas do jogo na semana. */
export const MIN_KDA = 3;

type Soma = { fid: string; partidas: number; vitorias: number; derrotas: number; k: number; d: number; a: number };

/** Junta as partidas de um jogo por nanico (cada partida conta uma vez, mesmo vindo de mais de um nanico). */
export function somar(partidas: readonly PartidaSemana[], jogo: Jogo): Soma[] {
  const vistas = new Set<string>();
  const por = new Map<string, Soma>();
  for (const p of partidas) {
    if ((p.jogo ?? "lol") !== jogo || vistas.has(p.id)) continue;
    vistas.add(p.id);
    for (const n of p.nanicos) {
      const s = por.get(n.fid) ?? { fid: n.fid, partidas: 0, vitorias: 0, derrotas: 0, k: 0, d: 0, a: 0 };
      s.partidas++;
      if (n.v === true) s.vitorias++;
      if (n.v === false) s.derrotas++;
      s.k += n.k;
      s.d += n.d;
      s.a += n.a;
      por.set(n.fid, s);
    }
  }
  return [...por.values()];
}

const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;

/** Os 3 primeiros de um troféu (só quem tem valor maior que zero). No empate, vence quem jogou mais (e depois o id). */
function podio(trofeu: TrofeuId, lista: { fid: string; valor: number; partidas: number }[]): LinhaTrofeu[] {
  return lista
    .filter((l) => l.valor > 0)
    .sort((x, y) => y.valor - x.valor || y.partidas - x.partidas || (x.fid < y.fid ? -1 : 1))
    .slice(0, 3)
    .map((l, i) => ({ trofeu, posicao: i + 1, fid: l.fid, valor: l.valor, partidas: l.partidas }));
}

/** Calcula o pódio de cada troféu da semana: vitórias, derrotas e KDA, no LoL e no CS2. */
export function calcularTrofeus(partidas: readonly PartidaSemana[]): LinhaTrofeu[] {
  return (["lol", "cs"] as const).flatMap((jogo) => {
    const s = somar(partidas, jogo).filter((x) => x.partidas > 0);
    return [
      ...podio(`${jogo}_vitorias`, s.map((x) => ({ fid: x.fid, valor: x.vitorias, partidas: x.partidas }))),
      ...podio(`${jogo}_derrotas`, s.map((x) => ({ fid: x.fid, valor: x.derrotas, partidas: x.partidas }))),
      ...podio(
        `${jogo}_kda`,
        s.filter((x) => x.partidas >= MIN_KDA).map((x) => ({ fid: x.fid, valor: arred((x.k + x.a) / Math.max(1, x.d)), partidas: x.partidas })),
      ),
    ];
  });
}

/** Segunda-feira (data, horário de Brasília) da semana anterior a `agora`, e o intervalo dela em segundos (UTC). */
export function semanaAnterior(agora: Date): { semana: string; inicio: number; fim: number } {
  /* Brasília fica em UTC−3 o ano todo (sem horário de verão desde 2019) */
  const br = new Date(agora.getTime() - 3 * 3600 * 1000);
  const diaSemana = (br.getUTCDay() + 6) % 7; // segunda = 0
  const segundaAtual = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() - diaSemana);
  const segunda = segundaAtual - 7 * 86400 * 1000;
  const inicio = Math.floor((segunda + 3 * 3600 * 1000) / 1000); // 00:00 de Brasília, em UTC
  return { semana: new Date(segunda).toISOString().slice(0, 10), inicio, fim: inicio + 7 * 86400 };
}

/** Os números de um nanico numa partida do Leetify (v2/matches): abates, mortes, assistências e se o time venceu. */
export function nanicoDoLeetify(fid: string, st: Record<string, unknown>): NanicoNaPartida {
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0);
  const ganhou = n(st.rounds_won), perdeu = n(st.rounds_lost);
  return { fid, k: n(st.total_kills), d: n(st.total_deaths), a: n(st.total_assists), v: ganhou === perdeu ? null : ganhou > perdeu };
}
