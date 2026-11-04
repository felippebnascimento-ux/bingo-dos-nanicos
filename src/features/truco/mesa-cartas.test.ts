import { describe, expect, it } from "vitest";
import type { MaoBase } from "./engine";
import { trCartasDaMao } from "./mesa";

const mao = (vazas: unknown[]) => ({ vazas }) as unknown as MaoBase;
const v1 = { lider: 0, vence: 0, por: 0, cartas: [{ s: 0, c: "1e" }, { s: 1, c: "4c" }] };

describe("cartas da mão na mesa", () => {
  it("a vaza que fechou continua à vista, sem apagar, até a próxima começar", () => {
    const r = trCartasDaMao(mao([v1, { lider: 0, vence: null, por: null, cartas: [] }]));
    expect(r.map((x) => x.c)).toEqual(["1e", "4c"]);
    expect(r.map((x) => x.ganha)).toEqual([true, false]);
    expect(r.every((x) => !x.passou)).toBe(true);
  });
  it("com a vaza nova jogada, as cartas anteriores ficam na mesa e marcadas como passadas", () => {
    const r = trCartasDaMao(mao([v1, { lider: 0, vence: null, por: null, cartas: [{ s: 0, c: "7o" }] }]));
    expect(r).toEqual([
      { s: 0, c: "1e", vaza: 0, ganha: true, passou: true },
      { s: 1, c: "4c", vaza: 0, ganha: false, passou: true },
      { s: 0, c: "7o", vaza: 1, ganha: false, passou: false },
    ]);
  });
  it("vaza parda não destaca nenhuma carta", () => {
    const r = trCartasDaMao(mao([{ lider: 0, vence: -1, por: null, cartas: [{ s: 0, c: "3e" }, { s: 1, c: "3c" }] }]));
    expect(r.some((x) => x.ganha)).toBe(false);
  });
});
