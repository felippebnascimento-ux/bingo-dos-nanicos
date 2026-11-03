/*
 * Pênalti x1 (seção 48 do seguranca.sql): duelo de pênaltis entre dois membros, valendo moedas. Aqui ficam as contas
 * que a tela precisa, puras e testadas em dueloRegras.test.ts: os cantos, quem bate em cada cobrança, se o duelo já está
 * decidido (a mesma conta do duelo_decidido do banco), as bolinhas do placar e a leitura segura do que o banco
 * mandou. Quem decide é o banco: guarda as escolhas em segredo, sorteia para quem não escolheu e paga.
 */

/** Os 5 cantos, na ordem da grade do gol: em cima à esquerda, em cima à direita, embaixo à esquerda, meio, embaixo à direita. */
export const ZONAS = ["sup_esq", "sup_dir", "esq", "meio", "dir"] as const;
export type Zona = (typeof ZONAS)[number];
export const NOME_ZONA: Record<Zona, string> = {
  sup_esq: "no alto à esquerda",
  sup_dir: "no alto à direita",
  esq: "embaixo à esquerda",
  meio: "no meio",
  dir: "embaixo à direita",
};
export const ehZona = (z: unknown): z is Zona => typeof z === "string" && (ZONAS as readonly string[]).includes(z);
/** a coluna do canto (0 esquerda, 1 meio, 2 direita) e se é alto, para o pulo do goleiro e a bola que espirra */
export const colunaDaZona = (z: Zona) => (z === "sup_esq" || z === "esq" ? 0 : z === "meio" ? 1 : 2);
export const zonaAlta = (z: Zona) => z === "sup_esq" || z === "sup_dir";

export const APOSTA_MIN = 10;
/** 5 cobranças para cada e até 10 pares de morte súbita */
export const COBRANCAS = 5;
export const MAX_CHUTES = 30;
export const TEMPO_CHUTE_MS = 15_000;
/** o lance fica na tela este tempo antes da próxima cobrança abrir */
export const REVELA_MS = 3_000;
/** duelo aberto sem ninguém some depois deste tempo (e a aposta volta) */
export const EXPIRA_MS = 10 * 60_000;
/** atalhos do valor da aposta */
export const ATALHOS = [10, 50, 100, 500, 1000, 5000] as const;

export type Lado = "criador" | "desafiante";
/** Quem bate a cobrança n (1, 2, …): quem abriu bate as ímpares. */
export const quemBate = (n: number): Lado => (n % 2 === 1 ? "criador" : "desafiante");

/**
 * Depois de n cobranças, com gc gols de quem abriu e gd do desafiante, o duelo já acabou? Nas 5 de cada, quando um
 * lado não alcança o outro nem fazendo todas as que faltam; na morte súbita, só no fim de cada par. (= duelo_decidido)
 */
export function decidido(n: number, gc: number, gd: number): boolean {
  const a = Math.floor((n + 1) / 2), b = Math.floor(n / 2);
  if (n <= COBRANCAS * 2) return gc + (COBRANCAS - a) < gd || gd + (COBRANCAS - b) < gc;
  return n % 2 === 0 && gc !== gd;
}

/** O duelo terminou depois desta cobrança (decidido, ou a 30ª empatada, que devolve as apostas)? */
export const acabou = (n: number, gc: number, gd: number) => decidido(n, gc, gd) || n >= MAX_CHUTES;

/** O valor da aposta é aceito: inteiro, de 10 até o saldo. */
export const apostaValida = (v: number, saldo: number | undefined) =>
  Number.isInteger(v) && v >= APOSTA_MIN && (saldo === undefined || v <= saldo);

/** Os atalhos que cabem no saldo. */
export const atalhosDo = (saldo: number | undefined) => ATALHOS.filter((v) => saldo === undefined || v <= saldo);

/* ---------- o que vem do banco ---------- */
export type EstadoDuelo = "aberto" | "jogando" | "fim" | "cancelado";
export type Chute = {
  n: number;
  batedor: string;
  goleiro: string;
  zonaBatedor: Zona;
  zonaGoleiro: Zona;
  sorteouBatedor: boolean;
  sorteouGoleiro: boolean;
  gol: boolean;
  resolvidoEm: number;
};
export type Atual = {
  n: number;
  batedor: string;
  goleiro: string;
  abreEm: number;
  ate: number;
  batedorEscolheu: boolean;
  goleiroEscolheu: boolean;
  /** o meu canto nesta cobrança (só chega para mim) */
  minha: Zona | null;
};
export type Duelo = {
  id: number;
  criador: string;
  desafiante: string | null;
  aposta: number;
  estado: EstadoDuelo;
  golsCriador: number;
  golsDesafiante: number;
  vencedor: string | null;
  expiraEm: number;
  fimEm: number | null;
  agora: number;
  chutes: Chute[];
  atual: Atual | null;
};
export type DueloLista = {
  id: number;
  criador: string;
  desafiante: string | null;
  aposta: number;
  estado: EstadoDuelo;
  golsCriador: number;
  golsDesafiante: number;
  chute: number;
  expiraEm: number;
};

