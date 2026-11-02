"use client";
/*
 * Roleta europeia animada (aba Cassino). O desenho é SVG: aro de madeira, pista com 8 losangos (parados),
 * a roda com as 37 casas, divisórias prateadas e o cone com a cruzeta (girando) e a bolinha.
 * O número vem do banco (apostar_roleta); o plano do giro (roda.ts) faz a bolinha parar no centro dessa casa.
 * A animação mexe direto nos atributos do SVG em requestAnimationFrame (o React não redesenha a cada quadro).
 * Sons gerados na hora (Web Audio, sem arquivo): bolinha rolando, "tec" nos quiques e a parada; botão de mudo.
 * As cores são as variáveis --roleta-* de 26-cassino.css (ilustração, como o hall).
 */
import { useEffect, useId, useRef, useState } from "react";
import { IcSemSom, IcVolume } from "@/components/ui/icones";
import { local } from "@/lib/util";
import { corDa, type Cor } from "./regras";
import { FATIA, ORDEM, R_CASA, R_PISTA, anguloDa, planoDoGiro, quadroDoGiro, type Plano } from "./roda";

/* medidas do desenho (viewBox de -200 a 200) */
const R_ARO = 198, R_MADEIRA = 184, R_PISTA_EXT = 176, R_PISTA_INT = 150;
const R_NUM_EXT = 148, R_NUM_INT = 124, R_CASA_INT = 98, R_CONE = 96;
/* a bolinha corre no meio da pista e assenta no meio das casas */
const RB_PISTA = 163, RB_CASA = (R_NUM_INT + R_CASA_INT) / 2;
const raioDaBola = (f: number) => RB_CASA + ((f - R_CASA) / (R_PISTA - R_CASA)) * (RB_PISTA - RB_CASA);

