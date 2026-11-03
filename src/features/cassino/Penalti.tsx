"use client";
/*
 * Pênalti (aba Cassino, no lugar do Maior ou menor): cada um joga a sua disputa contra o goleiro da casa.
 * Aposta uma vez e escolhe o canto; o banco sorteia na hora a coluna em que o goleiro pula (penalti_chutar). Gol nas
 * outras duas: o multiplicador sobe (1,45× → 7,36× no 5º gol) e dá para sacar depois de cada gol. Defendeu, a bola
 * espirra para fora. A cena é ilustração (--pn-*): estádio, torcida, refletores, gol com rede, goleiro e bola.
 */
import { useEffect, useState } from "react";
import { IcSemSom, IcVolume } from "@/components/ui/icones";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { local, reduzMovimento } from "@/lib/util";
import { carregar, msgDe } from "./estado";
import { membro, type Ponto } from "./goleiro";
import { MAX_GOLS, multPenalti } from "./mesa";
import { FICHAS } from "./regras";
import { FichaVisual } from "./RoletaMesa";

const ZONAS = [0, 1, 2, 3, 4, 5];
const NOME_ZONA = ["alto à esquerda", "alto no meio", "alto à direita", "baixo à esquerda", "baixo no meio", "baixo à direita"];
const vezes = (m: number) => `${m.toFixed(2).replace(".", ",")}×`;
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/* ---------- sons (Web Audio) ---------- */
function apito() {
  try {
    const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = "square";
    o.frequency.setValueAtTime(2300, t);
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.3);
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* sem som */
  }
}
function torcida(gol: boolean) {
  try {
    const ctx = new AudioContext(), t = ctx.currentTime, dur = gol ? 1.8 : 1;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
    const f = ctx.createBufferSource(), fil = ctx.createBiquadFilter(), g = ctx.createGain();
    f.buffer = buf;
    fil.type = "bandpass";
    fil.frequency.value = gol ? 900 : 380;
    g.gain.value = gol ? 0.22 : 0.12;
    f.connect(fil).connect(g).connect(ctx.destination);
    f.start(t);
    setTimeout(() => void ctx.close(), dur * 1000 + 300);
  } catch {
    /* sem som */
  }
}

/* ---------- o goleiro: o Gamer, com a mesma arte do app (nanicos/4-corpo.webp, 187 × 440) e luvas de goleiro ---------- */
/* Os braços são recortes da própria arte, por cima do corpo, e giram no ombro (logo acima da barra da manga); o corpo
   sem os braços fica embaixo. As medidas são da arte: não mexa sem refazer a conta do pulo em 26-cassino.css. */
const ARTE = "/arte/nanicos/4-corpo.webp";
/* o braço esquerdo, da manga até a ponta dos dedos (o direito é medido à parte: a arte não é simétrica) */
const BRACO_E = "M0 222 L46 222 L45 234 L42 242 L41 262 L37 270 L34 278 L34 300 L36 318 L34 322 L34 346 L0 346 Z";
const BRACO_D = "M187 222 L141 222 L142 234 L143 242 L145 262 L148 274 L150 282 L149 300 L150 318 L152 322 L154 334 L154 346 L187 346 Z";
/* o corpo: tudo menos os braços abaixo da barra da manga (evenodd fura os dois) */
const CORPO = "M-1 -1 H188 V441 H-1 Z M-1 232 L45 232 L42 242 L41 262 L37 270 L34 278 L34 300 L36 318 L34 322 L34 346 L-1 346 Z " +
  "M188 232 L142 232 L143 242 L145 262 L148 274 L150 282 L149 300 L150 318 L152 322 L154 334 L154 346 L188 346 Z";
/* a luva da mão esquerda (a direita é o espelho): punho, palma, quatro dedos e o dedão para dentro */
const DEDOS: [Ponto, Ponto][] = [
  [[6, 326], [4.5, 345]],
  [[13.5, 328], [12.5, 350]],
  [[21, 328], [21, 350]],
  [[28.5, 326], [29.5, 345]],
];

