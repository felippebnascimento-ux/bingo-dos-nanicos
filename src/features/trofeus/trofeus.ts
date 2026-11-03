/*
 * Hall da fama da semana na tela (puro e testado): o que é cada troféu, o pódio a partir das linhas do banco
 * e como escrever o número. Quem calcula é a função riot-semana (supabase/functions/riot-semana/calculo.ts):
 * o LoL pelo op.gg (Riot) e o CS2 pelo Leetify. Os troféus antigos (feeder, piano…) ficaram só no banco.
 */

export type TrofeuId = "lol_vitorias" | "lol_derrotas" | "lol_kda" | "cs_vitorias" | "cs_derrotas" | "cs_kda" | "rico";
export type Trofeu = {
  id: TrofeuId;
  /** de que jogo (o mais rico é do site) */
  jogo: "lol" | "cs" | "site";
  nome: string;
  /** como se ganha */
  frase: string;
  /** prêmio ou castigo */
  premio: string;
  /** vergonha (castigo) ou glória (prêmio) */
  vergonha: boolean;
};

export const TROFEUS: readonly Trofeu[] = [
  { id: "lol_vitorias", jogo: "lol", nome: "Mais venceu", frase: "Mais vitórias no LoL na semana", premio: "+100 moedas", vergonha: false },
  { id: "lol_kda", jogo: "lol", nome: "Melhor KDA", frase: "Melhor KDA no LoL, com pelo menos 3 partidas", premio: "+100 moedas e coroa dourada", vergonha: false },
  { id: "lol_derrotas", jogo: "lol", nome: "Mais perdeu", frase: "Mais derrotas no LoL na semana", premio: "Chapéu de burro a semana inteira", vergonha: true },
  { id: "cs_vitorias", jogo: "cs", nome: "Mais venceu", frase: "Mais vitórias no CS2 na semana", premio: "+100 moedas", vergonha: false },
  { id: "cs_kda", jogo: "cs", nome: "Melhor KDA", frase: "Melhor KDA no CS2, com pelo menos 3 partidas", premio: "+100 moedas e coroa dourada", vergonha: false },
  { id: "cs_derrotas", jogo: "cs", nome: "Mais perdeu", frase: "Mais derrotas no CS2 na semana", premio: "Chapéu de burro a semana inteira", vergonha: true },
  { id: "rico", jogo: "site", nome: "Mais rico", frase: "Maior saldo de moedas agora", premio: "Coroa de moedas enquanto for o mais rico", vergonha: false },
];

export type LinhaTrofeu = { semana: string; trofeu: TrofeuId; posicao: number; fid: string; valor: number; partidas: number };

/** Pódio (até 3) de um troféu numa semana, em ordem de posição. */
export const podio = (linhas: readonly LinhaTrofeu[], trofeu: TrofeuId, semana: string) =>
  linhas.filter((l) => l.trofeu === trofeu && l.semana === semana && l.posicao >= 1 && l.posicao <= 3).sort((a, b) => a.posicao - b.posicao);

const num = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** "12 vitórias", "1 derrota", "KDA 4,80", "1.284 moedas". */
export function formatarValor(trofeu: TrofeuId, valor: number) {
  if (trofeu === "rico") return `${num(valor, 0)} moedas`;
  if (trofeu.endsWith("_kda")) return `KDA ${num(valor, 2)}`;
  if (trofeu.endsWith("_vitorias")) return `${num(valor, 0)} ${valor === 1 ? "vitória" : "vitórias"}`;
  return `${num(valor, 0)} ${valor === 1 ? "derrota" : "derrotas"}`;
}

/** "26/10 a 01/11" a partir da segunda-feira (AAAA-MM-DD). */
export function rotuloSemana(segunda: string) {
  const ini = new Date(segunda + "T12:00:00Z");
  const fim = new Date(ini.getTime() + 6 * 86400 * 1000);
  const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${dm(ini)} a ${dm(fim)}`;
}

/** Enfeite de cabeça: chapéu de burro (quem mais perdeu), coroa dourada (melhor KDA, vale mais) e coroa de moedas (mais rico). */
export type Enfeite = "burro" | "coroa" | "moedas";
export function enfeites(linhas: readonly LinhaTrofeu[], semana: string | null, maisRico: string | null): Record<string, Enfeite> {
  const out: Record<string, Enfeite> = {};
  if (semana) {
    for (const t of ["lol_derrotas", "cs_derrotas"] as const) {
      const p = podio(linhas, t, semana)[0];
      if (p) out[p.fid] = "burro";
    }
    for (const t of ["lol_kda", "cs_kda"] as const) {
      const p = podio(linhas, t, semana)[0];
      if (p) out[p.fid] = "coroa";
    }
  }
  /* a coroa de moedas vale mais que as outras: é de agora */
  if (maisRico) out[maisRico] = "moedas";
  return out;
}
