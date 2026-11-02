import { describe, expect, it } from "vitest";
import { eventoAgora, fimDoEvento, happyAgora, horaBr, textoFalta } from "./eventos";

/* Brasília é UTC-3 (sem horário de verão): 22:00 em Brasília = 01:00 UTC do dia seguinte */
const br = (s: string) => new Date(s + "-03:00");

describe("eventos com horário", () => {
  it("lê a hora de Brasília, não a do aparelho", () => {
    expect(horaBr(new Date("2026-11-05T01:30:00Z"))).toEqual({ dow: 3, h: 22, m: 30, s: 0, dia: "2026-11-04" });
  });

  it("happy hour: das 22:00 às 23:59", () => {
    expect(eventoAgora(br("2026-11-04T21:59:59"))).toBe(null);
    expect(eventoAgora(br("2026-11-04T22:00:00"))).toBe("happy");
    expect(eventoAgora(br("2026-11-04T23:59:59"))).toBe("happy");
    expect(eventoAgora(br("2026-11-05T00:00:00"))).toBe(null);
  });

  it("sábado: churrasco das 18:00 às 22:59, depois happy hour", () => {
    expect(eventoAgora(br("2026-11-07T17:59:00"))).toBe(null);
    expect(eventoAgora(br("2026-11-07T18:00:00"))).toBe("churrasco");
    expect(eventoAgora(br("2026-11-07T22:30:00"))).toBe("churrasco");
    expect(happyAgora(br("2026-11-07T22:30:00"))).toBe(true);
    expect(eventoAgora(br("2026-11-07T23:00:00"))).toBe("happy");
    expect(eventoAgora(br("2026-11-06T19:00:00"))).toBe(null);
  });

  it("fim do evento", () => {
    expect(fimDoEvento(br("2026-11-04T22:15:00"))?.getTime()).toBe(br("2026-11-05T00:00:00").getTime());
    expect(fimDoEvento(br("2026-11-07T19:00:30"))?.getTime()).toBe(br("2026-11-07T23:00:00").getTime());
    expect(fimDoEvento(br("2026-11-04T15:00:00"))).toBe(null);
  });

  it("texto do que falta", () => {
    expect(textoFalta(45_000)).toBe("45s");
    expect(textoFalta(12 * 60_000)).toBe("12min");
    expect(textoFalta(65 * 60_000)).toBe("1h 05min");
  });
});
