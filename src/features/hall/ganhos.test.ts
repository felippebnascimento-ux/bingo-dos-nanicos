import { describe, expect, it, vi } from "vitest";

/* a sala de verdade precisa do Supabase; aqui só importamos as regras puras */
vi.mock("@/lib/sala", () => ({ aoMudarTabela: () => () => {} }));
const { juntarOnline, lerGanho } = await import("./ganhos");

const U = "11111111-1111-1111-1111-111111111111";

describe("lerGanho", () => {
  it("lê o último ganho da carteira", () => {
    expect(lerGanho({ user_id: U, saldo: 266, ultimo_valor: 36, ultimo_motivo: "diario", ultimo_em: "2026-11-02T12:00:00Z" })).toEqual({
      userId: U, valor: 36, motivo: "diario", em: Date.parse("2026-11-02T12:00:00Z"), saldo: 266,
    });
  });

  it("carteira sem ganho ainda, ou com lixo, não vira aviso", () => {
    expect(lerGanho(null)).toBeNull();
    expect(lerGanho({ user_id: U, saldo: 200, ultimo_valor: null, ultimo_em: null })).toBeNull();
    expect(lerGanho({ user_id: "x", ultimo_valor: 5, ultimo_em: "2026-11-02T12:00:00Z" })).toBeNull();
    expect(lerGanho({ user_id: U, ultimo_valor: 1.5, ultimo_em: "2026-11-02T12:00:00Z" })).toBeNull();
    expect(lerGanho({ user_id: U, ultimo_valor: 5, ultimo_em: "ontem" })).toBeNull();
  });

  it("motivo estranho fica sem texto", () => {
    expect(lerGanho({ user_id: U, ultimo_valor: 5, ultimo_motivo: "<b>oi</b>", ultimo_em: "2026-11-02T12:00:00Z" })?.motivo).toBe("");
  });
});

describe("juntarOnline", () => {
  it("vários nanicos viram um aviso só", () => {
    expect(juntarOnline([{ fid: "a", nome: "John", valor: 1 }, { fid: "b", nome: "Max", valor: 1 }, { fid: "a", nome: "John", valor: 1 }])).toEqual({
      fid: null, nome: "2 nanicos", valor: 3, pessoas: 2,
    });
  });

  it("um nanico só continua com o rosto dele", () => {
    expect(juntarOnline([{ fid: "a", nome: "John", valor: 1 }, { fid: "a", nome: "John", valor: 1 }])).toEqual({ fid: "a", nome: "John", valor: 2, pessoas: 1 });
    expect(juntarOnline([])).toBeNull();
  });
});
