/*
 * Pixações do banheiro do K-FOFO (seção 51): cada nanico escreve o que quiser na parede e fica para sempre (ninguém
 * apaga pelo site). O lugar na parede é sorteado aqui (cenas.ts, `lugarDePixo`) e o banco confere os limites.
 * As novas chegam pelo tempo real da tabela banheiro_pixacoes.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { CORES_PIXO, lugarDePixo, type CorPixo, type LugarPixo } from "./cenas";

export type Pixo = LugarPixo & { id: number; userId: string | null; texto: string; cor: CorPixo };

export const usePixacoes = create<{ lista: Pixo[]; ok: boolean | null }>()(() => ({ lista: [], ok: null }));

/** Confere uma linha do banco. */
export function lerPixo(r: unknown): Pixo | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const a = Number(o.a), z = Number(o.z), rot = Number(o.rot);
  if (typeof o.id !== "number" || typeof o.texto !== "string" || (o.parede !== "esq" && o.parede !== "dir")) return null;
  if (!Number.isFinite(a) || !Number.isFinite(z) || !Number.isFinite(rot)) return null;
  return {
    id: o.id,
    userId: typeof o.user_id === "string" ? o.user_id : null,
    texto: o.texto.slice(0, 60),
    cor: CORES_PIXO.includes(o.cor as CorPixo) ? (o.cor as CorPixo) : "preto",
    parede: o.parede,
    a,
    z,
    rot,
  };
}

const COLUNAS = "id,user_id,texto,cor,parede,a,z,rot";
let ligado = false;
/** As últimas 300 pixações (as mais antigas ficam por baixo) e as novas pelo tempo real. */
export async function iniciarPixacoes() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("banheiro_pixacoes", (row) => {
    const p = lerPixo(row);
    if (p) usePixacoes.setState((s) => ({ lista: [...s.lista.filter((x) => x.id !== p.id), p].slice(-300) }));
  });
  const { data, error } = await sb().from("banheiro_pixacoes").select(COLUNAS).order("id", { ascending: false }).limit(300);
  if (error) return usePixacoes.setState({ ok: false });
  usePixacoes.setState({ ok: true, lista: (data ?? []).map(lerPixo).filter((p): p is Pixo => !!p).reverse() });
}

/** Pixa a parede (5 por hora; o banco põe o autor). */
export async function pixar(texto: string, cor: CorPixo): Promise<boolean> {
  const t = texto.trim();
  if (!t) return false;
  const { data, error } = await sb()
    .from("banheiro_pixacoes")
    .insert({ texto: t.slice(0, 60), cor, ...lugarDePixo() })
    .select(COLUNAS)
    .maybeSingle();
  if (error) {
    toast(errMsg(error, "Não deu para pixar agora. Tente de novo."));
    return false;
  }
  const p = lerPixo(data);
  if (p) usePixacoes.setState((s) => ({ lista: [...s.lista.filter((x) => x.id !== p.id), p].slice(-300) }));
  return true;
}
