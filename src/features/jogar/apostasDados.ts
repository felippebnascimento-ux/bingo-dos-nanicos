/*
 * Apostas na partida ao vivo (seção 14 do seguranca.sql). O mercado de cada partida é aberto e pago pela função
 * riot-ao-vivo; o site só lê o bolo (tempo real de apostas_mercados) e as minhas apostas (o RLS só manda as minhas)
 * e aposta por apostar_partida(). Quem decide prazo, lado permitido e pagamento é o banco.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { nomeLado, type Lado } from "./apostas";
import { useRiot } from "./riot";

export type Mercado = {
  game: number;
  fechaEm: number;
  estado: "aberto" | "fechado" | "pago" | "devolvido";
  vencedor: Lado | null;
  fim: string | null;
  bolo100: number;
  bolo200: number;
  /** nanicos na partida: friend id → time */
  nanicos: Record<string, Lado>;
};
export type MinhaAposta = { game: number; lado: Lado; valor: number; pago: number | null };

export const useApostas = create<{ mercados: Record<number, Mercado>; minhas: Record<number, MinhaAposta>; enviando: boolean }>()(() => ({
  mercados: {},
  minhas: {},
  enviando: false,
}));

const ESTADOS = ["aberto", "fechado", "pago", "devolvido"] as const;
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const lado = (v: unknown): Lado | null => (v === 100 || v === 200 ? v : null);

export function lerMercado(r: Record<string, unknown> | null): Mercado | null {
  const game = Number(r?.game_id);
  if (!r || !Number.isSafeInteger(game) || game <= 0) return null;
  const nanicos: Record<string, Lado> = {};
  if (r.nanicos && typeof r.nanicos === "object")
    for (const [k, v] of Object.entries(r.nanicos as Record<string, unknown>)) {
      const l = lado(v);
      if (l && /^[0-9a-f-]{36}$/i.test(k)) nanicos[k] = l;
    }
  return {
    game,
    fechaEm: Date.parse(String(r.fecha_em)) || 0,
    estado: (ESTADOS as readonly unknown[]).includes(r.estado) ? (r.estado as Mercado["estado"]) : "fechado",
    vencedor: lado(r.vencedor),
    fim: typeof r.fim === "string" ? r.fim : null,
    bolo100: int(r.bolo_100),
    bolo200: int(r.bolo_200),
    nanicos,
  };
}
function lerAposta(r: Record<string, unknown> | null): MinhaAposta | null {
  const game = Number(r?.game_id), l = lado(r?.lado);
  if (!r || !Number.isSafeInteger(game) || !l) return null;
  return { game, lado: l, valor: int(r.valor), pago: typeof r.pago === "number" ? int(r.pago) : null };
}

/** Aposta aberta agora? (o banco confere de novo) */
export const apostaAberta = (m: Mercado | undefined, agora: number) => !!m && m.estado === "aberto" && agora < m.fechaEm;

/* ---------- ler ---------- */
let pedidos = "";
async function carregar(ids: number[]) {
  const chave = ids.join(",");
  if (!ids.length || chave === pedidos) return;
  pedidos = chave;
  const [m, a] = await Promise.all([
    sb().from("apostas_mercados").select("*").in("game_id", ids),
    sb().from("apostas").select("game_id,lado,valor,pago").in("game_id", ids),
  ]);
  if (m.error) {
    console.warn("apostas indisponíveis", m.error.message);
    return;
  }
  const mercados = { ...useApostas.getState().mercados }, minhas = { ...useApostas.getState().minhas };
  for (const r of m.data ?? []) {
    const x = lerMercado(r);
    if (x) mercados[x.game] = x;
  }
  for (const r of a.data ?? []) {
    const x = lerAposta(r);
    if (x) minhas[x.game] = x;
  }
  useApostas.setState({ mercados, minhas });
}

