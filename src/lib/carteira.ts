/*
 * Carteira de moedas do nanico logado. Quem decide tudo é o banco (bater_ponto, pulso, minha_carteira):
 * aqui só pedimos e mostramos. Se o SQL das moedas ainda não rodou, tudo fica escondido.
 */
import { create } from "zustand";
import { textoBonus } from "./moedas";
import { sb } from "./supabase";
import { toast } from "./toast";

export type Carteira = { saldo: number; seq: number; pegouHoje: boolean; minutosHoje: number };
export type LinhaExtrato = { id: number; valor: number; motivo: string; ref: string | null; em: string };

export const useCarteira = create<{ carteira: Carteira | null; extrato: LinhaExtrato[] }>()(() => ({
  carteira: null,
  extrato: [],
}));

/** Pulso a cada minuto, mesmo com a aba escondida (decisão do grupo: o tempo conta assim mesmo). */
const PULSO_MS = 60_000;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);

/** Confere a resposta do banco antes de mostrar. */
function lerCarteira(d: unknown): Carteira | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  return { saldo: num(o.saldo), seq: num(o.seq), pegouHoje: o.pegou_hoje === true, minutosHoje: num(o.minutos_hoje) };
}

/** A função não existe no banco: o SQL das moedas ainda não rodou. */
const semSql = (e: { code?: string; message?: string }) => e.code === "PGRST202" || /could not find the function|does not exist/i.test(e.message || "");

let ligado = false;

async function chamar(fn: "bater_ponto" | "pulso" | "minha_carteira") {
  const { data, error } = await sb().rpc(fn);
  if (error) throw error;
  return data as Record<string, unknown>;
}

/** Bônus do dia (uma vez por login) e o pulso de cada minuto. Chamado por `enterApp`. */
export async function iniciarCarteira() {
  if (ligado) return;
  ligado = true;
  try {
    const r = await chamar("bater_ponto");
    useCarteira.setState({ carteira: lerCarteira(r) });
    const ganhou = num(r.ganhou);
    if (ganhou) toast(textoBonus(ganhou, num(r.bonus_extra), num(r.seq)));
    carregarExtrato();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (semSql(err)) {
      console.warn("Moedas desligadas: rode a seção 7 do supabase/sql/seguranca.sql.");
      return;
    }
    console.warn("Não deu para pegar o bônus do dia agora.", err.message);
  }
  setInterval(pulsar, PULSO_MS);
}

async function pulsar() {
  try {
    const antes = useCarteira.getState().carteira?.saldo;
    const c = lerCarteira(await chamar("pulso"));
    useCarteira.setState({ carteira: c });
    if (c && c.saldo !== antes) carregarExtrato();
  } catch {
    /* sem internet ou pulsos demais (várias abas): o próximo minuto tenta de novo */
  }
}

/** Últimas 30 linhas do meu extrato. */
export async function carregarExtrato() {
  const { data, error } = await sb().from("extrato").select("id,valor,motivo,ref,em").order("em", { ascending: false }).limit(30);
  if (!error && Array.isArray(data)) useCarteira.setState({ extrato: data as LinhaExtrato[] });
}
