/*
 * Emblemas e respeitos (seção 27 do seguranca.sql). Os emblemas de cada nanico vêm de emblemas_de (calculados no
 * banco; guardados 2 min aqui). Os respeitos são públicos: o site lê quantos cada um recebeu e o tempo real da
 * tabela respeitos mantém a conta e avisa no Sítio ("Gamer deu um respeito para o Max"). Dar respeito só por
 * dar_respeito(), que confere os 3 por dia.
 */
import { create } from "zustand";
import { avisarTexto } from "@/features/hall/ganhos";
import { aoMudarTabela } from "@/lib/sala";
import { getApp } from "@/lib/store";
import { errMsg, sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { lerEmblemas, type Emblema } from "./emblemas";

type Estado = {
  emblemas: Record<string, { lista: Emblema[]; em: number }>;
  /** respeitos recebidos por nanico (null = ainda não leu) */
  recebidos: Record<string, number> | null;
  /** quantos ainda posso dar hoje (null = não sei) */
  restantes: number | null;
  dando: boolean;
};
export const useEmblemas = create<Estado>()(() => ({ emblemas: {}, recebidos: null, restantes: null, dando: false }));

const UUID = /^[0-9a-f-]{36}$/i;
const pedindo = new Set<string>();

/** Lê os emblemas de um nanico (de novo só depois de 2 min). */
export async function carregarEmblemas(fid: string, forcar = false) {
  const tem = useEmblemas.getState().emblemas[fid];
  if (!UUID.test(fid) || pedindo.has(fid) || (!forcar && tem && Date.now() - tem.em < 120_000)) return;
  pedindo.add(fid);
  try {
    const { data, error } = await sb().rpc("emblemas_de", { p_para: fid });
    if (error) throw error;
    useEmblemas.setState((s) => ({ emblemas: { ...s.emblemas, [fid]: { lista: lerEmblemas(data), em: Date.now() } } }));
  } catch (e) {
    console.warn("emblemas indisponíveis", e);
  } finally {
    pedindo.delete(fid);
  }
}

async function lerRespeitos() {
  const [todos, meus] = await Promise.all([sb().from("respeitos").select("para"), sb().rpc("meus_respeitos")]);
  if (todos.error) return console.warn("respeitos indisponíveis", todos.error.message);
  const recebidos: Record<string, number> = {};
  for (const r of todos.data ?? []) recebidos[String(r.para)] = (recebidos[String(r.para)] ?? 0) + 1;
  useEmblemas.setState({ recebidos, restantes: typeof meus.data === "number" ? meus.data : null });
}

function onRespeito(row: Record<string, unknown> | null, ev: string) {
  if (ev !== "INSERT" || !row || typeof row.de !== "string" || typeof row.para !== "string" || !UUID.test(row.para)) return;
  const para = row.para, de = row.de;
  useEmblemas.setState((s) => (s.recebidos ? { recebidos: { ...s.recebidos, [para]: (s.recebidos[para] ?? 0) + 1 } } : {}));
  const { friends, myFid } = getApp();
  const nome = (id: string) => (id === myFid ? "você" : friends.find((f) => f.id === id)?.name ?? "alguém");
  const quem = de === myFid ? "Você" : friends.find((f) => f.id === de)?.name ?? "Alguém";
  avisarTexto(de, `${quem} deu um respeito para ${nome(para)}`);
  if (para === myFid) toast(`${quem} te deu um respeito`);
}

let ligado = false;
/** Liga os respeitos (uma vez, depois do login). */
export function iniciarRespeitos() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("respeitos", onRespeito);
  void lerRespeitos();
}

export async function darRespeito(fid: string) {
  if (useEmblemas.getState().dando) return;
  useEmblemas.setState({ dando: true });
  try {
    const { data, error } = await sb().rpc("dar_respeito", { p_para: fid });
    if (error) {
      const m = error as { code?: string; message?: string };
      toast(m.code === "P0001" && m.message ? m.message.slice(0, 140) : errMsg(error, "Não deu para dar o respeito."));
      return;
    }
    const r = data as { restantes?: unknown };
    useEmblemas.setState({ restantes: typeof r?.restantes === "number" ? r.restantes : null });
  } finally {
    useEmblemas.setState({ dando: false });
  }
}
