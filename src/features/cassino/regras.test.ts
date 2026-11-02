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

/* a mesma semente do SQL (seção 11b): os 14 rostos com peso 10, bola 4 e moeda 6 */
const ROLOS = [...Array.from({ length: 14 }, (_, k) => ({ simbolo: `n${k + 1}`, peso: 10, ordem: k + 1 })), { simbolo: "bola", peso: 4, ordem: 15 }, { simbolo: "moeda", peso: 6, ordem: 16 }];
const PAGAMENTOS = { tres_bola: 1000, tres_moeda: 200, tres_rosto: 80, duas_moedas: 25, uma_moeda: 4 };

describe("limbo, maior ou menor e caça-níquel", async () => {
  const r = await import("./regras");

  it("limbo devolve 97% em qualquer alvo (integração exata: chance × alvo)", () => {
    for (const alvo of [1.01, 1.5, 2, 10, 33.33, 100]) expect(r.chanceLimbo(alvo) * alvo).toBeCloseTo(0.97, 12);
    expect(r.valorLimbo(0)).toBe(1);
    expect(r.valorLimbo(0.5)).toBe(1.94);
    expect(r.pagamentoLimbo(2, 2, 10)).toBe(20);
    expect(r.pagamentoLimbo(2, 1.99, 10)).toBe(0);
  });

  it("maior ou menor devolve 97% (chance × pagamento) e só aceita chance de 1% a 95%", () => {
    for (const [lado, n] of [["abaixo", 5000], ["acima", 5000], ["abaixo", 100], ["acima", 500]] as const) {
      const c = r.chanceDado(lado, n);
      expect(c * (0.97 / c)).toBeCloseTo(0.97, 12);
    }
    expect(r.pagamentoDado("abaixo", 5000, 10)).toBe(19);
    expect(r.chanceValida(r.chanceDado("abaixo", 0))).toBe(false);
    expect(r.chanceValida(r.chanceDado("abaixo", 9900))).toBe(false);
    expect(r.numeroDado(0.99995)).toBe(9999);
  });

  it("o RTP exato do caça-níquel fica em 92% com a tabela do banco", () => {
    const rtp = r.rtpSlot(ROLOS, PAGAMENTOS);
    expect(rtp).toBeGreaterThan(0.915);
    expect(rtp).toBeLessThan(0.925);
    expect(r.multSlot("bola", "bola", "bola", PAGAMENTOS)).toBe(1000);
    expect(r.multSlot("n3", "n3", "n3", PAGAMENTOS)).toBe(80);
    expect(r.multSlot("moeda", "n1", "moeda", PAGAMENTOS)).toBe(25);
    expect(r.multSlot("n1", "n2", "moeda", PAGAMENTOS)).toBe(4);
    expect(r.multSlot("n1", "n2", "n3", PAGAMENTOS)).toBe(0);
    expect(r.simboloSlot(0, ROLOS)).toBe("n1");
    expect(r.simboloSlot(0.9999, ROLOS)).toBe("moeda");
  });

  it("refazer() reproduz cada jogo a partir da semente revelada", async () => {
    const semente = "1a".repeat(32);
    const uDe = (n: number) => parseInt(createHmac("sha256", Buffer.from(semente, "hex")).update(`x:${n}`).digest("hex").slice(0, 13), 16) / 2 ** 52;
    expect(await r.refazer("dado", 5, semente, "x", ROLOS)).toBe(String(Math.floor(uDe(5) * 10000)));
    expect(await r.refazer("limbo", 6, semente, "x", ROLOS)).toBe(r.valorLimbo(uDe(6)).toFixed(2));
    expect(await r.refazer("slot", 7, semente, "x", ROLOS)).toBe([7, 8, 9].map((n) => r.simboloSlot(uDe(n), ROLOS)).join(","));
    expect(r.resultadoGuardado("slot", { simbolos: ["n1", "bola", "moeda"] })).toBe("n1,bola,moeda");
  });
});
