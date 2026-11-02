import { describe, expect, it } from "vitest";
import { cleanLink, cleanMural, cleanVideo, dominio } from "./links";

describe("links do perfil", () => {
  it("aceita e limpa o formato de cada site", () => {
    expect(cleanLink("twitch", "twitch.tv/pitoco_lol")).toBe("https://twitch.tv/pitoco_lol");
    expect(cleanLink("twitch", "http://www.twitch.tv/pitoco?utm=x")).toBe("https://www.twitch.tv/pitoco");
    expect(cleanLink("youtube", "https://youtube.com/@nanicos")).toBe("https://youtube.com/@nanicos");
    expect(cleanLink("x", "https://twitter.com/fulano")).toBe("https://twitter.com/fulano");
    expect(cleanLink("faceit", "https://www.faceit.com/pt/players/Pitoco")).toBe("https://www.faceit.com/pt/players/Pitoco");
    expect(cleanLink("leetify", "leetify.com/app/profile/76561198000000000")).toBe("https://leetify.com/app/profile/76561198000000000");
  });
  it("vazio e inválido", () => {
    expect(cleanLink("twitch", "  ")).toBe("");
    expect(cleanLink("twitch", "https://twitch.tv/a")).toBeNull();
    expect(cleanLink("instagram", "https://evil.com/pitoco")).toBeNull();
    expect(cleanLink("tiktok", "javascript:alert(1)")).toBeNull();
  });
});

describe("vídeos e mural", () => {
  it("vídeo só de YouTube, Medal e clipe da Twitch", () => {
    expect(cleanVideo("https://youtu.be/dQw4w9WgXcQ")).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(cleanVideo("youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("https://youtube.com/watch?v=dQw4w9WgXcQ&t=10");
    expect(cleanVideo("https://clips.twitch.tv/BoaJogada-abc")).not.toBeNull();
    expect(cleanVideo("https://evil.com/video.mp4")).toBeNull();
  });
  it("mural aceita https e recusa javascript:", () => {
    expect(cleanMural("u.gg/lol/champions/garen/build")).toBe("https://u.gg/lol/champions/garen/build");
    expect(cleanMural("javascript:alert(1)")).toBeNull();
    expect(cleanMural("data:text/html,oi")).toBeNull();
    expect(dominio("https://www.u.gg/x")).toBe("u.gg");
  });
});
