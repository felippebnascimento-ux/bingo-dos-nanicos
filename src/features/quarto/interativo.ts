/*
 * Móveis que fazem algo (seção 53, como no Habbo): dado, luminária, regulador de luz e quadro de recados.
 * O estado de cada um vem do banco (quarto_moveis.estado, mudado só por usar_movel); aqui só se confere e se lê.
 * Regra pura, sem React.
 */

export const INTERATIVOS = ["dado", "luminaria", "regulador", "recado"] as const;
export type Interativo = (typeof INTERATIVOS)[number];
export const ehInterativo = (desenho: string): desenho is Interativo => (INTERATIVOS as readonly string[]).includes(desenho);
/** Só o dono do quarto mexe (o banco confere de novo); o dado é de todo mundo. */
export const soDono = (d: Interativo) => d !== "dado";

export const CORES_LUZ = ["desligado", "ambar", "azul", "rosa", "verde", "roxo"] as const;
export type CorLuz = (typeof CORES_LUZ)[number];
export const NOME_COR: Record<CorLuz, string> = { desligado: "Desligado", ambar: "Âmbar", azul: "Azul", rosa: "Rosa", verde: "Verde", roxo: "Roxo" };

export type EstadoMovel = { n?: number; em?: number; liga?: boolean; cor?: CorLuz; texto?: string };

/** Confere o estado que veio do banco: só os campos conhecidos, nos tipos e tamanhos certos. */
export function lerEstado(v: unknown): EstadoMovel {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const e: EstadoMovel = {};
  if (typeof o.n === "number" && Number.isInteger(o.n) && o.n >= 1 && o.n <= 6) e.n = o.n;
  if (typeof o.em === "number" && Number.isFinite(o.em)) e.em = o.em;
  if (typeof o.liga === "boolean") e.liga = o.liga;
  if (typeof o.cor === "string" && (CORES_LUZ as readonly string[]).includes(o.cor)) e.cor = o.cor as CorLuz;
  if (typeof o.texto === "string" && o.texto) e.texto = o.texto.slice(0, 120);
  return e;
}

/** A luminária começa ligada (sem estado = ligada). */
export const luzLigada = (e: EstadoMovel) => e.liga !== false;

/** A cor do quarto: a do primeiro regulador ligado (null = sem cor). */
export function corDoQuarto(moveis: readonly { desenho: string; estado?: EstadoMovel }[]): Exclude<CorLuz, "desligado"> | null {
  for (const m of moveis) if (m.desenho === "regulador" && m.estado?.cor && m.estado.cor !== "desligado") return m.estado.cor;
  return null;
}
