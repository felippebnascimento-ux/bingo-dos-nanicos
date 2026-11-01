/*
 * Transmissão de tela: quem transmite (viewers) e quem assiste (watching).
 * Tudo mora aqui, fora do React; os componentes leem `LIVE` e re-renderizam com `avisar()`.
 */
import { toast } from "@/lib/toast";
import { getApp, MY_KEY, setApp } from "@/lib/store";
import type { Presence } from "@/lib/tipos";
import { newId } from "@/lib/util";
import { avisar, getLive } from "./estado";
import { ajustarSender, canShare, hiBitrate, novaConexao, preferH264, sendRtc, stereo, type MsgRtc } from "./rtc";

export type Viewer = { pc: RTCPeerConnection; queue: RTCIceCandidateInit[]; at: number };
export type Watch = {
  key: string;
  sid: string;
  fid: string | null;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  queue: RTCIceCandidateInit[];
  state: "connecting" | "live" | "failed";
  to?: ReturnType<typeof setTimeout>;
};

export const LIVE = {
  mySid: null as string | null,
  myStream: null as MediaStream | null,
  hasAudio: false,
  surface: "",
  viewers: new Map<string, Viewer>(),
  watching: new Map<string, Watch>(),
  main: null as string | null,
  /** o <video> da tela principal (para o desenho, o PiP e o "Ativar som") */
  mainVideo: null as HTMLVideoElement | null,
};

/* qualidade: resolução (1080p ou 1440p) x fluidez (30 ou 60 fps; o WebRTC dos navegadores não passa de 60) */
export const RES = { 1080: { w: 1920, h: 1080, nome: "1080p · Full HD" }, 1440: { w: 2560, h: 1440, nome: "1440p · 2K" } };
/* teto por pessoa que assiste e o upload total que dá para dividir entre todos */
const liveCap = () => {
  const { res, fps } = getLive();
  return { 1080: { 60: 12e6, 30: 8e6 }, 1440: { 60: 20e6, 30: 13e6 } }[res][fps];
};
const liveBudget = () => ({ 1080: 30e6, 1440: 40e6 })[getLive().res];

/** Quem está transmitindo agora (menos eu), em ordem de nome. */
export const liveStreams = (online: Presence[] = getApp().online) =>
  online
    .filter((p) => p.live && p.key !== MY_KEY)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));

/* ---------- quem transmite ---------- */
export async function startLive() {
  if (!canShare) return toast("Transmitir só funciona no navegador do computador.");
  const { res, fps } = getLive();
  /* cada navegador aceita opções diferentes: tenta da mais completa para a mais simples */
  const R = RES[res],
    vid = { frameRate: { ideal: fps, max: fps }, width: { ideal: R.w, max: R.w }, height: { ideal: R.h, max: R.h } };
  const aud = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  const extra = { systemAudio: "include", selfBrowserSurface: "exclude", surfaceSwitching: "include" };
  const tentativas: Record<string, unknown>[] = [
    { video: vid, audio: aud, ...extra, windowAudio: "window" },
    { video: vid, audio: aud, ...extra },
    { video: vid, audio: true, systemAudio: "include" },
    { video: { frameRate: fps }, audio: true },
    { video: true, audio: true },
  ];
  let stream: MediaStream | null = null,
    erro: unknown = null;
  for (let i = 0; i < tentativas.length; i++) {
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(tentativas[i] as DisplayMediaStreamOptions);
      break;
    } catch (e) {
      erro = e;
      const nome = e instanceof Error ? e.name : "";
      console.warn("captura, tentativa", i + 1, nome, e instanceof Error ? e.message : "");
      if (nome === "AbortError") return;
      if (nome === "NotAllowedError") {
        if (i > 0) toast("Clique de novo em “Transmitir minha tela”.");
        return;
      }
      if (!["TypeError", "NotSupportedError", "OverconstrainedError", "InvalidStateError"].includes(nome)) break;
    }
  }
  if (!stream) {
    console.error(erro);
    const nome = erro instanceof Error ? erro.name : "";
    toast(`Não deu para capturar a tela${nome ? ` (${nome})` : ""}. Tente pelo Chrome ou Edge atualizado.`);
    return;
  }
  const vt = stream.getVideoTracks()[0];
  if (vt) {
    try {
      vt.contentHint = "motion";
    } catch {
      /* navegador sem contentHint */
    }
    vt.addEventListener("ended", () => stopLive());
  }
  LIVE.myStream = stream;
  LIVE.mySid = newId();
  LIVE.hasAudio = stream.getAudioTracks().length > 0;
  try {
    LIVE.surface = String((vt?.getSettings?.() as { displaySurface?: string } | undefined)?.displaySurface || "");
  } catch {
    LIVE.surface = "";
  }
  setApp({ myLiveSid: LIVE.mySid });
  avisar();
  toast(LIVE.hasAudio ? "Você está ao vivo" : "Você está ao vivo, mas sem som");
}

