import { describe, expect, it } from "vitest";
import { cleanSteam, steamNome } from "./steam";

describe("Steam", () => {
  it("aceita só o perfil da comunidade Steam", () => {
    expect(cleanSteam("")).toBe("");
    expect(cleanSteam("steamcommunity.com/id/pitoco_br/")).toBe("https://steamcommunity.com/id/pitoco_br");
    expect(cleanSteam("http://www.steamcommunity.com/id/Pitoco-BR")).toBe("https://steamcommunity.com/id/Pitoco-BR");
    expect(cleanSteam("https://steamcommunity.com/profiles/76561198000000000/")).toBe("https://steamcommunity.com/profiles/76561198000000000");
    expect(cleanSteam("https://steamcommunity.com/id/pitoco?l=brazilian")).toBe("https://steamcommunity.com/id/pitoco");
  });

  it("recusa o que não é perfil", () => {
    for (const v of [
      "https://store.steampowered.com/app/730",
      "https://steamcommunity.com/",
      "https://steamcommunity.com/id/x",
      "https://steamcommunity.com/id/nome com espaço",
      "https://steamcommunity.com/profiles/123",
      "https://steamcommunity.com.evil.com/id/pitoco",
      "https://user:pw@steamcommunity.com/id/pitoco",
      "https://steamcommunity.com:8080/id/pitoco",
      "javascript:alert(1)",
    ])
      expect(cleanSteam(v), v).toBeNull();
  });

  it("tira o nome do link", () => {
    expect(steamNome("https://steamcommunity.com/id/pitoco_br")).toBe("pitoco_br");
    expect(steamNome("https://steamcommunity.com/profiles/76561198000000000")).toBe("perfil");
  });
});
