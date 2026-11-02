// Copia as regras do truco (src/features/truco/engine.ts) para a função truco-mesa, que roda no Supabase
// e não enxerga a pasta src na publicação. Rode `npm run sincronizar:truco` depois de mexer no engine.ts;
// o teste engine-copia.test.ts falha se as duas cópias ficarem diferentes.
import { readFileSync, writeFileSync } from "node:fs";

export const CABECALHO =
  "// GERADO por `npm run sincronizar:truco` a partir de src/features/truco/engine.ts. NÃO EDITE AQUI.\n";
const origem = new URL("../src/features/truco/engine.ts", import.meta.url);
const destino = new URL("../supabase/functions/truco-mesa/engine.ts", import.meta.url);
writeFileSync(destino, CABECALHO + readFileSync(origem, "utf8"));
console.log("truco-mesa/engine.ts atualizado");
