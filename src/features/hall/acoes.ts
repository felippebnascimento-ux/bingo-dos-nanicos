/*
 * Ações do boneco (como no Habbo): acenar, dançar e deitar. É um evento de momento: vai pelo evento `hall` do lobby
 * (`{ acao, q }`), conferido como o destino, e não entra na presença (quem chega depois vê o boneco parado).
 * Sem moedas e sem banco: se alguém forjar uma ação, o pior que acontece é o próprio boneco dançar.
 * Andar cancela qualquer ação; acenar acaba sozinho.
 */
import { create } from "zustand";

export type Acao = "acena" | "danca" | "deita";

export const ACOES: readonly { id: Acao; nome: string; icone: string; ms: number }[] = [
  { id: "acena", nome: "Acenar", icone: "👋", ms: 2600 },
  { id: "danca", nome: "Dançar", icone: "🎵", ms: 5 * 60_000 },
  { id: "deita", nome: "Deitar", icone: "💤", ms: 30 * 60_000 },
];

/** Confere uma ação vinda da sala: só os ids da lista. */
export const lerAcao = (v: unknown): Acao | null => (ACOES.some((a) => a.id === v) ? (v as Acao) : null);

/** Atalhos no chat do K-FOFO: "o/" acena, ":dançar" dança, ":deitar" deita (sem acento e maiúscula também valem). */
export function comandoAcao(texto: string): Acao | null {
  const t = texto.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t === "o/" || t === "\\o" || t === ":acenar" || t === ":tchau") return "acena";
  if (t === ":dancar" || t === ":danca") return "danca";
  if (t === ":deitar" || t === ":dormir") return "deita";
  return null;
}

type Em = { tipo: Acao; ate: number };
/** a ação de cada boneco (chave do boneco, a mesma de `useHall`) */
export const useAcoes = create<{ por: Record<string, Em> }>()(() => ({ por: {} }));

/** Marca a ação de um boneco; acaba sozinha no tempo dela. */
export function marcarAcao(key: string, tipo: Acao) {
  const ate = Date.now() + (ACOES.find((a) => a.id === tipo)?.ms ?? 3000);
  useAcoes.setState((s) => ({ por: { ...s.por, [key]: { tipo, ate } } }));
  setTimeout(() => {
    if (useAcoes.getState().por[key]?.ate === ate) pararAcao(key);
  }, ate - Date.now() + 20);
}

/** Tira a ação de um boneco (andou, saiu da cena). */
export function pararAcao(key: string) {
  if (!useAcoes.getState().por[key]) return;
  useAcoes.setState((s) => {
    const por = { ...s.por };
    delete por[key];
    return { por };
  });
}

/** A ação que vale agora para um boneco (null se nenhuma). */
export const useAcaoDe = (key: string) => useAcoes((s) => s.por[key]?.tipo ?? null);

export const iconeAcao = (a: Acao) => ACOES.find((x) => x.id === a)?.icone ?? "";
