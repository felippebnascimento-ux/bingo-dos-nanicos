/*
 * Voz das salas: quem entra na voz manda o microfone para cada pessoa da sala que também está na voz
 * e ouve o microfone delas (WebRTC direto, uma conexão por par, só áudio).
 * A sinalização vai pelo canal da sala, no evento `rtc` (vo = oferta, va = resposta, vi = ice, vb = tchau),
 * e o `sid` de cada mensagem é o da voz de quem ofereceu (identifica a conexão do par).
 * Em cada par, a chave menor oferece (`euOfereco`), então os dois nunca oferecem juntos.
 */
import { create } from "zustand";
import { aplicarSaida, useMidia } from "@/features/config/midia";
import { toast } from "@/lib/toast";
import { getApp, MY_KEY, setApp } from "@/lib/store";
import { local, newId } from "@/lib/util";
import { ajustarSender, canCam, novaConexao, sendRtc, type MsgRtc } from "./rtc";
import { abrirMic, type MicFiltrado } from "./ruido";
import { somDaVoz } from "./sonsVoz";
import { euOfereco, falandoAgora, LIMIAR_FALA, mesmaLista, volumeDe } from "./vozRegras";

type Par = {
  key: string;
  /** sid da conexão (a voz de quem ofereceu) */
  sid: string;
  pc: RTCPeerConnection;
  queue: RTCIceCandidateInit[];
  audio: HTMLAudioElement;
  ofereci: boolean;
  tries: number;
  to?: ReturnType<typeof setTimeout>;
};

/** Quem está falando agora (chaves da presença; a minha é MY_KEY). A tela só lê daqui. */
export const useVoz = create<{ falando: string[] }>()(() => ({ falando: [] }));

const VOZ = {
  sid: null as string | null,
  /** o áudio que vai para a sala (já sem ruído, se a supressão estiver ligada) */
  stream: null as MediaStream | null,
  /** o microfone aberto, com o filtro (`parar()` desliga os dois) */
  mic: null as MicFiltrado | null,
  pares: new Map<string, Par>(),
  /** se estava mudo antes de ficar surdo (ao voltar a ouvir, o microfone volta como estava) */
  mudoAntes: false,
  /** quem (friend id) estava na voz da minha sala no último sync, para o som de entrou/saiu; null = acabei de entrar */
  naCall: null as Set<string> | null,
};

export const naVoz = () => !!VOZ.sid;

/* ---------- volume de cada um (só no meu aparelho, como no Discord) ---------- */
type Ajustes = {
  /** volume de toda a voz, de 0 a 1 */
  geral: number;
  /** volume de cada nanico (friend id), de 0 a 1 */
  por: Record<string, number>;
  /** nanicos que eu silenciei (só eu deixo de ouvir) */
  silenciados: string[];
};
const ajSalvo = local.json<Partial<Ajustes>>("voz-ajustes") || {};
const vol01 = (v: unknown, padrao = 1) => (typeof v === "number" && v >= 0 && v <= 1 ? v : padrao);
export const useAjustesVoz = create<Ajustes>()(() => ({
  geral: vol01(ajSalvo.geral),
  por: Object.fromEntries(Object.entries(ajSalvo.por && typeof ajSalvo.por === "object" ? ajSalvo.por : {}).map(([k, v]) => [k, vol01(v)])),
  silenciados: Array.isArray(ajSalvo.silenciados) ? ajSalvo.silenciados.filter((x): x is string => typeof x === "string") : [],
}));
export function ajustarVoz(p: Partial<Ajustes>) {
  useAjustesVoz.setState(p);
  local.setJson("voz-ajustes", useAjustesVoz.getState());
}
export const volumeDoNanico = (fid: string | null | undefined) => (fid ? (useAjustesVoz.getState().por[fid] ?? 1) : 1);
export function silenciarNanico(fid: string, sim: boolean) {
  const l = useAjustesVoz.getState().silenciados.filter((x) => x !== fid);
  ajustarVoz({ silenciados: sim ? [...l, fid] : l });
}