function Luva() {
  return (
    <>
      <path d={membro([33, 300], [41, 318], 5.5, 4.2)} fill="url(#pn-luva)" className="pn-luva" />
      {DEDOS.map(([a, b], k) => (
        <path key={k} d={membro(a, b, 4.4, 3.6)} fill="url(#pn-luva)" className="pn-luva" />
      ))}
      <rect x="0" y="290" width="37" height="42" rx="14" fill="url(#pn-luva)" className="pn-luva" />
      <rect x="2" y="283" width="33" height="12" rx="4" className="pn-luva-punho" />
      <path d="M5 312 Q18 318 32 312" className="pn-luva-faixa" />
    </>
  );
}

/** O Gamer no gol, com luvas: a arte dele, os braços abertos na espera (o pulo e os braços são CSS). */
export function Goleiro() {
  return (
    <svg viewBox="-95 0 377 440" className="pn-goleiro-svg">
      <defs>
        <linearGradient id="pn-luva" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="pn-st-luva0" />
          <stop offset="1" className="pn-st-luva1" />
        </linearGradient>
        <clipPath id="pn-gk-corpo">
          <path d={CORPO} clipRule="evenodd" />
        </clipPath>
        <clipPath id="pn-gk-braco-e">
          <path d={BRACO_E} />
        </clipPath>
        <clipPath id="pn-gk-braco-d">
          <path d={BRACO_D} />
        </clipPath>
      </defs>
      <ellipse cx="93.5" cy="434" rx="80" ry="8" className="pn-sombra" />
      <image href={ARTE} width="187" height="440" clipPath="url(#pn-gk-corpo)" />
      <g className="pn-braco e">
        <image href={ARTE} width="187" height="440" clipPath="url(#pn-gk-braco-e)" />
        <Luva />
      </g>
      <g className="pn-braco d">
        <image href={ARTE} width="187" height="440" clipPath="url(#pn-gk-braco-d)" />
        <g transform="matrix(-1 0 0 1 187 0)">
          <Luva />
        </g>
      </g>
    </svg>
  );
}

/* a bola de futebol clássica (icosaedro truncado, 12 gomos pretos de 5 lados e 20 brancos de 6), vista de frente e
   calculada uma vez: os pontos já estão no círculo de raio 19 */
const GOMOS_PRETOS = "M-3.2 -2.9 L4.1 -0.7 L8.4 -6.5 L3.6 -12.2 L-3.5 -10.0Z M4.9 -16.6 L11.0 -15.1 L8.9 -16.3 L1.6 -18.5 L-0.9 -18.7Z M16.2 2.2 L18.7 2.4 L18.4 -4.8 L15.7 -9.3 L14.4 -5.0Z M-16.3 6.0 L-11.6 11.8 L-6.9 9.4 L-8.7 2.2 L-14.5 0.0Z M0.5 11.6 L3.1 16.2 L10.3 14.0 L12.0 8.0 L6.0 6.6Z M-16.9 -8.3 L-14.9 -7.1 L-9.4 -12.1 L-8.0 -16.5 L-12.7 -14.1Z";
const GOMOS_BRANCOS = "M8.4 -6.5 L14.4 -5.0 L15.7 -9.3 L11.0 -15.1 L4.9 -16.6 L3.6 -12.2Z M-9.4 -12.1 L-3.5 -10.0 L3.6 -12.2 L4.9 -16.6 L-0.9 -18.7 L-8.0 -16.5Z M6.0 6.6 L12.0 8.0 L16.2 2.2 L14.4 -5.0 L8.4 -6.5 L4.1 -0.7Z M-6.9 9.4 L0.5 11.6 L6.0 6.6 L4.1 -0.7 L-3.2 -2.9 L-8.7 2.2Z M-14.5 0.0 L-8.7 2.2 L-3.2 -2.9 L-3.5 -10.0 L-9.4 -12.1 L-14.9 -7.1Z M10.3 14.0 L12.7 14.1 L16.9 8.3 L18.7 2.4 L16.2 2.2 L12.0 8.0Z M-1.6 18.5 L0.9 18.7 L8.0 16.5 L12.7 14.1 L10.3 14.0 L3.1 16.2Z M-8.9 16.3 L-1.6 18.5 L3.1 16.2 L0.5 11.6 L-6.9 9.4 L-11.6 11.8Z M-18.4 4.8 L-16.3 6.0 L-14.5 0.0 L-14.9 -7.1 L-16.9 -8.3 L-18.7 -2.4Z M-11.0 15.1 L-8.9 16.3 L-11.6 11.8 L-16.3 6.0 L-18.4 4.8 L-15.7 9.3Z";

