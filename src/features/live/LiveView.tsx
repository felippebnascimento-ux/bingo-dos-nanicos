"use client";
import { useEffect, useRef, useState } from "react";
import { IcVoltar } from "@/components/ui/icones";
import { nomeDaSala } from "@/features/salas/trocar";
import { setApp, useApp } from "@/lib/store";
import { local } from "@/lib/util";
import { JanelaCameras } from "./Cameras";
import { BarraCanal, DestaqueCanal, FaixaFoco, GradeCanal, TopoCanal } from "./Grade";
import { useLive } from "./estado";
import { iniciarLive } from "./live";
import { Painel } from "./Painel";
import { Palco } from "./Palco";

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
  /* como no Discord: com o mouse parado na call, a barra de botões some (volta ao mexer) */
  const [parado, setParado] = useState(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mexeu = () => {
    setParado(false);
    clearTimeout(relogio.current);
    relogio.current = setTimeout(() => setParado(true), 2500);
  };
  useEffect(() => () => clearTimeout(relogio.current), []);
  /* a live e as câmeras são de dentro da sala: no lobby, só o convite */
  const noLobby = useApp((s) => s.salas.length > 0 && !s.minhaSala);
  /* dentro de uma sala, o título é o nome dela (o canal de voz onde estou) */
  const sala = useApp((s) => nomeDaSala(s.minhaSala, s.salas));
  const modo = useLive((s) => s.modo);
  const destaque = useLive((s) => s.destaque);
  const semNomes = useLive((s) => s.semNomes);

  return (
    <section id="view-live" className="inner" hidden={hidden}>
      {/* dentro de uma sala, o nome dela fica na barra fina de cima da call (como no Discord) */}
      {!sala && (
        <header className="hero hero-live">
          <h1>Ao vivo</h1>
        </header>
      )}
      {noLobby && (
        <div className="block convite-sala">
          <p>Entre num canal de voz, no menu, para falar, transmitir a tela e ver as câmeras de quem está nele.</p>
          <button type="button" className="btn" onClick={() => setApp({ salasAberto: true })}>
            Escolher a sala
          </button>
        </div>
      )}
      <div className={"live-grid" + (railMin ? " no-rail" : "")} id="liveWrap" hidden={noLobby}>
        <div className={"stage-col cv-call" + (parado ? " parado" : "") + (semNomes ? " sem-nomes" : "")} onPointerMove={mexeu} onPointerLeave={() => setParado(true)}>
          {/* como no Discord: todo mundo em quadrados (grade) ou uma tela grande com o resto embaixo (foco).
              O Palco fica montado também na grade (escondido), para a tela principal seguir com som */}
          <TopoCanal sala={sala} chat={!railMin} alternarChat={alternaPainel} />
          <div className="palco-foco" hidden={modo === "grade" || !!destaque}>
            <Palco />
          </div>
          {modo === "foco" && destaque && <DestaqueCanal />}
          {modo === "grade" ? <GradeCanal /> : <FaixaFoco />}
          <BarraCanal />
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
