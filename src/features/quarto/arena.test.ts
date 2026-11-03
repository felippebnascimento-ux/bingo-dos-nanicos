import { describe, expect, it } from "vitest";
import { faseDa, lerPartida, pisoDe, placar } from "./arena";

describe("arena de pintar o chão", () => {
  const p = lerPartida({ id: 1, estado: "jogando", times: { a: "azul", b: "vermelho", c: "roxo" }, comeca_em: "2026-11-03T10:00:05Z", acaba_em: "2026-11-03T10:01:35Z" })!;
  it("lê a partida e ignora time inválido", () => {
    expect(p.times).toEqual({ a: "azul", b: "vermelho" });
  });
  it("fases pelo relógio", () => {
    expect(faseDa(null, 0)).toBe("esperando");
    expect(faseDa(p, Date.parse("2026-11-03T10:00:01Z"))).toBe("contagem");
    expect(faseDa(p, Date.parse("2026-11-03T10:00:30Z"))).toBe("jogando");
    expect(faseDa(p, Date.parse("2026-11-03T10:02:00Z"))).toBe("fim");
  });
  it("placar e piso do boneco", () => {
    expect(placar({ "1,1": "azul", "1,2": "azul", "3,3": "vermelho" })).toEqual({ azul: 2, vermelho: 1 });
    expect(pisoDe(2, 3)).toBe("2,3");
    expect(pisoDe(2.6, 3.4)).toBe("3,3");
  });
});
