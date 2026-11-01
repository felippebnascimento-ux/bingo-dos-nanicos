import { create } from "zustand";
import type { Aba, Card, Friend, LineupSlot, Phrase, Presence, RailTab } from "./tipos";
import { LANES } from "./dados/campeoes";

/** Identifica esta aba do navegador na sala (muda a cada recarga). */
export const MY_KEY =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Math.random()).slice(2);

export type Fase = "carregando" | "login" | "semNanico" | "primeiraSenha" | "app";

export type AppState = {
  /* login */
  fase: Fase;
  loginMsg: string | null;
  primeiroUsuario: string;
  myUid: string | null;
  myFid: string | null;
  myName: string;
  /** texto do rodapé: "Conectando…", "Sincronizado"… */
  conn: string;
  /** já carregou os dados do banco */
  db: boolean;

  /* dados do banco */
  friends: Friend[];
  phrases: Phrase[];
  /** o SQL das nanicadas v2 já rodou (editar, remover, vários nanicos) */
  phrasesV2: boolean;
  /** o SQL do op.gg já rodou */
  opggOk: boolean;
  lineup: LineupSlot[];

  /* deste navegador */
  card: Card | null;
  online: Presence[];
  /** id da minha transmissão de tela (vai na presença) */
  myLiveSid: string | null;
  /** id da minha câmera (vai na presença) */
  myCamSid: string | null;

  /* tela */
  aba: Aba;
  sideMin: boolean;
  railTab: RailTab;
  chatUnread: number;
  /** mesas de truco esperando gente (contador no menu) */
  trucoAbertas: number;
  /** filtro da aba Nanicadas: null = todas, "gen" = genéricas, ou o id de um nanico */
  nanicadasFiltro: string | null;
  nanicadasBusca: string;
  pwAberto: boolean;
  logAberto: boolean;
};

export const lineupVazia = (): LineupSlot[] => LANES.map(() => ({ friendId: "", champion: "" }));

export const useApp = create<AppState>()(() => ({
  fase: "carregando",
  loginMsg: null,
  primeiroUsuario: "",
  myUid: null,
  myFid: null,
  myName: "",
  conn: "Conectando…",
  db: false,
  friends: [],
  phrases: [],
  phrasesV2: true,
  opggOk: true,
  lineup: lineupVazia(),
  card: null,
  online: [],
  myLiveSid: null,
  myCamSid: null,
  aba: "jogar",
  sideMin: false,
  railTab: "telas",
  chatUnread: 0,
  trucoAbertas: 0,
  nanicadasFiltro: null,
  nanicadasBusca: "",
  pwAberto: false,
  logAberto: false,
}));

/** Atalho para mudar o estado de fora do React (sala, WebRTC, truco…). */
export const setApp = (p: Partial<AppState>) => useApp.setState(p);
export const getApp = () => useApp.getState();

/** Nanico pelo id. Dentro de componente, passe a lista assinada (`useApp(s => s.friends)`). */
export const friendOf = (id: string | null | undefined, friends = getApp().friends) =>
  id ? friends.find((f) => f.id === id) : undefined;

export const friendName = (id: string | null | undefined, friends = getApp().friends) =>
  friendOf(id, friends)?.name || "";

/** Nanico de quem está na sala: pelo id e, se não achar, pelo nome. */
export const friendDaPresenca = (
  p: { fid: string | null; name: string },
  friends = getApp().friends,
) =>
  friendOf(p.fid, friends) ||
  friends.find((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase());

export const irPara = (aba: Aba) => setApp({ aba });
