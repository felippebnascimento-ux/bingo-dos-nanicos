/*
 * Consumíveis no Sítio: quando alguém usa um cigarrinho, uma latinha, um chimarrão… o banco grava em
 * `consumos` (usar_item, pago) e o tempo real dessa tabela anima o boneco de quem usou em todas as telas.
 * Nada disso vem de broadcast. O relógio só corre enquanto tem alguém tremendo ou tonto.
 */
import { create } from "zustand";
import { avisarTexto } from "@/features/hall/ganhos";
import { aoMudarTabela } from "@/lib/sala";
import { getApp } from "@/lib/store";
import { DURA_ANIM, textoConsumo, type Anim } from "./loja";
import { useLoja } from "./lojaDados";

export type Consumo = { id: number; fid: string; item: string; anim: Anim; inicio: number };

export const useConsumo = create<{ ativos: Consumo[]; agora: number }>()(() => ({ ativos: [], agora: 0 }));

const UUID = /^[0-9a-f-]{36}$/i;
let relogio: ReturnType<typeof setInterval> | undefined;

function tique() {
  const agora = Date.now();
  const ativos = useConsumo.getState().ativos.filter((c) => agora - c.inicio < DURA_ANIM[c.anim]);
  useConsumo.setState({ agora, ativos });
  if (!ativos.some((c) => c.anim === "tremer" || c.anim === "tonto")) {
    clearInterval(relogio);
    relogio = undefined;
  }
}

function onConsumo(row: Record<string, unknown> | null) {
  if (!row || typeof row.de !== "string" || !UUID.test(row.de) || typeof row.item_id !== "string") return;
  const it = useLoja.getState().itens?.find((i) => i.id === row.item_id);
  const anim = it?.dados.anim;
  if (!it || !anim) return;
  const id = typeof row.id === "number" ? row.id : Date.now();
  const s = useConsumo.getState();
  if (s.ativos.some((c) => c.id === id)) return;
  const inicio = Date.now();
  /* um por boneco: o novo substitui o anterior */
  useConsumo.setState({ ativos: [...s.ativos.filter((c) => c.fid !== row.de), { id, fid: row.de, item: it.id, anim, inicio }], agora: inicio });
  const f = getApp().friends.find((x) => x.id === row.de);
  const eu = row.de === getApp().myFid;
  avisarTexto(row.de, textoConsumo(eu ? "Você" : f?.name || "Alguém", it));
  /* remove sozinho no fim (a aba escondida não roda animação) */
  setTimeout(tique, DURA_ANIM[anim] + 50);
  if ((anim === "tremer" || anim === "tonto") && !relogio) relogio = setInterval(tique, 50);
}

let ligado = false;
/** Começa a ouvir os consumos (uma vez só). */
export function iniciarConsumo() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("consumos", onConsumo);
}
