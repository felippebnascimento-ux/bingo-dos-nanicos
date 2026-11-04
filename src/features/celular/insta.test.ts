import { describe, expect, it } from "vitest";
import { agrupar, andar, conversas, daConversa, DIA_MS, formatoInicial, inicioDoGrupo, naoLidasDM, recorte, resumo, tempoCurto, type Mensagem, type Story } from "./insta";

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

describe("recorte da foto", () => {
  it("escolhe o formato como o Instagram", () => {
    expect(formatoInicial(1080, 1920)).toBe("4:5");
    expect(formatoInicial(1920, 1080)).toBe("1.91:1");
    expect(formatoInicial(1000, 1000)).toBe("1:1");
  });

  it("foto em pé num quadrado: corta o meio, de cima a baixo dá a largura inteira", () => {
    const r = recorte({ w: 1000, h: 2000 }, { W: 300, H: 300 }, 1, 0, 0);
    expect(r.x).toBeCloseTo(0);
    expect(r.largura).toBeCloseTo(1000);
    expect(r.altura).toBeCloseTo(1000);
    expect(r.y).toBeCloseTo(500);
  });

  it("não deixa arrastar para fora (sem buraco) e o zoom corta menos da foto", () => {
    const r = recorte({ w: 1000, h: 2000 }, { W: 300, H: 300 }, 1, 50, 9999);
    expect(r.dx).toBe(0);
    expect(r.dy).toBeCloseTo(150);
    expect(r.y).toBeCloseTo(0);
    const z = recorte({ w: 1000, h: 1000 }, { W: 300, H: 300 }, 2, 0, 0);
    expect(z.largura).toBeCloseTo(500);
    expect(z.x).toBeCloseTo(250);
  });
});

