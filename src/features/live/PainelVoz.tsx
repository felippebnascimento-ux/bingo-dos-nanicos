"use client";
/*
 * Painel da voz como no Discord, fixo embaixo do menu:
 * - "Voz conectada" com o sinal (ping), a supressão de ruído e o desligar; embaixo, câmera, transmitir a tela,
 *   reações e as câmeras numa janela flutuante;
 * - enquanto transmito, a miniatura da minha tela com AO VIVO, quantos assistem, a qualidade e o Parar;
 * - na linha "eu", o microfone e o fone com a setinha (aparelho, barrinha de teste, ruído, eco, volume da voz);
 * - as janelas de escolher a transmissão (o que mostrar, resolução, fps, som do PC) e a prévia da câmera.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  IcAjustes,
  IcSemSom,
  IcCamera,
  IcDesligar,
  IcFone,
  IcFoneDesligado,
  IcJanela,
  IcMic,
  IcMicDesligado,
  IcOlho,
  IcOndas,
  IcReagir,
  IcSeta,
  IcSinal,
  IcTela,
} from "@/components/ui/icones";
import { listarAparelhos, podeEscolherSaida, restricoesCam, salvarMidia, useMidia, type Dispositivo } from "@/features/config/midia";
import { entrarSala, nomeDaSala } from "@/features/salas/trocar";
import { setApp, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local } from "@/lib/util";
import { activeCams, aplicarDesfoque, CAM, mudarDesfoque, openCamPip, podeDesfocar, querDesfoque, startCam, stopCam } from "./camera";
import { setLive, useLive, type Fps, type Mostrar, type Res } from "./estado";
import { REACOES, REACOES_FOTO, reagir } from "./reacoes";
import { canCam, canShare, chromeVer, isChromium, isMac } from "./rtc";
import { LIVE, startLive, stopLive } from "./tela";
import { VideoMudo } from "./Video";
import { mandarSom, SONS } from "./soundboard";
import { ajustarVoz, alternarMudo, alternarSurdo, entrarVoz, limiarDaSensib, mudarModoVoz, nivelBruto, nivelDoMeuMic, nomeDaTecla, sinalDaVoz, useAjustesVoz, useModoVoz, useVoz } from "./voz";

/* ---------- balão que abre por cima (ou por baixo, no celular, onde o menu fica no alto) ---------- */
export type Lugar = { left: number; top?: number; bottom?: number };
/** Onde abrir o balão, a partir do botão que foi tocado. */
export function lugarDe(el: HTMLElement | DOMRect, largura = 280): Lugar {
  const r = el instanceof HTMLElement ? el.getBoundingClientRect() : el;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8));
  return r.top > window.innerHeight / 2 ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top: r.bottom + 8 };
}

/** Onde pôr balões e janelas: no corpo da página ou, com o Ao vivo em tela cheia, dentro dela (senão não aparecem). */
export const alvoPortal = () => (document.fullscreenElement as HTMLElement | null) ?? document.body;

export function Balao({
  lugar,
  fechar,
  rotulo,
  children,
  className = "",
  ancora = null,
}: {
  lugar: Lugar;
  fechar: () => void;
  rotulo: string;
  children: ReactNode;
  className?: string;
  /** o botão que abriu: tocar nele de novo fecha pelo próprio onClick dele */
  ancora?: HTMLElement | null;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    /* fecha ao tocar fora (inclusive em outro botão de balão, então nunca ficam dois abertos) ou com Esc */
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (caixa.current && !caixa.current.contains(alvo) && !(ancora && ancora.contains(alvo))) fechar();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [fechar, ancora]);
  return createPortal(
    <div ref={caixa} className={"vz-balao " + className} role="dialog" aria-label={rotulo} style={{ left: lugar.left, top: lugar.top, bottom: lugar.bottom }}>
      {children}
    </div>,
    alvoPortal(),
  );
}

/** Abre e fecha um balão preso a um botão. */
export function useBalao() {
  const [aberto, setAberto] = useState<{ lugar: Lugar; el: HTMLElement } | null>(null);
  const alternar = (e: React.MouseEvent<HTMLElement>, largura?: number) => {
    const el = e.currentTarget;
    setAberto((a) => (a ? null : { lugar: lugarDe(el, largura), el }));
  };
  const fechar = useCallback(() => setAberto(null), []);
  return { lugar: aberto?.lugar ?? null, ancora: aberto?.el ?? null, alternar, fechar };
}

