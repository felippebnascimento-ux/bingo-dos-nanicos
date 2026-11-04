/*
 * Câmera: quem liga manda um vídeo pequeno (até 480p, 24 fps) para quem está na voz da sala com ela.
 * Só quem está na voz se vê (os dois lados conferem). Na lista de membros, o vídeo aparece no lugar do rosto.
 * Só imagem: o som vai pela voz (voz.ts). Trocar de sala mantém a câmera ligada; sair para o lobby desliga.
 */
import { toast } from "@/lib/toast";
import { friendDaPresenca, getApp, MY_KEY, setApp } from "@/lib/store";
import type { Presence } from "@/lib/tipos";
import { local, newId } from "@/lib/util";
import { avisar } from "./estado";
import { ajustarSender, canCam, novaConexao, sendRtc, type MsgRtc } from "./rtc";
import { naVoz } from "./voz";
import { restricoesCam, useMidia } from "@/features/config/midia";
import { abrirJanelaPip, canPip, type JanelaPip } from "./pip";

type Saida = { pc: RTCPeerConnection; queue: RTCIceCandidateInit[]; at: number };
type Entrada = {
  key: string;
  sid: string;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  queue: RTCIceCandidateInit[];
  state: "connecting" | "live" | "failed";
  tries: number;
  to?: ReturnType<typeof setTimeout>;
};

export const CAM = {
  sid: null as string | null,
  stream: null as MediaStream | null,
  out: new Map<string, Saida>(),
  in: new Map<string, Entrada>(),
  /** o <video> de cada câmera na lista da sala (para o PiP do navegador, quando não há janela flutuante) */
  videos: new Map<string, HTMLVideoElement>(),
  win: null as JanelaPip | null,
  only: null as string | null,
};

/** Vídeo pequeno da câmera (a escolhida nas Configurações, se ainda existir). */
const videoCam = (): MediaTrackConstraints => ({
  width: { ideal: 480 },
  height: { ideal: 480 },
  frameRate: { ideal: 24, max: 24 },
  facingMode: "user",
  ...restricoesCam(),
});

let prefsLigadas = false;
/** Trocou a câmera nas Configurações com ela ligada: troca a imagem na hora, para todo mundo que vê. */
function ligarPrefs() {
  if (prefsLigadas) return;
  prefsLigadas = true;
  useMidia.subscribe(async (s, p) => {
    if (s.cam === p.cam || !CAM.stream) return;
    try {
      const novo = await navigator.mediaDevices.getUserMedia({ video: videoCam(), audio: false });
      const faixa = novo.getVideoTracks()[0];
      if (!CAM.stream || !faixa) return novo.getTracks().forEach((t) => t.stop());
      faixa.addEventListener("ended", () => stopCam());
      if (querDesfoque()) void aplicarDesfoque(faixa, true);
      for (const o of CAM.out.values())
        for (const sd of o.pc.getSenders()) if (sd.track?.kind === "video") await sd.replaceTrack(faixa).catch(() => {});
      CAM.stream.getTracks().forEach((t) => t.stop());
      CAM.stream = novo;
      avisar();
    } catch (e) {
      console.warn(e);
      toast("Não deu para trocar a câmera. Confira se ela está ligada.");
    }
  });
}

/* ---------- desfoque do fundo: só o do próprio aparelho (Windows 11 e Mac com o efeito do sistema), sem modelo no site ---------- */
type ComDesfoque = MediaTrackCapabilities & { backgroundBlur?: boolean[] };
/** O aparelho deixa o site ligar e desligar o desfoque do fundo nesta câmera? */
export const podeDesfocar = (t: MediaStreamTrack | null | undefined) => {
  try {
    const c = t?.getCapabilities?.() as ComDesfoque | undefined;
    return !!c?.backgroundBlur && c.backgroundBlur.includes(true) && c.backgroundBlur.includes(false);
  } catch {
    return false;
  }
};
export const querDesfoque = () => local.get("cam-desfoque") === "1";
export async function aplicarDesfoque(t: MediaStreamTrack | null | undefined, sim: boolean) {
  if (!t || !podeDesfocar(t)) return;
  await t.applyConstraints({ advanced: [{ backgroundBlur: sim } as MediaTrackConstraintSet] }).catch(() => {});
}
/** Liga ou desliga o desfoque e guarda (vale para a câmera ligada agora e para as próximas). */
export function mudarDesfoque(sim: boolean) {
  local.set("cam-desfoque", sim ? "1" : "0");
  void aplicarDesfoque(CAM.stream?.getVideoTracks()[0], sim);
}

