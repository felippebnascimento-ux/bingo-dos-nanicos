import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Presence } from "@/lib/tipos";

/* a sala de verdade precisa do Supabase: aqui só guardamos os handlers para chamar na mão */
const recebe: Record<string, (m: Record<string, unknown>) => void> = {};
let presenca = () => {};
vi.mock("@/lib/sala", async () => {
  const real = await vi.importActual<typeof import("@/lib/sala")>("@/lib/sala");
  return {
    ...real,
    aoReceber: (ev: string, fn: (m: Record<string, unknown>) => void) => void (recebe[ev] = fn),
    aoMudarPresenca: (fn: () => void) => void (presenca = fn),
    enviar: () => {},
  };
});

const { setApp } = await import("@/lib/store");
const { iniciarHall, useHall } = await import("./bonecos");

const pessoa = (key: string, name: string, pos: Presence["pos"]): Presence => ({ key, name, fid: null, lines: 0, live: null, cam: null, pos, sala: null, at: 0 });
const ondeEsta = (key: string) => {
  /* um boneco por nanico: o id é "n:<fid>" (aqui sem fid, "nome:<nome>"); a chave da aba vira o nome da pessoa */
  const nome = key === "k2" ? "nome:john" : key;
  const b = useHall.getState().bonecos.find((x) => x.key === nome);
  return b && { i: b.i, j: b.j };
};

describe("evento hall vindo da sala", () => {
  beforeAll(() => {
    setApp({ fase: "app", myName: "Pitoco", online: [pessoa("k2", "John", { i: 4, j: 4 })] });
    iniciarHall();
    presenca();
  });

  it("quem está na sala aparece no piso da presença", () => {
    expect(ondeEsta("k2")).toEqual({ i: 4, j: 4 });
  });

  it("ignora destino fora da grade, ocupado ou que não é {i, j}", () => {
    for (const para of [{ i: 99, j: 0 }, { i: 7, j: 0 }, "4,5", { i: "5", j: 4 }, null, { i: 4.5, j: 4 }]) recebe.hall({ from: "k2", para });
    expect(ondeEsta("k2")).toEqual({ i: 4, j: 4 });
  });

  it("ignora quem não está na sala", () => {
    recebe.hall({ from: "intruso", para: { i: 5, j: 4 } });
    expect(ondeEsta("intruso")).toBeUndefined();
    expect(ondeEsta("k2")).toEqual({ i: 4, j: 4 });
  });

  it("anda com um destino válido e corta quem manda demais", () => {
    recebe.hall({ from: "k2", para: { i: 5, j: 4 } });
    expect(ondeEsta("k2")).toEqual({ i: 5, j: 4 });
    /* 50 seguidas: o limite é 8 a cada 2 s, então só as 7 que restam valem */
    for (let n = 0; n < 50; n++) recebe.hall({ from: "k2", para: n < 7 ? { i: 6, j: 4 } : { i: 0, j: 0 } });
    expect(ondeEsta("k2")).toEqual({ i: 6, j: 4 });
  });
});
