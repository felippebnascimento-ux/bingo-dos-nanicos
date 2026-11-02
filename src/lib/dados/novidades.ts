/*
 * Novidades desde a última visita: o que mostrar no Log que abre sozinho depois de uma atualização.
 * O "já vi" é o índice da entrada no CHANGELOG (guardado na conta, em user_metadata.log_visto).
 */
import { CHANGELOG, versionAt, type EntradaLog } from "./changelog";

export type EntradaComVersao = EntradaLog & { i: number; v: string };

/** Índice da versão atual (a última entrada do CHANGELOG). */
export const ULTIMA = CHANGELOG.length - 1;

/**
 * Lê o "já vi" vindo da conta (número) ou do navegador (o texto antigo "v1.NN").
 * Qualquer outra coisa vira null (nunca viu).
 */
export function lerVisto(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 ? v : null;
  if (typeof v === "string") {
    const m = /^v1\.(\d{1,4})$/.exec(v.trim());
    return m ? Number(m[1]) : null;
  }
  return null;
}

/** O mais recente dos dois "já vi" (conta e navegador). */
export const juntarVisto = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/** Tem algo que a pessoa ainda não viu? */
export const temNovidade = (visto: number | null, ultima = ULTIMA) => visto === null || visto < ultima;

/**
 * Entradas depois de `visto`, da mais nova para a mais antiga.
 * Quem nunca viu nada (null) recebe só a última, para não despejar o log inteiro.
 */
export function novidadesDesde(visto: number | null, lista: readonly EntradaLog[] = CHANGELOG): EntradaComVersao[] {
  const ultima = lista.length - 1;
  const desde = visto === null ? ultima - 1 : visto;
  return lista
    .map((e, i) => ({ ...e, i, v: versionAt(i) }))
    .filter((e) => e.i > desde)
    .reverse();
}

/** O log inteiro, da mais nova para a mais antiga. */
export const todasAsVersoes = () => novidadesDesde(-1);