/** Janela no meio da tela, com fundo escuro (Esc ou tocar fora fecha). */
function Janela({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [fechar]);
  return createPortal(
    <div className="vz-fundo" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="vz-janela" role="dialog" aria-modal="true" aria-label={titulo}>
        <h3>{titulo}</h3>
        {children}
      </div>
    </div>,
    alvoPortal(),
  );
}

export function Chave({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} className={"vz-item vz-chave" + (ligado ? " on" : "")} onClick={() => onChange(!ligado)}>
      <span>{rotulo}</span>
      <i aria-hidden="true" />
    </button>
  );
}

/* ---------- sinal (as barrinhas) ---------- */
function corDoPing(ping: number | null) {
  if (ping === null) return "";
  return ping < 120 ? " bom" : ping < 250 ? " medio" : " ruim";
}

function Sinal() {
  const b = useBalao();
  const [hist, setHist] = useState<number[]>([]);
  const [info, setInfo] = useState<{ ping: number | null; perda: number | null; n: number }>({ ping: null, perda: null, n: 0 });
  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      const s = await sinalDaVoz();
      if (!vivo) return;
      setInfo(s);
      if (s.ping !== null) setHist((h) => [...h.slice(-11), s.ping as number]);
    };
    void ler();
    const t = setInterval(ler, b.lugar ? 1500 : 5000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [b.lugar]);
  const max = Math.max(150, ...hist);
  return (
    <>
      <button type="button" className={"vz-sinal" + corDoPing(info.ping)} aria-label="Ver como está a conexão da voz" data-dica="Conexão da voz" data-dica-ini="" onClick={(e) => b.alternar(e, 240)}>
        <IcSinal tam={18} />
      </button>
      {b.lugar && (
        <Balao lugar={b.lugar} ancora={b.ancora} fechar={b.fechar} rotulo="Conexão da voz" className="vz-ping">
          <div className="vz-ping-l">
            <span>Ping médio</span>
            <b>{info.ping === null ? "—" : `${info.ping} ms`}</b>
          </div>
          <div className="vz-grafico" aria-hidden="true">
            {hist.map((v, i) => (
              <i key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
            ))}
          </div>
          <div className="vz-ping-l">
            <span>Pacotes perdidos</span>
            <b>{info.perda === null ? "—" : `${info.perda.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</b>
          </div>
          <div className="vz-ping-l">
            <span>Conectado com</span>
            <b>{info.n === 0 ? "ninguém ainda" : info.n === 1 ? "1 nanico" : `${info.n} nanicos`}</b>
          </div>
        </Balao>
      )}
    </>
  );
}

/* ---------- reações (emojis na live que estou vendo) ---------- */
export function BotaoReacoes() {
  const b = useBalao();
  useLive((s) => s.v);
  const vendo = !!LIVE.main;
  return (
    <>
      <button type="button" className={"vz-acao" + (b.lugar ? " aberta" : "")} aria-label="Reações" data-dica="Reações" onClick={(e) => b.alternar(e, 250)}>
        <IcReagir tam={20} />
      </button>
      {b.lugar && (
        <Balao lugar={b.lugar} ancora={b.ancora} fechar={b.fechar} rotulo="Reações" className="vz-reacoes">
          {vendo ? (
            <div className="vz-emojis">
              {REACOES.map((e, i) => (
                <button key={e} type="button" aria-label={`Reagir com ${e}`} onClick={() => reagir(i)}>
                  {e}
                </button>
              ))}
              {REACOES_FOTO.map((r, j) => (
                <button key={r.nome} type="button" aria-label={`Reagir com ${r.nome}`} onClick={() => reagir(REACOES.length + j)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.mini} alt="" />
                </button>
              ))}
            </div>
          ) : (
            <p className="vz-dica">Assista a tela de alguém para mandar reações. Elas voam na tela de todo mundo que está vendo.</p>
          )}
        </Balao>
      )}
    </>
  );
}

/* ---------- soundboard (sons curtos que todo mundo da voz ouve) ---------- */
function BotaoSoundboard() {
  const b = useBalao();
  return (
    <>
      <button type="button" className={"vz-acao" + (b.lugar ? " aberta" : "")} aria-label="Soundboard" data-dica="Soundboard" onClick={(e) => b.alternar(e, 250)}>
        <IcSoundboard />
      </button>
      {b.lugar && (
        <Balao lugar={b.lugar} ancora={b.ancora} fechar={b.fechar} rotulo="Soundboard" className="vz-sb">
          <h4>Soundboard</h4>
          <div className="vz-sb-lista">
            {SONS.map((x) => (
              <button key={x.id} type="button" onClick={() => mandarSom(x.id)}>
                <span aria-hidden="true">{x.emoji}</span>
                {x.nome}
              </button>
            ))}
          </div>
          <p className="vz-dica">Todo mundo na voz ouve.</p>
        </Balao>
      )}
    </>
  );
}
const IcSoundboard = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

/** Há quanto tempo estou na call (como no Discord, embaixo do "Voz conectada"). */
export function TempoCall({ desde }: { desde: number | null }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!desde) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [desde]);
  if (!desde) return null;
  return <span className="vz-tempo"> · {duracao(Math.max(0, agora - desde))}</span>;
}
export const duracao = (ms: number) => {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
  const dd = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${dd(m)}:${dd(x)}` : `${dd(m)}:${dd(x)}`;
};

/** Como o microfone abre: detecção de voz (com a sensibilidade) ou apertar para falar, como no Discord. */
export function ModoEntrada() {
  const m = useModoVoz();
  const [gravando, setGravando] = useState(false);
  const barra = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let id = 0;
    const anda = () => {
      /* a barra em escala de 0 a 0.066 (o limiar máximo), para combinar com a marca da sensibilidade */
      if (barra.current) barra.current.style.transform = `scaleX(${Math.min(1, nivelBruto() / 0.066)})`;
      id = requestAnimationFrame(anda);
    };
    id = requestAnimationFrame(anda);
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!gravando) return;
    const pega = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code !== "Escape") mudarModoVoz({ tecla: e.code });
      setGravando(false);
    };
    addEventListener("keydown", pega, { once: true, capture: true });
    return () => removeEventListener("keydown", pega, { capture: true });
  }, [gravando]);
  return (
    <div className="vz-modo">
      <h4>Modo de entrada</h4>
      <div role="radiogroup" aria-label="Modo de entrada">
        {(["voz", "ptt"] as const).map((x) => (
          <button key={x} type="button" role="radio" aria-checked={m.modo === x} className={"vz-item" + (m.modo === x ? " sel" : "")} onClick={() => mudarModoVoz({ modo: x })}>
            <span>{x === "voz" ? "Detecção de voz" : "Apertar para falar"}</span>
            <i className="vz-radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      {m.modo === "ptt" ? (
        <div className="vz-ptt">
          <span>Tecla</span>
          <button type="button" className={"btn soft sm" + (gravando ? " on" : "")} onClick={() => setGravando(true)}>
            {gravando ? "Aperte uma tecla…" : nomeDaTecla(m.tecla)}
          </button>
          <p className="vz-dica">Segure para falar. Só funciona com o site na frente (o navegador não deixa ouvir teclas de outros programas).</p>
        </div>
      ) : (
        <label className="vz-sensib">
          <span>
            Sensibilidade <b>{m.sensib <= 0 ? "sempre aberto" : `${Math.round(m.sensib * 100)}%`}</b>
          </span>
          <span className="vz-sensib-trilho" style={{ "--marca": `${(limiarDaSensib(m.sensib) / 0.066) * 100}%` } as React.CSSProperties}>
            <span ref={barra} className="vz-sensib-nivel" />
          </span>
          <input aria-label="Sensibilidade do microfone" type="range" min={0} max={100} value={Math.round(m.sensib * 100)} onChange={(e) => mudarModoVoz({ sensib: Number(e.target.value) / 100 })} />
          <small className="vz-dica">Fale: o microfone só abre quando a barra passa da marca. Em 0, fica sempre aberto.</small>
        </label>
      )}
      <p className="vz-dica">Atalhos: Ctrl+Shift+M liga e desliga o microfone; Ctrl+Shift+D, o som.</p>
    </div>
  );
}

