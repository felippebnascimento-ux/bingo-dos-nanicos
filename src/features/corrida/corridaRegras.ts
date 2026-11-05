/*
 * Corrida de cavalos (05/11/2026, seção 71): a regra pura, espelho do banco. O banco é quem sorteia, cobra e paga;
 * aqui fica só o que a tela precisa para mostrar e para conferir:
 *   - os 4 atributos (velocidade, arrancada, resistência, constância) e o peso de cada um pela distância e pela pista;
 *   - os pontos de um cavalo numa corrida (a mesma conta do corrida_pontos do SQL);
 *   - o custo de treinar um atributo (o mesmo do cavalo_treinar);
 *   - as fases da corrida pelo relógio do banco;
 *   - o movimento de cada cavalo na pista, que termina exatamente na ordem que o banco mandou.
 */

export const RAIAS = 8;
export const ATRIB_MIN = 40;
export const ATRIB_MAX = 100;
export const PRECO_CAVALO = 2500;
export const MAX_CAVALOS = 3;
/** prêmio do dono do cavalo pelo 1º, 2º e 3º lugar (sai da banca) */
export const PREMIO_DONO = [400, 200, 100] as const;

export type Atributo = "velocidade" | "arrancada" | "resistencia" | "constancia";
export const ATRIBUTOS: readonly { id: Atributo; nome: string; dica: string }[] = [
  { id: "velocidade", nome: "Velocidade", dica: "a ponta final; vale em todas as distâncias" },
  { id: "arrancada", nome: "Arrancada", dica: "a largada; vale mais nos 1.000 m" },
  { id: "resistencia", nome: "Resistência", dica: "aguenta o ritmo; vale mais nos 2.400 m e na pista pesada" },
  { id: "constancia", nome: "Constância", dica: "corre igual sempre: menos zebra contra ele" },
];

export type Distancia = 1000 | 1600 | 2400;
export type Pista = "leve" | "pesada";
export const NOME_DISTANCIA: Readonly<Record<Distancia, string>> = { 1000: "1.000 m · tiro curto", 1600: "1.600 m · milha", 2400: "2.400 m · fundo" };
export const NOME_PISTA: Readonly<Record<Pista, string>> = { leve: "Pista leve", pesada: "Pista pesada" };

/** As pelagens (a cor do cavalo; as cores ficam em --cav-* no 42-corrida.css). */
export const PELAGENS = ["castanho", "alazao", "tordilho", "preto", "baio", "pampa", "rosilho", "branco"] as const;
export type Pelagem = (typeof PELAGENS)[number];
export const NOME_PELAGEM: Readonly<Record<Pelagem, string>> = {
  castanho: "Castanho",
  alazao: "Alazão",
  tordilho: "Tordilho",
  preto: "Preto",
  baio: "Baio",
  pampa: "Pampa",
  rosilho: "Rosilho",
  branco: "Branco",
};
export const ehPelagem = (x: unknown): x is Pelagem => typeof x === "string" && (PELAGENS as readonly string[]).includes(x);

export type Atributos = { v: number; a: number; r: number; c: number };

/** Peso de velocidade, arrancada e resistência por distância (somam 1). Na pista pesada, 0,1 sai da velocidade e vai para a resistência. */
export function pesos(d: Distancia, p: Pista): { v: number; a: number; r: number } {
  const base = d === 1000 ? { v: 0.45, a: 0.4, r: 0.15 } : d === 1600 ? { v: 0.4, a: 0.25, r: 0.35 } : { v: 0.3, a: 0.1, r: 0.6 };
  return p === "pesada" ? { v: base.v - 0.1, a: base.a, r: base.r + 0.1 } : base;
}

/** Quanto a sorte mexe: 12 na pista leve e 18 na pesada, menos para quem tem constância. */
export const espalho = (c: number, p: Pista) => (p === "pesada" ? 18 : 12) * (1.3 - c / 100);

