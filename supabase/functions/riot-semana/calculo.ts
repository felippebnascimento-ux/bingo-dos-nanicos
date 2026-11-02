// Troféus da semana: a regra pura do cálculo (sem Riot, sem banco), testada no site com Vitest
// (src/features/trofeus/calculo.test.ts). A função riot-semana só junta as partidas e chama aqui.

/** Os números de um nanico numa partida (só dos nanicos: nada de terceiros). */
export type NanicoNaPartida = { fid: string; k: number; d: number; a: number; visao: number };
/** Uma partida da semana: duração em segundos e os nanicos que estavam nela. */
export type PartidaSemana = { id: string; duracao: number; nanicos: NanicoNaPartida[] };

export type TrofeuId = "feeder" | "turista" | "piano" | "viciado" | "sumido";
export type LinhaTrofeu = { trofeu: TrofeuId; posicao: number; fid: string; valor: number; partidas: number };

/** Carregou o piano só vale com pelo menos 5 partidas na semana. */
export const MIN_PIANO = 5;

type Soma = { fid: string; partidas: number; k: number; d: number; a: number; visao: number; minutos: number; comGrupo: number };

/** Junta as partidas por nanico (cada partida conta uma vez, mesmo vindo de mais de um nanico). */
export function somar(partidas: readonly PartidaSemana[]): Soma[] {
  const vistas = new Set<string>();
  const por = new Map<string, Soma>();
  for (const p of partidas) {
    if (vistas.has(p.id)) continue;
    vistas.add(p.id);
    const minutos = Math.max(1, p.duracao) / 60;
    const juntos = new Set(p.nanicos.map((n) => n.fid)).size;
    for (const n of p.nanicos) {
      const s = por.get(n.fid) ?? { fid: n.fid, partidas: 0, k: 0, d: 0, a: 0, visao: 0, minutos: 0, comGrupo: 0 };
      s.partidas++;
      s.k += n.k;
      s.d += n.d;
      s.a += n.a;
      s.visao += n.visao;
      s.minutos += minutos;
      if (juntos > 1) s.comGrupo++;
      por.set(n.fid, s);
    }
  }
  return [...por.values()];
}

const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;

/** Os 3 primeiros de um troféu. No empate do número, vence quem tem mais partidas (e depois o id, para ser estável). */
function podio(trofeu: TrofeuId, lista: { fid: string; valor: number; partidas: number }[], maiorMelhor: boolean): LinhaTrofeu[] {
  return [...lista]
    .sort((x, y) => (maiorMelhor ? y.valor - x.valor : x.valor - y.valor) || y.partidas - x.partidas || (x.fid < y.fid ? -1 : 1))
    .slice(0, 3)
    .map((l, i) => ({ trofeu, posicao: i + 1, fid: l.fid, valor: l.valor, partidas: l.partidas }));
}

/** Calcula o pódio de cada troféu da semana. */
export function calcularTrofeus(partidas: readonly PartidaSemana[]): LinhaTrofeu[] {
  const s = somar(partidas).filter((x) => x.partidas > 0);
  return [
    /* Feeder: mais mortes por partida */
    ...podio("feeder", s.map((x) => ({ fid: x.fid, valor: arred(x.d / x.partidas, 1), partidas: x.partidas })), true),
    /* Turista: menor placar de visão por minuto */
    ...podio("turista", s.map((x) => ({ fid: x.fid, valor: arred(x.visao / x.minutos), partidas: x.partidas })), false),
    /* Carregou o piano: melhor KDA, com pelo menos 5 partidas */
    ...podio(
      "piano",
      s.filter((x) => x.partidas >= MIN_PIANO).map((x) => ({ fid: x.fid, valor: arred((x.k + x.a) / Math.max(1, x.d)), partidas: x.partidas })),
      true,
    ),
    /* Viciado: quem jogou mais */
    ...podio("viciado", s.map((x) => ({ fid: x.fid, valor: x.partidas, partidas: x.partidas })), true),
    /* Sumido: jogou, mas nenhuma partida com alguém do grupo */
    ...podio("sumido", s.filter((x) => x.comGrupo === 0).map((x) => ({ fid: x.fid, valor: x.partidas, partidas: x.partidas })), true),
  ];
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