/** Bola de futebol: os gomos giram no chute; a luz e a sombra ficam paradas, como numa bola de verdade. */
export function Bola() {
  return (
    <svg viewBox="-20 -20 40 40" className="pn-bola-svg">
      <defs>
        <radialGradient id="pn-bola-volume" cx="35%" cy="30%" r="75%">
          <stop offset="0" className="pn-st-bola0" />
          <stop offset=".55" className="pn-st-bola1" />
          <stop offset="1" className="pn-st-bola2" />
        </radialGradient>
      </defs>
      <g className="pn-bola-gira">
        <circle r="19" className="pn-bola-branca" />
        <path d={GOMOS_BRANCOS} className="pn-gomo-branco" />
        <path d={GOMOS_PRETOS} className="pn-gomo" />
      </g>
      <circle r="19" fill="url(#pn-bola-volume)" />
      <ellipse cx="-7" cy="-9" rx="5.5" ry="3.2" transform="rotate(-35 -7 -9)" className="pn-bola-brilho" />
      <circle r="19" className="pn-bola-luz" />
    </svg>
  );
}

type Disputa = { aposta: number; gols: number };
/** O chute na tela: `fase` = voando (até o canto), rebateu (o goleiro pegou e ela espirra) ou parou (dentro do gol). */
type Lance = { zona: number; coluna: number; alto: boolean; gol: boolean; fase: "voando" | "rebateu" | "parou" };

