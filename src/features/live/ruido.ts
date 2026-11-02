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
};

const semFiltro = (bruto: MediaStream): MicFiltrado => ({
  stream: bruto,
  filtrado: false,
  fonte: bruto.getAudioTracks()[0],
  parar: () => bruto.getTracks().forEach((t) => t.stop()),
});

/**
 * Passa o microfone pela RNNoise. `bruto` deve vir sem a supressão do navegador
 * (`noiseSuppression: false`), para não filtrar duas vezes; se a RNNoise não ligar, ela é religada aqui.
 */
export async function filtrarRuido(bruto: MediaStream): Promise<MicFiltrado> {
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
    const saida = ctx.createMediaStreamDestination();
    fonte.connect(rnnoise).connect(saida);
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const c = ctx;
    return {
      stream: saida.stream,
      filtrado: true,
      fonte: faixa,
      parar: () => {
        try {
          fonte.disconnect();
          rnnoise.disconnect();
          rnnoise.destroy();
        } catch {}
        c.close().catch(() => {});
        bruto.getTracks().forEach((t) => t.stop());
      },
    };
  } catch (e) {
    console.warn("supressão de ruído forte indisponível; usando a do navegador", e);
    wasm = null;
    ctx?.close().catch(() => {});
    await faixa.applyConstraints({ ...faixa.getConstraints(), noiseSuppression: true }).catch(() => {});
    return semFiltro(bruto);
  }
}

/** Abre o microfone com as preferências (aparelho, eco) e, com a supressão ligada, já filtrado pela RNNoise. */
export async function abrirMic(p: PrefsMidia = useMidia.getState()): Promise<MicFiltrado> {
  const bruto = await navigator.mediaDevices.getUserMedia({ audio: restricoesMic(p), video: false });
  return p.ruido ? filtrarRuido(bruto) : semFiltro(bruto);
}
