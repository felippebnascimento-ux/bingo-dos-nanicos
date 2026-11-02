/*
 * Troféus da semana na tela (puro e testado): o que é cada troféu, o pódio a partir das linhas do banco
 * e como escrever o número. Quem calcula é a função riot-semana (supabase/functions/riot-semana/calculo.ts).
 */

export type TrofeuId = "feeder" | "turista" | "piano" | "viciado" | "sumido" | "rico";
export type Trofeu = {
  id: TrofeuId;
  nome: string;
  /** como se ganha */
  frase: string;
  /** prêmio ou castigo */
  premio: string;
  /** vergonha (castigo) ou glória (prêmio) */
  vergonha: boolean;
};

export const TROFEUS: readonly Trofeu[] = [
  { id: "feeder", nome: "Feeder da semana", frase: "Mais mortes por partida", premio: "Chapéu de burro a semana inteira", vergonha: true },
  { id: "piano", nome: "Carregou o piano", frase: "Melhor KDA, com pelo menos 5 partidas", premio: "+50 moedas e coroa dourada", vergonha: false },
  { id: "viciado", nome: "Viciado", frase: "Quem jogou mais partidas", premio: "+20 moedas", vergonha: false },
  { id: "turista", nome: "Turista", frase: "Menor placar de visão por minuto", premio: "Só a vergonha", vergonha: true },
  { id: "sumido", nome: "Sumido", frase: "Jogou a semana toda sem ninguém do grupo", premio: "Só a vergonha", vergonha: true },
  { id: "rico", nome: "Mais rico", frase: "Maior saldo de moedas agora", premio: "Coroa de moedas enquanto for o mais rico", vergonha: false },
];

export type LinhaTrofeu = { semana: string; trofeu: TrofeuId; posicao: number; fid: string; valor: number; partidas: number };

/** Pódio (até 3) de um troféu numa semana, em ordem de posição. */
export const podio = (linhas: readonly LinhaTrofeu[], trofeu: TrofeuId, semana: string) =>
  linhas.filter((l) => l.trofeu === trofeu && l.semana === semana && l.posicao >= 1 && l.posicao <= 3).sort((a, b) => a.posicao - b.posicao);

const num = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** "9,1 mortes por partida", "0,42 de visão por minuto", "KDA 4,80", "31 partidas", "1.284 moedas". */
export function formatarValor(trofeu: TrofeuId, valor: number) {
  switch (trofeu) {
    case "feeder":
      return `${num(valor, 1)} mortes por partida`;
    case "turista":
      return `${num(valor, 2)} de visão por minuto`;
    case "piano":
      return `KDA ${num(valor, 2)}`;
    case "rico":
      return `${num(valor, 0)} moedas`;
    default:
      return `${num(valor, 0)} ${valor === 1 ? "partida" : "partidas"}`;
  }
}

/** "26/10 a 01/11" a partir da segunda-feira (AAAA-MM-DD). */
export function rotuloSemana(segunda: string) {
  const ini = new Date(segunda + "T12:00:00Z");
  const fim = new Date(ini.getTime() + 6 * 86400 * 1000);
  const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${dm(ini)} a ${dm(fim)}`;
}

/** Enfeite de cabeça de cada nanico: chapéu de burro (Feeder), coroa dourada (piano) e coroa de moedas (mais rico). */
export type Enfeite = "burro" | "coroa" | "moedas";
export function enfeites(linhas: readonly LinhaTrofeu[], semana: string | null, maisRico: string | null): Record<string, Enfeite> {
  const out: Record<string, Enfeite> = {};
  if (semana) {
    const feeder = podio(linhas, "feeder", semana)[0];
    const piano = podio(linhas, "piano", semana)[0];
    if (feeder) out[feeder.fid] = "burro";
    if (piano) out[piano.fid] = "coroa";
  }
  /* a coroa de moedas vale mais que as outras: é de agora */
  if (maisRico) out[maisRico] = "moedas";
  return out;
}
