/*
 * Truco: mesa online.
 * Quem abre a mesa é o anfitrião: o navegador dele embaralha, guarda as cartas e confere cada jogada.
 * Os outros mandam as jogadas para ele pela sala; ele devolve a mesa (sem as cartas de ninguém)
 * e manda a mão de cada um só para o dono. Se o anfitrião recarregar, a mesa volta do ponto onde parou.
 *
 * O estado fica aqui (TRU, como no site antigo). A tela lê a store `useTruco`, que este módulo
 * atualiza em `avisa()`; o contador do menu é `trucoAbertas` no `useApp`.
 */
import { create } from "zustand";
import { aoConectar, aoReceber, enviar, estaNaSala, limitePorPessoa, salaConectada } from "@/lib/sala";
import { friendOf, getApp, MY_KEY, setApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local, newId } from "@/lib/util";
import {
  TR_APOSTAS, trAcao, trLog, trNovaMao, trNovaMesa, trPublica, trValido,
  type Aposta, type Carta, type MaoBase, type Mesa, type MesaPub, type Vaza,
} from "./engine";
import { TR_ID, TR_MAX_JSON, trLimpaPub } from "./valida";

/** Minhas cartas, como chegaram do anfitrião (`n` = número da mão). */
export type MinhaMao = { id: string; n: number; cartas: Carta[] };

/** O que a tela precisa (só cópias: nada aqui é mexido depois). */
export type TrucoUI = {
  mesas: MesaPub[];
  /** mesa aberta na tela (null = lobby) */
  ver: string | null;
  mao: MinhaMao | null;
  /** id da mesa que eu abri (sou o anfitrião) */
  minhaId: string | null;
  /** falas vivas (3,5 s) da mesa aberta, por lugar */
  falas: Record<number, string>;
  /** cartas que acabaram de cair na mesa aberta (animação) */
  novas: string[];
};

export const useTruco = create<TrucoUI>()(() => ({ mesas: [], ver: null, mao: null, minhaId: null, falas: {}, novas: [] }));

type Entrada = { pub: MesaPub; at: number; js: string };
const TRU = {
  mesas: new Map<string, Entrada>(),
  minha: null as Mesa | null,
  ver: null as string | null,
  mao: null as MinhaMao | null,
  prox: undefined as ReturnType<typeof setTimeout> | undefined,
  hb: undefined as ReturnType<typeof setInterval> | undefined,
  tFala: undefined as ReturnType<typeof setTimeout> | undefined,
  ultPub: "",
  /** quando vi cada fala pela primeira vez (o balão dura 3,5 s a partir daí) */
  falas: new Map<string, number>(),
  /** cartas que já apareceram na mesa (só as novas animam) */
  vistas: new Set<string>(),
};

const ACOES = ["sentar", "levantar", "jogar", "truco", "envido", "quero", "naoquero", "mazo"] as const;
const FALA_MS = 3500;

/** A vaza que aparece no meio da mesa: a atual ou, se ainda está vazia, a última que fechou. */
export function trNaMesa(h: MaoBase): Vaza {
  const v = h.vazas[h.vazas.length - 1];
  return v.cartas.length || h.vazas.length < 2 ? v : h.vazas[h.vazas.length - 2];
}

/* ---------- avisar a tela ---------- */
function falasVivas(pub: MesaPub): Record<number, string> {
  const agora = Date.now(), out: Record<number, string> = {};
  let prox = Infinity;
  for (const [s, f] of Object.entries(pub.falas || {})) {
    const k = `${pub.id}:${s}:${f.at}:${f.txt}`;
    if (!TRU.falas.has(k)) TRU.falas.set(k, agora);
    const resta = FALA_MS - (agora - TRU.falas.get(k)!);
    if (resta > 0) {
      out[Number(s)] = f.txt.slice(0, 40);
      prox = Math.min(prox, resta);
    }
  }
  if (TRU.falas.size > 200) TRU.falas.clear();
  clearTimeout(TRU.tFala);
  if (prox < Infinity) TRU.tFala = setTimeout(avisa, prox + 100);
  return out;
}

