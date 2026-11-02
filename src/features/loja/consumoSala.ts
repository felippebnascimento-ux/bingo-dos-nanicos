/*
 * Consumíveis no Sítio: quando alguém usa um cigarrinho, uma latinha, um chimarrão… o banco grava em
 * `consumos` (usar_item, pago) e o tempo real dessa tabela anima o boneco de quem usou em todas as telas.
 * Nada disso vem de broadcast. O efeito dura minutos (DURA_EFEITO) e quem entra depois também vê: ao ligar,
 * o site lê os consumos recentes. O relógio corre a cada segundo (contador) e mais rápido com alguém tremendo ou tonto.
 */
import { create } from "zustand";
import { avisarTexto } from "@/features/hall/ganhos";
import { aoMudarTabela } from "@/lib/sala";
import { getApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { DURA_EFEITO, textoConsumo, type Anim } from "./loja";
import { useLoja } from "./lojaDados";

export type Consumo = { id: number; fid: string; item: string; anim: Anim; inicio: number };

export const useConsumo = create<{ ativos: Consumo[]; agora: number }>()(() => ({ ativos: [], agora: 0 }));

const UUID = /^[0-9a-f-]{36}$/i;
let relogio: ReturnType<typeof setInterval> | undefined;

let rapido = false;
function tique() {
  const agora = Date.now();
  const ativos = useConsumo.getState().ativos.filter((c) => agora - c.inicio < DURA_EFEITO[c.anim]);
  useConsumo.setState({ agora, ativos });
  /* 50 ms com alguém balançando (tremer, tonto), 1 s só para o contador, parado sem ninguém */
  const quer = ativos.some((c) => c.anim === "tremer" || c.anim === "tonto");
  if (!ativos.length || quer !== rapido) {
    clearInterval(relogio);
    relogio = undefined;
  }
  if (ativos.length && !relogio) {
    rapido = quer;
    relogio = setInterval(tique, quer ? 50 : 1000);
  }
}

/** Um consumo (do tempo real ou da leitura inicial). `aviso` = mostrar "Pitoco acendeu um cigarrinho". */
function receber(row: Record<string, unknown> | null, aviso: boolean) {
  if (!row || typeof row.de !== "string" || !UUID.test(row.de) || typeof row.item_id !== "string") return;
  const it = useLoja.getState().itens?.find((i) => i.id === row.item_id);
  const anim = it?.dados.anim;
  if (!it || !anim) return;
  const id = typeof row.id === "number" ? row.id : Date.now();
  const s = useConsumo.getState();
  if (s.ativos.some((c) => c.id === id)) return;
  /* o começo é a hora gravada no banco (todo mundo vê o mesmo contador), nunca no futuro */
  const agora = Date.now();
  const inicio = Math.min(agora, Date.parse(String(row.em)) || agora);
  if (agora - inicio >= DURA_EFEITO[anim]) return;
  /* um por boneco: o novo substitui o anterior */
  useConsumo.setState({ ativos: [...s.ativos.filter((c) => c.fid !== row.de), { id, fid: row.de, item: it.id, anim, inicio }], agora });
  if (aviso) {
    const f = getApp().friends.find((x) => x.id === row.de);
    const eu = row.de === getApp().myFid;
    avisarTexto(row.de, textoConsumo(eu ? "Você" : f?.name || "Alguém", it));
  }
  tique();
}

/** Quem está com algum efeito agora (quem entrou depois também vê), lido uma vez quando a vitrine chega. */
async function lerRecentes() {
  const desde = new Date(Date.now() - Math.max(...Object.values(DURA_EFEITO))).toISOString();
  const { data } = await sb().from("consumos").select("id,de,item_id,em").gte("em", desde).order("em");
  for (const r of data ?? []) receber(r, false);
}

let ligado = false;
/** Começa a ouvir os consumos (uma vez só). */
export function iniciarConsumo() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("consumos", (row) => receber(row, true));
  /* precisa da vitrine para saber a animação de cada item */
  if (useLoja.getState().itens) void lerRecentes();
  else {
    const sair = useLoja.subscribe((s) => {
      if (!s.itens) return;
      sair();
      void lerRecentes();
    });
  }
}
