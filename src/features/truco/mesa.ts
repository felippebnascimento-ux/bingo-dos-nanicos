/*
 * Truco: mesa online, com o servidor de juiz.
 * Quem embaralha, guarda as cartas e confere cada jogada é a função truco-mesa (Supabase). O site só pede
 * ("jogar 7e", "sentar no lugar 1") e recebe pelo tempo real do banco a mesa pública (truco_mesas) e a
 * minha mão (truco_maos, que o RLS só entrega ao dono). Ninguém mais tem a mão dos outros no navegador.
 *
 * O estado fica aqui (TRU, como no site antigo). A tela lê a store `useTruco`, que este módulo
 * atualiza em `avisa()`; o contador do menu é `trucoAbertas` no `useApp`.
 */
import { create } from "zustand";
import { aoConectar, aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { getApp, setApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { TR_TEMPO_MS, trValido, type Carta, type MaoBase, type MesaPub, type Vaza } from "./engine";
import { TR_ID, TR_MAX_JSON, trLimpaPub } from "./valida";

/** Minhas cartas, como chegaram do banco (`n` = número da mão, `lugar` = onde estou sentado). */
export type MinhaMao = { id: string; n: number; lugar: number; cartas: Carta[] };

/** O que a tela precisa (só cópias: nada aqui é mexido depois). */
export type TrucoUI = {
  mesas: MesaPub[];
  /** mesa aberta na tela (null = lobby) */
  ver: string | null;
  mao: MinhaMao | null;
  /** id da mesa que eu abri */
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
  ver: null as string | null,
  /** minhas mãos por mesa (posso estar sentado em mais de uma) */
  maos: new Map<string, MinhaMao>(),
  tFala: undefined as ReturnType<typeof setTimeout> | undefined,
  /** pedido de mão nova já agendado (mesa:n) */
  prox: new Map<string, ReturnType<typeof setTimeout>>(),
  /** quando vi cada fala pela primeira vez (o balão dura 3,5 s a partir daí) */
  falas: new Map<string, number>(),
  /** cartas que já apareceram na mesa (só as novas animam) */
  vistas: new Set<string>(),
  /** relógio da jogada: quando vi cada `desde` (mesa:n:desde → hora local) e o aviso de "tempo" agendado */
  relogio: new Map<string, number>(),
  tempo: new Map<string, ReturnType<typeof setTimeout>>(),
};

const FALA_MS = 3500;
/** depois do fim da mão, cada um pede a próxima (a função espera 3 s e vale só o primeiro pedido) */
const PROX_MAO_MS = 3800;
/** mesa parada há mais que isso some da lista (a função apaga as de 3 h) */
const VELHA_MS = 3 * 3600_000;
const PARADA_MS = 30 * 60_000;

/** A vaza que aparece no meio da mesa: a atual ou, se ainda está vazia, a última que fechou. */
export function trNaMesa(h: MaoBase): Vaza {
  const v = h.vazas[h.vazas.length - 1];
  return v.cartas.length || h.vazas.length < 2 ? v : h.vazas[h.vazas.length - 2];
}

/** Meu lugar na mesa (pela conta), ou -1. */
export const meuLugar = (m: { lugares: MesaPub["lugares"] }, uid: string | null) =>
  uid ? m.lugares.findIndex((l) => !!l && l.key === uid) : -1;

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
  /* mesa esperando gente ou já encerrada some da lista depois de 30 min parada */
  const agora = Date.now();
  const lista = [...TRU.mesas.values()].filter((x) => x.pub.fase === "jogo" || agora - x.at < PARADA_MS).map((x) => x.pub);
  const nEsp = lista.filter((m) => m.fase === "espera" && m.lugares.some((l) => !l)).length;
  if (getApp().trucoAbertas !== nEsp) setApp({ trucoAbertas: nEsp });
  if (TRU.ver && !lista.some((m) => m.id === TRU.ver)) TRU.ver = null;
  const pub = TRU.ver ? TRU.mesas.get(TRU.ver)!.pub : null;
  const uid = getApp().myUid;
  useTruco.setState({
    mesas: lista,
    ver: TRU.ver,
    mao: TRU.ver ? (TRU.maos.get(TRU.ver) ?? null) : null,
    minhaId: lista.find((m) => !!uid && m.host === uid)?.id ?? null,
    falas: pub ? falasVivas(pub) : {},
    novas: pub ? novasNaMesa(pub) : [],
  });
}

/* ---------- a próxima mão ---------- */
/* a mão acabou e eu estou sentado: peço a próxima depois da pausa (todos pedem; o servidor ignora os repetidos) */
function agendarProxima(pub: MesaPub) {
  const h = pub.h, eu = meuLugar(pub, getApp().myUid);
  if (!h || !h.fim || pub.fase !== "jogo" || eu < 0) return;
  const k = `${pub.id}:${h.n}`;
  if (TRU.prox.has(k)) return;
  if (TRU.prox.size > 20) TRU.prox.clear();
  TRU.prox.set(
    k,
    setTimeout(() => {
      const atual = TRU.mesas.get(pub.id)?.pub;
      if (atual?.h && atual.h.n === h.n && atual.h.fim && atual.fase === "jogo")
        void chamar({ acao: "nova_mao", mesa: pub.id, n: h.n }, true);
    }, PROX_MAO_MS + eu * 300),
  );
}

/* ---------- o tempo de cada jogada (20 s) ---------- */
const chaveRelogio = (pub: MesaPub) => (pub.h && typeof pub.h.desde === "number" ? `${pub.id}:${pub.h.n}:${pub.h.desde}` : "");

/**
 * Até quando (hora deste aparelho) vai a jogada de agora; null = sem relógio. Conta a partir de quando a mesa
 * chegou aqui (o relógio do servidor pode estar adiantado ou atrasado em relação ao do aparelho).
 */
export function fimDaJogada(pub: MesaPub): number | null {
  const k = chaveRelogio(pub);
  if (!k || pub.fase !== "jogo" || !pub.h || pub.h.fim) return null;
  if (!TRU.relogio.has(k)) {
    if (TRU.relogio.size > 100) TRU.relogio.clear();
    TRU.relogio.set(k, Date.now());
  }
  return TRU.relogio.get(k)! + TR_TEMPO_MS;
}

/* acabou o tempo e eu estou sentado: aviso o juiz (todos avisam; ele confere no relógio dele e vale o primeiro) */
function agendarTempo(pub: MesaPub) {
  const fim = fimDaJogada(pub), eu = meuLugar(pub, getApp().myUid), k = chaveRelogio(pub);
  if (fim === null || eu < 0 || TRU.tempo.has(k)) return;
  if (TRU.tempo.size > 20) {
    TRU.tempo.forEach((t) => clearTimeout(t));
    TRU.tempo.clear();
  }
  const avisar = (tentativa: number) => {
    const atual = TRU.mesas.get(pub.id)?.pub;
    if (!atual || chaveRelogio(atual) !== k || atual.h?.fim || atual.fase !== "jogo") return;
    void chamar({ acao: "tempo", mesa: pub.id, n: atual.h!.n }, true);
    /* o relógio do servidor pode estar um pouco atrás: tenta de novo enquanto nada mudou */
    if (tentativa < 5) TRU.tempo.set(k, setTimeout(() => avisar(tentativa + 1), 2000));
  };
  TRU.tempo.set(k, setTimeout(() => avisar(0), Math.max(0, fim - Date.now()) + 500 + eu * 250));
}

/** A tela garante o aviso de "tempo" da mesa aberta (a mesa pode ter chegado antes de eu saber quem sou). */
export function garantirTempo(id: string) {
  const pub = TRU.mesas.get(id)?.pub;
  if (pub) agendarTempo(pub);
}

/* ---------- o que vem do banco ---------- */
function onMesa(row: Record<string, unknown> | null, ev: string) {
  const id = typeof row?.id === "string" ? row.id : "";
  if (!TR_ID.test(id)) return;
  if (ev === "DELETE") {
    if (!TRU.mesas.delete(id)) return;
    TRU.maos.delete(id);
    if (TRU.ver === id) {
      TRU.ver = null;
      toast("A mesa de truco foi fechada.");
    }
    avisa();
    return;
  }
  guardarMesa(row?.publico, Date.parse(String(row?.atualizada_em ?? "")) || Date.now());
  avisa();
}

function guardarMesa(raw: unknown, at: number) {
  let js: string;
  try {
    js = JSON.stringify(raw);
  } catch {
    return;
  }
  if (!js || js.length > TR_MAX_JSON || !raw || typeof raw !== "object") return;
  /* veio do banco (só a função grava), mas confere o formato mesmo assim: a tela nunca quebra */
  const M = trLimpaPub(raw, String((raw as { host?: unknown }).host ?? ""));
  if (!M) return;
  const antes = TRU.mesas.get(M.id);
  if (antes && antes.at > at) return; /* chegou fora de ordem */
  TRU.mesas.set(M.id, { pub: M, at, js });
  agendarProxima(M);
  agendarTempo(M);
}

function onMao(row: Record<string, unknown> | null, ev: string) {
  const id = typeof row?.mesa_id === "string" ? row.mesa_id : "";
  if (!TR_ID.test(id)) return;
  if (ev === "DELETE") {
    /* o DELETE chega para todos (só com a chave): só apaga se era o meu lugar */
    if (TRU.maos.get(id)?.lugar === row?.lugar) {
      TRU.maos.delete(id);
      avisa();
    }
    return;
  }
  if (guardarMao(row)) avisa();
}

function guardarMao(row: Record<string, unknown> | null): boolean {
  const id = String(row?.mesa_id ?? ""), uid = getApp().myUid;
  if (!row || !uid || row.user_id !== uid) return false;
  const c = row.cartas, n = row.mao_n, lugar = row.lugar;
  if (!Array.isArray(c) || c.length > 3 || !c.every(trValido)) return false;
  if (typeof n !== "number" || !Number.isInteger(n) || typeof lugar !== "number" || !Number.isInteger(lugar)) return false;
  TRU.maos.set(id, { id, n, lugar, cartas: c.slice() });
  return true;
}

/** Lê tudo de novo (ao entrar e quando a sala reconecta, para não perder nada que mudou no meio). */
async function carregar() {
  const desde = new Date(Date.now() - VELHA_MS).toISOString();
  const [m, h] = await Promise.all([
    sb().from("truco_mesas").select("id,publico,atualizada_em").gt("atualizada_em", desde).limit(30),
    sb().from("truco_maos").select("mesa_id,lugar,user_id,cartas,mao_n"),
  ]);
  if (m.error || h.error) {
    /* SQL do truco ainda não rodou: fica sem mesas */
    console.warn("truco indisponível", errMsg(m.error || h.error, "sem resposta"));
    return;
  }
  TRU.mesas.clear();
  for (const r of m.data ?? []) guardarMesa(r.publico, Date.parse(r.atualizada_em) || Date.now());
  TRU.maos.clear();
  for (const r of h.data ?? []) guardarMao(r as Record<string, unknown>);
  avisa();
}

/* ---------- chamar a função ---------- */
let ocupado = false;
/** id da mesa que a função acabou de abrir para mim */
let novaId: string | null = null;
/** Manda um pedido ao juiz. Devolve true se ele aceitou; se recusar, mostra o motivo. */
async function chamar(body: Record<string, unknown>, quieto = false): Promise<boolean> {
  try {
    const { data, error } = await sb().functions.invoke("truco-mesa", { body });
    if (error) throw error;
    if (typeof data?.erro === "string") {
      if (!quieto) toast(data.erro.slice(0, 120));
      return false;
    }
    if (typeof data?.id === "string" && TR_ID.test(data.id)) novaId = data.id;
    return true;
  } catch (e) {
    console.warn("truco", e);
    if (!quieto) toast("Não deu para falar com a mesa. Tente de novo.");
    return false;
  }
}

/**
 * Liga o truco (a aba chama uma vez ao montar). Devolve a função que desliga.
 */
export function ligarTruco() {
  const off = [aoMudarTabela("truco_mesas", onMesa), aoMudarTabela("truco_maos", onMao), aoConectar(() => void carregar())];
  void carregar();
  return () => {
    off.forEach((f) => f());
    clearTimeout(TRU.tFala);
  };
}

/* ---------- o que a tela chama ---------- */

/** Pede uma ação na mesa aberta (jogar, truco, envido, quero, não quero, mazo, sentar, começar). */
export function trEnviar(a: string, arg?: unknown): Promise<boolean> {
  const id = TRU.ver;
  if (!id) return Promise.resolve(false);
  if (a === "sentar") return chamar({ acao: "sentar", mesa: id, lugar: arg });
  if (a === "comecar") return chamar({ acao: "comecar", mesa: id });
  return chamar({ acao: a, mesa: id, arg: arg ?? null });
}

export async function abrirMesa(modo: 2 | 4, alvo: number, comFlor: boolean) {
  if (ocupado) return;
  ocupado = true;
  novaId = null;
  if ((await chamar({ acao: "abrir", modo, alvo, flor: comFlor })) && novaId) {
    /* não espera o tempo real: lê a mesa nova e já abre na tela */
    const { data } = await sb().from("truco_mesas").select("publico,atualizada_em").eq("id", novaId).maybeSingle();
    if (data) guardarMesa(data.publico, Date.parse(data.atualizada_em) || Date.now());
    if (TRU.mesas.has(novaId)) TRU.ver = novaId;
    avisa();
  }
  ocupado = false;
}

export function fecharMesa() {
  const id = useTruco.getState().minhaId;
  if (id) void chamar({ acao: "fechar", mesa: id });
}

/** Abre a mesa na tela; se está esperando gente e eu não sentei, já senta no primeiro lugar livre. */
export function verMesa(id: string) {
  const m = TRU.mesas.get(id)?.pub;
  if (!m) return;
  TRU.ver = m.id;
  if (m.fase === "espera" && meuLugar(m, getApp().myUid) < 0) {
    const i = m.lugares.findIndex((l) => !l);
    if (i >= 0) void trEnviar("sentar", i);
  }
  avisa();
}

export function voltarAoLobby() {
  TRU.ver = null;
  avisa();
}

export function levantar() {
  const id = TRU.ver;
  if (id) void chamar({ acao: "sair", mesa: id });
  voltarAoLobby();
}

/** Só quem abriu: começa outra partida depois do fim. */
export const revanche = () => void trEnviar("comecar");