function novasNaMesa(pub: MesaPub): string[] {
  if (!pub.h) return [];
  const out: string[] = [];
  for (const x of trNaMesa(pub.h).cartas) {
    const k = `${pub.id}:${pub.h.n}:${x.c}`;
    if (!TRU.vistas.has(k)) out.push(x.c);
    TRU.vistas.add(k);
  }
  if (TRU.vistas.size > 400) TRU.vistas.clear();
  return out;
}

function avisa() {
  const lista = [...TRU.mesas.values()].map((x) => x.pub);
  const nEsp = lista.filter((m) => m.fase === "espera" && m.lugares.some((l) => !l)).length;
  if (getApp().trucoAbertas !== nEsp) setApp({ trucoAbertas: nEsp });
  if (TRU.ver && !TRU.mesas.has(TRU.ver)) {
    TRU.ver = null;
    TRU.mao = null;
  }
  const pub = TRU.ver ? TRU.mesas.get(TRU.ver)!.pub : null;
  useTruco.setState({
    mesas: lista,
    ver: TRU.ver,
    mao: TRU.mao,
    minhaId: TRU.minha?.id ?? null,
    falas: pub ? falasVivas(pub) : {},
    novas: pub ? novasNaMesa(pub) : [],
  });
}

/* ---------- anfitrião ---------- */
function trSalva() {
  if (TRU.minha) local.setJson("truco-mesa", { M: TRU.minha, at: Date.now() });
  else local.set("truco-mesa", null);
}

function trPublicar() {
  const M = TRU.minha;
  if (!M) return;
  const pub = trPublica(M), js = JSON.stringify(pub);
  TRU.mesas.set(M.id, { pub, at: Date.now(), js });
  enviar("truco", { t: "mesa", m: pub });
  if (M.h) {
    const h = M.h;
    M.lugares.forEach((l, i) => {
      if (!l) return;
      if (l.key === MY_KEY) TRU.mao = { id: M.id, n: h.n, cartas: h.maos[i].slice() };
      else enviar("truco", { t: "mao", to: l.key, id: M.id, n: h.n, cartas: h.maos[i] });
    });
  }
  trSalva();
  if (js !== TRU.ultPub) {
    TRU.ultPub = js;
    avisa();
  }
}

/* a mesa é republicada a cada 4 s: quem chega vê, e quem não vê mais some da lista dos outros */
function trHeartbeat() {
  clearInterval(TRU.hb);
  TRU.hb = setInterval(() => {
    if (TRU.minha) trPublicar();
    else clearInterval(TRU.hb);
  }, 4000);
}

function proximaMao(M: Mesa, ms: number) {
  const n = M.h?.n;
  clearTimeout(TRU.prox);
  TRU.prox = setTimeout(() => {
    if (TRU.minha === M && M.fase === "jogo" && M.h && M.h.n === n && M.h.fim) {
      trNovaMao(M);
      trPublicar();
    }
  }, ms);
}

/** O anfitrião recebe e confere tudo que os jogadores pedem. */
function trHost(fromKey: string, a: string, arg?: unknown) {
  const M = TRU.minha;
  if (!M) return;
  const s = getApp();
  const p = fromKey === MY_KEY ? { fid: s.myFid, name: s.myName } : s.online.find((x) => x.key === fromKey);
  if (!p) return;
  const nome = friendOf(p.fid)?.name || String(p.name || "").slice(0, 30);
  let seat = M.lugares.findIndex((l) => l && l.key === fromKey);
  if (seat < 0 && p.fid) {
    /* voltou depois de recarregar: o lugar é dele pelo nanico */
    const r = M.lugares.findIndex((l) => l && l.fid === p.fid);
    if (r >= 0) {
      M.lugares[r]!.key = fromKey;
      seat = r;
    }
  }
  if (a === "sentar") {
    const i = Number(arg);
    if (seat >= 0) return trPublicar();
    if (M.fase !== "espera" || !Number.isInteger(i) || i < 0 || i >= M.modo || M.lugares[i]) return;
    M.lugares[i] = { fid: p.fid || null, key: fromKey, nome };
    trLog(M, `${nome} sentou`);
    return trPublicar();
  }
  if (a === "levantar") {
    if (seat < 0 || M.fase !== "espera" || fromKey === M.host) return;
    M.lugares[seat] = null;
    trLog(M, `${nome} levantou`);
    return trPublicar();
  }
  if (a === "comecar" || a === "revanche") {
    if (fromKey !== M.host || M.lugares.some((l) => !l)) return;
    if (a === "comecar" && M.fase !== "espera") return;
    if (a === "revanche" && M.fase !== "fim") return;
    M.fase = "jogo";
    M.placar = [0, 0];
    M.vencedor = null;
    M.h = null;
    M.maoN = 0;
    M.log = [];
    trNovaMao(M);
    return trPublicar();
  }
  if (seat < 0) return;
  if (trAcao(M, seat, a, arg)) return;
  if (M.h && M.h.fim && M.fase === "jogo") proximaMao(M, 3800);
  trPublicar();
}