export async function startCam() {
  if (!canCam) return toast("Seu navegador não liberou a câmera.");
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: videoCam(), audio: false });
    ligarPrefs();
    const t = st.getVideoTracks()[0];
    if (t) t.addEventListener("ended", () => stopCam());
    if (querDesfoque()) void aplicarDesfoque(t, true);
    CAM.stream = st;
    CAM.sid = newId();
    setApp({ myCamSid: CAM.sid });
    avisar();
  } catch (e) {
    console.warn(e);
    const nome = e instanceof Error ? e.name : "";
    toast(
      nome === "NotAllowedError"
        ? "A câmera foi bloqueada. Libere no cadeado ao lado do endereço do site."
        : nome === "NotFoundError"
          ? "Nenhuma câmera encontrada."
          : nome === "NotReadableError"
            ? "A câmera está sendo usada por outro programa (Meet, Discord...)."
            : "Não deu para ligar a câmera.",
    );
  }
}

/** Fecha as conexões de quem está vendo a minha câmera (ao trocar de sala), sem desligar a câmera. */
export function fecharSaidasCam() {
  if (!CAM.sid) return;
  for (const [key, o] of CAM.out) {
    sendRtc({ t: "cb", to: key, sid: CAM.sid, role: "s" });
    try {
      o.pc.close();
    } catch {}
  }
  CAM.out.clear();
}

export function stopCam() {
  if (!CAM.sid) return;
  fecharSaidasCam();
  CAM.stream?.getTracks().forEach((t) => t.stop());
  CAM.stream = null;
  CAM.sid = null;
  setApp({ myCamSid: null });
  avisar();
}

/* ---------- quem manda a câmera ---------- */
function camTune() {
  const n = Math.max(1, CAM.out.size),
    br = Math.round(Math.min(450e3, Math.max(150e3, 4e6 / n)));
  for (const o of CAM.out.values())
    for (const sd of o.pc.getSenders()) if (sd.track) ajustarSender(sd, { maxBitrate: br, maxFramerate: 24 });
}

function camCloseOut(key: string) {
  const o = CAM.out.get(key);
  if (!o) return;
  try {
    o.pc.close();
  } catch {}
  CAM.out.delete(key);
}

