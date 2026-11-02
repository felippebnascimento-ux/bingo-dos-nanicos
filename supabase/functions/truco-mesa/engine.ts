// GERADO por `npm run sincronizar:truco` a partir de src/features/truco/engine.ts. NÃO EDITE AQUI.
/*
 * Truco gaudério: regras (puras, sem React, sem tela, sem rede).
 *
 * Baralho espanhol de 40 cartas (sem 8, 9 e coringas). Naipes: e=espadas, b=bastos, c=copas, o=ouros.
 * Força: 1e (espadão) > 1b (bastião) > 7e > 7o > 3 > 2 > 1c/1o > 12 > 11 > 10 > 7c/7b > 6 > 5 > 4.
 * Envido: duas do mesmo naipe = 20 + soma (figuras valem 0); senão a maior carta. Flor: três do mesmo naipe = 20 + soma.
 * Truco 2, retruco 3, vale quatro 4; quem não quer dá o valor anterior. Mão sem truco vale 1.
 * Envido 2, real envido 3, falta envido = o que falta para quem está na frente ganhar. Não querer dá 1 (ou o que já estava aceito).
 * Flor vale 3 por flor; se os dois times têm, a maior leva tudo (sem contraflor).
 *
 * Os nomes das funções são os mesmos do site antigo (trForca, trEnvido, trOpcoes, trAcao…).
 * Lugares: 0..modo-1, em sentido anti-horário. Time de um lugar = lugar % 2.
 */

/** Carta como texto: número + naipe ("7e", "12c", "1b"…). */
export type Carta = string;
export type Naipe = "e" | "b" | "c" | "o";
export type Aposta = "envido" | "real" | "falta";
export type Fase = "espera" | "jogo" | "fim";
export type AcaoJogo = "jogar" | "truco" | "envido" | "quero" | "naoquero" | "mazo";

/** Quem está sentado: `key` é a conta (user_id), `fid` o nanico. */
export type Lugar = { fid: string | null; key: string; nome: string };
export type Jogada = { s: number; c: Carta };
/** Uma rodada de cartas. `vence`: time que ganhou, -1 = parda, null = em andamento. `por`: lugar da carta vencedora. */
export type Vaza = { lider: number; cartas: Jogada[]; vence: number | null; por: number | null };
/** `valor`: quanto a mão vale agora; `pend`: pedido esperando resposta; `dono`: time que pode subir de novo. */
export type TrucoEstado = {
  valor: number;
  pend: { nivel: number; de: number; por: number } | null;
  dono: number | null;
};
/** `st`: livre (dá para cantar), pend (esperando resposta), fim (já resolvido), off (teve flor). `de`: time que cantou por último. */
export type EnvEstado = {
  st: "livre" | "pend" | "fim" | "off";
  apostas: Aposta[];
  de: number | null;
  por: number | null;
  res: { quem: number; pts: number } | null;
};
export type FimMao = { team: number; pontos: number; motivo: string };
export type Fala = { txt: string; at: number };

/** O que todo mundo vê de uma mão (também vale para a versão pública). */
export type MaoBase = {
  n: number;
  mano: number;
  vazas: Vaza[];
  vez: number;
  truco: TrucoEstado;
  env: EnvEstado;
  flor: { quem: number[]; team: number } | null;
  fim: FimMao | null;
};
/** Mão completa (só o servidor tem): `maos` são as cartas na mão de cada lugar, `orig` as três que recebeu. */
export type Mao = MaoBase & { maos: Record<number, Carta[]>; orig: Record<number, Carta[]> };

type MesaBase<H> = {
  id: string;
  host: string;
  modo: 2 | 4;
  alvo: number;
  comFlor: boolean;
  placar: [number, number];
  fase: Fase;
  vencedor: number | null;
  lugares: (Lugar | null)[];
  log: string[];
  falas: Record<number, Fala>;
  maoN: number;
  h: H | null;
};
/** Mesa completa (fica só no servidor, em truco_estado). */
export type Mesa = MesaBase<Mao> & { dealer: number };

