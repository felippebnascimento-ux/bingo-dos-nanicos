/* Dados do banco (nanicos, nanicadas, escalação) e o ciclo de login → sessão → sala. */
import type { Session, User } from "@supabase/supabase-js";
import { EMAIL_DOMAIN } from "./config";
import { errMsg, q, sb } from "./supabase";
import { getApp, lineupVazia, salaLol, setApp } from "./store";
import type { Card, Friend, LineupSlot, Modo, Phrase, Sala } from "./tipos";
import { byName, local, norm } from "./util";
import { toast } from "./toast";
import { joinRoom } from "./sala";
import { LANES } from "./dados/campeoes";
import { VERSION } from "./dados/changelog";
import { juntarVisto, lerVisto, temNovidade, ULTIMA } from "./dados/novidades";
import { carregarChat } from "@/features/chat/chat";
import { iniciarCarteira } from "./carteira";
import { iniciarHall } from "@/features/hall/bonecos";
import { iniciarTrofeus } from "@/features/trofeus/trofeusDados";
import { iniciarLoja } from "@/features/loja/lojaDados";
import { iniciarBingo } from "@/features/jogar/bingoSala";
import { iniciarMissoes } from "@/features/missoes/missoesDados";
import { iniciarMidias } from "@/features/midias/midiasDados";
import { iniciarApostas } from "@/features/jogar/apostasDados";
import { iniciarRespeitos } from "@/features/emblemas/emblemasDados";
import { iniciarRiot } from "@/features/jogar/riot";
import { pararTudoAoVivo } from "@/features/live/live";

/* ---------- escalação ---------- */
export function cleanLineup(pl: unknown): LineupSlot[] {
  return LANES.map((_, i) => {
    const x = Array.isArray(pl) && pl[i] && typeof pl[i] === "object" ? (pl[i] as Record<string, unknown>) : {};
    const fid = typeof x.friendId === "string" && x.friendId.length <= 64 ? x.friendId : "";
    return { friendId: fid, champion: fid && typeof x.champion === "string" ? x.champion.slice(0, 30) : "" };
  });
}

/** Lê do navegador o que é só conveniência desta pessoa (cartela, última escalação, menu recolhido). */
export function iniciarLocal() {
  const card = local.json<Card>("rift-card");
  setApp({
    lineup: cleanLineup(local.json("rift-lineup")),
    card: card && Array.isArray(card.cells) && Array.isArray(card.marked) ? card : null,
    sideMin: local.get("side-min") === "1",
    membrosMin: local.get("membros-min") === "1",
    logVisto: lerVisto(local.get("log-visto")),
  });
  const t = local.get("rail-tab");
  /* a aba "telas" saiu (as telas ficam na grade do canal): quem tinha ela salva volta para o chat */
  if (t === "chat" || t === "cartela") setApp({ railTab: t });
}

/* ---------- carregar do banco ---------- */
export async function loadFriends() {
  /* se o SQL do smurf, da ficha (Steam) ou do op.gg ainda não rodou, o site segue funcionando sem a coluna */
  const tentativas = [
    { cols: "opgg,steam,opgg_smurf", ok: { opggOk: true, steamOk: true, smurfOk: true }, aviso: "" },
    { cols: "opgg,steam", ok: { opggOk: true, steamOk: true, smurfOk: false }, aviso: "banco sem a coluna opgg_smurf: rode a seção 27 do seguranca.sql" },
    { cols: "opgg", ok: { opggOk: true, steamOk: false, smurfOk: false }, aviso: "banco sem a coluna steam: rode a seção 8 do seguranca.sql" },
  ];
  let rows: Friend[] | null = null;
  for (const t of tentativas) {
    try {
      rows = await q<Friend[]>(sb().from("friends").select("id,name,photo,user_id,created_at," + t.cols));
      if (t.aviso) console.warn(t.aviso);
      setApp(t.ok);
      break;
    } catch {
      /* tenta sem a coluna nova */
    }
  }
  if (!rows) {
    console.warn("banco sem op.gg");
    setApp({ opggOk: false, steamOk: false, smurfOk: false });
    rows = await q<Friend[]>(sb().from("friends").select("id,name,photo,user_id,created_at"));
  }
  const friends = (rows || []).sort(byName);
  const { myUid } = getApp();
  const mine = myUid ? friends.find((f) => f.user_id === myUid) : undefined;
  setApp(mine ? { friends, myFid: mine.id, myName: mine.name } : { friends });
}

type PhraseRow = {
  id: string | number;
  text?: string;
  friend_id?: string | null;
  friend_ids?: string[] | null;
  champions?: string[] | null;
  modo?: string | null;
  created_at?: string;
};