export async function camOnWatch(m: MsgRtc) {
  /* só manda a câmera estando na voz (quem pede só pede estando na voz também) */
  if (!CAM.sid || !CAM.stream || m.sid !== CAM.sid || !naVoz()) {
    sendRtc({ t: "cb", to: m.from, sid: m.sid, role: "s" });
    return;
  }
  camCloseOut(m.from);
  const pc = novaConexao(),
    o: Saida = { pc, queue: [], at: Date.now() },
    stream = CAM.stream,
    sid = CAM.sid;
  CAM.out.set(m.from, o);
  stream.getVideoTracks().forEach((t) => pc.addTrack(t, stream));
  pc.onicecandidate = (e) => {
    if (e.candidate) sendRtc({ t: "ci", to: m.from, sid, role: "s", c: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      if (CAM.out.get(m.from) === o) camCloseOut(m.from);
    } else camTune();
  };
  try {
    const off = await pc.createOffer();
    await pc.setLocalDescription(off);
    sendRtc({ t: "co", to: m.from, sid, sdp: pc.localDescription?.sdp || "" });
    camTune();
  } catch (e) {
    console.error(e);
    camCloseOut(m.from);
  }
}

export async function camOnAnswer(m: MsgRtc) {
  const o = CAM.out.get(m.from);
  if (!o || m.sid !== CAM.sid || !m.sdp) return;
  try {
    await o.pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
    for (const c of o.queue.splice(0)) await o.pc.addIceCandidate(c).catch(() => {});
    camTune();
  } catch (e) {
    console.error(e);
  }
}

/* ---------- quem recebe a câmera dos outros (automático para todos na sala) ---------- */
function camOpenIn(p: Presence, tries = 0) {
  const pc = novaConexao();
  const w: Entrada = { key: p.key, sid: p.cam || "", name: p.name, pc, stream: null, queue: [], state: "connecting", tries };
  pc.ontrack = (e) => {
    w.stream = (e.streams && e.streams[0]) || new MediaStream([e.track]);
    w.state = "live";
    clearTimeout(w.to);
    avisar();
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) sendRtc({ t: "ci", to: w.key, sid: w.sid, role: "v", c: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") camFail(w);
  };
  w.to = setTimeout(() => {
    if (w.state === "connecting") camFail(w);
  }, 20000);
  CAM.in.set(p.key, w);
  sendRtc({ t: "cw", to: p.key, sid: w.sid });
}

function camFail(w: Entrada) {
  if (CAM.in.get(w.key) !== w) return;
  w.state = "failed";
  clearTimeout(w.to);
  try {
    w.pc.close();
  } catch {}
  avisar();
  if (w.tries < 3)
    setTimeout(() => {
      const p = getApp().onlineSala.find((x) => x.key === w.key);
      if (CAM.in.get(w.key) !== w || !p || p.cam !== w.sid) return;
      CAM.in.delete(w.key);
      camOpenIn(p, w.tries + 1);
    }, 8000);
}

function camCloseIn(key: string, silent?: boolean) {
  const w = CAM.in.get(key);
  if (!w) return;
  clearTimeout(w.to);
  try {
    w.pc.close();
  } catch {}
  if (!silent && w.state !== "failed") sendRtc({ t: "cb", to: key, sid: w.sid, role: "v" });
  CAM.in.delete(key);
}

export function closeAllCams() {
  for (const k of [...CAM.in.keys()]) camCloseIn(k);
  avisar();
}

export async function camOnOffer(m: MsgRtc) {
  const w = CAM.in.get(m.from);
  if (!w || w.sid !== m.sid || !m.sdp) return;
  try {
    await w.pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
    for (const c of w.queue.splice(0)) await w.pc.addIceCandidate(c).catch(() => {});
    const ans = await w.pc.createAnswer();
    await w.pc.setLocalDescription(ans);
    sendRtc({ t: "ca", to: m.from, sid: m.sid, sdp: w.pc.localDescription?.sdp || "" });
  } catch (e) {
    console.error(e);
    camFail(w);
  }
}

export function camOnIce(m: MsgRtc) {
  const tgt = m.role === "s" ? CAM.in.get(m.from) : CAM.out.get(m.from);
  if (!tgt || !m.c) return;
  if (m.role === "s" && (tgt as Entrada).sid !== m.sid) return;
  if (m.role !== "s" && m.sid !== CAM.sid) return;
  if (!tgt.pc.remoteDescription) tgt.queue.push(m.c);
  else tgt.pc.addIceCandidate(m.c).catch(() => {});
}

export function camOnBye(m: MsgRtc) {
  if (m.role === "s") {
    const w = CAM.in.get(m.from);
    if (w && w.sid === m.sid) {
      camCloseIn(m.from, true);
      avisar();
    }
  } else if (m.sid === CAM.sid) camCloseOut(m.from);
}

/**
 * Presença (ou a minha voz) mudou: liga as câmeras de quem está na voz comigo, desliga as que acabaram
 * ou de quem saiu da voz. Fora da voz, não vejo nem mando câmera.
 */
export function syncCams() {
  const online = getApp().onlineSala;
  const euNaVoz = naVoz();
  for (const [key, w] of [...CAM.in]) {
    const p = online.find((x) => x.key === key);
    if (!euNaVoz || !p || !p.cam || !p.voz || p.cam !== w.sid) camCloseIn(key, true);
  }
  if (euNaVoz)
    for (const p of online) {
      if (p.key === MY_KEY || !p.cam || !p.voz || CAM.in.has(p.key)) continue;
      camOpenIn(p);
    }
  for (const [key, o] of [...CAM.out]) {
    const p = online.find((x) => x.key === key);
    if (!euNaVoz || (p && !p.voz) || (!p && Date.now() - o.at > 15000)) camCloseOut(key);
  }
  avisar();
}

/* ---------- o que a tela mostra ---------- */
export function camStreamOf(key: string): MediaStream | null {
  if (key === MY_KEY) return CAM.stream;
  const w = CAM.in.get(key);
  return w && w.state === "live" ? w.stream : null;
}

export type CamAtiva = { key: string; name: string; st: MediaStream };

/** Câmeras ligadas agora (a minha também), em ordem de nome. */
export function activeCams(): CamAtiva[] {
  const { onlineSala: online, friends, myName } = getApp();
  const list: CamAtiva[] = [];
  if (CAM.stream) list.push({ key: MY_KEY, name: myName, st: CAM.stream });
  for (const [key, w] of CAM.in)
    if (w.state === "live" && w.stream) {
      const p = online.find((x) => x.key === key);
      const f = p && friendDaPresenca(p, friends);
      list.push({ key, name: f ? f.name : w.name, st: w.stream });
    }
  return list.sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
}

/** Janela flutuante das câmeras: todas (`only` null) ou só a de uma pessoa. */
export async function openCamPip(only: string | null) {
  if (!canPip()) {
    const v = only ? CAM.videos.get(only) : null;
    if (v && document.pictureInPictureEnabled) {
      try {
        await v.requestPictureInPicture();
        return;
      } catch (e) {
        console.warn(e);
      }
    }
    return toast("Seu navegador não abre a janela flutuante das câmeras. Use o Chrome ou o Edge no computador.");
  }
  CAM.only = only;
  if (CAM.win && !CAM.win.closed) {
    avisar();
    return;
  }
  try {
    const n = only ? 1 : Math.max(1, activeCams().length),
      cols = Math.min(n, 3),
      rows = Math.ceil(n / cols);
    const w = await abrirJanelaPip({
      width: only ? 320 : Math.min(640, cols * 170 + 16),
      height: only ? 320 : Math.min(640, rows * 170 + 16),
    });
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach((x) => w.document.head.appendChild(x.cloneNode(true)));
    /* as fontes (next/font) vêm por classe no <html> */
    w.document.documentElement.className = document.documentElement.className;
    w.document.title = "Câmeras";
    w.document.body.className = "cams";
    CAM.win = w;
    w.addEventListener("pagehide", () => {
      CAM.win = null;
      CAM.only = null;
      avisar();
    });
    avisar();
  } catch (e) {
    console.error(e);
    toast("Não deu para abrir a janela flutuante das câmeras.");
  }
}
