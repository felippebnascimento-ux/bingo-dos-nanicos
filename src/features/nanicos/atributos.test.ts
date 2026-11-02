import { describe, expect, it } from "vitest";
import { ATRIBUTOS, diaMes, lerAtributos, lerTodos, limparNotas, notasPadrao, textoMedia, totalVotos } from "./atributos";

const certas = { tilt: 8, choro: 9, clutch: 6, farm: 4, sorte: 3, call: 7 };

describe("limparNotas", () => {
  it("aceita as 6 notas inteiras de 0 a 10", () => {
    expect(limparNotas(certas)).toEqual(certas);
    expect(limparNotas(notasPadrao())).toEqual({ tilt: 5, choro: 5, clutch: 5, farm: 5, sorte: 5, call: 5 });
  });

  it("recusa o resto", () => {
    for (const v of [null, "x", {}, { ...certas, tilt: 11 }, { ...certas, tilt: -1 }, { ...certas, tilt: 5.5 }, { ...certas, tilt: "5" }, { ...certas, hack: 1 }, { tilt: 1 }])
      expect(limparNotas(v), JSON.stringify(v)).toBeNull();
  });
});

describe("médias", () => {
  it("lê a resposta do banco e escreve com vírgula", () => {
    const a = lerAtributos({ tilt: { media: 8.7, votos: 4 }, choro: { media: null, votos: 2 } })!;
    expect(a.tilt).toEqual({ media: 8.7, votos: 4 });
    expect(a.choro).toEqual({ media: null, votos: 2 });
    expect(a.call).toEqual({ media: null, votos: 0 });
    expect(textoMedia(a.tilt)).toBe("8,7");
    expect(textoMedia(a.choro)).toBe("sem votos");
    expect(textoMedia({ media: 7, votos: 3 })).toBe("7,0");
    expect(totalVotos(a)).toBe(4);
  });

  it("lixo não quebra", () => {
    expect(lerAtributos(null)).toBeNull();
    expect(lerAtributos({ tilt: { media: "9", votos: "x" } })!.tilt).toEqual({ media: null, votos: 0 });
    expect(lerAtributos({ tilt: { media: 99, votos: 3 } })!.tilt.media).toBe(10);
    expect(lerTodos("x")).toEqual({});
    expect(Object.keys(lerTodos({ a: { tilt: { media: 5, votos: 3 } }, b: null }))).toEqual(["a"]);
  });

  it("os seis atributos, com o Clutch marcado como CS2", () => {
    /* em ordem alfabética na tela */
    expect(ATRIBUTOS.map((a) => a.chave)).toEqual(["call", "choro", "clutch", "farm", "sorte", "tilt"]);
    expect(ATRIBUTOS.filter((a) => a.cs2).map((a) => a.nome)).toEqual(["Clutch"]);
  });

  it("data de quando pode mudar o voto", () => {
    expect(diaMes("2026-11-08T15:00:00Z")).toBe("08/11");
    expect(diaMes("lixo")).toBe("");
  });
});