/** O volume e o "silenciado" de um par, pelo nanico dele (a chave é da aba; o ajuste vale para o nanico). */
function aplicarVolume(par: Par) {
  const fid = getApp().onlineSala.find((x) => x.key === par.key)?.fid ?? null;
  const a = useAjustesVoz.getState();
  par.audio.volume = Math.min(1, Math.max(0, a.geral * volumeDoNanico(fid)));
  par.audio.muted = getApp().vozSurdo || (!!fid && a.silenciados.includes(fid));
}
useAjustesVoz.subscribe(() => {
  for (const par of VOZ.pares.values()) aplicarVolume(par);
});

/** Volume do meu microfone agora, de 0 a 1 (para a barrinha de teste). */
export function nivelDoMeuMic(): number {
  const m = medidores.get(MY_KEY);
  if (!m) return 0;
  m.an.getFloatTimeDomainData(m.buf);
  return Math.min(1, volumeDe(m.buf) * 6);
}

/** Como está a conexão da voz: ping médio, pacotes perdidos e com quantos estou ligado. */
export async function sinalDaVoz(): Promise<{ ping: number | null; perda: number | null; n: number }> {
  let soma = 0,
    medidas = 0,
    perdidos = 0,
    recebidos = 0,
    n = 0;
  for (const par of VOZ.pares.values()) {
    if (par.pc.connectionState !== "connected") continue;
    n++;
    try {
      const st = await par.pc.getStats();
      st.forEach((r) => {
        if (r.type === "candidate-pair" && r.nominated && typeof r.currentRoundTripTime === "number") {
          soma += r.currentRoundTripTime * 1000;
          medidas++;
        }
        if (r.type === "inbound-rtp" && r.kind === "audio") {
          perdidos += r.packetsLost ?? 0;
          recebidos += r.packetsReceived ?? 0;
        }
      });
    } catch {
      /* sem estatística */
    }
  }
  return {
    ping: medidas ? Math.round(soma / medidas) : null,
    perda: recebidos + perdidos > 0 ? (perdidos / (recebidos + perdidos)) * 100 : null,
    n,
  };
}

/* ---------- entrar e sair ---------- */
export async function entrarVoz() {
  if (VOZ.sid) return;
  if (!getApp().minhaSala) return toast("Entre numa sala para falar.");
  if (!canCam) return toast("Seu navegador não liberou o microfone.");
  try {
    const mic = await abrirMic();
    /* trocou de sala (ou saiu) enquanto o navegador pedia o microfone */
    if (!getApp().minhaSala || VOZ.sid) {
      mic.parar();
      return;
    }
    mic.fonte?.addEventListener("ended", () => sairVoz());
    ligarPrefs();
    const st = mic.stream;
    VOZ.mic = mic;
    VOZ.stream = st;
    VOZ.sid = newId();
    VOZ.mudoAntes = false;
    setApp({ myVozSid: VOZ.sid, vozMudo: false, vozSurdo: false });
    medir(MY_KEY, st);
    ligarMedidor();
    syncVoz();
  } catch (e) {
    console.warn(e);
    const nome = e instanceof Error ? e.name : "";
    toast(
      nome === "NotAllowedError"
        ? "O microfone foi bloqueado. Libere no cadeado ao lado do endereço do site."
        : nome === "NotFoundError"
          ? "Nenhum microfone encontrado."
          : nome === "NotReadableError"
            ? "O microfone está sendo usado por outro programa."
            : "Não deu para ligar o microfone.",
    );
  }
}

export function sairVoz() {
  if (!VOZ.sid) return;
  for (const key of [...VOZ.pares.keys()]) fechar(key, false);
  VOZ.mic?.parar();
  VOZ.mic = null;
  VOZ.stream = null;
  VOZ.sid = null;
  VOZ.naCall = null;
  somDaVoz("saiu", useAjustesVoz.getState().geral);
  esquecerMedidas();
  setApp({ myVozSid: null, vozMudo: false, vozSurdo: false });
}

