import { describe, expect, it } from "vitest";
import { ehAmigo, ehNanico, soAmigos, soNanicos } from "./nanicos";

describe("nanicos e amigos", () => {
  it("o tipo do banco decide; sem ele (SQL da seção 39 sem rodar), vale o nome", () => {
    expect(ehAmigo({ name: "Lightzin", tipo: "amigo" })).toBe(true);
    expect(ehAmigo({ name: "Lightzin" })).toBe(true);
    expect(ehAmigo({ name: "Lightzin", tipo: "nanico" })).toBe(false);
    expect(ehAmigo({ name: "Pitoco" })).toBe(false);
    expect(ehNanico({ name: "Pitoco" })).toBe(true);
    expect(ehNanico({ name: "Xis", tipo: "inativo" })).toBe(false);
  });

  it("separa as listas e tira o inativo das duas", () => {
    const l = [{ name: "Pitoco", tipo: "nanico" as const }, { name: "Lightzin", tipo: "amigo" as const }, { name: "Xis", tipo: "inativo" as const }];
    expect(soNanicos(l).map((f) => f.name)).toEqual(["Pitoco"]);
    expect(soAmigos(l).map((f) => f.name)).toEqual(["Lightzin"]);
  });
});
