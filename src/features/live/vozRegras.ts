/*
 * Regras puras da voz das salas (sem WebRTC nem React), testadas em vozRegras.test.ts.
 */

/** Em cada par, quem tem a chave menor faz a oferta: assim os dois nunca oferecem ao mesmo tempo. */
export const euOfereco = (minha: string, dele: string) => minha < dele;

/** Volume da amostra (raiz da média dos quadrados), de 0 a 1. */
export function volumeDe(amostra: ArrayLike<number>): number {
  if (!amostra.length) return 0;
  let soma = 0;
  for (let i = 0; i < amostra.length; i++) soma += amostra[i] * amostra[i];
  return Math.sqrt(soma / amostra.length);
}

/** A partir de que volume conta como "falando" e por quanto tempo o anel fica aceso depois da última fala. */
export const LIMIAR_FALA = 0.02;
export const SEGURA_FALA_MS = 350;

/**
 * Quem está falando agora: acende quem passou do limiar e segue aceso até `SEGURA_FALA_MS` depois
 * da última fala (o anel não pisca entre uma palavra e outra).
 */
export function falandoAgora(ultimaFala: ReadonlyMap<string, number>, agora: number): string[] {
  const out: string[] = [];
  for (const [chave, t] of ultimaFala) if (agora - t <= SEGURA_FALA_MS) out.push(chave);
  return out.sort();
}

/** Mesma lista, mesma ordem? (evita avisar o React sem mudança) */
export const mesmaLista = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
