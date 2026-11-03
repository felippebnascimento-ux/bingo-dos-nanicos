import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/hall/bonecos", () => ({ andarAte: () => {} }));
vi.mock("@/features/live/sonsVoz", () => ({ somDeChegada: () => {} }));

import { descrever, disparadas, lerGatilho } from "./gatilhos";

const R = [
  lerGatilho({ id: 1, dono: "a", quando: "entra", entao: "aviso", texto: "oi" })!,
  lerGatilho({ id: 2, dono: "a", quando: "pisa", pi: 2, pj: 3, entao: "vai", ai: 0, aj: 1 })!,
  lerGatilho({ id: 3, dono: "b", quando: "entra", entao: "campainha" })!,
];

describe("gatilhos no quarto", () => {
  it("confere a regra", () => {
    expect(lerGatilho({ id: 9, dono: "a", quando: "pisa", entao: "aviso", texto: "x" })).toBeNull();
    expect(lerGatilho({ id: 9, dono: "a", quando: "voa", entao: "aviso" })).toBeNull();
  });
  it("só as regras do quarto e do evento", () => {
    expect(disparadas(R, "a", { tipo: "entra" }).map((g) => g.id)).toEqual([1]);
    expect(disparadas(R, "a", { tipo: "pisa", i: 2, j: 3 }).map((g) => g.id)).toEqual([2]);
    expect(disparadas(R, "a", { tipo: "pisa", i: 2, j: 4 })).toEqual([]);
  });
  it("descreve", () => {
    expect(descrever(R[1])).toBe("Quando alguém pisa em 2,3, vai para 0,1");
  });
});
