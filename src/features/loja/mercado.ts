/*
 * Mercado dos nanicos (seção 56 do seguranca.sql, como o Marketplace do Habbo): os anúncios abertos chegam a todos os
 * membros pelo tempo real; vender, comprar e retirar são RPCs (o banco tira o item da mochila, cobra, repassa 95% ao
 * vendedor e põe 5% na Banca Nanica). Aqui só se lê e se pede.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";

export type Anuncio = { id: number; vendedor: string; item: string; numero: number | null; preco: number; criada: number };

/** O que o vendedor recebe (o preço menos 5%, arredondado como no banco). */
export const recebe = (preco: number) => preco - Math.ceil(preco * 0.05);

export function lerAnuncio(r: Record<string, unknown> | null): Anuncio | null {
  if (!r || typeof r.id !== "number" || typeof r.vendedor !== "string" || typeof r.item_id !== "string" || typeof r.preco !== "number") return null;
  if (r.estado !== "aberta") return null;
  return {
    id: r.id,
    vendedor: r.vendedor,
    item: r.item_id.slice(0, 40),
    numero: typeof r.numero === "number" ? r.numero : null,
    preco: r.preco,
    criada: Date.parse(String(r.criada_em)) || 0,
  };
}

export const useMercado = create<{ anuncios: Anuncio[]; carregou: boolean }>()(() => ({ anuncios: [], carregou: false }));

async function carregar() {
  const { data, error } = await sb().from("mercado").select("id,vendedor,item_id,numero,preco,estado,criada_em").eq("estado", "aberta").order("criada_em", { ascending: false }).limit(300);
  if (error) return;
  useMercado.setState({ anuncios: (data || []).flatMap((r) => lerAnuncio(r as Record<string, unknown>) ?? []), carregou: true });
}

let ligado = false;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Carrega os anúncios e passa a ouvir o tempo real (uma vez). */
export function iniciarMercado() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("mercado", () => {
    clearTimeout(timer);
    timer = setTimeout(() => void carregar(), 300);
  });
  void carregar();
}

async function rpc(fn: string, args: Record<string, unknown>, ok: string) {
  const { error } = await sb().rpc(fn, args);
  if (error) {
    toast(error.message?.slice(0, 160) || "Não deu. Tente de novo.");
    return false;
  }
  toast(ok);
  return true;
}
export const anunciar = (item: string, preco: number) => rpc("mercado_vender", { p_item: item, p_preco: preco }, "Anúncio no mercado!");
export const comprarAnuncio = (id: number) => rpc("mercado_comprar", { p_id: id }, "Comprado! Está na sua mochila.");
export const retirarAnuncio = (id: number) => rpc("mercado_retirar", { p_id: id }, "Anúncio retirado: o item voltou para a mochila.");