const polar = (r: number, graus: number): [number, number] => {
  const a = ((graus - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
};
/** Fatia de anel entre os raios r0 e r1, do ângulo a0 ao a1 (graus, horário a partir do topo). */
function setor(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1), [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

const NOME_COR: Record<Cor, string> = { vermelho: "VERMELHO", preto: "PRETO", verde: "VERDE" };

/** Números de 0 a 1 do navegador, só para variar o visual do giro (o resultado vem do banco). */
function aleatorio() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 2 ** 32;
}

/* ---------- sons (Web Audio, gerados na hora) ---------- */
type Som = { ctx: AudioContext; rolar: GainNode; parar: () => void };
function abrirSom(): Som | null {
  try {
    const ctx = new AudioContext();
    /* ruído filtrado = bolinha rolando; o volume acompanha a velocidade */
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const fonte = ctx.createBufferSource();
    fonte.buffer = buf;
    fonte.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 2400;
    filtro.Q.value = 0.8;
    const rolar = ctx.createGain();
    rolar.gain.value = 0;
    fonte.connect(filtro).connect(rolar).connect(ctx.destination);
    fonte.start();
    return {
      ctx,
      rolar,
      parar: () => {
        try {
          fonte.stop();
          void ctx.close();
        } catch {
          /* já parou */
        }
      },
    };
  } catch {
    return null;
  }
}
/** "Tec" curto (quique) ou mais grave (parada). */
function tec(s: Som | null, grave = false) {
  if (!s) return;
  const o = s.ctx.createOscillator(), g = s.ctx.createGain(), t = s.ctx.currentTime;
  o.type = "triangle";
  o.frequency.setValueAtTime(grave ? 420 : 1700, t);
  o.frequency.exponentialRampToValueAtTime(grave ? 180 : 900, t + 0.08);
  g.gain.setValueAtTime(grave ? 0.18 : 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (grave ? 0.25 : 0.07));
  o.connect(g).connect(s.ctx.destination);
  o.start(t);
  o.stop(t + 0.3);
}

const reduzMovimento = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** O desenho parado da roda que gira (casas, números, divisórias, cone e cruzeta). */
function Roda({ id }: { id: string }) {
  return (
    <>
      {ORDEM.map((n, i) => {
        const a0 = i * FATIA - FATIA / 2, a1 = a0 + FATIA;
        const cor = corDa(n);
        const [tx, ty] = polar((R_NUM_EXT + R_NUM_INT) / 2, i * FATIA);
        return (
          <g key={n}>
            <path d={setor(R_NUM_INT, R_NUM_EXT, a0, a1)} className={"rr-casa rr-" + cor} />
            <path d={setor(R_CASA_INT, R_NUM_INT, a0, a1)} className={"rr-bolso rr-" + cor} />
            <text x={tx} y={ty} className="rr-num" transform={`rotate(${i * FATIA} ${tx} ${ty})`} dy="4.5">
              {n}
            </text>
          </g>
        );
      })}
      {ORDEM.map((_, i) => {
        const a = i * FATIA - FATIA / 2;
        const [x0, y0] = polar(R_CASA_INT, a), [x1, y1] = polar(R_NUM_EXT, a);
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className="rr-divisa" />;
      })}
      <circle r={R_NUM_EXT} className="rr-fio" />
      <circle r={R_NUM_INT} className="rr-fio" />
      <circle r={R_CONE} fill={`url(#${id}-cone)`} className="rr-cone" />
      <circle r={R_CONE * 0.55} fill={`url(#${id}-cone2)`} />
      {[45, 135, 225, 315].map((a) => {
        const [x, y] = polar(R_CONE * 0.62, a);
        return (
          <g key={a}>
            <line x1={0} y1={0} x2={x} y2={y} className="rr-braco" />
            <circle cx={x} cy={y} r={6} fill={`url(#${id}-ouro)`} className="rr-ponta" />
          </g>
        );
      })}
      <circle r={13} fill={`url(#${id}-ouro)`} className="rr-ponta" />
      <circle r={5} cx={-3} cy={-3} className="rr-brilho" />
    </>
  );
}

export type Giro = { id: number; casa: number };

/**
 * A roleta. Quando chega um `giro` novo (id diferente), a roda gira até a `casa` dele e chama `onFim`.
 * `ultimos`: as últimas casas (as minhas apostas), mostradas como bolinhas coloridas.
 */
export function RodaRoleta({ giro, onFim, ultimos }: { giro: Giro | null; onFim?: (casa: number, cor: Cor) => void; ultimos: number[] }) {
  const id = useId().replace(/:/g, "");
  const rodaRef = useRef<SVGGElement>(null);
  const bolaRef = useRef<SVGGElement>(null);
  const brilhoRef = useRef<SVGPathElement>(null);
  const angulo = useRef(0);
  const fimRef = useRef(onFim);
  const [mudo, setMudo] = useState(() => local.get("roleta-som") === "0");
  const mudoRef = useRef(mudo);
  /* o giro em andamento lê sempre o callback e o mudo mais novos */
  useEffect(() => {
    fimRef.current = onFim;
    mudoRef.current = mudo;
  });
  const [final, setFinal] = useState<number | null>(null);
  const [rodando, setRodando] = useState(false);

  useEffect(() => {
    if (!giro) return;
    const roda = rodaRef.current, bola = bolaRef.current;
    if (!roda || !bola) return;
    setFinal(null);
    setRodando(true);
    const p: Plano = planoDoGiro(giro.casa, aleatorio, angulo.current);
    const som = mudoRef.current || reduzMovimento() ? null : abrirSom();
    const desenhar = (t: number) => {
      const q = quadroDoGiro(p, t);
      angulo.current = q.roda;
      roda.setAttribute("transform", `rotate(${q.roda})`);
      const [x, y] = polar(raioDaBola(q.raio), q.bola);
      bola.setAttribute("transform", `translate(${x} ${y})`);
      bola.style.opacity = "1";
      return q;
    };
    let quadro = 0, ini = 0, quiqueVisto = -1, acabou = false;
    const terminar = () => {
      if (acabou) return;
      acabou = true;
      desenhar(p.total);
      tec(som, true);
      setTimeout(() => som?.parar(), 400);
      const a0 = anguloDa(giro.casa) - FATIA / 2;
      brilhoRef.current?.setAttribute("d", setor(R_CASA_INT, R_NUM_EXT, a0, a0 + FATIA));
      setFinal(giro.casa);
      setRodando(false);
      fimRef.current?.(giro.casa, corDa(giro.casa));
    };
    if (reduzMovimento()) {
      terminar();
      return;
    }
    const passo = (agora: number) => {
      if (!ini) ini = agora;
      const t = agora - ini;
      if (t >= p.total) return terminar();
      const q = desenhar(t);
      if (som) {
        som.rolar.gain.setTargetAtTime(mudoRef.current ? 0 : 0.05 * q.rolando, som.ctx.currentTime, 0.05);
        const k = p.quiques.findIndex((x) => t >= x.ini && t < x.fim);
        if (k !== quiqueVisto && k >= 0) {
          quiqueVisto = k;
          if (!mudoRef.current) tec(som);
        }
        if (q.assentou && quiqueVisto !== 99) {
          quiqueVisto = 99;
          if (!mudoRef.current) tec(som);
        }
      }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      /* saiu no meio (trocou de aba): termina na hora, com o resultado certo */
      if (!acabou) terminar();
    };
  }, [giro]);

  const trocarSom = () => {
    const novo = !mudo;
    setMudo(novo);
    local.set("roleta-som", novo ? "0" : "1");
  };
  const cor = final !== null ? corDa(final) : null;

  return (
    <div className="rr">
      <div className="rr-roda-caixa">
        <svg className="rr-svg" viewBox="-200 -200 400 400" role="img" aria-label={final !== null ? `Roleta: deu ${final} ${cor}` : rodando ? "Roleta girando" : "Roleta parada"}>
          <defs>
            <radialGradient id={`${id}-aro`} cx="50%" cy="40%" r="60%">
              <stop offset="0" className="rr-st-aro0" />
              <stop offset="1" className="rr-st-aro1" />
            </radialGradient>
            <radialGradient id={`${id}-pista`} cx="50%" cy="50%" r="50%">
              <stop offset=".75" className="rr-st-pista0" />
              <stop offset="1" className="rr-st-pista1" />
            </radialGradient>
            <radialGradient id={`${id}-cone`} cx="40%" cy="35%" r="70%">
              <stop offset="0" className="rr-st-cone0" />
              <stop offset="1" className="rr-st-cone1" />
            </radialGradient>
            <radialGradient id={`${id}-cone2`} cx="40%" cy="35%" r="70%">
              <stop offset="0" className="rr-st-cone1" />
              <stop offset="1" className="rr-st-cone0" />
            </radialGradient>
            <radialGradient id={`${id}-ouro`} cx="35%" cy="30%" r="70%">
              <stop offset="0" className="rr-st-ouro0" />
              <stop offset="1" className="rr-st-ouro1" />
            </radialGradient>
            <radialGradient id={`${id}-bola`} cx="35%" cy="30%" r="70%">
              <stop offset="0" className="rr-st-bola0" />
              <stop offset="1" className="rr-st-bola1" />
            </radialGradient>
          </defs>
          {/* parados: aro, madeira, pista e os 8 losangos */}
          <circle r={R_ARO} fill={`url(#${id}-aro)`} className="rr-aro" />
          <circle r={R_MADEIRA} className="rr-madeira" />
          <circle r={R_PISTA_EXT} fill={`url(#${id}-pista)`} />
          <circle r={R_PISTA_INT + 1} className="rr-pista-borda" />
          {Array.from({ length: 8 }, (_, k) => {
            const a = 22.5 + k * 45;
            const [x, y] = polar(R_PISTA_INT + 13, a);
            return <path key={k} d="M0 -7L3 0 0 7-3 0Z" transform={`translate(${x} ${y}) rotate(${a})`} fill={`url(#${id}-ouro)`} className="rr-losango" />;
          })}
          {/* a roda que gira */}
          {/* o ângulo é posto direto no elemento pela animação (o React não mexe nele) */}
          <g ref={rodaRef}>
            <Roda id={id} />
            <path ref={brilhoRef} className={"rr-ganhou" + (final !== null ? " on" : "")} d="" />
          </g>
          {/* a bolinha (some até o primeiro giro) */}
          <g ref={bolaRef} style={{ opacity: 0 }}>
            <circle r={7.5} cx={1.5} cy={2} className="rr-sombra" />
            <circle r={6.5} fill={`url(#${id}-bola)`} className="rr-bola" />
          </g>
        </svg>
        <button type="button" className="rr-mudo" aria-pressed={mudo} aria-label={mudo ? "Ligar o som da roleta" : "Desligar o som da roleta"} onClick={trocarSom}>
          {mudo ? <IcSemSom /> : <IcVolume />}
        </button>
      </div>
      <p className={"rr-resultado" + (cor ? " " + cor : "")} aria-live="polite">
        {final !== null && cor ? (
          <>
            <b>{final}</b> {NOME_COR[cor]}
          </>
        ) : rodando ? (
          "Girando…"
        ) : (
          "Faça a sua aposta"
        )}
      </p>
      {ultimos.length > 0 && (
        <ol className="rr-ultimos" aria-label="Últimos números">
          {ultimos.slice(0, 10).map((n, k) => (
            <li key={k} className={"rr-" + corDa(n)}>
              {n}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
