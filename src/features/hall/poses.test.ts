import { describe, expect, it } from "vitest";
import { posicaoPose, quadroPose, sequenciaPose, temCostas } from "./poses";

describe("poses desenhadas", () => {
  it("cada pose aponta para a linha certa da folha", () => {
    expect(quadroPose("sentar", false, 0)).toEqual([0, 0]);
    expect(quadroPose("deita", false, 0)).toEqual([3, 0]);
    expect(quadroPose("ri", false, 0)).toEqual([0, 2]);
    expect(quadroPose("chao", false, 0)).toEqual([3, 2]);
    expect(quadroPose("sentar", true, 0)).toEqual([0, 3]);
  });
  it("a dança anda pelos quadros no tempo dela e volta ao começo", () => {
    const s = sequenciaPose("danca", false);
    expect(quadroPose("danca", false, 0)).toEqual(s.q[0]);
    expect(quadroPose("danca", false, s.ms)).toEqual(s.q[1]);
    expect(quadroPose("danca", false, s.ms * s.q.length)).toEqual(s.q[0]);
    expect(quadroPose("acena", false, 280)).toEqual([2, 0]);
  });
  it("de costas, o que não tem desenho vira de frente", () => {
    expect(temCostas("joinha")).toBe(false);
    expect(quadroPose("joinha", true, 0)).toEqual([1, 2]);
    expect(temCostas("danca")).toBe(true);
    expect(quadroPose("danca", true, 300)).toEqual([3, 3]);
  });
  it("posição do quadro na folha 4×4", () => {
    expect(posicaoPose([0, 0])).toBe("0% 0%");
    expect(posicaoPose([3, 3])).toBe("100% 100%");
    expect(posicaoPose([1, 2])).toBe(`${(1 / 3) * 100}% ${(2 / 3) * 100}%`);
  });
});
