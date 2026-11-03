"use client";
/*
 * Aviãozinho (aba do Cassino, no lugar do Limbo): o avião decola, o multiplicador sobe e quem sacar antes do avião
 * ir embora ganha aposta × multiplicador. O banco sorteia o ponto de queda na decolagem e só conta no fim
 * (aviao_decolar / aviao_ver / aviao_sacar); o site anima pelo relógio e pergunta ao banco algumas vezes por segundo.
 * Desenho em SVG (céu, estrelas, curva, avião) mexido direto pelos refs a 60 fps. Sons pelo Web Audio, com mudo.
 */
import { useEffect, useRef, useState } from "react";
import { IcSemSom, IcVolume } from "@/components/ui/icones";
import { ajustarSaldo, useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { local, reduzMovimento } from "@/lib/util";
import { curva, faixaVoo, multAt, recebe, textoMult } from "./aviao";
import { carregar, msgDe, useCassino } from "./estado";
import { FICHAS } from "./regras";
import { FichaVisual } from "./RoletaMesa";

type Fim = { estado: "sacou" | "caiu"; sacou: number | null; crash: number; pagou: number; saldo: number };
type Mesa = { id: number; nome: string | null; aposta: number; estado: string; sacou: number | null; pagou: number; crash: number | null; alvo: number | null };

/* estrelas e grade do céu, fixas */
const ESTRELAS = Array.from({ length: 60 }, (_, i) => ({ x: (i * 137) % 1000, y: (i * 71) % 330, r: i % 5 ? 1 : 1.8, o: 0.2 + (i % 4) * 0.15 }));
/* a curva termina antes da borda: o avião (cerca de 15% da largura) cabe inteiro na frente dela */
const W = 1000, H = 420, X0 = 40, Y0 = 390, X1 = 800, Y1 = 95;
const naTela = ([x, y]: [number, number]): [number, number] => [X0 + x * (X1 - X0), Y0 - y * (Y0 - Y1)];

/** O avião de lado (nariz para a direita). `trem`: rodas para baixo, parado na pista. */
function Aviao({ trem }: { trem?: boolean }) {
  return (
    <svg viewBox="0 0 170 80">
      <defs>
        {/* volume: luz em cima, sombra embaixo (como um cilindro) */}
        <linearGradient id="avp-corpo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="avp-st-luz" />
          <stop offset=".35" className="avp-st-corpo" />
          <stop offset="1" className="avp-st-sombra" />
        </linearGradient>
        <linearGradient id="avp-asa" x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" className="avp-st-corpo" />
          <stop offset="1" className="avp-st-sombra" />
        </linearGradient>
        <linearGradient id="avp-vidro" x1="0" y1="0" x2=".6" y2="1">
          <stop offset="0" className="avp-st-vidro0" />
          <stop offset="1" className="avp-st-vidro1" />
        </linearGradient>
        <radialGradient id="avp-disco">
          <stop offset="0" className="avp-st-disco" stopOpacity=".05" />
          <stop offset=".8" className="avp-st-disco" stopOpacity=".28" />
          <stop offset="1" className="avp-st-disco" stopOpacity="0" />
        </radialGradient>
      </defs>
      {trem && (
        <g className="av-trem">
          <path d="M84 50 L86 63 M32 47 L31 55" />
          <circle cx="86" cy="66" r="4.5" />
          <circle cx="31" cy="57" r="3" />
        </g>
      )}
      <path d="M15 37 L7 11 Q7 8 10 8 L21 8 L42 33 Z" fill="url(#avp-asa)" className="av-cauda" />
      <path d="M10 41 L36 40 L31 48 L13 49 Q8 47 10 41 Z" fill="url(#avp-asa)" className="av-cauda" />
      <path d="M10 34 C40 28 96 24 126 26 C142 27 152 32 154 39 C152 46 142 50 126 51 C96 53 40 50 10 44 Q5 39 10 34 Z" fill="url(#avp-corpo)" className="av-corpo" />
      {/* chapas, rebites e a faixa */}
      <path d="M48 30 L49 49 M88 26 L89 51 M138 30 L139 48" className="av-chapa" />
      {[56, 64, 72, 80, 96, 104, 112, 120].map((x) => (
        <circle key={x} cx={x} cy={33.5 - (x - 56) * 0.02} r=".7" className="av-rebite" />
      ))}
      <path d="M22 37 C60 33 104 32 146 35" className="av-faixa" />
      <path d="M22 40 C60 36.5 104 35.5 146 38" className="av-faixa fina escura" />
      <path d="M97 27 C101 15 119 13 129 26 Z" fill="url(#avp-vidro)" className="av-vidro" />
      <path d="M112 15.5 L114 26" className="av-chapa" />
      <path d="M103 24 C106 18 111 17 115 18" className="av-reflexo" />
      <path d="M62 42 L104 42 Q107 43 104 46 L81 66 Q79 68 75 68 L61 68 Q57 68 58 64 Z" fill="url(#avp-asa)" className="av-asa" />
      <path d="M61 63 L80 63" className="av-faixa fina" />
      <path d="M66 45 L64 60 M80 45 L74 60" className="av-chapa" />
      <path d="M140 46 L130 48" className="av-escape" />
      <path d="M152 32 Q164 39 152 46 Z" className="av-nariz" />
      <ellipse cx="160" cy="39" rx="5" ry="26" fill="url(#avp-disco)" />
      <ellipse cx="160" cy="39" rx="2.2" ry="24" className="av-helice" />
    </svg>
  );
}

/* nuvens (uma faixa que se repete: a 2ª metade é a cópia da 1ª, para o laço não pular) */
const NUVEM = "c0-9 8-16 18-16c5-9 18-12 26-5c9-6 23-2 25 9c9 1 15 6 15 12z";
const NUVENS: [number, number, number][] = [
  [40, 60, 1], [230, 120, 0.7], [380, 40, 0.9], [560, 150, 0.6], [700, 80, 1.1], [880, 130, 0.8],
];

/* ---------- sons ---------- */
type Som = { ctx: AudioContext; motor: OscillatorNode; volume: GainNode };
function abrirSom(): Som | null {
  try {
    const ctx = new AudioContext();
    const motor = ctx.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.value = 90;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 700;
    const volume = ctx.createGain();
    volume.gain.value = 0.025;
    motor.connect(filtro).connect(volume).connect(ctx.destination);
    motor.start();
    return { ctx, motor, volume };
  } catch {
    return null;
  }
}
function plim(s: Som | null) {
  if (!s) return;
  const o = s.ctx.createOscillator(), g = s.ctx.createGain(), t = s.ctx.currentTime;
  o.type = "sine";
  o.frequency.setValueAtTime(1100, t);
  o.frequency.exponentialRampToValueAtTime(1900, t + 0.12);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g).connect(s.ctx.destination);
  o.start(t);
  o.stop(t + 0.45);
}
function explosao(s: Som | null) {
  if (!s) return;
  const t = s.ctx.currentTime, buf = s.ctx.createBuffer(1, s.ctx.sampleRate * 0.6, s.ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const fonte = s.ctx.createBufferSource(), f = s.ctx.createBiquadFilter(), g = s.ctx.createGain();
  fonte.buffer = buf;
  f.type = "lowpass";
  f.frequency.value = 600;
  g.gain.value = 0.35;
  fonte.connect(f).connect(g).connect(s.ctx.destination);
  fonte.start(t);
}
function fecharSom(s: Som | null) {
  if (!s) return;
  try {
    s.volume.gain.setTargetAtTime(0, s.ctx.currentTime, 0.05);
    setTimeout(() => {
      s.motor.stop();
      void s.ctx.close();
    }, 900);
  } catch {
    /* já fechou */
  }
}

/** "1,50" → 1.5 (vazio ou fora de 1,01–1.000 → null) */
function lerAlvo(txt: string) {
  const n = Number(txt.replace(",", ".").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 1.01 && n <= 1000 ? Math.round(n * 100) / 100 : null;
}

export function Aviaozinho() {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const historico = useCassino((s) => s.historico);
  const [ficha, setFicha] = useState(25);
  const [alvoTxt, setAlvoTxt] = useState(() => local.get("aviao-alvo") ?? "2,00");
  const [autoOn, setAutoOn] = useState(() => local.get("aviao-auto") === "1");
  const [mudo, setMudo] = useState(() => local.get("roleta-som") === "0");
  const [voo, setVoo] = useState<{ id: number; aposta: number } | null>(null);
  const [fim, setFim] = useState<Fim | null>(null);
  const [caiu, setCaiu] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mesa, setMesa] = useState<Mesa[]>([]);
  const [agora, setAgora] = useState(1);

  const multRef = useRef<HTMLSpanElement>(null);
  const linhaRef = useRef<SVGPathElement>(null);
  const linhaRef2 = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const aviaoRef = useRef<HTMLDivElement>(null);
  const fumacaRef = useRef<HTMLDivElement>(null);
  const rastroRef = useRef<HTMLDivElement>(null);
  const t0 = useRef(0);
  const fimRef = useRef<Fim | null>(null);
  const somRef = useRef<Som | null>(null);
  const mudoRef = useRef(mudo);
  useEffect(() => {
    mudoRef.current = mudo;
    if (somRef.current) somRef.current.volume.gain.value = mudo ? 0 : 0.025;
  });

  const alvo = lerAlvo(alvoTxt);
  const voando = !!voo && !caiu;

  /* "Na mesa agora": os voos de todo mundo nos últimos minutos */
  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      const { data } = await sb().rpc("aviao_mesa");
      if (vivo && Array.isArray(data)) setMesa(data as Mesa[]);
    };
    void ler();
    const t = setInterval(() => !document.hidden && void ler(), 2000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const terminar = (r: Fim) => {
    if (fimRef.current) return;
    fimRef.current = r;
    setFim(r);
    ajustarSaldo(r.saldo);
    if (r.estado === "sacou") {
      if (!mudoRef.current) plim(somRef.current);
      toast(`+${formatarMoedas(r.pagou)} moedas: sacou em ${textoMult(r.sacou ?? 1)}`);
    }
    void carregar();
  };

  /* o voo: anima pelo relógio e pergunta ao banco 4 vezes por segundo até ele dizer que acabou */
  useEffect(() => {
    if (!voo) return;
    let quadro = 0, parado = false, perguntando = false, ultimoQuadro = 0;
    const desenhar = () => {
      if (parado) return;
      ultimoQuadro = performance.now();
      const ms = performance.now() - t0.current;
      const f = fimRef.current;
      let m = multAt(ms);
      const acabou = !!f && m >= f.crash;
      if (acabou) m = f!.crash;
      const pts = curva(Math.min(ms, Math.log(Math.max(1, m)) / 0.07 * 1000 + 1)).map(naTela);
      const d = "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L");
      linhaRef.current?.setAttribute("d", d);
      linhaRef2.current?.setAttribute("d", d);
      const [ux, uy] = pts[pts.length - 1];
      areaRef.current?.setAttribute("d", `${d} L${ux.toFixed(1)} ${Y0} L${X0} ${Y0} Z`);
      const [px, py] = pts[pts.length - 2] ?? pts[0];
      const ang = (Math.atan2(uy - py, ux - px || 1) * 180) / Math.PI;
      /* fumaça do rastro: bolinhas em pontos mais antigos da curva, maiores e mais apagadas */
      const bolhas = rastroRef.current?.children;
      if (bolhas)
        for (let k = 0; k < bolhas.length; k++) {
          const el = bolhas[k] as HTMLElement;
          const pt = pts[Math.max(0, pts.length - 2 - k * 2)];
          el.style.left = `${(pt[0] / W) * 100}%`;
          el.style.top = `${(pt[1] / H) * 100}%`;
          el.style.opacity = acabou || ms < 400 ? "0" : String(0.7 * (1 - k / bolhas.length));
          el.style.setProperty("--t", String(1 + k * 0.35));
        }
      if (aviaoRef.current && !acabou) {
        aviaoRef.current.style.left = `${(ux / W) * 100}%`;
        aviaoRef.current.style.top = `${(uy / H) * 100}%`;
        aviaoRef.current.style.setProperty("--ang", `${Math.max(-40, Math.min(0, ang)).toFixed(1)}deg`);
      }
      if (multRef.current) multRef.current.textContent = textoMult(m);
      if (somRef.current && !mudoRef.current) somRef.current.motor.frequency.setTargetAtTime(90 + Math.log(m) * 90, somRef.current.ctx.currentTime, 0.1);
      setAgora(m);
      if (acabou) {
        parado = true;
        if (fumacaRef.current) {
          fumacaRef.current.style.left = `${(ux / W) * 100}%`;
          fumacaRef.current.style.top = `${(uy / H) * 100}%`;
        }
        setCaiu(true);
        if (!mudoRef.current) explosao(somRef.current);
        fecharSom(somRef.current);
        somRef.current = null;
        return;
      }
      quadro = requestAnimationFrame(desenhar);
    };
    const perguntar = async () => {
      if (parado || perguntando || fimRef.current) return;
      perguntando = true;
      const { data } = await sb().rpc("aviao_ver", { p_id: voo.id });
      perguntando = false;
      const r = data as Partial<Fim> & { estado?: string };
      if (r && (r.estado === "sacou" || r.estado === "caiu")) terminar(r as Fim);
    };
    quadro = requestAnimationFrame(desenhar);
    const t = setInterval(perguntar, 250);
    /* aba escondida (ou janela coberta) não desenha quadros: sem quadro há meio segundo, desenha na mão */
    const reserva = setInterval(() => {
      if (performance.now() - ultimoQuadro > 500) {
        cancelAnimationFrame(quadro);
        desenhar();
      }
    }, 500);
    return () => {
      parado = true;
      cancelAnimationFrame(quadro);
      clearInterval(t);
      clearInterval(reserva);
    };
  }, [voo]);

  const apostar = async () => {
    if (ocupado || voando) return;
    if (autoOn && !alvo) return toast("O saque automático vai de 1,01× a 1.000×.");
    setOcupado(true);
    try {
      const { data, error } = await sb().rpc("aviao_decolar", { p_aposta: ficha, p_auto: autoOn ? alvo : null });
      if (error) throw error;
      const r = data as { id: number; saldo: number };
      ajustarSaldo(r.saldo);
      fimRef.current = null;
      setFim(null);
      setCaiu(false);
      t0.current = performance.now();
      if (!reduzMovimento()) somRef.current = abrirSom();
      if (somRef.current && mudoRef.current) somRef.current.volume.gain.value = 0;
      setVoo({ id: r.id, aposta: ficha });
    } catch (e) {
      toast(msgDe(e, "Não deu para decolar. Confira a internet."));
    } finally {
      setOcupado(false);
    }
  };

  const sacar = async () => {
    if (!voo || fimRef.current || ocupado) return;
    setOcupado(true);
    try {
      const { data, error } = await sb().rpc("aviao_sacar", { p_id: voo.id });
      if (error) throw error;
      terminar(data as Fim);
    } catch (e) {
      toast(msgDe(e, "Não deu para sacar. Confira a internet."));
    } finally {
      setOcupado(false);
    }
  };

  const trocarSom = () => {
    setMudo(!mudo);
    local.set("roleta-som", mudo ? "1" : "0");
  };

  /* escala do lado esquerdo: acompanha o topo da curva (o mesmo de curva() em aviao.ts) */
  const topo = Math.max(2, (voo ? agora : 1) * 1.25);
  const marcas = [0.25, 0.5, 0.75, 1].map((k) => ({ k, m: 1 + (topo - 1) * k }));
  const faixa = voo ? faixaVoo(agora) : "lo";

  const ultimos = historico.filter((a) => a.jogo === "aviao").map((a) => Number(a.resultado.valor)).filter((n) => n >= 1).slice(0, 12);
  const sacou = fim?.estado === "sacou";
  const podeSacar = voando && !fim;

  return (
    <div className="rm aviao">
      <button type="button" className="av-mudo" aria-pressed={mudo} aria-label={mudo ? "Ligar o som" : "Desligar o som"} onClick={trocarSom}>
        {mudo ? <IcSemSom /> : <IcVolume />}
      </button>
      <div>
        <p className="rm-rotulo">Últimos voos</p>
        <ol className="av-hist">
          {ultimos.length ? ultimos.map((m, k) => <li key={k} className={"av-" + faixaVoo(m)}>{textoMult(m)}</li>) : <li className="av-vazio">nenhum voo ainda</li>}
        </ol>
      </div>

      <div className={"av-ceu" + (caiu ? " caiu" : "") + (voando ? " voando" : "")}>
        <span className="av-lua" aria-hidden="true" />
        <svg className="av-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="av-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="av-st-area" stopOpacity=".38" />
              <stop offset="1" className="av-st-area" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="av-linha" x1="0" x2="1">
              <stop offset="0" className="av-st-linha0" />
              <stop offset="1" className="av-st-linha1" />
            </linearGradient>
          </defs>
          {ESTRELAS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} className={"av-estrela" + (i % 7 === 0 ? " pisca" : "")} opacity={s.o} />
          ))}
          {marcas.map(({ k }) => (
            <line key={k} x1={X0} y1={Y0 - k * (Y0 - Y1)} x2={W} y2={Y0 - k * (Y0 - Y1)} className="av-grade" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {/* nuvens em duas camadas (a de trás mais lenta); só andam durante o voo */}
        {[0, 1].map((c) => (
          <svg key={c} className={"av-nuvens c" + c} viewBox="0 0 2000 220" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={"av-nuvem" + c} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="av-st-nuvem0" />
                <stop offset="1" className="av-st-nuvem1" />
              </linearGradient>
              <filter id={"av-macia" + c}>
                <feGaussianBlur stdDeviation={c ? 5 : 3} />
              </filter>
            </defs>
            {[0, 1000].map((dx) =>
              NUVENS.map(([x, y, e], k) => <path key={dx + "-" + k} d={`M0 0${NUVEM}`} transform={`translate(${dx + x + c * 90} ${y + c * 30}) scale(${(c ? 1.6 : 2.4) * e})`} fill={`url(#av-nuvem${c})`} filter={`url(#av-macia${c})`} className="av-nuvem" />),
            )}
          </svg>
        ))}
        <svg className="av-chao" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 70 L80 40 L150 62 L240 22 L330 58 L420 34 L520 66 L610 30 L700 60 L800 26 L900 56 L1000 38 L1000 120 L0 120 Z" className="av-serra" />
          <path d="M0 96 Q250 78 500 90 T1000 86 L1000 120 L0 120 Z" className="av-morro" />
          <rect x="0" y="108" width="1000" height="12" className="av-pista" />
          {Array.from({ length: 14 }, (_, k) => (
            <rect key={k} x={20 + k * 72} y="113" width="30" height="2" className="av-pista-faixa" />
          ))}
          {/* luzes da cidade no morro e as da beira da pista */}
          {Array.from({ length: 26 }, (_, k) => (
            <circle key={"c" + k} cx={(k * 389) % 1000} cy={95 + ((k * 7) % 9)} r={k % 3 ? 0.9 : 1.3} className="av-luz-cidade" />
          ))}
          {Array.from({ length: 11 }, (_, k) => (
            <circle key={"p" + k} cx={10 + k * 100} cy="108" r="1.6" className={"av-luz-pista" + (k % 2 ? " b" : "")} />
          ))}
        </svg>
        <svg className="av-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path ref={areaRef} fill="url(#av-area)" d="" />
          <path ref={linhaRef} fill="none" className="av-linha-luz" vectorEffect="non-scaling-stroke" d="" />
          <path ref={linhaRef2} fill="none" stroke="url(#av-linha)" className="av-linha" vectorEffect="non-scaling-stroke" d="" />
        </svg>
        <ol className="av-escala" aria-hidden="true">
          {marcas.map(({ k, m }) => (
            <li key={k} style={{ bottom: `${(k * (Y0 - Y1) + (H - Y0)) / H * 100}%` }}>
              {m.toFixed(m < 10 ? 1 : 0).replace(".", ",")}×
            </li>
          ))}
        </ol>
        <div ref={rastroRef} className="av-rastro" aria-hidden="true">
          {Array.from({ length: 9 }, (_, k) => (
            <i key={k} />
          ))}
        </div>
        {(!voo || caiu) && (
          <div className={"av-aviao parado" + (caiu ? " volta" : "")} aria-hidden="true">
            <Aviao trem />
          </div>
        )}
        {voo && (
          <div ref={aviaoRef} className={"av-aviao" + (caiu ? " foi" : "")} aria-hidden="true">
            <Aviao />
          </div>
        )}
        <div ref={fumacaRef} className={"av-fumaca" + (caiu ? " on" : "")} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className={"av-mult av-m-" + faixa} aria-live="polite">
          <span ref={multRef}>{voo ? textoMult(agora) : "1,00×"}</span>
          <small>{caiu ? `VOOU EM ${textoMult(fim?.crash ?? agora)}` : voando ? (sacou ? `VOCÊ SACOU EM ${textoMult(fim!.sacou!)}` : "VOANDO…") : "APOSTE E DECOLE"}</small>
        </div>
      </div>

      <div className="av-grid">
        <div className="av-painel">
          <p className="rm-rotulo">Sua aposta</p>
          <div className="rm-fichas" role="radiogroup" aria-label="Valor da aposta">
            {FICHAS.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={ficha === v} className={ficha === v ? "sel" : undefined} disabled={voando} onClick={() => setFicha(v)}>
                <FichaVisual v={v} />
              </button>
            ))}
          </div>
          <p className="rm-rotulo">Sacar automático em</p>
          <div className="av-auto">
            <input
              aria-label="Sacar automático em"
              inputMode="decimal"
              value={alvoTxt}
              disabled={voando}
              onChange={(e) => {
                setAlvoTxt(e.target.value);
                local.set("aviao-alvo", e.target.value);
              }}
            />
            <button
              type="button"
              role="switch"
              aria-checked={autoOn}
              className={"av-chave" + (autoOn ? " on" : "")}
              disabled={voando}
              onClick={() => {
                setAutoOn(!autoOn);
                local.set("aviao-auto", autoOn ? "0" : "1");
              }}
            >
              <i />
              {autoOn ? "Ligado" : "Desligado"}
            </button>
          </div>
          {podeSacar ? (
            <button type="button" className="av-sacar" disabled={ocupado} onClick={() => void sacar()}>
              SACAR {formatarMoedas(recebe(voo.aposta, agora))} MOEDAS
              <small>
                {voo.aposta} × {textoMult(agora).replace("×", "")} · aperte antes do avião ir embora
              </small>
            </button>
          ) : voando ? (
            <button type="button" className="rm-girar" disabled>
              {sacou ? `+${formatarMoedas(fim!.pagou)} MOEDAS · ESPERANDO O POUSO…` : "VOANDO…"}
            </button>
          ) : (
            <button type="button" className="rm-girar" disabled={ocupado || (saldo !== undefined && saldo < ficha)} onClick={() => void apostar()}>
              {saldo !== undefined && saldo < ficha ? "Sem moedas" : `APOSTAR · ${ficha} MOEDAS`}
            </button>
          )}
          {caiu && fim && (
            <p className={"av-res " + (fim.estado === "sacou" ? "bom" : "ruim")}>
              {fim.estado === "sacou" ? `Você sacou em ${textoMult(fim.sacou!)}: +${formatarMoedas(fim.pagou)} moedas` : `O avião foi embora em ${textoMult(fim.crash)}: −${voo?.aposta ?? 0} moedas`}
            </p>
          )}
        </div>
        <div className="av-painel">
          <p className="rm-rotulo">Na mesa agora</p>
          <ul className="av-mesa">
            {mesa.length ? (
              mesa.map((x) => (
                <li key={x.id}>
                  <span className="av-av" aria-hidden="true">
                    {(x.nome ?? "?")[0]}
                  </span>
                  <span className="av-nome">
                    {x.nome ?? "Alguém"} · {x.aposta}
                  </span>
                  {x.estado === "sacou" ? (
                    <b className="ok">
                      {textoMult(Number(x.sacou))} · +{x.pagou - x.aposta}
                    </b>
                  ) : x.estado === "caiu" ? (
                    <b className="ruim">caiu em {textoMult(Number(x.crash))}</b>
                  ) : x.alvo ? (
                    <b className="voa">alvo {textoMult(Number(x.alvo))}</b>
                  ) : (
                    <b className="voa">voando ✈</b>
                  )}
                </li>
              ))
            ) : (
              <li className="av-vazio">Ninguém voou nos últimos minutos.</li>
            )}
          </ul>
        </div>
      </div>
      <p className="hint rm-pe">O multiplicador sobe até o avião ir embora. Saque antes e ganhe aposta × multiplicador. Se ele sumir antes, você perde. A casa leva 3%.</p>
    </div>
  );
}
