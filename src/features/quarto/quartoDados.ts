/*
 * Quarto próprio (seção 42 do seguranca.sql): o tamanho do quarto de cada um (quartos) e os móveis colocados
 * (quarto_moveis), que os membros leem e que chegam pelo tempo real. Pôr, mover e guardar só pelas RPCs; o banco
 * confere dono, mochila e "cabe" de novo. Nada aqui grava direto nas tabelas.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import type { MovelNoQuarto } from "./quarto";

type Estado = {
  /** user_id → tamanho do quarto (6, 9 ou 12) */
  quartos: Record<string, number>;
  /** id → móvel colocado */
  moveis: Record<number, MovelNoQuarto>;
  carregou: boolean;
  ocupado: boolean;
  /** o quarto que estou arrumando (abre a tela de arrumar) */
  arrumando: boolean;
};
export const useQuartos = create<Estado>()(() => ({ quartos: {}, moveis: {}, carregou: false, ocupado: false, arrumando: false }));

const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);

function lerMovel(r: Record<string, unknown> | null): MovelNoQuarto | null {
  const id = int(r?.id), i = int(r?.i), j = int(r?.j);
  if (!r || id === null || i === null || j === null || typeof r.user_id !== "string" || typeof r.item_id !== "string") return null;
  return { id, userId: r.user_id, itemId: r.item_id.slice(0, 30), i, j, giro: r.giro === true };
}

let ligado = false;
/** Lê os quartos e os móveis e passa a ouvir o tempo real (quem precisa chama; vale uma vez). */
export async function iniciarQuartos() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("quartos", (row) => {
    const t = int(row?.tamanho);
    if (typeof row?.user_id === "string" && (t === 6 || t === 9 || t === 12))
      useQuartos.setState((s) => ({ quartos: { ...s.quartos, [row.user_id as string]: t } }));
  });
  aoMudarTabela("quarto_moveis", (row, ev) => {
    const id = int(row?.id);
    if (ev === "DELETE") {
      if (id !== null)
        useQuartos.setState((s) => {
          const resto = { ...s.moveis };
          delete resto[id];
          return { moveis: resto };
        });
      return;
    }
    const m = lerMovel(row);
    if (m) useQuartos.setState((s) => ({ moveis: { ...s.moveis, [m.id]: m } }));
  });
  const [q, m] = await Promise.all([
    sb().from("quartos").select("user_id,tamanho"),
    sb().from("quarto_moveis").select("id,user_id,item_id,i,j,giro").limit(2000),
  ]);
  if (q.error || m.error) {
    /* SQL da seção 42 ainda não rodou: ninguém tem quarto próprio */
    console.warn("quarto próprio indisponível");
    return;
  }
  const quartos: Record<string, number> = {};
  for (const r of q.data ?? []) if (typeof r.user_id === "string" && typeof r.tamanho === "number") quartos[r.user_id] = r.tamanho;
  const moveis: Record<number, MovelNoQuarto> = {};
  for (const r of m.data ?? []) {
    const x = lerMovel(r as Record<string, unknown>);
    if (x) moveis[x.id] = x;
  }
  useQuartos.setState((s) => ({ quartos: { ...quartos, ...s.quartos }, moveis: { ...moveis, ...s.moveis }, carregou: true }));
}

/** Os móveis colocados no quarto de alguém. */
export const moveisDe = (moveis: Record<number, MovelNoQuarto>, userId: string | null | undefined) =>
  userId ? Object.values(moveis).filter((m) => m.userId === userId) : [];

/** Chama uma RPC do quarto; a recusa do banco já diz o que fazer ("Não cabe aí."). */
async function chamar(fn: string, args: Record<string, unknown>) {
  if (useQuartos.getState().ocupado) return false;
  useQuartos.setState({ ocupado: true });
  try {
    const { error } = await sb().rpc(fn, args);
    if (error) throw error;
    return true;
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
    toast(msg && msg.length < 140 ? msg : "Não deu para mexer no quarto agora.");
    return false;
  } finally {
    useQuartos.setState({ ocupado: false });
  }
}

export const porMovel = (item: string, i: number, j: number, giro: boolean) => chamar("quarto_por", { p_item: item, p_i: i, p_j: j, p_giro: giro });
export const moverMovel = (id: number, i: number, j: number, giro: boolean) => chamar("quarto_mover", { p_id: id, p_i: i, p_j: j, p_giro: giro });
export const guardarMovel = (id: number) => chamar("quarto_guardar", { p_id: id });
export const abrirArrumar = () => useQuartos.setState({ arrumando: true });
