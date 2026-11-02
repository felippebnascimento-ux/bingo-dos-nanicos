"use client";
import { useLive } from "./estado";
import { Voos } from "./Voos";

/** Reações que chegam na MINHA transmissão (canto da tela, fora das abas). */
export function CamadaReacoesMinha() {
  const voando = useLive((s) => s.voando);
  return (
    <div className="react-layer fixed" id="reactLayerMe" aria-hidden="true">
      <Voos voando={voando} camada="minha" />
    </div>
  );
}
