import { describe, expect, it } from "vitest";
import { bonusDoDia, formatarMoedas, multiplicador, premioSequencia, textoBonus } from "./moedas";

describe("bônus do dia", () => {
  it("bate com a tabela do PLANO", () => {
    expect(bonusDoDia(1)).toBe(30);
    expect(bonusDoDia(2)).toBe(33);
    expect(bonusDoDia(6)).toBe(45);
    expect(bonusDoDia(7)).toBe(48);
    expect(bonusDoDia(11)).toBe(60);
    expect(bonusDoDia(12)).toBe(60);
    expect(bonusDoDia(30)).toBe(60);
  });

  it("o multiplicador para em ×2", () => {
    expect(multiplicador(1)).toBe(1);
    expect(multiplicador(11)).toBe(2);
    expect(multiplicador(50)).toBe(2);
    expect(multiplicador(0)).toBe(1);
  });

  it("prêmio de sequência só no 7º e no 30º dia", () => {
    expect([1, 6, 7, 8, 29, 30, 31].map(premioSequencia)).toEqual([0, 0, 100, 0, 0, 500, 0]);
  });
});

describe("textos", () => {
  it("formata com ponto de milhar", () => {
    expect(formatarMoedas(0)).toBe("0");
    expect(formatarMoedas(999)).toBe("999");
    expect(formatarMoedas(1240)).toBe("1.240");
    expect(formatarMoedas(1234567)).toBe("1.234.567");
    expect(formatarMoedas(-1500)).toBe("-1.500");
  });

  it("monta o aviso do bônus", () => {
    expect(textoBonus(30, 0, 1)).toBe("+30 moedas: bônus do dia");
    expect(textoBonus(45, 0, 6)).toBe("+45 moedas: 6 dias seguidos");
    expect(textoBonus(48, 100, 7)).toBe("+48 moedas e +100 de prêmio: 7 dias seguidos");
  });
});
