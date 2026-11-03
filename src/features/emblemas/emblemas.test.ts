import { describe, expect, it } from "vitest";
import { descreverEmblema, lerEmblemas, progressoEmblema } from "./emblemas";

describe("emblemas", () => {
  it("lê só o que é conhecido e põe na ordem", () => {
    const l = lerEmblemas([
      { id: "cassino", nivel: 2, valor: 1060 },
      { id: "online", nivel: 1, valor: 11 },
      { id: "foguete", nivel: 1, valor: 9 },
      { id: "tela", nivel: 4, valor: 2 },
      "lixo",
    ]);
    expect(l.map((e) => e.id)).toEqual(["online", "cassino"]);
    expect(lerEmblemas(null)).toEqual([]);
  });

  it("descreve o nível e o próximo", () => {
    expect(descreverEmblema({ id: "online", nivel: 2, valor: 63 })).toBe("Morador do K-FOFO · prata: 63 h de site aberto (ouro com 200)");
    expect(descreverEmblema({ id: "elo", nivel: 3, valor: 3 })).toBe("Elo alto · ouro: Diamante ou mais no LoL");
    expect(descreverEmblema({ id: "bingo", nivel: 3, valor: 51 })).toBe("Bingo! · ouro: 51 bingos");
  });

  it("mostra quanto falta para o próximo nível", () => {
    expect(progressoEmblema({ id: "online", nivel: 2, valor: 63 })).toEqual({ prox: "ouro", meta: 200, parte: 63 / 200 });
    expect(progressoEmblema({ id: "truco", nivel: 1, valor: 30 })?.parte).toBe(1);
    expect(progressoEmblema({ id: "bingo", nivel: 3, valor: 51 })).toBeNull();
    expect(progressoEmblema({ id: "elo", nivel: 1, valor: 1 })).toBeNull();
  });
});
