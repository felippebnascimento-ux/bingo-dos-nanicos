/*
 * Bingo no servidor (seção 12a do seguranca.sql). Numa sala de LoL, a cartela é sorteada e guardada pelo banco,
 * e cada nanicada só marca quando alguém canta ("Aconteceu!") e OUTRO nanico confirma. O banco paga +25 a quem
 * fecha linha (cartela sorteada, até 3 por dia). O site só pede e mostra: a partida, a minha cartela e os cantos
 * chegam do banco (e pelo tempo real das tabelas bingo_*).
 *
 * Sem o SQL (ou fora de uma sala de LoL), tudo segue como antes: cartela local em "rift-card", sem moedas.
 */
import { create } from "zustand";
import { bingoLines, cellsDe, matchPhrase, toggleCell } from "@/lib/bingo";
import { aoConectar, aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { getApp, salaLol, setApp, useApp } from "@/lib/store";
import type { Card, Cell } from "@/lib/tipos";
import { toast } from "@/lib/toast";
import { local, norm } from "@/lib/util";

export type CantoUI = { id: number; por: string; ok: boolean };
export type BingoServidor = {
  /** o SQL do bingo existe (null = ainda não sei) */
  sql: boolean | null;
  /** sala de LoL em que estou (null = fora: bingo local) */
  sala: string | null;
  partida: number | null;
  origem: "sorteada" | "montada" | null;
  /** os 25 ids de nanicadas da minha cartela (o meio é null) */
  casas: (string | null)[] | null;
  /** cantos da partida por nanicada */
  cantos: Record<string, CantoUI>;
  ocupado: boolean;
};

export const useBingo = create<BingoServidor>()(() => ({
  sql: null, sala: null, partida: null, origem: null, casas: null, cantos: {}, ocupado: false,
}));

/** O bingo do servidor vale agora (SQL rodou e estou numa sala de LoL)? */
export const bingoNoServidor = () => {
  const b = useBingo.getState();
  return b.sql === true && !!b.sala;
};
export const useBingoNoServidor = () => useBingo((b) => b.sql === true && !!b.sala);

const UUID = /^[0-9a-f-]{36}$/i;
/* inclinação do carimbo: fixa por nanicada, igual em todas as telas */
const rotDe = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(h) % 25) - 12;
};

/** Monta a cartela da tela (Card) com as nanicadas do banco e os cantos confirmados. */
export function cartelaDoServidor(casas: (string | null)[], cantos: Record<string, CantoUI>): Card {
  const { phrases, friends, lineup } = getApp();
  const pl = lineup.filter((p) => p.friendId);
  const fs = new Set(pl.map((p) => p.friendId));
  const cs = new Set(pl.map((p) => norm(p.champion)).filter(Boolean));
  const cells: Cell[] = casas.map((id) => {
    if (!id) return { free: true, text: "LIVRE" };
    const p = phrases.find((x) => x.id === id);
    if (!p) return { text: "(nanicada apagada)", rot: rotDe(id) };
    const m = matchPhrase(p, pl, fs, cs);
    const hitF = m && "f" in m ? m.f : [];
    const c = cellsDe([{ ...p, hitF, hit: m && "c" in m ? m.c : [] }], friends)[0];
    return { ...c, rot: rotDe(id) };
  });
  return { cells, marked: casas.map((id) => !id || !!cantos[id]?.ok) };
}

/* a cartela da tela acompanha o banco (a presença manda as linhas sozinha) */
let linhasAntes = 0;
function mostrar() {
  const b = useBingo.getState();
  if (!(b.sql && b.sala)) return;
  const card = b.casas ? cartelaDoServidor(b.casas, b.cantos) : null;
  const linhas = bingoLines(card);
  if (card && linhas > linhasAntes && linhasAntes >= 0) toast("BINGO! Grita no Discord.");
  linhasAntes = card ? linhas : -1;
  setApp({ card });
}

/* ---------- ler do banco ---------- */
let seq = 0;
async function carregar() {
  const sala = salaLol()?.id ?? null;
  const n = ++seq;
  if (!sala) {
    /* saí da sala de LoL: volta a cartela local de reserva */
    if (useBingo.getState().sala) setApp({ card: local.json<Card>("rift-card") });
    useBingo.setState({ sala: null, partida: null, origem: null, casas: null, cantos: {} });
    return;
  }
  const { data: part, error } = await sb().from("bingo_partidas").select("id").eq("sala", sala).is("fechada_em", null).maybeSingle();
  if (n !== seq) return;
  if (error) {
    /* SQL do bingo ainda não rodou: bingo local, como antes */
    if (useBingo.getState().sql !== false) console.warn("bingo no servidor indisponível", errMsg(error, "sem resposta"));
    useBingo.setState({ sql: false, sala: null });
    return;
  }
  const antes = useBingo.getState();
  if (antes.sql !== true || antes.sala !== sala) linhasAntes = -1; /* entrar na sala não comemora bingo velho */
  if (!part) {
    useBingo.setState({ sql: true, sala, partida: null, origem: null, casas: null, cantos: {} });
    mostrar();
    return;
  }
  const [c, k] = await Promise.all([
    sb().from("bingo_cartelas").select("casas,origem").eq("partida_id", part.id).eq("user_id", getApp().myUid ?? "").maybeSingle(),
    sb().from("bingo_cantos").select("id,phrase_id,cantado_por,confirmado_em").eq("partida_id", part.id),
  ]);
  if (n !== seq) return;
  const casas =
    Array.isArray(c.data?.casas) && c.data.casas.length === 25 && c.data.casas.every((x: unknown) => x === null || (typeof x === "string" && UUID.test(x)))
      ? (c.data.casas as (string | null)[])
      : null;
  const cantos: Record<string, CantoUI> = {};
  for (const r of k.data ?? [])
    if (typeof r.phrase_id === "string") cantos[r.phrase_id] = { id: Number(r.id), por: String(r.cantado_por), ok: !!r.confirmado_em };
  useBingo.setState({
    sql: true, sala, partida: Number(part.id), casas, cantos,
    origem: casas ? (c.data?.origem === "montada" ? "montada" : "sorteada") : null,
  });
  mostrar();
}

