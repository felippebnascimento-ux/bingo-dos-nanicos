/*
 * Grupos (seção 61, como os do Habbo): cada membro cria um (500 moedas, nome, cor e símbolo) ou entra no de alguém;
 * um por pessoa. Os grupos e os membros chegam a todos pelo tempo real; criar, entrar e sair são RPCs.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";

export const CORES_GRUPO = ["ouro", "oliva", "ardosia", "vermelho", "azul", "roxo"] as const;
export type CorGrupo = (typeof CORES_GRUPO)[number];
export const SIMBOLOS = { estrela: "⭐", coroa: "👑", raio: "⚡", caveira: "💀", coracao: "❤️", fogo: "🔥", trevo: "🍀", espada: "⚔️" } as const;
export type Simbolo = keyof typeof SIMBOLOS;

export type Grupo = { id: number; nome: string; cor: CorGrupo; simbolo: Simbolo; dono: string };

export function lerGrupo(r: Record<string, unknown> | null): Grupo | null {
  if (!r || typeof r.id !== "number" || typeof r.nome !== "string" || typeof r.dono !== "string") return null;
  if (!(CORES_GRUPO as readonly unknown[]).includes(r.cor) || typeof r.simbolo !== "string" || !Object.hasOwn(SIMBOLOS, r.simbolo)) return null;
  return { id: r.id, nome: r.nome.slice(0, 24), cor: r.cor as CorGrupo, simbolo: r.simbolo as Simbolo, dono: r.dono };
}

/** O grupo de alguém (user_id), pelo mapa de membros. */
export const grupoDe = (uid: string | null | undefined, grupos: readonly Grupo[], membros: Record<string, number>) =>
  uid && membros[uid] !== undefined ? (grupos.find((g) => g.id === membros[uid]) ?? null) : null;

export const useGrupos = create<{ grupos: Grupo[]; membros: Record<string, number>; aberto: boolean }>()(() => ({ grupos: [], membros: {}, aberto: false }));

async function carregar() {
  const [g, m] = await Promise.all([sb().from("grupos").select("*").limit(500), sb().from("grupo_membros").select("user_id,grupo_id").limit(2000)]);
  if (g.error || m.error) return;
  const membros: Record<string, number> = {};
  for (const r of m.data ?? []) if (typeof r.user_id === "string" && typeof r.grupo_id === "number") membros[r.user_id] = r.grupo_id;
  useGrupos.setState({ grupos: (g.data ?? []).flatMap((r) => lerGrupo(r as Record<string, unknown>) ?? []), membros });
}

let ligado = false;
let timer: ReturnType<typeof setTimeout> | undefined;
export function iniciarGrupos() {
  if (ligado) return;
  ligado = true;
  const recarregar = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void carregar(), 300);
  };
  aoMudarTabela("grupos", recarregar);
  aoMudarTabela("grupo_membros", recarregar);
  void carregar();
}

async function rpc(fn: string, args: Record<string, unknown>, ok: string) {
  const { error } = await sb().rpc(fn, args);
  if (error) {
    toast(error.message?.slice(0, 160) || "Não deu. Tente de novo.");
    return false;
  }
  toast(ok);
  void carregar();
  return true;
}
export const criarGrupo = (nome: string, cor: CorGrupo, simbolo: Simbolo) => rpc("grupo_criar", { p_nome: nome, p_cor: cor, p_simbolo: simbolo }, "Grupo criado!");
export const entrarNoGrupo = (id: number) => rpc("grupo_entrar", { p_id: id }, "Você entrou no grupo.");
export const sairDoGrupo = () => rpc("grupo_sair", {}, "Você saiu do grupo.");
