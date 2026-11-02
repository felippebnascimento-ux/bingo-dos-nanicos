import { create } from "zustand";
import type { Aba, Card, Friend, LineupSlot, Phrase, Presence, RailTab, Sala } from "./tipos";
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
  /** o SQL da ficha (coluna steam) já rodou */
  steamOk: boolean;
  /** o banco já tem a coluna do op.gg de smurf (seção 27 do seguranca.sql) */
  smurfOk: boolean;
  lineup: LineupSlot[];

  /* deste navegador */
  card: Card | null;
  /** todo mundo no site (presença do lobby, com a sala de cada um) */
  online: Presence[];
  /** salas tipo lan house (vazio se o SQL das salas ainda não rodou) */
  salas: Sala[];
  /** a minha sala (null = no lobby) */
  minhaSala: string | null;
  /** quem está na MINHA sala (a live, as câmeras e as reações usam esta lista) */
  onlineSala: Presence[];
  /** janela de escolher a sala aberta */
  salasAberto: boolean;
  /** janela de Configurações aberta */
  configAberto: boolean;
  /** id da minha transmissão de tela (vai na presença) */
  myLiveSid: string | null;
  /** id da minha câmera (vai na presença) */
  myCamSid: string | null;
  /** id da minha conexão de voz (vai na presença), microfone desligado e "surdo" */
  myVozSid: string | null;
  vozMudo: boolean;
  vozSurdo: boolean;
  /** canal de texto aberto na aba Chat ("geral" ou o id de uma sala) */
  canalTexto: string;
  /** meu piso no hall (vai na presença; só muda quando o boneco chega) */
  /** piso do meu boneco e, se estiver sentado, o assento (`s`) */
  hallPos: { i: number; j: number; s?: string } | null;

  /* tela */
  aba: Aba;
  sideMin: boolean;
  /** lista de membros (barra da direita) só com os rostos */
  membrosMin: boolean;
  railTab: RailTab;
  chatUnread: number;
  /** mesas de truco esperando gente (contador no menu) */
  trucoAbertas: number;
  /** filtro da aba Nanicadas: null = todas, "gen" = genéricas, ou o id de um nanico */
  nanicadasFiltro: string | null;
  nanicadasBusca: string;
  pwAberto: boolean;
  logAberto: boolean;
  /** id do nanico com a ficha aberta (aba Nanicos) */
  fichaAberta: string | null;
  /** "novidades" = abriu sozinho depois de uma atualização; "tudo" = botão Log do rodapé */
  logModo: "novidades" | "tudo";
  /** índice da última entrada do CHANGELOG que a pessoa viu (conta, com o navegador de reserva) */
  logVisto: number | null;
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
  steamOk: true,
  smurfOk: true,
  lineup: lineupVazia(),
  card: null,
  online: [],
  salas: [],
  minhaSala: null,
  onlineSala: [],
  salasAberto: false,
  configAberto: false,
  myLiveSid: null,
  myCamSid: null,
  myVozSid: null,
  vozMudo: false,
  vozSurdo: false,
  canalTexto: "geral",
  hallPos: null,
  aba: "hall",
  sideMin: false,
  membrosMin: false,
  railTab: "chat",
  chatUnread: 0,
  trucoAbertas: 0,
  nanicadasFiltro: null,
  nanicadasBusca: "",
  pwAberto: false,
  logAberto: false,
  fichaAberta: null,
  logModo: "tudo",
  logVisto: null,
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

/** A minha sala, se for uma sala de LoL (só elas têm escalação e bingo). */
export const salaLol = (s = getApp()) => s.salas.find((x) => x.id === s.minhaSala && x.jogo === "lol") ?? null;