/* ---------- configurações (aba Configurações) ---------- */
let prefsLigadas = false;
/** Mudou o microfone, o eco ou o ruído: troca o áudio na hora; mudou a saída: muda onde a voz toca. */
function ligarPrefs() {
  if (prefsLigadas) return;
  prefsLigadas = true;
  useMidia.subscribe((s, p) => {
    if (s.mic !== p.mic || s.eco !== p.eco || s.ruido !== p.ruido) trocarMicrofone();
    if (s.saida !== p.saida) for (const par of VOZ.pares.values()) aplicarSaida(par.audio);
  });
}

/** Troca o microfone sem sair da voz: pega o novo e substitui o áudio em todas as conexões. */
async function trocarMicrofone() {
  if (!VOZ.sid || !VOZ.stream) return;
  try {
    const mic = await abrirMic();
    const faixa = mic.stream.getAudioTracks()[0];
    if (!VOZ.sid || !faixa) {
      mic.parar();
      return;
    }
    faixa.enabled = !getApp().vozMudo;
    mic.fonte?.addEventListener("ended", () => sairVoz());
    for (const par of VOZ.pares.values())
      for (const sd of par.pc.getSenders()) if (sd.track?.kind === "audio") await sd.replaceTrack(faixa).catch(() => {});
    VOZ.mic?.parar();
    VOZ.mic = mic;
    VOZ.stream = mic.stream;
    medir(MY_KEY, mic.stream);
  } catch (e) {
    console.warn(e);
    toast("Não deu para trocar o microfone. Confira se ele está ligado.");
  }
}

/** Liga e desliga o meu microfone (a conexão continua; vai silêncio). Desmutar também volta a ouvir. */
export function alternarMudo() {
  if (!VOZ.sid) return;
  const s = getApp();
  const mudo = !s.vozMudo;
  if (!mudo && s.vozSurdo) return alternarSurdo();
  VOZ.stream?.getAudioTracks().forEach((t) => (t.enabled = !mudo));
  setApp({ vozMudo: mudo });
  if (!mudo) acordarMic();
}

/**
 * Voltou a falar: no celular o sistema pausa o áudio (tela apagada, ligação, outro app tocando) e o microfone
 * desmutado continuava mandando silêncio. Acorda o filtro e o medidor (o toque no botão deixa) e, se o próprio
 * aparelho cortou o microfone, abre ele de novo sem sair da voz.
 */
function acordarMic() {
  VOZ.mic?.retomar();
  if (ctx && ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});
  const fonte = VOZ.mic?.fonte;
  if (fonte && (fonte.readyState === "ended" || fonte.muted)) void trocarMicrofone();
}
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && VOZ.sid && !getApp().vozMudo) acordarMic();
  });

/** "Surdo": para de ouvir todo mundo e desliga o microfone junto (como no Discord). */
export function alternarSurdo() {
  if (!VOZ.sid) return;
  const s = getApp();
  const surdo = !s.vozSurdo;
  const mudo = surdo ? true : VOZ.mudoAntes;
  if (surdo) VOZ.mudoAntes = s.vozMudo;
  VOZ.stream?.getAudioTracks().forEach((t) => (t.enabled = !mudo));
  setApp({ vozSurdo: surdo, vozMudo: mudo });
  for (const p of VOZ.pares.values()) aplicarVolume(p);
  if (!mudo) acordarMic();
}

