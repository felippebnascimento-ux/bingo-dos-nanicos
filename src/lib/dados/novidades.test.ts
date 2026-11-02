import { describe, expect, it } from "vitest";
import { CHANGELOG, VERSION, type EntradaLog } from "./changelog";
import { juntarVisto, lerVisto, novidadesDesde, temNovidade, todasAsVersoes, ULTIMA } from "./novidades";

const LISTA: EntradaLog[] = [
  { data: "01/01/2026", itens: ["a"] },
  { data: "02/01/2026", itens: ["b", { t: "c", off: "removido na v1.03" }] },
  { data: "03/01/2026", itens: [{ t: "d", off: "trocado por e na v1.03" }] },
  { data: "04/01/2026", itens: ["e"] },
];

describe("novidadesDesde", () => {
  it("mostra só o que veio depois do que a pessoa viu, da mais nova para a mais antiga", () => {
    expect(novidadesDesde(1, LISTA).map((e) => e.v)).toEqual(["v1.03", "v1.02"]);
  });

  it("quem nunca viu nada recebe só a última", () => {
    expect(novidadesDesde(null, LISTA).map((e) => e.i)).toEqual([3]);
  });

  it("quem já viu a última não recebe nada", () => {
    expect(novidadesDesde(3, LISTA)).toEqual([]);
    expect(novidadesDesde(99, LISTA)).toEqual([]);
  });

  it("item riscado de uma versão nova continua riscado", () => {
    expect(novidadesDesde(1, LISTA)[1].itens[0]).toEqual({ t: "d", off: "trocado por e na v1.03" });
  });

  it("todasAsVersoes devolve o log inteiro", () => {
    expect(todasAsVersoes()).toHaveLength(CHANGELOG.length);
    expect(todasAsVersoes()[0].v).toBe(VERSION);
  });
});

describe("lerVisto", () => {
  it("aceita o número da conta e o texto antigo do navegador", () => {
    expect(lerVisto(12)).toBe(12);
    expect(lerVisto("v1.34")).toBe(34);
    expect(lerVisto(VERSION)).toBe(ULTIMA);
  });

  it("lixo vira null", () => {
    for (const v of [null, undefined, "", "1.34", "v2.01", -1, 1.5, NaN, {}, []]) expect(lerVisto(v), String(v)).toBeNull();
  });
});

describe("temNovidade e juntarVisto", () => {
  it("compara com a versão atual", () => {
    expect(temNovidade(null)).toBe(true);
    expect(temNovidade(ULTIMA - 1)).toBe(true);
    expect(temNovidade(ULTIMA)).toBe(false);
  });

  it("fica com o mais recente dos dois", () => {
    expect(juntarVisto(null, null)).toBeNull();
    expect(juntarVisto(3, null)).toBe(3);
    expect(juntarVisto(null, 5)).toBe(5);
    expect(juntarVisto(7, 5)).toBe(7);
  });
});
