import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

let cliente: SupabaseClient | null = null;

/** O cliente do Supabase (um só para o site inteiro). Só existe no navegador. */
export function sb(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return cliente;
}

/** Espera a consulta e devolve os dados; se o banco recusar, lança o erro. */
export async function q<T = unknown>(
  p: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

/**
 * O banco recusa quando alguém manda coisa demais em pouco tempo e responde com uma
 * mensagem que começa com "Calma". Essa mensagem vai para a pessoa; o resto vira `padrao`.
 */
export function errMsg(e: unknown, padrao: string): string {
  const m = e && typeof e === "object" && "message" in e ? (e as { message: unknown }).message : null;
  return typeof m === "string" && /^Calma/.test(m) ? m.slice(0, 140) : padrao;
}