export function stopLive() {
  if (!LIVE.mySid) return;
  for (const [key, v] of LIVE.viewers) {
    sendRtc({ t: "bye", to: key, sid: LIVE.mySid, role: "s" });
    try {
      v.pc.close();
    } catch {}
  }
  LIVE.viewers.clear();
  LIVE.myStream?.getTracks().forEach((t) => t.stop());
  LIVE.myStream = null;
  LIVE.mySid = null;
  LIVE.hasAudio = false;
  setApp({ myLiveSid: null });
  avisar();
}

function closeViewer(key: string, silent?: boolean) {
  const v = LIVE.viewers.get(key);
  if (!v) return;
  try {
    v.pc.close();
  } catch {}
  LIVE.viewers.delete(key);
  if (!silent && LIVE.mySid) sendRtc({ t: "bye", to: key, sid: LIVE.mySid, role: "s" });
  tuneSenders();
  avisar();
}

function tuneSenders() {
  /* por pessoa: 1080p até 12 Mbps (60 fps) ou 8 (30); 1440p até 20 ou 13. Com muita gente, divide o upload.
     A rede ainda ajusta sozinha para baixo se a internet não aguentar. */
  const n = Math.max(1, LIVE.viewers.size),
    cap = liveCap(),
    fps = getLive().fps;
  const br = Math.round(Math.min(cap, Math.max(2.5e6, liveBudget() / n)));
  for (const v of LIVE.viewers.values())
    for (const sd of v.pc.getSenders()) {
      if (!sd.track) continue;
      if (sd.track.kind === "video")
        ajustarSender(
          sd,
          { maxBitrate: br, maxFramerate: fps, scaleResolutionDownBy: 1, priority: "high", networkPriority: "high" },
          { degradationPreference: "maintain-resolution" },
        );
      else ajustarSender(sd, { maxBitrate: 192000, priority: "high", networkPriority: "high" });
    }
}

