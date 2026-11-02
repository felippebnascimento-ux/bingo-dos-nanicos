import { describe, expect, it } from "vitest";
import { arco, cambalear, CAMBALEIO_MS } from "./zoeira";

describe("zoeira no hall", () => {
  const de = { x: 100, y: 200 };
  const para = { x: 500, y: 300 };

  it("o arco sai da cabeça de quem zoa e chega na do alvo", () => {
    expect(arco(de, para, 0)).toEqual(de);
    expect(arco(de, para, 1)).toEqual(para);
    expect(arco(de, para, -1)).toEqual(de);
    expect(arco(de, para, 2)).toEqual(para);
  });

  it("no meio do voo fica acima da reta (sobe e desce)", () => {
    const meio = arco(de, para, 0.5);
    expect(meio.x).toBe(300);
    expect(meio.y).toBeLessThan(250 - 40);
    expect(arco(de, para, 0.25).y).toBeGreaterThan(meio.y);
  });

  it("o cambaleio fica entre -8° e +8° e para depois de ~600 ms", () => {
    for (let ms = 0; ms <= CAMBALEIO_MS + 100; ms += 10) {
      const a = cambalear(ms);
      expect(Math.abs(a)).toBeLessThanOrEqual(8);
    }
    expect(Math.abs(cambalear(5))).toBeGreaterThan(5);
    expect(cambalear(CAMBALEIO_MS)).toBe(0);
    expect(cambalear(-1)).toBe(0);
  });
});
