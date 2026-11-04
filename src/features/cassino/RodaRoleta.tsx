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
        return (
          <g key={i}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} className="rr-divisa-sombra" transform="translate(1 1.2)" />
            <line x1={x0} y1={y0} x2={x1} y2={y1} className="rr-divisa" />
          </g>
        );
      })}
      <circle r={R_NUM_EXT} stroke={`url(#${id}-cromo)`} className="rr-fio" />
      <circle r={R_NUM_INT} stroke={`url(#${id}-cromo)`} className="rr-fio" />
      <circle r={R_CASA_INT + 1} stroke={`url(#${id}-cromo)`} className="rr-fio fino" />
      <circle r={R_CONE} fill={`url(#${id}-cone)`} className="rr-cone" />
      {/* cone torneado: anéis finos de torno e dois frisos mais marcados */}
      {Array.from({ length: 14 }, (_, k) => (
        <circle key={k} r={R_CONE * (0.58 + k * 0.03)} className={"rr-torno" + (k % 3 ? "" : " forte")} />
      ))}
      {[0.86, 0.72].map((k) => (
        <circle key={k} r={R_CONE * k} className="rr-anel" />
      ))}
      <circle r={R_CONE * 0.55} fill={`url(#${id}-cone2)`} className="rr-cone-meio" />
      {[45, 135, 225, 315].map((a) => {
        const [x, y] = polar(R_CONE * 0.64, a);
        /* braço afinando do centro para a ponta */
        const [l0x, l0y] = polar(5, a - 90), [l1x, l1y] = polar(5, a + 90);
        const [p0x, p0y] = polar(1.6, a - 90), [p1x, p1y] = polar(1.6, a + 90);
        return (
          <g key={a}>
            <path d={`M${l0x} ${l0y}L${x + p0x} ${y + p0y}L${x + p1x} ${y + p1y}L${l1x} ${l1y}Z`} fill={`url(#${id}-ouro-cromo)`} className="rr-braco" />
            <circle cx={x} cy={y} r={6.5} fill={`url(#${id}-ouro)`} className="rr-ponta" />
            <circle cx={x - 2} cy={y - 2} r={2} className="rr-brilho" />
          </g>
        );
      })}
      <circle r={16} fill={`url(#${id}-ouro)`} className="rr-ponta" />
      <circle r={9} fill={`url(#${id}-ouro)`} className="rr-ponta" />
      <circle r={4} cx={-4} cy={-4} className="rr-brilho" />
    </>
  );
}

export type Giro = { id: number; casa: number };

/** A roda. Quando chega um `giro` novo (id diferente), ela gira até a `casa` dele e chama `onFim`. */
/** Estilos da roda (só cores e materiais, em 26-cassino.css): madeira clássica, laca preta com ouro, mogno com cromo, neon. */
export type TemaRoda = "classica" | "luxo" | "monaco" | "neon";

/**
 * `semSom`: a roda gira mas não toca nada (a mesa é ao vivo e a roleta fica montada escondida quando a pessoa está
 * em outra aba ou outro jogo; quem não está olhando não pode ouvir o giro dos outros).
 */
