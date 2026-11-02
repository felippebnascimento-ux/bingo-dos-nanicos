/*
 * Atributos votados (a metade zoeira da ficha): os seis atributos, conferir as notas antes de mandar
 * e escrever as médias. Quem calcula a média é o banco (atributos_de), sem mostrar quem votou.
 */

export type ChaveAtributo = "tilt" | "choro" | "clutch" | "farm" | "sorte" | "call";
export type Notas = Record<ChaveAtributo, number>;
export type Media = { media: number | null; votos: number };
export type Atributos = Record<ChaveAtributo, Media>;

/* em ordem alfabética (as notas são guardadas por chave, então a ordem é só da tela) */
export const ATRIBUTOS: readonly { chave: ChaveAtributo; nome: string; dica: string; cs2?: boolean }[] = [
  { chave: "call", nome: "Call", dica: "quanto as calls dele funcionam" },
  { chave: "choro", nome: "Choro", dica: "quanto chora depois de morrer" },
  { chave: "clutch", nome: "Clutch", dica: "quanto resolve no um contra vários", cs2: true },
  { chave: "farm", nome: "Farm", dica: "quanto farma em vez de brigar" },
  { chave: "sorte", nome: "Sorte", dica: "quanto a sorte ajuda" },
  { chave: "tilt", nome: "Tilt", dica: "quanto perde a cabeça depois de um erro" },
];
const CHAVES = ATRIBUTOS.map((a) => a.chave);

/** Notas de quem ainda não votou: tudo no meio. */
export const notasPadrao = (): Notas => Object.fromEntries(CHAVES.map((k) => [k, 5])) as Notas;

/** Confere as notas antes de mandar: as 6 chaves, inteiros de 0 a 10. Devolve null se algo estiver errado. */
export function limparNotas(v: unknown): Notas | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).length !== CHAVES.length) return null;
  const out = {} as Notas;
  for (const k of CHAVES) {
    const n = o[k];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 10) return null;
    out[k] = n;
  }
  return out;
}

const media = (v: unknown): Media => {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const m = typeof o.media === "number" && Number.isFinite(o.media) ? Math.min(10, Math.max(0, o.media)) : null;
  const votos = typeof o.votos === "number" && Number.isFinite(o.votos) ? Math.max(0, Math.trunc(o.votos)) : 0;
  return { media: m, votos };
};

/** Lê os atributos de um nanico (resposta de atributos_de). */
export function lerAtributos(v: unknown): Atributos | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return Object.fromEntries(CHAVES.map((k) => [k, media(o[k])])) as Atributos;
}

/** Lê os atributos de todos (resposta de atributos_todos: {id do nanico: atributos}). */
export function lerTodos(v: unknown): Record<string, Atributos> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, Atributos> = {};
  for (const [fid, a] of Object.entries(v as Record<string, unknown>).slice(0, 60)) {
    const at = lerAtributos(a);
    if (at) out[fid] = at;
  }
  return out;
}

/** 8.7 → "8,7"; sem média (menos de 3 votos) → "poucos votos". */
export const textoMedia = (m: Media) => (m.media === null ? "poucos votos" : m.media.toFixed(1).replace(".", ","));

/** Quantos votaram (todos os atributos têm a mesma contagem). */
export const totalVotos = (a: Atributos) => Math.max(...CHAVES.map((k) => a[k].votos));

/** "2026-11-08T…" → "08/11". */
export function diaMes(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}
