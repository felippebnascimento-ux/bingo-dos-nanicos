import { describe, expect, it } from "vitest";
import { ehComandoPresente, lerComando } from "./comandos";

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
  it("reconhece o comando do presente para os outros chats não publicarem", () => {
    expect(ehComandoPresente("/smokecabecinha Pin")).toBe(true);
    expect(ehComandoPresente("  /SMOKECABECINHA")).toBe(true);
    expect(ehComandoPresente("/smokecabecinhas")).toBe(false);
    expect(ehComandoPresente("olha o /smokecabecinha")).toBe(false);
  });
  it("presente dos moderadores: o nome, com ou sem aspas, e nunca vira fala", () => {
    expect(lerComando('/smokecabecinha "Veiao"', P)).toEqual({ tipo: "presente", para: "2", nome: "Veião" });
    expect(lerComando("/smokecabecinha le bubu", P)).toEqual({ tipo: "presente", para: "1", nome: "Le Bubu" });
    expect(lerComando("/SMOKECABECINHA Pin", P)).toEqual({ tipo: "presente", para: "3", nome: "Pin" });
    /* nome que não existe vai ao banco sem id (quem não é moderador ouve só "Comando desconhecido.") */
    expect(lerComando("/smokecabecinha Pinto", P)).toEqual({ tipo: "presente", para: null, nome: "Pinto" });
    expect(lerComando("/smokecabecinha", P)).toEqual({ tipo: "presente", para: null, nome: "" });
  });
});
