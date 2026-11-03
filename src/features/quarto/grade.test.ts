import { describe, expect, it } from "vitest";
import { caminhoNoQuarto, gradeDoQuarto, pisoLivreMaisPerto, posQuarto } from "./grade";

const sofa = { id: 7, desenho: "sofa", ret: { i: 2, j: 2, w: 2, d: 1 }, giro: false };
const tapete = { id: 8, desenho: "tapete-rift", ret: { i: 0, j: 3, w: 2, d: 2 }, giro: false };

describe("quarto: grade", () => {
  const g = gradeDoQuarto(6, [sofa, tapete]);
  it("móvel bloqueia, tapete não, fora do quarto não vale", () => {
    expect(g.livre(2, 2)).toBe(false);
    expect(g.livre(3, 2)).toBe(false);
    expect(g.livre(0, 3)).toBe(true);
    expect(g.livre(6, 0)).toBe(false);
    expect(g.livre(0.5, 1)).toBe(false);
  });
  it("o sofá tem dois lugares, sentando pela frente", () => {
    expect(g.assentos.map((a) => [a.id, a.chegar])).toEqual([
      ["q7-0", { i: 2, j: 3 }],
      ["q7-1", { i: 3, j: 3 }],
    ]);
    const girado = gradeDoQuarto(6, [{ ...sofa, ret: { i: 2, j: 2, w: 1, d: 2 }, giro: true }]);
    expect(girado.assentos.map((a) => a.chegar)).toEqual([
      { i: 3, j: 2 },
      { i: 3, j: 3 },
    ]);
  });
  it("confere a posição de quem chega pela sala", () => {
    expect(posQuarto({ i: 2, j: 3, s: "q7-0" }, g)).toEqual({ i: 2, j: 3, s: "q7-0" });
    expect(posQuarto({ i: 3, j: 3, s: "q7-0" }, g)).toEqual({ i: 3, j: 3 });
    expect(posQuarto({ i: 2, j: 2 }, g)).toBeNull();
    expect(posQuarto({ i: 9, j: 0 }, g)).toBeNull();
    expect(posQuarto("x", g)).toBeNull();
  });
  it("anda desviando e acha o piso livre mais perto", () => {
    const c = caminhoNoQuarto(g, { i: 2, j: 1 }, { i: 2, j: 3 });
    expect(c[0]).toEqual({ i: 2, j: 1 });
    expect(c[c.length - 1]).toEqual({ i: 2, j: 3 });
    expect(c.every((p) => g.livre(p.i, p.j))).toBe(true);
    expect(pisoLivreMaisPerto({ i: 3, j: 2 }, g)).toEqual({ i: 4, j: 2 });
    expect(pisoLivreMaisPerto({ i: 1, j: 1 }, g)).toEqual({ i: 1, j: 1 });
  });
});
