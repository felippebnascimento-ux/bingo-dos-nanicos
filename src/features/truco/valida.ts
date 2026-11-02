/*
 * Confere a mesa que chega pela sala (regra 4 do CLAUDE.md: broadcast não é confiável).
 * Devolve uma cópia só com campos do tipo e tamanho certos, ou null se algo não bate.
 * Assim a tela nunca quebra com uma mesa mal formada.
 */
import { TR_APOSTAS, trValido, type Aposta, type Carta, type EnvEstado, type Fala, type FimMao, type Jogada, type Lugar, type MaoPub, type MesaPub, type TrucoEstado, type Vaza } from "./engine";

export const TR_ID = /^[a-z0-9]{6,20}$/;
/** Tamanho máximo da mesa em JSON (igual ao site antigo). */
export const TR_MAX_JSON = 40000;

type O = Record<string, unknown>;
const obj = (x: unknown): x is O => !!x && typeof x === "object" && !Array.isArray(x);
const int = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const intOuNull = (x: unknown, min: number, max: number) => x === null || int(x, min, max);
const texto = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : null);

function lugar(x: unknown): Lugar | null | undefined {
  if (x === null) return null;
  if (!obj(x) || typeof x.key !== "string" || x.key.length > 80) return undefined;
  const nome = texto(x.nome, 40);
  if (nome === null) return undefined;
  if (x.fid !== null && (typeof x.fid !== "string" || x.fid.length > 64)) return undefined;
  return { fid: (x.fid as string | null) ?? null, key: x.key, nome };
}

function vaza(x: unknown, N: number): Vaza | null {
  if (!obj(x) || !int(x.lider, 0, N - 1) || !Array.isArray(x.cartas) || x.cartas.length > N) return null;
  if (!intOuNull(x.vence, -1, 1) || !intOuNull(x.por, 0, N - 1)) return null;
  const cartas: Jogada[] = [];
  for (const j of x.cartas) {
    if (!obj(j) || !int(j.s, 0, N - 1) || !trValido(j.c)) return null;
    cartas.push({ s: j.s, c: j.c });
  }
  return { lider: x.lider, cartas, vence: x.vence as number | null, por: x.por as number | null };
}

function truco(x: unknown, N: number): TrucoEstado | null {
  if (!obj(x) || !int(x.valor, 1, 4) || !intOuNull(x.dono, 0, 1)) return null;
  let pend: TrucoEstado["pend"] = null;
  if (x.pend !== null) {
    const p = x.pend;
    if (!obj(p) || !int(p.nivel, 2, 4) || !int(p.de, 0, 1) || !int(p.por, 0, N - 1)) return null;
    pend = { nivel: p.nivel, de: p.de, por: p.por };
  }
  return { valor: x.valor, pend, dono: x.dono as number | null };
}

function env(x: unknown, N: number): EnvEstado | null {
  if (!obj(x) || !["livre", "pend", "fim", "off"].includes(x.st as string)) return null;
  if (!Array.isArray(x.apostas) || x.apostas.length > 4 || !x.apostas.every((k) => TR_APOSTAS.includes(k as Aposta)))
    return null;
  if (!intOuNull(x.de, 0, 1)) return null;
  /* `por` não existia na mesa do site antigo: aceita sem ele */
  const por = int(x.por, 0, N - 1) ? x.por : null;
  let res: EnvEstado["res"] = null;
  if (x.res !== null && x.res !== undefined) {
    if (!obj(x.res) || !int(x.res.quem, 0, N - 1) || !int(x.res.pts, 0, 40)) return null;
    res = { quem: x.res.quem, pts: x.res.pts };
  }
  return { st: x.st as EnvEstado["st"], apostas: x.apostas.slice() as Aposta[], de: x.de as number | null, por, res };
}

function fim(x: unknown): FimMao | null | undefined {
  if (x === null) return null;
  if (!obj(x) || !int(x.team, 0, 1) || !int(x.pontos, 0, 99)) return undefined;
  const motivo = texto(x.motivo, 80);
  return motivo === null ? undefined : { team: x.team, pontos: x.pontos, motivo };
}

