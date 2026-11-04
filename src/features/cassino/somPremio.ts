/*
 * O som do dinheiro quando eu ganho mais de 500 moedas numa jogada do cassino, em qualquer jogo (pedido do Felippe,
 * 03/11/2026). Quem avisa é o tempo real da minha carteira (o último ganho que o creditar() gravou); o extrato diz de
 * onde veio, para não tocar quando o dinheiro só voltou: sair da mesa de pôquer com as fichas, o reembolso do
 * blackjack ou o duelo devolvido. O navegador nunca decide o prêmio: só ouve.
 */
import { aoMudarTabela } from "@/lib/sala";
import { getApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { tocarSom } from "@/lib/sons";

/** Prêmio mínimo (exclusivo) que toca o som. */
export const PREMIO_COM_SOM = 500;

/** A linha da carteira pode ser um prêmio grande do cassino? (antes de olhar o extrato) */
export function talvezPremio(row: Record<string, unknown> | null, meuUid: string | null): boolean {
  if (!row || !meuUid || row.user_id !== meuUid) return false;
  const v = row.ultimo_valor;
  if (typeof v !== "number" || !Number.isInteger(v) || v <= PREMIO_COM_SOM) return false;
  return row.ultimo_motivo === "cassino" || row.ultimo_motivo === "duelo";
}

/** A linha do extrato é um prêmio de jogada (e não dinheiro voltando)? */
export function ehPremio(e: { valor: unknown; motivo: unknown; ref: unknown } | null | undefined): boolean {
  if (!e || typeof e.valor !== "number" || e.valor <= PREMIO_COM_SOM) return false;
  const ref = typeof e.ref === "string" ? e.ref : "";
  if (e.motivo === "duelo") return ref.endsWith(":premio");
  /* pôquer: o creditar só roda ao entrar e ao sair da mesa (o pote fica nas fichas); sair com fichas não é prêmio */
  return e.motivo === "cassino" && ref !== "poker";
}

let ligado = false;

export function iniciarSomPremio() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("carteiras", (row) => {
    if (!talvezPremio(row, getApp().myUid)) return;
    void (async () => {
      const { data } = await sb().from("extrato").select("valor,motivo,ref").order("id", { ascending: false }).limit(1);
      if (Array.isArray(data) && ehPremio(data[0])) tocarSom("dinheiro", 0.8);
    })();
  });
}
