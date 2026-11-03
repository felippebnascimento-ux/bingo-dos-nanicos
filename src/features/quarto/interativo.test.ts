import { describe, expect, it } from "vitest";
import { corDoQuarto, ehInterativo, lerEstado, luzLigada, soDono } from "./interativo";

describe("móveis que fazem algo", () => {
  it("quais são e quem mexe", () => {
    expect(ehInterativo("dado")).toBe(true);
    expect(ehInterativo("sofa")).toBe(false);
    expect(soDono("dado")).toBe(false);
    expect(soDono("regulador")).toBe(true);
  });
  it("confere o estado", () => {
    expect(lerEstado({ n: 4, em: 10 })).toEqual({ n: 4, em: 10 });
    expect(lerEstado({ n: 7, cor: "preto", texto: "", liga: "sim" })).toEqual({});
    expect(lerEstado({ texto: "x".repeat(200) }).texto).toHaveLength(120);
    expect(lerEstado(null)).toEqual({});
  });
  it("luz e cor do quarto", () => {
    expect(luzLigada({})).toBe(true);
    expect(luzLigada({ liga: false })).toBe(false);
    expect(corDoQuarto([{ desenho: "regulador", estado: { cor: "desligado" } }, { desenho: "regulador", estado: { cor: "azul" } }])).toBe("azul");
    expect(corDoQuarto([{ desenho: "sofa" }])).toBeNull();
  });
});