/** Cartas por lugar ({0: ["1e", …], …}): só lugares válidos, até 3 cartas válidas. */
function porLugar(x: unknown, N: number): Record<number, Carta[]> | null {
  if (!obj(x)) return null;
  const out: Record<number, Carta[]> = {};
  for (let i = 0; i < N; i++) {
    const v = x[i];
    out[i] = Array.isArray(v) ? v.filter(trValido).slice(0, 3) : [];
  }
  return out;
}

function mao(x: unknown, N: number): MaoPub | null | undefined {
  if (x === null) return null;
  if (!obj(x) || !int(x.n, 1, 1e6) || !int(x.mano, 0, N - 1) || !int(x.vez, 0, N - 1)) return undefined;
  if (!obj(x.nc) || !Array.isArray(x.vazas) || x.vazas.length < 1 || x.vazas.length > 3) return undefined;
  const nc: Record<number, number> = {};
  for (let i = 0; i < N; i++) nc[i] = int(x.nc[i], 0, 3) ? (x.nc[i] as number) : 0;
  const vazas: Vaza[] = [];
  for (const v of x.vazas) {
    const ok = vaza(v, N);
    if (!ok) return undefined;
    vazas.push(ok);
  }
  const tr = truco(x.truco, N), en = env(x.env, N), fi = fim(x.fim);
  if (!tr || !en || fi === undefined) return undefined;
  let flor: MaoPub["flor"] = null;
  if (x.flor !== null && x.flor !== undefined) {
    const f = x.flor;
    if (!obj(f) || !Array.isArray(f.quem) || !f.quem.every((i) => int(i, 0, N - 1)) || !int(f.team, 0, 1)) return undefined;
    flor = { quem: (f.quem as number[]).slice(0, N), team: f.team };
  }
  const sobra = x.sobra === null || x.sobra === undefined ? null : porLugar(x.sobra, N);
  /* relógio da jogada (mesa antiga não tem) */
  const desde = typeof x.desde === "number" && Number.isFinite(x.desde) ? x.desde : undefined;
  return { n: x.n, mano: x.mano, vez: x.vez, nc, vazas, truco: tr, env: en, flor, fim: fi, sobra, desde };
}

/** Mesa vinda da sala → mesa conferida, ou null. `de` é quem mandou (tem que ser o anfitrião). */
export function trLimpaPub(raw: unknown, de: string): MesaPub | null {
  if (!obj(raw) || !TR_ID.test(String(raw.id)) || raw.host !== de) return null;
  if (raw.modo !== 2 && raw.modo !== 4) return null;
  const N = raw.modo;
  if (!Array.isArray(raw.lugares) || raw.lugares.length !== N) return null;
  if (!int(raw.alvo, 1, 99) || typeof raw.comFlor !== "boolean") return null;
  if (!Array.isArray(raw.placar) || raw.placar.length !== 2 || !raw.placar.every((p) => int(p, 0, 999))) return null;
  if (!["espera", "jogo", "fim"].includes(raw.fase as string)) return null;
  const vencedor = raw.vencedor ?? null;
  if (!intOuNull(vencedor, 0, 1) || (raw.fase === "fim" && vencedor === null)) return null;
  const lugares: (Lugar | null)[] = [];
  for (const l of raw.lugares) {
    const ok = lugar(l);
    if (ok === undefined) return null;
    lugares.push(ok);
  }
  const log = Array.isArray(raw.log) ? raw.log.filter((t) => typeof t === "string").slice(-8).map((t) => String(t).slice(0, 120)) : [];
  const falas: Record<number, Fala> = {};
  if (obj(raw.falas))
    for (let i = 0; i < N; i++) {
      const f = raw.falas[i];
      if (obj(f) && typeof f.txt === "string" && typeof f.at === "number") falas[i] = { txt: f.txt.slice(0, 40), at: f.at };
    }
  const h = mao(raw.h, N);
  if (h === undefined) return null;
  return {
    id: String(raw.id), host: de, modo: N, alvo: raw.alvo, comFlor: raw.comFlor,
    placar: [raw.placar[0] as number, raw.placar[1] as number], fase: raw.fase as MesaPub["fase"],
    vencedor: vencedor as number | null, lugares, log, falas, maoN: int(raw.maoN, 0, 1e6) ? raw.maoN : 0, h,
  };
}
