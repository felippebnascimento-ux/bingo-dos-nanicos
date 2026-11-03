/* O que veio do banco para o cassino: estado da semente, apostas, sementes reveladas, feed e a tabela do caça-níquel. */
import { create } from "zustand";
import { sb } from "@/lib/supabase";
import type { Pagamentos, Rolo } from "./regras";

export type Jogo = "roleta" | "aviao" | "limbo" | "dado" | "slot" | "penalti" | "blackjack" | "poker" | "duelo";
export type Estado = { hash: string; cliente: string; nonce: number };
export type Aposta = { id: number; jogo: Jogo; aposta: number; escolha: Record<string, unknown>; resultado: Record<string, unknown>; pagou: number; hash: string; nonce: number; em: string };
export type Revelada = { id: number; semente_hex: string; hash: string; semente_cliente: string; ultimo_nonce: number };
export type Feed = { nome: string | null; jogo: Jogo; aposta: number; pagou: number };

/** O jogo escolhido na aba Cassino (fica aqui para o K-FOFO poder abrir direto num jogo, como o Pênalti x1). */
export const useJogoCassino = create<{ jogo: Jogo }>()(() => ({ jogo: "roleta" }));

/** `ligado` = null enquanto não carregou; false se o SQL do cassino não rodou. */
export const useCassino = create<{
  ligado: boolean | null;
  estado: Estado | null;
  historico: Aposta[];
  reveladas: Revelada[];
  feed: Feed[];
  rolos: Rolo[];
  pagamentos: Pagamentos;
}>()(() => ({ ligado: null, estado: null, historico: [], reveladas: [], feed: [], rolos: [], pagamentos: {} }));

export async function carregar() {
  const { data, error } = await sb().rpc("cassino_estado");
  if (error) return useCassino.setState({ ligado: false });
  useCassino.setState({ ligado: true, estado: data as Estado });
  const [h, r, f, ro, pg] = await Promise.all([
    sb().from("cassino_apostas").select("id,jogo,aposta,escolha,resultado,pagou,hash,nonce,em").order("em", { ascending: false }).limit(200),
    sb().from("cassino_sementes_antigas").select("id,semente_hex,hash,semente_cliente,ultimo_nonce").order("revelada_em", { ascending: false }).limit(10),
    sb().rpc("cassino_feed"),
    sb().from("cassino_rolos").select("simbolo,peso,ordem").order("ordem"),
    sb().from("cassino_pagamentos").select("combinacao,multiplicador"),
  ]);
  useCassino.setState({
    ...(Array.isArray(h.data) ? { historico: h.data as Aposta[] } : {}),
    ...(Array.isArray(r.data) ? { reveladas: r.data as Revelada[] } : {}),
    ...(Array.isArray(f.data) ? { feed: f.data as Feed[] } : {}),
    ...(Array.isArray(ro.data) ? { rolos: ro.data as Rolo[] } : {}),
    ...(Array.isArray(pg.data)
      ? { pagamentos: Object.fromEntries((pg.data as { combinacao: string; multiplicador: number }[]).map((x) => [x.combinacao, Number(x.multiplicador)])) }
      : {}),
  });
}

/** Erro do banco → texto para a pessoa (as mensagens do cassino já dizem o que fazer). */
export const msgDe = (e: unknown, padrao: string) => {
  const m = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  return m && m.length < 120 && !/fetch|network/i.test(m) ? m : padrao;
};
