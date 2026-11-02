import { describe, expect, it } from "vitest";
import { euOfereco, falandoAgora, mesmaLista, SEGURA_FALA_MS, volumeDe } from "./vozRegras";

describe("voz", () => {
  it("só um dos dois oferece", () => {
    expect(euOfereco("abc", "abd")).toBe(true);
    expect(euOfereco("abd", "abc")).toBe(false);
  });

  it("volume: silêncio é 0, onda cheia é 1", () => {
    expect(volumeDe([])).toBe(0);
    expect(volumeDe([0, 0, 0])).toBe(0);
    expect(volumeDe([1, -1, 1, -1])).toBe(1);
  });

  it("o anel segue aceso um pouco depois da última fala", () => {
    const m = new Map([
      ["b", 1000],
      ["a", 1000 - SEGURA_FALA_MS],
      ["c", 100],
    ]);
    expect(falandoAgora(m, 1000)).toEqual(["a", "b"]);
    expect(falandoAgora(m, 1000 + SEGURA_FALA_MS + 1)).toEqual([]);
  });

  it("mesmaLista", () => {
    expect(mesmaLista(["a"], ["a"])).toBe(true);
    expect(mesmaLista(["a"], ["b"])).toBe(false);
    expect(mesmaLista([], ["a"])).toBe(false);
  });
});
