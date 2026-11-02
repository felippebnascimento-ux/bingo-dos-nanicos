/*
 * Desenhar na live.
 * Quem assiste liga o lápis e risca em cima do vídeo. Os pontos vão pela sala, medidos em relação à
 * imagem do vídeo (0 a 1), então o risco cai no mesmo lugar para todo mundo, qualquer que seja o
 * tamanho da tela. Cada risco some ~3 s depois do último ponto.
 */
import type { PointerEvent as ReactPointerEvent } from "react";
import { enviar, naMinhaSala, limitePorPessoa, salaConectada } from "@/lib/sala";
import { friendDaPresenca, getApp, MY_KEY } from "@/lib/store";
import { local, newId } from "@/lib/util";
import { getLive, setLive } from "./estado";
import { LIVE } from "./tela";

/* a ordem é o número que vai pela sala e fica salvo: cor nova entra sempre no fim */
export const DCORES = ["#ff3b30", "#ffd60a", "#34c759", "#0a84ff", "#ffffff", "#ff2d95", "#000000"],
  DNOMES = ["vermelho", "amarelo", "verde", "azul", "branco", "rosa", "preto"];
export const DESP = [3, 6, 12],
  DESP_NOMES = ["fina", "média", "grossa"]; /* espessura por 1000 px de vídeo */

type Ponto = [number, number];
type Risco = { alvo: string; c: number; w: number; pts: Ponto[]; nome: string; ult: number; meu?: boolean };
type Traco = { id: string; alvo: string; c: number; w: number };

const D = {
  traco: null as Traco | null,
  lote: [] as Ponto[],
  t: 0,
  riscos: new Map<string, Risco>(),
  raf: 0,
  canvas: null as HTMLCanvasElement | null,
  palco: null as HTMLElement | null,
};
const limDeles = limitePorPessoa(60, 2000); /* anti-flood */

/** O palco (#stage) e o canvas avisam que existem (ref callbacks). */
export const registrarCanvas = (el: HTMLCanvasElement | null) => {
  D.canvas = el;
};
export const registrarPalco = (el: HTMLElement | null) => {
  D.palco = el;
};

const salva = () => {
  const s = getLive();
  local.setJson("desenho", { cor: s.desenhoCor, esp: s.desenhoEsp, ver: s.desenhoVer });
};
export function setCor(c: number) {
  setLive({ desenhoCor: c });
  salva();
}
export function setEsp(e: number) {
  setLive({ desenhoEsp: e });
  salva();
}
export function alternarLapis() {
  const s = getLive();
  const on = !s.desenhoOn;
  if (on && !s.desenhoVer) {
    setLive({ desenhoOn: on, desenhoVer: true });
    salva();
  } else setLive({ desenhoOn: on });
}
export function setDesenhoVer(ver: boolean) {
  setLive(ver ? { desenhoVer: true } : { desenhoVer: false, desenhoOn: false });
  salva();
  if (!ver) for (const [k, r] of D.riscos) if (!r.meu) D.riscos.delete(k);
  pintar();
}

/* onde a imagem do vídeo está dentro do palco (o vídeo fica centralizado, com faixas pretas) */
function areaVideo() {
  const st = D.palco?.getBoundingClientRect() || { width: 0, height: 0 },
    v = LIVE.main ? LIVE.mainVideo : null;
  const vw = (v && v.videoWidth) || 16,
    vh = (v && v.videoHeight) || 9,
    k = Math.min(st.width / vw, st.height / vh);
  return { x: (st.width - vw * k) / 2, y: (st.height - vh * k) / 2, w: vw * k, h: vh * k, sw: st.width, sh: st.height };
}

function pontoDe(e: ReactPointerEvent<HTMLCanvasElement>): Ponto {
  const r = e.currentTarget.getBoundingClientRect(),
    a = areaVideo();
  return [
    Math.round(((e.clientX - r.left - a.x) / a.w) * 1000) / 1000,
    Math.round(((e.clientY - r.top - a.y) / a.h) * 1000) / 1000,
  ];
}

function enviaLote(fim: boolean) {
  const t = D.traco;
  if (!t || !salaConectada() || (!D.lote.length && !fim)) return;
  const pts = D.lote.splice(0, 60);
  enviar("risco", { alvo: t.alvo, id: t.id, c: t.c, w: t.w, pts, fim: !!fim });
}

export function pointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
  const s = getLive();
  if (!s.desenhoOn || !LIVE.main) return;
  e.preventDefault();
  e.currentTarget.setPointerCapture(e.pointerId);
  const id = newId().replace(/-/g, "").slice(0, 16),
    p = pontoDe(e);
  D.traco = { id, alvo: LIVE.main, c: s.desenhoCor, w: s.desenhoEsp };
  D.lote = [p];
  D.riscos.set(MY_KEY + ":" + id, {
    alvo: LIVE.main,
    c: s.desenhoCor,
    w: s.desenhoEsp,
    pts: [p],
    nome: getApp().myName,
    ult: Date.now(),
    meu: true,
  });
  pintar();
}

