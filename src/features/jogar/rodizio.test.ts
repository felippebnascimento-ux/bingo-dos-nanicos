import { describe, expect, it } from "vitest";
import { anguloFinal, candidatos, rodadaNova, seguidas, sugestaoDeSaida } from "./rodizio";

const nomes = { a: "Pitoco", b: "Alemão", c: "Veião", d: "Gamer" };

describe("roleta do rodízio", () => {
  it("candidatos em ordem de nome, sem quem já entrou", () => {
    expect(candidatos(["a", "b", "c", "d"], [], nomes)).toEqual(["b", "d", "a", "c"]);
    expect(candidatos(["a", "b", "c", "d"], ["b", "a"], nomes)).toEqual(["d", "c"]);
    expect(candidatos(["a", "x"], [], nomes)).toEqual(["a"]);
  });

  it("rodada nova quando acabam os candidatos", () => {
    expect(rodadaNova(["a", "b"], ["a", "b"], nomes)).toBe(true);
    expect(rodadaNova(["a", "b"], ["a"], nomes)).toBe(false);
    expect(rodadaNova([], [], nomes)).toBe(false);
  });

  it("o ângulo final deixa o ponteiro (topo) no meio da fatia certa", () => {
    for (const total of [1, 2, 4, 7]) {
      for (let i = 0; i < total; i++) {
        const giro = anguloFinal(i, total, 5);
        expect(giro).toBeGreaterThanOrEqual(360 * 5);
        /* a fatia i, depois de girar, tem o meio em (i + 0,5) × fatia + giro; tem que cair no 0 (topo) */
        const fatia = 360 / total;
        const meio = ((i + 0.5) * fatia + giro) % 360;
        expect(Math.min(meio, 360 - meio)).toBeLessThan(1e-9);
        /* e o ponto do topo fica dentro da fatia i */
        const topoNaRoda = (((360 - (giro % 360)) % 360) + 360) % 360;
        expect(Math.floor(topoNaRoda / fatia)).toBe(i);
      }
    }
  });

  it("partidas seguidas e sugestão de saída (empate: rota de cima)", () => {
    const lineup = [{ friendId: "a" }, { friendId: "b" }, { friendId: "c" }, { friendId: "d" }, { friendId: "e" }];
    const noTime = { a: 3, b: 1, c: 1, d: 4, e: 2 };
    expect(seguidas(noTime, 4, "b")).toBe(4);
    expect(seguidas(noTime, 4, "d")).toBe(1);
    expect(seguidas(noTime, 4, "z")).toBe(5);
    expect(sugestaoDeSaida(lineup, noTime, 4)).toBe(1);
    expect(sugestaoDeSaida([{ friendId: "a" }, { friendId: "" }], noTime, 4)).toBe(1);
  });
});
