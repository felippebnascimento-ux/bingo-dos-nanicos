import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BONECO_ARQ } from "@/lib/dados/nanicos";
import {
  ASSENTOS,
  CADEIRAS_TRUCO,
  PLATEIA_TRUCO,
  pisoDaPlateia,
  lugarNaMesaVerde,
  camadasHall,
  assentoNaTela,
  posHall,
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
    for (const k of ["11,0", "12,0", "13,1", "13,2", "13,3", "4,3", "9,3", "2,6", "3,7", "9,6", "10,8", "0,6", "0,9", "12,7", "13,9", "2,10", "4,10"])
      expect(BLOQUEADOS.has(k), k).toBe(true);
    expect(livre(10, 5)).toBe(true); /* entre a mesa comprida e a mesa do lado dá para ficar */
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
    /* a mesa ocupa i 4–10 na fileira j = 3: de (6, 2) a (6, 4) dá a volta pela ponta de i = 3 */
    const c = caminho({ i: 6, j: 2 }, { i: 6, j: 4 });
    expect(c[0]).toEqual({ i: 6, j: 2 });
    expect(c.at(-1)).toEqual({ i: 6, j: 4 });
    expect(c).toHaveLength(9);
    for (let k = 1; k < c.length; k++) {
      expect(vizinhos(c[k - 1], c[k])).toBe(true);
      expect(livre(c[k].i, c[k].j)).toBe(true);
    }
  });

  it("não vai para piso ocupado nem para fora", () => {
    expect(caminho({ i: 0, j: 0 }, { i: 11, j: 0 })).toEqual([]);
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
    for (const lixo of [null, undefined, "4,4", 7, [], {}, { i: "4", j: 4 }, { i: 4.5, j: 4 }, { i: -1, j: 0 }, { i: 99, j: 1 }, { i: 11, j: 0 }, { i: NaN, j: 0 }])
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
    expect(ordem({ i: 6, j: 2 })).toBe("atras");
    expect(ordem({ i: 2, j: 2 })).toBe("atras");
    expect(ordem({ i: 6, j: 5 })).toBe("frente");
    expect(ordem({ i: 11, j: 4 })).toBe("frente");
  });
});

describe("sala nova (14×11)", () => {
  it("posição antiga que agora cai num móvel não vale (a pessoa volta para a entrada)", () => {
    /* (7, 3) era livre antes da planta nova e agora é a mesa comprida */
    expect(posValida({ i: 7, j: 3 })).toBe(false);
    expect(posValida({ i: 12, j: 9 })).toBe(false);
  });

  it("pisoLivreNaTela só devolve piso sem móvel", () => {
    const [x, y] = tela(6.5, 5.5);
    expect(pisoLivreNaTela(x, y)).toEqual({ i: 6, j: 5 });
    const [mx, my] = tela(6.5, 3.5);
    expect(pisoLivreNaTela(mx, my)).toBeNull();
  });

  it("cada móvel que abre algo tem a placa dentro da sala", () => {
    expect(CLICAVEIS.map((c) => c.id)).toEqual(["salas", "tv", "trofeus", "truco", "loja"]);
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

describe("assentos", () => {
  it("cada assento sai de um piso livre e fica em cima de um móvel", () => {
    for (const a of ASSENTOS) {
      expect(livre(a.chegar.i, a.chegar.j), a.id).toBe(true);
      expect(livre(Math.floor(a.i), Math.floor(a.j)), a.id).toBe(false);
    }
  });
  it("a posição só leva o assento se ele sai daquele piso", () => {
    expect(posHall({ i: 1, j: 7, s: "sofa-a" })).toEqual({ i: 1, j: 7, s: "sofa-a" });
    expect(posHall({ i: 1, j: 8, s: "sofa-a" })).toEqual({ i: 1, j: 8 });
    expect(posHall({ i: 1, j: 7, s: "trono" })).toEqual({ i: 1, j: 7 });
    expect(posHall({ i: 0, j: 7 })).toBeNull();
  });
  it("tocar no sofá acha o assento mais perto", () => {
    const a = ASSENTOS[1];
    const [x, y] = tela(a.i, a.j);
    expect(assentoNaTela(x, y)?.id).toBe(a.id);
    const [x2, y2] = tela(7, 5);
    expect(assentoNaTela(x2, y2)).toBeNull();
  });
  it("quem senta fica por cima do estofado e atrás do encosto da frente", () => {
    const zMovel = (id: string, z: number[]) => z[MOVEIS.findIndex((m) => m.id === id)];
    for (const a of ASSENTOS) {
      const bonecos = [{ i: a.chegar.i, j: a.chegar.j, senta: a.id }, { i: 7, j: 5, senta: null }];
      const { z, encosto } = camadasHall(bonecos);
      const zb = z[MOVEIS.length];
      expect(zb, a.id).toBeGreaterThan(zMovel(a.movel, z));
      if (encosto[a.movel] !== undefined) expect(zb, a.id).toBeLessThan(encosto[a.movel]);
      expect(new Set([...z, ...Object.values(encosto)]).size, a.id).toBe(z.length + Object.keys(encosto).length);
    }
  });
  it("dois no mesmo sofá: o da frente fica por cima", () => {
    const [a, , c] = ASSENTOS;
    const { z } = camadasHall([{ i: c.chegar.i, j: c.chegar.j, senta: c.id }, { i: a.chegar.i, j: a.chegar.j, senta: a.id }]);
    expect(z[MOVEIS.length]).toBeGreaterThan(z[MOVEIS.length + 1]);
  });
});

describe("truco na mesa verde", () => {
  it("as cadeiras ficam em pisos ocupados e olham para a mesa", () => {
    for (const c of CADEIRAS_TRUCO) {
      expect(livre(Math.floor(c.i), Math.floor(c.j)), c.id).toBe(false);
      expect(Math.hypot(c.i - 3.5, c.j - 7.3), c.id).toBeGreaterThan(1);
      expect(posHall({ i: 3, j: 9, s: c.id }), c.id).toEqual({ i: 3, j: 9 });
    }
  });
  it("a plateia está em pisos livres, alcançáveis e que não são de sentar", () => {
    for (const p of PLATEIA_TRUCO) {
      expect(livre(p.i, p.j), `${p.i},${p.j}`).toBe(true);
      expect(ASSENTOS.some((a) => a.chegar.i === p.i && a.chegar.j === p.j)).toBe(false);
      expect(caminho({ i: 7, j: 9 }, p).length, `${p.i},${p.j}`).toBeGreaterThan(0);
    }
    expect(pisoDaPlateia([PLATEIA_TRUCO[0]])).toEqual(PLATEIA_TRUCO[1]);
  });
  it("no 1×1 usa a cadeira da frente e a do fundo", () => {
    expect([0, 1].map((l) => lugarNaMesaVerde(2, l))).toEqual([0, 2]);
    expect([0, 1, 2, 3].map((l) => lugarNaMesaVerde(4, l))).toEqual([0, 1, 2, 3]);
  });
});