/* como mandar o som do jogo: depende do navegador e do sistema */
function ComoSom() {
  if (!isChromium)
    return (
      <li>
        Este navegador não manda som. Para transmitir com o som do jogo, use o <b>Chrome</b> ou o <b>Edge</b>.
      </li>
    );
  if (isMac)
    return (
      <>
        <li>
          Na janela que abrir, escolha <b>Tela inteira</b> e ligue <b>Compartilhar áudio do sistema</b>.
        </li>
        <li>
          No Mac isso só aparece no Chrome 141 ou mais novo e no macOS 14.2 ou mais novo
          {chromeVer && chromeVer < 141 ? ` (o seu Chrome é o ${chromeVer}: atualize em Ajuda › Sobre o Google Chrome)` : ""}.
        </li>
      </>
    );
  return (
    <>
      <li>
        Na janela que abrir, escolha <b>Tela inteira</b> e ligue <b>Compartilhar áudio do sistema</b> (fica embaixo, à
        esquerda).
      </li>
      <li>
        Se escolher só a <b>janela</b> do jogo, o som pode não ir junto, dependendo da versão do navegador.
      </li>
    </>
  );
}

/* transmitindo sem som: diz o que fazer, conforme o que a pessoa escolheu */
function SemSom() {
  if (!isChromium) return <>Sem som: este navegador não transmite áudio. Use o Chrome ou o Edge.</>;
  const s = LIVE.surface;
  if (s === "window")
    return (
      <>
        Sem som: você escolheu uma janela e o navegador não mandou o som dela. Transmita de novo escolhendo{" "}
        <b>Tela inteira</b> com <b>Compartilhar áudio do sistema</b> ligado.
      </>
    );
  if (s === "browser")
    return (
      <>
        Sem som: ao escolher uma aba, ligue <b>Compartilhar áudio da guia</b>.
      </>
    );
  if (isMac)
    return (
      <>
        Sem som: escolha <b>Tela inteira</b> e ligue <b>Compartilhar áudio do sistema</b>. No Mac isso precisa do
        Chrome 141+ e do macOS 14.2+{chromeVer && chromeVer < 141 ? ` (o seu Chrome é o ${chromeVer})` : ""}.
      </>
    );
  return (
    <>
      Sem som: a opção <b>Compartilhar áudio do sistema</b> estava desligada. Transmita de novo e ligue essa opção (fica
      embaixo, à esquerda, na janela de escolher a tela).
    </>
  );
}