/* ---------- fim da partida: o aviso de quanto voltou ---------- */
const MOTIVO_FIM: Record<string, string> = {
  remake: "remake",
  sem_contra: "ninguém apostou contra",
  sem_resultado: "a Riot não deu o resultado",
};
async function avisarFim(ap: MinhaAposta) {
  /* o banco grava as apostas antes do mercado: espera o mercado chegar e lê de novo */
  await new Promise((r) => setTimeout(r, 1500));
  const { data } = await sb().from("apostas_mercados").select("*").eq("game_id", ap.game).maybeSingle();
  const m = lerMercado(data);
  if (m) useApostas.setState((s) => ({ mercados: { ...s.mercados, [m.game]: m } }));
  if (!m || m.estado === "devolvido") return toast(`Aposta devolvida: ${MOTIVO_FIM[m?.fim ?? ""] ?? "partida sem resultado"}`);
  const v = m.vencedor;
  const friends = getApp().friends;
  const nome = v ? friends.find((f) => m.nanicos[f.id] === v)?.name : undefined;
  const time = nome ? `o time do ${nome}` : v ? `o time ${nomeLado(v)}` : "a partida acabou";
  if (ap.pago) toast(`+${ap.pago} moedas: ${time} venceu`);
  else toast(`${time[0].toUpperCase() + time.slice(1)} venceu: você perdeu ${ap.valor} moedas`);
}

/* ---------- tempo real ---------- */
function onMercado(row: Record<string, unknown> | null) {
  const m = lerMercado(row);
  if (!m) return;
  const s = useApostas.getState();
  const vivo = useRiot.getState().jogos.some((g) => Number(g.id) === m.game);
  if (!vivo && !s.mercados[m.game] && !s.minhas[m.game]) return;
  useApostas.setState({ mercados: { ...s.mercados, [m.game]: m } });
}
function onAposta(row: Record<string, unknown> | null, ev: string) {
  const a = lerAposta(row);
  if (!a || (row && row.user_id !== getApp().myUid)) return;
  const antes = useApostas.getState().minhas[a.game];
  useApostas.setState((s) => ({ minhas: { ...s.minhas, [a.game]: a } }));
  if (ev === "UPDATE" && a.pago !== null && (!antes || antes.pago === null)) void avisarFim(a);
}

let ligado = false;
/** Começa a acompanhar as apostas das partidas ao vivo (uma vez, depois do login). */
export function iniciarApostas() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("apostas_mercados", onMercado);
  aoMudarTabela("apostas", onAposta);
  /* partida nova na Riot: lê o mercado e a minha aposta dela */
  const ver = (jogos: { id: string }[]) => void carregar(jogos.map((g) => Number(g.id)).filter((n) => Number.isSafeInteger(n) && n > 0).sort());
  useRiot.subscribe((s, a) => s.jogos !== a.jogos && ver(s.jogos));
  ver(useRiot.getState().jogos);
}

/* ---------- apostar ---------- */
export async function apostar(game: number, l: Lado, valor: number): Promise<boolean> {
  if (useApostas.getState().enviando) return false;
  useApostas.setState({ enviando: true });
  try {
    const { data, error } = await sb().rpc("apostar_partida", { p_game: game, p_lado: l, p_valor: valor });
    if (error) {
      const m = error as { code?: string; message?: string };
      toast(m.code === "P0001" && m.message ? m.message.slice(0, 140) : errMsg(error, "Não deu para apostar. Confira a internet."));
      return false;
    }
    const s = useApostas.getState(), m = s.mercados[game];
    useApostas.setState({
      minhas: { ...s.minhas, [game]: { game, lado: l, valor, pago: null } },
      mercados: m ? { ...s.mercados, [game]: { ...m, bolo100: int(data?.bolo_100) || m.bolo100, bolo200: int(data?.bolo_200) || m.bolo200 } } : s.mercados,
    });
    toast(`Aposta feita: ${valor} moedas no time ${nomeLado(l)}`);
    return true;
  } finally {
    useApostas.setState({ enviando: false });
  }
}
