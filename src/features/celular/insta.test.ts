import { describe, expect, it } from "vitest";
import { agrupar, andar, DIA_MS, inicioDoGrupo, tempoCurto, type Story } from "./insta";

const H = 60 * 60 * 1000, AGORA = 100 * DIA_MS;
const st = (id: number, userId: string, horasAtras: number): Story => ({ id, userId, midia: null, texto: "oi", fundo: "roxo", em: AGORA - horasAtras * H });

describe("stories do InstaNanico", () => {
  const lista = [st(1, "ana", 5), st(2, "bia", 1), st(3, "ana", 2), st(4, "eu", 3), st(5, "caio", 30), st(6, "dani", 4)];

  it("agrupa por pessoa, eu primeiro, não vistos antes dos vistos, e some com 24 h", () => {
    const g = agrupar(lista, new Set([2]), "eu", AGORA);
    expect(g.map((x) => x.userId)).toEqual(["eu", "ana", "dani", "bia"]);
    expect(g[1].stories.map((s) => s.id)).toEqual([1, 3]);
    expect(g[3].todosVistos).toBe(true);
  });

  it("começa no primeiro não visto do grupo", () => {
    const ana = agrupar(lista, new Set([1]), "eu", AGORA).find((x) => x.userId === "ana")!;
    expect(inicioDoGrupo(ana, new Set([1]))).toBe(1);
    expect(inicioDoGrupo(ana, new Set([1, 3]))).toBe(0);
  });

  it("anda pelos stories e passa de pessoa", () => {
    const g = agrupar(lista, new Set(), "eu", AGORA);
    /* sem nada visto: eu, bia (1 h), ana (2 h, dois stories), dani */
    expect(g.map((x) => x.userId)).toEqual(["eu", "bia", "ana", "dani"]);
    expect(andar(g, 2, 0, 1)).toEqual({ g: 2, s: 1 });
    expect(andar(g, 2, 1, 1)).toEqual({ g: 3, s: 0 });
    expect(andar(g, 3, 0, -1)).toEqual({ g: 2, s: 1 });
    expect(andar(g, g.length - 1, 0, 1)).toBeNull();
    expect(andar(g, 0, 0, -1)).toEqual({ g: 0, s: 0 });
  });

  it("tempo curto", () => {
    expect(tempoCurto(AGORA - 30_000, AGORA)).toBe("agora");
    expect(tempoCurto(AGORA - 5 * 60_000, AGORA)).toBe("5 min");
    expect(tempoCurto(AGORA - 3 * H, AGORA)).toBe("3 h");
    expect(tempoCurto(AGORA - 2 * DIA_MS, AGORA)).toBe("2 d");
  });
});
