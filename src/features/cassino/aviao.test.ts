import { describe, expect, it } from "vitest";
import { curva, faixaVoo, multAt, recebe, tempoAte, textoMult } from "./aviao";

describe("aviãozinho", () => {
  it("o multiplicador começa em 1× e sobe como o banco (e^0,07t, 2 casas para baixo)", () => {
    expect(multAt(0)).toBe(1);
    expect(multAt(10_000)).toBe(2.01);
    expect(multAt(30_000)).toBe(8.16);
    let ant = 0;
    for (let ms = 0; ms < 60_000; ms += 250) {
      expect(multAt(ms)).toBeGreaterThanOrEqual(ant);
      ant = multAt(ms);
    }
  });

  it("tempo até um multiplicador e o que recebe", () => {
    expect(multAt(tempoAte(2) + 1)).toBe(2);
    expect(recebe(25, 2.47)).toBe(61);
    expect(textoMult(2.47)).toBe("2,47×");
    expect([faixaVoo(1.5), faixaVoo(3.87), faixaVoo(12.4)]).toEqual(["lo", "mid", "hi"]);
  });

  it("a curva fica dentro da tela e termina no ponto atual", () => {
    for (const ms of [500, 9000, 40_000]) {
      const c = curva(ms);
      for (const [x, y] of c) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
      expect(c[0]).toEqual([0, 0]);
    }
  });
});