/* o anfitrião recarregou: a mesa volta (até 20 min depois) */
let restaurou = false;
function trRestaura() {
  try {
    const d = local.json<{ M: Mesa; at: number }>("truco-mesa");
    if (!d || !d.M || typeof d.at !== "number" || Date.now() - d.at > 20 * 60000) return;
    const M = d.M, { myFid } = getApp();
    if (!TR_ID.test(String(M.id)) || !Array.isArray(M.lugares)) return;
    M.host = MY_KEY;
    M.lugares.forEach((l) => {
      if (l && l.fid === myFid) l.key = MY_KEY;
    });
    /* confere como se tivesse vindo da sala: armazenamento estragado não derruba a tela */
    if (!trLimpaPub(trPublica(M), MY_KEY)) return;
    if (M.h && (!M.h.maos || !M.h.orig)) return;
    TRU.minha = M;
    TRU.ver = M.id;
    trPublicar();
    trHeartbeat();
    if (M.h && M.h.fim && M.fase === "jogo") proximaMao(M, 2500);
  } catch {
    /* mesa salva ilegível: ignora */
  }
}

/* ---------- mensagens da sala ---------- */
const limite = limitePorPessoa(40, 2000);

function onTruco(m: Record<string, unknown>) {
  const from = m.from;
  if (typeof from !== "string" || from === MY_KEY || !estaNaSala(from) || !limite(from)) return;
  const agora = Date.now();

  if (m.t === "mesa") {
    let js: string;
    try {
      js = JSON.stringify(m.m);
    } catch {
      return;
    }
    if (!js || js.length > TR_MAX_JSON) return;
    const M = trLimpaPub(m.m, from);
    if (!M || (TRU.minha && M.id === TRU.minha.id)) return;
    const antes = TRU.mesas.get(M.id), igual = !!antes && antes.js === js;
    TRU.mesas.set(M.id, { pub: M, at: agora, js });
    if (antes?.pub.h && M.h && antes.pub.h.n !== M.h.n && TRU.mao?.id === M.id && TRU.mao.n !== M.h.n) TRU.mao = null;
    /* recarreguei a página no meio do jogo: pega o meu lugar de volta */
    const { myFid } = getApp();
    if (myFid && M.lugares.some((l) => l && l.fid === myFid && l.key !== MY_KEY)) {
      TRU.ver = TRU.ver || M.id;
      enviar("truco", { t: "acao", to: M.host, id: M.id, a: "sentar", arg: 0 });
    }
    if (!igual) avisa();
    return;
  }

  if (m.t === "fechar") {
    if (typeof m.id !== "string" || TRU.mesas.get(m.id)?.pub.host !== from) return;
    TRU.mesas.delete(m.id);
    if (TRU.ver === m.id) {
      TRU.ver = null;
      TRU.mao = null;
      toast("A mesa de truco foi fechada.");
    }
    avisa();
    return;
  }

  if (m.t === "mao") {
    if (m.to !== MY_KEY || typeof m.id !== "string") return;
    if (!Array.isArray(m.cartas) || m.cartas.length > 3 || !m.cartas.every(trValido)) return;
    if (TRU.mesas.get(m.id)?.pub.host !== from) return;
    const n = typeof m.n === "number" && Number.isInteger(m.n) ? m.n : 0;
    const igual = TRU.mao?.id === m.id && TRU.mao.n === n && TRU.mao.cartas.join() === m.cartas.join();
    TRU.mao = { id: m.id, n, cartas: m.cartas.slice() };
    if (!igual) avisa();
    return;
  }

  if (m.t === "acao") {
    if (m.to !== MY_KEY || !TRU.minha || m.id !== TRU.minha.id) return;
    const a = m.a as (typeof ACOES)[number];
    if (!ACOES.includes(a)) return;
    if (a === "jogar" && !trValido(m.arg)) return;
    if (a === "envido" && !TR_APOSTAS.includes(m.arg as Aposta)) return;
    if (a === "sentar" && !(typeof m.arg === "number" && Number.isInteger(m.arg))) return;
    trHost(from, a, m.arg);
  }
}

