import { describe, expect, it } from "vitest";
import { enfeites, formatarValor, podio, rotuloSemana, TROFEUS, type LinhaTrofeu } from "./trofeus";

const L = (semana: string, trofeu: LinhaTrofeu["trofeu"], posicao: number, fid: string, valor: number): LinhaTrofeu => ({ semana, trofeu, posicao, fid, valor, partidas: 5 });
const linhas = [
  L("2026-10-26", "lol_derrotas", 2, "b", 8),
  L("2026-10-26", "lol_derrotas", 1, "a", 9),
  L("2026-10-19", "lol_derrotas", 1, "c", 7),
  L("2026-10-26", "lol_kda", 1, "d", 4.8),
  L("2026-10-26", "cs_derrotas", 1, "e", 6),
  L("2026-10-26", "cs_kda", 1, "e", 1.9),
];

describe("hall da fama na tela", () => {
  it("tem os 7 troféus (3 do LoL, 3 do CS2 e o mais rico)", () => {
    expect(TROFEUS.map((t) => t.id)).toEqual(["lol_vitorias", "lol_kda", "lol_derrotas", "cs_vitorias", "cs_kda", "cs_derrotas", "rico"]);
  });

  it("pódio da semana em ordem", () => {
    expect(podio(linhas, "lol_derrotas", "2026-10-26").map((l) => l.fid)).toEqual(["a", "b"]);
    expect(podio(linhas, "lol_derrotas", "2026-10-19").map((l) => l.fid)).toEqual(["c"]);
    expect(podio(linhas, "cs_vitorias", "2026-10-26")).toEqual([]);
  });

  it("escreve os números", () => {
    expect(formatarValor("lol_vitorias", 1)).toBe("1 vitória");
    expect(formatarValor("cs_vitorias", 12)).toBe("12 vitórias");
    expect(formatarValor("lol_derrotas", 9)).toBe("9 derrotas");
    expect(formatarValor("cs_kda", 4.8)).toBe("KDA 4,80");
    expect(formatarValor("rico", 1284)).toBe("1.284 moedas");
  });

  it("rótulo da semana", () => {
    expect(rotuloSemana("2026-10-26")).toBe("26/10 a 01/11");
  });

  it("enfeites: burro para quem mais perdeu, coroa para o melhor KDA (vale mais) e a coroa de moedas por cima", () => {
    expect(enfeites(linhas, "2026-10-26", null)).toEqual({ a: "burro", d: "coroa", e: "coroa" });
    expect(enfeites(linhas, "2026-10-26", "a")).toEqual({ a: "moedas", d: "coroa", e: "coroa" });
    expect(enfeites([], null, "x")).toEqual({ x: "moedas" });
  });
});
