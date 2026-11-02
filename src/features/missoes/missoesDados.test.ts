import { describe, expect, it } from "vitest";
import { lerMissoes } from "./missoesDados";

describe("resposta de minhas_missoes()", () => {
  it("lê as missões e o bônus", () => {
    const r = lerMissoes({
      missoes: [
        { id: "chat5", texto: "Mande 5 mensagens no chat", meta: 5, valor: 10, progresso: 3, feita: false },
        { id: "online30", texto: "Fique 30 minutos no site", meta: 30, valor: 10, progresso: 99, feita: true },
      ],
      bonus: 25,
      bonus_pago: false,
    });
    expect(r?.missoes.map((m) => m.id)).toEqual(["chat5", "online30"]);
    expect(r?.missoes[1].progresso).toBe(30);
    expect(r?.bonusPago).toBe(false);
  });
  it("descarta o que não tem o formato certo", () => {
    expect(lerMissoes(null)).toBeNull();
    expect(lerMissoes({ missoes: [{ id: "X Y", texto: "a", meta: 1, valor: 1, progresso: 0 }, { id: "ok", texto: 3 }] })?.missoes).toEqual([]);
  });
});
