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
import { entre, membro, type Ponto } from "./goleiro";
import { colunaDa, MAX_GOLS, multPenalti } from "./mesa";
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

/* ---------- o goleiro ---------- */
/* metade esquerda (a direita é o espelho): ombro, cotovelo, punho, palma; quadril, joelho, tornozelo */
const OMBRO: Ponto = [75, 62], COTOVELO: Ponto = [49, 90], PUNHO: Ponto = [41, 63], PALMA: Ponto = [38, 50];
const QUADRIL: Ponto = [87, 152], JOELHO: Ponto = [73, 195], TORNOZELO: Ponto = [70, 234];
const DEDOS: [Ponto, Ponto][] = [
  [[31, 46], [27, 32]],
  [[35, 42], [32.5, 27]],
  [[39.5, 41], [39, 26]],
  [[44, 43], [45.5, 30]],
];

function LadoGoleiro() {
  return (
    <>
      {/* perna: coxa, canela com o meião e a chuteira */}
      <path d={membro(QUADRIL, JOELHO, 13, 9)} fill="url(#pn-pele-vol)" />
      <path d={membro(JOELHO, TORNOZELO, 9, 6)} fill="url(#pn-pele-vol)" />
      <path d={membro(entre(JOELHO, TORNOZELO, 0.18), TORNOZELO, 8.6, 6.3)} fill="url(#pn-meiao)" />
      <path d="M57 231 Q69 226 81 233 L83 242 Q69 247 56 242 Z" className="pn-chuteira" />
      <path d="M59 243.5 L81 243.5" className="pn-chuteira-sola" />
      {/* braço de manga comprida: ombro, cotovelo e punho */}
      <path d={membro(OMBRO, COTOVELO, 9.5, 7)} fill="url(#pn-manga)" />
      <path d={membro(COTOVELO, PUNHO, 7, 5.6)} fill="url(#pn-manga)" />
      <path d={membro(entre(COTOVELO, PUNHO, 0.72), PUNHO, 6.2, 5.8)} className="pn-punho" />
      {/* luva aberta: dedão, palma e quatro dedos */}
      <path d={membro([45, 54], [52, 46], 3.2, 2.6)} fill="url(#pn-luva)" className="pn-luva" />
      <ellipse cx={PALMA[0]} cy={PALMA[1]} rx="9" ry="10.5" transform={`rotate(-12 ${PALMA[0]} ${PALMA[1]})`} fill="url(#pn-luva)" className="pn-luva" />
      {DEDOS.map(([a, b], k) => (
        <path key={k} d={membro(a, b, 2.9, 2.3)} fill="url(#pn-luva)" className="pn-luva" />
      ))}
      <path d="M31 56 Q38 60.5 46 56" className="pn-luva-faixa" />
    </>
  );
}

