"use client";
import { useEffect } from "react";
import { Lobby } from "./Lobby";
import { MesaTela } from "./MesaTela";
import { ligarTruco, useTruco } from "./mesa";

/** Aba do truco: lista de mesas (lobby) ou a mesa aberta. Fica sempre montada, para a mesa não morrer. */
export function TrucoView({ hidden }: { hidden: boolean }) {
  const ver = useTruco((s) => s.ver);
  const mesa = useTruco((s) => (s.ver ? s.mesas.find((m) => m.id === s.ver) : undefined));
  useEffect(() => ligarTruco(), []);

  return (
    <section id="view-truco" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Truco gaudério</h1>
      </header>
      <div id="trucoBox">{ver && mesa ? <MesaTela m={mesa} /> : <Lobby />}</div>
    </section>
  );
}