/* ---------- a minha transmissão (miniatura, quem assiste, qualidade, parar) ---------- */
const NOME_SUPERFICIE: Record<string, string> = { monitor: "Tela inteira", window: "Janela", browser: "Aba" };

function MinhaTransmissao() {
  useLive((s) => s.v);
  const somPc = useLive((s) => s.somPc);
  const meu = useApp((s) => s.myLiveSid);
  /* a prévia da minha tela começa aberta; esconder fica lembrado */
  const [grande, setGrandeEstado] = useState(() => local.get("vz-previa") !== "0");
  const setGrande = (f: (g: boolean) => boolean) =>
    setGrandeEstado((g) => {
      const n = f(g);
      local.set("vz-previa", n ? "1" : "0");
      return n;
    });
  if (!meu || !LIVE.myStream) return null;
  const n = [...LIVE.viewers.values()].filter((v) => v.pc.connectionState === "connected").length;
  const st = LIVE.myStream.getVideoTracks()[0]?.getSettings();
  /* curto, como o Discord (1440p60) */
  const qual = st?.height ? `${st.height}p${st.frameRate ? Math.round(st.frameRate) : ""}` : "";
  const semSom = somPc && !LIVE.hasAudio;
  /* como no Discord: uma linha com a miniatura, o que está indo e quem assiste; a prévia grande só se pedir */
  return (
    <div className="vz-live">
      <div className="vz-live-cab">
        {/* tocar no texto mostra (ou esconde) a prévia da sua tela */}
        <button
          type="button"
          className="vz-live-txt"
          aria-expanded={grande}
          aria-label={`Ao vivo, ${NOME_SUPERFICIE[LIVE.surface] ?? "tela"}, ${n} assistindo. ${grande ? "Esconder" : "Ver"} a prévia`}
          data-dica={grande ? "Esconder a prévia" : "Ver a prévia"}
          data-dica-ini=""
          onClick={() => setGrande((g) => !g)}
        >
          <b>
            <span className="vz-ponto" aria-hidden="true" />
            Ao vivo
            <span className="vz-olhos-txt" aria-label={n === 1 ? "1 pessoa assistindo" : `${n} pessoas assistindo`}>
              <IcOlho tam={12} />
              {n}
            </span>
          </b>
          <small>
            {NOME_SUPERFICIE[LIVE.surface] ?? "Tela"}
            {qual && ` · ${qual}`}
            <TempoCall desde={LIVE.desde} />
          </small>
        </button>
        <button type="button" className="vz-ib" aria-label="Trocar a qualidade da transmissão" data-dica="Qualidade" data-dica-fim="" onClick={() => setLive({ janelaTela: true })}>
          <IcAjustes tam={18} />
        </button>
        <button type="button" className="vz-ib vz-parar-ic" aria-label="Parar a transmissão" data-dica="Parar a transmissão" data-dica-fim="" onClick={stopLive}>
          <IcTelaParar />
        </button>
      </div>
      {grande && (
        <div className="vz-previa">
          <VideoMudo stream={LIVE.myStream} />
        </div>
      )}
      {/* pediu o som do PC e ele não veio: uma linha, e "Corrigir" abre a janela (que explica o que fazer) */}
      {semSom && (
        <div className="vz-semsom">
          <IcSemSom tam={15} />
          <span>Sem som do PC</span>
          <button type="button" className="vz-corrigir" onClick={() => setLive({ janelaTela: true })}>
            Corrigir
          </button>
        </div>
      )}
    </div>
  );
}

