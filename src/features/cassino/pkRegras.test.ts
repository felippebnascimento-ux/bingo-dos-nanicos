import { describe, expect, it } from "vitest";
import { baralhoPk, chanceDeVencer, lerEstadoPk, melhor, nomeDaMao, nomeParcial, opcoesPk, sugestoes, textoAcao, valor5 } from "./pkRegras";

describe("pôquer", () => {
  it("dá a mesma força que o banco (pk_valor5 e pk_melhor, conferidos no Postgres local)", () => {
    expect(valor5(["7h", "7d", "Ac", "Kd", "2s"])).toBe(1163955);
    expect(valor5(["9h", "9d", "9s", "9c", "2h"])).toBe(5778000);
    expect(melhor(["As", "Ah", "2c", "7d", "9c", "Jd", "4s"])?.valor).toBe(1507380);
    expect(melhor(["Ah", "2d", "3s", "4c", "5h", "Kc", "Kd"])?.valor).toBe(3290625);
    expect(melhor(["Kh", "Qh", "2h", "7h", "9c", "Jd", "4h"])?.valor).toBe(4497137);
  });

  it("ordena as mãos como no pôquer", () => {
    expect(valor5(["As", "Ks", "Qs", "Js", "10s"])).toBeGreaterThan(valor5(["9h", "9d", "9s", "9c", "2h"]));
    expect(valor5(["Ah", "2d", "3s", "4c", "5h"])).toBeLessThan(valor5(["2d", "3s", "4c", "5h", "6h"]));
    expect(valor5(["Kh", "Kd", "2s", "2c", "9h"])).toBeGreaterThan(valor5(["Qh", "Qd", "Js", "Jc", "Ah"]));
  });

  it("dá nome à mão", () => {
    expect(nomeDaMao(valor5(["As", "Ks", "Qs", "Js", "10s"]))).toBe("Royal flush");
    expect(nomeDaMao(valor5(["Ah", "2d", "3s", "4c", "5h"]))).toBe("Sequência até o 5");
    expect(nomeDaMao(valor5(["Kh", "Kd", "Ks", "2c", "2h"]))).toBe("Full house: Reis com 2");
    expect(nomeDaMao(valor5(["Kh", "Kd", "2s", "2c", "9h"]))).toBe("Dois pares: Reis e 2");
    expect(nomeDaMao(valor5(["7h", "7d", "Ac", "Kd", "2s"]))).toBe("Par de 7");
    expect(nomeParcial(["Qs", "Qh"], [])).toBe("Par de Damas");
    expect(nomeParcial(["Qs", "Jh"], [])).toBeNull();
  });

  it("acende as 5 cartas da melhor mão", () => {
    expect(melhor(["Kh", "Qh", "2h", "7h", "9c", "Jd", "4h"])?.cartas.sort()).toEqual(["2h", "4h", "7h", "Kh", "Qh"]);
  });

  it("monta o baralho igual ao banco (pk_baralho)", async () => {
    const b = await baralhoPk("ab".repeat(32), 7);
    expect(b.slice(0, 8)).toEqual(["Qc", "3h", "8c", "3s", "8s", "2h", "10h", "9h"]);
    expect(new Set(b).size).toBe(52);
  });

  it("lê o estado e diz o que dá para fazer na vez", () => {
    const e = lerEstadoPk({
      agora: "2026-11-03T12:00:00Z",
      mesa: { id: 1, blind: 20, criada_por: "a", fechada: false },
      lugares: [{ lugar: 1, user_id: "a", fichas: 980, sair: false }, { lugar: 3, user_id: "b", fichas: 990, sair: false }],
      mao: {
        id: 9, fase: "preflop", mesa_cartas: [], pote: 30, aposta: 20, min_aumento: 20, vez: 3, botao: 3, sb: 3, bb: 1,
        jogadores: [{ lugar: 1, user_id: "a", estado: "ativo", na_rodada: 20, total: 20 }, { lugar: 3, user_id: "b", estado: "ativo", na_rodada: 10, total: 10 }],
        minhas: ["As", "Kd"],
      },
    });
    expect(e?.mao?.minhas).toEqual(["As", "Kd"]);
    const o = opcoesPk(e!.mao!, 990, 3);
    expect(o).toMatchObject({ passar: false, pagar: 10, aumentar: true, min: 40, max: 1000 });
    expect(sugestoes(e!.mao!, o).map((s) => s.valor)).toEqual([40, 50, 60]);
    expect(lerEstadoPk({ agora: "x" })).toBeNull();
  });

  it("calcula a chance de vencer como as calculadoras de pôquer (perto dos números conhecidos)", () => {
    /* AA contra uma mão qualquer: ~85%; 72 de naipes diferentes: ~35%; com a quadra feita, ~100% */
    expect(chanceDeVencer(["As", "Ah"], [], 1, 2000)!).toBeGreaterThan(0.81);
    expect(chanceDeVencer(["As", "Ah"], [], 1, 2000)!).toBeLessThan(0.89);
    expect(chanceDeVencer(["7c", "2d"], [], 1, 2000)!).toBeLessThan(0.4);
    expect(chanceDeVencer(["As", "Ah"], ["Ad", "Ac", "2s"], 3, 300)!).toBeGreaterThan(0.99);
    /* mais gente na mão, menos chance */
    expect(chanceDeVencer(["Ks", "Kh"], [], 4, 800)!).toBeLessThan(chanceDeVencer(["Ks", "Kh"], [], 1, 800)!);
    /* a mesma mão dá o mesmo número (não fica pulando) */
    expect(chanceDeVencer(["Qs", "Jh"], ["2c", "9d", "Kh"], 2)).toBe(chanceDeVencer(["Qs", "Jh"], ["2c", "9d", "Kh"], 2));
    expect(chanceDeVencer(["Qs"], [], 2)).toBeNull();
  });

  it("escreve a jogada de cada um", () => {
    expect(textoAcao("aumentou", 1200)).toBe("AUMENTOU 1.200");
    expect(textoAcao("passou", null)).toBe("PASSOU");
    expect(textoAcao(null, 5)).toBeNull();
  });
});