const ESTADOS: readonly EstadoDuelo[] = ["aberto", "jogando", "fim", "cancelado"];
const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const inteiro = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.trunc(x) : Number.isFinite(Number(x)) ? Math.trunc(Number(x)) : 0);
const texto = (x: unknown) => (typeof x === "string" && x.length > 0 && x.length < 80 ? x : null);
const hora = (x: unknown) => {
  const t = typeof x === "string" ? Date.parse(x) : NaN;
  return Number.isFinite(t) ? t : null;
};
const estadoDe = (x: unknown): EstadoDuelo | null => (ESTADOS.includes(x as EstadoDuelo) ? (x as EstadoDuelo) : null);

function lerChute(x: unknown): Chute | null {
  const c = obj(x);
  if (!c) return null;
  const batedor = texto(c.batedor), goleiro = texto(c.goleiro), em = hora(c.resolvido_em);
  if (!batedor || !goleiro || !ehZona(c.zona_batedor) || !ehZona(c.zona_goleiro) || typeof c.gol !== "boolean" || em === null) return null;
  return {
    n: inteiro(c.n),
    batedor,
    goleiro,
    zonaBatedor: c.zona_batedor,
    zonaGoleiro: c.zona_goleiro,
    sorteouBatedor: c.sorteou_batedor === true,
    sorteouGoleiro: c.sorteou_goleiro === true,
    gol: c.gol,
    resolvidoEm: em,
  };
}

function lerAtual(x: unknown): Atual | null {
  const a = obj(x);
  if (!a) return null;
  const batedor = texto(a.batedor), goleiro = texto(a.goleiro), abreEm = hora(a.abre_em), ate = hora(a.ate);
  if (!batedor || !goleiro || abreEm === null || ate === null) return null;
  return {
    n: inteiro(a.n),
    batedor,
    goleiro,
    abreEm,
    ate,
    batedorEscolheu: a.batedor_escolheu === true,
    goleiroEscolheu: a.goleiro_escolheu === true,
    minha: ehZona(a.minha) ? a.minha : null,
  };
}

/** A resposta de duelo_estado (e de entrar, cancelar e escolher), conferida campo a campo; null se não for um duelo. */
export function lerDuelo(d: unknown): Duelo | null {
  const o = obj(d);
  if (!o) return null;
  const criador = texto(o.criador), estado = estadoDe(o.estado), agora = hora(o.agora), id = inteiro(o.id);
  if (!criador || !estado || agora === null || id <= 0) return null;
  const chutes = (Array.isArray(o.chutes) ? o.chutes : [])
    .slice(0, MAX_CHUTES)
    .map(lerChute)
    .filter((c): c is Chute => c !== null)
    .sort((a, b) => a.n - b.n);
  return {
    id,
    criador,
    desafiante: texto(o.desafiante),
    aposta: Math.max(0, inteiro(o.aposta)),
    estado,
    golsCriador: Math.max(0, inteiro(o.gols_criador)),
    golsDesafiante: Math.max(0, inteiro(o.gols_desafiante)),
    vencedor: texto(o.vencedor),
    expiraEm: hora(o.expira_em) ?? agora + EXPIRA_MS,
    fimEm: hora(o.fim_em),
    agora,
    chutes,
    atual: estado === "jogando" ? lerAtual(o.atual) : null,
  };
}

/** A resposta de duelo_lista: só os itens que fazem sentido. */
export function lerListaDuelo(d: unknown): DueloLista[] {
  if (!Array.isArray(d)) return [];
  const out: DueloLista[] = [];
  for (const x of d.slice(0, 60)) {
    const o = obj(x);
    const criador = o && texto(o.criador), estado = o && estadoDe(o.estado);
    if (!o || !criador || !estado || inteiro(o.id) <= 0) continue;
    out.push({
      id: inteiro(o.id),
      criador,
      desafiante: texto(o.desafiante),
      aposta: Math.max(0, inteiro(o.aposta)),
      estado,
      golsCriador: Math.max(0, inteiro(o.gols_criador)),
      golsDesafiante: Math.max(0, inteiro(o.gols_desafiante)),
      chute: Math.max(0, inteiro(o.chute)),
      expiraEm: hora(o.expira_em) ?? 0,
    });
  }
  return out;
}

/* ---------- a tela ---------- */
export type Papel = "batedor" | "goleiro" | "plateia";
/** O meu papel na cobrança da vez. */
export function meuPapel(d: Duelo, eu: string | null): Papel {
  if (!eu || !d.atual) return "plateia";
  return d.atual.batedor === eu ? "batedor" : d.atual.goleiro === eu ? "goleiro" : "plateia";
}
/** O meu lado no duelo (null = estou só assistindo). */
export const meuLado = (d: { criador: string; desafiante: string | null }, eu: string | null): Lado | null =>
  !eu ? null : d.criador === eu ? "criador" : d.desafiante === eu ? "desafiante" : null;

