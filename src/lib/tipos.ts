/** Um dos 14 nanicos (tabela `friends`). */
export type Friend = {
  id: string;
  name: string;
  photo?: string | null;
  user_id?: string | null;
  created_at?: string;
  opgg?: string | null;
  /** segunda conta do LoL (smurf) */
  opgg_smurf?: string | null;
  steam?: string | null;
  /** nanico (um dos 14), amigo dos nanicos ou inativo (amigo que saiu); seção 39 do SQL */
  tipo?: "nanico" | "amigo" | "inativo";
  /** quem convidou o amigo (friend id de um nanico) */
  convidado_por?: string | null;
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
  pos: { i: number; j: number; s?: string } | null;
  /** quarto próprio onde o boneco está (friend id do dono; null = no K-FOFO). O `pos` é o piso daquele quarto */
  quarto?: string | null;
  /** sala tipo lan house onde a pessoa está (null = no lobby) */
  sala: string | null;
  /** id da minha conexão de voz na sala (null = fora da voz) */
  voz?: string | null;
  /** microfone desligado / sem ouvir ninguém (só aparecem para quem está na voz) */
  mudo?: boolean;
  /** parado há um tempo (Ausente sozinho) e no modo invisível (aparece offline nas listas) */
  aus?: boolean;
  inv?: boolean;
  surdo?: boolean;
  /** canal de texto aberto agora ("geral" ou o id de uma sala; null = nenhum) */
  texto?: string | null;
  at: number;
};

/** Sala tipo lan house (tabela `salas`, criada só pelo admin). */
export type Sala = { id: string; nome: string; jogo: "lol" | "cs" | "outro"; discord: string | null; ordem: number };

export type Aba = "chat" | "trofeus" | "loja" | "midias" | "hall" | "cassino" | "jogar" | "frases" | "nanicos" | "amigos" | "live" | "truco" | "perfil";
export type RailTab = "chat" | "cartela";
