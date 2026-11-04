/*
 * Ao vivo: liga a transmissão de tela, as câmeras, as reações e o desenho à sala.
 * Liga também a voz das salas (voz.ts), que usa a mesma sinalização.
 * `iniciarLive()` é chamado uma vez pela aba (LiveView); o resto do site usa
 * `assistir` (lista da sala) e `pararTudoAoVivo` (ao sair).
 */
import { aoMudarPresenca, aoReceber, naMinhaSala, limitePorPessoa, sidValido } from "@/lib/sala";
import { getApp, MY_KEY, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { camOnAnswer, camOnBye, camOnIce, camOnOffer, camOnWatch, closeAllCams, fecharSaidasCam, stopCam, syncCams } from "./camera";
import { onRisco, pintar } from "./desenho";
import { onReacao } from "./reacoes";
import type { MsgRtc } from "./rtc";
import { ligarSomTelas } from "./somTelas";
import { closeAllWatches, onAnswer, onBye, onIce, onOffer, onWatch, stopLive, syncLive, watch } from "./tela";
import { ligarSoundboard } from "./soundboard";
import { somDeLive } from "./sonsVoz";
import { sairVoz, syncVoz, useAjustesVoz, vozOnAnswer, vozOnBye, vozOnIce, vozOnOffer } from "./voz";
import { iniciarVozMod } from "./vozMod";

const RTC_T = new Set(["watch", "offer", "answer", "ice", "bye", "cw", "co", "ca", "ci", "cb", "vo", "va", "vi", "vb"]);
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
  vo: vozOnOffer,
  va: vozOnAnswer,
  vi: vozOnIce,
  vb: vozOnBye,
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
  ligarSomTelas();
  if (iniciado) return;
  iniciado = true;
  aoReceber("rtc", (m) => onRtc(m));
  aoReceber("reacao", onReacao);
  aoReceber("risco", onRisco);
  aoMudarPresenca(() => {
    syncLive();
    syncCams();
    syncVoz();
    avisarLives();
  });
  iniciarVozMod();
  ligarSoundboard();
  /* entrei ou saí da voz: as câmeras são só de quem está na voz junto */
  useApp.subscribe((s, p) => {
    if (s.myVozSid !== p.myVozSid) syncCams();
  });
  addEventListener("resize", () => pintar());
  document.addEventListener("fullscreenchange", () => setTimeout(pintar, 60));
  addEventListener("pagehide", () => {
    try {
      stopLive();
      closeAllWatches();
      sairVoz();
    } catch {
      /* a página já está fechando */
    }
  });
  /* a presença pode ter chegado antes da aba montar */
  syncLive();
  syncCams();
}

/* "Fulano entrou ao vivo" (com um som), como no Discord: quem começa a transmitir na sala em que estou na voz.
   A primeira leitura (e trocar de sala) só anota quem já estava, sem avisar. */
let aoVivo: { sala: string | null; fids: Set<string> } | null = null;
function avisarLives() {
  const { onlineSala, minhaSala, myFid, myVozSid } = getApp();
  const fids = new Set(onlineSala.filter((p) => p.live && p.fid && p.fid !== myFid).map((p) => p.fid as string));
  const antes = aoVivo;
  aoVivo = { sala: minhaSala, fids };
  if (!antes || antes.sala !== minhaSala || !myVozSid) return;
  const novo = onlineSala.find((p) => p.live && p.fid && !antes.fids.has(p.fid) && p.fid !== myFid);
  if (!novo) return;
  toast(`${novo.name} entrou ao vivo`);
  somDeLive(useAjustesVoz.getState().geral);
}

/** Para a minha transmissão, as que estou assistindo, as câmeras e a voz (ao sair do site ou trocar de sala). */
export function pararTudoAoVivo(): void {
  stopLive();
  closeAllWatches();
  stopCam();
  closeAllCams();
  sairVoz();
}

/**
 * Trocar de uma sala para outra: para a minha transmissão, as que estou assistindo e a voz, e fecha as câmeras
 * da sala antiga, mas a minha câmera continua ligada (quem está na voz da sala nova passa a ver).
 */
export function pararAoTrocarDeSala(): void {
  stopLive();
  closeAllWatches();
  fecharSaidasCam();
  closeAllCams();
  sairVoz();
}

/** Abre a tela de quem está ao vivo; `principal` = vira a tela grande, com som. */
export function assistir(key: string, principal: boolean): void {
  watch(key, principal);
}
