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
import { entrarSala } from "@/features/salas/trocar";
import { entrarVoz, ensurdecerPorModerador, sairVoz, silenciarPorModerador } from "./voz";

/** Quem (user id) está silenciado na voz por um moderador, e quem está também ensurdecido (seção 71). */
/** E quem está de castigo (user id → até quando, em ms; seção 71). */
export const useVozMod = create<{ silenciados: string[]; surdos: string[]; castigos: Record<string, number> }>()(() => ({ silenciados: [], surdos: [], castigos: {} }));

/** Até quando a pessoa está de castigo (0 = não está). */
export const castigoAte = (t: number | undefined) => (t && t > Date.now() ? t : 0);

let fimDoCastigo: ReturnType<typeof setTimeout> | undefined;
/** Silenciado por moderador ou de castigo: fica mudo; o castigo acaba sozinho na hora marcada. */
function aplicarMeu() {
  const eu = getApp().myUid;
  const { silenciados, surdos, castigos } = useVozMod.getState();
  const ate = eu ? (castigos[eu] ?? 0) : 0;
  clearTimeout(fimDoCastigo);
  if (ate > Date.now()) fimDoCastigo = setTimeout(aplicarMeu, ate - Date.now() + 500);
  silenciarPorModerador(!!eu && (silenciados.includes(eu) || ate > Date.now()));
  ensurdecerPorModerador(!!eu && surdos.includes(eu));
}
function aplicar(silenciados: string[], surdos: string[]) {
  useVozMod.setState({ silenciados, surdos });
  aplicarMeu();
}
async function carregarCastigos() {
  if (!getApp().db) return;
  const { data, error } = await sb().from("castigos").select("user_id,ate");
  if (error) return;
  const castigos: Record<string, number> = {};
  for (const r of data ?? []) {
    const t = Date.parse(String(r.ate));
    if (t > Date.now()) castigos[String(r.user_id)] = t;
  }
  const eu = getApp().myUid;
  const antes = eu ? useVozMod.getState().castigos[eu] : undefined;
  useVozMod.setState({ castigos });
  if (eu && castigos[eu] && castigos[eu] !== antes)
    toast(`Um moderador pôs você de castigo até ${new Date(castigos[eu]).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}: sem chat e sem voz.`);
  aplicarMeu();
}

async function carregar() {
  if (!getApp().db) return;
  let r = await sb().from("voz_silenciados").select("user_id,surdo");
  /* sem a seção 71 a coluna surdo não existe: lê só quem está silenciado */
  if (r.error) r = (await sb().from("voz_silenciados").select("user_id")) as typeof r;
  if (r.error) return;
  const l = (r.data ?? []) as { user_id: string; surdo?: boolean }[];
  aplicar(
    l.map((x) => String(x.user_id)),
    l.filter((x) => x.surdo).map((x) => String(x.user_id)),
  );
}

let ligado = false;
export function iniciarVozMod() {
  if (ligado) return;
  ligado = true;
  void carregar();
  void carregarCastigos();
  /* entrou de novo (outra conta, reconexão): lê de novo */
  useApp.subscribe((s, p) => {
    if (s.myUid !== p.myUid) {
      void carregar();
      void carregarCastigos();
    }
  });
  aoMudarTabela("voz_silenciados", () => void carregar());
  aoMudarTabela("castigos", () => void carregarCastigos());
  aoMudarTabela("voz_desconectar", (r, ev) => {
    if (ev !== "INSERT" || !r || r.user_id !== getApp().myUid) return;
    /* só vale o pedido de agora (o tempo real não manda linhas velhas, mas confere a hora por garantia) */
    if (typeof r.em === "string" && Date.now() - Date.parse(r.em) > 60_000) return;
    if (!getApp().myVozSid) return;
    sairVoz();
    toast("Um moderador desconectou você da voz.");
  });
  /* seção 71: o moderador me levou para outro canal de voz */
  aoMudarTabela("voz_mover", (r, ev) => {
    if (ev !== "INSERT" || !r || r.user_id !== getApp().myUid || typeof r.sala !== "string") return;
    if (typeof r.em === "string" && Date.now() - Date.parse(r.em) > 60_000) return;
    const sala = getApp().salas.find((s) => s.id === r.sala);
    if (!sala || getApp().minhaSala === sala.id) return;
    entrarSala(sala.id);
    setTimeout(() => void entrarVoz(), 600);
    toast(`Um moderador levou você para ${sala.nome}.`);
  });
}

/**
 * Moderador: silencia e/ou ensurdece alguém na voz para todos. Ensurdecido também fica mudo, como no Discord.
 * A linha é trocada inteira (apaga e grava de novo), porque o site não pode editar linhas dessa tabela.
 */
async function gravarMod(userId: string, mudo: boolean, surdo: boolean) {
  const del = await sb().from("voz_silenciados").delete().eq("user_id", userId);
  if (del.error) return toast("Só os moderadores podem fazer isso.");
  if (mudo || surdo) {
    const { error } = await sb().from("voz_silenciados").insert(surdo ? { user_id: userId, surdo: true } : { user_id: userId });
    if (error && error.code !== "23505") {
      void carregar();
      return toast(surdo ? "Para ensurdecer para todos, rode o SQL novo (seção 71) no Supabase." : "Só os moderadores podem fazer isso.");
    }
  }
  void carregar();
}
export async function silenciarParaTodos(userId: string, sim: boolean) {
  const surdo = useVozMod.getState().surdos.includes(userId);
  await gravarMod(userId, sim || surdo, sim && surdo);
  toast(sim ? "Silenciado para todos na voz" : "Microfone liberado");
}
export async function ensurdecerParaTodos(userId: string, sim: boolean) {
  const mudo = useVozMod.getState().silenciados.includes(userId);
  await gravarMod(userId, sim || mudo, sim);
  toast(sim ? "Ensurdecido para todos na voz" : "Som liberado");
}

/** Moderador: castigo de alguns minutos (sem chat e sem voz), ou tira o castigo com 0 (seção 71). */
export async function castigar(userId: string, minutos: number) {
  const del = await sb().from("castigos").delete().eq("user_id", userId);
  if (del.error) return toast(/does not exist|relation/i.test(del.error.message) ? "Para o castigo, rode o SQL novo (seção 71) no Supabase." : "Só os moderadores podem fazer isso.");
  if (minutos > 0) {
    const { error } = await sb().from("castigos").insert({ user_id: userId, ate: new Date(Date.now() + minutos * 60_000).toISOString() });
    if (error) return toast("Só os moderadores podem fazer isso.");
  }
  void carregarCastigos();
  toast(minutos > 0 ? "De castigo" : "Castigo tirado");
}

/** Moderador: leva alguém para outro canal de voz (seção 71). */
export async function moverParaCanal(userId: string, sala: string) {
  const { error } = await sb().from("voz_mover").insert({ user_id: userId, sala });
  if (error) return toast(/does not exist|relation/i.test(error.message) ? "Para mover de canal, rode o SQL novo (seção 71) no Supabase." : "Só os moderadores podem fazer isso.");
  toast("Movido de canal");
}

/** Moderador: tira alguém da call. */
export async function desconectarDaVoz(userId: string) {
  const { error } = await sb().from("voz_desconectar").insert({ user_id: userId });
  if (error) return toast("Só os moderadores podem fazer isso.");
  toast("Desconectado da voz");
}
