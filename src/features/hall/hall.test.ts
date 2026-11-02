import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BONECO_ARQ } from "@/lib/dados/nanicos";
import {
  BLOQUEADOS,
  CLICAVEIS,
  pisoLivreNaTela,
  caixaDoBoneco,
  caixaDoMovel,
  caminho,
  ENTRADA,
  entradaDe,
  livre,
  MOVEIS,
  NI,
  NJ,
  ordemZ,
  pisoNaTela,
  posValida,
  quadroSprite,
  SENTIDOS,
  sentido,
  tela,
  type Piso,
} from "./hall";

const vizinhos = (a: Piso, b: Piso) => Math.abs(a.i - b.i) + Math.abs(a.j - b.j) === 1;

describe("piso", () => {
  it("os móveis ocupam os pisos certos", () => {
    for (const k of ["7,0", "8,0", "0,9", "0,10", "10,4", "11,4", "11,3", "12,4", "5,8", "7,9", "8,9", "10,8", "12,9", "1,2", "13,0", "13,1"])
      expect(BLOQUEADOS.has(k), k).toBe(true);
    expect(livre(10, 5)).toBe(true); /* na frente da mesa verde dá para ficar */
    expect(livre(6, 5)).toBe(true); /* o meio fica livre para os bonecos */
    expect(livre(NI, 0)).toBe(false);
    expect(livre(0, -1)).toBe(false);
  });

  it("a entrada fica toda em piso livre", () => {
    for (const p of ENTRADA) expect(livre(p.i, p.j)).toBe(true);
    expect(posValida(entradaDe("qualquer-coisa"))).toBe(true);
  });

  it("tela e pisoNaTela são inversos no centro de cada piso", () => {
    for (let i = 0; i < NI; i++)
      for (let j = 0; j < NJ; j++) {
        const [x, y] = tela(i + 0.5, j + 0.5);
        expect(pisoNaTela(x, y)).toEqual({ i, j });
      }
    const [x, y] = tela(-0.5, 2);
    expect(pisoNaTela(x, y)).toBeNull();
  });
});

describe("caminho", () => {
  it("contorna a mesa comprida", () => {
    /* a mesa ocupa i 5–7 e j 8–9: de (4, 9) a (8, 10) não dá para passar por cima */
    const c = caminho({ i: 4, j: 9 }, { i: 8, j: 10 });
    expect(c[0]).toEqual({ i: 4, j: 9 });
    expect(c.at(-1)).toEqual({ i: 8, j: 10 });
    expect(c).toHaveLength(6);
    for (let k = 1; k < c.length; k++) {
      expect(vizinhos(c[k - 1], c[k])).toBe(true);
      expect(livre(c[k].i, c[k].j)).toBe(true);
    }
  });

  it("não vai para piso ocupado nem para fora", () => {
    expect(caminho({ i: 0, j: 0 }, { i: 7, j: 0 })).toEqual([]);
    expect(caminho({ i: 0, j: 0 }, { i: 20, j: 0 })).toEqual([]);
  });

  it("parado no lugar devolve só o próprio piso", () => {
    expect(caminho({ i: 4, j: 4 }, { i: 4, j: 4 })).toEqual([{ i: 4, j: 4 }]);
  });
});

describe("sentido", () => {
  it("cada passo vira uma das 4 diagonais", () => {
    const a = { i: 4, j: 4 };
    expect(sentido(a, { i: 5, j: 4 })).toBe("frente-direita");
    expect(sentido(a, { i: 4, j: 5 })).toBe("frente-esquerda");
    expect(sentido(a, { i: 3, j: 4 })).toBe("costas-esquerda");
    expect(sentido(a, { i: 4, j: 3 })).toBe("costas-direita");
    expect(sentido(a, a, "costas-direita")).toBe("costas-direita");
  });

  it("o recorte da folha espelha os lados esquerdos", () => {
    expect(quadroSprite("frente-direita", 0)).toEqual({ x: -0, y: -0, espelha: false });
    expect(quadroSprite("costas-esquerda", 3)).toEqual({ x: -252, y: -134, espelha: true });
  });
});

describe("posValida", () => {
  it("só aceita {i, j} inteiros em piso livre", () => {
    expect(posValida({ i: 4, j: 4 })).toBe(true);
    for (const lixo of [null, undefined, "4,4", 7, [], {}, { i: "4", j: 4 }, { i: 4.5, j: 4 }, { i: -1, j: 0 }, { i: 99, j: 1 }, { i: 7, j: 0 }, { i: NaN, j: 0 }])
      expect(posValida(lixo), JSON.stringify(lixo)).toBe(false);
  });
});

describe("ordemZ", () => {
  const mesa = caixaDoMovel(MOVEIS.find((m) => m.id === "mesa-comprida")!);
  const ordem = (a: Piso) => {
    const o = ordemZ([mesa, caixaDoBoneco(a.i, a.j)]);
    return o.indexOf(1) > o.indexOf(0) ? "frente" : "atras";
  };

  it("o boneco passa atrás e na frente da mesa", () => {
    expect(ordem({ i: 6, j: 7 })).toBe("atras");
    expect(ordem({ i: 4, j: 9 })).toBe("atras");
    expect(ordem({ i: 5, j: 10 })).toBe("frente");
    expect(ordem({ i: 8, j: 8 })).toBe("frente");
  });
});

describe("sala nova (14×11)", () => {
  it("posição antiga que agora cai num móvel não vale (a pessoa volta para a entrada)", () => {
    /* (7, 8) era livre na sala antiga e agora é a mesa comprida */
    expect(posValida({ i: 7, j: 8 })).toBe(false);
    expect(posValida({ i: 12, j: 9 })).toBe(false);
  });

  it("pisoLivreNaTela só devolve piso sem móvel", () => {
    const [x, y] = tela(6.5, 5.5);
    expect(pisoLivreNaTela(x, y)).toEqual({ i: 6, j: 5 });
    const [mx, my] = tela(6.5, 8.5);
    expect(pisoLivreNaTela(mx, my)).toBeNull();
  });

  it("cada móvel que abre algo tem a placa dentro da sala", () => {
    expect(CLICAVEIS.map((c) => c.id)).toEqual(["salas", "tv", "truco", "loja"]);
    for (const c of CLICAVEIS) {
      expect(c.rotulo.i).toBeGreaterThanOrEqual(0);
      expect(c.rotulo.j).toBeLessThanOrEqual(NJ);
    }
  });

  it("devolve todos os índices uma vez", () => {
    const cx = [...MOVEIS.map(caixaDoMovel), caixaDoBoneco(4, 4), caixaDoBoneco(4.5, 4), caixaDoBoneco(9, 8)];
    expect([...ordemZ(cx)].sort((a, b) => a - b)).toEqual(cx.map((_, k) => k));
  });
});

describe("arquivos dos bonecos", () => {
  const json = JSON.parse(readFileSync("public/arte/bonecos/bonecos.json", "utf8"));
  it("batem com o bonecos.json", () => {
    expect(json.celula).toEqual({ largura: 84, altura: 134 });
    expect(json.sentidos).toEqual(SENTIDOS);
    expect(BONECO_ARQ).toEqual(Object.fromEntries(Object.entries(json.arquivos).map(([n, a]) => [Number(n), a])));
  });
});