/** O favoritismo de um cavalo nas condições da corrida (sem a sorte), de 40 a 100. */
export function forca(x: Atributos, d: Distancia, p: Pista) {
  const w = pesos(d, p);
  return w.v * x.v + w.a * x.a + w.r * x.r;
}

/** Os 4 números da sorte de uma raia (de 0 a 1) viram um z parecido com a curva normal (média 0, desvio 1). */
export const zDe = (u: readonly number[]) => (u[0] + u[1] + u[2] + u[3] - 2) * Math.sqrt(3);

/** Os pontos do cavalo na corrida: a força mais a sorte (igual ao corrida_pontos do banco). Quem tem mais pontos chega antes. */
export const pontos = (x: Atributos, d: Distancia, p: Pista, z: number) => forca(x, d, p) + espalho(x.c, p) * z;

/** Os 4 números da sorte da raia a partir do HMAC-SHA256 do banco: os 16 primeiros bytes, de 4 em 4, divididos por 2^32. */
export function sorteDosBytes(b: Uint8Array): number[] {
  const out: number[] = [];
  for (let k = 0; k < 4; k++) out.push(((b[4 * k] << 24) >>> 0) + (b[4 * k + 1] << 16) + (b[4 * k + 2] << 8) + b[4 * k + 3]);
  return out.map((n) => n / 4294967296);
}

/** A ordem de chegada (raias) pelos pontos; empate fica com a raia menor, como no banco. */
export const ordemDeChegada = (pts: readonly number[]) => pts.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);

/** Custo de treinar 1 ponto quando o atributo está em `v` (igual ao cavalo_treinar). */
export const custoPonto = (v: number) => 10 + 3 * (v - 30);
/** Custo de subir `n` pontos a partir de `v` (não passa de 100). */
export function custoTreino(v: number, n: number) {
  let t = 0;
  for (let k = 0; k < n && v + k < ATRIB_MAX; k++) t += custoPonto(v + k);
  return t;
}
/** Quantos pontos dá para subir de verdade (o teto é 100). */
export const pontosPossiveis = (v: number, n: number) => Math.max(0, Math.min(n, ATRIB_MAX - v));

/* ---------- fases pelo relógio do banco ---------- */
export type Fase = "inscricoes" | "apostas" | "correndo" | "fim";
export type Tempos = { abreEm: number; apostasEm: number; fechaEm: number; fimEm: number };
export function faseEm(t: Tempos, agora: number): Fase {
  if (agora < t.apostasEm) return "inscricoes";
  if (agora < t.fechaEm) return "apostas";
  if (agora < t.fimEm) return "correndo";
  return "fim";
}

/* ---------- apostas ---------- */
export type TipoAposta = "vencedor" | "place" | "exata";
export const NOME_APOSTA: Readonly<Record<TipoAposta, string>> = { vencedor: "Vencedor", place: "Placê", exata: "Exata" };
export const DICA_APOSTA: Readonly<Record<TipoAposta, string>> = {
  vencedor: "o cavalo chega em 1º",
  place: "o cavalo chega em 1º ou 2º",
  exata: "acerta o 1º e o 2º, na ordem",
};
/** Se a aposta ganhou, pela ordem de chegada. */
export function ganhou(tipo: TipoAposta, raia: number, raia2: number | null, ordem: readonly number[]) {
  if (tipo === "vencedor") return ordem[0] === raia;
  if (tipo === "place") return ordem[0] === raia || ordem[1] === raia;
  return ordem[0] === raia && ordem[1] === raia2;
}
/** O que a aposta paga (cotação fixa na hora da aposta, arredondada para baixo, como no banco). */
export const retorno = (valor: number, odd: number) => Math.floor(valor * odd);

/* ---------- o movimento na pista ---------- */
/**
 * Onde cada cavalo está (0 = largada, 1 = chegada) em `t` ms desde a largada. Cada um chega no seu tempo, na ordem do banco;
 * no caminho, quem tem mais arrancada que resistência sai na frente e quem tem mais resistência vem de trás.
 * f(s) = s + a·sen(πs)/π + b·sen(2πs)/(2π) cresce sempre (|a| + |b| < 1) e vai de 0 a 1.
 */
