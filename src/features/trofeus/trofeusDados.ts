/*
 * Troféus da semana: lê o pódio das últimas 8 semanas e o hall da fama, e pede à função riot-semana
 * para calcular a semana anterior quando ela ainda não está pronta (o banco garante que só uma pessoa
 * calcula; as outras esperam e leem de novo). Sem SQL ou sem ninguém com op.gg, tudo fica escondido.
 */
import { create } from "zustand";
import { sb } from "@/lib/supabase";
import type { LinhaTrofeu, TrofeuId } from "./trofeus";

type Estado = {
  /** pódios das últimas semanas (null = não carregou ou o SQL não rodou) */
  linhas: LinhaTrofeu[] | null;
  /** fid → troféu → vezes em 1º */
  fama: Record<string, Partial<Record<TrofeuId, number>>>;
  /** a semana anterior está sendo calculada agora */
  calculando: boolean;
};

export const useTrofeus = create<Estado>()(() => ({ linhas: null, fama: {}, calculando: false }));

const IDS = new Set(["feeder", "turista", "piano", "viciado", "sumido"]);
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Confere as linhas vindas do banco. */
export function lerLinhas(rows: unknown): LinhaTrofeu[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}))
    .filter((r) => typeof r.semana === "string" && DIA.test(r.semana) && typeof r.trofeu === "string" && IDS.has(r.trofeu) && typeof r.friend_id === "string")
    .map((r) => ({
      semana: r.semana as string,
      trofeu: r.trofeu as TrofeuId,
      posicao: Number(r.posicao) || 0,
      fid: r.friend_id as string,
      valor: Number(r.valor) || 0,
      partidas: Number(r.partidas) || 0,
    }));
}

async function lerDoBanco() {
  const desde = new Date(Date.now() - 9 * 7 * 86400 * 1000).toISOString().slice(0, 10);
  const { data, error } = await sb().from("trofeus_semana").select("semana,trofeu,posicao,friend_id,valor,partidas").gte("semana", desde).order("semana", { ascending: false });
  if (error) return false;
  useTrofeus.setState({ linhas: lerLinhas(data) });
  const { data: fama } = await sb().rpc("hall_da_fama");
  if (fama && typeof fama === "object") useTrofeus.setState({ fama: fama as Estado["fama"] });
  return true;
}

let tentativas = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Pede o cálculo da semana anterior; enquanto estiver "calculando", tenta de novo a cada 2,5 min (até 12 vezes). */
async function pedirCalculo() {
  clearTimeout(timer);
  try {
    const { data, error } = await sb().functions.invoke("riot-semana", { body: {} });
    if (error) throw error;
    const estado = (data as { estado?: string } | null)?.estado;
    if (estado === "pronta") {
      useTrofeus.setState({ calculando: false });
      await lerDoBanco();
      return;
    }
    if (estado === "calculando" && ++tentativas <= 12) {
      useTrofeus.setState({ calculando: true });
      timer = setTimeout(pedirCalculo, 150_000);
      return;
    }
    useTrofeus.setState({ calculando: false });
  } catch (e) {
    console.warn("troféus indisponíveis", e);
    useTrofeus.setState({ calculando: false });
  }
}

let ligado = false;
/** Ao entrar no site: lê os troféus e, se a semana anterior ainda não estiver pronta, pede o cálculo. */
export async function iniciarTrofeus() {
  if (ligado) return;
  ligado = true;
  if (!(await lerDoBanco())) return;
  const { data: meta } = await sb().from("riot_semana_meta").select("semana,estado").order("semana", { ascending: false }).limit(1).maybeSingle();
  /* segunda da semana anterior, em Brasília (a mesma conta da função) */
  const br = new Date(Date.now() - 3 * 3600 * 1000);
  const segunda = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() - ((br.getUTCDay() + 6) % 7) - 7)).toISOString().slice(0, 10);
  const pronta = (meta as { semana?: string; estado?: string } | null)?.semana === segunda && (meta as { estado?: string }).estado === "pronta";
  if (!pronta) pedirCalculo();
}
