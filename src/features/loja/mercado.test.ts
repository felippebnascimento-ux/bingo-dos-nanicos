import { describe, expect, it } from "vitest";
import { lerAnuncio, recebe } from "./mercado";

describe("mercado (seção 56)", () => {
  it("o vendedor recebe o preço menos 5% (arredondado para cima a favor da banca)", () => {
    expect(recebe(100)).toBe(95);
    expect(recebe(10)).toBe(9);
    expect(recebe(3001)).toBe(2850);
  });
  it("só lê anúncio aberto e bem formado", () => {
    const r = { id: 1, vendedor: "a", item_id: "cigarro", numero: null, preco: 50, estado: "aberta", criada_em: "2026-11-03T10:00:00Z" };
    expect(lerAnuncio(r)?.preco).toBe(50);
    expect(lerAnuncio({ ...r, estado: "vendida" })).toBeNull();
    expect(lerAnuncio({ ...r, preco: "50" })).toBeNull();
  });
});
