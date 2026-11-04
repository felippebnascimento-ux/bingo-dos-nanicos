/* Apostas na partida ao vivo (seção 14 do seguranca.sql): as contas do pari-mútuo, só para mostrar.
   Quem paga é o banco (apostas_liquidar); isto espelha a mesma conta para a tela e para o teste. */

export type Lado = 100 | 200;
export const CASA = 0.05;
export const APOSTA_MIN = 5;
/** as apostas fecham 5 minutos depois do início */
export const JANELA_MS = 5 * 60_000;

export const nomeLado = (l: Lado) => (l === 100 ? "azul" : "vermelho");

/* ---------- a conta para dois lados quaisquer (0 e 1): o LoL (100/200) e o truco (dupla 0/1) usam esta ---------- */
export type LadoN = 0 | 1;

/** Quanto volta se esse lado vencer. `jaConta` = a aposta já está somada nos bolos (já apostei). */
export function retornoLados(valor: number, lado: LadoN, bolos: readonly [number, number], jaConta = false): number {
  if (!(valor > 0)) return 0;
  const extra = jaConta ? 0 : valor;
  const b: [number, number] = [bolos[0] + (lado === 0 ? extra : 0), bolos[1] + (lado === 1 ? extra : 0)];
  /* ninguém do outro lado: devolve o apostado */
  if (b[1 - lado] === 0) return valor;
  const total = b[0] + b[1];
  return Math.floor(((total - Math.floor(total * CASA)) * valor) / b[lado]);
}

export type ApostaN = { userId: string; lado: LadoN; valor: number };
export type Divisao = { pagos: Map<string, number>; casa: number; devolvido: boolean };

/** Quem recebe quanto no fim (igual a apostas_liquidar e truco_mercado_liquidar). Sem vencedor ou um lado vazio devolve tudo. */
export function divisaoLados(apostas: readonly ApostaN[], vencedor: LadoN | null, devolver = false): Divisao {
  const b = [0, 1].map((l) => apostas.filter((a) => a.lado === l).reduce((s, a) => s + a.valor, 0));
  const pagos = new Map<string, number>();
  if (devolver || vencedor === null || !b[0] || !b[1]) {
    for (const a of apostas) pagos.set(a.userId, a.valor);
    return { pagos, casa: 0, devolvido: true };
  }
  const total = b[0] + b[1];
  const sobra = total - Math.floor(total * CASA);
  let soma = 0;
  for (const a of apostas) {
    const v = a.lado === vencedor ? Math.floor((sobra * a.valor) / b[vencedor]) : 0;
    pagos.set(a.userId, v);
    soma += v;
  }
  return { pagos, casa: total - soma, devolvido: false };
}

/* ---------- LoL: lados 100 (azul) e 200 (vermelho) ---------- */
const n = (l: Lado): LadoN => (l === 100 ? 0 : 1);

/** Quanto volta se esse lado vencer. `jaConta` = a aposta já está somada nos bolos (já apostei). */
export function retornoEstimado(valor: number, lado: Lado, bolo100: number, bolo200: number, jaConta = false): number {
  return retornoLados(valor, n(lado), [bolo100, bolo200], jaConta);
}

export type Aposta = { userId: string; lado: Lado; valor: number };

/** Quem recebe quanto no fim (igual a apostas_liquidar). Remake, sem vencedor ou um lado vazio devolve tudo. */
export function divisao(apostas: readonly Aposta[], vencedor: Lado | null, remake = false): Divisao {
  return divisaoLados(apostas.map((a) => ({ ...a, lado: n(a.lado) })), vencedor ? n(vencedor) : null, remake);
}
