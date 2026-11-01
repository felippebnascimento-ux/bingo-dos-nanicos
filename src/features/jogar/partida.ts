/* Regras puras da partida ao vivo (Riot): juntar quem está na mesma partida e deduzir a lane de cada um. */
import { LANE_CAMP, LANES } from "@/lib/dados/campeoes";
import type { LineupSlot } from "@/lib/tipos";
import { canon } from "@/lib/util";

/* o que a função riot-ao-vivo devolve (vem de fora: tudo é opcional e conferido na hora de usar) */
export type RiotParticipante = {
  fid?: string | null;
  campeao?: string;
  campeaoId?: number;
  img?: string;
  riotId?: string;
  time?: number;
  feiticos?: number[];
};
export type RiotBan = { campeao?: string; img?: string; time?: number };
export type RiotJogo = {
  gameId?: string | number;
  participantes: RiotParticipante[];
  bans?: RiotBan[];
  queueId?: number;
  modo?: string;
  inicio?: number;
  duracao?: number;
  versao?: string;
};
export type RiotLinha = { friend_id: string; game_id?: string | number | null; jogo?: RiotJogo | null; atualizado?: string };

/** Uma partida com os nanicos que estão nela. `em` é quando o site recebeu o dado (para o relógio). */
export type RiotPartida = { id: string; jogo: RiotJogo; fids: Set<string>; em: number };

/** Junta os nanicos que estão na mesma partida (dado com mais de 5 minutos é ignorado). */
export function riotJogos(linhas: unknown[], agora: number): RiotPartida[] {
  const m = new Map<string, RiotPartida>();
  for (const r of linhas as RiotLinha[]) {
    const j = r && r.jogo;
    if (!j || typeof j !== "object" || !Array.isArray(j.participantes)) continue;
    if (agora - (Date.parse(r.atualizado || "") || 0) > 5 * 60000) continue; /* dado velho: ignora */
    const id = String(j.gameId || r.game_id);
    if (!m.has(id)) m.set(id, { id, jogo: j, fids: new Set(), em: agora });
    m.get(id)!.fids.add(r.friend_id);
  }
  return [...m.values()];
}

/** Quem dos nanicos está em partida agora → nome do campeão. */
export function riotEmJogo(jogos: RiotPartida[]) {
  const o = new Map<string, string>();
  for (const g of jogos)
    for (const p of g.jogo.participantes) if (p && p.fid && g.fids.has(p.fid)) o.set(p.fid, String(p.campeao || ""));
  return o;
}

/** O time (100 ou 200) com mais nanicos. */
export function riotNossoTime(g: RiotPartida) {
  const c: Record<string, number> = {};
  for (const p of g.jogo.participantes) if (p && p.fid && g.fids.has(p.fid)) c[String(p.time)] = (c[String(p.time)] || 0) + 1;
  return Number(Object.keys(c).sort((a, b) => c[b] - c[a])[0]) || 0;
}

/* ---------- lane de cada um ----------
   A Riot não diz a lane durante a partida. Então o site deduz a lane dos 5 do time juntos:
   pela posição mais comum de cada campeão (T=Top J=Jungle M=Mid A=ADC S=Suporte, a primeira é a principal)
   e pelos feitiços (Golpear = Jungle, Teleporte = Top, Curar = ADC, Exaustão = Suporte…).
   Depois testa todas as combinações e fica com a que faz mais sentido. */
const LANE_LETRA = "TJMAS"; /* mesma ordem de LANES: Top, Jungle, Mid, ADC, Suporte */
const PESO_POS = [3, 2, 1.2, 0.8];
/* feitiços: 11 Golpear, 12 Teleporte, 7 Curar, 21 Barreira, 3 Exaustão, 14 Incendiar, 1 Purificar, 6 Fantasma */
const PESO_FEITICO: Record<number, Record<string, number>> = {
  11: { J: 12 },
  12: { T: 2, M: 1 },
  7: { A: 2, S: 0.5 },
  21: { A: 1, M: 0.5 },
  3: { S: 2, A: 0.5 },
  14: { M: 0.7, S: 0.7, T: 0.5 },
  1: { A: 1.5 },
  6: { T: 1, A: 0.7 },
};

/** Quanto faz sentido esse jogador estar nessa lane (0..4). */
export function notaLane(p: RiotParticipante, lane: number) {
  const L = LANE_LETRA[lane],
    pos = LANE_CAMP[canon(String(p.campeao || ""))] || "";
  let n = pos ? (pos.indexOf(L) >= 0 ? PESO_POS[pos.indexOf(L)] || 0.5 : 0) : 0.3;
  const fs = Array.isArray(p.feiticos) ? p.feiticos.map(Number) : [];
  for (const f of fs) {
    const w = PESO_FEITICO[f];
    if (w && w[L]) n += w[L];
  }
  if (L === "J" && !fs.includes(11)) n -= 4; /* jungle sem Golpear é muito raro */
  return n;
}

/** Para cada jogador do time (5), o índice da lane (0..4). Time incompleto: null. */
export function deduzirLanes(time: RiotParticipante[]): number[] | null {
  if (time.length !== 5) return null;
  let melhor: number[] | null = null,
    nota = -Infinity;
  const perm = (a: number[], k = 0) => {
    if (k === a.length) {
      const t = a.reduce((s, l, i) => s + notaLane(time[i], l), 0);
      if (t > nota) {
        nota = t;
        melhor = a.slice();
      }
      return;
    }
    for (let i = k; i < a.length; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      perm(a, k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  };
  perm([0, 1, 2, 3, 4]);
  return melhor;
}

/**
 * Escalação com os nanicos da partida, cada um na lane deduzida.
 * `existe` diz se o id é de um nanico cadastrado. Sem nenhum nanico na partida: null.
 */
export function escalacaoDaPartida(g: RiotPartida, existe: (fid: string) => boolean): LineupSlot[] | null {
  const t = riotNossoTime(g);
  const time = g.jogo.participantes.filter((p) => p && Number(p.time) === t);
  const ps = time.filter((p) => p.fid && g.fids.has(p.fid) && existe(p.fid)).slice(0, 5);
  if (!ps.length) return null;
  const novo: LineupSlot[] = LANES.map(() => ({ friendId: "", champion: "" }));
  const lanes = Number(g.jogo.queueId) === 450 || g.jogo.modo === "ARAM" ? null : deduzirLanes(time);
  const livres = [0, 1, 2, 3, 4];
  const pos = (p: RiotParticipante, i: number) => {
    novo[i] = { friendId: p.fid!, champion: canon(String(p.campeao || "")).slice(0, 30) };
    livres.splice(livres.indexOf(i), 1);
  };
  if (lanes) ps.forEach((p) => pos(p, lanes[time.indexOf(p)]));
  else ps.forEach((p) => pos(p, livres[0])); /* ARAM ou time incompleto: lane não existe, vai em ordem */
  return novo;
}
