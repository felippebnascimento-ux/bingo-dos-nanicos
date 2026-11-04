import { describe, expect, it } from "vitest";
import { ehCenaEspecial, gradeEspecial, portasDoCorredor, TAM_CENA } from "./cenas";

describe("cenas especiais", () => {
  it("só rua e corredor são cenas especiais", () => {
    expect(ehCenaEspecial("rua")).toBe(true);
    expect(ehCenaEspecial("corredor")).toBe(true);
    expect(ehCenaEspecial("f1")).toBe(false);
    expect(ehCenaEspecial(null)).toBe(false);
  });
  it("na rua dá para chegar da porta até os bancos, e os carros e a árvore bloqueiam", () => {
    const g = gradeEspecial("rua");
    expect(g.livre(0, 0)).toBe(true);
    expect(g.livre(5, 5)).toBe(false);
    expect(g.livre(1, 10)).toBe(false);
    expect(g.assentos.length).toBeGreaterThanOrEqual(6);
    expect(g.assentos.every((a) => g.livre(a.chegar.i, a.chegar.j))).toBe(true);
  });
  it("o corredor tem uma porta por nanico, aberta só para quem tem quarto, sem passar da parede", () => {
    const nanicos = Array.from({ length: 14 }, (_, k) => ({ id: "f" + k, name: "N" + String(k).padStart(2, "0"), user_id: k % 3 ? "u" + k : null }));
    const portas = portasDoCorredor(nanicos, (uid) => uid === "u1");
    expect(portas).toHaveLength(14);
    expect(portas.filter((p) => p.aberta).map((p) => p.fid)).toEqual(["f1"]);
    expect(portas.filter((p) => p.parede === "esq")).toHaveLength(7);
    for (const p of portas) {
      expect(p.a).toBeGreaterThan(0);
      expect(p.b).toBeLessThan(TAM_CENA.corredor);
      if (p.parede === "dir") expect(p.a).toBeGreaterThan(1);
    }
  });
});

describe("Pirapó 114 (planta do João)", () => {
  it("da porta do meio do corredor dá para andar até cada cômodo", async () => {
    const { caminho } = await import("@/features/hall/hall");
    const { portaDaCena } = await import("./cenas");
    const g = gradeEspecial("pirapo");
    const porta = portaDaCena("pirapo");
    expect(porta).toEqual({ i: 5, j: 0 });
    expect(g.livre(porta.i, porta.j)).toBe(true);
    /* quarto, cozinha, sala e sacada */
    for (const alvo of [{ i: 1, j: 11 }, { i: 6, j: 12 }, { i: 11, j: 14 }, { i: 15, j: 6 }]) expect(caminho(porta, alvo, g.livre).length).toBeGreaterThan(1);
    /* o lado de fora do prédio não se pisa */
    expect(g.livre(15, 10)).toBe(false);
  });
});
