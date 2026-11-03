import { describe, expect, it } from "vitest";
import { comandoAcao, lerAcao, marcarAcao, pararAcao, useAcoes } from "./acoes";

describe("ações do boneco", () => {
  it("lê só as ações da lista", () => {
    expect(lerAcao("danca")).toBe("danca");
    for (const v of ["voar", "", null, 1, { tipo: "danca" }]) expect(lerAcao(v)).toBeNull();
  });
  it("atalhos do chat", () => {
    expect(comandoAcao("o/")).toBe("acena");
    expect(comandoAcao("  :Dançar ")).toBe("danca");
    expect(comandoAcao(":deitar")).toBe("deita");
    expect(comandoAcao("o/ galera")).toBeNull();
    expect(comandoAcao("dançar")).toBeNull();
  });
  it("marcar e parar", () => {
    marcarAcao("n:1", "danca");
    expect(useAcoes.getState().por["n:1"]?.tipo).toBe("danca");
    pararAcao("n:1");
    expect(useAcoes.getState().por["n:1"]).toBeUndefined();
  });
});
