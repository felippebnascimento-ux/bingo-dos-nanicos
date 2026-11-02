/*
 * Ao vivo: liga a transmissão de tela, as câmeras, as reações e o desenho à sala.
 * `iniciarLive()` é chamado uma vez pela aba (LiveView); o resto do site usa
 * `assistir` (lista da sala) e `pararTudoAoVivo` (ao sair).
 */
import { aoMudarPresenca, aoReceber, naMinhaSala, limitePorPessoa, sidValido } from "@/lib/sala";
import { MY_KEY } from "@/lib/store";
import { camOnAnswer, camOnBye, camOnIce, camOnOffer, camOnWatch, closeAllCams, stopCam, syncCams } from "./camera";
import { onRisco, pintar } from "./desenho";
import { onReacao } from "./reacoes";
import type { MsgRtc } from "./rtc";
import { closeAllWatches, onAnswer, onBye, onIce, onOffer, onWatch, stopLive, syncLive, watch } from "./tela";

const RTC_T = new Set(["watch", "offer", "answer", "ice", "bye", "cw", "co", "ca", "ci", "cb"]);
const ACOES: Record<string, (m: MsgRtc) => unknown> = {
  watch: onWatch,
  offer: onOffer,
  answer: onAnswer,
  ice: onIce,
  bye: onBye,
  cw: camOnWatch,
  co: camOnOffer,
  ca: camOnAnswer,
  ci: camOnIce,
  cb: camOnBye,
};

/** Confere o formato da mensagem de sinalização (vem de outro navegador: não é confiável). */
function rtcOk(m: Record<string, unknown>): m is Record<string, unknown> & MsgRtc {
  if (typeof m.t !== "string" || !RTC_T.has(m.t) || typeof m.from !== "string" || !sidValido(m.sid)) return false;
  if (m.role !== undefined && m.role !== "s" && m.role !== "v") return false;
  if (m.sdp !== undefined && (typeof m.sdp !== "string" || m.sdp.length > 60000)) return false;
  if (m.c !== undefined) {
    if (!m.c || typeof m.c !== "object") return false;
    try {
      if (JSON.stringify(m.c).length > 2000) return false;
    } catch {
      return false;
    }
  }
  return true;
}

const rtcLimite = limitePorPessoa(300, 10000); /* no máximo 300 mensagens a cada 10 s por pessoa */

function onRtc(m: Record<string, unknown>, tentativa = 0) {
  if (m.to !== MY_KEY || m.from === MY_KEY || !rtcOk(m)) return;
  if (!tentativa && !rtcLimite(m.from)) return;
  /* só aceita de quem está na sala; se a lista ainda não atualizou, espera um pouco antes de descartar */
  if (!naMinhaSala(m.from)) {
    if (tentativa < 4) setTimeout(() => onRtc(m, tentativa + 1), 750);
    return;
  }
  ACOES[m.t]?.(m);
}

let iniciado = false;
/** Liga os handlers da sala e os eventos do navegador (uma vez só). */
export function iniciarLive() {
  if (iniciado) return;
  iniciado = true;
  aoReceber("rtc", (m) => onRtc(m));
  aoReceber("reacao", onReacao);
  aoReceber("risco", onRisco);
  aoMudarPresenca(() => {
    syncLive();
    syncCams();
  });
  addEventListener("resize", () => pintar());
  document.addEventListener("fullscreenchange", () => setTimeout(pintar, 60));
  addEventListener("pagehide", () => {
    try {
      stopLive();
      closeAllWatches();
    } catch {
      /* a página já está fechando */
    }
  });
  /* a presença pode ter chegado antes da aba montar */
  syncLive();
  syncCams();
}

/** Para a minha transmissão, as que estou assistindo e as câmeras (ao sair do site). */
export function pararTudoAoVivo(): void {
  stopLive();
  closeAllWatches();
  stopCam();
  closeAllCams();
}

/** Abre a tela de quem está ao vivo; `principal` = vira a tela grande, com som. */
export function assistir(key: string, principal: boolean): void {
  watch(key, principal);
}