/* tela com um X: parar a transmissão */
const IcTelaParar = () => (
  <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M8 21h8M12 17v4M9.5 8.5l5 5M14.5 8.5l-5 5" />
  </svg>
);

/** Botão da tela: transmitindo, para; senão abre a janela de escolher a transmissão. */
export function botaoTela() {
  if (LIVE.mySid) return stopLive();
  if (!canShare) return toast("Transmitir só funciona no navegador do computador.");
  setLive({ janelaTela: true });
}
/** Botão da câmera: ligada, desliga; senão abre a prévia (ligar é lá). */
export function botaoCamera() {
  if (CAM.stream) return stopCam();
  if (!canCam) return toast("Seu navegador não liberou a câmera.");
  setLive({ previaCam: true });
}

/* ---------- o painel ---------- */
/**
 * Painel de quem está numa sala: voz conectada (como no Discord) ou o convite para entrar na voz.
 * Desligar é sair da sala (encerra a voz, a tela e a câmera e volta para o lobby).
 */
export function VozPainel() {
  useLive((s) => s.v);
  const minhaSala = useApp((s) => s.minhaSala);
  const salas = useApp((s) => s.salas);
  const voz = useApp((s) => s.myVozSid);
  const cam = useApp((s) => !!s.myCamSid);
  const live = useApp((s) => !!s.myLiveSid);
  const ruido = useMidia((s) => s.ruido);
  const desde = useVoz((s) => s.desde);
  const nome = nomeDaSala(minhaSala, salas);
  if (!minhaSala || !nome) return null;
  const sair = (
    <button type="button" className="vz-ib sair" aria-label={`Desligar e sair da ${nome}`} data-dica="Desconectar" data-dica-fim="" onClick={() => entrarSala(null)}>
      <IcDesligar tam={22} />
    </button>
  );
  if (!voz)
    return (
      <div className="vz">
        {live && <MinhaTransmissao />}
        <div className="vz-topo">
          <span className="vz-info">
            <b className="fora">Na sala, fora da voz</b>
            <small>{nome}</small>
          </span>
          <button type="button" className="btn sm" onClick={entrarVoz}>
            Entrar na voz
          </button>
          {sair}
        </div>
      </div>
    );
  const nCams = activeCams().length;
  return (
    <>
      <div className="vz on">
        {live && <MinhaTransmissao />}
        <div className="vz-topo">
          <Sinal />
          <span className="vz-info">
            <b>Voz conectada</b>
            <small>
              {nome}
              <TempoCall desde={desde} />
            </small>
          </span>
          <button
            type="button"
            className={"vz-ib" + (ruido ? " on" : "")}
            aria-pressed={ruido}
            aria-label={ruido ? "Desligar a supressão de ruído" : "Ligar a supressão de ruído"}
            data-dica="Supressão de ruído"
            data-dica-fim=""
            onClick={() => salvarMidia({ ruido: !ruido })}
          >
            <IcOndas tam={20} />
          </button>
          {sair}
        </div>
        <div className="vz-acoes">
          <button type="button" className={"vz-acao" + (cam ? " on" : "")} aria-pressed={cam} aria-label={cam ? "Desligar a câmera" : "Ligar a câmera"} data-dica={cam ? "Desligar a câmera" : "Ligar a câmera"} data-dica-ini="" onClick={botaoCamera}>
            <IcCamera tam={20} />
          </button>
          {(canShare || live) && (
            <button type="button" className={"vz-acao" + (live ? " ao-vivo" : "")} aria-pressed={live} aria-label={live ? "Parar a transmissão" : "Transmitir a tela"} data-dica={live ? "Parar a transmissão" : "Transmitir a tela"} onClick={botaoTela}>
              <IcTela tam={20} />
            </button>
          )}
          <BotaoReacoes />
          <BotaoSoundboard />
          <button
            type="button"
            className="vz-acao"
            aria-label="Abrir as câmeras numa janela flutuante"
            data-dica={nCams ? "Câmeras numa janela" : "Ninguém com câmera"}
            data-dica-fim=""
            disabled={!nCams}
            onClick={() => openCamPip(null)}
          >
            <IcJanela tam={20} />
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------- microfone e fone na linha "eu" ---------- */
function ListaAparelhos({ lista, valor, onChange, rotulo }: { lista: Dispositivo[]; valor: string; onChange: (id: string) => void; rotulo: string }) {
  /* aparelho salvo que sumiu: vale o padrão */
  const atual = lista.some((d) => d.id === valor) ? valor : "";
  const todos = [{ id: "", nome: "Padrão do sistema" }, ...lista];
  return (
    <div role="radiogroup" aria-label={rotulo}>
      {todos.map((d) => (
        <button key={d.id || "padrao"} type="button" role="radio" aria-checked={atual === d.id} className={"vz-item" + (atual === d.id ? " sel" : "")} onClick={() => onChange(d.id)}>
          <span>{d.nome}</span>
          <i className="vz-radio" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function MenuMic({ lugar, ancora, fechar }: { lugar: Lugar; ancora: HTMLElement | null; fechar: () => void }) {
  const m = useMidia();
  const barra = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    void listarAparelhos();
    let id = 0;
    const anda = () => {
      if (barra.current) barra.current.style.transform = `scaleX(${nivelDoMeuMic()})`;
      id = requestAnimationFrame(anda);
    };
    id = requestAnimationFrame(anda);
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Balao lugar={lugar} ancora={ancora} fechar={fechar} rotulo="Opções do microfone">
      <h4>Microfone</h4>
      <ListaAparelhos rotulo="Microfone" lista={m.mics} valor={m.mic} onChange={(mic) => salvarMidia({ mic })} />
      <div className="vz-medidor" aria-label="Fale para testar o microfone">
        <span ref={barra} />
      </div>
      <div className="vz-sep" />
      <Chave rotulo="Supressão de ruído" ligado={m.ruido} onChange={(ruido) => salvarMidia({ ruido })} />
      <Chave rotulo="Cancelamento de eco" ligado={m.eco} onChange={(eco) => salvarMidia({ eco })} />
      <div className="vz-sep" />
      <ModoEntrada />
      <div className="vz-sep" />
      <button
        type="button"
        className="vz-item"
        onClick={() => {
          fechar();
          setApp({ configAberto: true });
        }}
      >
        <span>Configurações de voz</span>
        <IcSeta tam={14} className="vz-seta-dir" />
      </button>
    </Balao>
  );
}

export function MenuFone({ lugar, ancora, fechar }: { lugar: Lugar; ancora: HTMLElement | null; fechar: () => void }) {
  const m = useMidia();
  const geral = useAjustesVoz((s) => s.geral);
  useEffect(() => {
    void listarAparelhos();
  }, []);
  return (
    <Balao lugar={lugar} ancora={ancora} fechar={fechar} rotulo="Opções do fone">
      {podeEscolherSaida() && (
        <>
          <h4>Saída de som</h4>
          <ListaAparelhos rotulo="Saída de som" lista={m.saidas} valor={m.saida} onChange={(saida) => salvarMidia({ saida })} />
          <div className="vz-sep" />
        </>
      )}
      <h4>Volume da voz</h4>
      <label className="vz-vol">
        <input aria-label="Volume da voz" type="range" min={0} max={100} value={Math.round(geral * 100)} onChange={(e) => ajustarVoz({ geral: Number(e.target.value) / 100 })} />
        <b>{Math.round(geral * 100)}%</b>
      </label>
    </Balao>
  );
}

/** Microfone e fone com a setinha de opções, como no Discord (só na voz). */
export function BotoesVozEu() {
  const voz = useApp((s) => s.myVozSid);
  const mudo = useApp((s) => s.vozMudo);
  const surdo = useApp((s) => s.vozSurdo);
  const mic = useBalao();
  const fone = useBalao();
  if (!voz) return null;
  return (
    <span className="vz-eu">
      <span className={"vz-dupla" + (mudo ? " off" : "")}>
        <button type="button" className="vz-ib" aria-pressed={mudo} aria-label={mudo ? "Ligar o microfone" : "Desligar o microfone"} data-dica={mudo ? "Ligar o microfone" : "Silenciar"} onClick={alternarMudo}>
          {mudo ? <IcMicDesligado tam={19} /> : <IcMic tam={19} />}
        </button>
        <button type="button" className="vz-seta" aria-label="Opções do microfone" aria-expanded={!!mic.lugar} onClick={(e) => mic.alternar(e)}>
          <IcSeta tam={12} />
        </button>
      </span>
      <span className={"vz-dupla" + (surdo ? " off" : "")}>
        <button type="button" className="vz-ib" aria-pressed={surdo} aria-label={surdo ? "Voltar a ouvir" : "Parar de ouvir"} data-dica={surdo ? "Voltar a ouvir" : "Ensurdecer"} data-dica-fim="" onClick={alternarSurdo}>
          {surdo ? <IcFoneDesligado tam={19} /> : <IcFone tam={19} />}
        </button>
        <button type="button" className="vz-seta" aria-label="Opções do fone" aria-expanded={!!fone.lugar} onClick={(e) => fone.alternar(e)}>
          <IcSeta tam={12} />
        </button>
      </span>
      {mic.lugar && <MenuMic lugar={mic.lugar} ancora={mic.ancora} fechar={mic.fechar} />}
      {fone.lugar && <MenuFone lugar={fone.lugar} ancora={fone.ancora} fechar={fone.fechar} />}
    </span>
  );
}

/* ---------- janela de transmitir ---------- */
const OPC_MOSTRAR: { v: Mostrar; t: string }[] = [
  { v: "monitor", t: "Tela inteira" },
  { v: "window", t: "Janela" },
  { v: "browser", t: "Aba" },
];
const OPC_RES: Res[] = [720, 1080, 1440];
const OPC_FPS: Fps[] = [30, 60];

function JanelaTransmitir() {
  const res = useLive((s) => s.res);
  const fps = useLive((s) => s.fps);
  const somPc = useLive((s) => s.somPc);
  const mostrar = useLive((s) => s.mostrar);
  const aoVivo = useApp((s) => !!s.myLiveSid);
  const fechar = () => setLive({ janelaTela: false });
  const ir = () => {
    fechar();
    /* a captura precisa sair deste toque (o navegador só abre a janela dele com um clique) */
    if (LIVE.mySid) stopLive();
    void startLive();
  };
  return (
    <Janela titulo={aoVivo ? "Trocar a transmissão" : "Transmitir tela"} fechar={fechar}>
      {aoVivo && somPc && !LIVE.hasAudio && (
        <p className="vz-aviso-som">
          <SemSom />
        </p>
      )}
      <div>
        <div className="vz-rot">O que mostrar</div>
        <div className="vz-segs" role="radiogroup" aria-label="O que mostrar">
          {OPC_MOSTRAR.map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={mostrar === o.v}
              onClick={() => {
                setLive({ mostrar: o.v });
                local.set("live-mostrar", o.v);
              }}
            >
              {o.t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="vz-rot">Resolução</div>
        <div className="vz-segs" role="radiogroup" aria-label="Resolução">
          {OPC_RES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={res === r}
              onClick={() => {
                setLive({ res: r });
                local.set("live-res", String(r));
              }}
            >
              {r}p
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="vz-rot">Fluidez</div>
        <div className="vz-segs" role="radiogroup" aria-label="Fluidez">
          {OPC_FPS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={fps === f}
              onClick={() => {
                setLive({ fps: f });
                local.set("live-fps", String(f));
              }}
            >
              {f} fps
            </button>
          ))}
        </div>
      </div>
      <Chave
        rotulo="Transmitir o som do PC"
        ligado={somPc}
        onChange={(v) => {
          setLive({ somPc: v });
          local.set("live-som", v ? "1" : "0");
        }}
      />
      {res === 1440 && <p className="vz-dica">1440p só sai em 2K com monitor 1440p ou maior e pede uns 20 Mbps de upload por pessoa assistindo.</p>}
      <div className="vz-janela-pe">
        <button type="button" className="btn soft" onClick={fechar}>
          Cancelar
        </button>
        <button type="button" className="btn" onClick={ir}>
          {aoVivo ? "Transmitir de novo" : "Transmitir ao vivo"}
        </button>
      </div>
      <p className="vz-dica">O navegador abre a janelinha dele para você escolher qual tela, janela ou aba.</p>
      {somPc && (
        <details className="vz-ajuda">
          <summary>Como mandar o som do jogo</summary>
          <ol>
            <ComoSom />
            <li>Se travar para quem assiste, baixe para 30 fps ou 1080p.</li>
          </ol>
        </details>
      )}
    </Janela>
  );
}

/* ---------- prévia da câmera ---------- */
function PreviaCamera() {
  const cams = useMidia((s) => s.cams);
  const camId = useMidia((s) => s.cam);
  const espelho = useLive((s) => s.espelho);
  const naGrade = useLive((s) => s.minhaCamNaGrade);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [erro, setErro] = useState("");
  const [desfoque, setDesfoque] = useState(querDesfoque);
  const fechar = () => setLive({ previaCam: false });
  const faixaPrevia = stream?.getVideoTracks()[0];

  /* abre a câmera só para a prévia (troca junto com o aparelho escolhido) e fecha ao sair */
  useEffect(() => {
    let vivo = true;
    let aberto: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user", ...restricoesCam() }, audio: false })
      .then((st) => {
        if (!vivo) return st.getTracks().forEach((t) => t.stop());
        aberto = st;
        setErro("");
        if (querDesfoque()) void aplicarDesfoque(st.getVideoTracks()[0], true);
        setStream(st);
        void listarAparelhos();
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        const nome = e instanceof Error ? e.name : "";
        setErro(nome === "NotAllowedError" ? "A câmera foi bloqueada. Libere no cadeado ao lado do endereço do site." : nome === "NotFoundError" ? "Nenhuma câmera encontrada." : "Não deu para abrir a câmera. Ela pode estar sendo usada por outro programa.");
      });
    return () => {
      vivo = false;
      aberto?.getTracks().forEach((t) => t.stop());
    };
  }, [camId]);

  const ligar = () => {
    stream?.getTracks().forEach((t) => t.stop());
    fechar();
    void startCam();
  };
  const atual = cams.some((d) => d.id === camId) ? camId : "";
  return (
    <Janela titulo="Ligar a câmera" fechar={fechar}>
      <div className={"vz-cam-previa" + (espelho ? " espelho" : "")}>{erro ? <p className="vz-dica">{erro}</p> : <VideoMudo stream={stream} />}</div>
      {cams.length > 1 && (
        <label className="vz-select">
          <span className="vz-rot">Câmera</span>
          <select value={atual} onChange={(e) => salvarMidia({ cam: e.target.value })}>
            <option value="">Padrão do sistema</option>
            {cams.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <Chave
        rotulo="Espelhar a minha imagem"
        ligado={espelho}
        onChange={(v) => {
          setLive({ espelho: v });
          local.set("cam-espelho", v ? "1" : "0");
        }}
      />
      <Chave
        rotulo="Ver a minha câmera na grade"
        ligado={naGrade}
        onChange={(v) => {
          setLive({ minhaCamNaGrade: v });
          local.set("cam-na-grade", v ? "1" : "0");
        }}
      />
      {podeDesfocar(faixaPrevia) && (
        <Chave
          rotulo="Desfocar o fundo"
          ligado={desfoque}
          onChange={(v) => {
            setDesfoque(v);
            mudarDesfoque(v);
            void aplicarDesfoque(faixaPrevia, v);
          }}
        />
      )}
      <p className="vz-dica">Espelhar muda só o que você vê; os outros te veem do jeito certo.</p>
      <div className="vz-janela-pe">
        <button type="button" className="btn soft" onClick={fechar}>
          Cancelar
        </button>
        <button type="button" className="btn" disabled={!!erro} onClick={ligar}>
          Ligar câmera
        </button>
      </div>
    </Janela>
  );
}

/** As janelas da voz (fora do menu, para abrirem de qualquer lugar: menu, Ao vivo, grade). */
export function JanelasVoz() {
  const tela = useLive((s) => s.janelaTela);
  const cam = useLive((s) => s.previaCam);
  return (
    <>
      {tela && <JanelaTransmitir />}
      {cam && <PreviaCamera />}
    </>
  );
}
