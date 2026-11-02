/* Regras do bingo: quais nanicadas valem para a escalação, sorteio e marcação da cartela. */
import type { Card, Cell, Friend, LineupSlot, Phrase } from "./tipos";
import { getApp, setApp } from "./store";
import { local, norm, shuffle } from "./util";
import { toast } from "./toast";

/** As 12 linhas da cartela 5×5: 5 linhas, 5 colunas e 2 diagonais. */
export const LINES: number[][] = (() => {
  const L: number[][] = [];
  for (let i = 0; i < 5; i++) {
    L.push([0, 1, 2, 3, 4].map((j) => i * 5 + j));
    L.push([0, 1, 2, 3, 4].map((j) => j * 5 + i));
  }
  L.push([0, 6, 12, 18, 24]);
  L.push([4, 8, 12, 16, 20]);
  return L;
})();

export const linhasFeitas = (card: Card | null) =>
  card ? LINES.filter((l) => l.every((i) => card.marked[i])) : [];

export const bingoLines = (card: Card | null) => linhasFeitas(card).length;

export const champsOf = (p: { champions?: unknown; champion?: unknown }): string[] =>
  Array.isArray(p.champions)
    ? (p.champions.filter(Boolean) as string[])
    : p.champion
      ? [String(p.champion)]
      : [];

export type Elegivel = Phrase & { hitF: string[]; hit: string[] };

/*
 * Quando cada nanicada entra na cartela:
 * - "qualquer": só nanicos → um deles jogando; só campeões → um deles na partida;
 *               nanicos + campeões → um desses nanicos jogando com um desses campeões
 * - "todos":    todos os nanicos jogando E todos os campeões na partida
 */
export function matchPhrase(
  p: Phrase,
  pl: LineupSlot[],
  fs: Set<string>,
  cs: Set<string>,
): { gen: true } | { f: string[]; c: string[] } | null {
  const N = p.friendIds || [],
    C = champsOf(p);
  if (!N.length && !C.length) return { gen: true };
  if (p.modo === "todos") {
    if (!N.every((id) => fs.has(id)) || !C.every((c) => cs.has(norm(c)))) return null;
    return { f: N.slice(), c: C.slice() };
  }
  if (N.length && C.length) {
    const hit = pl.filter((x) => N.includes(x.friendId) && C.some((c) => norm(c) === norm(x.champion)));
    if (!hit.length) return null;
    return {
      f: [...new Set(hit.map((x) => x.friendId))],
      c: C.filter((c) => hit.some((x) => norm(x.champion) === norm(c))),
    };
  }
  const fh = N.filter((id) => fs.has(id)),
    ch = C.filter((c) => cs.has(norm(c)));
  if (N.length ? !fh.length : !ch.length) return null;
  return { f: fh, c: ch };
}

/** Nanicadas que valem agora: `spec` (da partida) e `gen` (genéricas). */
export function eligible(phrases: Phrase[], lineup: LineupSlot[]) {
  const pl = lineup.filter((p) => p.friendId);
  const fs = new Set(pl.map((p) => p.friendId).filter(Boolean));
  const cs = new Set(pl.map((p) => norm(p.champion)).filter(Boolean));
  const spec: Elegivel[] = [],
    gen: Phrase[] = [];
  for (const p of phrases) {
    const m = matchPhrase(p, pl, fs, cs);
    if (!m) continue;
    if ("gen" in m) gen.push(p);
    else spec.push({ ...p, hitF: m.f, hit: m.c });
  }
  return { spec, gen };
}

/** Transforma nanicadas escolhidas em casas da cartela (a do meio é LIVRE). */
export function cellsDe(pick: (Phrase & { hitF?: string[]; hit?: string[] })[], friends: Friend[]): Cell[] {
  const cells: Cell[] = pick.map((p) => {
    const ids = p.hitF || [];
    return {
      text: p.text,
      friendIds: ids,
      fnames: ids.map((id) => friends.find((f) => f.id === id)?.name || ""),
      champs: (p.hit || []).join("/"),
      rot: Math.round(Math.random() * 24 - 12),
    };
  });
  cells.splice(12, 0, { free: true, text: "LIVRE" });
  return cells;
}

/** Sorteia 24 nanicadas: até 16 da partida e o resto genéricas. */
export function sortear(spec: Elegivel[], gen: Phrase[], rnd: () => number = Math.random) {
  const s = shuffle(spec, rnd),
    g = shuffle(gen, rnd);
  let pick: (Phrase | Elegivel)[] = s.slice(0, 16);
  pick = pick.concat(g.slice(0, 24 - pick.length));
  if (pick.length < 24) pick = pick.concat(s.slice(16, 16 + 24 - pick.length));
  return shuffle(pick, rnd).slice(0, 24);
}

/* ---------- ações na cartela (salvam no navegador em "rift-card") ---------- */

export function definirCartela(card: Card | null) {
  setApp({ card });
  local.setJson("rift-card", card);
}

export function novaCartela(cells: Cell[]) {
  definirCartela({ cells, marked: cells.map((c) => !!c.free) });
}

export function toggleCell(i: number) {
  const card = getApp().card;
  if (!card || card.cells[i]?.free) return;
  const before = bingoLines(card);
  const marked = card.marked.slice();
  marked[i] = !marked[i];
  const novo = { ...card, marked };
  definirCartela(novo);
  if (bingoLines(novo) > before) toast("BINGO! Grita no Discord.");
}

export function limparMarcacoes() {
  const card = getApp().card;
  if (card) definirCartela({ ...card, marked: card.cells.map((c) => !!c.free) });
}
