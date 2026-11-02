import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { casaDaRoleta, conferir, corDa, hashDaSemente, pagamentoRoleta, rtpRoleta, vantagemDaCasa, type TipoAposta } from "./regras";

describe("roleta europeia", () => {
  it("o RTP é exatamente 36/37 para todo tipo de aposta", () => {
    const tipos: [TipoAposta, number][] = [["numero", 0], ["numero", 17], ["numero", 36], ["cor", 0], ["cor", 1], ["paridade", 0], ["paridade", 1], ["metade", 0], ["metade", 1]];
    for (const [t, v] of tipos) expect(rtpRoleta(t, v), `${t} ${v}`).toBeCloseTo(36 / 37, 12);
    expect(vantagemDaCasa()).toBe(2.7);
  });

  it("paga certo e o 0 perde nas apostas de fora", () => {
    expect(pagamentoRoleta("numero", 7, 7, 10)).toBe(360);
    expect(pagamentoRoleta("numero", 7, 8, 10)).toBe(0);
    expect(pagamentoRoleta("cor", 0, 1, 10)).toBe(20); /* 1 é vermelho */
    expect(pagamentoRoleta("cor", 1, 2, 10)).toBe(20); /* 2 é preto */
    expect(pagamentoRoleta("paridade", 0, 0, 10)).toBe(0);
    expect(pagamentoRoleta("metade", 0, 0, 10)).toBe(0);
    expect(pagamentoRoleta("metade", 1, 19, 10)).toBe(20);
    expect(corDa(0)).toBe("verde");
    expect(corDa(36)).toBe("vermelho");
  });
});

describe("conferência", () => {
  it("conferir() reproduz a conta do servidor (vetores calculados à parte)", async () => {
    const semente = "0f".repeat(32);
    for (const [cliente, nonce] of [["nanico", 1], ["nanico", 2], ["meu-cliente", 1000]] as const) {
      const h = createHmac("sha256", Buffer.from(semente, "hex")).update(`${cliente}:${nonce}`).digest("hex");
      const esperado = parseInt(h.slice(0, 13), 16) / 2 ** 52;
      const u = await conferir(semente, cliente, nonce);
      expect(u).toBe(esperado);
      expect(casaDaRoleta(u)).toBe(Math.floor(esperado * 37));
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it("o hash da semente revelada bate com o SHA-256", async () => {
    const semente = "ab".repeat(32);
    expect(await hashDaSemente(semente)).toBe(createHash("sha256").update(Buffer.from(semente, "hex")).digest("hex"));
  });
});
