/*
 * Quarto próprio (fase 35): a grade de andar e sentar de um quarto, como a do hall (hall.ts), mas montada com o
 * tamanho e os móveis de cada um. Regra pura, sem React: quem chama passa os móveis já com o piso (paraCena).
 */
import { caminho, type Piso, type PosHall, type Sentido } from "@/features/hall/hall";
import type { EstadoMovel } from "./interativo";
import type { Retangulo } from "./quarto";

/** Um móvel colocado, pronto para a grade (o mesmo formato do MovelCena). */
export type MovelGrade = { id: number; desenho: string; ret: Retangulo; giro: boolean; estado?: EstadoMovel };
/** Um lugar para sentar num móvel do quarto: o centro (fracionário), o piso de onde senta e para onde olha. */
export type AssentoQuarto = { id: string; movel: number; i: number; j: number; chegar: Piso; olha: Sentido };
export type Grade = { tam: number; livre: (i: number, j: number) => boolean; assentos: AssentoQuarto[] };

/** móveis de sentar: um lugar por piso da largura, sentando pela frente */
export const SENTAVEIS: ReadonlySet<string> = new Set(["cama", "cama-casal", "sofa", "poltrona", "puff", "cadeira-gamer", "cadeira-trono", "banco-praca", "vaso", "cadeira-vermelha", "cama-baixa", "cadeira-gamer-vermelha"]);
/** tapete não bloqueia: dá para andar por cima */
const PISAVEL = (desenho: string) => desenho.startsWith("tapete");

export function gradeDoQuarto(tam: number, moveis: readonly MovelGrade[]): Grade {
  const ocupado = new Set<string>();
  for (const m of moveis) {
    if (PISAVEL(m.desenho)) continue;
    for (let i = m.ret.i; i < m.ret.i + m.ret.w; i++) for (let j = m.ret.j; j < m.ret.j + m.ret.d; j++) ocupado.add(`${i},${j}`);
  }
  const livre = (i: number, j: number) => Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < tam && j < tam && !ocupado.has(`${i},${j}`);
  const assentos: AssentoQuarto[] = [];
  for (const m of moveis) {
    if (!SENTAVEIS.has(m.desenho)) continue;
    const r = m.ret;
    /* a frente é o lado +j sem giro e +i com giro (Moveis.tsx); quem senta chega pelo piso da frente */
    const n = m.giro ? r.d : r.w;
    for (let k = 0; k < n; k++) {
      const a: AssentoQuarto = m.giro
        ? { id: `q${m.id}-${k}`, movel: m.id, i: r.i + r.w * 0.55, j: r.j + k + 0.5, chegar: { i: r.i + r.w, j: r.j + k }, olha: "frente-direita" }
        : { id: `q${m.id}-${k}`, movel: m.id, i: r.i + k + 0.5, j: r.j + r.d * 0.55, chegar: { i: r.i + k, j: r.j + r.d }, olha: "frente-esquerda" };
      if (livre(a.chegar.i, a.chegar.j)) assentos.push(a);
    }
  }
  return { tam, livre, assentos };
}

export const assentoDoQuarto = (g: Grade, id: unknown) => (typeof id === "string" ? (g.assentos.find((a) => a.id === id) ?? null) : null);

/** Confere uma posição vinda da sala com a grade do quarto: piso livre e, se sentado, um assento que sai dali. */
export function posQuarto(v: unknown, g: Grade): PosHall | null {
  if (!v || typeof v !== "object") return null;
  const { i, j, s } = v as Record<string, unknown>;
  if (!Number.isInteger(i) || !Number.isInteger(j) || !g.livre(i as number, j as number)) return null;
  const a = assentoDoQuarto(g, s);
  return a && a.chegar.i === i && a.chegar.j === j ? { i: i as number, j: j as number, s: a.id } : { i: i as number, j: j as number };
}

/** O piso livre mais perto (um móvel caiu em cima de mim): procura em volta, passando por cima dos móveis. */
export function pisoLivreMaisPerto(de: Piso, g: Grade): Piso | null {
  if (g.livre(de.i, de.j)) return { ...de };
  const visto = new Set([`${de.i},${de.j}`]);
  const fila: Piso[] = [de];
  while (fila.length) {
    const a = fila.shift()!;
    for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const b = { i: a.i + di, j: a.j + dj };
      const k = `${b.i},${b.j}`;
      if (visto.has(k) || b.i < 0 || b.j < 0 || b.i >= g.tam || b.j >= g.tam) continue;
      visto.add(k);
      if (g.livre(b.i, b.j)) return b;
      fila.push(b);
    }
  }
  return null;
}

/** Menor caminho dentro do quarto. */
export const caminhoNoQuarto = (g: Grade, de: Piso, para: Piso) => caminho(de, para, g.livre);
