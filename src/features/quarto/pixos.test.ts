import { describe, expect, it } from "vitest";
import { arrumarPixos } from "./QuartoCena";
import { lugarDePixo } from "./cenas";
import type { Pixo } from "./pixacoes";

const L = Math.hypot(46, 23);
function sorteadas(n: number, semente = 7): Pixo[] {
  let s = semente;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, (_, k) => ({ id: k, userId: null, texto: "PIXO numero " + k + (k % 3 ? " longo demais da conta" : ""), cor: "preto" as const, ...lugarDePixo(r) }));
}

describe("pixações do banheiro (arrumarPixos)", () => {
  it("nenhuma passa da parede", () => {
    for (const x of arrumarPixos(sorteadas(40), L, 150)) {
      expect(x.z).toBeGreaterThanOrEqual(14);
      expect(x.z).toBeLessThanOrEqual(150);
      expect(x.a).toBeGreaterThan(0);
      expect(x.a).toBeLessThan(5);
    }
  });
  it("as que aparecem não ficam uma em cima da outra", () => {
    const out = arrumarPixos(sorteadas(40), L, 150);
    const caixa = (x: (typeof out)[number]) => {
      const meia = ([...x.texto].reduce((s, c) => s + (c === " " ? 5 : /[A-Z0-9]/.test(c) ? 12.2 : 9.4), 0) * 1.05 * x.esc) / L / 2;
      return { a0: x.a - meia, a1: x.a + meia, z0: x.z, z1: x.z + (13 * x.esc) / 1.3 };
    };
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        if (out[i].parede !== out[j].parede) continue;
        const a = caixa(out[i]), b = caixa(out[j]);
        expect(a.a0 < b.a1 && a.a1 > b.a0 && a.z0 < b.z1 && a.z1 > b.z0).toBe(false);
      }
  });
  it("as mais novas sempre aparecem; com a parede lotada, somem as mais antigas", () => {
    const lista = sorteadas(120);
    const out = arrumarPixos(lista, L, 150);
    expect(out.length).toBeLessThan(lista.length);
    const ids = new Set(out.map((x) => x.id));
    for (const x of lista.slice(-8)) expect(ids.has(x.id)).toBe(true);
  });
});
