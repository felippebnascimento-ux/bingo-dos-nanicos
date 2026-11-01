"use client";
import { useEffect, useState } from "react";
import { IcVoltar } from "@/components/ui/icones";
import { local } from "@/lib/util";
import { FaixaCameras, JanelaCameras } from "./Cameras";
import { useLive } from "./estado";
import { iniciarLive } from "./live";
import { Painel } from "./Painel";
import { Palco } from "./Palco";
import { LIVE, watch } from "./tela";
import { Rosto } from "./Rosto";
import { VideoMudo } from "./Video";

/** Telas abertas sem som, embaixo da principal (tocar troca de lugar). */
function Minis() {
  useLive((s) => s.v);
  const secs = [...LIVE.watching.values()]
    .filter((w) => w.key !== LIVE.main)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  return (
    <div className="minis" id="minis">
      {secs.map((w) => (
        <button
          key={w.key}
          className="mini"
          type="button"
          aria-label={`Tornar ${w.name} a tela principal`}
          onClick={() => watch(w.key, true)}
        >
          <VideoMudo stream={w.stream} />
          {w.state !== "live" && <span className="wait">{w.state === "failed" ? "Não conectou" : "Conectando…"}</span>}
          <span className="cap">
            <Rosto p={w} />
            {w.name}
            <small>sem som</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Aba Ao vivo: transmissão de tela, câmeras, reações, desenho e o painel (telas, chat, cartela). */
export function LiveView({ hidden }: { hidden: boolean }) {
  /* painel da direita: recolher/abrir pela alça (fica salvo) */
  const [railMin, setRailMin] = useState(() => local.get("rail-min") === "1");

  useEffect(() => {
    iniciarLive();
  }, []);

  const alternaPainel = () => {
    const on = !railMin;
    setRailMin(on);
    local.set("rail-min", on ? "1" : "0");
  };
  const tPainel = railMin ? "Abrir painel" : "Recolher painel";

  return (
    <section id="view-live" className="inner" hidden={hidden}>
      <header className="hero hero-live">
        <h1>Ao vivo</h1>
      </header>
      <div className={"live-grid" + (railMin ? " no-rail" : "")} id="liveWrap">
        <div className="stage-col">
          <Palco />
          <FaixaCameras />
          <Minis />
        </div>
        <Painel />
        <button
          className="rail-toggle"
          id="railToggle"
          type="button"
          aria-label={tPainel}
          title={tPainel}
          aria-expanded={!railMin}
          onClick={alternaPainel}
        >
          <IcVoltar />
        </button>
      </div>
      <JanelaCameras />
    </section>
  );
}
