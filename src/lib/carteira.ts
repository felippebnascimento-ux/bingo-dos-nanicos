/*
 * Carteira de moedas do nanico logado. Quem decide tudo é o banco (bater_ponto, pulso, minha_carteira):
 * aqui só pedimos e mostramos. Se o SQL das moedas ainda não rodou, tudo fica escondido.
 */
import { create } from "zustand";
import { horaBr } from "./eventos";
import { BOLSA_ABAIXO_DE, ranking, textoBonus } from "./moedas";
import { aoMudarTabela } from "./sala";
import { getApp } from "./store";
import { sb } from "./supabase";
import { toast } from "./toast";

export type Carteira = { saldo: number; seq: number; pegouHoje: boolean; minutosHoje: number };
export type LinhaExtrato = { id: number; valor: number; motivo: string; ref: string | null; em: string };

export type SaldoDe = { userId: string; saldo: number };

export const useCarteira = create<{
  carteira: Carteira | null;
  extrato: LinhaExtrato[];
  /** saldo de todo mundo, para o ranking (null = ainda não carregou) */
  todas: SaldoDe[] | null;
  /** quem subiu de posição agora há pouco (user_id → até quando mostra o "▲ subiu") */
  subiram: Record<string, number>;
  /** painel da carteira (ranking e extrato) aberto */
  painel: "ranking" | "extrato" | null;
  /** dia de Brasília em que o banco disse que a bolsa já foi pega (o botão some até o outro dia) */
  bolsaPega: string | null;
  pedindoBolsa: boolean;
}>()(() => ({
  carteira: null,
  extrato: [],
  todas: null,
  subiram: {},
  painel: null,
  bolsaPega: null,
  pedindoBolsa: false,
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

async function chamar(fn: "bater_ponto" | "minha_carteira") {
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
    if (r.escudo_usado === true) toast("Escudo usado: sua sequência continua");
    if (ganhou) setTimeout(() => toast(textoBonus(ganhou, num(r.bonus_extra), num(r.seq))), r.escudo_usado === true ? 3500 : 0);
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
    /* o pulso conta também o minuto de tela compartilhada (emblema "Transmissor"; não dá moedas) */
    const { data, error } = await sb().rpc("pulso", { p_tela: !!getApp().myLiveSid });
    if (error) throw error;
    const c = lerCarteira(data as Record<string, unknown>);
    useCarteira.setState({ carteira: c });
    if (c && c.saldo !== antes) carregarExtrato();
  } catch {
    /* sem internet ou pulsos demais (várias abas): o próximo minuto tenta de novo */
  }
}

/** A Bolsa Nanica pode ser pedida agora: menos de 100 moedas e ainda não pega hoje (pelo extrato e pelo que o banco disse). */
export function podePedirBolsa(s: ReturnType<typeof useCarteira.getState>, agora = new Date()) {
  const c = s.carteira;
  if (!c || c.saldo >= BOLSA_ABAIXO_DE) return false;
  const hoje = horaBr(agora).dia;
  return s.bolsaPega !== hoje && !s.extrato.some((l) => l.motivo === "bolsa" && l.ref === hoje);
}

/** Bolsa Nanica (antes Bolsa Cassino, que vinha sozinha): o botão do K-FOFO pede; o banco confere o saldo e paga uma vez por dia. */
export async function pedirBolsa() {
  const s = useCarteira.getState();
  if (s.pedindoBolsa || !s.carteira) return;
  useCarteira.setState({ pedindoBolsa: true });
  const { data, error } = await sb().rpc("pedir_bolsa");
  useCarteira.setState({ pedindoBolsa: false });
  if (error || !data || typeof data !== "object") return toast("Não deu para pedir a bolsa agora. Tente de novo em instantes.");
  const r = data as Record<string, unknown>;
  const c = useCarteira.getState().carteira;
  if (c) useCarteira.setState({ carteira: { ...c, saldo: num(r.saldo) } });
  if (!num(r.ganhou)) {
    /* passageiro: não esconde o botão até amanhã, como o "já pegou" abaixo */
    if (num(r.em_jogo)) return toast(`Você tem ${num(r.em_jogo).toLocaleString("pt-BR")} moedas em jogo. Termine a jogada antes de pedir a Bolsa Nanica.`);
    if (num(r.saldo) < BOLSA_ABAIXO_DE) useCarteira.setState({ bolsaPega: horaBr(new Date()).dia });
    return toast(num(r.saldo) < BOLSA_ABAIXO_DE ? "Você já pegou a Bolsa Nanica hoje. Amanhã tem de novo." : "A Bolsa Nanica é só para quem está com menos de 100 moedas.");
  }
  useCarteira.setState({ bolsaPega: horaBr(new Date()).dia });
  toast(`Bolsa Nanica: +${num(r.ganhou).toLocaleString("pt-BR")} moedas para voltar ao jogo`);
  carregarExtrato();
}

/** O saldo mudou no banco (tempo real das carteiras): atualiza o meu sem pedir de novo. */
export function ajustarSaldo(saldo: number) {
  const c = useCarteira.getState().carteira;
  if (c && c.saldo !== saldo) useCarteira.setState({ carteira: { ...c, saldo: Math.max(0, Math.trunc(saldo)) } });
}

/** Últimas 30 linhas do meu extrato. */
export async function carregarExtrato() {
  const { data, error } = await sb().from("extrato").select("id,valor,motivo,ref,em").order("em", { ascending: false }).limit(30);
  if (!error && Array.isArray(data)) useCarteira.setState({ extrato: data as LinhaExtrato[] });
}

/* ---------- ranking ---------- */
const SUBIU_MS = 3000;
let rankingLigado = false;

/** Lê o saldo de todas as carteiras uma vez (a RLS deixa nanicos lerem); depois o tempo real mantém a lista. */
export async function carregarRanking() {
  if (rankingLigado) return;
  rankingLigado = true;
  aoMudarTabela("carteiras", (row) => {
    if (!row || typeof row.user_id !== "string" || typeof row.saldo !== "number" || !Number.isFinite(row.saldo)) return;
    mudarSaldo(row.user_id, Math.max(0, Math.trunc(row.saldo)));
  });
  const { data, error } = await sb().from("carteiras").select("user_id,saldo");
  if (error || !Array.isArray(data)) {
    rankingLigado = false;
    return;
  }
  const todas = data
    .filter((c) => typeof c.user_id === "string" && typeof c.saldo === "number")
    .map((c) => ({ userId: c.user_id as string, saldo: Math.max(0, Math.trunc(c.saldo as number)) }));
  /* algum saldo chegou pelo tempo real enquanto a leitura voltava: fica o do tempo real */
  const jaTem = new Map((useCarteira.getState().todas ?? []).map((c) => [c.userId, c.saldo]));
  useCarteira.setState({ todas: todas.map((c) => ({ ...c, saldo: jaTem.get(c.userId) ?? c.saldo })) });
}

/** Saldo novo de alguém: reordena e marca quem subiu de posição por 3 s. */
function mudarSaldo(userId: string, saldo: number) {
  const { todas, subiram } = useCarteira.getState();
  if (!todas) return;
  const antes = todas.find((c) => c.userId === userId);
  if (antes?.saldo === saldo) return;
  const novas = antes ? todas.map((c) => (c.userId === userId ? { ...c, saldo } : c)) : [...todas, { userId, saldo }];
  const friends = getApp().friends;
  const posAntes = ranking(todas, friends).find((l) => l.userId === userId)?.pos ?? Infinity;
  const posDepois = ranking(novas, friends).find((l) => l.userId === userId)?.pos ?? Infinity;
  const ate = Date.now() + SUBIU_MS;
  useCarteira.setState({ todas: novas, subiram: posDepois < posAntes ? { ...subiram, [userId]: ate } : subiram });
  if (posDepois < posAntes)
    setTimeout(() => {
      const { [userId]: fim, ...resto } = useCarteira.getState().subiram;
      if (fim === ate) useCarteira.setState({ subiram: resto });
    }, SUBIU_MS);
}
