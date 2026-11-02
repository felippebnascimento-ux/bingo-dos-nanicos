import { describe, expect, it } from "vitest";
import { eloTexto, haQuanto, horasTexto, kdaTexto, lerNumeros, taxaVitoria } from "./numeros";

describe("lerNumeros", () => {
  it("separa LoL e Steam e confere os campos", () => {
    const r = lerNumeros({
      linhas: [
        { fonte: "lol", dados: { tier: "GOLD", rank: "II", lp: 40, vitorias: 30, derrotas: 26, kda: 3.14, main: "Yasuo", partidas: 20 }, erro: null, atualizado: "2026-11-01T20:00:00Z" },
        { fonte: "steam", dados: { cs2_horas: 1284, total_horas: 2000, privado: false }, erro: null, atualizado: "2026-11-01T20:00:00Z" },
        { fonte: "outra", dados: {} },
      ],
      avisos: ["Falta a chave da Steam", 42],
    });
    expect(r.lol?.dados).toEqual({ tier: "GOLD", rank: "II", lp: 40, vitorias: 30, derrotas: 26, kda: 3.14, main: "Yasuo", partidas: 20 });
    expect(r.steam?.dados).toEqual({ cs2Horas: 1284, totalHoras: 2000, privado: false });
    expect(r.lol?.atualizado).toBe(Date.parse("2026-11-01T20:00:00Z"));
    expect(r.avisos).toEqual(["Falta a chave da Steam"]);
  });

  it("dados vazios com erro viram só o erro", () => {
    const r = lerNumeros({ linhas: [{ fonte: "lol", dados: {}, erro: "Não achei a conta", atualizado: "x" }] });
    expect(r.lol).toEqual({ dados: null, erro: "Não achei a conta", atualizado: 0 });
  });

  it("lixo não quebra", () => {
    for (const v of [null, "x", 1, {}, { linhas: "a" }, { linhas: [null, 1, "a"] }]) expect(lerNumeros(v)).toEqual({ lol: null, steam: null, avisos: [] });
    expect(lerNumeros({ linhas: [{ fonte: "lol", dados: { tier: 5, vitorias: "9", kda: "3" } }] }).lol?.dados).toEqual({
      tier: null, rank: null, lp: null, vitorias: 0, derrotas: 0, kda: null, main: null, partidas: 0,
    });
  });
});

describe("textos", () => {
  it("elo em português", () => {
    expect(eloTexto({ tier: "GOLD", rank: "II" })).toBe("Ouro II");
    expect(eloTexto({ tier: "EMERALD", rank: "IV" })).toBe("Esmeralda IV");
    expect(eloTexto({ tier: "MASTER", rank: "I" })).toBe("Mestre");
    expect(eloTexto({ tier: null, rank: null })).toBe("Sem elo");
  });

  it("porcentagem, KDA e horas", () => {
    expect(taxaVitoria(30, 26)).toBe(54);
    expect(taxaVitoria(0, 0)).toBeNull();
    expect(kdaTexto(3.14)).toBe("3,1");
    expect(horasTexto(1284)).toBe("1.284");
  });

  it("há quanto tempo", () => {
    const agora = Date.parse("2026-11-01T20:00:00Z");
    expect(haQuanto(agora - 20_000, agora)).toBe("agora");
    expect(haQuanto(agora - 5 * 60_000, agora)).toBe("há 5 min");
    expect(haQuanto(agora - 3 * 3600_000, agora)).toBe("há 3 h");
    expect(haQuanto(agora - 50 * 3600_000, agora)).toBe("há 2 dias");
  });
});
