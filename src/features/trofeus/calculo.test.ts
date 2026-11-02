import { describe, expect, it } from "vitest";
import { calcularTrofeus, semanaAnterior, somar, type PartidaSemana } from "../../../supabase/functions/riot-semana/calculo";

/* partidas inventadas (nada de dados reais): A e B jogam juntos; C joga sozinho; D só 2 partidas */
const n = (fid: string, k: number, d: number, a: number, visao: number) => ({ fid, k, d, a, visao });
const P = (id: string, min: number, ...nanicos: ReturnType<typeof n>[]): PartidaSemana => ({ id, duracao: min * 60, nanicos });
const partidas: PartidaSemana[] = [
  P("m1", 30, n("A", 10, 2, 5, 30), n("B", 2, 9, 3, 10)),
  P("m2", 30, n("A", 8, 1, 7, 30), n("B", 1, 10, 2, 9)),
  P("m3", 25, n("A", 5, 3, 5, 25)),
  P("m4", 25, n("A", 6, 2, 4, 25)),
  P("m5", 20, n("A", 4, 2, 6, 20)),
  P("m6", 30, n("C", 3, 6, 3, 6)),
  P("m7", 30, n("C", 3, 6, 3, 6)),
  P("m8", 30, n("C", 3, 6, 3, 6)),
  P("m9", 30, n("C", 3, 6, 3, 6)),
  P("m10", 30, n("C", 3, 6, 3, 6)),
  P("m11", 20, n("D", 0, 9, 0, 1)),
  P("m12", 20, n("D", 0, 10, 0, 1)),
  /* a mesma partida vista de novo (veio de outro nanico) não conta duas vezes */
  P("m1", 30, n("A", 10, 2, 5, 30), n("B", 2, 9, 3, 10)),
];
const de = (t: string) => calcularTrofeus(partidas).filter((l) => l.trofeu === t);

describe("troféus da semana", () => {
  it("soma cada partida uma vez e conta quem jogou com o grupo", () => {
    const s = Object.fromEntries(somar(partidas).map((x) => [x.fid, x]));
    expect(s.A.partidas).toBe(5);
    expect(s.A.comGrupo).toBe(2);
    expect(s.C.comGrupo).toBe(0);
  });

  it("feeder: mais mortes por partida", () => {
    expect(de("feeder").map((l) => [l.fid, l.valor])).toEqual([
      ["B", 9.5],
      ["D", 9.5],
      ["C", 6],
    ]);
  });

  it("no empate, vence quem tem mais partidas", () => {
    const empate = calcularTrofeus([P("x1", 20, n("E", 0, 6, 0, 1)), P("x2", 20, n("F", 0, 6, 0, 1)), P("x3", 20, n("F", 0, 6, 0, 1))]);
    expect(empate.filter((l) => l.trofeu === "feeder")[0].fid).toBe("F");
  });

  it("turista: menor visão por minuto", () => {
    expect(de("turista")[0]).toMatchObject({ fid: "D", valor: 0.05 });
  });

  it("carregou o piano: melhor KDA com pelo menos 5 partidas", () => {
    const p = de("piano");
    expect(p.map((l) => l.fid)).toEqual(["A", "C"]);
    expect(p[0].valor).toBe(6);
  });

  it("viciado e sumido", () => {
    expect(de("viciado").slice(0, 2).map((l) => l.fid)).toEqual(["A", "C"]);
    expect(de("sumido").map((l) => l.fid)).toEqual(["C", "D"]);
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
