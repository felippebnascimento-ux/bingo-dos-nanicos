/*
 * O rádio da caixa de som (seção 60): música feita no navegador com Web Audio, sem arquivo e sem site de fora.
 * Cada estação é um andamento, uma sequência de acordes e um jeito de bater; a melodia sai sorteada de uma escala a
 * cada compasso (nada copiado de música nenhuma). Volume baixo, e o mudo de cada um fica em `radio-mudo`.
 */
import { local } from "@/lib/util";

export const ESTACOES = ["desligada", "lofi", "eletro", "samba"] as const;
export type Estacao = (typeof ESTACOES)[number];
export const NOME_ESTACAO: Record<Estacao, string> = { desligada: "Desligada", lofi: "Lo-fi", eletro: "Eletrônica", samba: "Samba" };

type Estilo = { bpm: number; acordes: number[][]; escala: number[]; onda: OscillatorType; batida: (passo: number) => ("bumbo" | "caixa" | "chimbal")[] };
/* notas em semitons a partir do Lá 220 Hz */
const ESTILO: Record<Exclude<Estacao, "desligada">, Estilo> = {
  lofi: { bpm: 78, acordes: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], escala: [12, 15, 17, 19, 22, 24], onda: "triangle", batida: (p) => [...(p % 8 === 0 ? ["bumbo" as const] : []), ...(p % 8 === 4 ? ["caixa" as const] : []), ...(p % 2 === 0 ? ["chimbal" as const] : [])] },
  eletro: { bpm: 124, acordes: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], escala: [12, 14, 15, 17, 19, 22], onda: "sawtooth", batida: (p) => [...(p % 4 === 0 ? ["bumbo" as const] : []), ...(p % 8 === 4 ? ["caixa" as const] : []), ...(p % 4 === 2 ? ["chimbal" as const] : [])] },
  samba: { bpm: 100, acordes: [[0, 4, 7, 11], [2, 5, 9, 12], [7, 11, 14, 17], [5, 9, 12, 16]], escala: [12, 14, 16, 19, 21, 24], onda: "square", batida: (p) => [...(p % 4 === 0 || p % 8 === 3 ? ["bumbo" as const] : []), ...([2, 5, 7, 10, 13, 15].includes(p % 16) ? ["caixa" as const] : []), "chimbal" as const] },
};

const hz = (semi: number) => 220 * 2 ** (semi / 12);

let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
let relogio: ReturnType<typeof setInterval> | undefined;
let tocando: Estacao = "desligada";

function nota(semi: number, quando: number, dur: number, onda: OscillatorType, vol: number) {
  if (!ctx || !mestre) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = onda;
  o.frequency.value = hz(semi);
  g.gain.setValueAtTime(0.0001, quando);
  g.gain.exponentialRampToValueAtTime(vol, quando + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
  o.connect(g).connect(mestre);
  o.start(quando);
  o.stop(quando + dur + 0.05);
}

function percussao(tipo: "bumbo" | "caixa" | "chimbal", quando: number) {
  if (!ctx || !mestre) return;
  if (tipo === "bumbo") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, quando);
    o.frequency.exponentialRampToValueAtTime(40, quando + 0.15);
    g.gain.setValueAtTime(0.5, quando);
    g.gain.exponentialRampToValueAtTime(0.001, quando + 0.2);
    o.connect(g).connect(mestre);
    o.start(quando);
    o.stop(quando + 0.25);
    return;
  }
  /* caixa e chimbal: um sopro de ruído, curto, filtrado */
  const dur = tipo === "caixa" ? 0.12 : 0.04;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf;
  f.type = "highpass";
  f.frequency.value = tipo === "caixa" ? 1200 : 7000;
  g.gain.setValueAtTime(tipo === "caixa" ? 0.25 : 0.08, quando);
  g.gain.exponentialRampToValueAtTime(0.001, quando + dur);
  s.connect(f).connect(g).connect(mestre);
  s.start(quando);
}

/** Toca uma estação (ou para, com "desligada"). Trocar de estação recomeça do zero. */
export function tocarRadio(est: Estacao) {
  if (est === tocando) return;
  pararRadio();
  if (est === "desligada" || local.get("radio-mudo") === "1") return;
  try {
    ctx = new AudioContext();
  } catch {
    return;
  }
  mestre = ctx.createGain();
  mestre.gain.value = 0.12;
  mestre.connect(ctx.destination);
  tocando = est;
  const e = ESTILO[est];
  const passoS = 60 / e.bpm / 4;
  let passo = 0;
  let proximo = ctx.currentTime + 0.1;
  /* agenda um pouco à frente, a cada 100 ms (o setInterval sozinho atrasaria) */
  relogio = setInterval(() => {
    if (!ctx) return;
    while (proximo < ctx.currentTime + 0.3) {
      const compasso = Math.floor(passo / 16) % e.acordes.length;
      if (passo % 16 === 0) for (const s of e.acordes[compasso]) nota(s - 12, proximo, passoS * 15, e.onda === "sawtooth" ? "triangle" : "sine", 0.05);
      if (passo % 4 === 0) nota(e.acordes[compasso][0] - 24, proximo, passoS * 3, "sine", 0.18);
      if (passo % 2 === 0 && Math.random() < 0.45) nota(e.escala[Math.floor(Math.random() * e.escala.length)], proximo, passoS * 1.8, e.onda, 0.06);
      for (const p of e.batida(passo % 16)) percussao(p, proximo);
      proximo += passoS;
      passo++;
    }
  }, 100);
}

export function pararRadio() {
  clearInterval(relogio);
  relogio = undefined;
  tocando = "desligada";
  void ctx?.close().catch(() => {});
  ctx = null;
  mestre = null;
}

/** Liga e desliga o mudo do rádio (só para mim). */
export function mudoRadio(mudo: boolean) {
  local.set("radio-mudo", mudo ? "1" : "0");
  if (mudo) pararRadio();
}
