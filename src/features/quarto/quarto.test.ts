import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cabe, camadasQuarto, diferenca, pisoDo, podeComprarQuarto } from "./quarto";
import exemplos from "./quarto-cabe.fixture.json";

describe("quarto: cabe", () => {
  it("bate com os exemplos (os mesmos que o banco confere na seção 42)", () => {
    for (const x of exemplos) expect(cabe(x.tam, x.ocupados, { i: x.i, j: x.j, w: x.w, d: x.d }), JSON.stringify(x)).toBe(x.cabe);
  });
  it("o SQL confere exatamente os mesmos exemplos", () => {
    const sql = readFileSync("supabase/sql/seguranca.sql", "utf8");
    const m = /-- fixture quarto-cabe \(início\)\s*'(\[[\s\S]*?\])'::jsonb/.exec(sql);
    expect(m, "o trecho do fixture no seguranca.sql").not.toBeNull();
    expect(JSON.parse(m![1])).toEqual(exemplos);
  });
  it("o giro troca largura e fundo", () => {
    expect(pisoDo(2, 1, true)).toEqual({ w: 1, d: 2 });
    expect(pisoDo(2, 1, false)).toEqual({ w: 2, d: 1 });
  });
});

describe("quarto: compra e ordem", () => {
  it("paga só a diferença e não deixa comprar menor ou igual", () => {
    expect(diferenca(8000, 12, { tamanho: 6, preco: 1000 })).toBe(7000);
    expect(diferenca(1000, 6, null)).toBe(1000);
    expect(diferenca(1000, 6, { tamanho: 9, preco: 3000 })).toBeNull();
    expect(podeComprarQuarto(9, 9).ok).toBe(false);
    expect(podeComprarQuarto(6, 12).motivo).toBe("Você já tem um maior");
    expect(podeComprarQuarto(12, 6).ok).toBe(true);
  });
  it("desenha do fundo para a frente", () => {
    const ordem = camadasQuarto([
      { i: 4, j: 4, w: 1, d: 1 },
      { i: 1, j: 1, w: 1, d: 1 },
    ]);
    expect(ordem).toEqual([1, 0]);
  });
});
