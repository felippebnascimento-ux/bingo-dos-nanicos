import { describe, expect, it } from "vitest";
import {
  TR_TEMPO_MS, trAcao, trBaralho, trDecide, trEmbaralha, trEnvido, trFalta, trFlor, trForca, trNovaMao, trNovaMesa,
  trOpcoes, trPublica, trQuemDeve, trRestante, trTemFlor, trTempoEsgotado, trTime, type Carta, type Mesa,
} from "./engine";
import { trLimpaPub } from "./valida";

/* ---------- ajudantes ---------- */

/** rnd que faz o trEmbaralha devolver exatamente `want` (Fisher-Yates ao contrário). */
function rndPara(want: Carta[]) {
  const d = trBaralho(), seq: number[] = [];
  for (let i = d.length - 1; i > 0; i--) {
    const j = d.indexOf(want[i]);
    seq.push((j + 0.5) / (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  let k = 0;
  return () => seq[k++];
}

/** Baralho que dá estas mãos (lugar 0, 1, …) e o resto em qualquer ordem. */
function baralhoCom(maos: Carta[][]) {
  const topo = maos.flat();
  if (new Set(topo).size !== topo.length) throw new Error("carta repetida nas mãos de teste");
  return [...topo, ...trBaralho().filter((c) => !topo.includes(c))];
}

const NOMES = ["Ana", "Beto", "Caio", "Duda"];
function novaMesa(modo: 2 | 4 = 2, { alvo = 24, comFlor = false } = {}): Mesa {
  const M = trNovaMesa("mesa1234", { fid: "f0", key: "k0", nome: NOMES[0] }, modo, alvo, comFlor);
  for (let i = 1; i < modo; i++) M.lugares[i] = { fid: "f" + i, key: "k" + i, nome: NOMES[i] };
  M.fase = "jogo";
  return M;
}
function dar(M: Mesa, maos: Carta[][]) {
  trNovaMao(M, rndPara(baralhoCom(maos)));
  return M.h!;
}
/** Joga em sequência; falha o teste se alguma jogada for recusada. */
function joga(M: Mesa, ...passos: [number, string, unknown?][]) {
  for (const [s, a, arg] of passos) expect(trAcao(M, s, a, arg), `${s} ${a} ${String(arg ?? "")}`).toBeNull();
}

/* mãos de teste (1 contra 1, Ana é mão) */
const ANA: Carta[] = ["1e", "4c", "5c"]; /* envido 29 */
const BETO: Carta[] = ["7o", "6b", "4o"]; /* envido 31 */

describe("baralho e força", () => {
  it("tem 40 cartas sem 8 e 9, e o rnd controla o embaralhar", () => {
    const d = trBaralho();
    expect(d).toHaveLength(40);
    expect(new Set(d).size).toBe(40);
    expect(d.some((c) => /^[89]/.test(c))).toBe(false);
    const want = baralhoCom([ANA, BETO]);
    expect(trEmbaralha(trBaralho(), rndPara(want))).toEqual(want);
  });

  it("segue a ordem do truco gaudério", () => {
    const ordem = ["1e", "1b", "7e", "7o", "3c", "2o", "1c", "12e", "11b", "10c", "7c", "6o", "5e", "4b"];
    for (let i = 1; i < ordem.length; i++) expect(trForca(ordem[i - 1])).toBeGreaterThan(trForca(ordem[i]));
    expect(trForca("1c")).toBe(trForca("1o"));
    expect(trForca("7c")).toBe(trForca("7b"));
    expect(trForca("3e")).toBe(trForca("3b"));
  });
});

describe("envido e flor", () => {
  it("duas do mesmo naipe = 20 + soma; figuras valem 0; senão a maior", () => {
    expect(trEnvido(["7e", "6e", "1b"])).toBe(33);
    expect(trEnvido(["12c", "11c", "5o"])).toBe(20);
    expect(trEnvido(["12c", "7c", "5o"])).toBe(27);
    expect(trEnvido(["1e", "5b", "7c"])).toBe(7);
    expect(trEnvido(["12e", "10b", "11c"])).toBe(0);
    expect(trEnvido(["7o", "6o", "5o"])).toBe(33);
    expect(trEnvido(ANA)).toBe(29);
    expect(trEnvido(BETO)).toBe(31);
  });

  it("flor: três do mesmo naipe = 20 + soma", () => {
    expect(trTemFlor(["7o", "6o", "5o"])).toBe(true);
    expect(trTemFlor(["7o", "6o", "5c"])).toBe(false);
    expect(trFlor(["7o", "6o", "5o"])).toBe(38);
    expect(trFlor(["12c", "11c", "10c"])).toBe(20);
  });
});

describe("trDecide", () => {
  it("espera pelo menos duas vazas", () => {
    expect(trDecide([], 0)).toBeNull();
    expect(trDecide([1], 0)).toBeNull();
    expect(trDecide([0, 1], 0)).toBeNull();
  });
  it("duas do mesmo time ganham", () => {
    expect(trDecide([0, 0], 1)).toBe(0);
    expect(trDecide([1, 1], 0)).toBe(1);
  });
  it("parda: quem ganhou a outra leva", () => {
    expect(trDecide([-1, 1], 0)).toBe(1);
    expect(trDecide([1, -1], 0)).toBe(1);
    expect(trDecide([-1, -1], 0)).toBeNull();
    expect(trDecide([-1, -1, 0], 1)).toBe(0);
  });
  it("terceira vaza decide; parda na terceira fica com quem ganhou a primeira", () => {
    expect(trDecide([0, 1, 1], 0)).toBe(1);
    expect(trDecide([1, 0, 0], 1)).toBe(0);
    expect(trDecide([0, 1, -1], 1)).toBe(0);
  });
  it("tudo pardo: ganha o time do mano", () => {
    expect(trDecide([-1, -1, -1], 1)).toBe(1);
    expect(trDecide([-1, -1, -1], 0)).toBe(0);
  });
});

describe("trOpcoes", () => {
  it("no começo, só o mano joga e pode trucar ou cantar envido", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    expect(trOpcoes(M, 0)).toEqual({ jogar: true, truco: 2, envido: ["envido", "real", "falta"], quero: false, naoquero: false, mazo: true });
    expect(trOpcoes(M, 1)).toEqual({ jogar: false, truco: null, envido: [], quero: false, naoquero: false, mazo: true });
  });

  it("fora de jogo não tem nada", () => {
    const M = novaMesa();
    M.fase = "espera";
    expect(trOpcoes(M, 0).mazo).toBe(false);
    M.fase = "jogo";
    expect(trOpcoes(M, 0).mazo).toBe(false); /* ainda sem mão */
  });

  it("truco pedido: o outro time responde, pode subir e cantar envido (o envido vem primeiro)", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "truco"]);
    expect(trOpcoes(M, 1)).toEqual({ jogar: false, truco: 3, envido: ["envido", "real", "falta"], quero: true, naoquero: true, mazo: true });
    expect(trOpcoes(M, 0)).toMatchObject({ jogar: false, quero: false, truco: null });
  });

  it("depois de jogar a primeira carta, não dá mais para cantar envido", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "jogar", "4c"]);
    expect(trOpcoes(M, 1)).toMatchObject({ jogar: true, truco: 2, envido: ["envido", "real", "falta"] });
    joga(M, [1, "jogar", "4o"]);
    /* segunda vaza: sem envido */
    const vez = M.h!.vez;
    expect(trOpcoes(M, vez).envido).toEqual([]);
  });

  it("quem aceitou o truco é quem pode subir", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "truco"], [1, "quero"]);
    expect(trOpcoes(M, 0)).toMatchObject({ jogar: true, truco: null, envido: [] });
    joga(M, [0, "jogar", "4c"]);
    expect(trOpcoes(M, 1)).toMatchObject({ jogar: true, truco: 3 });
  });

  it("envido pedido: as subidas permitidas", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "envido", "envido"]);
    expect(trOpcoes(M, 1)).toMatchObject({ quero: true, envido: ["envido", "real", "falta"], truco: null, jogar: false });
    joga(M, [1, "envido", "envido"]);
    expect(trOpcoes(M, 0).envido).toEqual(["real", "falta"]);
    joga(M, [0, "envido", "real"]);
    expect(trOpcoes(M, 1).envido).toEqual(["falta"]);
    joga(M, [1, "envido", "falta"]);
    expect(trOpcoes(M, 0)).toMatchObject({ quero: true, envido: [] });
    expect(trAcao(M, 0, "envido", "envido")).toBe("Agora não dá para cantar isso.");
  });
});