export function Penalti() {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const [ficha, setFicha] = useState(10);
  const [disputa, setDisputa] = useState<Disputa | null>(null);
  const [lance, setLance] = useState<Lance | null>(null);
  const [placa, setPlaca] = useState<"gol" | "defendeu" | null>(null);
  const [fim, setFim] = useState<{ texto: string; bom: boolean } | null>(null);
  const [ultimos, setUltimos] = useState<boolean[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [mudo, setMudo] = useState(() => local.get("roleta-som") === "0");

  /* volta para a disputa aberta (recarregou a página no meio) */
  useEffect(() => {
    let vivo = true;
    void sb()
      .rpc("penalti_estado")
      .then(({ data }) => {
        if (vivo && data && typeof data === "object") setDisputa({ aposta: Number((data as Disputa).aposta), gols: Number((data as Disputa).gols) });
      });
    return () => {
      vivo = false;
    };
  }, []);

  const gols = disputa?.gols ?? 0;

  const chutar = async (zona: number) => {
    if (ocupado) return;
    if (!disputa && saldo !== undefined && saldo < ficha) return toast("Sem moedas para essa ficha.");
    setOcupado(true);
    setPlaca(null);
    setFim(null);
    setLance(null);
    try {
      let atual = disputa;
      if (!atual) {
        const c = await sb().rpc("penalti_comecar", { p_aposta: ficha });
        if (c.error) throw c.error;
        atual = { aposta: ficha, gols: 0 };
        setDisputa(atual);
      }
      const { data, error } = await sb().rpc("penalti_chutar", { p_zona: zona });
      if (error) throw error;
      const r = data as { gol: boolean; coluna: number; alto: boolean; gols: number; estado: string; pagou: number };
      if (!mudo) apito();
      /* um quadro com a bola na marca, depois ela voa (a transição do CSS precisa da mudança de classe) */
      await espera(30);
      /* defendeu: o goleiro pula na altura da bola; gol: ele pula para o outro lado, alto ou baixo como o banco sorteou */
      const alto = r.gol ? r.alto : zona < 3;
      setLance({ zona, coluna: r.coluna, alto, gol: r.gol, fase: "voando" });
      await espera(reduzMovimento() ? 0 : 560);
      setLance({ zona, coluna: r.coluna, alto, gol: r.gol, fase: r.gol ? "parou" : "rebateu" });
      setPlaca(r.gol ? "gol" : "defendeu");
      if (!mudo) torcida(r.gol);
      setUltimos((u) => [r.gol, ...u].slice(0, 12));
      if (r.estado === "ativa") setDisputa({ aposta: atual.aposta, gols: r.gols });
      else {
        setDisputa(null);
        setFim(
          r.estado === "completa"
            ? { texto: `5 gols! +${formatarMoedas(r.pagou - atual.aposta)} moedas`, bom: true }
            : { texto: `O goleiro pegou: −${atual.aposta} moedas`, bom: false },
        );
        void carregar();
      }
    } catch (e) {
      toast(msgDe(e, "Não deu para chutar. Confira a internet."));
    } finally {
      setOcupado(false);
    }
  };

  const sacar = async () => {
    if (ocupado || !disputa) return;
    setOcupado(true);
    try {
      const { data, error } = await sb().rpc("penalti_sacar");
      if (error) throw error;
      const d = data as { pagou: number; mult: number };
      setFim({ texto: `Você saiu com ${vezes(d.mult)}: +${formatarMoedas(d.pagou - disputa.aposta)} moedas`, bom: true });
      setDisputa(null);
      setLance(null);
      setPlaca(null);
      void carregar();
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

  const mergulho = lance ? ["esq", "meio", "dir"][lance.coluna] + (lance.alto ? " alto" : " baixo") : "";
  /* a bola: na marca, voando até o canto, dentro da rede ou espirrando para fora (para o lado do canto) */
  /* defendeu: a bola fica na luva do goleiro, que pulou exatamente naquele canto */
  const classeBola = !lance ? "" : lance.fase === "rebateu" ? ` z${lance.zona} pega` : ` z${lance.zona}`;
  const semSaldo = !disputa && saldo !== undefined && saldo < ficha;

  return (
    <div className="rm penalti">
      <button type="button" className="av-mudo" aria-pressed={mudo} aria-label={mudo ? "Ligar o som" : "Desligar o som"} onClick={trocarSom}>
        {mudo ? <IcSemSom /> : <IcVolume />}
      </button>

      {/* escada do multiplicador: um degrau por gol */}
      <ol className="pn-escada" aria-label="Multiplicador por gol">
        {Array.from({ length: MAX_GOLS }, (_, k) => k + 1).map((g) => (
          <li key={g} className={(g <= gols ? "feito" : "") + (disputa && g === gols + 1 ? " proximo" : "")}>
            <small>{g}º gol</small>
            {vezes(multPenalti(g))}
          </li>
        ))}
      </ol>

      <div className={"pn-campo" + (placa ? " " + placa : "")}>
        <div className="pn-torcida" aria-hidden="true" />
        <span className="pn-refletor e" aria-hidden="true" />
        <span className="pn-refletor d" aria-hidden="true" />
        <div className="pn-gramado" aria-hidden="true">
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none">
            <path d="M120 40 L880 40 L1000 300 M120 40 L0 300" className="pn-linha" />
            <path d="M300 40 L270 120 L730 120 L700 40" className="pn-linha" />
            <ellipse cx="500" cy="232" rx="9" ry="4" className="pn-marca" />
          </svg>
        </div>
        <div className="pn-gol">
          <div className="pn-rede" aria-hidden="true" />
          <div className="pn-trave" aria-hidden="true" />
          <div className={"pn-goleiro " + mergulho} aria-hidden="true">
            <Goleiro />
          </div>
          <div className="pn-zonas" role="group" aria-label="Escolha o canto do chute">
            {ZONAS.map((z) => (
              <button
                key={z}
                type="button"
                className={"pn-zona" + (lance?.zona === z ? " minha" : "")}
                disabled={ocupado || semSaldo}
                aria-label={`Chutar ${NOME_ZONA[z]}`}
                onClick={() => void chutar(z)}
              >
                {lance?.zona === z && lance.fase === "voando" && <span className="pn-mira" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
        <div className={"pn-bola" + classeBola} aria-hidden="true">
          <Bola />
        </div>
        <span className="pn-bola-sombra" aria-hidden="true" />
        {placa && (
          <div className={"pn-placa " + placa} aria-live="assertive">
            {placa === "gol" ? "GOL!" : "DEFENDEU!"}
          </div>
        )}
        {!lance && (
          <p className="pn-dica" aria-live="polite">
            {disputa ? `Escolha o canto do ${gols + 1}º chute` : "Escolha a ficha e toque num canto do gol"}
          </p>
        )}
      </div>

      <div className="av-grid">
        <div className="av-painel">
          {disputa ? (
            <>
              <p className="rm-rotulo">Sua disputa · aposta {disputa.aposta}</p>
              <p className="pn-agora">
                {gols ? (
                  <>
                    {gols} {gols === 1 ? "gol" : "gols"} · <b>{vezes(multPenalti(gols))}</b> = {formatarMoedas(Math.floor(disputa.aposta * multPenalti(gols)))} moedas
                  </>
                ) : (
                  "Toque num canto do gol: faça o gol para subir o multiplicador"
                )}
              </p>
              {gols > 0 && (
                <button type="button" className="av-sacar" disabled={ocupado} onClick={() => void sacar()}>
                  SACAR {formatarMoedas(Math.floor(disputa.aposta * multPenalti(gols)))} MOEDAS
                  <small>ou chute de novo para {vezes(multPenalti(gols + 1))}</small>
                </button>
              )}
            </>
          ) : (
            <>
              <p className="rm-rotulo">Sua aposta</p>
              <div className="rm-fichas" role="radiogroup" aria-label="Valor da aposta">
                {FICHAS.map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={ficha === v} className={ficha === v ? "sel" : undefined} onClick={() => setFicha(v)}>
                    <FichaVisual v={v} />
                  </button>
                ))}
              </div>
              <p className="pn-agora">{semSaldo ? "Sem moedas para essa ficha." : `Toque num canto do gol para apostar ${ficha} e chutar.`}</p>
            </>
          )}
          {fim && <p className={"av-res " + (fim.bom ? "bom" : "ruim")}>{fim.texto}</p>}
        </div>
        <div className="av-painel">
          <p className="rm-rotulo">Últimos chutes</p>
          <ol className="pn-ultimos" aria-label="Últimos chutes">
            {ultimos.length ? (
              ultimos.map((g, k) => (
                <li key={k} className={g ? "gol" : "defesa"} title={g ? "Gol" : "Defendeu"}>
                  {g ? "⚽" : "🧤"}
                </li>
              ))
            ) : (
              <li className="av-vazio">nenhum chute ainda</li>
            )}
          </ol>
          <p className="hint">O goleiro pula numa das 3 colunas (o banco sorteia na hora, com o mesmo motor justo do cassino): nas outras duas é gol.</p>
        </div>
      </div>
      <p className="hint rm-pe">
        Cada gol sobe o multiplicador; saque quando quiser ou vá até o 5º gol ({vezes(multPenalti(5))}). Se o goleiro pegar, você perde a aposta. A casa leva 3%.
      </p>
    </div>
  );
}
