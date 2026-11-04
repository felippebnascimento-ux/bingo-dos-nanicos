/*
 * Sons da voz: o "ding" quando alguém entra no canal em que eu estou (e quando eu entro) e o vento ("whoosh") quando
 * alguém sai (arquivos em public/sons/, pedido do Felippe em 03/11/2026; antes eram dois tons desenhados). Surdo não
 * ouve; o volume segue o volume geral da voz. Quem decide quando tocar é o syncVoz (voz.ts), pela presença da sala.
 * A campainha de chegada no K-FOFO continua desenhada com o AudioContext.
 */
import { getApp } from "@/lib/store";
import { tocarSom } from "@/lib/sons";

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
  /* o ding é alto: fica a 35% do volume geral; o vento, a 60% */
  tocarSom(tipo, (tipo === "entrou" ? 0.35 : 0.6) * Math.min(1, volumeGeral));
}

/** Campainha de quando alguém abre o site e chega no K-FOFO (Chegadas.tsx): três notas subindo, mais suave que a da voz. */
export function somDeChegada(volumeGeral: number) {
  if (getApp().vozSurdo || volumeGeral <= 0) return;
  const c = contexto();
  if (!c) return;
  const vol = 0.09 * volumeGeral;
  tom(c, 659.25, 0, 0.18, vol);
  tom(c, 783.99, 0.12, 0.18, vol);
  tom(c, 1046.5, 0.24, 0.32, vol);
}