export async function loadPhrases() {
  let rows: PhraseRow[];
  try {
    rows = await q<PhraseRow[]>(sb().from("phrases").select("id,text,friend_id,friend_ids,champions,modo,created_at"));
    setApp({ phrasesV2: true });
  } catch (e) {
    /* se o SQL novo ainda não rodou, o site continua funcionando do jeito antigo (sem editar/remover) */
    console.warn("banco sem nanicadas v2", e);
    setApp({ phrasesV2: false });
    rows = await q<PhraseRow[]>(sb().from("phrases").select("id,text,friend_id,champions,created_at"));
  }
  const phrases: Phrase[] = (rows || []).map((r) => {
    const ids = Array.isArray(r.friend_ids) && r.friend_ids.length ? r.friend_ids : r.friend_id ? [r.friend_id] : [];
    return {
      id: String(r.id),
      text: String(r.text || ""),
      friendIds: [...new Set(ids.filter((x): x is string => typeof x === "string"))],
      champions: Array.isArray(r.champions) ? r.champions.filter((c): c is string => typeof c === "string") : [],
      modo: r.modo === "todos" ? "todos" : "qualquer",
      createdAt: Date.parse(r.created_at || "") || 0,
    };
  });
  setApp({ phrases });
}

/** Salas tipo lan house (se o SQL das salas ainda não rodou, fica sem salas e tudo continua como antes). */
export async function loadSalas() {
  try {
    const rows = await q<Sala[]>(sb().from("salas").select("id,nome,jogo,discord,ordem").order("ordem"));
    setApp({ salas: (rows || []).filter((r) => /^[a-z0-9-]{2,20}$/.test(r.id)).slice(0, 20) });
  } catch {
    console.warn("banco sem salas: rode a seção 10 do seguranca.sql");
    setApp({ salas: [] });
  }
}

/** Escalação da minha sala de LoL (sem salas no banco, a linha 1 de sempre). */
const filtroGame = (): { col: "sala" | "id"; val: string | number | null } => {
  const s = getApp();
  return s.salas.length ? { col: "sala", val: salaLol(s)?.id ?? null } : { col: "id", val: 1 };
};

export async function loadGame() {
  const f = filtroGame();
  if (f.val === null) return;
  const rows = await q<{ players: unknown }[]>(sb().from("game").select("players").eq(f.col, f.val));
  const pl = rows?.[0]?.players;
  if (!Array.isArray(pl)) return;
  const lineup = cleanLineup(pl);
  local.setJson("rift-lineup", lineup);
  setApp({ lineup });
}

/* ---------- gravar no banco ---------- */
export type NovaNanicada = { text: string; friendIds: string[]; champions: string[]; modo: Modo };

export const api = {
  addPhrase: (d: NovaNanicada) =>
    q(
      sb()
        .from("phrases")
        .insert(
          getApp().phrasesV2
            ? { text: d.text, friend_ids: d.friendIds, champions: d.champions, modo: d.modo }
            : { text: d.text, friend_id: d.friendIds[0] || null, champions: d.champions },
        ),
    ),
  updPhrase: (id: string, d: NovaNanicada) =>
    q<{ id: string }[]>(
      sb()
        .from("phrases")
        .update({ text: d.text, friend_ids: d.friendIds, champions: d.champions, modo: d.modo })
        .eq("id", id)
        .select("id"),
    ),
  delPhrase: (id: string) => q<{ id: string }[]>(sb().from("phrases").delete().eq("id", id).select("id")),
  saveGame: (players: LineupSlot[]) => {
    const f = filtroGame();
    if (f.val === null) return Promise.resolve(null);
    return q(sb().from("game").update({ players, updated_at: new Date().toISOString() }).eq(f.col, f.val));
  },
  saveOpgg: (fid: string, url: string | null, smurf = false) =>
    q<{ id: string }[]>(sb().from("friends").update(smurf ? { opgg_smurf: url } : { opgg: url }).eq("id", fid).select("id")),
  saveSteam: (fid: string, url: string | null) =>
    q<{ id: string; steam?: string | null }[]>(sb().from("friends").update({ steam: url }).eq("id", fid).select("id,steam")),
};

/** Salva a escalação para todo mundo (e no navegador, para abrir rápido da próxima vez). */
export async function salvarEscalacao(lineup: LineupSlot[]) {
  setApp({ lineup });
  local.setJson("rift-lineup", lineup);
  if (!getApp().db) return;
  try {
    await api.saveGame(lineup);
  } catch (e) {
    console.error(e);
    toast(errMsg(e, "Não deu para salvar a escalação. Confira a internet."));
  }
}

/* ---------- login → sessão → sala ---------- */
export const toEmail = (u: string) => {
  u = norm(u).replace(/\s+/g, "");
  return u.includes("@") ? u : u + "@" + EMAIL_DOMAIN;
};

const timers: Record<string, ReturnType<typeof setTimeout>> = {};
/** Junta várias mudanças seguidas numa recarga só (150 ms). */
export const later = (k: string, fn: () => Promise<unknown>) => {
  clearTimeout(timers[k]);
  timers[k] = setTimeout(() => fn().catch(console.error), 150);
};

