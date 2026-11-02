/*
 * Aviãozinho (seção 29 do seguranca.sql): as contas do voo, iguais às do banco, só para MOSTRAR.
 * Quem decide se o saque valeu é o banco, pelo relógio dele; o ponto de queda nunca chega antes do fim.
 */

/** O multiplicador cresce e^(0,07 × segundos): 2× em ~9,9 s, 10× em ~33 s. */
export const K = 0.07;

/** Multiplicador depois de `ms` de voo (2 casas, para baixo, como o SQL aviao_mult). */
export function multAt(ms: number) {
  const s = Math.min(600, Math.max(0, ms / 1000));
  return Math.floor(Math.exp(K * s) * 100) / 100;
}

/** Quanto tempo (ms) até chegar no multiplicador `m`. */
export const tempoAte = (m: number) => (Math.log(Math.max(1, m)) / K) * 1000;

/** Cor da pílula dos últimos voos: azul abaixo de 2×, roxo até 10×, rosa acima. */
export const faixaVoo = (m: number) => (m < 2 ? "lo" : m < 10 ? "mid" : "hi");

/** "2,47×" */
export const textoMult = (m: number) => `${m.toFixed(2).replace(".", ",")}×`;

/** Quanto recebe sacando agora (como o banco: para baixo). */
export const recebe = (aposta: number, m: number) => Math.floor(aposta * m);

/**
 * Pontos da curva para o céu (0 a 1 nos dois eixos): o tempo vai ocupando a largura e a altura acompanha o
 * multiplicador, com a escala crescendo junto para o avião nunca sair da tela durante o voo.
 */
export function curva(ms: number, n = 40): [number, number][] {
  const T = Math.max(ms, 8000);
  const topo = Math.max(2, multAt(ms) * 1.25);
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = (ms * k) / n;
    const m = Math.exp((K * t) / 1000);
    pts.push([t / T, (m - 1) / (topo - 1)]);
  }
  return pts;
}