describe("InstaNanico igual ao Instagram (seção 68)", () => {
  it("lê a figurinha do banco conferindo tudo", async () => {
    const { lerFigurinha } = await import("./insta");
    expect(lerFigurinha({ tipo: "enquete", pergunta: "Truco hoje?", opcoes: ["Bora", ""], x: 2, y: 0.3, escala: 1, rot: 0 })).toEqual({ tipo: "enquete", pergunta: "Truco hoje?", opcoes: ["Bora", "Não"], x: 1, y: 0.3, escala: 1, rot: 0 });
    expect(lerFigurinha({ tipo: "contagem", titulo: "Churras", alvo: 5 })?.tipo).toBe("contagem");
    expect(lerFigurinha({ tipo: "contagem", titulo: "x" })).toBeNull();
    expect(lerFigurinha({ tipo: "virus" })).toBeNull();
    expect(lerFigurinha("oi")).toBeNull();
  });

  it("conta quanto falta e as porcentagens da enquete", async () => {
    const { falta, porcentagens } = await import("./insta");
    expect(falta(1000, 2000)).toBeNull();
    expect(falta(90061_000, 0)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
    expect(porcentagens({ "0": 1, "1": 2 })).toEqual([33, 67]);
    expect(porcentagens(null)).toEqual([0, 0]);
  });

  it("acha as @menções no texto e a que está sendo digitada", async () => {
    const { pedacos, mencionados, mencaoDigitando } = await import("./insta");
    expect(pedacos("bora @Pitoco e @gordao, email a@b")).toEqual([
      { t: "texto", v: "bora " },
      { t: "mencao", v: "@pitoco" },
      { t: "texto", v: " e " },
      { t: "mencao", v: "@gordao" },
      { t: "texto", v: ", email a@b" },
    ]);
    expect(mencionados("@pin oi @pin @max")).toEqual(["pin", "max"]);
    expect(mencaoDigitando("oi @pit")).toBe("pit");
    expect(mencaoDigitando("oi @")).toBe("");
    expect(mencaoDigitando("oi pit")).toBeNull();
  });

  it("resume foto e áudio no Direct e separa os dias", async () => {
    const { resumo, nomeDoDia, ehAudio } = await import("./insta");
    const base = { id: 1, de: "eu", para: "ana", texto: "", storyId: null, postId: null, em: 0, lidaEm: null };
    expect(resumo({ ...base, midia: "rede/x/abc123.webm" }, "eu")).toBe("Você enviou um áudio");
    expect(resumo({ ...base, midia: "rede/x/abc123.webp" }, "ana")).toBe("Enviou uma foto");
    expect(ehAudio("rede/x/abc123.m4a")).toBe(true);
    const agora = Date.parse("2026-11-04T15:00:00Z");
    expect(nomeDoDia(agora - 60_000, agora)).toBe("Hoje");
    expect(nomeDoDia(agora - DIA_MS, agora)).toBe("Ontem");
  });
});

describe("InstaNanico, seção 69", () => {
  it("filtros: sem ajuste não muda nada; preto e branco deixa cinza; brilho clareia", async () => {
    const { ajustarPixels, SEM_AJUSTE, FILTROS, somar, cssDoFiltro, semMudanca } = await import("./insta");
    const px = new Uint8ClampedArray([200, 100, 50, 255, 10, 20, 30, 255]);
    const igual = new Uint8ClampedArray(px);
    ajustarPixels(igual, SEM_AJUSTE);
    expect([...igual]).toEqual([...px]);
    const pb = new Uint8ClampedArray(px);
    ajustarPixels(pb, { ...SEM_AJUSTE, pb: 1 });
    expect(pb[0]).toBe(pb[1]);
    expect(pb[1]).toBe(pb[2]);
    const claro = new Uint8ClampedArray(px);
    ajustarPixels(claro, { ...SEM_AJUSTE, brilho: 1.5 });
    expect(claro[1]).toBe(150);
    expect(claro[3]).toBe(255);
    expect(semMudanca(somar(FILTROS[0].a, SEM_AJUSTE))).toBe(true);
    expect(cssDoFiltro(SEM_AJUSTE)).toBe("brightness(1) contrast(1) saturate(1) sepia(0) grayscale(0)");
  });

  it("lê quiz, barrinha, Adicione o seu e o story repostado", async () => {
    const { lerFigurinha } = await import("./insta");
    expect(lerFigurinha({ tipo: "quiz", pergunta: "Capital?", opcoes: ["A", "B", "", "C", "D", "E"], certa: 9 })).toMatchObject({ opcoes: ["A", "B", "C", "D"], certa: 3 });
    expect(lerFigurinha({ tipo: "quiz", opcoes: ["só uma"] })).toBeNull();
    expect(lerFigurinha({ tipo: "barra", pergunta: "Gostou?", emoji: "" })).toMatchObject({ emoji: "😍" });
    expect(lerFigurinha({ tipo: "adicione", pergunta: "", origem: 12 })).toMatchObject({ pergunta: "Adicione o seu", origem: 12 });
    expect(lerFigurinha({ tipo: "story", storyId: 5, autor: "<script>" })).toMatchObject({ storyId: 5, autor: "c" });
  });

  it("grupos ficam fora das conversas de duas pessoas e contam as não lidas pelo lido_ate", async () => {
    const { conversas, naoLidasDM, naoLidasGrupo, doGrupo, ordemDoPerfil } = await import("./insta");
    const m = (id: number, de: string, para: string, grupoId: number | null = null) => ({ id, de, para, texto: "oi", storyId: null, postId: null, em: id, lidaEm: null, grupoId });
    const lista = [m(1, "ana", "eu"), m(2, "ana", "", 7), m(3, "bia", "", 7), m(4, "eu", "", 7)];
    expect(conversas(lista, "eu").map((c) => c.outro)).toEqual(["ana"]);
    expect(naoLidasDM(lista, "eu")).toBe(1);
    expect(naoLidasGrupo(lista, 7, 2, "eu")).toBe(1);
    expect(doGrupo(lista, 7).map((x) => x.id)).toEqual([2, 3, 4]);
    expect(ordemDoPerfil([{ id: 1 }, { id: 3 }, { id: 2, fixadoEm: 50 }, { id: 0, fixadoEm: 90 }]).map((x) => x.id)).toEqual([0, 2, 3, 1]);
  });
});
