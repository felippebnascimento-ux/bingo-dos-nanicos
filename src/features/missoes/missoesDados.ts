/*
 * Missões do dia (seção 23 do seguranca.sql). Quem sorteia, conta e paga é o banco: minhas_missoes() recalcula o
 * progresso a partir do que aconteceu hoje (chat, nanicadas, zoeira, truco, bingo, roleta, tempo online) e paga
 * na hora em que uma completa. O site só pergunta: ao entrar, a cada 2 min e logo depois das ações que contam
 * (as mudanças dessas tabelas chegam pelo tempo real). Sem o SQL, o cartão não aparece.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";

export type Missao = { id: string; texto: string; meta: number; valor: number; progresso: number; feita: boolean };
export type MissoesEstado = {
  /** null = ainda não sei se o SQL existe; false = não existe (o cartão some) */
  ok: boolean | null;
  missoes: Missao[];
  bonus: number;
  bonusPago: boolean;
  /** missões que acabaram de completar (o cartão mostra "Missão feita!" por alguns segundos) */
  novas: string[];
};

export const useMissoes = create<MissoesEstado>()(() => ({ ok: null, missoes: [], bonus: 25, bonusPago: false, novas: [] }));

const ID = /^[a-z0-9_]{2,20}$/;
const int = (x: unknown, min: number, max: number) => (typeof x === "number" && Number.isInteger(x) && x >= min && x <= max ? x : null);

/** Confere a resposta de minhas_missoes() (o formato que a tela espera). */
export function lerMissoes(d: unknown): { missoes: Missao[]; bonus: number; bonusPago: boolean } | null {
  if (!d || typeof d !== "object" || !Array.isArray((d as { missoes?: unknown }).missoes)) return null;
  const o = d as { missoes: unknown[]; bonus?: unknown; bonus_pago?: unknown };
  const missoes: Missao[] = [];
  for (const m of o.missoes.slice(0, 5)) {
    if (!m || typeof m !== "object") continue;
    const x = m as Record<string, unknown>;
    const meta = int(x.meta, 1, 600), valor = int(x.valor, 1, 100), prog = int(x.progresso, 0, 600);
    if (typeof x.id !== "string" || !ID.test(x.id) || typeof x.texto !== "string" || meta === null || valor === null || prog === null) continue;
    missoes.push({ id: x.id, texto: x.texto.slice(0, 80), meta, valor, progresso: Math.min(prog, meta), feita: x.feita === true });
  }
  return { missoes, bonus: int(o.bonus, 0, 100) ?? 25, bonusPago: o.bonus_pago === true };
}

let ocupado = false, deNovo = false;
async function atualizar() {
  if (!getApp().myUid) return;
  if (ocupado) {
    deNovo = true;
    return;
  }
  ocupado = true;
  try {
    const { data, error } = await sb().rpc("minhas_missoes");
    if (error) {
      if (useMissoes.getState().ok !== false) console.warn("missões indisponíveis: rode a seção 23 do seguranca.sql", error.message);
      useMissoes.setState({ ok: false });
      return;
    }
    const r = lerMissoes(data);
    if (!r) return;
    const antes = useMissoes.getState();
    /* só comemora o que completou com o cartão já carregado (entrar no site não comemora) */
    const novas = antes.ok ? r.missoes.filter((m) => m.feita && antes.missoes.some((a) => a.id === m.id && !a.feita)).map((m) => m.id) : [];
    useMissoes.setState({ ok: true, ...r, novas });
    if (novas.length) setTimeout(() => useMissoes.setState({ novas: [] }), 4000);
  } catch (e) {
    console.warn("missões", e);
  } finally {
    ocupado = false;
    if (deNovo) {
      deNovo = false;
      void atualizar();
    }
  }
}

let tAcao: ReturnType<typeof setTimeout> | undefined;
/** Uma ação que pode contar aconteceu: pergunta de novo daqui a pouco (junta várias numa só). */
export function missoesDepois() {
  if (!useMissoes.getState().ok) return;
  clearTimeout(tAcao);
  tAcao = setTimeout(() => void atualizar(), 1500);
}

let ligado = false;
/** Liga as missões (uma vez, depois do login). */
export function iniciarMissoes() {
  if (ligado) return;
  ligado = true;
  void atualizar();
  setInterval(() => void atualizar(), 2 * 60_000);
  /* minhas mensagens, minhas nanicadas, zoeira comigo, roleta e ganhos (truco, bingo) contam: pergunta de novo */
  const s = () => getApp();
  aoMudarTabela("chat_messages", (row) => row?.user_id === s().myUid && missoesDepois());
  aoMudarTabela("phrases", () => missoesDepois());
  aoMudarTabela("zoeiras", (row) => (row?.de === s().myFid || row?.para === s().myFid) && missoesDepois());
  aoMudarTabela("rodizio", (row) => row?.sorteado_por === s().myUid && missoesDepois());
  aoMudarTabela("carteiras", (row) => row?.user_id === s().myUid && row?.ultimo_motivo !== "missao" && row?.ultimo_motivo !== "online" && missoesDepois());
}
