"use client";
/*
 * Aba Sítio (tela inicial): o hall do Sítio do Mitz com o boneco de quem está no site.
 * Clique ou toque no chão para andar; pelo teclado, as setas andam um piso. A TV abre o Ao vivo.
 */
import { useEffect, useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { friendDaPresenca, MY_KEY, setApp, useApp } from "@/lib/store";
import { andarAte, andarUmPiso, iniciarHall, useHall } from "./bonecos";
import { Boneco } from "./Boneco";
import { caixaDoBoneco, caixaDoMovel, MOVEIS, ordemZ, pisoNaTela, VB } from "./hall";
import { Fundo, MovelCamada, TV_CAIXA } from "./Sala";

/** Setas → um piso: direita/esquerda seguem a parede da direita, cima/baixo a da esquerda. */
const SETAS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

const pct = (v: number) => `${v}%`;

export function HallView({ hidden }: { hidden: boolean }) {
  const bonecos = useHall((s) => s.bonecos);
  const aviso = useHall((s) => s.aviso);
  const friends = useApp((s) => s.friends);
  const aoVivo = useApp((s) => !!s.myLiveSid || s.online.some((p) => p.live && p.key !== MY_KEY));

  useEffect(() => {
    iniciarHall();
  }, []);

  /* z-index de cada móvel e boneco, do fundo para a frente */
  const z = useMemo(() => {
    const caixas = [...MOVEIS.map(caixaDoMovel), ...bonecos.map((b) => caixaDoBoneco(b.i, b.j))];
    const out: number[] = [];
    ordemZ(caixas).forEach((k, pos) => (out[k] = pos + 1));
    return out;
  }, [bonecos]);

  const tocar = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const piso = pisoNaTela(VB.x + ((e.clientX - r.left) / r.width) * VB.w, VB.y + ((e.clientY - r.top) / r.height) * VB.h);
    if (piso) andarAte(piso);
  };

  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = SETAS[e.key];
    if (!d || e.target !== e.currentTarget) return;
    e.preventDefault();
    andarUmPiso(d[0], d[1]);
  };

  return (
    <section id="view-hall" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Sítio do Mitz</h1>
      </header>
      <div
        className="hall hall-palco"
        tabIndex={0}
        role="group"
        aria-label="Hall do Sítio. Clique no chão ou use as setas para andar."
        onClick={tocar}
        onKeyDown={tecla}
      >
        <Fundo aoVivo={aoVivo} />
        {MOVEIS.map((m, k) => (
          <MovelCamada key={m.id} id={m.id} z={z[k]} />
        ))}
        {bonecos.map((b, k) => (
          <Boneco key={b.key} b={b} f={friendDaPresenca(b, friends) || { name: b.name }} eu={b.key === MY_KEY} z={z[MOVEIS.length + k]} />
        ))}
        <button
          type="button"
          className="hall-tv"
          aria-label={aoVivo ? "TV: abrir o Ao vivo (tem gente transmitindo)" : "TV: abrir o Ao vivo"}
          title="Abrir o Ao vivo"
          style={{ left: pct(TV_CAIXA.left), top: pct(TV_CAIXA.top), width: pct(TV_CAIXA.width), height: pct(TV_CAIXA.height) }}
          onClick={(e) => {
            e.stopPropagation();
            setApp({ aba: "live" });
          }}
        >
          {aoVivo && <span className="live-pill">AO VIVO</span>}
        </button>
      </div>
      <p className="hint hall-dica">Clique no chão para andar. A TV abre o Ao vivo.</p>
      <p className="hall-aviso" aria-live="polite">
        {aviso}
      </p>
    </section>
  );
}
