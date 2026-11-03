/*
 * Arena de pintar o chão (seção 58): o banco guarda a partida (times e horários) e todo mundo vê a mesma pelo tempo
 * real; a pintura sai do andar dos bonecos (bonecos.ts), que já é igual em todas as telas: enquanto a partida corre,
 * o piso embaixo de cada jogador fica da cor do time dele. Não vale moedas.
 */
import { create } from "zustand";
import { useHall } from "@/features/hall/bonecos";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";
import { toast } from "@/lib/toast";

export type Time = "azul" | "vermelho";
export type Partida = { id: number; estado: "esperando" | "jogando" | "fim"; times: Record<string, Time>; comeca: number | null; acaba: number | null };
export type Fase = "esperando" | "contagem" | "jogando" | "fim";

export function lerPartida(r: Record<string, unknown> | null): Partida | null {
  if (!r || typeof r.id !== "number") return null;
  const estado = r.estado === "jogando" || r.estado === "fim" ? r.estado : r.estado === "esperando" ? "esperando" : null;
  if (!estado) return null;
  const times: Record<string, Time> = {};
  if (r.times && typeof r.times === "object")
    for (const [k, v] of Object.entries(r.times as Record<string, unknown>).slice(0, 8)) if (v === "azul" || v === "vermelho") times[k] = v;
  const t = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
  return { id: r.id, estado, times, comeca: t(r.comeca_em), acaba: t(r.acaba_em) };
}

/** Em que pé está a partida agora (pelo relógio, para todo mundo trocar de fase junto). */
export function faseDa(p: Partida | null, agora: number): Fase {
  if (!p || p.estado === "esperando") return "esperando";
  if (p.estado === "fim" || (p.acaba !== null && agora >= p.acaba)) return "fim";
  if (p.comeca !== null && agora < p.comeca) return "contagem";
  return "jogando";
}

/** Quantos pisos cada time pintou. */
export function placar(pisos: Record<string, Time>) {
  const out = { azul: 0, vermelho: 0 };
  for (const t of Object.values(pisos)) out[t]++;
  return out;
}

/** O piso (i, j) embaixo de um boneco (o centro do piso fica em i + 0,5). */
export const pisoDe = (i: number, j: number) => `${Math.floor(i + 0.5)},${Math.floor(j + 0.5)}`;

export const useArena = create<{ partida: Partida | null; pisos: Record<string, Time>; pintadaDe: number | null }>()(() => ({ partida: null, pisos: {}, pintadaDe: null }));

async function carregar() {
  const { data } = await sb().from("arena_partidas").select("*").order("id", { ascending: false }).limit(1);
  const p = lerPartida((data?.[0] as Record<string, unknown>) ?? null);
  useArena.setState((s) => ({ partida: p, ...(p?.id !== s.pintadaDe && p?.estado !== "fim" ? { pisos: {}, pintadaDe: null } : {}) }));
}

/* enquanto a partida corre e eu estou na arena, pinta o piso embaixo de cada jogador (a cada 100 ms) */
let pintor: ReturnType<typeof setInterval> | undefined;
function pintar() {
  const { partida } = useArena.getState();
  const s = getApp();
  if (!partida || s.meuQuarto !== "arena" || faseDa(partida, Date.now()) !== "jogando") return;
  const novos: Record<string, Time> = {};
  for (const b of useHall.getState().bonecos) {
    const uid = s.friends.find((f) => f.id === b.fid)?.user_id;
    const time = uid ? partida.times[uid] : undefined;
    if (time) novos[pisoDe(b.i, b.j)] = time;
  }
  const atual = useArena.getState().pisos;
  if (Object.entries(novos).some(([k, t]) => atual[k] !== t)) useArena.setState({ pisos: { ...atual, ...novos }, pintadaDe: partida.id });
}

let ligado = false;
export function iniciarArena() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("arena_partidas", () => void carregar());
  void carregar();
  pintor = setInterval(pintar, 100);
}
export const pararArena = () => clearInterval(pintor);

async function rpc(fn: string) {
  const { error } = await sb().rpc(fn);
  if (error) toast(error.message?.slice(0, 160) || "Não deu. Tente de novo.");
  else void carregar();
}
export const entrarNaArena = () => rpc("arena_entrar");
export const sairDaArena = () => rpc("arena_sair");
export const comecarArena = () => rpc("arena_comecar");