describe("mão inteira", () => {
  it("joga as três vazas e dá 1 ponto a quem ganhou duas", () => {
    const M = novaMesa();
    const h = dar(M, [ANA, BETO]);
    expect(h.mano).toBe(0);
    expect(h.maos[0]).toEqual(ANA);
    expect(h.maos[1]).toEqual(BETO);
    expect(trAcao(M, 1, "jogar", "7o")).toBe("Não é a sua vez.");
    expect(trAcao(M, 0, "jogar", "7o")).toBe("Carta inválida.");
    joga(M, [0, "jogar", "1e"], [1, "jogar", "4o"]);
    expect(h.vazas[0]).toMatchObject({ vence: 0, por: 0 });
    expect(h.vez).toBe(0);
    joga(M, [0, "jogar", "4c"], [1, "jogar", "7o"]);
    expect(h.vazas[1]).toMatchObject({ vence: 1, por: 1 });
    expect(h.vez).toBe(1);
    joga(M, [1, "jogar", "6b"], [0, "jogar", "5c"]);
    expect(h.fim).toEqual({ team: 1, pontos: 1, motivo: "Mão" });
    expect(M.placar).toEqual([0, 1]);
    expect(trAcao(M, 0, "mazo")).toBe("A mão não está em jogo.");
  });

  it("parda na primeira: a segunda decide, e quem puxou a parda começa", () => {
    const M = novaMesa();
    const h = dar(M, [["3e", "1e", "4c"], ["3b", "5o", "6c"]]);
    joga(M, [0, "jogar", "3e"], [1, "jogar", "3b"]);
    expect(h.vazas[0]).toMatchObject({ vence: -1, por: null });
    expect(h.vez).toBe(0);
    joga(M, [0, "jogar", "1e"], [1, "jogar", "5o"]);
    expect(h.fim).toMatchObject({ team: 0, pontos: 1 });
  });

  it("a próxima mão troca o mano", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "mazo"]);
    const h = dar(M, [BETO, ANA]);
    expect(h.mano).toBe(1);
    expect(h.vez).toBe(1);
    expect(h.n).toBe(2);
  });

  it("2 contra 2: a vez roda e carta igual do mesmo time não é parda", () => {
    const M = novaMesa(4);
    const h = dar(M, [["3e", "4b", "5b"], ["4c", "5c", "6c"], ["3b", "6e", "7c"], ["5o", "6o", "4e"]]);
    joga(M, [0, "jogar", "3e"]);
    expect(h.vez).toBe(1);
    joga(M, [1, "jogar", "4c"], [2, "jogar", "3b"], [3, "jogar", "5o"]);
    expect(h.vazas[0]).toMatchObject({ vence: 0, por: 0 });
    expect(trTime(M, 0)).toBe("Ana e Caio");
    expect(trTime(M, 1)).toBe("Beto e Duda");
  });
});

