/*
 * Apostas numa partida de truco (seção 40 do seguranca.sql). A função truco-mesa abre o mercado quando a partida
 * começa, fecha quando a 2ª mão é dada e paga no fim; o site só lê o bolo (tempo real de truco_mercados, que os
 * membros leem), a minha aposta (truco_apostas: o RLS só manda a minha) e aposta por apostar_truco(). Quem decide
 * prazo, lado permitido e pagamento é o banco. Uma mesa tem um mercado por partida: vale o da partida mais nova.
 */
import { create } from "zustand";
import { ajustarSaldo } from "@/lib/carteira";
import { aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { LadoN } from "@/features/jogar/apostas";

export type MercadoTruco = {
  mesa: string;
  partida: number;
  estado: "aberto" | "fechado" | "pago" | "devolvido";
  vencedor: LadoN | null;
  bolos: [number, number];
  /** quem está jogando: friend id → dupla (0 ou 1) */
  times: Record<string, LadoN>;
};
export type ApostaTruco = { mesa: string; partida: number; lado: LadoN; valor: number; pago: number };

export const useApostasTruco = create<{ mercados: Record<string, MercadoTruco>; minhas: Record<string, ApostaTruco>; enviando: boolean }>()(
  () => ({ mercados: {}, minhas: {}, enviando: false }),
);

const ESTADOS = ["aberto", "fechado", "pago", "devolvido"] as const;
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const ladoN = (v: unknown): LadoN | null => (v === 0 || v === 1 ? v : null);
const chave = (mesa: string, partida: number) => `${mesa}:${partida}`;

function lerMercado(r: Record<string, unknown> | null): MercadoTruco | null {
  const mesa = typeof r?.mesa === "string" ? r.mesa : "";
  const partida = Number(r?.partida);
  if (!r || !/^[a-z0-9]{6,20}$/.test(mesa) || !Number.isSafeInteger(partida)) return null;
  const times: Record<string, LadoN> = {};
  if (r.times && typeof r.times === "object")
    for (const [k, v] of Object.entries(r.times as Record<string, unknown>)) {
      const l = ladoN(v);
      if (l !== null && /^[0-9a-f-]{36}$/i.test(k)) times[k] = l;
    }
  return {
    mesa,
    partida,
    estado: (ESTADOS as readonly unknown[]).includes(r.estado) ? (r.estado as MercadoTruco["estado"]) : "fechado",
    vencedor: ladoN(r.vencedor),
    bolos: [int(r.bolo_0), int(r.bolo_1)],
    times,
  };
}
function lerAposta(r: Record<string, unknown> | null): ApostaTruco | null {
  const mesa = typeof r?.mesa === "string" ? r.mesa : "";
  const partida = Number(r?.partida), l = ladoN(r?.lado);
  if (!r || !mesa || !Number.isSafeInteger(partida) || l === null || r.user_id !== getApp().myUid) return null;
  return { mesa, partida, lado: l, valor: int(r.valor), pago: int(r.pago) };
}

/** O mercado mais novo de uma mesa (a partida em jogo ou a última que acabou). */
export function mercadoDaMesa(mercados: Record<string, MercadoTruco>, mesa: string | null): MercadoTruco | null {
  let m: MercadoTruco | null = null;
  if (mesa) for (const x of Object.values(mercados)) if (x.mesa === mesa && (!m || x.partida > m.partida)) m = x;
  return m;
}

/** Aviso do fim, só para quem apostou naquela partida. */
function avisarFim(antes: MercadoTruco | undefined, m: MercadoTruco) {
  if (antes?.estado === m.estado || (m.estado !== "pago" && m.estado !== "devolvido")) return;
  const a = useApostasTruco.getState().minhas[chave(m.mesa, m.partida)];
  if (!a) return;
  if (m.estado === "devolvido") toast(`Aposta no truco devolvida: ${a.valor} moedas`);
  else if (m.vencedor === a.lado) toast("Aposta no truco: você ganhou!");
  else toast("Aposta no truco: não foi dessa vez");
}

let ligado = false;
/** Lê o que já existe e passa a ouvir o tempo real (a aba Truco chama uma vez). */
export async function ligarApostasTruco() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("truco_mercados", (row) => {
    const m = lerMercado(row);
    if (!m) return;
    const k = chave(m.mesa, m.partida);
    const antes = useApostasTruco.getState().mercados[k];
    useApostasTruco.setState((s) => ({ mercados: { ...s.mercados, [k]: m } }));
    avisarFim(antes, m);
  });
  aoMudarTabela("truco_apostas", (row) => {
    const a = lerAposta(row);
    if (a) useApostasTruco.setState((s) => ({ minhas: { ...s.minhas, [chave(a.mesa, a.partida)]: a } }));
  });
  const desde = new Date(Date.now() - 6 * 3600_000).toISOString();
  const [m, a] = await Promise.all([
    sb().from("truco_mercados").select("mesa,partida,times,estado,vencedor,bolo_0,bolo_1").gt("criado_em", desde).limit(60),
    sb().from("truco_apostas").select("mesa,partida,user_id,lado,valor,pago").gt("em", desde).limit(60),
  ]);
  if (m.error) {
    /* SQL da seção 40 ainda não rodou: sem apostas no truco */
    console.warn("apostas do truco indisponíveis", errMsg(m.error, "sem resposta"));
    return;
  }
  const mercados: Record<string, MercadoTruco> = {};
  for (const r of m.data ?? []) {
    const x = lerMercado(r as Record<string, unknown>);
    if (x) mercados[chave(x.mesa, x.partida)] = x;
  }
  const minhas: Record<string, ApostaTruco> = {};
  for (const r of a.data ?? []) {
    const x = lerAposta(r as Record<string, unknown>);
    if (x) minhas[chave(x.mesa, x.partida)] = x;
  }
  useApostasTruco.setState((s) => ({ mercados: { ...mercados, ...s.mercados }, minhas: { ...minhas, ...s.minhas } }));
}

/** Aposta numa dupla da partida. O banco confere tudo de novo (prazo, lado, uma por pessoa, saldo). */
export async function apostarTruco(m: MercadoTruco, lado: LadoN, valor: number) {
  if (useApostasTruco.getState().enviando) return false;
  useApostasTruco.setState({ enviando: true });
  try {
    const { data, error } = await sb().rpc("apostar_truco", { p_mesa: m.mesa, p_partida: m.partida, p_lado: lado, p_valor: valor });
    if (error) throw error;
    const saldo = (data as { saldo?: unknown } | null)?.saldo;
    if (typeof saldo === "number") ajustarSaldo(saldo);
    useApostasTruco.setState((s) => ({ minhas: { ...s.minhas, [chave(m.mesa, m.partida)]: { mesa: m.mesa, partida: m.partida, lado, valor, pago: 0 } } }));
    toast(`Aposta feita: ${valor} moedas`);
    return true;
  } catch (e) {
    /* as recusas do banco já dizem o que fazer ("Quem está jogando só aposta no próprio time.") */
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
    toast(msg && msg.length < 140 ? msg : "Não deu para apostar agora.");
    return false;
  } finally {
    useApostasTruco.setState({ enviando: false });
  }
}

export const minhaApostaTruco = (minhas: Record<string, ApostaTruco>, m: MercadoTruco | null) => (m ? (minhas[chave(m.mesa, m.partida)] ?? null) : null);
