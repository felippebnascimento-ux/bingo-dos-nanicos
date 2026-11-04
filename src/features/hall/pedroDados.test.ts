import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ sb: () => ({}), errMsg: () => "" }));
vi.mock("@/lib/sala", () => ({ aoConectar: () => {}, aoMudarTabela: () => {} }));

import { festaAtiva, lerFesta, PEDRO_MS } from "./pedroDados";

const U = "11111111-1111-1111-1111-111111111111";

describe("Pedro no K-FOFO", () => {
  it("lê a linha do tempo real só com id e user_id válidos", () => {
    expect(lerFesta({ id: 3, user_id: U }, 1000)).toEqual({ id: 3, userId: U, inicio: 1000 });
    expect(lerFesta({ id: "3", user_id: U })).toBeNull();
    expect(lerFesta({ id: 0, user_id: U })).toBeNull();
    expect(lerFesta({ id: 3, user_id: 7 })).toBeNull();
    expect(lerFesta(null)).toBeNull();
  });
  it("quem chega no meio entra no ponto certo (e nunca além do fim)", () => {
    expect(lerFesta({ id: 3, user_id: U }, 10_000, 4000)?.inicio).toBe(6000);
    expect(lerFesta({ id: 3, user_id: U }, 10_000, 999_999)?.inicio).toBe(10_000 - PEDRO_MS);
    expect(lerFesta({ id: 3, user_id: U }, 10_000, NaN)?.inicio).toBe(10_000);
  });
  it("a festa dura o tamanho da música", () => {
    const f = { id: 1, userId: U, inicio: 0 };
    expect(festaAtiva(f, 0)).toBe(true);
    expect(festaAtiva(f, PEDRO_MS - 1)).toBe(true);
    expect(festaAtiva(f, PEDRO_MS)).toBe(false);
    expect(festaAtiva(null, 5)).toBe(false);
  });
});