/** Mão como os outros veem: quantas cartas cada um tem (`nc`) e, no fim, as que sobraram (`sobra`). */
export type MaoPub = MaoBase & { nc: Record<number, number>; sobra: Record<number, Carta[]> | null };
/** Mesa como todos veem (truco_mesas, sem as cartas de ninguém). */
export type MesaPub = MesaBase<MaoPub>;

export type Opcoes = {
  jogar: boolean;
  truco: number | null;
  envido: Aposta[];
  quero: boolean;
  naoquero: boolean;
  mazo: boolean;
};

export const TR_NAIPES: readonly Naipe[] = ["e", "b", "c", "o"];
export const TR_NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
export const TR_APOSTAS: readonly Aposta[] = ["envido", "real", "falta"];
export const TR_TRUCO: Record<number, string> = { 2: "Truco", 3: "Retruco", 4: "Vale quatro" };
export const TR_ENV: Record<Aposta, string> = { envido: "Envido", real: "Real envido", falta: "Falta envido" };

export const trN = (c: Carta) => parseInt(c, 10);
export const trS = (c: Carta) => c.slice(-1) as Naipe;
export const trValido = (c: unknown): c is Carta =>
  typeof c === "string" && /^(1|2|3|4|5|6|7|10|11|12)[ebco]$/.test(c);

export function trBaralho(): Carta[] {
  const d: Carta[] = [];
  for (const s of TR_NAIPES) for (const n of TR_NUMS) d.push(n + s);
  return d;
}

