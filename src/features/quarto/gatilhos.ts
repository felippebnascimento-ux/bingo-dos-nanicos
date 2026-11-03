/*
 * Gatilhos no quarto (seção 59, uma versão simples dos "wired" do Habbo): o dono monta regras QUANDO → ENTÃO e elas
 * rodam na tela de quem as dispara (o efeito é só para essa pessoa): entrar no quarto ou chegar num piso mostra um
 * aviso, toca a campainha ou leva a outro piso. O banco só guarda as regras (gatilho_criar / gatilho_apagar).
 */
import { create } from "zustand";
import { andarAte } from "@/features/hall/bonecos";
import { somDeChegada } from "@/features/live/sonsVoz";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { getApp, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

export type Gatilho = {
  id: number;
  dono: string;
  quando: "entra" | "pisa";
  piso: { i: number; j: number } | null;
  entao: "aviso" | "campainha" | "vai";
  texto: string | null;
  alvo: { i: number; j: number } | null;
};

const n = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 11 ? v : null);
export function lerGatilho(r: Record<string, unknown> | null): Gatilho | null {
  if (!r || typeof r.id !== "number" || typeof r.dono !== "string") return null;
  if (r.quando !== "entra" && r.quando !== "pisa") return null;
  if (r.entao !== "aviso" && r.entao !== "campainha" && r.entao !== "vai") return null;
  const piso = n(r.pi) !== null && n(r.pj) !== null ? { i: n(r.pi)!, j: n(r.pj)! } : null;
  const alvo = n(r.ai) !== null && n(r.aj) !== null ? { i: n(r.ai)!, j: n(r.aj)! } : null;
  if (r.quando === "pisa" && !piso) return null;
  if (r.entao === "vai" && !alvo) return null;
  return { id: r.id, dono: r.dono, quando: r.quando, piso, entao: r.entao, texto: typeof r.texto === "string" ? r.texto.slice(0, 80) : null, alvo };
}

/** As regras que um evento dispara no quarto de `dono` (puro): entrar, ou chegar no piso (i, j). */
export function disparadas(regras: readonly Gatilho[], dono: string, ev: { tipo: "entra" } | { tipo: "pisa"; i: number; j: number }): Gatilho[] {
  return regras.filter((g) => g.dono === dono && g.quando === ev.tipo && (ev.tipo === "entra" || (g.piso?.i === ev.i && g.piso?.j === ev.j)));
}

/** Como a regra aparece na lista do dono. */
export function descrever(g: Gatilho): string {
  const q = g.quando === "entra" ? "Quando alguém entra" : `Quando alguém pisa em ${g.piso!.i},${g.piso!.j}`;
  const e = g.entao === "aviso" ? `aparece "${g.texto}"` : g.entao === "campainha" ? "toca a campainha" : `vai para ${g.alvo!.i},${g.alvo!.j}`;
  return `${q}, ${e}`;
}

export const useGatilhos = create<{ lista: Gatilho[] }>()(() => ({ lista: [] }));

async function carregar() {
  const { data, error } = await sb().from("quarto_gatilhos").select("*").limit(1000);
  if (!error) useGatilhos.setState({ lista: (data || []).flatMap((r) => lerGatilho(r as Record<string, unknown>) ?? []) });
}

/* os efeitos na minha tela; um intervalo curto evita que um "vai" para um piso com outra regra entre em laço */
let ultimo = 0;
function executar(lista: readonly Gatilho[]) {
  const agora = Date.now();
  if (!lista.length || agora - ultimo < 800) return;
  ultimo = agora;
  for (const g of lista) {
    if (g.entao === "aviso" && g.texto) toast(`📜 ${g.texto}`);
    else if (g.entao === "campainha") somDeChegada(1);
    else if (g.entao === "vai" && g.alvo) andarAte(g.alvo);
  }
}

/** O user_id do dono do quarto onde estou (null fora de um quarto próprio). */
function donoAqui(): string | null {
  const s = getApp();
  if (!s.meuQuarto) return null;
  return s.friends.find((f) => f.id === s.meuQuarto)?.user_id ?? null;
}

let ligado = false;
export function iniciarGatilhos() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("quarto_gatilhos", () => void carregar());
  void carregar();
  useApp.subscribe((s, p) => {
    const dono = donoAqui();
    if (!dono) return;
    const regras = useGatilhos.getState().lista;
    if (s.meuQuarto !== p.meuQuarto) return executar(disparadas(regras, dono, { tipo: "entra" }));
    const a = s.hallPos, b = p.hallPos;
    if (a && (!b || a.i !== b.i || a.j !== b.j)) executar(disparadas(regras, dono, { tipo: "pisa", i: a.i, j: a.j }));
  });
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const { error } = await sb().rpc(fn, args);
  if (error) toast(error.message?.slice(0, 160) || "Não deu. Tente de novo.");
  else void carregar();
  return !error;
}
export const criarGatilho = (g: Omit<Gatilho, "id" | "dono">) =>
  rpc("gatilho_criar", { p_quando: g.quando, p_pi: g.piso?.i ?? null, p_pj: g.piso?.j ?? null, p_entao: g.entao, p_texto: g.texto, p_ai: g.alvo?.i ?? null, p_aj: g.alvo?.j ?? null });
export const apagarGatilho = (id: number) => rpc("gatilho_apagar", { p_id: id });
