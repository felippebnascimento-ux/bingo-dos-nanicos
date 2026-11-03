import { describe, expect, it } from "vitest";
import { grupoDe, lerGrupo } from "./grupos";

describe("grupos (seção 61)", () => {
  const g = lerGrupo({ id: 1, nome: "Os Nanicos", cor: "ouro", simbolo: "coroa", dono: "a" })!;
  it("confere o grupo", () => {
    expect(g.simbolo).toBe("coroa");
    expect(lerGrupo({ id: 2, nome: "x", cor: "rosa", simbolo: "coroa", dono: "a" })).toBeNull();
    expect(lerGrupo({ id: 2, nome: "x", cor: "ouro", simbolo: "toString", dono: "a" })).toBeNull();
  });
  it("o grupo de alguém", () => {
    expect(grupoDe("b", [g], { b: 1 })?.nome).toBe("Os Nanicos");
    expect(grupoDe("c", [g], { b: 1 })).toBeNull();
  });
});
