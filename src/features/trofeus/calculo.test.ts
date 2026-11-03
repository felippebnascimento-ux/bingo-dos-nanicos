import { describe, expect, it } from "vitest";
import { calcularTrofeus, MIN_KDA, nanicoDoLeetify, semanaAnterior, somar, type PartidaSemana } from "../../../supabase/functions/riot-semana/calculo";

/* partidas inventadas (nada de dados reais): A e B jogam juntos no LoL; C só no CS; D tem só 2 partidas de LoL */
const n = (fid: string, k: number, d: number, a: number, v: boolean | null) => ({ fid, k, d, a, v });
const L = (id: string, ...nanicos: ReturnType<typeof n>[]): PartidaSemana => ({ id, jogo: "lol", duracao: 1800, nanicos });
const C = (id: string, ...nanicos: ReturnType<typeof n>[]): PartidaSemana => ({ id: "cs:" + id, jogo: "cs", duracao: 0, nanicos });
const partidas: PartidaSemana[] = [
  L("m1", n("A", 10, 2, 5, true), n("B", 2, 9, 3, true)),
  L("m2", n("A", 8, 1, 7, false), n("B", 1, 10, 2, false)),
  L("m3", n("A", 5, 3, 5, true)),
  L("m4", n("B", 0, 8, 1, false)),
  L("m5", n("D", 9, 0, 0, false)),
  L("m6", n("D", 9, 0, 0, false)),
  /* a mesma partida vista de novo (veio de outro nanico) não conta duas vezes */
  L("m1", n("A", 10, 2, 5, true), n("B", 2, 9, 3, true)),
  C("c1", n("C", 20, 10, 5, true)),
  C("c2", n("C", 25, 15, 2, false)),
  C("c3", n("C", 18, 18, 4, null)),
  C("c4", n("A", 30, 5, 5, true)),
];
const de = (t: string) => calcularTrofeus(partidas).filter((l) => l.trofeu === t);

describe("hall da fama da semana (LoL e CS2)", () => {
  it("soma cada partida uma vez e separa os jogos", () => {
    const lol = Object.fromEntries(somar(partidas, "lol").map((x) => [x.fid, x]));
    expect(lol.A).toMatchObject({ partidas: 3, vitorias: 2, derrotas: 1 });
    expect(lol.C).toBeUndefined();
    const cs = Object.fromEntries(somar(partidas, "cs").map((x) => [x.fid, x]));
    expect(cs.C).toMatchObject({ partidas: 3, vitorias: 1, derrotas: 1 });
  });

  it("vitórias e derrotas no LoL", () => {
    expect(de("lol_vitorias").map((l) => [l.fid, l.valor])).toEqual([
      ["A", 2],
      ["B", 1],
    ]);
    expect(de("lol_derrotas").map((l) => [l.fid, l.valor])).toEqual([
      ["B", 2],
      ["D", 2],
      ["A", 1],
    ]);
  });

  it(`melhor KDA só com pelo menos ${MIN_KDA} partidas`, () => {
    expect(de("lol_kda").map((l) => [l.fid, l.valor])).toEqual([
      ["A", 6.67],
      ["B", 0.33],
    ]);
    expect(de("cs_kda").map((l) => l.fid)).toEqual(["C"]);
  });

  it("no CS, empate não é vitória nem derrota", () => {
    expect(de("cs_vitorias").map((l) => l.fid)).toEqual(["C", "A"]);
    expect(de("cs_derrotas").map((l) => l.fid)).toEqual(["C"]);
  });

  it("lê os números do Leetify", () => {
    expect(nanicoDoLeetify("X", { total_kills: 21, total_deaths: 14, total_assists: 3, rounds_won: 13, rounds_lost: 9 })).toEqual({ fid: "X", k: 21, d: 14, a: 3, v: true });
    expect(nanicoDoLeetify("X", { rounds_won: 12, rounds_lost: 12 }).v).toBeNull();
    expect(nanicoDoLeetify("X", { total_kills: "9" }).k).toBe(0);
  });

  it("semana anterior em horário de Brasília (segunda a domingo)", () => {
    /* terça 03/11/2026 10h de Brasília: semana de 26/10 */
    expect(semanaAnterior(new Date("2026-11-03T13:00:00Z")).semana).toBe("2026-10-26");
    /* segunda 02/11/2026 00h30 de Brasília (03h30 UTC): semana de 26/10 */
    const s = semanaAnterior(new Date("2026-11-02T03:30:00Z"));
    expect(s.semana).toBe("2026-10-26");
    expect(new Date(s.inicio * 1000).toISOString()).toBe("2026-10-26T03:00:00.000Z");
    expect(s.fim - s.inicio).toBe(7 * 86400);
    /* domingo 01/11/2026 23h de Brasília (02h UTC de segunda): ainda a semana de 19/10 */
    expect(semanaAnterior(new Date("2026-11-02T02:00:00Z")).semana).toBe("2026-10-19");
  });
});
