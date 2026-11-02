/*
 * Preferências de voz e vídeo de cada pessoa (só neste navegador, chave `midia`): microfone, saída de som,
 * câmera, cancelamento de eco e supressão de ruído. A voz (voz.ts) e a câmera (camera.ts) leem daqui.
 */
import { create } from "zustand";
import { local } from "@/lib/util";

export type PrefsMidia = {
  /** deviceId escolhido ("" = o padrão do sistema) */
  mic: string;
  saida: string;
  cam: string;
  eco: boolean;
  ruido: boolean;
};

export type Dispositivo = { id: string; nome: string };

const salvo = local.json<Partial<Record<keyof PrefsMidia, unknown>>>("midia") || {};
const texto = (v: unknown) => (typeof v === "string" && v.length < 300 ? v : "");

export const useMidia = create<PrefsMidia & { mics: Dispositivo[]; saidas: Dispositivo[]; cams: Dispositivo[]; liberado: boolean }>()(() => ({
  mic: texto(salvo.mic),
  saida: texto(salvo.saida),
  cam: texto(salvo.cam),
  eco: salvo.eco !== false,
  ruido: salvo.ruido !== false,
  mics: [],
  saidas: [],
  cams: [],
  /* o navegador só dá o nome dos aparelhos depois de liberar o microfone ou a câmera */
  liberado: false,
}));

export function salvarMidia(p: Partial<PrefsMidia>) {
  useMidia.setState(p);
  const { mic, saida, cam, eco, ruido } = useMidia.getState();
  local.setJson("midia", { mic, saida, cam, eco, ruido });
}

/** O navegador deixa escolher a saída de som (setSinkId)? Hoje só Chrome e Edge. */
export const podeEscolherSaida = () => typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

/**
 * Restrições do microfone da voz (o aparelho escolhido, se ainda existir; senão o padrão).
 * Com a supressão de ruído ligada, quem filtra é a RNNoise (live/ruido.ts), então a do navegador fica desligada
 * para não filtrar duas vezes; navegador sem AudioWorklet usa a dele.
 */
export function restricoesMic(p: PrefsMidia = useMidia.getState()): MediaTrackConstraints {
  const forte = p.ruido && typeof AudioWorkletNode !== "undefined";
  return {
    ...(p.mic ? { deviceId: { ideal: p.mic } } : {}),
    echoCancellation: p.eco,
    noiseSuppression: p.ruido && !forte,
    autoGainControl: true,
  };
}

/** A câmera escolhida, para juntar às restrições de tamanho da câmera. */
export const restricoesCam = (p: PrefsMidia = useMidia.getState()): MediaTrackConstraints => (p.cam ? { deviceId: { ideal: p.cam } } : {});

/** Aplica a saída de som escolhida num <audio> (navegador sem a opção: segue no padrão). */
export function aplicarSaida(a: HTMLMediaElement) {
  const id = useMidia.getState().saida;
  if (!podeEscolherSaida()) return;
  (a as HTMLMediaElement & { setSinkId(id: string): Promise<void> }).setSinkId(id).catch(() => {});
}

/** Lê a lista de microfones, saídas e câmeras. */
export async function listarAparelhos() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const todos = await navigator.mediaDevices.enumerateDevices();
    const de = (kind: MediaDeviceKind, base: string): Dispositivo[] =>
      todos
        /* "default" e "communications" são atalhos do sistema; o "Padrão do sistema" da lista já cobre */
        .filter((d) => d.kind === kind && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")
        .map((d, i) => ({ id: d.deviceId, nome: d.label || `${base} ${i + 1}` }));
    useMidia.setState({
      mics: de("audioinput", "Microfone"),
      saidas: de("audiooutput", "Saída"),
      cams: de("videoinput", "Câmera"),
      liberado: todos.some((d) => !!d.label),
    });
  } catch (e) {
    console.warn("sem lista de aparelhos", e);
  }
}

let ouvindo = false;
/** Atualiza a lista quando um fone ou uma câmera é ligado ou desligado. */
export function acompanharAparelhos() {
  if (ouvindo || !navigator.mediaDevices) return;
  ouvindo = true;
  navigator.mediaDevices.addEventListener("devicechange", () => listarAparelhos());
}
