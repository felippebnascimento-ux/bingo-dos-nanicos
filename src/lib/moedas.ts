/*
 * Moedas: os números do PLANO, espelhando o SQL (supabase/sql/seguranca.sql, seção 7).
 * Servem só para MOSTRAR na tela; quem decide quanto cada um ganha é o banco.
 */
export const SALDO_INICIAL = 200;
export const BONUS_BASE = 30;
export const MULT_MAX = 2;
export const MIN_POR_MOEDA = 6;
export const TETO_ONLINE = 40;
export const MIN_TETO = MIN_POR_MOEDA * TETO_ONLINE;

/** Multiplicador do bônus no dia `seq` da sequência: +0,1 por dia, até ×2 (dia 11). */
export const multiplicador = (seq: number) => Math.min(1 + 0.1 * (Math.max(1, seq) - 1), MULT_MAX);

/** Bônus do dia `seq` (30 no 1º dia, 60 a partir do 11º). */
export const bonusDoDia = (seq: number) => Math.round(BONUS_BASE * multiplicador(seq));

/** Prêmio extra da sequência: +100 no 7º dia e +500 no 30º. */
export const premioSequencia = (seq: number) => (seq === 7 ? 100 : seq === 30 ? 500 : 0);

/** 1240 → "1.240". */
export const formatarMoedas = (n: number) => {
  const s = String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? "-" + s : s;
};

export const diasSeguidos = (seq: number) => `${seq} ${seq === 1 ? "dia" : "dias"} seguido${seq === 1 ? "" : "s"}`;

/** Texto do aviso ao ganhar o bônus do dia. */
export function textoBonus(ganhou: number, extra: number, seq: number) {
  const base = `+${formatarMoedas(ganhou)} moedas`;
  if (extra) return `${base} e +${formatarMoedas(extra)} de prêmio: ${diasSeguidos(seq)}`;
  return seq > 1 ? `${base}: ${diasSeguidos(seq)}` : `${base}: bônus do dia`;
}

/** Por que alguém ganhou moedas, para o aviso de ganhos do Sítio. Motivo desconhecido fica sem texto. */
export const MOTIVO_GANHO: Readonly<Record<string, string>> = {
  inicio: "carteira nova",
  diario: "bônus do dia",
  sequencia: "prêmio da sequência",
  online: "tempo online",
  truco: "venceu no truco",
  bingo: "bingo!",
  cassino: "ganhou no cassino",
  aposta: "acertou a aposta",
  admin: "presente do admin",
};
export const motivoGanho = (m: string | null | undefined) => (m && MOTIVO_GANHO[m]) || "";

/** Nome de cada motivo do extrato, para a tela. */
export const MOTIVOS: Readonly<Record<string, string>> = {
  inicio: "Carteira nova",
  diario: "Bônus do dia",
  sequencia: "Prêmio da sequência",
  online: "Tempo no site",
  cassino: "Cassino",
  bingo: "Bingo",
  truco: "Truco",
  aposta: "Aposta",
  loja: "Loja",
  admin: "Ajuste do admin",
};
