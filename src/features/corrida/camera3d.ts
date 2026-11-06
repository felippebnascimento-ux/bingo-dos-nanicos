/*
 * As contas da pista da corrida (05/11/2026): a cena é vista de lado, um pouco de cima, como na transmissão, montada em
 * camadas (o fundo com a arquibancada desliza devagar; a pista, o poste e o portão andam com a câmera; a cerca de fora
 * passa na frente dos cavalos). O mundo: x ao longo da pista (0 = portão de largada, COMPR = a chegada); cada raia tem a
 * altura do casco na tela e o tamanho do cavalo (as de dentro, mais longe, menores). Puro e testado.
 */
export const COMPR = 140;
/** A cena tem W × H e cada unidade da pista vale K px. */
export const W = 1000;
export const H = 520;
export const K = 52;

/** A faixa da pista (pista.webp tem 205 px de altura) começa em PISTA_Y e vai até o fim da cena. */
export const PISTA_Y = 196;
export const PISTA_ALT = 205;
export const PISTA_ESC = (H - PISTA_Y) / PISTA_ALT;
/** Onde, na faixa da pista, estão a cerca de dentro e a cerca de fora. */
export const CERCA_DENTRO_Y = PISTA_Y + 30 * PISTA_ESC;
export const AREIA_FIM_Y = PISTA_Y + 190 * PISTA_ESC;

/** Altura do casco na tela (0 = raia 1, a de dentro). */
export const yRaia = (i: number) => PISTA_Y + (60 + i * 16.8) * PISTA_ESC;
/** Tamanho do cavalo na raia (a de fora, mais perto, é 1). */
export const escRaia = (i: number) => 0.74 + i * 0.037;
/** x na tela de um ponto da pista com a câmera em `cam`. */
export const telaX = (x: number, cam: number) => W * 0.5 + (x - cam) * K;
/** Quanto a faixa da pista (que se repete a cada `larg` px) está deslocada. */
export const deslocFaixa = (cam: number, larg: number) => (((cam * K) % larg) + larg) % larg;

/** Onde a câmera fica: no portão antes da largada, um pouco atrás do líder durante a corrida e na chegada no fim. */
export function focoDaCamera(fase: "inscricoes" | "apostas" | "correndo" | "fim", lider: number) {
  if (fase === "inscricoes" || fase === "apostas") return 0;
  if (fase === "fim") return COMPR + 6;
  return Math.max(0, Math.min(COMPR + 6, lider - 2));
}
