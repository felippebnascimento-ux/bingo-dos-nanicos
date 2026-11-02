/*
 * Dados da loja: a vitrine (loja_itens), a minha mochila e o que todo mundo tem equipado (a RLS da mochila
 * deixa ver os equipados de todos e a mochila inteira só a própria). Comprar, equipar e usar chamam as
 * funções do banco; o tempo real da mochila mantém os equipados e o de consumos anima o boneco no Sítio.
 */
import { create } from "zustand";
import { ajustarSaldo } from "@/lib/carteira";
import { aoMudarTabela } from "@/lib/sala";
import { getApp, setApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { equipados, lerItem, type Espaco, type ItemLoja, type LinhaMochila } from "./loja";

type EstadoLoja = {
  /** null = ainda não carregou (ou o SQL da loja não rodou) */
  itens: ItemLoja[] | null;
  /** linhas de mochila que eu consigo ler: as minhas e as equipadas dos outros */
  linhas: LinhaMochila[];
  ocupado: string | null;
};
export const useLoja = create<EstadoLoja>()(() => ({ itens: null, linhas: [], ocupado: null }));

const lerLinha = (r: Record<string, unknown>): LinhaMochila | null =>
  typeof r.user_id === "string" && typeof r.item_id === "string" && typeof r.qtd === "number"
    ? { userId: r.user_id, itemId: r.item_id, qtd: r.qtd, equipado: r.equipado === true }
    : null;

async function carregarMochila() {
  const { data, error } = await sb().from("mochila").select("user_id,item_id,qtd,equipado");
  if (error) throw error;
  useLoja.setState({ linhas: (data || []).map((r) => lerLinha(r as Record<string, unknown>)).filter((l): l is LinhaMochila => !!l) });
}

export async function carregarLoja() {
  try {
    const { data, error } = await sb().from("loja_itens").select("id,nome,descricao,espaco,preco,dados,ordem").eq("ativo", true);
    if (error) throw error;
    useLoja.setState({ itens: (data || []).map((r) => lerItem(r as Record<string, unknown>)).filter((i): i is ItemLoja => !!i) });
    await carregarMochila();
  } catch (e) {
    console.warn("Loja desligada: rode a seção 15 do supabase/sql/seguranca.sql.", (e as Error)?.message);
  }
}

let ligado = false;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Carrega a loja e passa a ouvir a mochila (uma vez só). Chamado ao entrar. */
export function iniciarLoja() {
  if (ligado) return;
  ligado = true;
  void carregarLoja();
  /* qualquer troca na mochila (de qualquer um): relê, juntando várias trocas seguidas numa leitura só */
  aoMudarTabela("mochila", () => {
    clearTimeout(timer);
    timer = setTimeout(() => void carregarMochila().catch(() => {}), 400);
  });
}

/* ---------- ganchos ---------- */
const VAZIO: Partial<Record<Espaco, ItemLoja>> = {};
let cacheChave: unknown[] = [];
let cacheVal: ReturnType<typeof equipados> = {};
/** Equipados de todo mundo (userId → espaço → item), recalculado só quando a mochila ou a loja mudam. */
function equipadosDeTodos(s: EstadoLoja) {
  if (cacheChave[0] !== s.linhas || cacheChave[1] !== s.itens) {
    cacheChave = [s.linhas, s.itens];
    cacheVal = equipados(s.linhas, s.itens ?? []);
  }
  return cacheVal;
}
/** O que um nanico tem equipado (pelo user_id da conta). */
export const useEquipados = (userId: string | null | undefined) => useLoja((s) => (userId ? (equipadosDeTodos(s)[userId] ?? VAZIO) : VAZIO));
/** Quantos de cada item eu tenho. */
export const useMinhaMochila = () => {
  const linhas = useLoja((s) => s.linhas);
  const eu = getApp().myUid;
  return linhas.filter((l) => l.userId === eu && l.qtd > 0);
};

/* ---------- ações ---------- */
function erro(e: unknown, padrao: string) {
  const o = (e || {}) as { code?: string; message?: string };
  toast(o.code === "P0001" && o.message ? o.message.slice(0, 140) : padrao);
}

export async function comprar(it: ItemLoja) {
  if (useLoja.getState().ocupado) return;
  useLoja.setState({ ocupado: it.id });
  try {
    const { data, error } = await sb().rpc("comprar", { p_item: it.id });
    if (error) throw error;
    const saldo = (data as { saldo?: unknown } | null)?.saldo;
    if (typeof saldo === "number") ajustarSaldo(saldo);
    await carregarMochila();
    toast(it.espaco === "consumivel" ? `${it.nome} na mochila. Use no K-FOFO.` : `${it.nome} na sua mochila`);
  } catch (e) {
    erro(e, "Não deu para comprar agora. Confira a internet.");
  } finally {
    useLoja.setState({ ocupado: null });
  }
}

export async function equipar(it: ItemLoja, ligar: boolean) {
  if (useLoja.getState().ocupado) return;
  useLoja.setState({ ocupado: it.id });
  try {
    const { error } = await sb().rpc("equipar", { p_item: it.id, p_ligar: ligar });
    if (error) throw error;
    await carregarMochila();
  } catch (e) {
    erro(e, "Não deu para equipar agora. Confira a internet.");
  } finally {
    useLoja.setState({ ocupado: null });
  }
}

/** Usa um consumível: vai para o Sítio, e todo mundo vê o boneco fumando ou bebendo. */
export async function usar(it: ItemLoja) {
  if (useLoja.getState().ocupado) return;
  useLoja.setState({ ocupado: it.id });
  try {
    const { error } = await sb().rpc("usar_item", { p_item: it.id });
    if (error) throw error;
    setApp({ aba: "hall", fichaAberta: null });
    await carregarMochila();
  } catch (e) {
    erro(e, "Não deu para usar agora. Confira a internet.");
  } finally {
    useLoja.setState({ ocupado: null });
  }
}
