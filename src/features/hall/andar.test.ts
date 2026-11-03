import { describe, expect, it } from "vitest";
import { suavizar } from "./hall";

/* velocidade aproximada no ponto t (derivada numérica) */
const vel = (t: number, p: boolean, u: boolean) => (suavizar(Math.min(1, t + 1e-4), p, u) - suavizar(Math.max(0, t - 1e-4), p, u)) / (Math.min(1, t + 1e-4) - Math.max(0, t - 1e-4));

describe("andar suave", () => {
  it("começa em 0 e termina em 1 em todos os casos", () => {
    for (const [p, u] of [[true, true], [true, false], [false, true], [false, false]] as const) {
      expect(suavizar(0, p, u)).toBe(0);
      expect(suavizar(1, p, u)).toBeCloseTo(1, 10);
    }
  });
  it("acelera ao sair, freia ao chegar e emenda sem tranco no meio", () => {
    expect(vel(0, true, false)).toBeCloseTo(0, 2);
    expect(vel(1, true, false)).toBeCloseTo(1, 2);
    expect(vel(0, false, true)).toBeCloseTo(1, 2);
    expect(vel(1, false, true)).toBeCloseTo(0, 2);
    expect(suavizar(0.3, false, false)).toBe(0.3);
  });
});