/* ---------- conexões ---------- */
function novoPar(key: string, sid: string, ofereci: boolean, tries = 0): Par {
  const pc = novaConexao();
  const audio = new Audio();
  audio.autoplay = true;
  audio.muted = getApp().vozSurdo;
  aplicarSaida(audio);
  const par: Par = { key, sid, pc, queue: [], audio, ofereci, tries };
  aplicarVolume(par);
  pc.ontrack = (e) => {
    const st = (e.streams && e.streams[0]) || new MediaStream([e.track]);
    audio.srcObject = st;
    tocar(audio);
    medir(key, st);
    clearTimeout(par.to);
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) sendRtc({ t: "vi", to: key, sid, c: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") falhou(par);
  };
  /* sem conexão em 20 s: quem ofereceu tenta de novo */
  par.to = setTimeout(() => {
    if (pc.connectionState !== "connected") falhou(par);
  }, 20000);
  VOZ.pares.set(key, par);
  return par;
}

function meuAudio(pc: RTCPeerConnection) {
  const st = VOZ.stream;
  if (!st) return;
  for (const t of st.getAudioTracks()) {
    const sd = pc.addTrack(t, st);
    ajustarSender(sd, { maxBitrate: 64000 });
  }
}

async function oferecer(key: string, tries = 0) {
  if (!VOZ.sid) return;
  const par = novoPar(key, VOZ.sid, true, tries);
  meuAudio(par.pc);
  try {
    const off = await par.pc.createOffer();
    await par.pc.setLocalDescription(off);
    sendRtc({ t: "vo", to: key, sid: par.sid, sdp: par.pc.localDescription?.sdp || "" });
  } catch (e) {
    console.error(e);
    falhou(par);
  }
}

function falhou(par: Par) {
  if (VOZ.pares.get(par.key) !== par) return;
  fechar(par.key, true);
  /* só quem oferece tenta de novo (o outro espera a nova oferta) */
  if (par.ofereci && par.tries < 3)
    setTimeout(() => {
      const p = getApp().onlineSala.find((x) => x.key === par.key);
      if (!VOZ.sid || VOZ.pares.has(par.key) || !p?.voz) return;
      oferecer(par.key, par.tries + 1);
    }, 5000);
}

function fechar(key: string, silencioso: boolean) {
  const par = VOZ.pares.get(key);
  if (!par) return;
  clearTimeout(par.to);
  if (!silencioso) sendRtc({ t: "vb", to: key, sid: par.sid });
  try {
    par.pc.close();
  } catch {}
  par.audio.srcObject = null;
  esquecer(key);
  VOZ.pares.delete(key);
}

/* ---------- mensagens da sala (já conferidas em live.ts: formato, limite e remetente na sala) ---------- */
export async function vozOnOffer(m: MsgRtc) {
  if (!VOZ.sid || !m.sdp || euOfereco(MY_KEY, m.from)) {
    if (!VOZ.sid) sendRtc({ t: "vb", to: m.from, sid: m.sid });
    return;
  }
  fechar(m.from, true);
  const par = novoPar(m.from, m.sid, false);
  try {
    await par.pc.setRemoteDescription({ type: "offer", sdp: m.sdp });
    /* o áudio entra depois da oferta para reaproveitar o mesmo canal (vira ida e volta) */
    meuAudio(par.pc);
    for (const c of par.queue.splice(0)) await par.pc.addIceCandidate(c).catch(() => {});
    const ans = await par.pc.createAnswer();
    await par.pc.setLocalDescription(ans);
    sendRtc({ t: "va", to: m.from, sid: m.sid, sdp: par.pc.localDescription?.sdp || "" });
  } catch (e) {
    console.error(e);
    falhou(par);
  }
}

export async function vozOnAnswer(m: MsgRtc) {
  const par = VOZ.pares.get(m.from);
  if (!par || !par.ofereci || par.sid !== m.sid || !m.sdp || par.pc.signalingState !== "have-local-offer") return;
  try {
    await par.pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
    for (const c of par.queue.splice(0)) await par.pc.addIceCandidate(c).catch(() => {});
  } catch (e) {
    console.error(e);
    falhou(par);
  }
}

export function vozOnIce(m: MsgRtc) {
  const par = VOZ.pares.get(m.from);
  if (!par || par.sid !== m.sid || !m.c) return;
  if (!par.pc.remoteDescription) par.queue.push(m.c);
  else par.pc.addIceCandidate(m.c).catch(() => {});
}

export function vozOnBye(m: MsgRtc) {
  const par = VOZ.pares.get(m.from);
  if (par && par.sid === m.sid) fechar(m.from, true);
}

/** Presença mudou: conecta com quem entrou na voz, desconecta quem saiu. */
export function syncVoz() {
  const { onlineSala, myFid } = getApp();
  if (!VOZ.sid) {
    for (const key of [...VOZ.pares.keys()]) fechar(key, true);
    return;
  }
  for (const [key, par] of [...VOZ.pares]) {
    const p = onlineSala.find((x) => x.key === key);
    /* saiu da sala ou da voz; ou entrou de novo na voz (sid novo) numa conexão que ele ofereceu */
    if (!p || !p.voz || (!par.ofereci && p.voz !== par.sid)) fechar(key, true);
  }
  for (const p of onlineSala) {
    /* outra aba minha (mesmo nanico) não entra: seria ouvir a própria voz */
    if (p.key === MY_KEY || !p.voz || (myFid && p.fid === myFid) || VOZ.pares.has(p.key)) continue;
    if (euOfereco(MY_KEY, p.key)) oferecer(p.key);
  }
  avisarEntradas(onlineSala, myFid);
}

/** Som de quem entrou ou saiu da voz da minha sala (um por nanico, mesmo com várias abas). Ao entrar, o meu som. */
function avisarEntradas(onlineSala: ReturnType<typeof getApp>["onlineSala"], myFid: string | null) {
  const agora = new Set(onlineSala.filter((p) => p.voz && p.fid && p.fid !== myFid).map((p) => p.fid as string));
  const antes = VOZ.naCall;
  VOZ.naCall = agora;
  const vol = useAjustesVoz.getState().geral;
  if (!antes) return somDaVoz("entrou", vol);
  if ([...agora].some((f) => !antes.has(f))) somDaVoz("entrou", vol);
  else if ([...antes].some((f) => !agora.has(f))) somDaVoz("saiu", vol);
}

/* ---------- tocar (o navegador só toca som depois de um toque na página) ---------- */
let esperandoToque = false;
function tocar(a: HTMLAudioElement) {
  a.play().catch(() => {
    if (esperandoToque) return;
    esperandoToque = true;
    toast("Toque em qualquer lugar da página para ouvir a voz.");
    addEventListener(
      "pointerdown",
      () => {
        esperandoToque = false;
        for (const p of VOZ.pares.values()) p.audio.play().catch(() => {});
      },
      { once: true },
    );
  });
}

/* ---------- quem está falando (o anel no rosto) ---------- */
let ctx: AudioContext | null = null;
const medidores = new Map<string, { fonte: MediaStreamAudioSourceNode; an: AnalyserNode; buf: Float32Array<ArrayBuffer> }>();
const ultimaFala = new Map<string, number>();
let relogio: ReturnType<typeof setInterval> | undefined;

/**
 * O medidor só analisa, não toca nada: `sinkId: none` cria o AudioContext sem abrir a saída de som.
 * Abrir mais uma saída reconfigura o áudio do computador e dá um soluço na música de quem entra na voz.
 * Navegador que não conhece a opção cria do jeito comum.
 */
function novoContexto() {
  try {
    return new AudioContext({ sinkId: { type: "none" } } as AudioContextOptions);
  } catch {
    return new AudioContext();
  }
}

function medir(key: string, st: MediaStream) {
  try {
    ctx ??= novoContexto();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    esquecer(key);
    const fonte = ctx.createMediaStreamSource(st);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    fonte.connect(an);
    medidores.set(key, { fonte, an, buf: new Float32Array(an.fftSize) });
  } catch (e) {
    console.warn("sem medidor de voz", e);
  }
}

function esquecer(key: string) {
  const m = medidores.get(key);
  if (m) {
    try {
      m.fonte.disconnect();
    } catch {}
    medidores.delete(key);
  }
  ultimaFala.delete(key);
}

function esquecerMedidas() {
  for (const key of [...medidores.keys()]) esquecer(key);
  clearInterval(relogio);
  relogio = undefined;
  useVoz.setState({ falando: [] });
}

function ligarMedidor() {
  if (relogio) return;
  relogio = setInterval(() => {
    const agora = Date.now();
    const mudo = getApp().vozMudo;
    for (const [key, m] of medidores) {
      if (key === MY_KEY && mudo) continue;
      m.an.getFloatTimeDomainData(m.buf);
      if (volumeDe(m.buf) > LIMIAR_FALA) ultimaFala.set(key, agora);
    }
    const falando = falandoAgora(ultimaFala, agora);
    if (!mesmaLista(falando, useVoz.getState().falando)) useVoz.setState({ falando });
  }, 120);
}
