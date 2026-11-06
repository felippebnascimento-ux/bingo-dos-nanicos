import { describe, expect, it } from "vitest";
import { ACOES } from "./acoes";
import { ACAO_DO_SITE, CICLO_CONSUMO, HOTEL_PE, NA_BOCA, alturaHotel, direcaoHotel, jeitoDeConsumir, posicaoHotel, quadroAndando, quadroConsumo, quadroHotel } from "./hotel";
import { poseDaAcao } from "./poses";

describe("boneco do Nanico Hotel", () => {
  it("os lados da direita são o espelho e os de cima são de costas", () => {
    expect(direcaoHotel("frente-esquerda")).toEqual({ costas: false, espelha: false });
    expect(direcaoHotel("frente-direita")).toEqual({ costas: false, espelha: true });
    expect(direcaoHotel("costas-esquerda")).toEqual({ costas: true, espelha: false });
    expect(direcaoHotel("costas-direita")).toEqual({ costas: true, espelha: true });
  });

  it("parado usa o desenho 1 de frente e o 3 de costas; o andar troca os passos", () => {
    expect(quadroHotel("idle", false, 0)).toEqual({ col: 1, lin: 0 });
    expect(quadroHotel("idle", true, 0)).toEqual({ col: 3, lin: 0 });
    /* [5, 1, 6, 1]: passo a, parado, passo b, parado */
    expect([1, 2, 3, 4].map((q) => quadroAndando(false, q))).toEqual([
      { col: 0, lin: 1 },
      { col: 1, lin: 0 },
      { col: 1, lin: 1 },
      { col: 1, lin: 0 },
    ]);
    expect(quadroAndando(true, 5)).toEqual(quadroAndando(true, 1));
  });

  it("as ações repetem no tempo de cada quadro", () => {
    /* dançar: [20, 21] a cada 260 ms */
    expect(quadroHotel("dance", false, 0)).toEqual({ col: 0, lin: 4 });
    expect(quadroHotel("dance", false, 300)).toEqual({ col: 1, lin: 4 });
    expect(quadroHotel("dance", false, 600)).toEqual({ col: 0, lin: 4 });
    expect(posicaoHotel({ col: 4, lin: 7 })).toBe("100% 100%");
  });

  it("toda ação do menu tem desenho no hotel e pose na folha antiga", () => {
    for (const a of ACOES) {
      expect(ACAO_DO_SITE[a.id], a.id).toBeTruthy();
      expect(["sentar", "deita", "acena", "danca", "ri", "joinha", "pula", "chao"]).toContain(poseDaAcao(a.id));
    }
  });

  it("consumo: segura e leva à boca no fim do ciclo; o pin tem a mão mais baixa", () => {
    expect(jeitoDeConsumir("fumar", "cigarro")).toBe("smoke");
    expect(jeitoDeConsumir("beber", "pizza")).toBe("eat");
    expect(jeitoDeConsumir("tonto", "whisky")).toBe("drink");
    const segura = quadroConsumo("drink", false, 0);
    const boca = quadroConsumo("drink", false, CICLO_CONSUMO - NA_BOCA + 10);
    expect(segura.naBoca).toBe(false);
    expect(boca.naBoca).toBe(true);
    expect(boca.mao[1]).toBeLessThan(segura.mao[1]);
    expect(quadroConsumo("drink", false, CICLO_CONSUMO).naBoca).toBe(false);
    const pin = quadroConsumo("drink", false, 0, alturaHotel("/arte/hotel/pin.webp"));
    expect(pin.mao[1]).toBeGreaterThan(segura.mao[1]);
    expect(pin.mao[1]).toBeLessThan(HOTEL_PE.y);
  });
});
