/*
 * Eventos com horário no Sítio: o relógio (um tique por segundo), se eu já peguei o espetinho deste sábado
 * e o pedido do espetinho ao banco. O horário vem de src/lib/eventos.ts, mas quem paga é o banco:
 * churrasco_pegar() confere a hora de Brasília e sorteia o valor; o aviso para todo mundo vem do tempo
 * real das carteiras (ganhos.ts), nunca de broadcast.
 */
import { create } from "zustand";
import { ajustarSaldo } from "@/lib/carteira";
import { eventoAgora, horaBr, type Evento } from "@/lib/eventos";
import { getApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { local } from "@/lib/util";

type EstadoEventos = {
  agora: number;
  evento: Evento | null;
  /** dia (AAAA-MM-DD, Brasília) em que eu já peguei o espetinho; null = ainda não sei ou não peguei */
  pegouDia: string | null;
  ocupado: boolean;
};

export const useEventos = create<EstadoEventos>()(() => ({ agora: 0, evento: null, pegouDia: null, ocupado: false }));

/** A primeira vez que a pessoa vê cada evento, um aviso explica o que é. */
const EXPLICA: Record<Evento, string> = {
  happy: "Happy hour: até a meia-noite, o tempo no site paga moedas em dobro.",
  churrasco: "Churrasco de sábado: clique na churrasqueira do K-FOFO e pegue seu espetinho surpresa.",
};
function explicarUmaVez(ev: Evento) {
  const vistos = local.json<Record<string, boolean>>("evento-visto") ?? {};
  if (vistos[ev]) return;
  local.setJson("evento-visto", { ...vistos, [ev]: true });
  toast(EXPLICA[ev]);
}

/** Confere no meu extrato se eu já peguei o espetinho hoje (cada um lê só o seu). */
async function conferirEspetinho(dia: string) {
  try {
    const { data, error } = await sb().from("extrato").select("id").eq("motivo", "churrasco").eq("ref", dia).limit(1);
    if (!error && data?.length) useEventos.setState({ pegouDia: dia });
  } catch {
    /* sem rede: a placa continua oferecendo, e o banco recusa se já pegou */
  }
}

function tique() {
  const agora = Date.now();
  const evento = eventoAgora(new Date(agora));
  const antes = useEventos.getState().evento;
  useEventos.setState({ agora, evento });
  if (evento !== antes && evento && getApp().myUid) {
    explicarUmaVez(evento);
    if (evento === "churrasco") void conferirEspetinho(horaBr(new Date(agora)).dia);
  }
}

let ligado = false;
/** Começa o relógio dos eventos (uma vez só). */
export function iniciarEventos() {
  if (ligado) return;
  ligado = true;
  tique();
  setInterval(tique, 1000);
}

/** Pega o espetinho do churrasco: o banco confere o horário, sorteia de 10 a 60 e paga. */
export async function pegarEspetinho() {
  if (useEventos.getState().ocupado) return;
  useEventos.setState({ ocupado: true });
  const dia = horaBr(new Date()).dia;
  try {
    const { data, error } = await sb().rpc("churrasco_pegar");
    if (error) throw error;
    const r = (data || {}) as { valor?: unknown; saldo?: unknown };
    if (typeof r.saldo === "number") ajustarSaldo(r.saldo);
    useEventos.setState({ pegouDia: dia });
    if (typeof r.valor === "number") toast(`Espetinho surpresa: +${r.valor} moedas`);
  } catch (e) {
    const o = (e || {}) as { code?: string; message?: string };
    if (o.code === "P0001" && o.message?.includes("já pegou")) useEventos.setState({ pegouDia: dia });
    toast(o.code === "P0001" && o.message ? o.message.slice(0, 140) : "Não deu para pegar o espetinho. Confira a internet.");
  } finally {
    useEventos.setState({ ocupado: false });
  }
}
