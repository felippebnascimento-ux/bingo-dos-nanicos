import { describe, expect, it } from "vitest";
import { ordenarQuartos } from "./navegador";

const L = [
  { uid: "1", fid: "a", nome: "Pin", tamanho: 6, agora: 0, curtidas: 5 },
  { uid: "2", fid: "b", nome: "Gamer", tamanho: 9, agora: 3, curtidas: 1 },
  { uid: "3", fid: "c", nome: "DD", tamanho: 6, agora: 0, curtidas: 1 },
];

describe("navegador de quartos", () => {
  it("com gente agora primeiro", () => {
    expect(ordenarQuartos(L, "gente").map((x) => x.nome)).toEqual(["Gamer", "Pin", "DD"]);
  });
  it("mais curtidos primeiro (empate: quem tem gente, depois o nome)", () => {
    expect(ordenarQuartos(L, "curtidas").map((x) => x.nome)).toEqual(["Pin", "Gamer", "DD"]);
  });
});
