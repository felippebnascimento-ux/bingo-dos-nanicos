import { describe, expect, it } from "vitest";
import { cleanOpgg, opggNick } from "./opgg";

describe("op.gg", () => {
  it("aceita só endereço do op.gg", () => {
    expect(cleanOpgg("")).toBe("");
    expect(cleanOpgg("op.gg/lol/summoners/br/Nome-BR1")).toBe("https://op.gg/lol/summoners/br/Nome-BR1");
    expect(cleanOpgg("http://www.op.gg/summoners/br/X-BR1")).toBe("https://www.op.gg/summoners/br/X-BR1");
    expect(cleanOpgg("https://evil.com/op.gg")).toBeNull();
    expect(cleanOpgg("https://op.gg.evil.com/")).toBeNull();
    expect(cleanOpgg("https://user:pw@op.gg/")).toBeNull();
    expect(cleanOpgg("https://op.gg:8080/")).toBeNull();
    expect(cleanOpgg("javascript:alert(1)")).toBeNull();
    expect(cleanOpgg("https://op.gg/" + "a".repeat(300))).toBeNull();
  });

  it("tira o nick do link", () => {
    expect(opggNick("https://op.gg/lol/summoners/br/Nome%20Legal-BR1")).toBe("Nome Legal");
    expect(opggNick("https://op.gg/summoners/br/Fulano-BR1/champions")).toBe("Fulano");
    expect(opggNick("https://op.gg/")).toBe("perfil");
  });
});