describe("truco, retruco e vale quatro", () => {
  /* Ana ganha as duas primeiras vazas */
  const ganhaAna = (M: Mesa) => joga(M, [0, "jogar", "1e"], [1, "jogar", "4o"], [0, "jogar", "7c"], [1, "jogar", "6b"]);
  const ANA2: Carta[] = ["1e", "5c", "7c"];
  const BETO2: Carta[] = ["4o", "6b", "4b"];

  it("truco querido vale 2", () => {
    const M = novaMesa();
    dar(M, [ANA2, BETO2]);
    joga(M, [0, "truco"], [1, "quero"]);
    expect(M.h!.truco).toEqual({ valor: 2, pend: null, dono: 1 });
    ganhaAna(M);
    expect(M.h!.fim).toEqual({ team: 0, pontos: 2, motivo: "Truco" });
    expect(M.placar).toEqual([2, 0]);
  });

  it("retruco (subir aceita o truco) e vale quatro queridos", () => {
    const M = novaMesa();
    dar(M, [ANA2, BETO2]);
    joga(M, [0, "truco"], [1, "truco"]);
    expect(M.h!.truco.valor).toBe(2);
    expect(M.h!.truco.pend).toMatchObject({ nivel: 3, de: 1 });
    joga(M, [0, "truco"]);
    expect(M.h!.truco.valor).toBe(3);
    expect(trOpcoes(M, 1).truco).toBeNull(); /* vale quatro é o máximo */
    joga(M, [1, "quero"]);
    expect(M.h!.truco.valor).toBe(4);
    ganhaAna(M);
    expect(M.h!.fim).toMatchObject({ team: 0, pontos: 4, motivo: "Vale quatro" });
  });

  it("não querer dá o valor anterior", () => {
    const casos: [number, number, number, string][] = [
      /* subidas, time que leva, pontos, motivo */
      [1, 0, 1, "Truco não querido"],
      [2, 1, 2, "Retruco não querido"],
      [3, 0, 3, "Vale quatro não querido"],
    ];
    for (const [subidas, team, pontos, motivo] of casos) {
      const M = novaMesa();
      dar(M, [ANA2, BETO2]);
      for (let k = 0; k < subidas; k++) joga(M, [k % 2, "truco"]);
      joga(M, [subidas % 2, "naoquero"]);
      expect(M.h!.fim).toEqual({ team, pontos, motivo });
      expect(M.placar[team]).toBe(pontos);
    }
  });
});

