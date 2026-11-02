/*
 * Zoeira no hall ao vivo: chama zoar() no banco (que cobra e grava) e, quando a linha nova chega pelo
 * tempo real, anima o voo, o cambaleio, o "PLAFT!" e o chantili, e mostra os avisos. Só anima se
 * quem zoou e quem levou estão no hall agora; senão, fica só o aviso.
 */
import { create } from "zustand";
import { ajustarSaldo } from "@/lib/carteira";
import { aoMudarTabela } from "@/lib/sala";
import { getApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { reduzMovimento } from "@/lib/util";
import { useHall } from "./bonecos";
import { avisarZoeira } from "./ganhos";
import { CAMBALEIO_MS } from "./zoeira";

export type TipoZoeira = "chinelo" | "torta" | "revide";
export const PRECO: Readonly<Record<TipoZoeira, number>> = { chinelo: 5, torta: 25, revide: 0 };

export type Voo = { id: number; tipo: TipoZoeira; de: string; para: string; inicio: number };

type Estado = {
  /** relógio dos quadros (só anda enquanto tem algo acontecendo) */
  agora: number;
  voos: Voo[];
  /** fid → quando levou a chinelada (para o cambaleio) */
  pancada: Record<string, number>;
  /** fid → até quando aparece o "PLAFT!" */
  plaft: Record<string, number>;
  /** fid → até quando o rosto fica sujo de chantili */
  torta: Record<string, number>;
  /** quem me zoou agora há pouco: dá para revidar de graça até `ate` */
  revidar: { de: string; nome: string; tipo: TipoZoeira; ate: number } | null;
  /** boneco com o menu aberto (chave do boneco) */
  menu: string | null;
  ocupado: boolean;
};

export const useZoeira = create<Estado>()(() => ({ agora: 0, voos: [], pancada: {}, plaft: {}, torta: {}, revidar: null, menu: null, ocupado: false }));

export const VOO_MS = 750;
const PLAFT_MS = 1500;
const TORTA_MS = 20_000;
const REVIDE_MS = 30_000;
const UUID = /^[0-9a-f-]{36}$/i;

export const abrirMenu = (key: string | null) => useZoeira.setState({ menu: key });

/* ---------- relógio dos quadros ---------- */
let raf = 0;
function quadro(t: number) {
  raf = 0;
  const s = useZoeira.getState();
  /* o que acabou sai da lista */
  const voos = s.voos.filter((v) => t - v.inicio < VOO_MS);
  const vivo = (m: Record<string, number>, dura: number) => Object.fromEntries(Object.entries(m).filter(([, ate]) => t - ate < dura));
  const pancada = vivo(s.pancada, CAMBALEIO_MS);
  const plaft = Object.fromEntries(Object.entries(s.plaft).filter(([, ate]) => ate > t));
  useZoeira.setState({ agora: t, voos, pancada, plaft });
  if (voos.length || Object.keys(pancada).length || Object.keys(plaft).length) raf = requestAnimationFrame(quadro);
}
const ligarRelogio = () => {
  if (!raf) raf = requestAnimationFrame(quadro);
};

/* chegou no alvo: chinelada balança e faz PLAFT; torta suja o rosto */
function acertou(tipo: TipoZoeira, para: string) {
  const t = performance.now();
  const s = useZoeira.getState();
  if (tipo === "torta") useZoeira.setState({ torta: { ...s.torta, [para]: Date.now() + TORTA_MS } });
  else useZoeira.setState({ pancada: { ...s.pancada, [para]: t }, plaft: { ...s.plaft, [para]: t + PLAFT_MS } });
  ligarRelogio();
  /* página sem desenhar (janela coberta): o relógio para, então o PLAFT e o cambaleio somem pelo tempo */
  if (tipo !== "torta")
    setTimeout(() => {
      const z = useZoeira.getState();
      if (!z.plaft[para] || z.plaft[para] > performance.now() + 50) return;
      const plaft = { ...z.plaft };
      const pancada = { ...z.pancada };
      delete plaft[para];
      delete pancada[para];
      useZoeira.setState({ plaft, pancada });
    }, PLAFT_MS);
  if (tipo === "torta")
    setTimeout(() => {
      const { [para]: ate, ...resto } = useZoeira.getState().torta;
      if (ate && ate <= Date.now() + 50) useZoeira.setState({ torta: resto });
    }, TORTA_MS);
}

const noHall = (fid: string) => useHall.getState().bonecos.some((b) => b.fid === fid);
const hallAVista = () => getApp().aba === "hall" && !document.hidden;

let seq = 0;
const vistos = new Set<number>();

/** Linha nova da tabela zoeiras (tempo real): confere tudo antes de mostrar. */
function onZoeira(row: Record<string, unknown> | null) {
  if (!row || typeof row.de !== "string" || typeof row.para !== "string" || !UUID.test(row.de) || !UUID.test(row.para)) return;
  const tipo = row.tipo === "chinelo" || row.tipo === "torta" || row.tipo === "revide" ? row.tipo : null;
  const id = typeof row.id === "number" ? row.id : -1;
  if (!tipo || vistos.has(id)) return;
  vistos.add(id);
  const app = getApp();
  const nome = (fid: string) => app.friends.find((f) => f.id === fid)?.name ?? "Alguém";
  const quem = nome(row.de);
  const alvo = nome(row.para);
  const eu = app.myFid;
  const acao = tipo === "torta" ? "uma torta na cara" : "uma chinelada";
  /* aviso para todo mundo no canto dos ganhos */
  if (row.de === eu) avisarZoeira(row.de, `Você deu ${acao} ${tipo === "revide" ? "de volta " : ""}em ${alvo}`);
  else if (row.para === eu) avisarZoeira(row.de, `${quem} ${tipo === "revide" ? "revidou com" : "te deu"} ${acao}`);
  else avisarZoeira(row.de, `${quem} ${tipo === "revide" ? "revidou com" : "deu"} ${acao} ${tipo === "revide" ? "em" : "no"} ${alvo}`);
  /* levei: aviso e o revide grátis por 30 s (revide não se revida) */
  if (row.para === eu) {
    if (tipo !== "revide") {
      useZoeira.setState({ revidar: { de: row.de, nome: quem, tipo, ate: Date.now() + REVIDE_MS } });
      setTimeout(() => {
        const r = useZoeira.getState().revidar;
        if (r && r.ate <= Date.now() + 50) useZoeira.setState({ revidar: null });
      }, REVIDE_MS);
      if (!hallAVista()) toast(`${quem} te deu ${acao}. Vá ao K-FOFO para revidar de graça.`);
    }
  }
  /* só anima com os dois no hall e o hall à vista */
  if (!noHall(row.de) || !noHall(row.para) || !hallAVista()) return;
  if (reduzMovimento()) return acertou(tipo, row.para);
  const voo: Voo = { id: ++seq, tipo, de: row.de, para: row.para, inicio: performance.now() };
  useZoeira.setState((s) => ({ voos: [...s.voos, voo] }));
  ligarRelogio();
  setTimeout(() => {
    useZoeira.setState((s) => ({ voos: s.voos.filter((v) => v.id !== voo.id) }));
    acertou(tipo, voo.para);
  }, VOO_MS);
}

let ligado = false;
/** Começa a ouvir a zoeira (uma vez só). */
export function iniciarZoeira() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("zoeiras", onZoeira);
}

/** Dá a chinelada / torta / revide. O banco cobra, confere os limites e grava. */
export async function zoar(para: string, tipo: TipoZoeira) {
  if (useZoeira.getState().ocupado) return;
  useZoeira.setState({ ocupado: true, menu: null });
  try {
    const { data, error } = await sb().rpc("zoar", { p_para_friend: para, p_tipo: tipo });
    if (error) throw error;
    const saldo = (data as { saldo?: unknown } | null)?.saldo;
    if (typeof saldo === "number") ajustarSaldo(saldo);
    if (tipo === "revide") useZoeira.setState({ revidar: null });
  } catch (e) {
    const o = (e || {}) as { code?: string; message?: string };
    toast(o.code === "P0001" && o.message ? o.message.slice(0, 140) : "Não deu para zoar agora. Confira a internet.");
  } finally {
    useZoeira.setState({ ocupado: false });
  }
}
