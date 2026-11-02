/*
 * Sequência de dias e tempo online de cada nanico (fase 26). O banco calcula tudo (presenca_de e
 * presenca_todos); as tabelas de bônus e de tempo continuam fechadas. Sem o SQL, tudo fica escondido.
 */
import { create } from "zustand";
import { sb } from "@/lib/supabase";

export type DiaOnline = { dia: string; min: number };
export type Presenca = { seq: number; pegouHoje: boolean; recorde: number; hojeMin: number; semana: DiaOnline[]; totalMin: number };
export type Chama = { seq: number; hojeMin: number };

type Estado = {
  /** resumo completo de quem teve a ficha aberta */
  de: Record<string, Presenca>;
  /** só a sequência e os minutos de hoje dos 14 (null = não carregou ou SQL não rodou) */
  todos: Record<string, Chama> | null;
};

export const usePresenca = create<Estado>()(() => ({ de: {}, todos: null }));

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Confere a resposta do banco antes de mostrar. */
export function lerPresenca(d: unknown): Presenca | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const semana = (Array.isArray(o.semana) ? o.semana : [])
    .slice(0, 7)
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .filter((x) => typeof x.dia === "string" && DIA.test(x.dia))
    .map((x) => ({ dia: x.dia as string, min: num(x.min) }));
  return { seq: num(o.seq), pegouHoje: o.pegou_hoje === true, recorde: num(o.recorde), hojeMin: num(o.hoje_min), semana, totalMin: num(o.total_min) };
}

export function lerTodosPresenca(d: unknown): Record<string, Chama> {
  const out: Record<string, Chama> = {};
  if (!d || typeof d !== "object") return out;
  for (const [fid, v] of Object.entries(d as Record<string, unknown>)) {
    if (v && typeof v === "object") out[fid] = { seq: num((v as Record<string, unknown>).seq), hojeMin: num((v as Record<string, unknown>).hoje_min) };
  }
  return out;
}

/** Resumo de um nanico (ao abrir a ficha e a cada 2 min com ela aberta). */
export async function carregarPresenca(fid: string) {
  const { data, error } = await sb().rpc("presenca_de", { p_friend: fid });
  if (error) return;
  const p = lerPresenca(data);
  if (p) usePresenca.setState((s) => ({ de: { ...s.de, [fid]: p } }));
}

let pedindo = false;
let ultimo = 0;
/** Chama dos 14 de uma vez (no máximo uma chamada a cada 5 min). */
export async function carregarPresencaTodos() {
  if (pedindo || Date.now() - ultimo < 5 * 60_000) return;
  pedindo = true;
  ultimo = Date.now();
  try {
    const { data, error } = await sb().rpc("presenca_todos");
    if (!error) usePresenca.setState({ todos: lerTodosPresenca(data) });
  } finally {
    pedindo = false;
  }
}
