import { describe, expect, it } from "vitest";
import { agrupar, andar, conversas, daConversa, DIA_MS, inicioDoGrupo, naoLidasDM, resumo, tempoCurto, type Mensagem, type Story } from "./insta";

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


describe("Direct do InstaNanico", () => {
  const m = (id: number, de: string, para: string, min: number, lida = false, extra: Partial<Mensagem> = {}): Mensagem => ({
    id, de, para, texto: "oi " + id, storyId: null, postId: null, em: min * 60_000, lidaEm: lida ? 1 : null, ...extra,
  });
  const lista = [m(1, "ana", "eu", 1, true), m(2, "eu", "ana", 2), m(3, "bia", "eu", 5), m(4, "bia", "eu", 6), m(5, "caio", "dani", 9)];

  it("uma conversa por pessoa, a mais recente primeiro, contando as não lidas", () => {
    const c = conversas(lista, "eu");
    expect(c.map((x) => x.outro)).toEqual(["bia", "ana"]);
    expect(c[0]).toMatchObject({ naoLidas: 2 });
    expect(c[0].ultima.id).toBe(4);
    expect(c[1].naoLidas).toBe(0);
    expect(naoLidasDM(lista, "eu")).toBe(2);
  });

  it("mensagens da conversa em ordem", () => {
    expect(daConversa(lista, "eu", "ana").map((x) => x.id)).toEqual([1, 2]);
  });

  it("resumo da última mensagem", () => {
    expect(resumo(m(9, "eu", "ana", 1), "eu")).toBe("Você: oi 9");
    expect(resumo(m(9, "ana", "eu", 1, false, { postId: 3 }), "eu")).toBe("Enviou uma publicação");
    expect(resumo(m(9, "ana", "eu", 1, false, { storyId: 3, texto: "kkk" }), "eu")).toBe("Respondeu ao seu story: kkk");
  });
});