export async function onWatch(m: MsgRtc) {
  if (!LIVE.mySid || !LIVE.myStream || m.sid !== LIVE.mySid) {
    sendRtc({ t: "bye", to: m.from, sid: m.sid, role: "s" });
    return;
  }
  closeViewer(m.from, true);
  const pc = novaConexao(),
    stream = LIVE.myStream,
    sid = LIVE.mySid;
  const v: Viewer = { pc, queue: [], at: Date.now() };
  LIVE.viewers.set(m.from, v);
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  preferH264(pc);
  pc.onicecandidate = (e) => {
    if (e.candidate) sendRtc({ t: "ice", to: m.from, sid, role: "s", c: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") closeViewer(m.from, true);
    else {
      tuneSenders();
      avisar();
    }
  };
  try {
    const off = await pc.createOffer();
    off.sdp = hiBitrate(stereo(off.sdp || ""));
    await pc.setLocalDescription(off);
    sendRtc({ t: "offer", to: m.from, sid, sdp: pc.localDescription?.sdp || "" });
    tuneSenders();
    avisar();
  } catch (e) {
    console.error(e);
    closeViewer(m.from, true);
  }
}

export async function onAnswer(m: MsgRtc) {
  const v = LIVE.viewers.get(m.from);
  if (!v || m.sid !== LIVE.mySid || !m.sdp) return;
  try {
    await v.pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
    for (const c of v.queue.splice(0)) await v.pc.addIceCandidate(c).catch(() => {});
    tuneSenders();
  } catch (e) {
    console.error(e);
  }
}

/* ---------- quem assiste ---------- */
function openWatch(p: Presence): Watch {
  const pc = novaConexao();
  const w: Watch = { key: p.key, sid: p.live || "", fid: p.fid, name: p.name, pc, stream: null, queue: [], state: "connecting" };
  pc.ontrack = (e) => {
    const st = e.streams && e.streams[0];
    /* um MediaStream novo a cada mudança, para o React perceber e trocar o srcObject */
    if (st && w.stream !== st) w.stream = st;
    else if (!w.stream) w.stream = new MediaStream([e.track]);
    else if (!w.stream.getTracks().includes(e.track)) w.stream = new MediaStream([...w.stream.getTracks(), e.track]);
    w.state = "live";
    clearTimeout(w.to);
    avisar();
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) sendRtc({ t: "ice", to: w.key, sid: w.sid, role: "v", c: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") {
      w.state = "failed";
      avisar();
    }
  };
  w.to = setTimeout(() => {
    if (w.state === "connecting") {
      w.state = "failed";
      avisar();
    }
  }, 20000);
  LIVE.watching.set(p.key, w);
  sendRtc({ t: "watch", to: p.key, sid: w.sid });
  return w;
}

function closeWatch(key: string, silent?: boolean) {
  const w = LIVE.watching.get(key);
  if (!w) return;
  clearTimeout(w.to);
  try {
    w.pc.close();
  } catch {}
  if (!silent) sendRtc({ t: "bye", to: key, sid: w.sid, role: "v" });
  LIVE.watching.delete(key);
  if (LIVE.main === key) LIVE.main = [...LIVE.watching.keys()][0] || null;
}

export function closeAllWatches() {
  for (const k of [...LIVE.watching.keys()]) closeWatch(k);
  avisar();
}

/** Abre a tela de quem está ao vivo; `asMain` = vira a tela principal, com som. */
export function watch(key: string, asMain: boolean) {
  const p = getApp().online.find((x) => x.key === key && x.live);
  if (!p) return;
  let w = LIVE.watching.get(key);
  if (w && (w.sid !== p.live || w.state === "failed")) {
    closeWatch(key);
    w = undefined;
  }
  if (!w) openWatch(p);
  if (asMain || !LIVE.main) LIVE.main = key;
  avisar();
}

export function unwatch(key: string) {
  closeWatch(key);
  avisar();
}

export async function onOffer(m: MsgRtc) {
  const w = LIVE.watching.get(m.from);
  if (!w || w.sid !== m.sid || !m.sdp) return;
  try {
    await w.pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
    for (const c of w.queue.splice(0)) await w.pc.addIceCandidate(c).catch(() => {});
    const ans = await w.pc.createAnswer();
    ans.sdp = hiBitrate(stereo(ans.sdp || ""));
    await w.pc.setLocalDescription(ans);
    sendRtc({ t: "answer", to: m.from, sid: m.sid, sdp: w.pc.localDescription?.sdp || "" });
  } catch (e) {
    console.error(e);
    w.state = "failed";
    avisar();
  }
}

export function onIce(m: MsgRtc) {
  const tgt = m.role === "s" ? LIVE.watching.get(m.from) : LIVE.viewers.get(m.from);
  if (!tgt || !m.c) return;
  if (m.role === "s" && (tgt as Watch).sid !== m.sid) return;
  if (m.role !== "s" && m.sid !== LIVE.mySid) return;
  if (!tgt.pc.remoteDescription) tgt.queue.push(m.c);
  else tgt.pc.addIceCandidate(m.c).catch(() => {});
}

export function onBye(m: MsgRtc) {
  if (m.role === "s") {
    const w = LIVE.watching.get(m.from);
    if (!w || w.sid !== m.sid) return;
    const wasMain = LIVE.main === m.from;
    closeWatch(m.from, true);
    if (wasMain) toast(`${w.name} parou de transmitir`);
    avisar();
  } else if (m.sid === LIVE.mySid) closeViewer(m.from, true);
}

/** Presença mudou: fecha o que acabou, reconecta quem reiniciou a transmissão. */
export function syncLive() {
  const online = getApp().online;
  for (const [key, w] of [...LIVE.watching]) {
    const p = online.find((x) => x.key === key);
    if (!p || !p.live) {
      const wasMain = LIVE.main === key;
      closeWatch(key, true);
      if (wasMain) toast(`${w.name} parou de transmitir`);
    } else if (p.live !== w.sid) {
      const wasMain = LIVE.main === key;
      closeWatch(key, true);
      openWatch(p);
      if (wasMain) LIVE.main = key;
    }
  }
  for (const [key, v] of [...LIVE.viewers])
    if (!online.some((x) => x.key === key) && Date.now() - v.at > 15000) closeViewer(key, true);
  avisar();
}

