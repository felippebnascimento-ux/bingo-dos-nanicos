import { describe, expect, it } from "vitest";
import { acabou, apostaValida, atalhosDo, bolinhas, colunaDaZona, decidido, lerDuelo, lerListaDuelo, meuPapel, momento, nomeCobranca, quemBate, tempoRestante } from "./dueloRegras";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const t0 = Date.parse("2026-11-03T22:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("pênalti x1", () => {
  it("quem abriu bate as ímpares", () => {
    expect(quemBate(1)).toBe("criador");
    expect(quemBate(2)).toBe("desafiante");
    expect(quemBate(11)).toBe("criador");
  });

  it("para quando um lado não alcança mais o outro (= duelo_decidido)", () => {
    // 3 × 0 depois de 3 do criador e 3 do desafiante: faltam 2 para o desafiante, não alcança
    expect(decidido(6, 3, 0)).toBe(true);
    // 2 × 0 depois de 3 e 2: o desafiante ainda tem 3
    expect(decidido(5, 2, 0)).toBe(false);
    // 3 × 0 depois de 3 e 2: faltam 3, ainda dá para empatar
    expect(decidido(5, 3, 0)).toBe(false);
    // 3 × 0 depois de 4 e 3: faltam 2 para o desafiante
    expect(decidido(7, 3, 0)).toBe(true);
    // o desafiante na frente: 0 × 3 depois de 4 e 3, o criador tem só 1
    expect(decidido(7, 0, 3)).toBe(true);
    // 10 cobranças: decide se não empatou
    expect(decidido(10, 4, 3)).toBe(true);
    expect(decidido(10, 3, 3)).toBe(false);
  });

  it("morte súbita só decide no fim de cada par, e a 30ª empatada acaba", () => {
    expect(decidido(11, 4, 3)).toBe(false);
    expect(decidido(12, 4, 3)).toBe(true);
    expect(decidido(12, 4, 4)).toBe(false);
    expect(acabou(30, 8, 8)).toBe(true);
    expect(acabou(29, 8, 7)).toBe(false);
  });

  it("aposta de 10 até o saldo, inteira; all-in vale", () => {
    expect(apostaValida(10, 500)).toBe(true);
    expect(apostaValida(500, 500)).toBe(true);
    expect(apostaValida(9, 500)).toBe(false);
    expect(apostaValida(501, 500)).toBe(false);
    expect(apostaValida(12.5, 500)).toBe(false);
    expect(atalhosDo(120)).toEqual([10, 50, 100]);
  });

  it("colunas dos cantos para o pulo do goleiro", () => {
    expect([colunaDaZona("sup_esq"), colunaDaZona("esq"), colunaDaZona("meio"), colunaDaZona("dir"), colunaDaZona("sup_dir")]).toEqual([0, 0, 1, 2, 2]);
  });

  it("lê o estado com cuidado e esconde o que não deve", () => {
    const d = lerDuelo({
      id: 7,
      criador: A,
      desafiante: B,
      aposta: 250,
      estado: "jogando",
      gols_criador: 1,
      gols_desafiante: 0,
      agora: iso(t0 + 5000),
      expira_em: iso(t0 + 600000),
      chutes: [
        { n: 2, batedor: B, goleiro: A, zona_batedor: "meio", zona_goleiro: "meio", gol: false, resolvido_em: iso(t0 + 2000) },
        { n: 1, batedor: A, goleiro: B, zona_batedor: "esq", zona_goleiro: "dir", gol: true, resolvido_em: iso(t0) },
        { n: 3, batedor: A, goleiro: B, zona_batedor: "<b>", zona_goleiro: "dir", gol: true, resolvido_em: iso(t0) },
      ],
      atual: { n: 3, batedor: A, goleiro: B, abre_em: iso(t0 + 5000), ate: iso(t0 + 20000), batedor_escolheu: true, goleiro_escolheu: false, minha: "sup_dir" },
    });
    expect(d).not.toBeNull();
    expect(d!.chutes.map((c) => c.n)).toEqual([1, 2]);
    expect(d!.atual?.minha).toBe("sup_dir");
    expect(meuPapel(d!, A)).toBe("batedor");
    expect(meuPapel(d!, B)).toBe("goleiro");
    expect(meuPapel(d!, "outro")).toBe("plateia");
    expect(bolinhas(d!, "criador")).toEqual(["gol", null, null, null, null]);
    expect(bolinhas(d!, "desafiante")).toEqual(["perdeu", null, null, null, null]);
    expect(lerDuelo({ id: 1, criador: A, estado: "hackeado", agora: iso(t0) })).toBeNull();
    expect(lerDuelo(null)).toBeNull();
    expect(lerListaDuelo([{ id: 3, criador: A, estado: "aberto", aposta: 50 }, { id: "x" }, 5])).toHaveLength(1);
    expect(lerListaDuelo("nada")).toEqual([]);
  });

  it("momento: o lance fica 3 s na tela, depois é a vez de escolher", () => {
    const base = lerDuelo({
      id: 1, criador: A, desafiante: B, aposta: 10, estado: "jogando", agora: iso(t0),
      chutes: [{ n: 1, batedor: A, goleiro: B, zona_batedor: "esq", zona_goleiro: "dir", gol: true, resolvido_em: iso(t0) }],
      atual: { n: 2, batedor: B, goleiro: A, abre_em: iso(t0 + 3000), ate: iso(t0 + 18000) },
    })!;
    expect(momento(base, t0 + 1000)).toBe("lance");
    expect(momento(base, t0 + 3500)).toBe("escolher");
    expect(momento({ ...base, estado: "fim", atual: null }, t0 + 1000)).toBe("lance");
    expect(momento({ ...base, estado: "fim", atual: null }, t0 + 5000)).toBe("fim");
    expect(tempoRestante(base.atual!, t0 + 10500)).toEqual({ fracao: 0.5, segundos: 8 });
    expect(tempoRestante(base.atual!, t0)).toEqual({ fracao: 1, segundos: 15 });
    expect(tempoRestante(base.atual!, t0 + 99999).segundos).toBe(0);
  });

  it("nome da cobrança", () => {
    expect(nomeCobranca(1)).toBe("1ª cobrança de 5");
    expect(nomeCobranca(10)).toBe("5ª cobrança de 5");
    expect(nomeCobranca(11)).toBe("Morte súbita · 1º par");
    expect(nomeCobranca(14)).toBe("Morte súbita · 2º par");
  });
});