describe("envido", () => {
  it("envido querido: ganha o maior (Beto, 31) e leva 2", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "envido", "envido"], [1, "quero"]);
    expect(M.h!.env).toMatchObject({ st: "fim", res: { quem: 1, pts: 31 } });
    expect(M.placar).toEqual([0, 2]);
    /* a mão continua */
    expect(trOpcoes(M, 0).jogar).toBe(true);
  });

  it("empate no envido fica com o mano", () => {
    const M = novaMesa();
    dar(M, [["7e", "6e", "4c"], ["7o", "6o", "4b"]]);
    joga(M, [0, "envido", "real"], [1, "quero"]);
    expect(M.h!.env.res).toEqual({ quem: 0, pts: 33 });
    expect(M.placar).toEqual([3, 0]);
  });

  it("envido + real envido querido vale 5", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "envido", "envido"], [1, "envido", "real"], [0, "quero"]);
    expect(M.placar).toEqual([0, 5]);
  });

  it("não querido: 1 ponto, ou o que já estava aceito", () => {
    let M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "envido", "envido"], [1, "naoquero"]);
    expect(M.placar).toEqual([1, 0]);
    expect(M.h!.env.st).toBe("fim");
    expect(trOpcoes(M, 0).envido).toEqual([]);

    M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "envido", "envido"], [1, "envido", "envido"], [0, "naoquero"]);
    expect(M.placar).toEqual([0, 2]);

    M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "envido", "envido"], [1, "envido", "real"], [0, "envido", "falta"], [1, "naoquero"]);
    expect(M.placar).toEqual([5, 0]);
  });

  it("falta envido vale o que falta para quem está na frente", () => {
    const M = novaMesa(2, { alvo: 24 });
    M.placar = [10, 20];
    expect(trFalta(M)).toBe(4);
    dar(M, [ANA, BETO]);
    joga(M, [0, "envido", "falta"], [1, "quero"]);
    /* Beto (31) ganha e chega a 24: fim de jogo no meio da mão */
    expect(M.placar).toEqual([10, 24]);
    expect(M.fase).toBe("fim");
    expect(M.vencedor).toBe(1);
    expect(M.h!.fim).toMatchObject({ team: 1, pontos: 0, motivo: "fim de jogo" });
  });

  it("falta envido conta pelo placar de quem está na frente, mesmo ganhando quem está atrás", () => {
    const M = novaMesa(2, { alvo: 30 });
    M.placar = [3, 25];
    dar(M, [BETO, ANA]); /* o lugar 0 tem 31 */
    joga(M, [0, "envido", "falta"], [1, "quero"]);
    expect(M.placar).toEqual([8, 25]);
    expect(M.fase).toBe("jogo");
  });
});

