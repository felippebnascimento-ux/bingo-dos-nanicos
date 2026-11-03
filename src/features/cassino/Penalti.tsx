"use client";
/*
 * Pênalti ao vivo (aba Cassino, no lugar do Maior ou menor): todo mundo chuta na mesma rodada contra o goleiro da casa.
 * Aposta uma vez, escolhe o canto; o goleiro pula numa das 3 colunas (o banco sorteia uma vez para todos). Gol nas
 * outras duas: o multiplicador sobe (1,45× → 7,36× no 5º gol) e dá para sacar antes do próximo chute.
 * O banco decide tudo (penalti_entrar / penalti_chutar / penalti_sacar / mesa_estado); aqui só a cena e os botões.
 * A cena é ilustração (--pn-*): estádio, torcida, refletores, gol com rede, goleiro e bola.
 */
import { useEffect, useMemo, useState } from "react";
import { IcSemSom, IcVolume } from "@/components/ui/icones";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { toast } from "@/lib/toast";
import { local, reduzMovimento } from "@/lib/util";
import { msgDe } from "./estado";
import { colunaDa, conferirRodada, ehGol, faltam, JANELA_MS, MAX_GOLS, multPenalti, type Rodada } from "./mesa";
import { chamarMesa, useMesa } from "./mesaDados";
import { FICHAS } from "./regras";
import { FichaVisual, MesaStatus, useRelogio } from "./RoletaMesa";

const ZONAS = [0, 1, 2, 3, 4, 5];
const NOME_ZONA = ["alto à esquerda", "alto no meio", "alto à direita", "baixo à esquerda", "baixo no meio", "baixo à direita"];

/* ---------- sons (Web Audio) ---------- */
function apito(grave = false) {
  try {
    const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = "square";
    o.frequency.setValueAtTime(grave ? 520 : 2300, t);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (grave ? 0.5 : 0.25));
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.6);
    setTimeout(() => void ctx.close(), 900);
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

/** Um lado do goleiro (braço, luva, perna e chuteira); o outro lado é o espelho. */
function LadoGoleiro() {
  return (
    <>
      {/* perna: coxa, joelho flexionado, meião até a chuteira */}
      <path d="M66 112 L53 130" className="pn-coxa" />
      <path d="M53 130 L49 153" className="pn-canela" />
      <path d="M52.5 134 L51 141" className="pn-meia-faixa" />
      <path d="M38 152 Q48 145 60 151 L61 157 Q49 161 38 158 Z" className="pn-chuteira" />
      <path d="M42 156 L58 156" className="pn-chuteira-sola" />
      {/* braço aberto: ombro, cotovelo e punho, com a manga comprida */}
      <path d="M60 57 Q42 58 33 64 Q24 58 21 48" className="pn-braco" />
      <path d="M23.5 52 L19 50" className="pn-punho" />
      {/* luva aberta, dedos para cima */}
      <path
        d="M11 50 Q5 40 8 27 Q9.5 23 12 25 L13.5 34 L13.5 21 Q15 17 17.5 20 L18.5 33 L20 19.5 Q22 16 24.5 19.5 L24 33 L27 25.5 Q30 23 31 27 L28 41 Q27 50 19 52 Z"
        fill="url(#pn-luva)"
        className="pn-luva"
      />
      <path d="M12 46 Q19 49 26 45" className="pn-luva-faixa" />
    </>
  );
}

