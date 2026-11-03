import { describe, expect, it } from "vitest";
import { ladosDe, lerItens, lerTroca } from "./trocas";

const linha = { id: 7, de: "a", para: "b", estado: "aberta", de_itens: { cigarro: 2 }, para_itens: {}, de_moedas: 10, para_moedas: 0, de_ok: true, para_ok: false };

describe("troca entre nanicos", () => {
  it("confere os itens", () => {
    expect(lerItens({ a: 1, b: 0, c: 21, d: 1.5, e: "2" })).toEqual({ a: 1 });
    expect(lerItens([1, 2])).toEqual({});
  });
  it("lê a linha e separa os lados", () => {
    const t = lerTroca(linha)!;
    expect(t.ladoDe).toEqual({ itens: { cigarro: 2 }, moedas: 10, ok: true });
    expect(ladosDe(t, "b").meu.ok).toBe(false);
    expect(ladosDe(t, "b").dele.moedas).toBe(10);
    expect(ladosDe(t, "b").outro).toBe("a");
    expect(lerTroca({ ...linha, estado: "x" })).toBeNull();
  });
});
