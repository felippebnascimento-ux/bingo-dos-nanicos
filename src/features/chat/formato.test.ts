import { describe, expect, it } from "vitest";
import { dia, embedDe, formatar, linksDe, meMenciona, mencoesDe, trechos, urlDoEmbed } from "./formato";

describe("formatação do chat (como no Discord)", () => {
  it("negrito, itálico, riscado, sublinhado, spoiler e código", () => {
    expect(trechos("oi **forte** e *leve*")).toEqual([
      { t: "texto", v: "oi " },
      { t: "negrito", filhos: [{ t: "texto", v: "forte" }] },
      { t: "texto", v: " e " },
      { t: "italico", filhos: [{ t: "texto", v: "leve" }] },
    ]);
    expect(trechos("~~x~~ __y__ ||z||").filter((x) => x.t !== "texto").map((x) => x.t)).toEqual(["riscado", "sublinhado", "spoiler"]);
    expect(trechos("`**não**` ok")).toEqual([{ t: "codigo", v: "**não**" }, { t: "texto", v: " ok" }]);
    expect(trechos("**negrito com *itálico***")[0]).toMatchObject({ t: "negrito", filhos: [{ t: "texto", v: "negrito com " }, { t: "italico" }] });
  });

  it("não inventa formatação", () => {
    expect(trechos("2*3*4 sem fim **")).toEqual([{ t: "texto", v: "2" }, { t: "italico", filhos: [{ t: "texto", v: "3" }] }, { t: "texto", v: "4 sem fim **" }]);
    expect(trechos("nome_de_arquivo.txt")).toEqual([{ t: "texto", v: "nome_de_arquivo.txt" }]);
    expect(trechos("****")).toEqual([{ t: "texto", v: "****" }]);
  });

  it("links, menções e citação", () => {
    expect(trechos("veja https://site.com/a?b=1, top")).toEqual([
      { t: "texto", v: "veja " },
      { t: "link", url: "https://site.com/a?b=1", v: "https://site.com/a?b=1" },
      { t: "texto", v: ", top" },
    ]);
    expect(mencoesDe("@Pitoco e @gordao, email a@b.com")).toEqual(["pitoco", "gordao"]);
    expect(formatar("> citado\nnormal").map((l) => l.citacao)).toEqual([true, false]);
    expect(linksDe("a https://x.com b **https://y.com**")).toEqual(["https://x.com", "https://y.com"]);
    expect(meMenciona("bora @todos", "henry")).toBe(true);
    expect(meMenciona("oi @pitoco", "henry")).toBe(false);
  });

  it("vídeos que tocam no chat", () => {
    expect(embedDe("https://youtu.be/dQw4w9WgXcQ")).toEqual({ tipo: "youtube", id: "dQw4w9WgXcQ" });
    expect(embedDe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toEqual({ tipo: "youtube", id: "dQw4w9WgXcQ" });
    expect(embedDe("https://youtube.com/shorts/abcDEF12345")).toEqual({ tipo: "youtube", id: "abcDEF12345" });
    expect(embedDe("https://clips.twitch.tv/FunnyClip-abc123")).toEqual({ tipo: "twitch", id: "FunnyClip-abc123" });
    expect(embedDe("https://www.twitch.tv/nanico/clip/FunnyClip-abc123")).toEqual({ tipo: "twitch", id: "FunnyClip-abc123" });
    expect(embedDe("https://medal.tv/games/lol/clips/abc123XYZ")).toEqual({ tipo: "medal", id: "abc123XYZ" });
    expect(embedDe("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(embedDe("javascript:alert(1)")).toBeNull();
    expect(urlDoEmbed({ tipo: "twitch", id: "X1y2z3" }, "nanicos.app")).toContain("parent=nanicos.app");
  });

  it("separa os dias", () => {
    const agora = Date.parse("2026-11-04T15:00:00Z");
    expect(dia(agora - 1000, agora)).toBe("Hoje");
    expect(dia(agora - 86_400_000, agora)).toBe("Ontem");
  });
});