export const CORRIDA_MS = 18000;
export function temposDeChegada(pts: readonly number[], duracao = CORRIDA_MS) {
  const max = Math.max(...pts);
  /* cada ponto de diferença para o vencedor é 0,4% a mais de tempo */
  return pts.map((p) => duracao * (1 + (max - p) * 0.004));
}
export function estilo(x: Atributos, raia: number) {
  const a = Math.max(-0.5, Math.min(0.5, ((x.a - x.r) / 100) * 1.2));
  const b = ((raia * 37) % 7) / 7 * 0.3 - 0.15;
  return { a, b };
}
export function posicao(s: number, est: { a: number; b: number }) {
  const q = Math.max(0, Math.min(1, s));
  return q + (est.a * Math.sin(Math.PI * q)) / Math.PI + (est.b * Math.sin(2 * Math.PI * q)) / (2 * Math.PI);
}

/* ---------- ler o que vem do banco (corrida_estado) ---------- */
export type CavaloCampo = Atributos & { id: number; nome: string; pelagem: Pelagem; dono: string | null; oddV: number; oddP: number; forma: number[] };
export type MinhaAposta = { tipo: TipoAposta; raia: number; raia2: number | null; valor: number; odd: number; pagou: number | null };
export type EstadoCorrida = {
  agora: number;
  id: number;
  tempos: Tempos;
  distancia: Distancia;
  pista: Pista;
  inscritos: { id: number; nome: string; pelagem: Pelagem; dono: string | null }[];
  campo: CavaloCampo[] | null;
  exatas: Record<string, number>;
  hash: string | null;
  ordem: number[] | null;
  pontos: number[] | null;
  segredo: string | null;
  minhas: MinhaAposta[];
  ultimas: { id: number; nome: string; pelagem: Pelagem }[];
};

const num = (x: unknown, d = 0) => (typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x)) ? Number(x) : d);
const ms = (x: unknown) => (typeof x === "string" ? Date.parse(x) : num(x, NaN));
const atrib = (x: unknown) => Math.max(1, Math.min(ATRIB_MAX, Math.round(num(x, ATRIB_MIN))));
const txt = (x: unknown, max = 40) => (typeof x === "string" ? x.slice(0, max) : "");
const lista = (x: unknown) => (Array.isArray(x) ? x : []);

function lerCampo(x: unknown): CavaloCampo | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const id = num(o.id, -1);
  if (id < 0) return null;
  return {
    id,
    nome: txt(o.nome, 20),
    pelagem: ehPelagem(o.pelagem) ? o.pelagem : "castanho",
    dono: typeof o.dono === "string" ? o.dono : null,
    v: atrib(o.v),
    a: atrib(o.a),
    r: atrib(o.r),
    c: atrib(o.c),
    oddV: num(o.odd_v, 1),
    oddP: num(o.odd_p, 1),
    forma: lista(o.forma).map((p) => num(p)).filter((p) => p >= 1 && p <= RAIAS).slice(0, 5),
  };
}

