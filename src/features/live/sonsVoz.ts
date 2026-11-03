/*
 * Sons da voz, como no Discord: dois tons subindo quando alguém entra no canal em que eu estou (e quando eu entro),
 * e descendo quando alguém sai. Desenhados com o AudioContext (sem arquivo de som). Surdo não ouve; o volume segue o
 * volume geral da voz. Quem decide quando tocar é o syncVoz (voz.ts), pela presença da sala.
 */
import { getApp } from "@/lib/store";

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

/** Um tom curto com subida e descida suaves (sem estalo). */
function tom(c: AudioContext, freq: number, ini: number, dur: number, vol: number) {
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + ini;
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function somDaVoz(tipo: "entrou" | "saiu", volumeGeral: number) {
  if (getApp().vozSurdo || volumeGeral <= 0) return;
  const c = contexto();
  if (!c) return;
  const vol = 0.12 * volumeGeral;
  /* entrou: ré → lá (sobe); saiu: lá → ré (desce) */
  const [a, b] = tipo === "entrou" ? [587.33, 880] : [880, 587.33];
  tom(c, a, 0, 0.16, vol);
  tom(c, b, 0.09, 0.22, vol);
}
