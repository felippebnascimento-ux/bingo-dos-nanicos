"use client";
import { IcCamera, IcJanela } from "@/components/ui/icones";
import { useApp } from "@/lib/store";
import { activeCams, openCamPip, startCam, stopCam } from "./camera";
import { useLive } from "./estado";

/** Botões da câmera no menu lateral: ligar/desligar e abrir as câmeras numa janela flutuante. */
export function CamBotoes() {
  useLive((s) => s.v);
  const on = useApp((s) => !!s.myCamSid);
  const n = activeCams().length;
  const tCam = on ? "Desligar câmera" : "Ligar câmera";
  return (
    <div className="cam-row">
      <button
        className="btn soft cam-btn"
        id="camBtn"
        type="button"
        title={tCam}
        aria-pressed={on}
        onClick={() => (on ? stopCam() : startCam())}
      >
        <IcCamera />
        <span className="t">{tCam}</span>
      </button>
      <button
        className="btn soft cam-pip"
        id="camPipBtn"
        type="button"
        title={`Abrir ${n === 1 ? "a câmera" : "as " + n + " câmeras"} numa janela flutuante`}
        aria-label="Abrir as câmeras numa janela flutuante"
        hidden={!n}
        onClick={() => openCamPip(null)}
      >
        <IcJanela tam={18} />
        <span className="t">Ver câmeras</span>
        <span className="n" id="camN">
          {n || ""}
        </span>
      </button>
    </div>
  );
}
