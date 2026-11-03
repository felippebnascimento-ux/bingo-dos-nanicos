/*
 * Navegador de quartos (como o do Habbo): a lista dos quartos de todo mundo, com quem está em cada um agora (pela
 * presença) e as curtidas (seção 57: quarto_curtidas pelo tempo real; só curtir_quarto grava).
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";

type Curtida = { dono: string; quem: string };
export const useCurtidas = create<{ lista: Curtida[]; aberto: boolean }>()(() => ({ lista: [], aberto: false }));

async function carregar() {
  const { data, error } = await sb().from("quarto_curtidas").select("dono,quem").limit(5000);
  if (error) return;
  useCurtidas.setState({ lista: (data || []).flatMap((r) => (typeof r.dono === "string" && typeof r.quem === "string" ? [{ dono: r.dono, quem: r.quem }] : [])) });
}

let ligado = false;
let timer: ReturnType<typeof setTimeout> | undefined;
export function iniciarCurtidas() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("quarto_curtidas", () => {
    clearTimeout(timer);
    timer = setTimeout(() => void carregar(), 300);
  });
  void carregar();
}

/** Curte ou descurte o quarto de um nanico (friend id). */
export async function curtirQuarto(fid: string, ligar: boolean) {
  const { error } = await sb().rpc("curtir_quarto", { p_dono: fid, p_ligar: ligar });
  if (error) toast(error.message?.slice(0, 160) || "Não deu. Tente de novo.");
  else void carregar();
}

export type LinhaNavegador = { uid: string; fid: string; nome: string; tamanho: number; agora: number; curtidas: number };

/** As linhas do navegador, na ordem pedida: com mais gente agora, ou mais curtidos (puro). */
export function ordenarQuartos(linhas: readonly LinhaNavegador[], por: "gente" | "curtidas"): LinhaNavegador[] {
  return [...linhas].sort((a, b) =>
    por === "gente" ? b.agora - a.agora || b.curtidas - a.curtidas || a.nome.localeCompare(b.nome) : b.curtidas - a.curtidas || b.agora - a.agora || a.nome.localeCompare(b.nome),
  );
}