describe("mazo", () => {
  it("sem truco: o outro time leva 1", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "mazo"]);
    expect(M.h!.fim).toEqual({ team: 1, pontos: 1, motivo: "Ana foi ao mazo" });
  });

  it("com truco querido: leva o valor da mão", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "truco"], [1, "quero"], [0, "mazo"]);
    expect(M.h!.fim).toMatchObject({ team: 1, pontos: 2 });
  });

  it("com truco pedido pelo outro: é como não querer", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "truco"], [1, "truco"], [0, "mazo"]);
    expect(M.h!.fim).toMatchObject({ team: 1, pontos: 2 });
  });

  it("com envido pedido pelo outro: paga o envido não querido e a mão", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "envido", "envido"], [1, "mazo"]);
    expect(M.placar).toEqual([2, 0]);
    expect(M.log.some((t) => t.startsWith("Envido não querido: +1"))).toBe(true);
  });
});

describe("flor", () => {
  it("é cantada e paga sozinha ao dar as cartas, e fecha o envido", () => {
    const M = novaMesa(2, { comFlor: true });
    dar(M, [["7c", "6c", "5c"], BETO]);
    expect(M.placar).toEqual([3, 0]);
    expect(M.h!.flor).toEqual({ quem: [0], team: 0 });
    expect(M.h!.env.st).toBe("off");
    expect(M.falas[0].txt).toBe("Flor! (38)");
    expect(trOpcoes(M, 0).envido).toEqual([]);
  });

  it("flor contra flor: a maior leva tudo", () => {
    const M = novaMesa(2, { comFlor: true });
    dar(M, [["1c", "2c", "3c"], ["7o", "6o", "5o"]]);
    expect(M.placar).toEqual([0, 6]);
    expect(M.h!.flor).toEqual({ quem: [0, 1], team: 1 });
    expect(M.log.some((t) => t.startsWith("Flor contra flor: +6"))).toBe(true);
  });

  it("sem flor na mesa, três do mesmo naipe são só envido", () => {
    const M = novaMesa(2, { comFlor: false });
    dar(M, [["7c", "6c", "5c"], BETO]);
    expect(M.placar).toEqual([0, 0]);
    expect(M.h!.flor).toBeNull();
    expect(trOpcoes(M, 0).envido).toHaveLength(3);
  });
});

describe("fim de jogo", () => {
  it("acaba quando um time chega ao alvo", () => {
    const M = novaMesa(2, { alvo: 12 });
    M.placar = [11, 5];
    dar(M, [ANA, BETO]);
    joga(M, [0, "truco"], [1, "naoquero"]);
    expect(M.placar).toEqual([12, 5]);
    expect(M.fase).toBe("fim");
    expect(M.vencedor).toBe(0);
    expect(trOpcoes(M, 0).mazo).toBe(false);
    expect(trAcao(M, 1, "mazo")).toBe("A mão não está em jogo.");
  });
});

describe("mesa pública", () => {
  it("esconde as cartas na mão e a sala aceita a mesa conferida", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "jogar", "1e"]);
    const pub = trPublica(M);
    expect(pub.h!.nc).toEqual({ 0: 2, 1: 3 });
    expect(pub.h!.sobra).toBeNull();
    const js = JSON.stringify(pub);
    for (const c of ["4c", "5c", ...BETO]) expect(js.includes(`"${c}"`)).toBe(false);
    expect(trLimpaPub(JSON.parse(js), M.host)).toEqual(pub);
    /* a cópia não muda quando a mesa muda */
    joga(M, [1, "jogar", "4o"]);
    expect(pub.h!.vazas[0].cartas).toHaveLength(1);
  });

  it("no fim da mão mostra o que sobrou", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    joga(M, [0, "mazo"]);
    expect(trPublica(M).h!.sobra).toEqual({ 0: ANA, 1: BETO });
  });

  it("recusa mesa mal formada", () => {
    const M = novaMesa();
    dar(M, [ANA, BETO]);
    const pub = JSON.parse(JSON.stringify(trPublica(M)));
    expect(trLimpaPub(pub, "outro")).toBeNull(); /* só o anfitrião manda a mesa */
    expect(trLimpaPub({ ...pub, modo: 3 }, M.host)).toBeNull();
    expect(trLimpaPub({ ...pub, id: "X!" }, M.host)).toBeNull();
    expect(trLimpaPub({ ...pub, lugares: [pub.lugares[0]] }, M.host)).toBeNull();
    expect(trLimpaPub({ ...pub, h: { ...pub.h, vazas: "nada" } }, M.host)).toBeNull();
    expect(trLimpaPub({ ...pub, h: { ...pub.h, vazas: [{ lider: 0, cartas: [{ s: 0, c: "9e" }], vence: null, por: null }] } }, M.host)).toBeNull();
    expect(trLimpaPub({ ...pub, h: { ...pub.h, truco: { valor: 7, pend: null, dono: null } } }, M.host)).toBeNull();
    /* texto comprido é cortado, não recusado */
    const longo = trLimpaPub({ ...pub, log: ["x".repeat(500)] }, M.host);
    expect(longo!.log[0]).toHaveLength(120);
  });
});

