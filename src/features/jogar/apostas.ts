/* Apostas na partida ao vivo (seção 14 do seguranca.sql): as contas do pari-mútuo, só para mostrar.
   Quem paga é o banco (apostas_liquidar); isto espelha a mesma conta para a tela e para o teste. */

export type Lado = 100 | 200;
export const CASA = 0.05;
export const APOSTA_MIN = 5;
export const APOSTA_MAX = 100;
/** as apostas fecham 5 minutos depois do início */
export const JANELA_MS = 5 * 60_000;

export const nomeLado = (l: Lado) => (l === 100 ? "azul" : "vermelho");

/** Quanto volta se esse lado vencer. `jaConta` = a aposta já está somada nos bolos (já apostei). */
export function retornoEstimado(valor: number, lado: Lado, bolo100: number, bolo200: number, jaConta = false): number {
  if (!(valor > 0)) return 0;
  const extra = jaConta ? 0 : valor;
  const b100 = bolo100 + (lado === 100 ? extra : 0);
  const b200 = bolo200 + (lado === 200 ? extra : 0);
  const contra = lado === 100 ? b200 : b100;
  /* ninguém do outro lado: devolve o apostado */
  if (contra === 0) return valor;
  const total = b100 + b200;
  const meu = lado === 100 ? b100 : b200;
  return Math.floor(((total - Math.floor(total * CASA)) * valor) / meu);
}

export type Aposta = { userId: string; lado: Lado; valor: number };
export type Divisao = { pagos: Map<string, number>; casa: number; devolvido: boolean };

/** Quem recebe quanto no fim (igual a apostas_liquidar). Remake, sem vencedor ou um lado vazio devolve tudo. */
export function divisao(apostas: readonly Aposta[], vencedor: Lado | null, remake = false): Divisao {
  const b100 = apostas.filter((a) => a.lado === 100).reduce((s, a) => s + a.valor, 0);
  const b200 = apostas.filter((a) => a.lado === 200).reduce((s, a) => s + a.valor, 0);
  const pagos = new Map<string, number>();
  if (remake || !vencedor || !b100 || !b200) {
    for (const a of apostas) pagos.set(a.userId, a.valor);
    return { pagos, casa: 0, devolvido: true };
  }
  const total = b100 + b200;
  const sobra = total - Math.floor(total * CASA);
  const bolo = vencedor === 100 ? b100 : b200;
  let soma = 0;
  for (const a of apostas) {
    const v = a.lado === vencedor ? Math.floor((sobra * a.valor) / bolo) : 0;
    pagos.set(a.userId, v);
    soma += v;
  }
  return { pagos, casa: total - soma, devolvido: false };
}
