import { describe, expect, it } from "vitest";
import { FATIA, ORDEM, R_CASA, anguloDa, norm360, planoDoGiro, quadroDoGiro } from "./roda";

/* gerador simples com semente, para os giros variarem e o teste repetir igual */
const gerador = (s: number) => () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

describe("roda", () => {
  it("tem as 37 casas uma vez cada, com o 0 no topo", () => {
    expect(new Set(ORDEM).size).toBe(37);
    expect(anguloDa(0)).toBe(0);
    expect(anguloDa(32)).toBeCloseTo(FATIA);
    expect(() => anguloDa(37)).toThrow();
  });

  it("a bolinha termina exatamente no centro da casa sorteada, em qualquer giro", () => {
    for (let semente = 1; semente < 300; semente++) {
      const casa = ORDEM[semente % 37];
      const p = planoDoGiro(casa, gerador(semente), semente * 7);
      const fim = quadroDoGiro(p, p.total);
      /* a casa embaixo da bolinha = ângulo da bolinha medido na roda */
      expect(norm360(fim.bola - fim.roda - anguloDa(casa) + 0.0001)).toBeLessThan(0.001);
      expect(fim.raio).toBeCloseTo(R_CASA);
      expect(fim.assentou).toBe(true);
      /* depois de assentar, ela anda junto com a roda */
      const meio = quadroDoGiro(p, (p.assenta + p.total) / 2);
      expect(norm360(meio.bola - meio.roda - anguloDa(casa) + 0.0001)).toBeLessThan(0.001);
    }
  });

  it("não dá saltos: de um quadro (60 fps) para o outro tudo anda pouco", () => {
    for (let semente = 1; semente < 40; semente++) {
      const p = planoDoGiro(ORDEM[semente % 37], gerador(semente));
      let ant = quadroDoGiro(p, 0);
      for (let t = 16; t <= p.total; t += 16) {
        const q = quadroDoGiro(p, t);
        expect(Math.abs(q.roda - ant.roda)).toBeLessThan(12);
        expect(Math.abs(q.bola - ant.bola)).toBeLessThan(40);
        expect(Math.abs(q.raio - ant.raio)).toBeLessThan(0.05);
        ant = q;
      }
    }
  });

  it("cada giro é diferente e a roda gira para um lado e a bolinha para o outro no começo", () => {
    const a = planoDoGiro(17, gerador(3)), b = planoDoGiro(17, gerador(99));
    expect(a.total).not.toBe(b.total);
    const q0 = quadroDoGiro(a, 0), q1 = quadroDoGiro(a, 50);
    expect(q1.roda - q0.roda).toBeGreaterThan(0);
    expect(q1.bola - q0.bola).toBeLessThan(0);
    expect(a.quiques.length).toBeGreaterThanOrEqual(2);
    expect(a.quiques.length).toBeLessThanOrEqual(4);
  });
});
