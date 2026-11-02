/*
 * Zoeira no hall (chinelada e torta): o voo em arco entre as cabeças e o cambaleio de quem leva.
 * Puro e testado; a tela (zoeiraSala.ts) só chama a cada quadro.
 */

export type Ponto = { x: number; y: number };

/** Ponto do chinelo/torta no tempo `t` (0 a 1): reta entre as cabeças mais uma parábola para cima. */
export function arco(de: Ponto, para: Ponto, t: number): Ponto {
  const k = Math.min(1, Math.max(0, t));
  const dist = Math.hypot(para.x - de.x, para.y - de.y);
  const altura = 40 + dist * 0.3;
  return { x: de.x + (para.x - de.x) * k, y: de.y + (para.y - de.y) * k - 4 * altura * k * (1 - k) };
}

/** Quanto dura o cambaleio de quem levou a chinelada (ms). */
export const CAMBALEIO_MS = 600;

/** Ângulo do boneco (graus, −8 a +8) `ms` depois da pancada: balança e vai parando. */
export function cambalear(ms: number): number {
  if (ms <= 0 || ms >= CAMBALEIO_MS) return 0;
  return 8 * Math.exp(-ms / 220) * Math.sin((ms / 150) * 2 * Math.PI + Math.PI / 2) * (1 - ms / CAMBALEIO_MS);
}
