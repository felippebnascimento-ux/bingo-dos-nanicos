import { describe, expect, it } from "vitest";
import { lerComando } from "./comandos";

const P = [
  { id: "1", name: "Le Bubu" },
  { id: "2", name: "Veião" },
  { id: "3", name: "Pin" },
];

describe("comandos do chat do K-FOFO", () => {
  it("fala normal e grito", () => {
    expect(lerComando(" oi gente ", P)).toEqual({ tipo: "fala", texto: "oi gente", grito: false });
    expect(lerComando("oi", P, true)).toEqual({ tipo: "fala", texto: "oi", grito: true });
    expect(lerComando(":g BORA JOGAR", P)).toEqual({ tipo: "fala", texto: "BORA JOGAR", grito: true });
  });
  it("ações", () => {
    expect(lerComando("o/", P)).toEqual({ tipo: "acao", acao: "acena" });
  });
  it("sussurro acha o nome (com espaço e sem acento)", () => {
    expect(lerComando(":s Le Bubu bora?", P)).toEqual({ tipo: "sussurro", para: "1", texto: "bora?" });
    expect(lerComando(":s veiao segredo", P)).toEqual({ tipo: "sussurro", para: "2", texto: "segredo" });
    expect(lerComando(":s Pinto oi", P).tipo).toBe("erro");
    expect(lerComando(":s Pin", P).tipo).toBe("erro");
  });
});
