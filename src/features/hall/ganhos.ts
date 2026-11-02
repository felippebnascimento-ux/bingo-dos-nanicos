/*
 * Ganhos de moedas de todo mundo, para o canto do Sítio. Vêm do banco: o tempo real da tabela carteiras
 * traz o último ganho de cada um (ultimo_valor, ultimo_motivo, ultimo_em), gravado por creditar().
 * Nada disso vem de broadcast, então ninguém consegue forjar um aviso.
 */
import { create } from "zustand";
import { ajustarSaldo } from "@/lib/carteira";
import { aoMudarTabela } from "@/lib/sala";
import { getApp } from "@/lib/store";

export type Ganho = { userId: string; valor: number; motivo: string; em: number; saldo: number };
export type Aviso = {
  id: number;
  /** nanico (para o rosto); null quando junta vários */
  fid: string | null;
  nome: string;
  valor: number;
  motivo: string;
  eu: boolean;
  /** quantos nanicos entraram num aviso juntado de tempo online */
  pessoas?: number;
  /** aviso que não é de moedas (zoeira): o texto pronto */
  texto?: string;
};

const UUID = /^[0-9a-f-]{36}$/i;
const MOTIVO = /^[a-z]{2,12}$/;

/** Confere a linha da carteira vinda do tempo real. Devolve null se não for um ganho novo e válido. */
export function lerGanho(row: Record<string, unknown> | null): Ganho | null {
  if (!row || typeof row.user_id !== "string" || !UUID.test(row.user_id)) return null;
  const valor = row.ultimo_valor;
  const em = Date.parse(String(row.ultimo_em ?? ""));
  if (typeof valor !== "number" || !Number.isInteger(valor) || !em) return null;
  const motivo = typeof row.ultimo_motivo === "string" && MOTIVO.test(row.ultimo_motivo) ? row.ultimo_motivo : "";
  const saldo = typeof row.saldo === "number" && Number.isFinite(row.saldo) ? row.saldo : 0;
  return { userId: row.user_id, valor, motivo, em, saldo };
}

/** Junta os ganhos de tempo online dos outros num aviso só ("+3 moedas de tempo online para 3 nanicos"). */
export function juntarOnline(ganhos: readonly { fid: string | null; nome: string; valor: number }[]) {
  if (!ganhos.length) return null;
  const pessoas = new Set(ganhos.map((g) => g.fid ?? g.nome)).size;
  const valor = ganhos.reduce((s, g) => s + g.valor, 0);
  if (pessoas === 1) return { fid: ganhos[0].fid, nome: ganhos[0].nome, valor, pessoas: 1 };
  return { fid: null, nome: `${pessoas} nanicos`, valor, pessoas };
}

/* ---------- estado ---------- */
export const useGanhos = create<{ avisos: Aviso[] }>()(() => ({ avisos: [] }));
const MAX = 3;
const DURA_MS = 5000;
const JUNTA_MS = 60_000;
let seq = 0;

function mostrar(a: Omit<Aviso, "id">) {
  const aviso = { ...a, id: ++seq };
  useGanhos.setState((s) => ({ avisos: [aviso, ...s.avisos].slice(0, MAX) }));
  setTimeout(() => useGanhos.setState((s) => ({ avisos: s.avisos.filter((x) => x.id !== aviso.id) })), DURA_MS);
}

/* último ganho já mostrado de cada um (o mesmo update pode chegar duas vezes) */
const visto = new Map<string, number>();
let fila: { fid: string | null; nome: string; valor: number }[] = [];
let timerFila: ReturnType<typeof setTimeout> | undefined;

function soltarFila() {
  timerFila = undefined;
  const j = juntarOnline(fila);
  fila = [];
  if (j) mostrar({ ...j, motivo: "online", eu: false });
}

function onCarteira(row: Record<string, unknown> | null) {
  const g = lerGanho(row);
  if (!g || (visto.get(g.userId) ?? 0) >= g.em) return;
  visto.set(g.userId, g.em);
  const s = getApp();
  const eu = g.userId === s.myUid;
  if (eu) ajustarSaldo(g.saldo);
  /* gastos (valor negativo) não aparecem para os outros */
  if (g.valor <= 0) return;
  const f = s.friends.find((x) => x.user_id === g.userId);
  const nome = eu ? "Você" : f?.name || "Alguém";
  /* tempo online dos outros: no máximo um aviso por minuto, juntando todo mundo */
  if (!eu && g.motivo === "online") {
    fila.push({ fid: f?.id ?? null, nome, valor: g.valor });
    if (!timerFila) timerFila = setTimeout(soltarFila, JUNTA_MS);
    return;
  }
  mostrar({ fid: f?.id ?? null, nome, valor: g.valor, motivo: g.motivo, eu });
}

/** Aviso de zoeira no mesmo canto ("Gamer deu uma chinelada no Max"). */
export const avisarZoeira = (fid: string | null, texto: string) => mostrar({ fid, nome: "", valor: 0, motivo: "zoeira", eu: false, texto });
/** Aviso só com texto no mesmo canto ("Pitoco acendeu um cigarrinho"). */
export const avisarTexto = (fid: string | null, texto: string) => mostrar({ fid, nome: "", valor: 0, motivo: "", eu: false, texto });

let ligado = false;
/** Começa a ouvir as carteiras (uma vez só). */
export function iniciarGanhos() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("carteiras", onCarteira);
}
