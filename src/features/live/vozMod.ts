/*
 * Moderação da voz (seção 70), como no Discord: um moderador silencia alguém para todos (voz_silenciados) ou
 * desconecta da call (voz_desconectar). Quem decide se pode é o banco (RLS com eh_moderador()); o site de quem foi
 * silenciado ou desconectado obedece pelo tempo real. Sem o SQL novo, as tabelas não existem e nada acontece.
 */
import { create } from "zustand";
import { getApp, useApp } from "@/lib/store";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { sairVoz, silenciarPorModerador } from "./voz";

/** Quem (user id) está silenciado na voz por um moderador. */
export const useVozMod = create<{ silenciados: string[] }>()(() => ({ silenciados: [] }));

function aplicar(l: string[]) {
  useVozMod.setState({ silenciados: l });
  const eu = getApp().myUid;
  silenciarPorModerador(!!eu && l.includes(eu));
}

async function carregar() {
  if (!getApp().db) return;
  const { data, error } = await sb().from("voz_silenciados").select("user_id");
  if (error) return;
  aplicar((data ?? []).map((r) => String(r.user_id)));
}

let ligado = false;
export function iniciarVozMod() {
  if (ligado) return;
  ligado = true;
  void carregar();
  /* entrou de novo (outra conta, reconexão): lê de novo */
  useApp.subscribe((s, p) => {
    if (s.myUid !== p.myUid) void carregar();
  });
  aoMudarTabela("voz_silenciados", () => void carregar());
  aoMudarTabela("voz_desconectar", (r, ev) => {
    if (ev !== "INSERT" || !r || r.user_id !== getApp().myUid) return;
    /* só vale o pedido de agora (o tempo real não manda linhas velhas, mas confere a hora por garantia) */
    if (typeof r.em === "string" && Date.now() - Date.parse(r.em) > 60_000) return;
    if (!getApp().myVozSid) return;
    sairVoz();
    toast("Um moderador desconectou você da voz.");
  });
}

/** Moderador: silencia (ou libera) alguém na voz para todos. */
export async function silenciarParaTodos(userId: string, sim: boolean) {
  const { error } = sim
    ? await sb().from("voz_silenciados").insert({ user_id: userId })
    : await sb().from("voz_silenciados").delete().eq("user_id", userId);
  if (error && error.code !== "23505") return toast("Só os moderadores podem fazer isso.");
  void carregar();
  toast(sim ? "Silenciado para todos na voz" : "Microfone liberado");
}

/** Moderador: tira alguém da call. */
export async function desconectarDaVoz(userId: string) {
  const { error } = await sb().from("voz_desconectar").insert({ user_id: userId });
  if (error) return toast("Só os moderadores podem fazer isso.");
  toast("Desconectado da voz");
}
