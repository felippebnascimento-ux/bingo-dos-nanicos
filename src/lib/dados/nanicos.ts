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

/** Amigos dos nanicos (não são um dos 14): nome → arte em `public/arte/amigos/` e boneco em `public/arte/bonecos/`.
 *  Quem é amigo de verdade diz o `friends.tipo` (seção 39); o nome só vale enquanto o SQL não rodou. */
export const AMIGOS: Readonly<Record<string, { nome: string; arte: string; w: number; boneco: string }>> = {
  lightzin: { nome: "Lightzin", arte: "lightzin", w: 159, boneco: "lightzin.webp" },
};

/** É um amigo dos nanicos (e não um dos 14)? */
export const ehAmigo = (f: Rosto | null | undefined) => !!f && (f.tipo ? f.tipo === "amigo" : !!AMIGOS[norm(f.name)]);
/** Um dos 14 (nem amigo, nem inativo). */
export const ehNanico = (f: Rosto | null | undefined) => !!f && f.tipo !== "inativo" && !ehAmigo(f);
/** Só os 14, para tudo que é deles: nanicadas, escalação, rodízio, atributos, troféus. */
export const soNanicos = <T extends Rosto>(l: readonly T[]) => l.filter(ehNanico);
/** Os amigos dos nanicos que estão valendo (sem os inativos). */
export const soAmigos = <T extends Rosto>(l: readonly T[]) => l.filter(ehAmigo);

export type Arte = { face: string; full: string; w: number; h: number };

/** Arte do nanico: `face` (160×160, recorte do rosto) e `full` (corpo inteiro). */
export function artOf(f: Rosto | null | undefined): Arte | null {
  if (!f) return null;
  const amigo = AMIGOS[norm(f.name)];
  if (amigo) return { face: `/arte/amigos/${amigo.arte}-rosto.webp`, full: `/arte/amigos/${amigo.arte}-corpo.webp`, w: amigo.w, h: 440 };
  const n = NAN_MAP[norm(f.name)];
  if (!n) return null;
  return {
    face: `/arte/nanicos/${n}-rosto.webp`,
    full: `/arte/nanicos/${n}-corpo.webp`,
    w: CORPO_W[n],
    h: 440,
  };
}

/** Spritesheet do boneco de cada nanico em `public/arte/bonecos/` (igual ao `bonecos.json`). */
export const BONECO_ARQ: Readonly<Record<number, string>> = {
  1: "abreutz.webp", 2: "alemao.webp", 3: "dd.webp", 4: "gamer.webp", 5: "grito.webp", 6: "guiperino.webp",
  7: "le-bubu.webp", 8: "henry.webp", 9: "pitoco.webp", 10: "john.webp", 11: "veiao.webp", 12: "max.webp",
  13: "gordao.webp", 14: "pin.webp",
};

/** Boneco do hall (folha 84×134 por quadro, veja `features/hall/hall.ts`), ou null para quem não tem. */
export function bonecoOf(f: Rosto | null | undefined): string | null {
  const amigo = f ? AMIGOS[norm(f.name)] : undefined;
  if (amigo) return `/arte/bonecos/${amigo.boneco}`;
  const n = f ? NAN_MAP[norm(f.name)] : 0;
  return n && BONECO_ARQ[n] ? `/arte/bonecos/${BONECO_ARQ[n]}` : null;
}

/** Foto da turma (1100 px de largura, fundo transparente). */
export const CREW = "/arte/turma.webp";
/** Bola de bingo (ícone do site), usada no menu recolhido. */
export const MARCA = "/arte/marca.png";