let tRecarga: ReturnType<typeof setTimeout> | undefined;
const recarregar = () => {
  clearTimeout(tRecarga);
  tRecarga = setTimeout(() => void carregar(), 150);
};

let ligado = false;
/** Liga o bingo do servidor (uma vez): acompanha a sala, o tempo real das tabelas e as nanicadas. */
export function iniciarBingo() {
  if (ligado) return;
  ligado = true;
  for (const t of ["bingo_partidas", "bingo_cartelas", "bingo_cantos"] as const)
    aoMudarTabela(t, (row) => {
      const b = useBingo.getState();
      if (!b.sql || !b.sala) return;
      /* só recarrega o que é da minha sala/partida */
      if (t === "bingo_partidas" ? row?.sala === b.sala || Number(row?.id) === b.partida : Number(row?.partida_id) === b.partida || !b.partida)
        recarregar();
    });
  aoConectar(recarregar);
  let salaAntes = getApp().minhaSala, phrasesAntes = getApp().phrases, lineupAntes = getApp().lineup;
  useApp.subscribe((s) => {
    if (s.minhaSala !== salaAntes || (s.salas.length > 0 && (salaLol(s)?.id ?? null) !== useBingo.getState().sala)) {
      salaAntes = s.minhaSala;
      recarregar();
    }
    if (s.phrases !== phrasesAntes || s.lineup !== lineupAntes) {
      phrasesAntes = s.phrases;
      lineupAntes = s.lineup;
      mostrar();
    }
  });
  recarregar();
}

/* ---------- o que a tela chama ---------- */
/** Chama uma função do bingo no banco. Devolve false (e mostra o motivo) se ela recusar. */
async function rpc(nome: string, args: Record<string, unknown>): Promise<boolean> {
  useBingo.setState({ ocupado: true });
  try {
    const { error } = await sb().rpc(nome, args);
    if (error) throw error;
    return true;
  } catch (e) {
    /* recusa do banco (P0001) já vem escrita para quem usa ("Quem cantou não confirma…") */
    const m = e as { code?: unknown; message?: unknown };
    toast(m.code === "P0001" && typeof m.message === "string" ? m.message.slice(0, 140) : errMsg(e, "Não deu para falar com o bingo. Tente de novo."));
    return false;
  } finally {
    useBingo.setState({ ocupado: false });
  }
}

/** "Sortear minha cartela": no servidor, numa sala de LoL; senão, a cartela local de sempre. */
export async function sortearCartela(local: () => void) {
  const b = useBingo.getState();
  if (!bingoNoServidor()) return local();
  if (await rpc("bingo_nova_cartela", { p_sala: b.sala })) {
    toast("Cartela sorteada");
    await carregar();
  }
}

/** Cartela montada (escolhida na ordem; o meio fica LIVRE). No servidor, não vale moedas. */
export async function usarMontada(ids: string[], local: () => void): Promise<boolean> {
  const b = useBingo.getState();
  if (!bingoNoServidor()) {
    local();
    return true;
  }
  const casas = [...ids.slice(0, 12), null, ...ids.slice(12, 24)];
  if (!(await rpc("bingo_montada", { p_sala: b.sala, p_casas: casas }))) return false;
  toast("Cartela montada (não vale moedas)");
  await carregar();
  return true;
}

/** Tocar numa casa: local marca direto; no servidor, canta ou confirma. */
export async function tocarCasa(i: number) {
  if (!bingoNoServidor()) return toggleCell(i);
  const b = useBingo.getState(), id = b.casas?.[i];
  if (!id || !b.partida || b.ocupado) return;
  const c = b.cantos[id], eu = getApp().myUid;
  if (c?.ok) return;
  if (c && c.por === eu) return toast("Esperando outro nanico confirmar.");
  if (c) {
    await rpc("bingo_confirmar", { p_canto: c.id });
    await carregar();
    return;
  }
  if (await rpc("bingo_cantar", { p_partida: b.partida, p_phrase: id })) {
    toast("Avisado! Agora outro nanico confirma.");
    await carregar();
  }
}

/** Fecha a partida da sala (fim do jogo): a próxima cartela abre outra. */
export async function fecharPartida() {
  const b = useBingo.getState();
  if (!bingoNoServidor()) return;
  await rpc("bingo_fechar", { p_sala: b.sala });
  await carregar();
}
