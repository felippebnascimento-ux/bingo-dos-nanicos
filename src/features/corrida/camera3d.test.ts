import { describe, expect, it } from "vitest";
import { AREIA_FIM_Y, CERCA_DENTRO_Y, COMPR, H, W, deslocFaixa, escRaia, focoDaCamera, telaX, yRaia } from "./camera3d";

describe("pista da corrida", () => {
  it("as raias ficam na areia, a de dentro mais alta e menor", () => {
    for (let i = 0; i < 8; i++) {
      expect(yRaia(i)).toBeGreaterThan(CERCA_DENTRO_Y);
      expect(yRaia(i)).toBeLessThan(AREIA_FIM_Y);
      expect(yRaia(i)).toBeLessThan(H);
    }
    expect(yRaia(0)).toBeLessThan(yRaia(7));
    expect(escRaia(0)).toBeLessThan(escRaia(7));
    expect(escRaia(7)).toBeCloseTo(1, 1);
  });

  it("o ponto da câmera fica no meio da tela e a faixa se repete sem pular", () => {
    expect(telaX(50, 50)).toBe(W / 2);
    expect(telaX(51, 50)).toBeGreaterThan(W / 2);
    expect(deslocFaixa(0, 1000)).toBe(0);
    expect(deslocFaixa(-1, 1000)).toBeGreaterThanOrEqual(0);
    expect(deslocFaixa(3 + 1000 / 52, 1000)).toBeCloseTo(deslocFaixa(3, 1000), 6);
  });

  it("a câmera fica no portão, segue o líder e para na chegada", () => {
    expect(focoDaCamera("apostas", 0)).toBe(0);
    expect(focoDaCamera("correndo", 60)).toBe(58);
    expect(focoDaCamera("correndo", COMPR + 20)).toBe(COMPR + 6);
    expect(focoDaCamera("fim", 0)).toBe(COMPR + 6);
  });
});

describe("passada do cavalo", () => {
  it("troca de quadro pelo caminho andado e dá a volta nos 8", async () => {
    const { quadroNaPista, QUADROS } = await import("./Cavalo");
    expect(quadroNaPista(0, 200)).toBe(0);
    expect(quadroNaPista(200 / 8, 200)).toBe(1);
    expect(quadroNaPista(200, 200)).toBe(0);
    expect(quadroNaPista(-25, 200)).toBe(QUADROS - 1);
  });
});
