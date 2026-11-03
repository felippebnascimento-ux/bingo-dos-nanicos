/*
 * Troca entre nanicos (seção 54 do seguranca.sql, como no Habbo). A linha da troca só chega aos dois que estão nela
 * (o RLS vale no tempo real). Mexer na oferta, aceitar e cancelar são RPCs: o banco confere tudo e faz a troca
 * inteira de uma vez quando os dois aceitam. Aqui só se lê e se pede.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";
import { toast } from "@/lib/toast";

export type Lado = { itens: Record<string, number>; moedas: number; ok: boolean };
export type Troca = { id: number; de: string; para: string; estado: "aberta" | "feita" | "cancelada"; ladoDe: Lado; ladoPara: Lado };

/** Confere os itens de um lado: { item: qtd } com até 12 itens e qtd de 1 a 20. */
export function lerItens(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>).slice(0, 12))
    if (k.length <= 40 && typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 20) out[k] = n;
  return out;
}

/** Confere a linha que veio do banco. */
export function lerTroca(r: Record<string, unknown> | null): Troca | null {
  if (!r || typeof r.id !== "number" || typeof r.de !== "string" || typeof r.para !== "string") return null;
  const estado = r.estado === "feita" || r.estado === "cancelada" ? r.estado : r.estado === "aberta" ? "aberta" : null;
  if (!estado) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
  return {
    id: r.id,
    de: r.de,
    para: r.para,
    estado,
    ladoDe: { itens: lerItens(r.de_itens), moedas: n(r.de_moedas), ok: r.de_ok === true },
    ladoPara: { itens: lerItens(r.para_itens), moedas: n(r.para_moedas), ok: r.para_ok === true },
  };
}

/** O meu lado e o do outro, vistos por mim (`eu` = meu user_id). */
export function ladosDe(t: Troca, eu: string) {
  const souDe = t.de === eu;
  return { meu: souDe ? t.ladoDe : t.ladoPara, dele: souDe ? t.ladoPara : t.ladoDe, outro: souDe ? t.para : t.de };
}

/** a troca aberta em que estou (null = nenhuma); `aberta` = a janela na tela */
export const useTroca = create<{ troca: Troca | null; aberta: boolean }>()(() => ({ troca: null, aberta: false }));

const nomeDe = (uid: string) => getApp().friends.find((f) => f.user_id === uid)?.name ?? "O outro nanico";

let ligado = false;
/** Passa a ouvir as minhas trocas (uma vez) e pega a que já estiver aberta. */
export function iniciarTrocas() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("trocas", (row) => {
    const t = lerTroca(row);
    const eu = getApp().myUid;
    if (!t || !eu || (t.de !== eu && t.para !== eu)) return;
    const antes = useTroca.getState().troca;
    if (t.estado === "aberta") {
      /* chegou um pedido novo para mim: abre a janela e avisa */
      if (!antes && t.para === eu) toast(`${nomeDe(t.de)} quer trocar com você.`);
      return useTroca.setState({ troca: t, aberta: useTroca.getState().aberta || !antes });
    }
    if (antes?.id !== t.id) return;
    toast(t.estado === "feita" ? "Troca feita! Confira a sua mochila." : "A troca foi cancelada.");
    useTroca.setState({ troca: null, aberta: false });
  });
  void sb()
    .from("trocas")
    .select("*")
    .eq("estado", "aberta")
    .gt("atualizada_em", new Date(Date.now() - 30 * 60_000).toISOString())
    .limit(1)
    .then(({ data }) => {
      const t = lerTroca((data?.[0] as Record<string, unknown>) ?? null);
      if (t) useTroca.setState({ troca: t });
    });
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb().rpc(fn, args);
  if (error) {
    toast(error.message?.slice(0, 160) || "Não deu. Tente de novo.");
    return null;
  }
  return data ?? true;
}

/** Abre uma troca com um nanico (friend id); a janela abre quando a linha chega pelo tempo real. */
export async function abrirTroca(fid: string) {
  iniciarTrocas();
  if (useTroca.getState().troca) return useTroca.setState({ aberta: true });
  const id = await rpc("troca_abrir", { p_para: fid });
  if (id) useTroca.setState({ aberta: true });
}
export const oferecer = (id: number, itens: Record<string, number>, moedas: number) => rpc("troca_oferecer", { p_id: id, p_itens: itens, p_moedas: moedas });
export const aceitarTroca = (id: number) => rpc("troca_aceitar", { p_id: id });
export const cancelarTroca = (id: number) => rpc("troca_cancelar", { p_id: id });
