/*
 * Roleta do rodízio da minha sala de LoL: lê a linha da tabela `rodizio`, acompanha pelo tempo real e
 * chama as funções do banco (que sorteiam e trocam a escalação). A animação começa quando chega um
 * `girado_em` novo: todo mundo gira junto até o mesmo nome. Sem o SQL, tudo fica escondido.
 */
import { create } from "zustand";
import { aoConectar, aoMudarTabela } from "@/lib/sala";
import { getApp, salaLol, useApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { reduzMovimento } from "@/lib/util";
import { anguloFinal, candidatos } from "./rodizio";

export type Rodizio = {
  sala: string;
  fila: string[];
  rodada: number;
  jaEntraram: string[];
  sorteado: string | null;
  sorteadoPor: string | null;
  giradoEm: string | null;
  giro: number | null;
  trocas: number;
  noTime: Record<string, number>;
};

type Estado = {
  /** null = não carregou, sem sala de LoL ou SQL não rodou */
  r: Rodizio | null;
  /** giro atual da roda, em graus (só cresce) */
  angulo: number;
  /** a roda está girando (o resultado só aparece quando para) */
  girando: boolean;
  /** fatias congeladas durante o giro (a fila pode mudar no meio) */
  fatias: string[] | null;
  ocupado: boolean;
};

export const useRodizio = create<Estado>()(() => ({ r: null, angulo: 0, girando: false, fatias: null, ocupado: false }));

export const GIRO_MS = 4200;
const UUID = /^[0-9a-f-]{36}$/i;
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 30) : []);
const int = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : d);

/** Confere a linha vinda do banco ou do tempo real. */
export function lerRodizio(row: Record<string, unknown> | null): Rodizio | null {
  if (!row || typeof row.sala !== "string") return null;
  const noTime: Record<string, number> = {};
  if (row.no_time && typeof row.no_time === "object")
    for (const [k, v] of Object.entries(row.no_time as Record<string, unknown>)) if (UUID.test(k) && typeof v === "number") noTime[k] = Math.trunc(v);
  const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
  return {
    sala: row.sala,
    fila: ids(row.fila),
    rodada: Math.max(1, int(row.rodada, 1)),
    jaEntraram: ids(row.ja_entraram),
    sorteado: uuid(row.sorteado),
    sorteadoPor: uuid(row.sorteado_por),
    giradoEm: typeof row.girado_em === "string" ? row.girado_em : null,
    giro: row.giro === null ? null : int(row.giro),
    trocas: Math.max(0, int(row.trocas)),
    noTime,
  };
}

const nomes = () => Object.fromEntries(getApp().friends.map((f) => [f.id, f.name]));

/** Para onde a roda vai para mostrar o sorteado (sempre para a frente, com `voltas` voltas). */
function anguloPara(r: Rodizio, fatias: string[], atual: number, voltas: number) {
  const i = r.sorteado ? fatias.indexOf(r.sorteado) : -1;
  if (i < 0) return atual;
  const alvo = anguloFinal(i, fatias.length, 0) % 360;
  const agora = ((atual % 360) + 360) % 360;
  return atual + ((alvo - agora + 360) % 360) + 360 * voltas;
}

let fimGiro: ReturnType<typeof setTimeout> | undefined;

/** Linha nova: se for um sorteio novo, gira; se for a primeira leitura, já mostra a roda parada no sorteado. */
function aplicar(novo: Rodizio, primeira: boolean) {
  const { r: velho, angulo } = useRodizio.getState();
  const sorteioNovo = !!novo.sorteado && novo.giradoEm !== velho?.giradoEm;
  if (!sorteioNovo) return useRodizio.setState({ r: novo });
  const fatias = candidatos(novo.fila, novo.jaEntraram, nomes());
  if (primeira || reduzMovimento()) {
    useRodizio.setState({ r: novo, angulo: anguloPara(novo, fatias, angulo, 0), girando: false, fatias: null });
    return;
  }
  clearTimeout(fimGiro);
  useRodizio.setState({ r: novo, angulo: anguloPara(novo, fatias, angulo, 5), girando: true, fatias });
  fimGiro = setTimeout(() => useRodizio.setState({ girando: false, fatias: null }), GIRO_MS);
}

let salaAtual: string | null = null;
let ligado = false;

/** Carrega a roleta da minha sala de LoL (e de novo quando troco de sala ou a conexão volta). */
export async function carregarRodizio(forcar = false) {
  if (!ligado) {
    ligado = true;
    aoMudarTabela("rodizio", (row) => {
      const r = lerRodizio(row);
      if (r && r.sala === salaAtual) aplicar(r, false);
    });
    useApp.subscribe((s, p) => {
      if (s.minhaSala !== p.minhaSala || s.salas !== p.salas) carregarRodizio();
    });
    /* a conexão caiu e voltou: alguma mudança pode ter passado; lê a linha de novo */
    aoConectar(() => carregarRodizio(true));
  }
  const sala = salaLol()?.id ?? null;
  if (sala === salaAtual && useRodizio.getState().r && !forcar) return;
  if (sala !== salaAtual) useRodizio.setState({ r: null, girando: false, fatias: null });
  salaAtual = sala;
  if (!sala) return;
  const { data, error } = await sb().from("rodizio").select("*").eq("sala", sala).maybeSingle();
  if (error || salaAtual !== sala) return;
  const r = lerRodizio(data as Record<string, unknown> | null);
  if (r) aplicar(r, true);
  /* sala de LoL nova, ainda sem linha: mostra vazia (a primeira ação cria a linha) */ else
    useRodizio.setState({ r: { sala, fila: [], rodada: 1, jaEntraram: [], sorteado: null, sorteadoPor: null, giradoEm: null, giro: null, trocas: 0, noTime: {} } });
}

/** Erro das funções do banco: as nossas mensagens (P0001) vão direto para a tela. */
function avisarErro(e: unknown) {
  const o = (e || {}) as { code?: string; message?: string };
  toast(o.code === "P0001" && o.message ? o.message.slice(0, 140) : "Não deu para mexer no rodízio agora. Confira a internet.");
}

async function chamar(fn: string, args: Record<string, unknown>) {
  if (!salaAtual || useRodizio.getState().ocupado) return false;
  useRodizio.setState({ ocupado: true });
  try {
    const { error } = await sb().rpc(fn, { p_sala: salaAtual, ...args });
    if (error) throw error;
    return true;
  } catch (e) {
    avisarErro(e);
    return false;
  } finally {
    useRodizio.setState({ ocupado: false });
  }
}

export const filaEntrar = (fid: string) => chamar("rodizio_fila", { p_friend: fid, p_entra: true });
export const filaSair = (fid: string) => chamar("rodizio_fila", { p_friend: fid, p_entra: false });
export const girar = () => chamar("rodizio_girar", {});
export const colocar = (rota: number) => chamar("rodizio_colocar", { p_rota: rota });
export const desistir = () => chamar("rodizio_desistir", {});
