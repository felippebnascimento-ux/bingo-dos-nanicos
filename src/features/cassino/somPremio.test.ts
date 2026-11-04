import { describe, expect, it } from "vitest";
import { ehPremio, talvezPremio } from "./somPremio";

const EU = "11111111-1111-1111-1111-111111111111";

describe("som do prêmio do cassino", () => {
  it("só a minha carteira, acima de 500, vinda do cassino ou do duelo", () => {
    expect(talvezPremio({ user_id: EU, ultimo_valor: 501, ultimo_motivo: "cassino" }, EU)).toBe(true);
    expect(talvezPremio({ user_id: EU, ultimo_valor: 800, ultimo_motivo: "duelo" }, EU)).toBe(true);
    expect(talvezPremio({ user_id: EU, ultimo_valor: 500, ultimo_motivo: "cassino" }, EU)).toBe(false);
    expect(talvezPremio({ user_id: EU, ultimo_valor: 900, ultimo_motivo: "loja" }, EU)).toBe(false);
    expect(talvezPremio({ user_id: "outro", ultimo_valor: 900, ultimo_motivo: "cassino" }, EU)).toBe(false);
    expect(talvezPremio({ user_id: EU, ultimo_valor: -900, ultimo_motivo: "cassino" }, EU)).toBe(false);
    expect(talvezPremio(null, EU)).toBe(false);
  });
  it("não toca quando o dinheiro só voltou", () => {
    expect(ehPremio({ valor: 720, motivo: "cassino", ref: "roleta" })).toBe(true);
    expect(ehPremio({ valor: 1000, motivo: "cassino", ref: "slot" })).toBe(true);
    expect(ehPremio({ valor: 1000, motivo: "cassino", ref: "poker" })).toBe(false);
    expect(ehPremio({ valor: 600, motivo: "duelo", ref: "duelo:7:premio" })).toBe(true);
    expect(ehPremio({ valor: 600, motivo: "duelo", ref: "duelo:7:devolvida" })).toBe(false);
    expect(ehPremio({ valor: 400, motivo: "cassino", ref: "roleta" })).toBe(false);
    expect(ehPremio(undefined)).toBe(false);
  });
});
