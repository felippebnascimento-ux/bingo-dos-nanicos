import { describe, expect, it } from "vitest";
import { ehGol, faltam, lerEstado, multPenalti, passouDaJanela } from "./mesa";

describe("mesas ao vivo", () => {
  it("lê o estado do banco e recusa lixo", () => {
    expect(lerEstado(null)).toBeNull();
    expect(lerEstado({ jogo: "bingo", agora: "2026-11-02T10:00:00Z" })).toBeNull();
    const e = lerEstado({
      jogo: "roleta",
      fase: "apostas",
      agora: "2026-11-02T10:00:05Z",
      rodada: { id: 7, hash: "ab", abre_em: "2026-11-02T10:00:00Z", fecha_em: "2026-11-02T10:00:15Z", resultado: null },
      gente: [{ nome: "Pin", eu: true, aposta: 50, estado: "aberta", fichas: 2 }],
      ultimos: [{ casa: 3 }],
    });
    expect(e?.rodada?.id).toBe(7);
    expect(e?.gente[0]).toMatchObject({ nome: "Pin", eu: true, aposta: 50, fichas: 2 });
    expect(faltam(e!.rodada!.fechaEm, e!.agora)).toBe(10);
    expect(passouDaJanela(e!.rodada, e!.agora)).toBeCloseTo(1 / 3);
  });

  it("fase desconhecida vira parada", () => {
    expect(lerEstado({ jogo: "aviao", fase: "x", agora: "2026-11-02T10:00:00Z" })?.fase).toBe("parada");
  });

  it("multiplicador do pênalti igual ao do banco", () => {
    expect([0, 1, 2, 3, 4, 5].map(multPenalti)).toEqual([1, 1.45, 2.18, 3.27, 4.91, 7.36]);
  });

  it("gol quando a coluna do chute não é a do goleiro", () => {
    expect(ehGol(0, 0)).toBe(false);
    expect(ehGol(3, 0)).toBe(false);
    expect(ehGol(5, 0)).toBe(true);
    expect(ehGol(4, 2)).toBe(true);
  });
});
