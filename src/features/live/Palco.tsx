"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { IcAjustes, IcFechar, IcJanela, IcLapis, IcReagir, IcTelaCheia, IcVolume } from "@/components/ui/icones";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { getLive, setLive, useLive } from "./estado";
import {
  alternarLapis,
  DCORES,
  DESP,
  DESP_NOMES,
  DNOMES,
  fimTraco,
  pintar,
  pointerDown,
  pointerMove,
  registrarCanvas,
  registrarPalco,
  setCor,
  setDesenhoVer,
  setEsp,
} from "./desenho";
import { REACOES, REACOES_FOTO, reagir, setReacoesVer } from "./reacoes";
import { canShare } from "./rtc";
import { LIVE, liveStreams, mudarVolumeTela, unwatch, watch } from "./tela";
import { Rosto } from "./Rosto";
import { Voos } from "./Voos";

/** O vídeo da tela principal: com som (se o navegador bloquear, aparece "Ativar som"). */
function VideoPrincipal({ stream, live }: { stream: MediaStream | null; live: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const prende = useCallback((v: HTMLVideoElement | null) => {
    ref.current = v;
    LIVE.mainVideo = v;
    return () => {
      if (LIVE.mainVideo === v) LIVE.mainVideo = null;
      ref.current = null;
      if (v) v.srcObject = null;
    };
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.volume = getLive().vol;
    if (!live) return;
    v.muted = false;
    v.play()
      .then(() => setLive({ unmute: false }))
      .catch(() => {
        v.muted = true;
        v.play().catch(() => {});
        setLive({ unmute: true });
      });
  }, [stream, live]);

  useEffect(() => () => setLive({ unmute: false }), []);

  return <video ref={prende} autoPlay muted playsInline />;
}

type Pop = null | "react" | "opt";

/** Palco do Ao vivo: a tela principal, o desenho, as reações e a barra de controles. */
export function Palco() {
  useLive((s) => s.v);
  const online = useApp((s) => s.onlineSala);
  const unmute = useLive((s) => s.unmute);
  const vol = useLive((s) => s.vol);
  const voando = useLive((s) => s.voando);
  const reacoesVer = useLive((s) => s.reacoesVer);
  const desenhoOn = useLive((s) => s.desenhoOn);
  const desenhoVer = useLive((s) => s.desenhoVer);
  const desenhoCor = useLive((s) => s.desenhoCor);
  const desenhoEsp = useLive((s) => s.desenhoEsp);

  const [idle, setIdle] = useState(true);
  const [pop, setPop] = useState<Pop>(null);
  const [fs, setFs] = useState(false);
  const [q, setQ] = useState("");
  const barra = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sobreBarra = useRef(false);

  const w = LIVE.main ? LIVE.watching.get(LIVE.main) : undefined;
  const mainKey = w?.key || null;

  /* troca de tela principal: os riscos da outra somem */
  useEffect(() => {
    pintar();
  }, [mainKey]);

  /* qualidade que está chegando (resolução e fps) */
  useEffect(() => {
    const id = setInterval(async () => {
      const ww = LIVE.main ? LIVE.watching.get(LIVE.main) : undefined,
        v = LIVE.mainVideo;
      if (!ww || ww.state !== "live" || !v) return setQ("");
      let fps = 0;
      try {
        const st = await ww.pc.getStats();
        st.forEach((r) => {
          if (r.type === "inbound-rtp" && r.kind === "video" && r.framesPerSecond) fps = Math.round(r.framesPerSecond);
        });
      } catch {
        /* sem estatística */
      }
      setQ(v.videoHeight ? `${v.videoHeight}p${fps ? ` · ${fps} fps` : ""}` : "");
    }, 2000);
    return () => clearInterval(id);
  }, []);

  /* balões (reações e ajustes): fecham ao tocar fora ou com Esc */
  useEffect(() => {
    const fecha = () => setPop(null);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecha();
    };
    document.addEventListener("click", fecha);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", fecha);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  /* tela cheia: a área inteira (vídeo + chat/cartela) */
  useEffect(() => {
    const f = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  /* controles do vídeo: aparecem ao mexer o mouse/tocar e somem depois de 2,5 s parado */
  const esconde = () => {
    const b = barra.current,
      ativo = document.activeElement;
    if (sobreBarra.current || (b && ativo && b.contains(ativo) && ativo.matches(":focus-visible"))) return;
    setIdle(true);
  };
  const mostra = (ms = 2500) => {
    setIdle(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(esconde, ms);
  };

  const abrePop = (qual: Exclude<Pop, null>) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setPop(pop === qual ? null : qual);
  };

  function telaCheia() {
    const el = document.getElementById("liveWrap");
    const pr = document.fullscreenElement ? document.exitFullscreen() : el?.requestFullscreen?.();
    pr?.catch?.(() => toast("Seu navegador não abriu a tela cheia."));
  }

  async function janela() {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (LIVE.mainVideo) await LIVE.mainVideo.requestPictureInPicture();
    } catch {
      toast("Seu navegador não abriu a janela flutuante.");
    }
  }

  function ativarSom() {
    const v = LIVE.mainVideo;
    if (!v) return;
    v.muted = false;
    v.play()
      .then(() => setLive({ unmute: false }))
      .catch(() => {});
  }

  const ls = liveStreams(online);
  let vazio: React.ReactNode = null;
  if (!w)
    vazio = ls.length ? (
      <>
        <b>Escolha quem assistir</b>
        <span>Toque em um nome para abrir a tela com som.</span>
        <div className="acts">
          {ls.map((p) => (
            <button key={p.key} className="btn sm" data-watch={p.key} onClick={() => watch(p.key, true)}>
              <Rosto p={p} />
              {p.name}
            </button>
          ))}
        </div>
      </>
    ) : (
      <>
        <b>Ninguém transmitindo agora</b>
        <span>
          {canShare
            ? "Toque em “Transmitir minha tela” para começar."
            : "Quando alguém transmitir do computador, a tela aparece aqui."}
        </span>
      </>
    );
  else if (w.state === "connecting") vazio = <b>Conectando à tela de {w.name}…</b>;
  else if (w.state === "failed")
    vazio = (
      <>
        <b>Não deu para conectar à tela de {w.name}</b>
        <span>A rede de algum de vocês pode estar bloqueando.</span>
        <div className="acts">
          <button className="btn sm" id="retryMain" onClick={() => watch(w.key, true)}>
            Tentar de novo
          </button>
        </div>
      </>
    );

  return (
    <div
      className={"stage" + (idle ? " idle" : "") + (desenhoOn ? " drawing" : "")}
      id="stage"
      ref={registrarPalco}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse") mostra();
      }}
      onPointerDown={(e) => mostra(e.pointerType === "mouse" ? 2500 : 3500)}
      onMouseLeave={() => {
        sobreBarra.current = false;
        clearTimeout(timer.current);
        esconde();
      }}
    >
      <div className="stage-slot" id="stageSlot">
        {w && <VideoPrincipal key={w.key} stream={w.stream} live={w.state === "live"} />}
      </div>
      <div className="stage-empty" id="stageEmpty" hidden={!!w && w.state === "live"}>
        {vazio}
      </div>
      <button className="btn unmute" id="unmute" hidden={!w || !unmute} onClick={ativarSom}>
        Ativar som
      </button>
      <canvas
        className="draw-canvas"
        id="drawCanvas"
        aria-hidden="true"
        ref={registrarCanvas}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={fimTraco}
        onPointerCancel={fimTraco}
        onLostPointerCapture={fimTraco}
      />
      <div className="react-layer" id="reactLayer" aria-hidden="true">
        <Voos voando={voando} camada="palco" />
      </div>
      <div
        className="stage-bar"
        id="stageBar"
        ref={barra}
        hidden={!w || w.state !== "live"}
        onPointerEnter={() => {
          sobreBarra.current = true;
          mostra();
        }}
        onPointerLeave={() => {
          sobreBarra.current = false;
          mostra();
        }}
        onFocus={() => mostra(4000)}
      >
        <span className="who" id="stageWho">
          {w && (
            <>
              <Rosto p={w} />
              {w.name} <span className="live-pill">AO VIVO</span>
            </>
          )}
        </span>
        <span className="q" id="stageQ">
          {w && w.state === "live" ? q : ""}
        </span>
        <span className="sp" />
        <div className="sb-tools">
          <div className="pop-wrap">
            <button
              className={"ib" + (pop === "react" ? " on" : "")}
              id="reactBtn"
              type="button"
              aria-expanded={pop === "react"}
              aria-controls="reactPop"
              title="Reagir"
              aria-label="Reagir"
              onClick={abrePop("react")}
            >
              <IcReagir />
            </button>
            <div className="pop" id="reactPop" hidden={pop !== "react"} onClick={(e) => e.stopPropagation()}>
              <span className="reacts" id="reacts" role="group" aria-label="Reagir na live">
                {REACOES.map((e, i) => (
                  <button key={e} type="button" className="rbtn" data-r={i} aria-label={`Reagir com ${e}`} title="Reagir" onClick={() => reagir(i)}>
                    {e}
                  </button>
                ))}
                {REACOES_FOTO.map((f, j) => (
                  <button
                    key={f.nome}
                    type="button"
                    className="rbtn foto"
                    data-r={REACOES.length + j}
                    aria-label={`Reagir com ${f.nome}`}
                    title={f.nome}
                    onClick={() => reagir(REACOES.length + j)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.mini} alt="" width={34} height={34} />
                  </button>
                ))}
              </span>
            </div>
          </div>
          <div className="pop-wrap">
            <button
              className="ib"
              id="drawBtn"
              type="button"
              aria-pressed={desenhoOn}
              title="Desenhar na tela (quem está assistindo vê)"
              aria-label="Desenhar na tela"
              onClick={alternarLapis}
            >
              <IcLapis />
            </button>
            <div className="pop draw-pop" id="drawOpts" hidden={!desenhoOn}>
              <span className="draw-cores" id="drawCores" role="radiogroup" aria-label="Cor do desenho">
                {DCORES.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    className="draw-cor"
                    role="radio"
                    data-c={i}
                    aria-checked={desenhoCor === i}
                    aria-label={DNOMES[i]}
                    style={{ background: c }}
                    onClick={() => setCor(i)}
                  />
                ))}
              </span>
              <span className="draw-esps" id="drawEsps" role="radiogroup" aria-label="Espessura">
                {DESP.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="draw-esp"
                    role="radio"
                    data-e={i}
                    aria-checked={desenhoEsp === i}
                    aria-label={DESP_NOMES[i]}
                    title={DESP_NOMES[i]}
                    onClick={() => setEsp(i)}
                  >
                    <i style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
                  </button>
                ))}
              </span>
            </div>
          </div>
          <label className="ib vol" htmlFor="vol" title="Volume">
            <IcVolume />
            <input
              type="range"
              id="vol"
              min="0"
              max="1"
              step="0.05"
              value={vol}
              aria-label="Volume"
              onChange={(e) => mudarVolumeTela(+e.target.value)}
            />
          </label>
          <div className="pop-wrap">
            <button
              className={"ib" + (pop === "opt" ? " on" : "")}
              id="optBtn"
              type="button"
              aria-expanded={pop === "opt"}
              aria-controls="optPop"
              title="Ajustes"
              aria-label="Ajustes"
              onClick={abrePop("opt")}
            >
              <IcAjustes />
            </button>
            <div className="pop opt-pop" id="optPop" hidden={pop !== "opt"} onClick={(e) => e.stopPropagation()}>
              <label>
                <input type="checkbox" id="reactVer" checked={reacoesVer} onChange={(e) => setReacoesVer(e.target.checked)} />
                Ver reações dos outros
              </label>
              <label>
                <input type="checkbox" id="drawVer" checked={desenhoVer} onChange={(e) => setDesenhoVer(e.target.checked)} />
                Ver desenhos dos outros
              </label>
            </div>
          </div>
          <button
            className="ib"
            id="pipBtn"
            type="button"
            title="Janela flutuante"
            aria-label="Janela flutuante"
            hidden={!document.pictureInPictureEnabled}
            onClick={janela}
          >
            <IcJanela />
          </button>
          <button
            className={"ib" + (fs ? " on" : "")}
            id="fsBtn"
            type="button"
            title={fs ? "Sair da tela cheia" : "Tela cheia"}
            aria-label={fs ? "Sair da tela cheia" : "Tela cheia"}
            onClick={telaCheia}
          >
            <IcTelaCheia />
          </button>
          {/* como no Discord: parar de assistir esta tela (a próxima aberta vira a grande; sem nenhuma, volta à grade) */}
          {w && LIVE.main && (
            <button className="ib parar" type="button" title="Parar de assistir" aria-label={`Parar de assistir a tela de ${w.name}`} onClick={() => LIVE.main && unwatch(LIVE.main)}>
              <IcFechar />
              <span>Parar de assistir</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
