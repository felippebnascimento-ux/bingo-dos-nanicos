/*
 * Soundboard, como no Discord: quem está na voz toca um som curto e todo mundo da voz da sala ouve.
 * Vai pelo evento `som` do canal da sala ({ s: id do som }), conferido como manda a regra 4: o id tem que estar na
 * lista, quem mandou tem que estar na minha sala e na voz, e no máximo 3 sons a cada 6 s por pessoa.
 * Os sons são desenhados com o Web Audio (sem arquivo novo), menos o dinheiro, que é o do cassino.
 */
import { enviar, aoReceber, limitePorPessoa, naMinhaSala } from "@/lib/sala";
import { getApp, MY_KEY } from "@/lib/store";
import { tocarSom } from "@/lib/sons";
import { toast } from "@/lib/toast";
import { ajuste } from "@/features/config/ajustes";
import { useAjustesVoz } from "./voz";

export const SONS = [
  { id: "badumtss", nome: "Ba dum tss", emoji: "🥁" },
  { id: "buzina", nome: "Buzina", emoji: "📯" },
  { id: "palmas", nome: "Palmas", emoji: "👏" },
  { id: "grilo", nome: "Grilos", emoji: "🦗" },
  { id: "erro", nome: "Errou", emoji: "❌" },
  { id: "tada", nome: "Tcharam", emoji: "🎉" },
  { id: "dinheiro", nome: "Dinheiro", emoji: "💸" },
] as const;
export type IdSom = (typeof SONS)[number]["id"];
const IDS = new Set<string>(SONS.map((s) => s.id));

let ctx: AudioContext | null = null;
function contexto(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/* as peças: um tom, um tambor (tom que despenca) e um chiado (prato, palma) */
function tom(c: AudioContext, saida: AudioNode, f: number, ini: number, dur: number, vol: number, tipo: OscillatorType = "sine", ate?: number) {
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + ini;
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(saida);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function chiado(c: AudioContext, saida: AudioNode, ini: number, dur: number, vol: number, corte: number) {
  const n = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const fonte = c.createBufferSource(), filtro = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + ini;
  fonte.buffer = buf;
  filtro.type = "highpass";
  filtro.frequency.value = corte;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  fonte.connect(filtro).connect(g).connect(saida);
  fonte.start(t);
}

/** Toca um som da soundboard só aqui (volume de 0 a 1). */
export function tocarSoundboard(id: IdSom, volume: number) {
  if (volume <= 0) return;
  if (id === "dinheiro") return void tocarSom("dinheiro", 0.6 * volume);
  const c = contexto();
  if (!c) return;
  const g = c.createGain();
  g.gain.value = Math.min(1, volume);
  g.connect(c.destination);
  if (id === "badumtss") {
    tom(c, g, 160, 0, 0.18, 0.5, "sine", 60);
    tom(c, g, 220, 0.2, 0.16, 0.4, "sine", 90);
    chiado(c, g, 0.42, 0.7, 0.25, 6000);
  } else if (id === "buzina") {
    for (const [f, ini] of [[440, 0], [440, 0.3], [440, 0.6]] as const) {
      tom(c, g, f, ini, 0.26, 0.12, "sawtooth");
      tom(c, g, f * 1.5, ini, 0.26, 0.08, "sawtooth");
      tom(c, g, f * 2, ini, 0.26, 0.05, "square");
    }
  } else if (id === "palmas") {
    for (let i = 0; i < 7; i++) chiado(c, g, i * 0.13 + Math.random() * 0.03, 0.08, 0.5, 1200);
  } else if (id === "grilo") {
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) tom(c, g, 4300, k * 0.45 + i * 0.045, 0.03, 0.06, "sine");
  } else if (id === "erro") {
    tom(c, g, 392, 0, 0.25, 0.15, "square");
    tom(c, g, 311, 0.25, 0.5, 0.15, "square");
  } else if (id === "tada") {
    tom(c, g, 523.25, 0, 0.12, 0.12, "triangle");
    tom(c, g, 659.25, 0.1, 0.12, 0.12, "triangle");
    tom(c, g, 783.99, 0.2, 0.12, 0.12, "triangle");
    tom(c, g, 1046.5, 0.3, 0.6, 0.14, "triangle");
  }
}

const meu = limitePorPessoa(3, 6000);
/** Toca um som para todo mundo da voz (e para mim). */
export function mandarSom(id: IdSom) {
  const { myVozSid, vozSurdo } = getApp();
  if (!myVozSid) return toast("Entre na voz para usar a soundboard.");
  if (!meu(MY_KEY)) return toast("Calma: no máximo 3 sons a cada 6 segundos.");
  enviar("som", { s: id });
  if (!vozSurdo) tocarSoundboard(id, useAjustesVoz.getState().geral);
}

const deles = limitePorPessoa(3, 6000);
let ligado = false;
export function ligarSoundboard() {
  if (ligado) return;
  ligado = true;
  aoReceber("som", (m) => {
    const { myVozSid, vozSurdo, onlineSala } = getApp();
    if (typeof m.from !== "string" || typeof m.s !== "string" || !IDS.has(m.s)) return;
    if (!myVozSid || vozSurdo || !naMinhaSala(m.from) || !deles(m.from)) return;
    const p = onlineSala.find((x) => x.key === m.from);
    /* só de quem está na voz, e não de quem eu silenciei */
    const aj = useAjustesVoz.getState();
    if (!p?.voz || (p.fid && (aj.silenciados.includes(p.fid) || aj.semSoundboard.includes(p.fid)))) return;
    if (ajuste("somSoundboard")) tocarSoundboard(m.s as IdSom, useAjustesVoz.getState().geral);
  });
}