export function trEmbaralha(d: readonly Carta[], rnd: () => number = Math.random): Carta[] {
  const b = d.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const FORCA: Record<number, number> = { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 };
export function trForca(c: Carta): number {
  if (c === "1e") return 14;
  if (c === "1b") return 13;
  if (c === "7e") return 12;
  if (c === "7o") return 11;
  return FORCA[trN(c)] ?? 0;
}

/** Valor da carta no envido (figuras valem 0). */
export const trPip = (c: Carta) => (trN(c) <= 7 ? trN(c) : 0);

export function trEnvido(cs: readonly Carta[]): number {
  let best = 0;
  for (const c of cs) best = Math.max(best, trPip(c));
  for (let i = 0; i < cs.length; i++)
    for (let j = i + 1; j < cs.length; j++)
      if (trS(cs[i]) === trS(cs[j])) best = Math.max(best, 20 + trPip(cs[i]) + trPip(cs[j]));
  return best;
}

export const trTemFlor = (cs: readonly Carta[]) => cs.length === 3 && cs.every((c) => trS(c) === trS(cs[0]));
export const trFlor = (cs: readonly Carta[]) => 20 + cs.reduce((a, c) => a + trPip(c), 0);

/** Quem ganha a mão pelas vazas (-1 = parda). null = ainda não decidiu. */
export function trDecide(res: readonly number[], manoTeam: number): number | null {
  if (res.length < 2) return null;
  const [a, b, c] = res;
  if (a === -1 && b !== -1) return b;
  if (a !== -1 && b === -1) return a;
  if (a !== -1 && a === b) return a;
  if (res.length < 3) return null;
  if (c !== -1) return c;
  if (a !== -1) return a;
  return manoTeam;
}

type ComPlacar = { alvo: number; placar: [number, number] };
export function trFalta(M: ComPlacar) {
  return Math.max(1, M.alvo - Math.max(M.placar[0], M.placar[1]));
}
export function trValorEnv(M: ComPlacar, k: Aposta) {
  return k === "envido" ? 2 : k === "real" ? 3 : trFalta(M);
}

/** Ordem dos lugares a partir do mano (para desempate). */
export function trOrdem(M: Mesa): number[] {
  const N = M.modo, o: number[] = [];
  for (let i = 0; i < N; i++) o.push(((M.h?.mano ?? 0) + i) % N);
  return o;
}

export function trLog(M: { log: string[] }, txt: string) {
  M.log.push(txt);
  if (M.log.length > 8) M.log.shift();
}

export function trFala(M: { falas: Record<number, Fala> }, seat: number, txt: string, agora = Date.now()) {
  M.falas[seat] = { txt, at: agora };
}

const nomeDe = (M: { lugares: (Lugar | null)[] }, i: number) => M.lugares[i]?.nome ?? "?";
export const trTime = (M: Mesa, team: number) =>
  M.modo === 2 ? nomeDe(M, team) : `${nomeDe(M, team)} e ${nomeDe(M, team + 2)}`;

export function trPontos(M: Mesa, team: number, p: number, motivo: string) {
  M.placar[team] += p;
  trLog(M, `${motivo}: +${p} para ${trTime(M, team)}`);
  if (M.placar[team] >= M.alvo && M.fase === "jogo") {
    M.fase = "fim";
    M.vencedor = team;
    if (M.h) M.h.fim = M.h.fim || { team, pontos: 0, motivo: "fim de jogo" };
  }
}

/** Mesa nova, esperando a turma. O anfitrião senta no lugar 0. */
export function trNovaMesa(id: string, dono: Lugar, modo: 2 | 4, alvo: number, comFlor: boolean): Mesa {
  const M: Mesa = {
    id, host: dono.key, modo, alvo, comFlor, placar: [0, 0], fase: "espera", vencedor: null,
    lugares: Array<Lugar | null>(modo).fill(null), log: [], falas: {}, maoN: 0, dealer: modo - 1, h: null,
  };
  M.lugares[0] = dono;
  trLog(M, `${dono.nome} abriu a mesa`);
  return M;
}

/** Começa uma mão nova (o anfitrião chama). Com flor, a flor já é cantada e paga aqui. */
export function trNovaMao(M: Mesa, rnd: () => number = Math.random) {
  const N = M.modo, d = trEmbaralha(trBaralho(), rnd);
  M.dealer = M.h ? (M.dealer + 1) % N : (M.dealer ?? N - 1);
  const mano = (M.dealer + 1) % N, maos: Record<number, Carta[]> = {}, orig: Record<number, Carta[]> = {};
  for (let i = 0; i < N; i++) {
    maos[i] = d.slice(i * 3, i * 3 + 3);
    orig[i] = maos[i].slice();
  }
  M.maoN = (M.maoN || 0) + 1;
  M.falas = {};
  M.h = {
    n: M.maoN, mano, maos, orig, vazas: [{ lider: mano, cartas: [], vence: null, por: null }], vez: mano,
    truco: { valor: 1, pend: null, dono: null },
    env: { st: "livre", apostas: [], de: null, por: null, res: null },
    flor: null, fim: null,
  };
  trLog(M, `Mão ${M.maoN}: ${nomeDe(M, mano)} é mão`);
  if (M.comFlor) {
    const fl: number[] = [];
    for (let i = 0; i < N; i++) if (trTemFlor(orig[i])) fl.push(i);
    if (fl.length) {
      M.h.env.st = "off";
      fl.forEach((i) => trFala(M, i, `Flor! (${trFlor(orig[i])})`));
      const times = [...new Set(fl.map((i) => i % 2))];
      let team = times[0];
      if (times.length > 1) {
        let best = -1;
        for (const i of trOrdem(M))
          if (fl.includes(i) && trFlor(orig[i]) > best) {
            best = trFlor(orig[i]);
            team = i % 2;
          }
      }
      M.h.flor = { quem: fl, team };
      trPontos(M, team, 3 * fl.length, fl.length > 1 && times.length > 1 ? "Flor contra flor" : "Flor");
    }
  }
}

/** O que o lugar s pode fazer agora (o site mostra só esses botões). Serve para a mesa completa e para a pública. */
export function trOpcoes(M: { fase: Fase; h: MaoBase | null }, s: number): Opcoes {
  const o: Opcoes = { jogar: false, truco: null, envido: [], quero: false, naoquero: false, mazo: false };
  if (M.fase !== "jogo" || !M.h || M.h.fim) return o;
  const h = M.h, t = s % 2, tp = h.truco.pend, ep = h.env.st === "pend";
  o.mazo = true;
  if (ep) {
    if (h.env.de !== t) {
      o.quero = o.naoquero = true;
      const last = h.env.apostas[h.env.apostas.length - 1];
      const nE = h.env.apostas.filter((k) => k === "envido").length;
      if (last === "envido") {
        if (nE < 2) o.envido.push("envido");
        o.envido.push("real", "falta");
      } else if (last === "real") o.envido.push("falta");
    }
    return o;
  }
  if (tp) {
    if (tp.de !== t) {
      o.quero = o.naoquero = true;
      if (tp.nivel < 4) o.truco = tp.nivel + 1;
      /* "o envido vem primeiro": responder o truco cantando envido, se ainda não jogou nesta mão */
      if (tp.nivel === 2 && h.env.st === "livre" && h.vazas.length === 1 && !h.vazas[0].cartas.some((x) => x.s === s))
        o.envido = ["envido", "real", "falta"];
    }
    return o;
  }
  if (h.vez === s) {
    o.jogar = true;
    if (h.truco.valor < 4 && (h.truco.dono === null || h.truco.dono === t)) o.truco = h.truco.valor + 1;
    if (h.env.st === "livre" && h.vazas.length === 1 && h.truco.valor === 1) o.envido = ["envido", "real", "falta"];
  }
  return o;
}

export function trFimMao(M: Mesa, team: number, pontos: number, motivo: string) {
  const h = M.h;
  if (!h || h.fim) return;
  h.fim = { team, pontos, motivo };
  if (M.fase === "jogo") trPontos(M, team, pontos, motivo);
}

export function trResolveEnvido(M: Mesa) {
  const h = M.h!, cant: [number, number][] = [];
  let best = -1, quem = 0;
  for (const i of trOrdem(M)) {
    const v = trEnvido(h.orig[i]);
    cant.push([i, v]);
    if (v > best) {
      best = v;
      quem = i;
    }
  }
  cant.forEach(([i, v]) => trFala(M, i, `${v} de envido`));
  const pts = h.env.apostas.reduce((a, k) => a + trValorEnv(M, k), 0);
  h.env.st = "fim";
  h.env.res = { quem, pts: best };
  trPontos(M, quem % 2, pts, `${h.env.apostas.map((k) => TR_ENV[k]).join(" + ")} (${nomeDe(M, quem)} com ${best})`);
}

/** Pontos do envido não querido: 1 se foi só um canto, senão o que já estava aceito. */
const envNaoQuerido = (M: Mesa, ap: Aposta[]) =>
  ap.length === 1 ? 1 : ap.slice(0, -1).reduce((x, k) => x + trValorEnv(M, k), 0);

/** Aplica uma ação do lugar s; devolve texto de erro ou null. */
export function trAcao(M: Mesa, s: number, a: string, arg?: unknown): string | null {
  if (M.fase !== "jogo" || !M.h || M.h.fim) return "A mão não está em jogo.";
  const h = M.h, t = s % 2, op = trOpcoes(M, s), nome = nomeDe(M, s);
  if (a === "jogar") {
    if (!op.jogar) return "Não é a sua vez.";
    const i = typeof arg === "string" ? h.maos[s].indexOf(arg) : -1;
    if (i < 0) return "Carta inválida.";
    const c = h.maos[s].splice(i, 1)[0];
    const v = h.vazas[h.vazas.length - 1];
    v.cartas.push({ s, c });
    if (v.cartas.length < M.modo) {
      h.vez = (s + 1) % M.modo;
      return null;
    }
    /* fecha a vaza */
    const max = Math.max(...v.cartas.map((x) => trForca(x.c)));
    const top = v.cartas.filter((x) => trForca(x.c) === max);
    const times = new Set(top.map((x) => x.s % 2));
    v.vence = times.size > 1 ? -1 : top[0].s % 2;
    v.por = times.size > 1 ? null : top[0].s;
    trLog(M, v.vence === -1 ? `Vaza ${h.vazas.length}: parda` : `Vaza ${h.vazas.length}: ${nomeDe(M, v.por!)}`);
    const w = trDecide(h.vazas.map((x) => x.vence as number), h.mano % 2);
    if (w !== null) {
      trFimMao(M, w, h.truco.valor, h.truco.valor > 1 ? TR_TRUCO[h.truco.valor] : "Mão");
      return null;
    }
    const lider = v.vence === -1 ? v.lider : v.por!;
    h.vazas.push({ lider, cartas: [], vence: null, por: null });
    h.vez = lider;
    return null;
  }
  if (a === "truco") {
    if (!op.truco) return "Agora não dá para trucar.";
    const tp = h.truco.pend;
    if (tp && tp.de !== t) h.truco.valor = tp.nivel; /* aumentar = aceitar o anterior e subir */
    h.truco.pend = { nivel: op.truco, de: t, por: s };
    trFala(M, s, TR_TRUCO[op.truco] + "!");
    trLog(M, `${nome}: ${TR_TRUCO[op.truco]}!`);
    return null;
  }
  if (a === "envido") {
    const k = arg as Aposta;
    if (!op.envido.includes(k)) return "Agora não dá para cantar isso.";
    h.env.apostas.push(k);
    h.env.st = "pend";
    h.env.de = t;
    h.env.por = s;
    trFala(M, s, TR_ENV[k] + "!");
    trLog(M, `${nome}: ${TR_ENV[k]}!`);
    return null;
  }
  if (a === "quero" || a === "naoquero") {
    if (!op.quero) return "Não tem nada para responder.";
    trFala(M, s, a === "quero" ? "Quero!" : "Não quero");
    trLog(M, `${nome}: ${a === "quero" ? "Quero" : "Não quero"}`);
    if (h.env.st === "pend") {
      if (a === "quero") trResolveEnvido(M);
      else {
        const pts = envNaoQuerido(M, h.env.apostas);
        h.env.st = "fim";
        trPontos(M, h.env.de!, pts, "Envido não querido");
      }
      return null;
    }
    const tp = h.truco.pend!;
    if (a === "quero") {
      h.truco.valor = tp.nivel;
      h.truco.dono = t;
      h.truco.pend = null;
      return null;
    }
    h.truco.pend = null;
    trFimMao(M, tp.de, tp.nivel - 1, `${TR_TRUCO[tp.nivel]} não querido`);
    return null;
  }
  if (a === "mazo") {
    if (!op.mazo) return "Agora não dá.";
    if (h.env.st === "pend" && h.env.de !== t) {
      trPontos(M, h.env.de!, envNaoQuerido(M, h.env.apostas), "Envido não querido");
      h.env.st = "fim";
    }
    const tp = h.truco.pend, pts = tp && tp.de !== t ? tp.nivel - 1 : h.truco.valor;
    trFala(M, s, "Fui ao mazo");
    trFimMao(M, 1 - t, Math.max(1, pts), `${nome} foi ao mazo`);
    return null;
  }
  return "Ação desconhecida.";
}

/** Copia funda (a versão pública não pode dividir listas com a mesa que o anfitrião continua mexendo). */
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Mesa para mandar à sala: esconde as cartas de todo mundo (só mostra quantas cada um tem). */
export function trPublica(M: Mesa): MesaPub {
  const h = M.h;
  return copia({
    id: M.id, host: M.host, modo: M.modo, alvo: M.alvo, comFlor: M.comFlor, placar: M.placar, fase: M.fase,
    vencedor: M.vencedor ?? null, lugares: M.lugares, log: M.log, falas: M.falas, maoN: M.maoN || 0,
    h: h
      ? {
          n: h.n, mano: h.mano, vez: h.vez,
          nc: Object.fromEntries(Object.entries(h.maos).map(([k, v]) => [k, v.length])),
          vazas: h.vazas, truco: h.truco,
          env: { st: h.env.st, apostas: h.env.apostas, de: h.env.de, por: h.env.por, res: h.env.res },
          flor: h.flor, fim: h.fim,
          /* no fim da mão, mostra as cartas que sobraram de todo mundo */
          sobra: h.fim ? h.maos : null,
        }
      : null,
  });
}
