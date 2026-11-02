import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* A função truco-mesa usa uma cópia das regras (o Supabase não empacota a pasta src). As duas têm que ser iguais. */
describe("cópia do engine na função truco-mesa", () => {
  it("é igual ao engine.ts (rode npm run sincronizar:truco)", () => {
    const origem = readFileSync("src/features/truco/engine.ts", "utf8");
    const copia = readFileSync("supabase/functions/truco-mesa/engine.ts", "utf8");
    expect(copia.startsWith("// GERADO por `npm run sincronizar:truco`")).toBe(true);
    expect(copia.slice(copia.indexOf("\n") + 1)).toBe(origem);
  });
});
