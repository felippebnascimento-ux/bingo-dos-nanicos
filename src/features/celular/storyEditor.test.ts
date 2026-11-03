import { describe, expect, it } from "vitest";
import { encaixar, horaAdesivo, limitarEscala, naLixeira, pinca, pontasDegrade, quebrarLinhas, textoVisivel } from "./storyEditor";

/* cada letra mede 10 */
const medir = (t: string) => t.length * 10;

describe("editor de story", () => {
  it("quebra o texto em linhas que cabem, respeitando o Enter", () => {
    expect(quebrarLinhas("bora jogar hoje", 100, medir)).toEqual(["bora jogar", "hoje"]);
    expect(quebrarLinhas("oi\n\ntudo", 100, medir)).toEqual(["oi", "", "tudo"]);
    expect(quebrarLinhas("", 100, medir)).toEqual([""]);
  });

  it("corta palavra maior que a linha", () => {
    expect(quebrarLinhas("abcdefghijklmn", 50, medir)).toEqual(["abcde", "fghij", "klmn"]);
    expect(quebrarLinhas("oi abcdefghijkl", 50, medir)).toEqual(["oi", "abcde", "fghij", "kl"]);
  });

  it("estilo Forte em maiúsculas", () => {
    expect(textoVisivel({ texto: "ação", fonte: "forte" })).toBe("AÇÃO");
    expect(textoVisivel({ texto: "ação", fonte: "classica" })).toBe("ação");
  });

  it("gruda no centro perto dele", () => {
    expect(encaixar(0.51)).toEqual({ v: 0.5, grudou: true });
    expect(encaixar(0.6)).toEqual({ v: 0.6, grudou: false });
  });

  it("pinça: dobra a distância e gira 90°", () => {
    const r = pinca({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 20 });
    expect(r.escala).toBeCloseTo(2);
    expect(r.giro).toBeCloseTo(Math.PI / 2);
    expect(limitarEscala(10)).toBe(6);
    expect(limitarEscala(0.1)).toBe(0.25);
  });

  it("degradê de 180° vai de cima para baixo", () => {
    const p = pontasDegrade(180, 100, 200);
    expect(p.x0).toBeCloseTo(50);
    expect(p.y0).toBeCloseTo(0);
    expect(p.y1).toBeCloseTo(200);
  });

  it("lixeira embaixo no meio e hora do adesivo", () => {
    expect(naLixeira(0.5, 0.9)).toBe(true);
    expect(naLixeira(0.2, 0.9)).toBe(false);
    expect(horaAdesivo(new Date(2026, 10, 3, 9, 5))).toBe("09:05");
  });
});
