import { describe, expect, it } from "vitest";
import { deduzirLanes, escalacaoDaPartida, notaLane, riotEmJogo, riotJogos, riotNossoTime, type RiotParticipante, type RiotPartida } from "./partida";

/* feitiços: 11 Golpear, 12 Teleporte, 7 Curar, 3 Exaustão, 14 Incendiar, 4 Flash */
const time: RiotParticipante[] = [
  { fid: "a", campeao: "Garen", feiticos: [12, 4], time: 100 },
  { fid: "b", campeao: "Lee Sin", feiticos: [11, 4], time: 100 },
  { fid: "c", campeao: "Ahri", feiticos: [14, 4], time: 100 },
  { campeao: "Jinx", feiticos: [7, 4], time: 100 },
  { campeao: "Thresh", feiticos: [3, 4], time: 100 },
];
const inimigos: RiotParticipante[] = ["Darius", "Vi", "Zed", "Caitlyn", "Lux"].map((campeao) => ({ campeao, time: 200 }));

const partida = (ps: RiotParticipante[], extra: Partial<RiotPartida["jogo"]> = {}): RiotPartida => ({
  id: "1",
  jogo: { participantes: ps, ...extra },
  fids: new Set(["a", "b", "c"]),
  em: 0,
});

describe("lanes", () => {
  it("jungle sem Golpear perde pontos", () => {
    expect(notaLane({ campeao: "Lee Sin", feiticos: [11, 4] }, 1)).toBeGreaterThan(notaLane({ campeao: "Lee Sin", feiticos: [4, 14] }, 1));
  });

  it("deduz a lane de cada um pelo campeão e feitiços", () => {
    expect(deduzirLanes(time)).toEqual([0, 1, 2, 3, 4]);
    const embaralhado = [time[4], time[2], time[0], time[3], time[1]];
    expect(deduzirLanes(embaralhado)).toEqual([4, 2, 0, 3, 1]);
  });

  it("time incompleto não tem lane", () => {
    expect(deduzirLanes(time.slice(0, 4))).toBeNull();
  });
});

describe("partida", () => {
  it("junta os nanicos da mesma partida e ignora dado velho", () => {
    const agora = Date.parse("2026-11-01T12:00:00Z");
    const jogo = { gameId: 9, participantes: time };
    const linhas = [
      { friend_id: "a", game_id: 9, jogo, atualizado: "2026-11-01T11:59:00Z" },
      { friend_id: "b", game_id: 9, jogo, atualizado: "2026-11-01T11:58:00Z" },
      { friend_id: "c", game_id: 7, jogo: { gameId: 7, participantes: [] }, atualizado: "2026-11-01T11:00:00Z" },
      { friend_id: "d", game_id: null, jogo: null },
    ];
    const jogos = riotJogos(linhas, agora);
    expect(jogos).toHaveLength(1);
    expect([...jogos[0].fids]).toEqual(["a", "b"]);
    expect(riotEmJogo(jogos)).toEqual(new Map([["a", "Garen"], ["b", "Lee Sin"]]));
  });

  it("acha o time dos nanicos", () => {
    expect(riotNossoTime(partida([...inimigos, ...time]))).toBe(100);
  });

  it("preenche a escalação na lane deduzida", () => {
    const pl = escalacaoDaPartida(partida([...inimigos, time[2], time[0], time[4], time[1], time[3]]), () => true);
    expect(pl).toEqual([
      { friendId: "a", champion: "Garen" },
      { friendId: "b", champion: "Lee Sin" },
      { friendId: "c", champion: "Ahri" },
      { friendId: "", champion: "" },
      { friendId: "", champion: "" },
    ]);
  });

  it("no ARAM vai em ordem", () => {
    const pl = escalacaoDaPartida(partida([time[2], time[0], time[3]], { queueId: 450 }), () => true);
    expect(pl?.map((x) => x.friendId)).toEqual(["c", "a", "", "", ""]);
  });

  it("sem nanico cadastrado na partida: nada", () => {
    expect(escalacaoDaPartida(partida(time), () => false)).toBeNull();
  });
});