/** O goleiro de frente, agachado na espera, braços abertos (o pulo é CSS). */
function Goleiro() {
  return (
    <svg viewBox="0 0 160 168" className="pn-goleiro-svg">
      <defs>
        <linearGradient id="pn-camisa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="pn-st-camisa0" />
          <stop offset="1" className="pn-st-camisa1" />
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
      <ellipse cx="80" cy="161" rx="44" ry="5" className="pn-sombra" />
      <LadoGoleiro />
      <g transform="matrix(-1 0 0 1 160 0)">
        <LadoGoleiro />
      </g>
      {/* calção */}
      <path d="M57 96 L103 96 L107 117 L85 118 L80 109 L75 118 L53 117 Z" fill="url(#pn-short)" className="pn-calcao" />
      {/* camisa: ombros largos, corpo inclinado para a frente */}
      <path d="M57 52 Q80 43 103 52 L108 73 Q107 89 102 100 L58 100 Q53 89 52 73 Z" fill="url(#pn-camisa)" className="pn-camisa" />
      <path d="M53 66 L107 60 L107.6 67 L53.6 73 Z" className="pn-listra" />
      <path d="M58 100 Q53 89 52 73 L57 52 Q62 76 66 100 Z" className="pn-camisa-sombra" />
      <path d="M71 48.5 L80 58 L89 48.5" className="pn-gola" />
      <text x="80" y="93" className="pn-numero">1</text>
      {/* pescoço e cabeça */}
      <path d="M74 40 L86 40 L87 51 Q80 54 73 51 Z" className="pn-pescoco" />
      <ellipse cx="66.5" cy="31" rx="3" ry="4.2" className="pn-pele" />
      <ellipse cx="93.5" cy="31" rx="3" ry="4.2" className="pn-pele" />
      <ellipse cx="80" cy="29" rx="13" ry="15" fill="url(#pn-rosto)" className="pn-cabeca" />
      <path d="M67 27 Q65 12 80 11 Q95 12 93 27 Q91 19 80 18.5 Q69 19 67 27 Z" className="pn-cabelo" />
      <path d="M71.5 25.5 Q74.5 24 77.5 25.2 M82.5 25.2 Q85.5 24 88.5 25.5" className="pn-sobrancelha" />
      <ellipse cx="75" cy="29.8" rx="2.7" ry="1.9" className="pn-olho-branco" />
      <ellipse cx="85" cy="29.8" rx="2.7" ry="1.9" className="pn-olho-branco" />
      <circle cx="75.4" cy="30" r="1.25" className="pn-olho" />
      <circle cx="85.4" cy="30" r="1.25" className="pn-olho" />
      <path d="M80 31 Q82.6 35 79.4 36.2" className="pn-nariz" />
      <path d="M75.5 39.2 Q80 41.6 84.5 39.2" className="pn-boca" />
    </svg>
  );
}

