/** Um dos 14 nanicos (tabela `friends`). */
export type Friend = {
  id: string;
  name: string;
  photo?: string | null;
  user_id?: string | null;
  created_at?: string;
  opgg?: string | null;
  steam?: string | null;
};

/** Algo que dá para desenhar como rosto: um nanico ou só um nome. */
export type Rosto = Pick<Friend, "name"> & Partial<Friend>;

export type Modo = "qualquer" | "todos";

/** Nanicada (tabela `phrases`, já normalizada). */
export type Phrase = {
  id: string;
  text: string;
  friendIds: string[];
  champions: string[];
  modo: Modo;
  createdAt: number;
};

/** Uma rota da escalação (tabela `game`, coluna `players`). */
export type LineupSlot = { friendId: string; champion: string };

/** Casa da cartela. Cartelas antigas guardavam `friendId`/`fname`; as novas, listas. */
export type Cell = {
  text: string;
  free?: boolean;
  friendIds?: string[];
  fnames?: string[];
  champs?: string;
  rot?: number;
  tag?: string;
  friendId?: string;
  fname?: string;
};

/** Cartela de cada pessoa (fica só no navegador, em `rift-card`). */
export type Card = { cells: Cell[]; marked: boolean[] };

/** Quem está na sala (presença do canal), já conferido por `cleanPresence`. */
export type Presence = {
  key: string;
  name: string;
  fid: string | null;
  lines: number;
  live: string | null;
  cam: string | null;
  /** onde o boneco está no hall (conferido por `posValida`) */
  pos: { i: number; j: number } | null;
  /** sala tipo lan house onde a pessoa está (null = no lobby) */
  sala: string | null;
  at: number;
};

/** Sala tipo lan house (tabela `salas`, criada só pelo admin). */
export type Sala = { id: string; nome: string; jogo: "lol" | "cs" | "outro"; discord: string | null; ordem: number };

export type Aba = "hall" | "jogar" | "frases" | "nanicos" | "live" | "truco" | "perfil";
export type RailTab = "telas" | "chat" | "cartela";