/** Bolinhas do placar de um lado: uma por cobrança dele (pelo menos 5), gol, perdeu ou ainda não bateu. */
export function bolinhas(d: Pick<Duelo, "chutes" | "criador" | "desafiante">, lado: Lado): ("gol" | "perdeu" | null)[] {
  const quem = lado === "criador" ? d.criador : d.desafiante;
  const meus = d.chutes.filter((c) => c.batedor === quem).map((c) => (c.gol ? "gol" : "perdeu") as "gol" | "perdeu");
  const total = Math.max(COBRANCAS, meus.length);
  return Array.from({ length: total }, (_, k) => meus[k] ?? null);
}

/** Momento da partida: esperando adversário, o lance ainda na tela, a vez de escolher, ou acabou. */
export type Momento = "aberto" | "lance" | "escolher" | "fim" | "cancelado";
export function momento(d: Duelo, agora: number): Momento {
  if (d.estado === "aberto" || d.estado === "cancelado") return d.estado;
  const ult = d.chutes[d.chutes.length - 1];
  if (ult && agora - ult.resolvidoEm < REVELA_MS) return "lance";
  if (d.estado === "fim") return "fim";
  if (d.atual && agora < d.atual.abreEm) return ult ? "lance" : "escolher";
  return "escolher";
}

/** Fração do tempo que ainda resta na cobrança (1 = começou agora, 0 = acabou) e os segundos inteiros. */
export function tempoRestante(a: Pick<Atual, "abreEm" | "ate">, agora: number): { fracao: number; segundos: number } {
  const total = a.ate - a.abreEm || TEMPO_CHUTE_MS;
  const falta = Math.max(0, Math.min(total, a.ate - Math.max(agora, a.abreEm)));
  return { fracao: falta / total, segundos: Math.ceil(falta / 1000) };
}

/** Texto curto da cobrança: "1ª de 5", ou "morte súbita" depois das 10. */
export function nomeCobranca(n: number): string {
  if (n > COBRANCAS * 2) return `Morte súbita · ${Math.ceil((n - COBRANCAS * 2) / 2)}º par`;
  return `${Math.ceil(n / 2)}ª cobrança de ${COBRANCAS}`;
}

/* ---------- ranking (duelo_ranking, seção 50) ---------- */
export type LinhaRanking = { userId: string; vitorias: number; derrotas: number; saldo: number; maiorPremio: number };

/** Lê o ranking do banco, na ordem dele (mais vitórias, depois o maior saldo); linhas estranhas ficam de fora. */
export function lerRankingDuelo(d: unknown): LinhaRanking[] {
  if (!Array.isArray(d)) return [];
  const out: LinhaRanking[] = [];
  for (const x of d.slice(0, 100)) {
    const o = obj(x);
    const uid = o && texto(o.user_id);
    if (!o || !uid) continue;
    out.push({
      userId: uid,
      vitorias: Math.max(0, inteiro(o.vitorias)),
      derrotas: Math.max(0, inteiro(o.derrotas)),
      saldo: inteiro(o.saldo),
      maiorPremio: Math.max(0, inteiro(o.maior_premio)),
    });
  }
  return out;
}

/** A posição de cada linha (1, 2, …): mesmas vitórias e mesmo saldo dividem a posição, e a seguinte pula. */
export function posicoesRanking(l: readonly Pick<LinhaRanking, "vitorias" | "saldo">[]): number[] {
  return l.map((x, i) => {
    let p = i;
    while (p > 0 && l[p - 1].vitorias === x.vitorias && l[p - 1].saldo === x.saldo) p--;
    return p + 1;
  });
}

/** Saldo com sinal: "+1.250", "−300" ou "0". */
export const comSinal = (n: number) =>
  (n > 0 ? "+" : n < 0 ? "−" : "") + String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/* ---------- chat do duelo (duelo_mensagens, seção 50) ---------- */
export type MsgDuelo = { id: number; dueloId: number; userId: string; texto: string; em: number };
export const MSG_MAX = 200;
/** As reações rápidas: cada uma vai como uma mensagem. */
export const REACOES_DUELO = ["⚽", "🧤", "😂", "🔥"] as const;

/** Confere uma mensagem que veio do banco ou do tempo real. */
export function lerMsgDuelo(r: unknown): MsgDuelo | null {
  const o = obj(r);
  if (!o) return null;
  const uid = texto(o.user_id), em = hora(o.em);
  const id = Number(o.id), dueloId = Number(o.duelo_id);
  if (!uid || em === null || !Number.isSafeInteger(id) || !Number.isSafeInteger(dueloId)) return null;
  if (typeof o.texto !== "string" || !o.texto.trim()) return null;
  return { id, dueloId, userId: uid, texto: o.texto.slice(0, MSG_MAX), em };
}

/** Junta mensagens novas às que já estão na tela: sem repetir, em ordem, só as últimas `max`. */
export function juntarMsgs(atuais: readonly MsgDuelo[], novas: readonly MsgDuelo[], max = 50): MsgDuelo[] {
  const por = new Map<number, MsgDuelo>();
  for (const m of [...atuais, ...novas]) por.set(m.id, m);
  return [...por.values()].sort((a, b) => a.id - b.id).slice(-max);
}