/** Bola de futebol (gomos pretos), girando durante o chute. */
function Bola() {
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

type Chute = { id: number; zona: number | null; coluna: number; alto: boolean };

export function Penalti() {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const { estado, ligada, agora, recarregar } = useMesa("penalti");
  const [ficha, setFicha] = useState(10);
  const [ocupado, setOcupado] = useState(false);
  const [mudo, setMudo] = useState(() => local.get("roleta-som") === "0");
  /* depois do voo da bola: mostra GOL! ou DEFENDEU! (da rodada `id`) */
  const [placaDe, setPlacaDe] = useState<{ id: number; tipo: "gol" | "defendeu" } | null>(null);
  const [conferida, setConferida] = useState<string | null>(null);
  useRelogio(true);

  const r: Rodada | null = estado?.rodada ?? null;
  const fase = estado?.fase ?? "parada";
  const meu = estado?.meu ?? null;
  const naDisputa = meu?.estado === "ativa";
  const gols = naDisputa ? Number(meu?.gols) || 0 : 0;
  const minhaZona = naDisputa && meu?.zona != null ? Number(meu.zona) : null;
  const minhaAposta = Number(meu?.aposta) || 0;
  const segundos = r && fase === "apostas" ? faltam(r.fechaEm, agora()) : 0;
  const res = r?.resultado && typeof r.resultado.coluna === "number" ? r.resultado : null;

  /* o banco mostrou onde o goleiro pula: a bola vai para o meu canto (ou o de alguém da rodada) e ele pula.
     Com o chute novo aberto (ou a mesa parada), a bola volta para a marca. */
  const rid = r?.id ?? null;
  const emCampo = fase === "jogo" || fase === "resultado";
  const zonaDoChute = estado?.gente.find((p) => p.eu)?.zona ?? estado?.gente.find((p) => p.zona != null)?.zona ?? null;
  const colunaGk = res ? Number(res.coluna) : null;
  const altoGk = res?.alto === true;
  const chute: Chute | null = useMemo(
    () => (rid !== null && colunaGk !== null && emCampo ? { id: rid, zona: zonaDoChute, coluna: colunaGk, alto: altoGk } : null),
    [rid, colunaGk, altoGk, emCampo, zonaDoChute],
  );
  const placa = placaDe && chute && placaDe.id === chute.id ? placaDe.tipo : null;
  const chuteId = chute?.id ?? null;
  useEffect(() => {
    if (chuteId === null || colunaGk === null) return;
    if (!mudo) apito();
    const t = setTimeout(() => {
      const gol = zonaDoChute != null ? ehGol(zonaDoChute, colunaGk) : null;
      if (gol === null) return;
      setPlacaDe({ id: chuteId, tipo: gol ? "gol" : "defendeu" });
      if (!mudo) torcida(gol);
    }, reduzMovimento() ? 0 : 1150);
    return () => clearTimeout(t);
    // uma vez por chute (o som e a zona são lidos na hora)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chuteId]);

  const tocarZona = async (z: number) => {
    if (ocupado || fase === "jogo") return;
    setOcupado(true);
    try {
      if (naDisputa) await chamarMesa("penalti_chutar", { p_zona: z });
      else await chamarMesa("penalti_entrar", { p_aposta: ficha, p_zona: z });
      setConferida(null);
      await recarregar();
    } catch (e) {
      toast(msgDe(e, "Não deu para chutar. Confira a internet."));
    } finally {
      setOcupado(false);
    }
  };

  const sacar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const d = await chamarMesa("penalti_sacar", {});
      toast(`+${formatarMoedas(Number(d.pagou))} moedas: saiu com ${String(Number(d.mult).toFixed(2)).replace(".", ",")}×`);
      await recarregar();
    } catch (e) {
      toast(msgDe(e, "Não deu para sacar. Confira a internet."));
    } finally {
      setOcupado(false);
    }
  };

  const conferirEsta = async () => {
    if (!r) return;
    const c = await conferirRodada("penalti", r);
    if (!c) return;
    const col = Math.floor(c.u * 3);
    setConferida(`${c.hashOk ? "O segredo bate com o hash" : "O segredo NÃO bate com o hash"} · a conta dá a coluna ${col + 1}${res && col === Number(res.coluna) ? ", igual à do goleiro" : ", DIFERENTE da do goleiro"}`);
  };

  const trocarSom = () => {
    setMudo(!mudo);
    local.set("roleta-som", mudo ? "1" : "0");
  };

  if (ligada === false) return <p className="block hint">O pênalti ao vivo ainda não foi ligado no banco (seção 32 do seguranca.sql).</p>;

  const podeEscolher = fase !== "jogo" && (naDisputa || !meu || meu.estado !== "ativa");
  const semSaldo = !naDisputa && saldo !== undefined && saldo < ficha;
  const mergulho = chute ? ["esq", "meio", "dir"][chute.coluna] + (chute.alto ? " alto" : " baixo") : "";
  const alvo = chute?.zona ?? null;

  return (
    <div className="rm penalti">
      <button type="button" className="av-mudo" aria-pressed={mudo} aria-label={mudo ? "Ligar o som" : "Desligar o som"} onClick={trocarSom}>
        {mudo ? <IcSemSom /> : <IcVolume />}
      </button>
      <MesaStatus jogo="penalti" fase={fase} rodada={r} agora={agora()} gente={estado?.gente.filter((p) => p.estado === "ativa").length ?? 0} />

      {/* escada do multiplicador: um degrau por gol */}
      <ol className="pn-escada" aria-label="Multiplicador por gol">
        {Array.from({ length: MAX_GOLS }, (_, k) => k + 1).map((g) => (
          <li key={g} className={(naDisputa && g <= gols ? "feito" : "") + (naDisputa && g === gols + 1 ? " proximo" : "")}>
            <small>{g}º gol</small>
            {multPenalti(g).toFixed(2).replace(".", ",")}×
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
            {ZONAS.map((z) => {
              const escolhida = minhaZona === z;
              const outros = estado?.gente.filter((p) => !p.eu && p.zona === z).length ?? 0;
              return (
                <button
                  key={z}
                  type="button"
                  className={"pn-zona" + (escolhida ? " minha" : "") + (chute && colunaDa(z) === chute.coluna ? " defendida" : "")}
                  disabled={!podeEscolher || ocupado || semSaldo}
                  aria-pressed={escolhida}
                  aria-label={`Chutar ${NOME_ZONA[z]}`}
                  onClick={() => void tocarZona(z)}
                >
                  {escolhida && <span className="pn-mira" aria-hidden="true" />}
                  {outros > 0 && <small className="pn-outros">{outros}</small>}
                </button>
              );
            })}
          </div>
        </div>
        <div className={"pn-bola" + (alvo !== null ? " z" + alvo : chute ? " fora" : "")} aria-hidden="true">
          <Bola />
        </div>
        <span className="pn-bola-sombra" aria-hidden="true" />
        {placa && (
          <div className={"pn-placa " + placa} aria-live="assertive">
            {placa === "gol" ? "GOL!" : "DEFENDEU!"}
          </div>
        )}
        {!chute && (
          <p className="pn-dica" aria-live="polite">
            {fase === "apostas"
              ? naDisputa
                ? minhaZona === null
                  ? `Escolha o canto · ${segundos} s`
                  : `Chute ${NOME_ZONA[minhaZona]} · troca até ${segundos} s`
                : `Rodada aberta: escolha o canto para entrar · ${segundos} s`
              : naDisputa
                ? "Próximo chute já vai abrir"
                : "Escolha a ficha e toque num canto do gol para começar"}
          </p>
        )}
      </div>

      <div className="av-grid">
        <div className="av-painel">
          {naDisputa ? (
            <>
              <p className="rm-rotulo">Sua disputa · aposta {minhaAposta}</p>
              <p className="pn-agora">
                {gols ? (
                  <>
                    {gols} {gols === 1 ? "gol" : "gols"} · <b>{multPenalti(gols).toFixed(2).replace(".", ",")}×</b> = {formatarMoedas(Math.floor(minhaAposta * multPenalti(gols)))} moedas
                  </>
                ) : (
                  "Primeiro chute: faça o gol para subir o multiplicador"
                )}
              </p>
              {gols > 0 && (
                <button type="button" className="av-sacar" disabled={ocupado || fase === "jogo"} onClick={() => void sacar()}>
                  SACAR {formatarMoedas(Math.floor(minhaAposta * multPenalti(gols)))} MOEDAS
                  <small>ou chute de novo para {multPenalti(gols + 1).toFixed(2).replace(".", ",")}×</small>
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
              {meu && meu.estado !== "ativa" && (
                <p className={"av-res " + (Number(meu.pagou) > 0 ? "bom" : "ruim")}>
                  {meu.estado === "perdeu"
                    ? `O goleiro pegou: −${minhaAposta} moedas`
                    : meu.estado === "completa"
                      ? `5 gols! +${formatarMoedas(Number(meu.pagou) - minhaAposta)} moedas`
                      : `Você saiu com +${formatarMoedas(Number(meu.pagou) - minhaAposta)} moedas`}
                </p>
              )}
            </>
          )}
          {r && (
            <p className="rm-justo">
              Chute #{r.id} · hash <span className="hash">{r.hash.slice(0, 12)}…</span>
              {r.segredo && (
                <button type="button" className="linkish" onClick={() => void conferirEsta()}>
                  Conferir
                </button>
              )}
              {conferida && <small>{conferida}</small>}
            </p>
          )}
        </div>
        <div className="av-painel">
          <p className="rm-rotulo">Batedores</p>
          <ul className="av-mesa">
            {estado?.gente.length ? (
              estado.gente.map((p, k) => (
                <li key={k} className={p.eu ? "eu" : undefined}>
                  <span className="av-av" aria-hidden="true">
                    {p.nome[0]}
                  </span>
                  <span className="av-nome">
                    {p.nome}
                    {p.eu ? " (você)" : ""} · {p.aposta}
                  </span>
                  {p.estado === "perdeu" ? (
                    <b className="ruim">🧤 defendeu</b>
                  ) : p.estado === "sacou" || p.estado === "completa" ? (
                    <b className="ok">saiu · +{formatarMoedas(p.pagou - p.aposta)}</b>
                  ) : p.gol === true ? (
                    <b className="ok">⚽ GOL · {Number(p.mult).toFixed(2).replace(".", ",")}×</b>
                  ) : p.chutou ? (
                    <b className="voa">chutou</b>
                  ) : (
                    <b className="voa">
                      {p.gols ? `${Number(p.mult).toFixed(2).replace(".", ",")}× · ` : ""}escolhendo…
                    </b>
                  )}
                </li>
              ))
            ) : (
              <li className="av-vazio">Ninguém na marca ainda. O primeiro chute abre a rodada para todo mundo.</li>
            )}
          </ul>
        </div>
      </div>
      <p className="hint rm-pe">
        Mesa ao vivo: a primeira aposta abre a rodada e todo mundo tem {JANELA_MS.penalti / 1000} s para escolher o canto. O goleiro pula numa das 3 colunas: nas outras duas é gol. Cada gol sobe o multiplicador; saque quando quiser ou vá até o 5º gol ({multPenalti(5).toFixed(2).replace(".", ",")}×). Sem escolher a tempo, você sai com o que tem. A casa leva 3%.
      </p>
    </div>
  );
}