/* mesas cujo anfitrião sumiu saem da lista */
function limpaVelhas() {
  const agora = Date.now(), { online } = getApp();
  let mudou = false;
  for (const [id, x] of TRU.mesas) {
    if (TRU.minha && id === TRU.minha.id) continue;
    if (agora - x.at > 13000 || !online.some((p) => p.key === x.pub.host)) {
      TRU.mesas.delete(id);
      mudou = true;
    }
  }
  if (mudou) avisa();
}

/**
 * Liga o truco na sala (a aba chama uma vez ao montar). Devolve a função que desliga.
 * A mesa do anfitrião sobrevive a desligar e ligar de novo (só o relógio para).
 */
export function ligarTruco() {
  const off = [
    aoReceber("truco", onTruco),
    aoConectar(() => {
      if (restaurou) return;
      restaurou = true;
      trRestaura();
    }),
  ];
  if (!restaurou && salaConectada()) {
    restaurou = true;
    trRestaura();
  }
  const limpa = setInterval(limpaVelhas, 3000);
  if (TRU.minha) trHeartbeat();
  avisa();
  return () => {
    off.forEach((f) => f());
    clearInterval(limpa);
    clearInterval(TRU.hb);
    clearTimeout(TRU.tFala);
  };
}

/* ---------- o que a tela chama ---------- */

/** Manda uma ação para o anfitrião (ou aplica direto, se a mesa é minha). */
export function trEnviar(a: string, arg?: unknown) {
  const pub = TRU.ver ? TRU.mesas.get(TRU.ver)?.pub : null;
  if (!pub) return;
  if (TRU.minha && pub.id === TRU.minha.id) return trHost(MY_KEY, a, arg);
  enviar("truco", { t: "acao", to: pub.host, id: pub.id, a, arg: arg ?? null });
}

export function abrirMesa(modo: 2 | 4, alvo: number, comFlor: boolean) {
  const { myName, myFid } = getApp();
  if (!myName) return;
  if (TRU.minha) return toast("Você já tem uma mesa aberta.");
  const id = newId().replace(/-/g, "").slice(0, 12);
  TRU.minha = trNovaMesa(id, { fid: myFid, key: MY_KEY, nome: myName }, modo, alvo, comFlor);
  TRU.ver = id;
  trPublicar();
  trHeartbeat();
}

export function fecharMesa() {
  const M = TRU.minha;
  if (!M) return;
  enviar("truco", { t: "fechar", id: M.id });
  clearInterval(TRU.hb);
  clearTimeout(TRU.prox);
  TRU.mesas.delete(M.id);
  TRU.minha = null;
  TRU.ver = null;
  TRU.mao = null;
  TRU.ultPub = "";
  trSalva();
  avisa();
}

/** Abre a mesa na tela; se está esperando gente e eu não sentei, já senta no primeiro lugar livre. */
export function verMesa(id: string) {
  const m = TRU.mesas.get(id)?.pub;
  if (!m) return;
  TRU.ver = m.id;
  if (m.fase === "espera" && !m.lugares.some((l) => l && l.key === MY_KEY)) {
    const i = m.lugares.findIndex((l) => !l);
    if (i >= 0) trEnviar("sentar", i);
  }
  avisa();
}

export function voltarAoLobby() {
  TRU.ver = null;
  avisa();
}

export function levantar() {
  trEnviar("levantar");
  voltarAoLobby();
}

/** Só o anfitrião: começa outra partida depois do fim. */
export const revanche = () => trHost(MY_KEY, "revanche");
