/*
 * O som das transmissões que eu assisto, como no Discord: cada tela que eu ouço toca num <audio> próprio, na saída de
 * som escolhida nas Configurações e com o volume dela (de 0 a 200%; acima de 100% passa por um ganho do Web Audio).
 * Os vídeos ficam sempre mudos (só imagem). A tela principal sempre toca; dá para ouvir mais telas juntas (`ouvirJunto`).
 * Surdo na voz também tira o som das transmissões.
 */
import { create } from "zustand";
import { aplicarSaida, useMidia } from "@/features/config/midia";
import { getApp, useApp } from "@/lib/store";
import { setLive, useLive } from "./estado";
import { LIVE, volumeDaTela } from "./tela";

/** Telas (chave da presença) que eu ouço junto com a principal. */
export const useOuvindo = create<{ junto: string[] }>()(() => ({ junto: [] }));

type Som = { audio: HTMLAudioElement; ids: string; reforco?: { fonte: MediaStreamAudioSourceNode; ganho: GainNode } };
const sons = new Map<string, Som>();
let ctx: AudioContext | null = null;

export function ouvirJunto(key: string, sim: boolean) {
  const l = useOuvindo.getState().junto.filter((k) => k !== key);
  useOuvindo.setState({ junto: sim ? [...l, key] : l });
  sincronizar();
}
export const ouvindoTela = (key: string) => LIVE.main === key || useOuvindo.getState().junto.includes(key);

function contexto(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    const c = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    c.setSinkId?.(useMidia.getState().saida || "").catch(() => {});
    if (ctx.state !== "running") {
      void ctx.resume().then(sincronizar).catch(() => {});
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}
function soltar(s: Som) {
  if (!s.reforco) return;
  try {
    s.reforco.fonte.disconnect();
    s.reforco.ganho.disconnect();
  } catch {}
  s.reforco = undefined;
}

function aplicar(key: string, s: Som) {
  const v = Math.max(0, Math.min(2, volumeDaTela(key)));
  const mudo = getApp().vozSurdo;
  const st = s.audio.srcObject as MediaStream | null;
  if (v > 1 && st) {
    const c = contexto();
    if (c) {
      if (!s.reforco) {
        const fonte = c.createMediaStreamSource(st);
        const ganho = c.createGain();
        fonte.connect(ganho).connect(c.destination);
        s.reforco = { fonte, ganho };
      }
      s.reforco.ganho.gain.value = mudo ? 0 : v;
      /* o <audio> continua tocando mudo (senão o Chrome não entrega o som da conexão ao Web Audio) */
      s.audio.volume = 1;
      s.audio.muted = true;
      return;
    }
  }
  soltar(s);
  s.audio.volume = Math.min(1, v);
  s.audio.muted = mudo;
}

function tocar(a: HTMLAudioElement) {
  a.play()
    .then(() => useLive.getState().unmute && setLive({ unmute: false }))
    .catch(() => setLive({ unmute: true }));
}
/** "Ativar som": o toque da pessoa libera o som de todas as telas. */
export function ativarSomTelas() {
  for (const s of sons.values()) tocar(s.audio);
  void ctx?.resume().catch(() => {});
}

/** Liga, troca e desliga o som de cada tela conforme o que estou assistindo e ouvindo. */
export function sincronizar() {
  const quer = new Map<string, MediaStreamTrack[]>();
  for (const key of new Set([LIVE.main, ...useOuvindo.getState().junto])) {
    const faixas = key ? LIVE.watching.get(key)?.stream?.getAudioTracks() : undefined;
    if (key && faixas?.length) quer.set(key, faixas);
  }
  for (const [key, s] of [...sons])
    if (!quer.has(key)) {
      soltar(s);
      s.audio.pause();
      s.audio.srcObject = null;
      sons.delete(key);
    }
  for (const [key, faixas] of quer) {
    const ids = faixas.map((t) => t.id).join(",");
    let s = sons.get(key);
    if (!s) {
      const audio = new Audio();
      audio.autoplay = true;
      aplicarSaida(audio);
      s = { audio, ids: "" };
      sons.set(key, s);
    }
    if (s.ids !== ids) {
      soltar(s);
      s.audio.srcObject = new MediaStream(faixas);
      s.ids = ids;
      tocar(s.audio);
    }
    aplicar(key, s);
  }
  /* quem saiu da lista de ouvir junto (parou de transmitir ou de ser assistido) */
  const junto = useOuvindo.getState().junto.filter((k) => LIVE.watching.has(k) && k !== LIVE.main);
  if (junto.length !== useOuvindo.getState().junto.length) useOuvindo.setState({ junto });
}

let ligado = false;
/** Liga o mixer (uma vez): acompanha as telas, os volumes, o surdo e a saída de som. */
export function ligarSomTelas() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  useLive.subscribe((s, p) => {
    if (s.v !== p.v || s.vol !== p.vol || s.volTelas !== p.volTelas) sincronizar();
  });
  useApp.subscribe((s, p) => {
    if (s.vozSurdo !== p.vozSurdo) sincronizar();
  });
  useMidia.subscribe((s, p) => {
    if (s.saida === p.saida) return;
    for (const x of sons.values()) aplicarSaida(x.audio);
    const c = ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null;
    c?.setSinkId?.(s.saida || "").catch(() => {});
  });
}
