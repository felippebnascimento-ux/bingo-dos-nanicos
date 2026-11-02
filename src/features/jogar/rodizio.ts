/*
 * Regras da roleta do rodízio (puras e testadas). Quem sorteia é o banco (rodizio_girar); aqui só
 * a ordem das fatias, onde a roleta para e as "partidas seguidas" de cada um no time.
 */

/** Fatias da roleta: quem está na fila e ainda não entrou nesta rodada, em ordem de nome (como o banco). */
export function candidatos(fila: readonly string[], jaEntraram: readonly string[], nomes: Readonly<Record<string, string>>): string[] {
  const ja = new Set(jaEntraram);
  return [...new Set(fila)]
    .filter((id) => !ja.has(id) && nomes[id] !== undefined)
    .sort((a, b) => nomes[a].toLowerCase().localeCompare(nomes[b].toLowerCase(), "pt-BR") || (a < b ? -1 : 1));
}

/** Acabaram os candidatos com gente na fila: a próxima girada começa a rodada seguinte com todo mundo. */
export const rodadaNova = (fila: readonly string[], jaEntraram: readonly string[], nomes: Readonly<Record<string, string>>) =>
  candidatos(fila, jaEntraram, nomes).length === 0 && candidatos(fila, [], nomes).length > 0;

/**
 * Giro (em graus, sentido horário) para a fatia `indice` parar no meio, embaixo do ponteiro de cima.
 * As fatias começam no topo e seguem no sentido horário.
 */
export function anguloFinal(indice: number, total: number, voltas: number) {
  if (total <= 0) return 0;
  const fatia = 360 / total;
  return 360 * voltas + (360 - (indice + 0.5) * fatia);
}

/**
 * Há quantas trocas a pessoa está no time ("4 seguidas"). `noTime` guarda em qual troca cada um entrou;
 * quem já estava antes do rodízio conta desde o começo.
 */
export function seguidas(noTime: Readonly<Record<string, number>>, trocas: number, fid: string) {
  const entrou = noTime[fid];
  return trocas - (typeof entrou === "number" ? entrou : 0) + 1;
}

/** Rota sugerida para sair: quem está há mais trocas no time. Empate: a primeira rota (Top primeiro). */
export function sugestaoDeSaida(lineup: readonly { friendId: string }[], noTime: Readonly<Record<string, number>>, trocas: number): number {
  let melhor = -1;
  let mais = -Infinity;
  lineup.slice(0, 5).forEach((l, i) => {
    const n = l.friendId ? seguidas(noTime, trocas, l.friendId) : Infinity;
    if (n > mais) {
      mais = n;
      melhor = i;
    }
  });
  return melhor < 0 ? 0 : melhor;
}
