/*
 * Mural do K-FOFO (seção 49): recados livres dos nanicos (tabela mural_recados, pelo tempo real) e avisos automáticos
 * montados aqui com o que já existe (hall da fama, banca, eventos, mais rico). `avisosDoMural` é puro e testado.
 */
import { create } from "zustand";
import { eventoAgora, horaBr, HAPPY_INI, CHURRASCO_INI } from "@/lib/eventos";
import { formatarMoedas } from "@/lib/moedas";
import { aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { podio, type LinhaTrofeu } from "@/features/trofeus/trofeus";

export const CORES_RECADO = ["amarelo", "rosa", "azul", "verde"] as const;
export type CorRecado = (typeof CORES_RECADO)[number];
export type Recado = { id: number; userId: string; texto: string; cor: CorRecado; em: string };
export type Aviso = { id: string; tipo: "fama" | "banca" | "evento" | "rico"; texto: string };

export const useMural = create<{ recados: Recado[]; aberto: boolean; ok: boolean | null }>()(() => ({ recados: [], aberto: false, ok: null }));

/** Confere uma linha do banco. */
export function lerRecado(r: unknown): Recado | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.user_id !== "string" || typeof o.texto !== "string" || typeof o.em !== "string") return null;
  const cor = CORES_RECADO.includes(o.cor as CorRecado) ? (o.cor as CorRecado) : "amarelo";
  return { id: o.id, userId: o.user_id, texto: o.texto.slice(0, 200), cor, em: o.em };
}

/**
 * Os avisos automáticos do mural (puro): os campeões da última semana do hall da fama, a Banca Nanica, o próximo
 * evento (happy hour e churrasco, na hora de Brasília) e o mais rico agora.
 */
export function avisosDoMural(x: {
  linhas: readonly LinhaTrofeu[] | null;
  nome: (fid: string) => string | null;
  banca: number | null;
  maisRico: { nome: string; saldo: number } | null;
  agora: Date;
}): Aviso[] {
  const out: Aviso[] = [];
  const semana = x.linhas?.length ? [...x.linhas].sort((a, b) => (a.semana < b.semana ? 1 : -1))[0].semana : null;
  if (x.linhas && semana) {
    const quem = (t: LinhaTrofeu["trofeu"]) => {
      const p = podio(x.linhas!, t, semana)[0];
      return p ? x.nome(p.fid) : null;
    };
    const partes = [
      quem("lol_vitorias") && `LoL: ${quem("lol_vitorias")} venceu mais`,
      quem("cs_vitorias") && `CS2: ${quem("cs_vitorias")} venceu mais`,
      quem("lol_kda") && `melhor KDA no LoL: ${quem("lol_kda")}`,
    ].filter(Boolean);
    if (partes.length) out.push({ id: "fama", tipo: "fama", texto: `Hall da Fama da semana: ${partes.join(" · ")}` });
  }
  if (x.banca !== null) out.push({ id: "banca", tipo: "banca", texto: `A Banca Nanica já tem ${formatarMoedas(x.banca)} moedas do cassino` });
  const ev = eventoAgora(x.agora);
  const h = horaBr(x.agora);
  if (ev === "happy") out.push({ id: "evento", tipo: "evento", texto: "Happy hour agora: o tempo no site paga em dobro até a meia-noite" });
  else if (ev === "churrasco") out.push({ id: "evento", tipo: "evento", texto: "Churrasco agora: pegue seu espetinho na churrasqueira até as 23h" });
  else if (h.dow === 6 && h.h < CHURRASCO_INI) out.push({ id: "evento", tipo: "evento", texto: `Hoje tem churrasco às ${CHURRASCO_INI}h no K-FOFO` });
  else out.push({ id: "evento", tipo: "evento", texto: `Happy hour hoje às ${HAPPY_INI}h: o tempo no site paga em dobro` });
  if (x.maisRico) out.push({ id: "rico", tipo: "rico", texto: `Mais rico agora: ${x.maisRico.nome}, com ${formatarMoedas(x.maisRico.saldo)} moedas` });
  return out;
}

let ligado = false;
/** Lê os últimos 40 recados e acompanha os novos e os apagados. */
export async function iniciarMural() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("mural_recados", (row, ev) => {
    if (ev === "DELETE") {
      const id = row?.id;
      useMural.setState((s) => ({ recados: s.recados.filter((r) => r.id !== id) }));
      return;
    }
    const r = lerRecado(row);
    if (r) useMural.setState((s) => ({ recados: [r, ...s.recados.filter((x) => x.id !== r.id)].slice(0, 40) }));
  });
  const { data, error } = await sb().from("mural_recados").select("id,user_id,texto,cor,em").order("em", { ascending: false }).limit(40);
  if (error) {
    useMural.setState({ ok: false });
    return;
  }
  useMural.setState({ ok: true, recados: (data ?? []).map(lerRecado).filter((r): r is Recado => !!r) });
}

/** Prega um recado no mural (o banco põe o autor e limita 10 por hora). */
export async function pregarRecado(texto: string, cor: CorRecado): Promise<boolean> {
  const t = texto.trim();
  if (!t) return false;
  const { data, error } = await sb().from("mural_recados").insert({ texto: t.slice(0, 200), cor }).select("id,user_id,texto,cor,em").maybeSingle();
  if (error) {
    toast(errMsg(error, "Não deu para pregar o recado. Tente de novo."));
    return false;
  }
  const r = lerRecado(data);
  if (r) useMural.setState((s) => ({ recados: [r, ...s.recados.filter((x) => x.id !== r.id)].slice(0, 40) }));
  return true;
}

export async function tirarRecado(id: number) {
  const { error } = await sb().from("mural_recados").delete().eq("id", id);
  if (error) return toast("Não deu para tirar o recado agora.");
  useMural.setState((s) => ({ recados: s.recados.filter((r) => r.id !== id) }));
}

export const abrirMural = () => {
  void iniciarMural();
  useMural.setState({ aberto: true });
};
