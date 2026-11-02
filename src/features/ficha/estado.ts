/*
 * Ficha do nanico: pede os números à função ficha-jogos (que guarda por 6 h) e lembra o que já veio.
 * A Riot e a Steam nunca são chamadas do navegador: a chave fica no servidor.
 */
import { create } from "zustand";
import { sb } from "@/lib/supabase";
import { lerNumeros, type NumerosFicha } from "./numeros";

type Estado = { porNanico: Record<string, NumerosFicha>; carregando: Record<string, boolean>; falhou: Record<string, boolean> };

export const useFicha = create<Estado>()(() => ({ porNanico: {}, carregando: {}, falhou: {} }));

const marcar = (campo: "carregando" | "falhou", fid: string, v: boolean) =>
  useFicha.setState((s) => ({ [campo]: { ...s[campo], [fid]: v } }));

/** Busca (ou pega do cache do servidor) os números de um nanico. */
export async function carregarFicha(fid: string) {
  if (useFicha.getState().carregando[fid]) return;
  marcar("carregando", fid, true);
  marcar("falhou", fid, false);
  try {
    const { data, error } = await sb().functions.invoke("ficha-jogos", { body: { friend_id: fid } });
    if (error) throw error;
    useFicha.setState((s) => ({ porNanico: { ...s.porNanico, [fid]: lerNumeros(data) } }));
  } catch (e) {
    console.warn("ficha indisponível", e);
    marcar("falhou", fid, true);
  } finally {
    marcar("carregando", fid, false);
  }
}
