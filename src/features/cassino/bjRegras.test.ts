import { describe, expect, it } from "vitest";
import { lerEstado, opcoes, pontos, resultado, sapato, valorDividir, type MaoBj } from "./bjRegras";

const mao = (cartas: string[], extra: Partial<MaoBj> = {}): MaoBj => ({
  id: 1, userId: "a", lugar: 1, mao: 1, aposta: 50, cartas, pontos: pontos(cartas).total, estado: "jogando", dobrou: false, pagou: null, ...extra,
});

describe("blackjack", () => {
  it("conta os pontos como no cassino (Ás 11 ou 1, figuras 10)", () => {
    expect(pontos(["As", "Kd"])).toEqual({ total: 21, macio: true });
    expect(pontos(["As", "Ah", "9c"]).total).toBe(21);
    expect(pontos(["Kd", "Qs", "2h"]).total).toBe(22);
    expect(pontos(["As", "6h"])).toEqual({ total: 17, macio: true });
    expect(pontos(["10s", "X"]).total).toBe(10);
  });

  it("dobra só com duas cartas e divide par igual uma vez (10, J, Q e K valem igual)", () => {
    expect(valorDividir("Kd")).toBe(valorDividir("10s"));
    expect(opcoes(mao(["8s", "8h"]), []).dividir).toBe(true);
    expect(opcoes(mao(["Ks", "10h"]), []).dividir).toBe(true);
    expect(opcoes(mao(["8s", "9h"]), []).dividir).toBe(false);
    expect(opcoes(mao(["8s", "8h"]), [mao(["8c", "3d"], { mao: 2 })]).dividir).toBe(false);
    expect(opcoes(mao(["5s", "3h", "2c"]), []).dobrar).toBe(false);
  });

  it("selo do resultado pelo que o banco pagou", () => {
    expect(resultado(mao(["As", "Kd"], { estado: "blackjack", pagou: 125 }))).toBe("blackjack");
    expect(resultado(mao(["10s", "9d"], { estado: "parou", pagou: 100 }))).toBe("ganhou");
    expect(resultado(mao(["10s", "7d"], { estado: "parou", pagou: 50 }))).toBe("empate");
    expect(resultado(mao(["10s", "6d"], { estado: "parou", pagou: 0 }))).toBe("perdeu");
    expect(resultado(mao(["10s", "6d", "9c"], { estado: "estourou", pagou: 0 }))).toBe("estourou");
  });

  it("refaz o sapato igual ao banco (6 baralhos, mesmo segredo, mesma ordem)", async () => {
    const s = await sapato("ab".repeat(32), 7);
    expect(s).toHaveLength(312);
    /* conferido no Postgres: select (bj_sapato(decode(repeat('ab',32),'hex'), 7))[1:8] */
    expect(s.slice(0, 8)).toEqual(["Kc", "5h", "7h", "Kd", "2h", "As", "Ad", "Ac"]);
    expect(new Set(s).size).toBe(52);
  });

  it("lê o estado do banco sem confiar no formato", () => {
    const e = lerEstado({ agora: "2026-11-03T12:00:00Z", rodada: { id: 3, fase: "jogo", fecha_em: "2026-11-03T12:00:00Z", dealer: ["Qs", "X"], dealer_pontos: 10, vez: 5 }, maos: [{ id: 5, user_id: "a", lugar: 2, mao: 1, aposta: "50", cartas: ["9c", "7h"], pontos: 16, estado: "zzz" }] });
    expect(e?.rodada?.dealer).toEqual(["Qs", "X"]);
    expect(e?.maos[0].estado).toBe("aposta");
    expect(e?.maos[0].aposta).toBe(50);
    expect(lerEstado(null)).toBeNull();
  });
});