describe("tempo de cada jogada (20 s)", () => {
  it("a mão nova liga o relógio e cada jogada recomeça", () => {
    const M = novaMesa();
    trNovaMao(M, rndPara(baralhoCom([ANA, BETO])), 1000);
    expect(trRestante(M, 1000)).toBe(TR_TEMPO_MS);
    expect(trRestante(M, 6000)).toBe(TR_TEMPO_MS - 5000);
    expect(trAcao(M, 0, "jogar", "4c", 9000)).toBeNull();
    expect(M.h!.desde).toBe(9000);
    expect(trPublica(M).h!.desde).toBe(9000);
  });

  it("antes dos 20 s não faz nada; depois, joga uma carta da mão de quem devia", () => {
    const M = novaMesa();
    trNovaMao(M, rndPara(baralhoCom([ANA, BETO])), 0);
    expect(trTempoEsgotado(M, TR_TEMPO_MS - 1)).toBe(false);
    expect(trQuemDeve(M)).toBe(0);
    expect(trTempoEsgotado(M, TR_TEMPO_MS, () => 0.99)).toBe(true);
    expect(M.h!.vazas[0].cartas).toEqual([{ s: 0, c: "5c" }]);
    expect(M.h!.maos[0]).toEqual(["1e", "4c"]);
    expect(M.h!.vez).toBe(1);
    expect(M.h!.desde).toBe(TR_TEMPO_MS);
  });

  it("pedido sem resposta: o tempo aceita (quero) por quem tinha que responder", () => {
    const M = novaMesa();
    trNovaMao(M, rndPara(baralhoCom([ANA, BETO])), 0);
    expect(trAcao(M, 0, "truco", undefined, 100)).toBeNull();
    expect(trQuemDeve(M)).toBe(1);
    expect(trTempoEsgotado(M, 100 + TR_TEMPO_MS)).toBe(true);
    expect(M.h!.truco).toMatchObject({ valor: 2, pend: null, dono: 1 });
  });

  it("no 2x2, o relógio cobra do primeiro do outro time depois de quem pediu", () => {
    const M = novaMesa(4);
    trNovaMao(M, rndPara(baralhoCom([ANA, BETO, ["2c", "3c", "6c"], ["2o", "3o", "6o"]])), 0);
    const mano = M.h!.mano;
    expect(trAcao(M, mano, "envido", "envido", 0)).toBeNull();
    expect(trQuemDeve(M)).toBe((mano + 1) % 4);
  });

  it("mão que acabou ou mesa antiga (sem relógio) não tem tempo", () => {
    const M = novaMesa();
    trNovaMao(M, rndPara(baralhoCom([ANA, BETO])), 0);
    delete M.h!.desde;
    expect(trRestante(M, 1e9)).toBeNull();
    expect(trTempoEsgotado(M, 1e9)).toBe(false);
    M.h!.desde = 0;
    expect(trAcao(M, 0, "mazo", undefined, 10)).toBeNull();
    expect(trRestante(M, 1e9)).toBeNull();
  });
});
