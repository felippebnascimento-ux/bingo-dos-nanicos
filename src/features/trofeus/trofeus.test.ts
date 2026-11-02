import { describe, expect, it } from "vitest";
import { enfeites, formatarValor, podio, rotuloSemana, TROFEUS, type LinhaTrofeu } from "./trofeus";

const L = (semana: string, trofeu: LinhaTrofeu["trofeu"], posicao: number, fid: string, valor: number): LinhaTrofeu => ({ semana, trofeu, posicao, fid, valor, partidas: 5 });
const linhas = [L("2026-10-26", "feeder", 2, "b", 8), L("2026-10-26", "feeder", 1, "a", 9.1), L("2026-10-19", "feeder", 1, "c", 7), L("2026-10-26", "piano", 1, "d", 4.8)];

describe("troféus na tela", () => {
  it("tem os 6 troféus (5 da semana e o mais rico)", () => {
    expect(TROFEUS.map((t) => t.id)).toEqual(["feeder", "piano", "viciado", "turista", "sumido", "rico"]);
  });

  it("pódio da semana em ordem", () => {
    expect(podio(linhas, "feeder", "2026-10-26").map((l) => l.fid)).toEqual(["a", "b"]);
    expect(podio(linhas, "feeder", "2026-10-19").map((l) => l.fid)).toEqual(["c"]);
    expect(podio(linhas, "turista", "2026-10-26")).toEqual([]);
  });

  it("escreve os números", () => {
    expect(formatarValor("feeder", 9.1)).toBe("9,1 mortes por partida");
    expect(formatarValor("piano", 4.8)).toBe("KDA 4,80");
    expect(formatarValor("viciado", 1)).toBe("1 partida");
    expect(formatarValor("viciado", 31)).toBe("31 partidas");
    expect(formatarValor("turista", 0.4234)).toBe("0,42 de visão por minuto");
  });

  it("rótulo da semana", () => {
    expect(rotuloSemana("2026-10-26")).toBe("26/10 a 01/11");
  });

  it("enfeites: burro, coroa e a coroa de moedas por cima", () => {
    expect(enfeites(linhas, "2026-10-26", null)).toEqual({ a: "burro", d: "coroa" });
    expect(enfeites(linhas, "2026-10-26", "a")).toEqual({ a: "moedas", d: "coroa" });
    expect(enfeites([], null, "x")).toEqual({ x: "moedas" });
  });
});
