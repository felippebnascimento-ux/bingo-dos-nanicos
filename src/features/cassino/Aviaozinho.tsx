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
const W = 1000, H = 420, X0 = 40, Y0 = 390, X1 = 860, Y1 = 70;
const naTela = ([x, y]: [number, number]): [number, number] => [X0 + x * (X1 - X0), Y0 - y * (Y0 - Y1)];

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
  const areaRef = useRef<SVGPathElement>(null);
  const aviaoRef = useRef<HTMLDivElement>(null);
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
      const [ux, uy] = pts[pts.length - 1];
      areaRef.current?.setAttribute("d", `${d} L${ux.toFixed(1)} ${Y0} L${X0} ${Y0} Z`);
      const [px, py] = pts[pts.length - 2] ?? pts[0];
      const ang = (Math.atan2(uy - py, ux - px || 1) * 180) / Math.PI;
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

      <div className={"av-ceu" + (caiu ? " caiu" : "")}>
        <svg className="av-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="av-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="av-st-area" stopOpacity=".55" />
              <stop offset="1" className="av-st-area" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="av-linha" x1="0" x2="1">
              <stop offset="0" className="av-st-linha0" />
              <stop offset="1" className="av-st-linha1" />
            </linearGradient>
          </defs>
          {ESTRELAS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} className="av-estrela" opacity={s.o} />
          ))}
          {Array.from({ length: 8 }, (_, i) => <line key={"v" + i} x1={X0 + i * 120} y1={0} x2={X0 + i * 120} y2={H} className="av-grade" />)}
          {Array.from({ length: 7 }, (_, i) => <line key={"h" + i} x1={0} y1={30 + i * 60} x2={W} y2={30 + i * 60} className="av-grade" />)}
          <path ref={areaRef} fill="url(#av-area)" d="" />
          <path ref={linhaRef} fill="none" stroke="url(#av-linha)" strokeWidth={6} strokeLinecap="round" d="" />
        </svg>
        {voo && (
          <div ref={aviaoRef} className={"av-aviao" + (caiu ? " foi" : "")} aria-hidden="true">
            <svg viewBox="-60 0 200 80">
              <path d="M0 40 Q-30 40 -60 46" className="av-rastro" />
              <ellipse cx="70" cy="42" rx="52" ry="13" className="av-corpo" />
              <ellipse cx="70" cy="38" rx="48" ry="6" className="av-brilho" />
              <path d="M22 40 L6 18 L18 18 L36 36Z" className="av-asa2" />
              <path d="M60 44 L40 72 L56 72 L84 46Z" className="av-asa2" />
              <path d="M58 36 L46 14 L58 14 L78 36Z" className="av-asa" />
              <ellipse cx="96" cy="37" rx="10" ry="6" className="av-vidro" />
              <rect x="120" y="38" width="6" height="8" rx="2" className="av-nariz" />
              <ellipse cx="128" cy="42" rx="3" ry="18" className="av-helice" />
            </svg>
          </div>
        )}
        <div className="av-mult" aria-live="polite">
          <span ref={multRef}>{voo ? textoMult(agora) : "1,00×"}</span>
          <small>{caiu ? `VOOU EM ${textoMult(fim?.crash ?? agora)}` : voando ? (sacou ? `VOCÊ SACOU EM ${textoMult(fim!.sacou!)}` : "VOANDO…") : "APOSTE E DECOLE"}</small>
        </div>
        <span className="av-base">1,0×</span>
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
