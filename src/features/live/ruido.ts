/*
 * Supressão de ruído forte: o microfone passa pela RNNoise (uma rede neural pequena que roda no navegador,
 * a mesma ideia do Krisp do Discord) antes de ir para a sala. Corta teclado, ventilador e barulho de fundo
 * bem melhor que a supressão do próprio navegador.
 * Os arquivos vêm de public/ruido/ (copiados do node_modules no `npm install`). Se algo falhar
 * (navegador sem AudioWorklet, wasm bloqueado), volta para a supressão do navegador.
 */
import { restricoesMic, useMidia, type PrefsMidia } from "@/features/config/midia";

/** O navegador roda a RNNoise? (precisa de AudioWorklet) */
export const temRnnoise = () => typeof AudioWorkletNode !== "undefined" && typeof AudioContext !== "undefined";

let wasm: Promise<ArrayBuffer> | null = null;

export type MicFiltrado = {
  /** o áudio que vai para a sala (filtrado, ou o próprio microfone se o filtro não ligou) */
  stream: MediaStream;
  /** a RNNoise está ligada nele? */
  filtrado: boolean;
  /** a faixa do microfone de verdade (termina quando o aparelho é desligado; a filtrada nunca termina) */
  fonte: MediaStreamTrack | undefined;
  /** para tudo: o filtro e o microfone */
  parar: () => void;
  /** acorda o filtro (o celular pausa o áudio quando a tela apaga ou chega uma ligação; ao desmutar, volta) */
  retomar: () => void;
  /** o volume de entrada (das Configurações): muda na hora, sem reabrir o microfone */
  ganho?: GainNode;
};

const semFiltro = (bruto: MediaStream): MicFiltrado => ({
  stream: bruto,
  filtrado: false,
  fonte: bruto.getAudioTracks()[0],
  parar: () => bruto.getTracks().forEach((t) => t.stop()),
  retomar: () => {},
});

/** Contexto que só processa, sem abrir a saída de som (abrir reconfigura o áudio do computador). */
function ctxSemSaida(taxa?: number): AudioContext {
  const op = taxa ? { sampleRate: taxa } : {};
  try {
    return new AudioContext({ ...op, sinkId: { type: "none" } } as unknown as AudioContextOptions);
  } catch {
    return new AudioContext(op);
  }
}

/** Só o volume de entrada (sem a RNNoise): passa pelo Web Audio apenas se o volume não for 100%. */
function comGanho(bruto: MediaStream, vol: number): MicFiltrado {
  if (Math.abs(vol - 1) < 0.01 || typeof AudioContext === "undefined") return semFiltro(bruto);
  try {
    const c = ctxSemSaida();
    const fonte = c.createMediaStreamSource(bruto);
    const ganho = c.createGain();
    ganho.gain.value = vol;
    const saida = c.createMediaStreamDestination();
    fonte.connect(ganho).connect(saida);
    if (c.state === "suspended") void c.resume().catch(() => {});
    return {
      stream: saida.stream,
      filtrado: false,
      fonte: bruto.getAudioTracks()[0],
      ganho,
      parar: () => {
        try {
          fonte.disconnect();
          ganho.disconnect();
        } catch {}
        void c.close().catch(() => {});
        bruto.getTracks().forEach((t) => t.stop());
      },
      retomar: () => {
        if (c.state !== "running" && c.state !== "closed") void c.resume().catch(() => {});
      },
    };
  } catch {
    return semFiltro(bruto);
  }
}

/**
 * Passa o microfone pela RNNoise. `bruto` deve vir sem a supressão do navegador
 * (`noiseSuppression: false`), para não filtrar duas vezes; se a RNNoise não ligar, ela é religada aqui.
 */
export async function filtrarRuido(bruto: MediaStream, vol = 1): Promise<MicFiltrado> {
  const faixa = bruto.getAudioTracks()[0];
  if (!faixa || !temRnnoise()) return semFiltro(bruto);
  let ctx: AudioContext | null = null;
  try {
    /* a biblioteca só carrega quando alguém liga o microfone (e nunca no build) */
    const { loadRnnoise, RnnoiseWorkletNode } = await import("@sapphi-red/web-noise-suppressor");
    wasm ??= loadRnnoise({ url: "/ruido/rnnoise.wasm", simdUrl: "/ruido/rnnoise_simd.wasm" });
    const bin = await wasm;
    /* a RNNoise trabalha em 48 kHz; o contexto só processa, não toca nada (sem abrir a saída de som) */
    try {
      ctx = new AudioContext({ sampleRate: 48000, sinkId: { type: "none" } } as AudioContextOptions);
    } catch {
      ctx = new AudioContext({ sampleRate: 48000 });
    }
    await ctx.audioWorklet.addModule("/ruido/rnnoiseWorklet.js");
    const fonte = ctx.createMediaStreamSource(bruto);
    const rnnoise = new RnnoiseWorkletNode(ctx, { wasmBinary: bin, maxChannels: 1 });
    const ganho = ctx.createGain();
    ganho.gain.value = vol;
    const saida = ctx.createMediaStreamDestination();
    fonte.connect(rnnoise).connect(ganho).connect(saida);
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const c = ctx;
    /* o iPhone suspende (ou "interrompe") o contexto sozinho: sem ele rodando, sai silêncio mesmo desmutado */
    c.onstatechange = () => {
      if (c.state !== "running" && c.state !== "closed") c.resume().catch(() => {});
    };
    return {
      stream: saida.stream,
      filtrado: true,
      fonte: faixa,
      ganho,
      parar: () => {
        try {
          fonte.disconnect();
          rnnoise.disconnect();
          ganho.disconnect();
          rnnoise.destroy();
        } catch {}
        c.onstatechange = null;
        c.close().catch(() => {});
        bruto.getTracks().forEach((t) => t.stop());
      },
      retomar: () => {
        if (c.state !== "running" && c.state !== "closed") c.resume().catch(() => {});
      },
    };
  } catch (e) {
    console.warn("supressão de ruído forte indisponível; usando a do navegador", e);
    wasm = null;
    ctx?.close().catch(() => {});
    await faixa.applyConstraints({ ...faixa.getConstraints(), noiseSuppression: true }).catch(() => {});
    return comGanho(bruto, vol);
  }
}

/** Abre o microfone com as preferências (aparelho, eco) e, com a supressão ligada, já filtrado pela RNNoise. */
export async function abrirMic(p: PrefsMidia = useMidia.getState()): Promise<MicFiltrado> {
  const bruto = await navigator.mediaDevices.getUserMedia({ audio: restricoesMic(p), video: false });
  return p.ruido ? filtrarRuido(bruto, p.volEntrada) : comGanho(bruto, p.volEntrada);
}
