import { describe, expect, it } from "vitest";
import { donoDaChave, umPorNanico } from "./presenca";
import type { Presence } from "./tipos";

const p = (key: string, o: Partial<Presence> = {}): Presence => ({ key, name: "Pitoco", fid: "f1", lines: 0, live: null, cam: null, pos: null, sala: null, at: 1, ...o });

describe("umPorNanico", () => {
  it("duas abas do mesmo nanico viram um só, com o at mais novo", () => {
    const r = umPorNanico([p("a", { at: 10, sala: "lol-1" }), p("b", { at: 20, sala: "cs" })], "eu");
    expect(r[0].lines).toBe(0);
    expect(r).toHaveLength(1);
    expect(r[0].sala).toBe("cs");
    expect(r[0].id).toBe("n:f1");
    expect(r[0].chaves).toEqual(["a", "b"]);
  });

  it("mantém a live (e a chave) da aba que transmite, mesmo que outra seja mais nova", () => {
    const r = umPorNanico([p("a", { at: 10, live: "sid-transmite-1" }), p("b", { at: 20 })], "eu");
    expect(r[0].live).toBe("sid-transmite-1");
    expect(r[0].key).toBe("a");
  });

  it("as minhas outras abas entram no meu item, que fica com a minha chave", () => {
    const r = umPorNanico([p("outra", { at: 99 }), p("eu", { at: 5 }), p("x", { fid: "f2", name: "John" })], "eu");
    expect(r).toHaveLength(2);
    const meu = r.find((x) => x.chaves.includes("eu"))!;
    expect(meu.id).toBe("eu");
    expect(meu.key).toBe("eu");
    expect(meu.chaves.sort()).toEqual(["eu", "outra"]);
  });

  it("sem fid, junta pelo nome (sem diferença de maiúscula)", () => {
    const r = umPorNanico([p("a", { fid: null, name: "Convidado" }), p("b", { fid: null, name: "convidado " })], "eu");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("nome:convidado");
  });

  it("donoDaChave acha o nanico por qualquer aba dele", () => {
    const r = umPorNanico([p("a"), p("b"), p("c", { fid: "f2", name: "John" })], "eu");
    expect(donoDaChave(r, "b")?.id).toBe("n:f1");
    expect(donoDaChave(r, "zzz")).toBeNull();
  });

  it("a voz vem da aba que está na voz, com o microfone dela", () => {
    const r = umPorNanico([p("a", { at: 10, voz: "sid-voz-1", mudo: true }), p("b", { at: 20 })], "eu");
    expect(r[0].voz).toBe("sid-voz-1");
    expect(r[0].mudo).toBe(true);
  });

  it("a sala vem da aba na sala, não da aba no lobby que renovou por último", () => {
    const r = umPorNanico([p("a", { at: 10, sala: "lol-1" }), p("b", { at: 20, sala: null })], "eu");
    expect(r[0].sala).toBe("lol-1");
  });

  it("com duas abas em salas, vale a que está na voz", () => {
    const r = umPorNanico([p("a", { at: 10, sala: "lol-1", voz: "sid-voz-1" }), p("b", { at: 20, sala: "cs" })], "eu");
    expect(r[0].sala).toBe("lol-1");
  });

  it("a câmera chega pela aba que tem a câmera", () => {
    const r = umPorNanico([p("a", { at: 10, cam: "sid-cam-1" }), p("b", { at: 20 })], "eu");
    expect(r[0].chaveCam).toBe("a");
  });
});