export function pointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
  const t = D.traco;
  if (!t) return;
  const r = D.riscos.get(MY_KEY + ":" + t.id);
  if (!r) return;
  const p = pontoDe(e),
    q = r.pts[r.pts.length - 1];
  if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 0.003) return;
  if (r.pts.length >= 1500) return;
  r.pts.push(p);
  r.ult = Date.now();
  D.lote.push(p);
  if (Date.now() - D.t > 60) {
    D.t = Date.now();
    enviaLote(false);
  }
  pintar();
}

export function fimTraco() {
  if (!D.traco) return;
  enviaLote(true);
  D.traco = null;
  D.lote = [];
}

/** Risco que chegou da sala (não confiável: confere tudo). */
export function onRisco(m: Record<string, unknown>) {
  if (!getLive().desenhoVer || typeof m.from !== "string" || m.from === MY_KEY || typeof m.alvo !== "string") return;
  if (typeof m.id !== "string" || !/^[a-z0-9]{4,40}$/i.test(m.id)) return;
  const c = Number(m.c),
    w = Number(m.w);
  if (!Number.isInteger(c) || c < 0 || c >= DCORES.length || !Number.isInteger(w) || w < 0 || w >= DESP.length) return;
  if (!Array.isArray(m.pts) || m.pts.length > 60) return;
  const pts = (m.pts as unknown[]).filter(
    (p): p is Ponto =>
      Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && n >= -0.1 && n <= 1.1),
  );
  if (!naMinhaSala(m.from)) return;
  if (!limDeles(m.from)) return;
  if (m.alvo !== LIVE.main) return;
  const agora = Date.now(),
    k = m.from + ":" + m.id;
  let r = D.riscos.get(k);
  if (!r) {
    if (D.riscos.size > 80) return;
    const p = getApp().onlineSala.find((x) => x.key === m.from)!;
    const f = friendDaPresenca(p);
    r = { alvo: m.alvo, c, w, pts: [], nome: f ? f.name : p.name, ult: agora };
    D.riscos.set(k, r);
  }
  if (r.pts.length + pts.length <= 1500) r.pts.push(...pts);
  r.ult = agora;
  pintar();
}

/* desenha tudo e vai apagando: cada risco dura ~3 s depois do último ponto (some nos últimos 0,6 s) */
export function pintar() {
  if (D.raf || typeof requestAnimationFrame === "undefined") return;
  D.raf = requestAnimationFrame(() => {
    D.raf = 0;
    const cv = D.canvas;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1),
      a = areaVideo();
    const W = Math.round(a.sw * dpr),
      H = Math.round(a.sh * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const g = cv.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, W, H);
    const agora = Date.now(),
      ver = getLive().desenhoVer;
    const fonte = getComputedStyle(document.documentElement).getPropertyValue("--body").trim() || "Onest, sans-serif";
    let vivos = 0;
    for (const [k, r] of D.riscos) {
      const idade = agora - r.ult;
      if (idade > 3000 || r.alvo !== LIVE.main || (!ver && !r.meu)) {
        D.riscos.delete(k);
        continue;
      }
      if (!r.pts.length) continue;
      vivos++;
      g.globalAlpha = idade < 2400 ? 1 : 1 - (idade - 2400) / 600;
      const X = (p: Ponto) => (a.x + p[0] * a.w) * dpr,
        Y = (p: Ponto) => (a.y + p[1] * a.h) * dpr;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.lineWidth = Math.max(1.5, (DESP[r.w] * a.w) / 1000) * dpr;
      g.strokeStyle = DCORES[r.c];
      g.shadowColor = DCORES[r.c] === "#000000" ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.55)";
      g.shadowBlur = 3 * dpr;
      g.beginPath();
      g.moveTo(X(r.pts[0]), Y(r.pts[0]));
      if (r.pts.length === 1) g.lineTo(X(r.pts[0]) + 0.1, Y(r.pts[0]));
      for (let i = 1; i < r.pts.length; i++) g.lineTo(X(r.pts[i]), Y(r.pts[i]));
      g.stroke();
      if (!r.meu) {
        g.shadowBlur = 0;
        g.font = `700 ${11 * dpr}px ${fonte}`;
        const tx = X(r.pts[0]) + 8 * dpr,
          ty = Y(r.pts[0]) - 8 * dpr,
          tw = g.measureText(r.nome).width;
        g.fillStyle = "rgba(0,0,0,.6)";
        g.fillRect(tx - 4 * dpr, ty - 11 * dpr, tw + 8 * dpr, 15 * dpr);
        g.fillStyle = "#fff";
        g.fillText(r.nome, tx, ty);
      }
    }
    g.globalAlpha = 1;
    if (vivos || D.traco) pintar();
  });
}