/** Lê a resposta do corrida_estado sem confiar em nada (o que não fecha vira null). */
export function lerEstado(x: unknown): EstadoCorrida | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const c = o.corrida as Record<string, unknown> | null;
  if (!c || typeof c !== "object") return null;
  const tempos = { abreEm: ms(c.abre_em), apostasEm: ms(c.apostas_em), fechaEm: ms(c.fecha_em), fimEm: ms(c.fim_em) };
  if (Object.values(tempos).some((t) => !Number.isFinite(t))) return null;
  const distancia = num(c.distancia);
  if (distancia !== 1000 && distancia !== 1600 && distancia !== 2400) return null;
  const campo = Array.isArray(c.campo) ? c.campo.map(lerCampo).filter((k): k is CavaloCampo => !!k) : null;
  const ordem = Array.isArray(c.ordem) ? c.ordem.map((n) => num(n, -1)) : null;
  const pts = Array.isArray(c.pontos) ? c.pontos.map((n) => num(n)) : null;
  const ex: Record<string, number> = {};
  if (c.exatas && typeof c.exatas === "object") for (const [k, v] of Object.entries(c.exatas as Record<string, unknown>)) if (/^\d-\d$/.test(k)) ex[k] = num(v, 1);
  const ok = (l: number[] | null) => !!l && !!campo && l.length === campo.length;
  return {
    agora: num(o.agora, Date.now()),
    id: num(c.id),
    tempos,
    distancia,
    pista: c.pista === "pesada" ? "pesada" : "leve",
    inscritos: lista(c.inscritos)
      .map((k) => lerCampo({ ...(k as object), v: 40, a: 40, r: 40, c: 40 }))
      .filter((k): k is CavaloCampo => !!k)
      .map(({ id, nome, pelagem, dono }) => ({ id, nome, pelagem, dono })),
    campo,
    exatas: ex,
    hash: typeof c.hash === "string" ? c.hash : null,
    ordem: ok(ordem) && ordem!.every((n) => n >= 0 && n < campo!.length) ? ordem : null,
    pontos: ok(pts) ? pts : null,
    segredo: typeof c.segredo === "string" ? c.segredo : null,
    minhas: lista(o.minhas)
      .map((a) => a as Record<string, unknown>)
      .filter((a) => a.tipo === "vencedor" || a.tipo === "place" || a.tipo === "exata")
      .map((a) => ({ tipo: a.tipo as TipoAposta, raia: num(a.raia), raia2: a.raia2 == null ? null : num(a.raia2), valor: num(a.valor), odd: num(a.odd, 1), pagou: a.pagou == null ? null : num(a.pagou) })),
    ultimas: lista(o.ultimas)
      .map((u) => u as Record<string, unknown>)
      .map((u) => ({ id: num(u.id), nome: txt(u.nome, 20), pelagem: ehPelagem(u.pelagem) ? u.pelagem : "castanho" })),
  };
}

/* ---------- os cavalos (tabela cavalos) ---------- */
export type Cavalo = Atributos & { id: number; dono: string | null; nome: string; pelagem: Pelagem; corridas: number; vitorias: number; podios: number; ganhos: number; forma: number[] };
export function lerCavalo(x: unknown): Cavalo | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const id = num(o.id, -1);
  if (id < 0 || typeof o.nome !== "string") return null;
  return {
    id,
    dono: typeof o.dono === "string" ? o.dono : null,
    nome: txt(o.nome, 20),
    pelagem: ehPelagem(o.pelagem) ? o.pelagem : "castanho",
    v: atrib(o.velocidade),
    a: atrib(o.arrancada),
    r: atrib(o.resistencia),
    c: atrib(o.constancia),
    corridas: num(o.corridas),
    vitorias: num(o.vitorias),
    podios: num(o.podios),
    ganhos: num(o.ganhos),
    forma: lista(o.forma).map((p) => num(p)).filter((p) => p >= 1 && p <= RAIAS).slice(0, 5),
  };
}
export const CHAVE_ATRIB: Readonly<Record<Atributo, keyof Atributos>> = { velocidade: "v", arrancada: "a", resistencia: "r", constancia: "c" };
/** Nota geral do cavalo (média dos 4), para ordenar e mostrar. */
export const nota = (x: Atributos) => Math.round((x.v + x.a + x.r + x.c) / 4);

/** Nome de cavalo aceito (o banco confere de novo): 2 a 20 letras, números, espaço, ponto, hífen e apóstrofo. */
export const nomeOk = (n: string) => /^[\p{L}\p{N} .'-]{2,20}$/u.test(n.trim()) && /\p{L}/u.test(n);

/** Cotação em texto: "3,40×". */
export const textoOdd = (o: number) => o.toFixed(2).replace(".", ",") + "×";
