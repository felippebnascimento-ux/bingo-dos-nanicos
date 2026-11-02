import { describe, expect, it } from "vitest";
import { cellsDe, eligible, linhasFeitas, matchPhrase, sortear } from "./bingo";
import type { Card, LineupSlot, Phrase } from "./tipos";

const ph = (id: string, friendIds: string[] = [], champions: string[] = [], modo: Phrase["modo"] = "qualquer"): Phrase => ({
  id,
  text: "nanicada " + id,
  friendIds,
  champions,
  modo,
  createdAt: 0,
});
const lineup: LineupSlot[] = [
  { friendId: "a", champion: "Garen" },
  { friendId: "b", champion: "Ahri" },
  { friendId: "", champion: "" },
  { friendId: "", champion: "" },
  { friendId: "", champion: "" },
];
const sets = () => [lineup.filter((p) => p.friendId), new Set(["a", "b"]), new Set(["garen", "ahri"])] as const;

describe("quais nanicadas valem", () => {
  it("genérica", () => {
    expect(matchPhrase(ph("1"), ...sets())).toEqual({ gen: true });
  });
  it("qualquer: um dos nanicos jogando", () => {
    expect(matchPhrase(ph("1", ["a", "z"]), ...sets())).toEqual({ f: ["a"], c: [] });
    expect(matchPhrase(ph("1", ["z"]), ...sets())).toBeNull();
  });
  it("qualquer: nanico jogando COM o campeão", () => {
    expect(matchPhrase(ph("1", ["a"], ["garen"]), ...sets())).toEqual({ f: ["a"], c: ["garen"] });
    expect(matchPhrase(ph("1", ["a"], ["Ahri"]), ...sets())).toBeNull();
  });
  it("todos: todos jogando e todos os campeões", () => {
    expect(matchPhrase(ph("1", ["a", "b"], [], "todos"), ...sets())).toEqual({ f: ["a", "b"], c: [] });
    expect(matchPhrase(ph("1", ["a", "z"], [], "todos"), ...sets())).toBeNull();
    expect(matchPhrase(ph("1", [], ["Garen", "Jinx"], "todos"), ...sets())).toBeNull();
  });
  it("separa da partida e genéricas", () => {
    const { spec, gen } = eligible([ph("1"), ph("2", ["a"]), ph("3", ["z"])], lineup);
    expect(spec.map((p) => p.id)).toEqual(["2"]);
    expect(gen.map((p) => p.id)).toEqual(["1"]);
  });
});

describe("cartela", () => {
  it("sorteia 24 e põe o LIVRE no meio", () => {
    const spec = Array.from({ length: 20 }, (_, i) => ({ ...ph("s" + i, ["a"]), hitF: ["a"], hit: [] }));
    const gen = Array.from({ length: 20 }, (_, i) => ph("g" + i));
    const pick = sortear(spec, gen);
    expect(pick).toHaveLength(24);
    expect(new Set(pick.map((p) => p.id)).size).toBe(24);
    expect(pick.filter((p) => p.id.startsWith("s"))).toHaveLength(16);
    const cells = cellsDe(pick, [{ id: "a", name: "Abreutz" }]);
    expect(cells).toHaveLength(25);
    expect(cells[12]).toEqual({ free: true, text: "LIVRE" });
  });
  it("completa com as da partida quando faltam genéricas", () => {
    const spec = Array.from({ length: 30 }, (_, i) => ({ ...ph("s" + i), hitF: [], hit: [] }));
    expect(sortear(spec, [ph("g")])).toHaveLength(24);
  });
  it("conta as linhas feitas", () => {
    const marked = Array(25).fill(false);
    [0, 1, 2, 3, 4, 6, 12, 18, 24].forEach((i) => (marked[i] = true));
    const card: Card = { cells: [], marked };
    expect(linhasFeitas(card)).toHaveLength(2);
    expect(linhasFeitas(null)).toEqual([]);
  });
});
