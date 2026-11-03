/*
 * Moedas: os números do PLANO, espelhando o SQL (supabase/sql/seguranca.sql, seção 7).
 * Servem só para MOSTRAR na tela; quem decide quanto cada um ganha é o banco.
 */
export const SALDO_INICIAL = 200;
export const BONUS_BASE = 30;
export const MULT_MAX = 2;
/** 5 moedas (seção 45; antes 1) a cada 6 minutos com o site aberto, sem teto por dia (desde 02/11/2026) */
export const MOEDAS_POR_VEZ = 5;
export const MIN_POR_MOEDA = 6;

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
  aposta: "aposta na partida",
  trofeu: "troféu da semana",
  churrasco: "pegou um espetinho",
  missao: "missão do dia",
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
  zoeira: "Zoeira no K-FOFO",
  trofeu: "Troféu da semana",
  churrasco: "Espetinho do churrasco",
  missao: "Missão do dia",
  bolsa: "Bolsa Nanica",
};

/** Bolsa Nanica (seção 36 do SQL; antes Bolsa Cassino): abaixo disto, o botão do K-FOFO pede e o banco dá 5.000 uma vez por dia. */
export const BOLSA_ABAIXO_DE = 100;

/* ---------- ranking ---------- */
export type LinhaRanking = { fid: string; nome: string; userId: string | null; saldo: number | null; pos: number | null };

/**
 * Ranking das moedas: do mais rico ao mais pobre (no empate, por nome). Empatados dividem a posição
 * ("5º, 5º, 7º"). Quem ainda não tem carteira vai para o fim, sem posição.
 */
export function ranking(
  carteiras: readonly { userId: string; saldo: number }[],
  friends: readonly { id: string; name: string; user_id?: string | null; tipo?: string }[],
): LinhaRanking[] {
  const saldo = new Map(carteiras.map((c) => [c.userId, c.saldo]));
  /* amigo que saiu (inativo) não entra no ranking */
  const linhas: LinhaRanking[] = friends.filter((f) => f.tipo !== "inativo").map((f) => {
    const s = f.user_id ? saldo.get(f.user_id) : undefined;
    return { fid: f.id, nome: f.name, userId: f.user_id ?? null, saldo: s ?? null, pos: null };
  });
  const porNome = (a: LinhaRanking, b: LinhaRanking) => a.nome.localeCompare(b.nome, "pt-BR");
  const com = linhas.filter((l) => l.saldo !== null).sort((a, b) => b.saldo! - a.saldo! || porNome(a, b));
  const sem = linhas.filter((l) => l.saldo === null).sort(porNome);
  com.forEach((l, i) => (l.pos = i > 0 && com[i - 1].saldo === l.saldo ? com[i - 1].pos : i + 1));
  return [...com, ...sem];
}

/** Minha posição no ranking (null sem carteira ou sem o ranking carregado). */
export const posicaoDe = (lista: readonly LinhaRanking[], userId: string | null) => (userId ? (lista.find((l) => l.userId === userId)?.pos ?? null) : null);

export const ordinal = (n: number) => `${n}º`;

/* ---------- presença na ficha (sequência e tempo online) ---------- */
/** 45 → "45 min", 80 → "1 h 20 min", 540 → "9 h". */
export function textoTempo(min: number) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** Dias até o próximo prêmio da sequência (7º e 30º dia); null depois do 30. */
export function faltaParaPremio(seq: number): { dias: number; premio: 7 | 30 } | null {
  if (seq < 7) return { dias: 7 - seq, premio: 7 };
  if (seq < 30) return { dias: 30 - seq, premio: 30 };
  return null;
}

/** Entrou ontem e ainda não hoje: a sequência vale, mas some se não entrar hoje. */
export const sequenciaEmRisco = (seq: number, pegouHoje: boolean) => seq > 0 && !pegouHoje;
