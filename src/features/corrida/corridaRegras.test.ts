import { describe, expect, it } from "vitest";
import { custoPonto, custoTreino, estilo, faseEm, forca, ganhou, lerEstado, nomeOk, ordemDeChegada, pesos, pontos, posicao, sorteDosBytes, temposDeChegada, zDe } from "./corridaRegras";

describe("corrida de cavalos", () => {
  it("os pesos somam 1 em toda distância e pista", () => {
    for (const d of [1000, 1600, 2400] as const)
      for (const p of ["leve", "pesada"] as const) {
        const w = pesos(d, p);
        expect(w.v + w.a + w.r).toBeCloseTo(1, 10);
      }
  });
  it("o velocista ganha força no tiro curto e o fundista nos 2.400 m", () => {
    const vel = { v: 90, a: 90, r: 40, c: 50 };
    const fun = { v: 60, a: 40, r: 95, c: 50 };
    expect(forca(vel, 1000, "leve")).toBeGreaterThan(forca(fun, 1000, "leve"));
    expect(forca(fun, 2400, "leve")).toBeGreaterThan(forca(vel, 2400, "leve"));
  });
  it("pontos: a mesma conta do banco (força + espalho × z)", () => {
    const x = { v: 70, a: 60, r: 50, c: 80 };
    expect(pontos(x, 1600, "leve", 0)).toBeCloseTo(0.4 * 70 + 0.25 * 60 + 0.35 * 50, 10);
    expect(pontos(x, 1600, "pesada", 1) - pontos(x, 1600, "pesada", 0)).toBeCloseTo(18 * (1.3 - 0.8), 10);
  });
  it("sorte dos bytes e z", () => {
    const b = new Uint8Array(32);
    b[0] = 0x80; /* 0x80000000 / 2^32 = 0,5 */
    b[4] = 0xff; b[5] = 0xff; b[6] = 0xff; b[7] = 0xff;
    const u = sorteDosBytes(b);
    expect(u[0]).toBe(0.5);
    expect(u[1]).toBeCloseTo(1, 8);
    expect(u[2]).toBe(0);
    expect(zDe([0.5, 0.5, 0.5, 0.5])).toBe(0);
  });
  it("ordem de chegada pelos pontos; empate fica com a raia menor", () => {
    expect(ordemDeChegada([10, 30, 20, 30])).toEqual([1, 3, 2, 0]);
  });
  it("custo do treino cresce e para no 100", () => {
    expect(custoPonto(40)).toBe(40);
    expect(custoTreino(40, 2)).toBe(40 + 43);
    expect(custoTreino(99, 5)).toBe(custoPonto(99));
    expect(custoTreino(100, 1)).toBe(0);
  });
  it("fases pelo relógio", () => {
    const t = { abreEm: 0, apostasEm: 20, fechaEm: 50, fimEm: 70 };
    expect([faseEm(t, 5), faseEm(t, 20), faseEm(t, 60), faseEm(t, 70)]).toEqual(["inscricoes", "apostas", "correndo", "fim"]);
  });
  it("apostas: vencedor, placê e exata", () => {
    const ordem = [3, 5, 0];
    expect(ganhou("vencedor", 3, null, ordem)).toBe(true);
    expect(ganhou("place", 5, null, ordem)).toBe(true);
    expect(ganhou("place", 0, null, ordem)).toBe(false);
    expect(ganhou("exata", 3, 5, ordem)).toBe(true);
    expect(ganhou("exata", 5, 3, ordem)).toBe(false);
  });
  it("o movimento sempre anda para a frente e chega na ordem do banco", () => {
    const pts = [60, 72, 55];
    const tempos = temposDeChegada(pts);
    expect(ordemDeChegada(tempos.map((t) => -t))).toEqual(ordemDeChegada(pts));
    for (const x of [{ v: 50, a: 100, r: 1, c: 50 }, { v: 50, a: 1, r: 100, c: 50 }]) {
      const e = estilo(x, 5);
      let antes = -1;
      for (let s = 0; s <= 1.0001; s += 0.01) {
        const p = posicao(s, e);
        expect(p).toBeGreaterThanOrEqual(antes);
        antes = p;
      }
      expect(posicao(0, e)).toBeCloseTo(0, 10);
      expect(posicao(1, e)).toBeCloseTo(1, 10);
    }
  });
  it("nome de cavalo", () => {
    expect(nomeOk("Pé de Pano")).toBe(true);
    expect(nomeOk("x")).toBe(false);
    expect(nomeOk("<script>")).toBe(false);
    expect(nomeOk("12345")).toBe(false);
  });
  it("lê o estado do banco sem confiar", () => {
    expect(lerEstado(null)).toBeNull();
    expect(lerEstado({ corrida: { distancia: 999 } })).toBeNull();
    const e = lerEstado({
      agora: 5,
      corrida: {
        id: 7, abre_em: "2026-11-05T10:00:00Z", apostas_em: "2026-11-05T10:00:20Z", fecha_em: "2026-11-05T10:00:50Z", fim_em: "2026-11-05T10:01:10Z",
        distancia: 1600, pista: "pesada", inscritos: [], exatas: { "0-1": 12.5, "x": 3 },
        campo: [{ id: 1, nome: "A", pelagem: "baio", v: 50, a: 50, r: 50, c: 50, odd_v: 2, odd_p: 1.3 }, { id: 2, nome: "B", pelagem: "nada", v: 500, odd_v: "3.5" }],
        ordem: [1, 0], pontos: [50, 60],
      },
      minhas: [{ tipo: "vencedor", raia: 1, valor: 10, odd: 3.5 }, { tipo: "hack" }],
    })!;
    expect(e.campo![1].pelagem).toBe("castanho");
    expect(e.campo![1].v).toBe(100);
    expect(e.campo![1].oddV).toBe(3.5);
    expect(e.exatas).toEqual({ "0-1": 12.5 });
    expect(e.ordem).toEqual([1, 0]);
    expect(e.minhas).toHaveLength(1);
  });
});
