import { describe, expect, it } from "vitest";
import { divisao, retornoEstimado, type Aposta, type Lado } from "./apostas";

/* o mesmo mercado do teste do banco (seção 14): azul 30 + 20, vermelho 50 + 7 */
const exemplo: Aposta[] = [
  { userId: "pitoco", lado: 100, valor: 30 },
  { userId: "john", lado: 200, valor: 50 },
  { userId: "gamer", lado: 100, valor: 20 },
  { userId: "max", lado: 200, valor: 7 },
];

describe("divisao", () => {
  it("paga como o banco: 61 e 40, casa 6", () => {
    const d = divisao(exemplo, 100);
    expect(d.pagos.get("pitoco")).toBe(61);
    expect(d.pagos.get("gamer")).toBe(40);
    expect(d.pagos.get("john")).toBe(0);
    expect(d.casa).toBe(6);
    expect(d.devolvido).toBe(false);
  });

  it("pago + casa nunca passa do total, e o arredondamento nunca paga a mais", () => {
    let semente = 7;
    const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let k = 0; k < 2000; k++) {
      const n = 2 + Math.floor(rnd() * 12);
      const as: Aposta[] = Array.from({ length: n }, (_, i) => ({
        userId: "u" + i,
        lado: (i < 2 ? (i ? 200 : 100) : rnd() < 0.5 ? 100 : 200) as Lado,
        valor: 5 + Math.floor(rnd() * 96),
      }));
      const total = as.reduce((s, a) => s + a.valor, 0);
      const venc: Lado = rnd() < 0.5 ? 100 : 200;
      const d = divisao(as, venc);
      const pago = [...d.pagos.values()].reduce((s, v) => s + v, 0);
      expect(pago + d.casa).toBe(total);
      expect(d.casa).toBeGreaterThanOrEqual(Math.floor(total * 0.05));
      const bolo = as.filter((a) => a.lado === venc).reduce((s, a) => s + a.valor, 0);
      for (const a of as) if (a.lado === venc) expect(d.pagos.get(a.userId)!).toBeLessThanOrEqual(((total - Math.floor(total * 0.05)) * a.valor) / bolo + 1e-9);
    }
  });

  it("remake, sem vencedor ou um lado vazio devolve exatamente o apostado", () => {
    for (const d of [divisao(exemplo, 100, true), divisao(exemplo, null), divisao(exemplo.filter((a) => a.lado === 200), 200)]) {
      expect(d.devolvido).toBe(true);
      expect(d.casa).toBe(0);
      for (const [u, v] of d.pagos) expect(v).toBe(exemplo.find((a) => a.userId === u)!.valor);
    }
  });
});

describe("retornoEstimado", () => {
  it("bate com a divisão depois de apostar", () => {
    expect(retornoEstimado(30, 100, 20, 57)).toBe(61);
    expect(retornoEstimado(30, 100, 50, 57, true)).toBe(61);
  });
  it("sem ninguém do outro lado, volta o apostado", () => {
    expect(retornoEstimado(25, 200, 0, 0)).toBe(25);
    expect(retornoEstimado(25, 200, 0, 40)).toBe(25);
  });
  it("valor inválido dá 0", () => {
    expect(retornoEstimado(0, 100, 10, 10)).toBe(0);
  });
});
