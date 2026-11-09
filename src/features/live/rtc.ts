/*
 * Peças do WebRTC usadas pela tela, pela câmera e pela voz.
 * A imagem vai direto de quem transmite para quem assiste (WebRTC).
 * O Supabase só serve para os dois se acharem (mensagens `rtc` na sala).
 * Rede muito fechada (alguns 4G, empresa, faculdade): o WebRTC direto não conecta e precisa de um servidor TURN, que
 * repassa a imagem e a voz. Ele fica pronto para ligar pela Vercel, sem nada no código: NEXT_PUBLIC_TURN_URL
 * (uma ou mais, separadas por vírgula, ex.: "turns:turn.exemplo.com:443"), NEXT_PUBLIC_TURN_USER e
 * NEXT_PUBLIC_TURN_PASS. A senha do TURN vai para o navegador de quem usa (é assim no WebRTC): use uma conta de TURN
 * só para o site, nunca outra senha. Sem as três, fica só o STUN (como sempre foi).
 */
import { enviar } from "@/lib/sala";

const TURN_URLS = (process.env.NEXT_PUBLIC_TURN_URL ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter((u) => /^turns?:[^\s]+$/.test(u));
const TURN_SERVERS: RTCIceServer[] =
  TURN_URLS.length && process.env.NEXT_PUBLIC_TURN_USER && process.env.NEXT_PUBLIC_TURN_PASS
    ? [{ urls: TURN_URLS, username: process.env.NEXT_PUBLIC_TURN_USER, credential: process.env.NEXT_PUBLIC_TURN_PASS }]
    : [];
export const ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...TURN_SERVERS,
];

/** Mensagem de sinalização (tela: watch/offer/answer/ice/bye; câmera: cw/co/ca/ci/cb; voz: vo/va/vi/vb). */
export type MsgRtc = {
  t: string;
  from: string;
  to: string;
  sid: string;
  role?: "s" | "v";
  sdp?: string;
  c?: RTCIceCandidateInit;
};

export function sendRtc(m: Omit<MsgRtc, "from">) {
  enviar("rtc", m as unknown as Record<string, unknown>);
}

export const novaConexao = () => new RTCPeerConnection({ iceServers: ICE });

/* Full HD: prefere H.264 (codificação por hardware, pesa menos no PC que joga) e começa com bitrate alto */
export function preferH264(pc: RTCPeerConnection) {
  try {
    const caps = RTCRtpSender.getCapabilities && RTCRtpSender.getCapabilities("video");
    if (!caps) return;
    /* H.264 High (profile 64…) comprime melhor que o Baseline: mesma internet, imagem mais nítida */
    const nota = (c: RTCRtpCodec) =>
      /profile-level-id=64/i.test(c.sdpFmtpLine || "") ? 0 : /profile-level-id=4d/i.test(c.sdpFmtpLine || "") ? 1 : 2;
    const h = caps.codecs.filter((c) => /h264/i.test(c.mimeType)).sort((a, b) => nota(a) - nota(b)),
      rest = caps.codecs.filter((c) => !/h264/i.test(c.mimeType));
    if (!h.length) return;
    pc.getTransceivers().forEach((t) => {
      if (t.sender && t.sender.track && t.sender.track.kind === "video" && t.setCodecPreferences)
        t.setCodecPreferences([...h, ...rest]);
    });
  } catch (e) {
    console.warn(e);
  }
}

/* Começa alto (a imagem já chega nítida) mas sem piso: antes o mínimo de 3 Mbps impedia o navegador de baixar
   quando a internet de quem transmite não aguentava (vários assistindo), e a imagem travava e quebrava em blocos. */
export function hiBitrate(sdp: string) {
  const vids = new Set<string>();
  sdp.replace(/a=rtpmap:(\d+) (H264|VP8|VP9|AV1)\//gi, (a, pt: string) => {
    vids.add(pt);
    return a;
  });
  return sdp.replace(/a=fmtp:(\d+) ([^\r\n]*)/g, (all, pt: string, par: string) =>
    vids.has(pt) && !par.includes("x-google-")
      ? `a=fmtp:${pt} ${par};x-google-start-bitrate=4000;x-google-min-bitrate=300;x-google-max-bitrate=14000`
      : all,
  );
}

export function stereo(sdp: string) {
  const m = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (!m) return sdp;
  return sdp.replace(new RegExp(`a=fmtp:${m[1]} ([^\\r\\n]*)`), (all, par: string) =>
    par.includes("stereo=1") ? all : `a=fmtp:${m[1]} ${par};stereo=1;sprop-stereo=1;maxaveragebitrate=192000`,
  );
}

/** Ajusta o primeiro encoding de cada sender (os campos extras não estão nos tipos do TypeScript). */
export function ajustarSender(sd: RTCRtpSender, enc: Record<string, unknown>, extra?: Record<string, unknown>) {
  const par = sd.getParameters();
  if (!par.encodings || !par.encodings.length) return;
  Object.assign(par.encodings[0], enc);
  if (extra) Object.assign(par, extra);
  sd.setParameters(par).catch(() => {});
}

/* que navegador/sistema é: o som da transmissão depende disso */
const UA = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
export const isMac = /Macintosh|Mac OS X/.test(UA) && !/Mobile/.test(UA);
export const isChromium = /Chrome\/|Edg\//.test(UA) && !/OPR\//.test(UA);
export const chromeVer = parseInt((UA.match(/Chrome\/(\d+)/) || [])[1] || "0", 10);
export const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
export const canCam = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
