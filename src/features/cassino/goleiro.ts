/*
 * Desenho do goleiro do Pênalti: braços, pernas e dedos são "membros" afinando de uma ponta à outra (duas bolinhas
 * ligadas pelas tangentes), o que dá forma de músculo sem precisar de imagem. Regra pura de geometria, testada.
 */
export type Ponto = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Caminho SVG de um membro que vai de `a` (raio `ra`) até `b` (raio `rb`): as duas pontas arredondadas e os lados
 * tangentes às duas bolinhas. Com os raios iguais, vira uma cápsula.
 */
export function membro(a: Ponto, b: Ponto, ra: number, rb: number): string {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  /* ângulo do eixo e quanto as tangentes abrem (pelos raios diferentes) */
  const ang = Math.atan2(dy, dx);
  const abre = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)));
  const p = (c: Ponto, r: number, t: number): string => `${r1(c[0] + r * Math.cos(t))} ${r1(c[1] + r * Math.sin(t))}`;
  const a1 = ang + abre, a2 = ang - abre;
  return `M${p(a, ra, a1)} L${p(b, rb, a1)} A${rb} ${rb} 0 0 0 ${p(b, rb, a2)} L${p(a, ra, a2)} A${ra} ${ra} 0 1 0 ${p(a, ra, a1)} Z`;
}

/** Um ponto entre `a` e `b` (t de 0 a 1). */
export const entre = (a: Ponto, b: Ponto, t: number): Ponto => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
