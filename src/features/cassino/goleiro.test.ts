import { describe, expect, it } from "vitest";
import { entre, membro } from "./goleiro";

describe("desenho do goleiro", () => {
  it("membro começa e fecha no mesmo ponto, com dois arcos", () => {
    const d = membro([0, 0], [10, 0], 3, 2);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/A/g)?.length).toBe(2);
    expect(d).not.toContain("NaN");
  });

  it("cápsula reta: lados em cima e embaixo do eixo", () => {
    expect(membro([0, 0], [10, 0], 2, 2)).toContain("M0 2 L10 2");
  });

  it("ponto no meio", () => {
    expect(entre([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
  });
});
