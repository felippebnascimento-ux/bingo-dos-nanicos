/*
 * Poses desenhadas dos bonecos (04/11/2026): uma segunda folha por nanico, `public/arte/bonecos/poses/<slug>.webp`, com
 * 16 quadros numa grade de 4×4 (célula de 336×402 px, 3x das medidas abaixo, mais larga que a do andar para caber o
 * deitado; o pé no mesmo ponto). Linhas: 0 = sentar, acenar 1 e 2, deitar; 1 = os 4 da dança; 2 = rir, joinha, pular,
 * sentar no chão; 3 = de costas: sentar, acenar e os 2 da dança. Os lados esquerdos são o espelho, como no andar.
 * Regra pura e testada: qual quadro mostrar para cada pose, de frente ou de costas, num instante.
 */

/** célula de um quadro de pose nas medidas do código (a folha tem 3x) e o ponto do pé dentro dela */
export const POSE_W = 112;
export const POSE_H = 134;
export const POSE_ANCORA = { x: 56, y: 132 };
export const POSE_COLS = 4;
export const POSE_LINHAS = 4;

/** as poses que a folha desenha (as ações de acoes.ts e o sentar dos assentos) */
export type Pose = "sentar" | "deita" | "acena" | "danca" | "ri" | "joinha" | "pula" | "chao";

type Seq = { q: readonly (readonly [number, number])[]; ms: number };
/* [coluna, linha] de cada quadro; ms = tempo de cada um (0 = parado) */
const FRENTE: Record<Pose, Seq> = {
  sentar: { q: [[0, 0]], ms: 0 },
  acena: { q: [[1, 0], [2, 0]], ms: 280 },
  deita: { q: [[3, 0]], ms: 0 },
  danca: { q: [[0, 1], [1, 1], [2, 1], [1, 1], [3, 1], [1, 1]], ms: 240 },
  ri: { q: [[0, 2]], ms: 0 },
  joinha: { q: [[1, 2]], ms: 0 },
  pula: { q: [[2, 2]], ms: 0 },
  chao: { q: [[3, 2]], ms: 0 },
};
/* de costas só há sentar, acenar e dançar; as outras viram de frente (rir, joinha, pular, deitar, sentar no chão) */
const COSTAS: Partial<Record<Pose, Seq>> = {
  sentar: { q: [[0, 3]], ms: 0 },
  acena: { q: [[1, 3]], ms: 0 },
  danca: { q: [[2, 3], [3, 3]], ms: 300 },
};

/** A sequência de quadros de uma pose (de costas, se a folha tiver; senão a de frente). */
export const sequenciaPose = (pose: Pose, costas: boolean): Seq => (costas ? COSTAS[pose] : undefined) ?? FRENTE[pose];

/** Se a pose de costas existe (senão o boneco vira de frente para fazer). */
export const temCostas = (pose: Pose) => !!COSTAS[pose];

/** O quadro [coluna, linha] da pose no instante t (ms desde o começo). */
export function quadroPose(pose: Pose, costas: boolean, t: number): readonly [number, number] {
  const s = sequenciaPose(pose, costas);
  if (s.q.length === 1 || !s.ms) return s.q[0];
  return s.q[Math.floor(Math.max(0, t) / s.ms) % s.q.length];
}

/** background-position (em %) do quadro numa folha de 4×4. */
export const posicaoPose = ([c, l]: readonly [number, number]) => `${(c / (POSE_COLS - 1)) * 100}% ${(l / (POSE_LINHAS - 1)) * 100}%`;
