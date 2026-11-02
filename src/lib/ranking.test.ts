import { describe, expect, it } from "vitest";
import { posicaoDe, ranking } from "./moedas";

const F = (id: string, name: string, user_id: string | null = "u" + id) => ({ id, name, user_id });

describe("ranking das moedas", () => {
  it("ordena por saldo e divide a posição no empate (5º, 5º, 7º)", () => {
    const friends = [F("a", "Ana"), F("b", "Bia"), F("c", "Caio"), F("d", "Duda")];
    const r = ranking(
      [
        { userId: "ua", saldo: 10 },
        { userId: "ub", saldo: 50 },
        { userId: "uc", saldo: 50 },
        { userId: "ud", saldo: 5 },
      ],
      friends,
    );
    expect(r.map((l) => [l.nome, l.pos])).toEqual([
      ["Bia", 1],
      ["Caio", 1],
      ["Ana", 3],
      ["Duda", 4],
    ]);
  });

  it("ninguém com carteira: todos no fim, por nome, sem posição", () => {
    const r = ranking([], [F("b", "Bia"), F("a", "Ana")]);
    expect(r.map((l) => [l.nome, l.pos, l.saldo])).toEqual([
      ["Ana", null, null],
      ["Bia", null, null],
    ]);
  });

  it("nanico sem carteira (ou sem login) vai para o fim e não tem posição", () => {
    const friends = [F("a", "Ana"), F("b", "Bia"), F("z", "Zeca", null)];
    const r = ranking([{ userId: "ub", saldo: 3 }], friends);
    expect(r.map((l) => l.nome)).toEqual(["Bia", "Ana", "Zeca"]);
    expect(posicaoDe(r, "ub")).toBe(1);
    expect(posicaoDe(r, "ua")).toBeNull();
    expect(posicaoDe(r, null)).toBeNull();
  });
});
