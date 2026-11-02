import { describe, expect, it } from "vitest";
import { balanco, doGrupo, equipados, equipavel, lerItem, podeComprar, progressoCompra, restanteEfeito, textoConsumo, type ItemLoja } from "./loja";

const it_ = (id: string, espaco: ItemLoja["espaco"], preco: number, ordem = 0): ItemLoja => ({ id, nome: id, descricao: "", espaco, preco, dados: {}, ordem });
const ITENS = [it_("cadeira-trono", "cadeira", 1500, 2), it_("cadeira-gamer", "cadeira", 600, 1), it_("cigarro", "consumivel", 15), it_("escudo", "escudo", 400), it_("titulo-tilt", "titulo", 300)];

describe("loja", () => {
  it("confere o item vindo do banco", () => {
    expect(lerItem({ id: "x", nome: "X", espaco: "cadeira", preco: 10, dados: { cor: "ouro", anim: "voar" } })?.dados).toEqual({ cor: "ouro", texto: undefined, anim: undefined });
    expect(lerItem({ id: "x", nome: "X", espaco: "foguete", preco: 10 })).toBe(null);
    expect(lerItem({ id: "x", nome: "X", espaco: "mesa", preco: 1.5 })).toBe(null);
  });

  it("agrupa em ordem", () => {
    expect(doGrupo(ITENS, ["cadeira"]).map((i) => i.id)).toEqual(["cadeira-gamer", "cadeira-trono"]);
  });

  it("equipados: um por espaço, só o que se equipa", () => {
    const e = equipados(
      [
        { userId: "u", itemId: "cadeira-trono", qtd: 1, equipado: true },
        { userId: "u", itemId: "cigarro", qtd: 3, equipado: true },
        { userId: "u", itemId: "titulo-tilt", qtd: 1, equipado: false },
      ],
      ITENS,
    );
    expect(Object.keys(e.u)).toEqual(["cadeira"]);
    expect(e.u.cadeira?.id).toBe("cadeira-trono");
  });

  it("pode comprar?", () => {
    expect(podeComprar(ITENS[0], 0, 2000)).toEqual({ ok: true });
    expect(podeComprar(ITENS[0], 1, 2000)).toEqual({ ok: false, motivo: "Na mochila" });
    expect(podeComprar(ITENS[0], 0, 1000)).toEqual({ ok: false, motivo: "Faltam 500" });
    expect(podeComprar(ITENS[2], 5, 100).ok).toBe(true);
    expect(podeComprar(ITENS[3], 3, 9999)).toEqual({ ok: false, motivo: "Máximo de 3" });
  });

  it("balanço do boneco", () => {
    expect(balanco("fumar", 1000)).toBe(0);
    expect(Math.abs(balanco("tremer", 100))).toBeLessThanOrEqual(3);
    expect(balanco("tonto", 1000)).toBe(0);
    expect(balanco("tonto", 99_999_999)).toBe(0);
    /* o efeito repete: a tremedeira volta no ciclo seguinte e para depois do fim */
    expect(Math.abs(balanco("tremer", 14_000 + 100))).toBeGreaterThan(0);
    expect(balanco("tremer", 180_000 + 100)).toBe(0);
  });

  it("tempo que falta do efeito", () => {
    expect(restanteEfeito("beber", 0)).toBe("2:00");
    expect(restanteEfeito("beber", 115_500)).toBe("0:05");
    expect(restanteEfeito("beber", 120_000)).toBe("");
  });

  it("texto do aviso", () => {
    expect(textoConsumo("Pitoco", { id: "cigarro", nome: "Cigarrinho" })).toBe("Pitoco acendeu um cigarrinho");
    expect(textoConsumo("Max", { id: "cerveja", nome: "Latinha gelada" })).toBe("Max tomou uma latinha gelada");
    expect(textoConsumo("DD", { id: "chimarrao", nome: "Chimarrão" })).toBe("DD tomou um chimarrão");
  });
  it("celular: não se equipa e mostra quanto falta", () => {
    expect(equipavel("celular")).toBe(false);
    expect(progressoCompra(3000, 1284)).toEqual({ parte: 0.428, falta: 1716 });
    expect(progressoCompra(3000, 5000)).toEqual({ parte: 1, falta: 0 });
    expect(progressoCompra(3000, null).falta).toBe(3000);
  });
});
