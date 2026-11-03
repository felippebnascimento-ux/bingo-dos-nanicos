/*
 * Banca Nanica (seção 47 do seguranca.sql): o saldo da casa do cassino. Tudo que os nanicos perdem no cassino entra
 * nela e o que o cassino paga sai dela; quem mantém é um gatilho no extrato, o site só lê e acompanha pelo tempo real.
 * Sem o SQL, a banca não aparece.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";

export const useBanca = create<{ valor: number | null }>()(() => ({ valor: null }));

const lerValor = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);

let ligada = false;
/** Lê a banca uma vez e passa a acompanhar as mudanças (chamado pela tela que mostra). */
export async function iniciarBanca() {
  if (ligada) return;
  ligada = true;
  aoMudarTabela("banca", (row) => {
    const v = lerValor(row?.valor);
    if (v !== null) useBanca.setState({ valor: v });
  });
  const { data, error } = await sb().from("banca").select("valor").eq("id", 1).maybeSingle();
  if (error) {
    ligada = false;
    return;
  }
  const v = lerValor((data as { valor?: unknown } | null)?.valor);
  if (v !== null) useBanca.setState({ valor: v });
}
