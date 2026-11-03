/*
 * O truco na mesa verde do K-FOFO (fase 32). Lê as mesas do truco pelo tempo real que já existe (useTruco, de
 * truco_mesas; nenhum broadcast novo) e escolhe a partida em jogo que começou primeiro. Dela saem quem senta em
 * qual cadeira, quantas cartas cada um tem na mão (nunca quais), as cartas jogadas no feltro, os gritos ("Truco!")
 * por 2,5 s e, no fim, quem ganhou por 6 s. A presença (pos) e o hall-pos não mudam: o boneco só é desenhado na
 * cadeira enquanto a partida dura.
 */
import { create } from "zustand";
import { useTruco } from "@/features/truco/mesa";
import type { MesaPub } from "@/features/truco/engine";
import { lugarNaMesaVerde } from "./hall";

/** Quem está sentado numa cadeira da mesa verde: a cadeira (0..3), as cartas na mão e o grito de agora. */
export type SentadoTruco = { cadeira: number; cartas: number; fala: string | null };

type Estado = {
  mesa: MesaPub | null;
  /** quantas outras partidas estão em jogo ("+1 mesa") */
  extra: number;
  /** a partida da mesa verde acabou agora há pouco (a plaquinha mostra quem ganhou) */
  terminou: boolean;
  /** quanto a mesa vale por jogador (0 = grátis) */
  valor: number;
  sentados: Record<string, SentadoTruco>;
  /** cartas no feltro: a cadeira de quem jogou e a vaza */
  jogadas: { cadeira: number; vaza: number }[] | null;
};
export const useMesaVerde = create<Estado>()(() => ({ mesa: null, extra: 0, terminou: false, valor: 0, sentados: {}, jogadas: null }));

const FALA_MS = 2500;
const FIM_MS = 6000;
/** quando vi cada mesa em jogo pela primeira vez (a mais antiga vai para a mesa verde) */
const visto = new Map<string, number>();
/** quando vi cada mesa acabar */
const acabou = new Map<string, number>();
/** quando vi cada grito pela primeira vez (lugar:hora do grito) */
const gritos = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** O que vai para a mesa verde a partir de uma mesa do truco (pura: o tempo vem de fora). */
export function sentadosNaMesa(m: MesaPub, gritoVisivel: (lugar: number, at: number) => boolean): Record<string, SentadoTruco> {
  const out: Record<string, SentadoTruco> = {};
  m.lugares.forEach((l, i) => {
    if (!l?.fid) return;
    const f = m.falas?.[i];
    out[l.fid] = {
      cadeira: lugarNaMesaVerde(m.modo, i),
      cartas: m.fase === "jogo" && m.h && !m.h.fim ? Math.max(0, Math.min(3, m.h.nc?.[i] ?? 0)) : 0,
      fala: f && gritoVisivel(i, f.at) ? String(f.txt).slice(0, 24) : null,
    };
  });
  return out;
}

function atualizar() {
  const { mesas, valores } = useTruco.getState();
  const agora = Date.now();
  let prox = Infinity;
  for (const m of mesas) {
    if (m.fase === "jogo" && !visto.has(m.id)) visto.set(m.id, agora);
    if (m.fase === "fim" && visto.has(m.id) && !acabou.has(m.id)) acabou.set(m.id, agora);
    if (m.fase === "jogo") acabou.delete(m.id); /* revanche */
  }
  const valendo = mesas.filter((m) => m.fase === "jogo" || (m.fase === "fim" && agora - (acabou.get(m.id) ?? -Infinity) < FIM_MS));
  valendo.sort((a, b) => (visto.get(a.id) ?? agora) - (visto.get(b.id) ?? agora));
  const mesa = valendo[0] ?? null;
  for (const m of valendo) if (m.fase === "fim") prox = Math.min(prox, (acabou.get(m.id) ?? agora) + FIM_MS);

  const gritoVisivel = (lugar: number, at: number) => {
    const k = `${mesa?.id}:${lugar}:${at}`;
    if (!gritos.has(k)) gritos.set(k, agora);
    const fim = gritos.get(k)! + FALA_MS;
    if (fim > agora) prox = Math.min(prox, fim);
    return fim > agora;
  };
  const sentados = mesa ? sentadosNaMesa(mesa, gritoVisivel) : {};
  const jogadas =
    mesa && mesa.fase === "jogo" && mesa.h
      ? mesa.h.vazas.flatMap((v, vi) => v.cartas.map((c) => ({ cadeira: lugarNaMesaVerde(mesa.modo, c.s), vaza: vi })))
      : null;
  useMesaVerde.setState({
    mesa,
    extra: Math.max(0, valendo.filter((m) => m.fase === "jogo").length - 1),
    terminou: mesa?.fase === "fim",
    valor: mesa ? (valores[mesa.id] ?? 0) : 0,
    sentados,
    jogadas,
  });
  clearTimeout(timer);
  if (prox < Infinity) timer = setTimeout(atualizar, Math.max(50, prox - agora + 20));
}

let ligado = false;
/** Começa a acompanhar o truco (o K-FOFO chama uma vez). */
export function iniciarMesaVerde() {
  if (ligado) return;
  ligado = true;
  useTruco.subscribe((s, a) => {
    if (s.mesas !== a.mesas || s.valores !== a.valores) atualizar();
  });
  atualizar();
}
