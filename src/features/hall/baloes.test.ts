import { describe, expect, it } from "vitest";
import { juntarBaloes, type Balao } from "./baloes";

const b = (id: string, uid: string, ate: number): Balao => ({ id, uid, texto: id, ate });

describe("chat do K-FOFO: balões", () => {
  it("tira os vencidos e junta os novos no fim", () => {
    const r = juntarBaloes([b("1", "a", 50), b("2", "a", 200)], [b("3", "b", 300)], 100);
    expect(r.map((x) => x.id)).toEqual(["2", "3"]);
  });
  it("deixa só os 3 últimos de cada pessoa", () => {
    const r = juntarBaloes([b("1", "a", 900), b("2", "a", 900), b("3", "b", 900), b("4", "a", 900)], [b("5", "a", 900)], 0);
    expect(r.map((x) => x.id)).toEqual(["2", "3", "4", "5"]);
  });
});
