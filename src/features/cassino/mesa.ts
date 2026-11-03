/*
 * Mesas ao vivo (seção 32 do seguranca.sql): roleta, aviãozinho e pênalti em rodadas para todo mundo junto.
 * Aqui só o que é regra pura: ler o estado que o banco manda, o relógio do banco, os tempos e as contas do pênalti.
 * Quem decide fase, sorteio e pagamento é o banco; o site só mostra.
 */
import { conferir, hashDaSemente } from "./regras";

export type JogoMesa = "roleta" | "aviao" | "penalti";
export type Fase = "parada" | "apostas" | "jogo" | "resultado";
export type Pessoa = {
  nome: string;
  eu: boolean;
  aposta: number;
  estado: string;
  pagou: number;
  sacou?: number | null;
  fichas?: number | null;
  /* pênalti */
  gols?: number;
  mult?: number;
  chutou?: boolean;
  zona?: number | null;
  gol?: boolean | null;
};
export type Rodada = {
  id: number;
  hash: string;
  abreEm: number;
  fechaEm: number;
  fimEm: number | null;
  resultado: Record<string, unknown> | null;
  segredo: string | null;
};
export type EstadoMesa = {
  jogo: JogoMesa;
  fase: Fase;
  /** relógio do banco no momento da resposta (ms) */
  agora: number;
  rodada: Rodada | null;
  gente: Pessoa[];
  meu: Record<string, unknown> | null;
  ultimos: Record<string, unknown>[];
};

/** Tempo de apostas de cada mesa (igual a mesa_janela no SQL), só para a barra de contagem. */
export const JANELA_MS: Record<JogoMesa, number> = { roleta: 15000, aviao: 8000, penalti: 10000 };

const FASES: Fase[] = ["parada", "apostas", "jogo", "resultado"];
const ms = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Confere o que veio do banco (mesa_estado) e põe nos tipos do site; algo estranho → null. */
export function lerEstado(d: unknown): EstadoMesa | null {
  const o = obj(d);
  if (!o || (o.jogo !== "roleta" && o.jogo !== "aviao" && o.jogo !== "penalti")) return null;
  const fase = FASES.includes(o.fase as Fase) ? (o.fase as Fase) : "parada";
  const agora = ms(o.agora);
  if (!Number.isFinite(agora)) return null;
  const r = obj(o.rodada);
  const rodada: Rodada | null =
    r && Number.isFinite(Number(r.id)) && Number.isFinite(ms(r.fecha_em))
      ? {
          id: Number(r.id),
          hash: typeof r.hash === "string" ? r.hash : "",
          abreEm: ms(r.abre_em),
          fechaEm: ms(r.fecha_em),
          fimEm: Number.isFinite(ms(r.fim_em)) ? ms(r.fim_em) : null,
          resultado: obj(r.resultado),
          segredo: typeof r.segredo === "string" ? r.segredo : null,
        }
      : null;
  const gente = Array.isArray(o.gente)
    ? o.gente
        .map(obj)
        .filter((p): p is Record<string, unknown> => !!p)
        .slice(0, 40)
        .map((p) => ({
          nome: typeof p.nome === "string" ? p.nome.slice(0, 30) : "Alguém",
          eu: p.eu === true,
          aposta: Number(p.aposta) || 0,
          estado: typeof p.estado === "string" ? p.estado : "aberta",
          pagou: Number(p.pagou) || 0,
          sacou: p.sacou == null ? null : Number(p.sacou),
          fichas: p.fichas == null ? null : Number(p.fichas),
          gols: p.gols == null ? undefined : Number(p.gols),
          mult: p.mult == null ? undefined : Number(p.mult),
          chutou: p.chutou === true,
          zona: p.zona == null ? null : Number(p.zona),
          gol: typeof p.gol === "boolean" ? p.gol : null,
        }))
    : [];
  return {
    jogo: o.jogo,
    fase,
    agora,
    rodada,
    gente,
    meu: obj(o.meu),
    ultimos: Array.isArray(o.ultimos) ? o.ultimos.map(obj).filter((x): x is Record<string, unknown> => !!x).slice(0, 15) : [],
  };
}

/** Quanto o relógio do banco está à frente do aparelho (ms), pela resposta que acabou de chegar. */
export const diferencaRelogio = (agoraBanco: number, recebidoEm: number) => agoraBanco - recebidoEm;

/** Segundos que faltam até `ate` (relógio do banco), nunca negativo. */
export const faltam = (ate: number, agoraBanco: number) => Math.max(0, Math.ceil((ate - agoraBanco) / 1000));

/** Quanto da janela de apostas já passou (0 a 1), para a barra que esvazia. */
export function passouDaJanela(r: Rodada | null, agoraBanco: number): number {
  if (!r) return 0;
  const total = r.fechaEm - r.abreEm;
  return total > 0 ? Math.min(1, Math.max(0, (agoraBanco - r.abreEm) / total)) : 1;
}

/* ---------- pênalti ---------- */
/** Gols seguidos que pagam no máximo (no 5º a série acaba e paga sozinha). */
export const MAX_GOLS = 5;
/** Multiplicador depois de `g` gols: 0,97 ÷ (2/3)^g, para baixo em 2 casas (igual ao penalti_mult do SQL). */
export function multPenalti(g: number): number {
  if (g <= 0) return 1;
  return Math.floor((0.97 / Math.pow(2 / 3, g)) * 100 + 1e-9) / 100;
}
/** As 6 zonas do gol: 0–2 em cima (esquerda, meio, direita), 3–5 embaixo. O goleiro cobre uma coluna. */
export const colunaDa = (zona: number) => zona % 3;
export const alturaDa = (zona: number) => (zona < 3 ? "alto" : "baixo");
export const ehGol = (zona: number, colunaGoleiro: number) => colunaDa(zona) !== colunaGoleiro;

/* ---------- conferência da rodada ---------- */
/** Confere uma rodada que já acabou: o segredo bate com o hash e refaz o número da rodada (mesma conta do motor). */
export async function conferirRodada(jogo: JogoMesa, r: Rodada): Promise<{ hashOk: boolean; u: number } | null> {
  if (!r.segredo) return null;
  return { hashOk: (await hashDaSemente(r.segredo)) === r.hash, u: await conferir(r.segredo, jogo, r.id) };
}