export function RodaRoleta({ giro, onFim, tema = "classica", semSom = false }: { giro: Giro | null; onFim?: (casa: number, cor: Cor) => void; tema?: TemaRoda; semSom?: boolean }) {
  const id = useId().replace(/:/g, "");
  const rodaRef = useRef<SVGGElement>(null);
  const bolaRef = useRef<SVGGElement>(null);
  const brilhoRef = useRef<SVGPathElement>(null);
  /* a moldura do vencedor fica acima do reflexo, num grupo que gira junto com a roda */
  const molduraRef = useRef<SVGGElement>(null);
  const molduraCasaRef = useRef<SVGPathElement>(null);
  const rastroRef = useRef<SVGGElement>(null);
  const sombraRef = useRef<SVGCircleElement>(null);
  const angulo = useRef(0);
  const fimRef = useRef(onFim);
  const [mudo, setMudo] = useState(() => local.get("roleta-som") === "0");
  const mudoRef = useRef(mudo);
  const semSomRef = useRef(semSom);
  /* o giro em andamento lê sempre o callback, o mudo e o "sem som" mais novos */
  useEffect(() => {
    fimRef.current = onFim;
    mudoRef.current = mudo;
    semSomRef.current = semSom;
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
    let bolaAntes = quadroDoGiro(p, 0).bola;
    /* calado: no mudo, fora da tela do cassino (semSom) ou com a aba do navegador escondida */
    const calado = () => mudoRef.current || semSomRef.current || document.hidden;
    const som = calado() || reduzMovimento() ? null : abrirSom();
    const desenhar = (t: number) => {
      const q = quadroDoGiro(p, t);
      angulo.current = q.roda;
      roda.setAttribute("transform", `rotate(${q.roda})`);
      molduraRef.current?.setAttribute("transform", `rotate(${q.roda})`);
      const [x, y] = polar(raioDaBola(q.raio), q.bola);
      /* no ar, a bolinha cresce (vem para perto da câmera) e a sombra fica para trás, mais apagada */
      const s = Math.min(1.2, q.salto);
      bola.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(1 + s * 0.45).toFixed(3)})`);
      bola.style.opacity = "1";
      const sombra = sombraRef.current;
      if (sombra) {
        sombra.setAttribute("transform", `translate(${(x + 1.6 + s * 7).toFixed(2)} ${(y + 2.2 + s * 9).toFixed(2)})`);
        sombra.style.opacity = String((0.9 - s * 0.45).toFixed(2));
      }
      /* rastro: cópias apagadas um pouco atrás, só enquanto ela anda rápido */
      const delta = q.bola - bolaAntes;
      bolaAntes = q.bola;
      const fantasmas = rastroRef.current?.children;
      if (fantasmas)
        for (let k = 0; k < fantasmas.length; k++) {
          const c = fantasmas[k] as SVGCircleElement;
          const rapido = Math.abs(delta) > 2.5 && !q.assentou;
          const [gx, gy] = polar(raioDaBola(q.raio), q.bola - delta * 0.45 * (k + 1));
          c.setAttribute("cx", gx.toFixed(1));
          c.setAttribute("cy", gy.toFixed(1));
          c.setAttribute("opacity", rapido ? String(c.dataset.o) : "0");
        }
      return q;
    };
    let quadro = 0, ini = 0, quiqueVisto = -1, acabou = false;
    const terminar = () => {
      if (acabou) return;
      acabou = true;
      desenhar(p.total);
      if (!calado()) tec(som, true);
      setTimeout(() => som?.parar(), 400);
      const a0 = anguloDa(giro.casa) - FATIA / 2;
      brilhoRef.current?.setAttribute("d", setor(R_CASA_INT, R_NUM_EXT, a0, a0 + FATIA));
      molduraCasaRef.current?.setAttribute("d", setor(R_CASA_INT, R_NUM_EXT, a0, a0 + FATIA));
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
        som.rolar.gain.setTargetAtTime(calado() ? 0 : 0.05 * q.rolando, som.ctx.currentTime, 0.05);
        const k = p.quiques.findIndex((x) => t >= x.ini && t < x.fim);
        if (k !== quiqueVisto && k >= 0) {
          quiqueVisto = k;
          if (!calado()) tec(som);
        }
        if (q.assentou && quiqueVisto !== 99) {
          quiqueVisto = 99;
          if (!calado()) tec(som);
        }
      }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    /* aba escondida não desenha quadros: o resultado aparece mesmo assim, no tempo do giro */
    const reserva = setTimeout(terminar, p.total + 1500);
    return () => {
      clearTimeout(reserva);
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
    <div className="rr" data-tema={tema}>
      <div className="rr-roda-caixa">
        {/* a parte parada da roda (aro, madeira com o veio, pista e losangos) num desenho à parte, por baixo: o veio da
            madeira é caro de desenhar e assim ele é pintado uma vez só, não a cada quadro do giro */}
        <svg className="rr-svg rr-svg-base" viewBox="-200 -200 400 400" aria-hidden="true">
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
            {/* fundo dos bolsos mais escuro perto do cone, como uma cavidade */}
            <radialGradient id={`${id}-fundo`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={R_NUM_EXT}>
              <stop offset={(R_CONE + 1) / R_NUM_EXT} className="rr-st-escuro" stopOpacity="0" />
              <stop offset={(R_CONE + 1.5) / R_NUM_EXT} className="rr-st-escuro" stopOpacity=".5" />
              <stop offset={R_NUM_INT / R_NUM_EXT} className="rr-st-escuro" stopOpacity="0" />
              <stop offset={(R_NUM_EXT - 6) / R_NUM_EXT} className="rr-st-escuro" stopOpacity="0" />
              <stop offset="1" className="rr-st-escuro" stopOpacity=".35" />
            </radialGradient>
            {/* luz de cima à esquerda: não gira com a roda */}
            <radialGradient id={`${id}-luz`} cx="32%" cy="22%" r="75%">
              <stop offset="0" className="rr-st-luz" stopOpacity=".32" />
              <stop offset=".45" className="rr-st-luz" stopOpacity=".06" />
              <stop offset="1" className="rr-st-luz" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-bisel`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="rr-st-ouro0" />
              <stop offset=".5" className="rr-st-aro1" />
              <stop offset="1" className="rr-st-escuro" stopOpacity=".6" />
            </linearGradient>
            <filter id={`${id}-brilha`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
            {/* veio da madeira: ruído esticado, escurecendo a cor de baixo (só nas peças paradas) */}
            <filter id={`${id}-madeira`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.008 0.16" numOctaves="3" seed="7" result="r" />
              <feColorMatrix in="r" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.15" result="veio" />
              <feComposite in="veio" in2="SourceGraphic" operator="in" result="v" />
              <feBlend in="SourceGraphic" in2="v" mode="multiply" />
            </filter>
            <linearGradient id={`${id}-cromo`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="rr-st-branco" />
              <stop offset=".35" className="rr-st-prata" />
              <stop offset=".55" className="rr-st-prata-esc" />
              <stop offset=".75" className="rr-st-branco" />
              <stop offset="1" className="rr-st-prata-esc" />
            </linearGradient>
            <linearGradient id={`${id}-ouro-cromo`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="rr-st-ouro0" />
              <stop offset=".4" className="rr-st-ouro1" />
              <stop offset=".6" className="rr-st-ouro0" />
              <stop offset="1" className="rr-st-ouro1" />
            </linearGradient>
            {/* sombra que o aro joga na pista */}
            <radialGradient id={`${id}-borda`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={R_PISTA_EXT}>
              <stop offset=".9" className="rr-st-escuro" stopOpacity="0" />
              <stop offset="1" className="rr-st-escuro" stopOpacity=".55" />
            </radialGradient>
          </defs>
          {/* parados: aro, madeira, pista e os 8 losangos */}
          <circle r={R_ARO} fill={`url(#${id}-aro)`} className="rr-aro rr-com-veio" filter={`url(#${id}-madeira)`} />
          <circle r={R_ARO - 3} fill="none" stroke={`url(#${id}-bisel)`} strokeWidth={3} />
          <circle r={R_MADEIRA} className="rr-madeira rr-com-veio" filter={`url(#${id}-madeira)`} />
          <circle r={R_MADEIRA - 1} className="rr-madeira-fio" />
          <circle r={R_PISTA_EXT} fill={`url(#${id}-pista)`} filter={`url(#${id}-madeira)`} className="rr-com-veio" />
          <circle r={R_PISTA_EXT} fill={`url(#${id}-borda)`} />
          {/* veios da madeira da pista */}
          {[171, 166, 160, 155].map((r) => (
            <circle key={r} r={r} className="rr-veio" />
          ))}
          <circle r={R_PISTA_INT + 1} className="rr-pista-borda" />
          {Array.from({ length: 8 }, (_, k) => {
            const a = 22.5 + k * 45;
            const [x, y] = polar(R_PISTA_INT + 13, a);
            return (
              <g key={k} transform={`translate(${x} ${y}) rotate(${a})`}>
                <path d="M1.2 -9.5L4.4 1 1.2 10.5-2 1Z" className="rr-sombra" />
                <path d="M0 -10L3.6 0 0 10-3.6 0Z" fill={`url(#${id}-ouro)`} className="rr-losango" />
              </g>
            );
          })}
        </svg>
        <svg className="rr-svg" viewBox="-200 -200 400 400" role="img" aria-label={final !== null ? `Roleta: deu ${final} ${cor}` : rodando ? "Roleta girando" : "Roleta parada"}>
          {/* os gradientes e filtros estão no desenho de baixo (os ids valem para a página inteira) */}
          {/* a roda que gira */}
          {/* o ângulo é posto direto no elemento pela animação (o React não mexe nele) */}
          <g ref={rodaRef}>
            <Roda id={id} />
            <path ref={brilhoRef} className={"rr-ganhou-luz" + (final !== null ? " on" : "")} filter={`url(#${id}-brilha)`} d="" />
          </g>
          {/* parados por cima da roda: a cavidade dos bolsos, a moldura do vencedor e o reflexo da luz */}
          <circle r={R_NUM_EXT} fill={`url(#${id}-fundo)`} className="rr-sem-toque" />
          <g ref={molduraRef}>
            <path ref={molduraCasaRef} className={"rr-ganhou" + (final !== null ? " on" : "")} d="" />
          </g>
          <circle r={R_MADEIRA} fill={`url(#${id}-luz)`} className="rr-sem-toque" />
          {/* a bolinha (some até o primeiro giro) */}
          {/* rastro da bolinha quando ela está rápida (posto pela animação) */}
          <g ref={rastroRef} className="rr-rastro">
            {[0.3, 0.18, 0.09].map((o, k) => (
              <circle key={k} r={6.5 - k} opacity={0} data-o={o} className="rr-bola-fantasma" />
            ))}
          </g>
          {/* a sombra fica no chão: separada da bolinha, ela se afasta quando a bolinha pula */}
          <circle ref={sombraRef} r={6.8} className="rr-sombra rr-sombra-bola" style={{ opacity: 0 }} />
          <g ref={bolaRef} style={{ opacity: 0 }}>
            <circle r={6.5} fill={`url(#${id}-bola)`} className="rr-bola" />
            <circle r={2.2} cx={-2.2} cy={-2.4} className="rr-bola-luz" />
          </g>
        </svg>
        <button type="button" className="rr-mudo" aria-pressed={mudo} aria-label={mudo ? "Ligar o som da roleta" : "Desligar o som da roleta"} onClick={trocarSom}>
          {mudo ? <IcSemSom /> : <IcVolume />}
        </button>
      </div>
    </div>
  );
}