const recarregar = (tabela: string) => {
  if (tabela === "friends") later("f", loadFriends);
  if (tabela === "phrases") later("p", loadPhrases);
  if (tabela === "game") later("g", loadGame);
};

let started = false;
/** o "já vi" do Log gravado na conta (pode estar atrás do navegador, se a gravação falhou) */
let contaVisto: number | null = null;

export async function startSession(session: Session | null) {
  if (started || !session) return;
  started = true;
  setApp({ myUid: session.user.id });
  try {
    sb().realtime.setAuth(session.access_token);
  } catch {
    /* sem tempo real: o resto funciona */
  }
  try {
    await Promise.all([loadFriends(), loadPhrases(), loadSalas()]);
    await loadGame();
    setApp({ db: true });
  } catch (e) {
    console.error(e);
    started = false;
    setApp({
      conn: "Sem conexão com o banco.",
      fase: "login",
      loginMsg: "Não deu para carregar o bingo. Confira a internet e tente de novo.",
    });
    return;
  }
  if (!getApp().myFid) {
    started = false;
    setApp({ fase: "semNanico" });
    return;
  }
  let u: User = session.user;
  try {
    const r = await sb().auth.getUser();
    if (r?.data?.user) u = r.data.user;
  } catch {
    /* usa o usuário da sessão */
  }
  /* "já vi" do Log: o da conta vale em todo aparelho; o do navegador fica de reserva */
  contaVisto = lerVisto(u?.user_metadata?.log_visto);
  setApp({ logVisto: juntarVisto(contaVisto, getApp().logVisto) });
  if (u?.user_metadata?.must_change) {
    setApp({ fase: "primeiraSenha", primeiroUsuario: String(u.email || "").split("@")[0] });
    return;
  }
  enterApp();
}

let entrou = false;
export function enterApp() {
  setApp({ fase: "app", conn: "Conectando…" });
  if (entrou) return;
  entrou = true;
  abrirNovidades();
  joinRoom(recarregar);
  carregarChat();
  iniciarCarteira();
  /* o boneco aparece no Sítio para todo mundo mesmo sem abrir a aba */
  iniciarHall();
  setTimeout(iniciarRiot, 1500);
  /* apostas da partida ao vivo: o bolo e as minhas apostas, pelo tempo real */
  iniciarApostas();
  /* respeitos: quantos cada um recebeu e o aviso no Sítio, pelo tempo real */
  iniciarRespeitos();
  /* troféus da semana: lê e, se a semana passada não estiver pronta, pede o cálculo */
  setTimeout(iniciarTrofeus, 3000);
  /* loja: vitrine, mochila e o que todo mundo equipou (quarto, título, moldura) */
  iniciarLoja();
  iniciarBingo();
  iniciarMissoes();
  iniciarMidias();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      later("f", loadFriends);
      later("p", loadPhrases);
      later("g", loadGame);
    }
  });
}

/* ---------- Log de novidades ---------- */
/** Saiu versão nova desde a última visita? Abre o Log só com o que mudou (uma vez por sessão do navegador). */
function abrirNovidades() {
  if (!temNovidade(getApp().logVisto)) return;
  try {
    if (sessionStorage.getItem("log-auto") === VERSION) return;
    sessionStorage.setItem("log-auto", VERSION);
  } catch {
    /* sem sessionStorage: abre do mesmo jeito */
  }
  setApp({ logAberto: true, logModo: "novidades" });
}

/** Marca a versão atual como vista: na conta (vale em todo aparelho) e no navegador (reserva). */
export function marcarLogVisto() {
  local.set("log-visto", VERSION);
  setApp({ logVisto: ULTIMA });
  if (contaVisto === ULTIMA || !getApp().myUid) return;
  contaVisto = ULTIMA;
  sb()
    .auth.updateUser({ data: { log_visto: ULTIMA } })
    .then(({ error }) => {
      if (error) contaVisto = null; /* tenta de novo da próxima vez; o navegador já guardou */
    })
    .catch(() => {
      contaVisto = null;
    });
}

export async function logout() {
  try {
    pararTudoAoVivo();
  } catch {
    /* segue saindo */
  }
  try {
    await sb().auth.signOut();
  } catch {
    /* segue saindo */
  }
  location.reload();
}

let iniciou = false;
/** Primeira coisa ao abrir o site: retoma a sessão salva ou mostra o login. */
export async function boot() {
  if (iniciou) return;
  iniciou = true;
  iniciarLocal();
  const cliente = sb();
  cliente.auth.onAuthStateChange((ev, session) => {
    if (ev === "TOKEN_REFRESHED" && session) {
      try {
        cliente.realtime.setAuth(session.access_token);
      } catch {
        /* sem tempo real */
      }
    }
    if (ev === "SIGNED_OUT" && started) location.reload();
  });
  const { data } = await cliente.auth.getSession();
  if (data?.session) await startSession(data.session);
  else setApp({ fase: "login" });
}

export { lineupVazia };