/** O goleiro de frente, na espera: pernas abertas e flexionadas, braços abertos, luvas para cima (o pulo é CSS). */
export function Goleiro() {
  return (
    <svg viewBox="0 0 200 250" className="pn-goleiro-svg">
      <defs>
        <linearGradient id="pn-camisa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="pn-st-camisa0" />
          <stop offset=".55" className="pn-st-camisa1" />
          <stop offset="1" className="pn-st-camisa2" />
        </linearGradient>
        <linearGradient id="pn-manga" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="pn-st-camisa0" />
          <stop offset=".6" className="pn-st-camisa1" />
          <stop offset="1" className="pn-st-camisa2" />
        </linearGradient>
        <linearGradient id="pn-pele-vol" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="pn-st-pele0" />
          <stop offset=".6" className="pn-st-pele1" />
          <stop offset="1" className="pn-st-pele2" />
        </linearGradient>
        <linearGradient id="pn-meiao" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="pn-st-camisa0" />
          <stop offset="1" className="pn-st-camisa2" />
        </linearGradient>
        <radialGradient id="pn-rosto" cx="40%" cy="35%" r="70%">
          <stop offset="0" className="pn-st-pele0" />
          <stop offset="1" className="pn-st-pele1" />
        </radialGradient>
        <linearGradient id="pn-luva" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="pn-st-luva0" />
          <stop offset="1" className="pn-st-luva1" />
        </linearGradient>
        <linearGradient id="pn-short" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="pn-st-calcao0" />
          <stop offset="1" className="pn-st-calcao1" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="243" rx="52" ry="6" className="pn-sombra" />
      <LadoGoleiro />
      <g transform="matrix(-1 0 0 1 200 0)">
        <LadoGoleiro />
      </g>
      {/* calção */}
      <path d="M76 134 L124 134 L131 170 Q116 175 104 170 L100 151 L96 170 Q84 175 69 170 Z" fill="url(#pn-short)" className="pn-calcao" />
      <path d="M77 140 L123 140" className="pn-calcao-cos" />
      {/* camisa: ombros largos afinando na cintura, painéis do lado mais escuros, gola e faixa no peito */}
      <path d="M72 56 Q100 46 128 56 Q135 80 129 104 Q125 122 123 138 L77 138 Q75 122 71 104 Q65 80 72 56 Z" fill="url(#pn-camisa)" className="pn-camisa" />
      <path d="M72 56 Q65 80 71 104 Q75 122 77 138 L85 138 Q80 100 81 59 Z" className="pn-camisa-lado" />
      <path d="M128 56 Q135 80 129 104 Q125 122 123 138 L115 138 Q120 100 119 59 Z" className="pn-camisa-lado" />
      <path d="M71 80 L129 72 L129.6 81 L71.4 89 Z" className="pn-listra" />
      <path d="M90 50.5 L100 61 L110 50.5" className="pn-gola" />
      <text x="100" y="124" className="pn-numero">1</text>
      {/* pescoço e cabeça */}
      <path d="M93 39 L107 39 L108 53 Q100 57 92 53 Z" className="pn-pescoco" />
      <path d="M93 47 Q100 51 107 47" className="pn-pescoco-sombra" />
      <ellipse cx="87.5" cy="28" rx="3" ry="4.3" className="pn-pele" />
      <ellipse cx="112.5" cy="28" rx="3" ry="4.3" className="pn-pele" />
      <ellipse cx="100" cy="26.5" rx="12.6" ry="15" fill="url(#pn-rosto)" className="pn-cabeca" />
      <path d="M87.3 24 Q85.5 8.5 100 7.5 Q114.5 8.5 112.7 24 Q110.5 15.5 100 15 Q89.5 15.5 87.3 24 Z" className="pn-cabelo" />
      <path d="M93 11 Q99 9.4 105 11" className="pn-cabelo-luz" />
      <path d="M91.6 22.6 Q94.6 21.2 97.6 22.4 M102.4 22.4 Q105.4 21.2 108.4 22.6" className="pn-sobrancelha" />
      <ellipse cx="95" cy="27" rx="2.6" ry="1.8" className="pn-olho-branco" />
      <ellipse cx="105" cy="27" rx="2.6" ry="1.8" className="pn-olho-branco" />
      <circle cx="95.3" cy="27.2" r="1.2" className="pn-olho" />
      <circle cx="105.3" cy="27.2" r="1.2" className="pn-olho" />
      <path d="M100 28.4 Q102.5 32.3 99.4 33.4" className="pn-nariz" />
      <path d="M95.8 36.4 Q100 38.6 104.2 36.4" className="pn-boca" />
    </svg>
  );
}

/** Bola de futebol (gomos pretos), girando durante o chute. */
export function Bola() {
  return (
    <svg viewBox="-20 -20 40 40" className="pn-bola-svg">
      <circle r="19" className="pn-bola-branca" />
      <path d="M0 -7 L6.7 -2.2 L4.1 5.7 L-4.1 5.7 L-6.7 -2.2 Z" className="pn-gomo" />
      <path d="M0 -19 L0 -7 M6.7 -2.2 L17 -6 M4.1 5.7 L10.5 15.8 M-4.1 5.7 L-10.5 15.8 M-6.7 -2.2 L-17 -6" className="pn-costura" />
      <path d="M-5 -18.3 L5 -18.3 L0 -13Z M17.6 -0.5 L14.3 9.5 L11 3Z M-17.6 -0.5 L-14.3 9.5 L-11 3Z" className="pn-gomo" />
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
  const classeBola = !lance ? "" : lance.fase === "rebateu" ? ` z${lance.zona} rebate r${colunaDa(lance.zona)}` : ` z${lance.zona}`;
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
