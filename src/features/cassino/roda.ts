/*
 * A roda da roleta europeia animada (puro e testado). Quem sorteia o número é o banco (apostar_roleta);
 * aqui só se planeja o giro para a bolinha terminar EXATAMENTE no centro da casa que o banco mandou.
 *
 * Como funciona: a roda gira no sentido horário e desacelera (easeOutCubic). A bolinha é pensada em relação
 * à roda: ψ(t) = ângulo da bolinha medido na própria roda. Ela começa muitas voltas "à frente" (na tela, isso
 * é correr no sentido contrário, bem rápida) e esse atraso vai a zero com easeOutQuart até a hora de assentar.
 * No fim ψ = ângulo da casa e fica parado: a bolinha passa a girar junto com a roda até ela parar.
 * Antes de assentar, ela desce em espiral da pista para as casas, bate nos losangos e quica de 2 a 4 vezes
 * entre casas vizinhas; cada quique termina onde o próximo começa, então não há salto.
 */

/** As 37 casas em sentido horário, começando pelo 0 no topo. */
export const ORDEM = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;
export const FATIA = 360 / 37;

/** Ângulo (graus, horário a partir do topo) do centro da casa `n` na roda parada. */
export function anguloDa(n: number): number {
  const i = ORDEM.indexOf(n as (typeof ORDEM)[number]);
  if (i < 0) throw new Error("casa fora da roleta: " + n);
  return i * FATIA;
}

/** Raios (em fração do raio da pista): onde a bolinha corre e onde ela assenta. */
export const R_PISTA = 1;
export const R_CASA = 0.68;

const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;
const easeOutQuart = (u: number) => 1 - (1 - u) ** 4;
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const limita = (u: number) => Math.min(1, Math.max(0, u));

export type Quique = { de: number; para: number; ini: number; fim: number; altura: number };
export type Plano = {
  casa: number;
  /** duração total (ms) e quando a bolinha assenta */
  total: number;
  assenta: number;
  /** a roda: ângulo inicial e quanto gira até parar (graus, horário) */
  roda0: number;
  rodaGiro: number;
  /** a bolinha na roda: quanto ela está "à frente" no começo (graus) e o ângulo final (centro da casa) */
  bolaAtraso: number;
  bolaFim: number;
  /** quando começa a descer da pista e quando chega nas casas */
  desce: number;
  chega: number;
  /** batidas nos losangos (tempo e força) e quiques entre as casas (em casas de deslocamento) */
  batidas: { t: number; forca: number }[];
  quiques: Quique[];
};

/**
 * Plano de um giro que termina na `casa`. `rnd` dá números em [0, 1) só para variar o visual
 * (voltas, tempos e quiques); o resultado não depende dele. `roda0` é onde a roda está agora.
 */
export function planoDoGiro(casa: number, rnd: () => number, roda0 = 0): Plano {
  const total = 6500 + rnd() * 1500;
  const assenta = total * (0.56 + rnd() * 0.1);
  const desce = assenta * (0.42 + rnd() * 0.1);
  const chega = assenta * (0.72 + rnd() * 0.06);
  /* de 2 a 4 quiques entre casas vizinhas, do momento em que chega até assentar; o último volta para 0 */
  const n = 2 + Math.floor(rnd() * 3);
  const passos: number[] = [];
  let pos = 0;
  for (let k = 0; k < n - 1; k++) {
    let p = pos + (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 2));
    if (Math.abs(p) > 2) p = pos > 0 ? pos - 1 : pos + 1;
    passos.push(p);
    pos = p;
  }
  passos.push(0);
  const quiques: Quique[] = [];
  const janela = assenta - chega;
  let t = chega, de = 0;
  for (let k = 0; k < n; k++) {
    /* cada quique é um pouco mais curto e mais baixo que o anterior */
    const dur = (janela * (n - k)) / ((n * (n + 1)) / 2);
    quiques.push({ de, para: passos[k], ini: t, fim: t + dur, altura: 0.07 * (1 - k / (n + 1)) * (0.7 + rnd() * 0.5) });
    t += dur;
    de = passos[k];
  }
  const batidas = Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => ({ t: desce + rnd() * (chega - desce), forca: 0.02 + rnd() * 0.03 }));
  return {
    casa,
    total,
    assenta,
    roda0,
    rodaGiro: 360 * (2 + rnd() * 1.5),
    bolaAtraso: 360 * (5 + rnd() * 2.5),
    bolaFim: anguloDa(casa),
    desce,
    chega,
    batidas,
    quiques,
  };
}

export type Quadro = {
  /** ângulo da roda na tela (graus) */
  roda: number;
  /** ângulo da bolinha na tela (graus) e raio (fração da pista) */
  bola: number;
  raio: number;
  /** velocidade da bolinha em relação à roda (0 a 1), para o som de rolar */
  rolando: number;
  /** a bolinha já está parada na casa */
  assentou: boolean;
  /** quanto a bolinha está no ar (0 = rolando ou na casa, até ~1 no quique mais alto), para o tamanho e a sombra */
  salto: number;
};

/** Onde está tudo no instante `t` (ms desde o início). */
export function quadroDoGiro(p: Plano, t: number): Quadro {
  const roda = p.roda0 + p.rodaGiro * easeOutCubic(limita(t / p.total));
  const u = limita(t / p.assenta);
  /* a bolinha em relação à roda: o atraso vai a zero e ela fica na casa */
  let rel = p.bolaFim + p.bolaAtraso * (1 - easeOutQuart(u));
  let raio = R_PISTA;
  if (t >= p.chega) raio = R_CASA;
  else if (t > p.desce) raio = R_PISTA - (R_PISTA - R_CASA) * easeInOut((t - p.desce) / (p.chega - p.desce));
  /* batidas nos losangos: um empurrão curto para fora enquanto desce, e ela pula */
  let salto = 0;
  for (const b of p.batidas) {
    const d = (t - b.t) / 180;
    if (d > 0 && d < 1) {
      raio += b.forca * Math.sin(Math.PI * d);
      salto = Math.max(salto, b.forca * 12 * Math.sin(Math.PI * d));
    }
  }
  /* quiques entre casas vizinhas */
  const q = p.quiques.find((x) => t >= x.ini && t < x.fim);
  if (q) {
    const v = (t - q.ini) / (q.fim - q.ini);
    rel += (q.de + (q.para - q.de) * easeInOut(v)) * FATIA;
    raio = R_CASA + q.altura * Math.sin(Math.PI * v);
    salto = (q.altura / 0.07) * 0.8 * Math.sin(Math.PI * v);
  }
  /* caiu na casa: balança de leve entre as divisórias e para no centro (some antes do fim do giro) */
  const assentando = (t - p.assenta) / 700;
  if (assentando > 0 && assentando < 1) rel += FATIA * 0.14 * Math.sin(assentando * Math.PI * 3) * (1 - assentando);
  const rolando = t >= p.assenta ? 0 : (1 - u) ** 2;
  return { roda, bola: roda + rel, raio, rolando, assentou: t >= p.assenta, salto };
}

/** Ângulo entre 0 e 360. */
export const norm360 = (a: number) => ((a % 360) + 360) % 360;
