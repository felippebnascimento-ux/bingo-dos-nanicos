import { describe, expect, it } from "vitest";
import { faltaParaPremio, sequenciaEmRisco, textoTempo } from "./moedas";

describe("tempo online", () => {
  it("bordas de 0, 59, 60 e 61 min", () => {
    expect(textoTempo(0)).toBe("0 min");
    expect(textoTempo(59)).toBe("59 min");
    expect(textoTempo(60)).toBe("1 h");
    expect(textoTempo(61)).toBe("1 h 1 min");
    expect(textoTempo(80)).toBe("1 h 20 min");
    expect(textoTempo(540)).toBe("9 h");
  });
});

describe("sequência", () => {
  it("dias até o prêmio nas bordas 6, 7, 29, 30 e 31", () => {
    expect(faltaParaPremio(0)).toEqual({ dias: 7, premio: 7 });
    expect(faltaParaPremio(6)).toEqual({ dias: 1, premio: 7 });
    expect(faltaParaPremio(7)).toEqual({ dias: 23, premio: 30 });
    expect(faltaParaPremio(29)).toEqual({ dias: 1, premio: 30 });
    expect(faltaParaPremio(30)).toBeNull();
    expect(faltaParaPremio(31)).toBeNull();
  });
  it("em risco só quem tem sequência e não entrou hoje", () => {
    expect(sequenciaEmRisco(5, false)).toBe(true);
    expect(sequenciaEmRisco(5, true)).toBe(false);
    expect(sequenciaEmRisco(0, false)).toBe(false);
  });
});
