import type { Rosto } from "../tipos";
import { norm } from "../util";

/** Quem é quem: nome do nanico (como está no Supabase) → número da arte em `public/arte/nanicos/`. */
export const NAN_MAP: Readonly<Record<string, number>> = {
  abreutz: 1, "alemão": 2, dd: 3, gamer: 4, grito: 5, guiperino: 6, "le bubu": 7,
  henry: 8, pitoco: 9, john: 10, "veião": 11, max: 12, "gordão": 13, pin: 14,
};

/** Tamanho do corpo inteiro de cada arte (todas têm 440 px de altura). */
const CORPO_W: Readonly<Record<number, number>> = {
  1: 203, 2: 188, 3: 182, 4: 187, 5: 217, 6: 185, 7: 207,
  8: 197, 9: 186, 10: 192, 11: 206, 12: 207, 13: 185, 14: 210,
};

export type Arte = { face: string; full: string; w: number; h: number };

/** Arte do nanico: `face` (160×160, recorte do rosto) e `full` (corpo inteiro). */
export function artOf(f: Rosto | null | undefined): Arte | null {
  if (!f) return null;
  const n = NAN_MAP[norm(f.name)];
  if (!n) return null;
  return {
    face: `/arte/nanicos/${n}-rosto.webp`,
    full: `/arte/nanicos/${n}-corpo.webp`,
    w: CORPO_W[n],
    h: 440,
  };
}

/** Foto da turma (1100 px de largura, fundo transparente). */
export const CREW = "/arte/turma.webp";
/** Bola de bingo (ícone do site), usada no menu recolhido. */
export const MARCA = "/arte/marca.png";
