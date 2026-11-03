"use client";
/*
 * K-FOFO Teste: a mesma sala isométrica do K-FOFO, mas com assets visuais do Habbo.
 * Reutiliza a grade e o movimento dos bonecos (hall.ts, bonecos.ts), trocando o SVG
 * dos móveis e as spritesheets por imagens da API pública do habboassets.com.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { friendDaPresenca, MY_KEY, useApp } from "@/lib/store";
import { andarAte, andarUmPiso, iniciarHall, useHall } from "@/features/hall/bonecos";
import { BaloesHall, ChatBarra, HistoricoChat } from "@/features/hall/ChatHabbo";
import { NaSala, Ganhos, CarteiraCanto, Dica } from "@/features/hall/Cantos";
import { Chegadas, iniciarChegadas } from "@/features/hall/Chegadas";
import { iniciarGanhos } from "@/features/hall/ganhos";
import { MOVEIS, NI, NJ, tela, TW, VB_ESTREITO, VB_LARGO, livre, pisoLivreNaTela, pisoNaTela, camadasHall, ANCORA, CEL_H, CEL_W, type Caixa2D, type Piso } from "@/features/hall/hall";
import { viewBox } from "@/features/hall/Sala";
import { HABBO_MOVEIS, figureDe, habboDir, urlAvatar, urlMovel } from "./habbo";
import type { Boneco as B } from "@/features/hall/bonecos";
import type { Rosto } from "@/lib/tipos";
import { memo } from "react";

/** Setas do teclado. */
const SETAS: Record<string, [number, number]> = {
  ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
};

const ESTREITO = "(max-width: 760px)";
const assinarTela = (cb: () => void) => { const m = matchMedia(ESTREITO); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useVB = (): Caixa2D => (useSyncExternalStore(assinarTela, () => matchMedia(ESTREITO).matches, () => false) ? VB_ESTREITO : VB_LARGO);

const pct = (v: number) => `${v}%`;
const p = tela;

function noSvg(e: { clientX: number; clientY: number; currentTarget: Element }, vb: Caixa2D) {
  const r = e.currentTarget.getBoundingClientRect();
  return [vb.x + ((e.clientX - r.left) / r.width) * vb.w, vb.y + ((e.clientY - r.top) / r.height) * vb.h] as const;
}

const mesmoPiso = (a: Piso | null, b: Piso | null) => a === b || (!!a && !!b && a.i === b.i && a.j === b.j);

/* ---------- piso Habbo (losangos verdes em SVG) ---------- */
const CORES_PISO = ["#7CB77C", "#6DAE6D", "#5FA65F", "#73B373"];

function PisoHabbo({ vb }: { vb: Caixa2D }) {
  const tiles: React.ReactNode[] = [];
  for (let i = 0; i < NI; i++)
    for (let j = 0; j < NJ; j++) {
      const cor = CORES_PISO[(i + j) % CORES_PISO.length];
      tiles.push(
        <polygon
          key={`${i},${j}`}
          points={[p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)].map((v) => v.join(",")).join(" ")}
          fill={cor}
          stroke="#5A9A5A"
          strokeWidth={0.5}
        />,
      );
    }
  return (
    <svg className="hall-camada habbo-piso" viewBox={viewBox(vb)} aria-hidden="true">
      {tiles}
    </svg>
  );
}

/* ---------- paredes Habbo (fundo azul clássico) ---------- */
function ParedesHabbo({ vb }: { vb: Caixa2D }) {
  const WH = 215;
  const pts = (q: [number, number][]) => q.map((v) => v.join(",")).join(" ");
  return (
    <svg className="hall-camada habbo-paredes" viewBox={viewBox(vb)} aria-hidden="true">
      {/* parede esquerda */}
      <polygon points={pts([p(0, 0, WH + 34), p(0, NJ, WH + 34), p(0, NJ, 0), p(0, 0, 0)])} fill="#6B9EC2" stroke="#5889AB" strokeWidth={1} />
      {/* parede direita */}
      <polygon points={pts([p(0, 0, WH + 34), p(NI, 0, WH + 34), p(NI, 0, 0), p(0, 0, 0)])} fill="#7BAFD4" stroke="#5889AB" strokeWidth={1} />
      {/* borda do piso esquerda */}
      <polygon points={pts([p(0, 0, 0), p(0, NJ, 0), p(0, NJ, -8), p(0, 0, -8)])} fill="#3A6B3A" />
      {/* borda do piso direita */}
      <polygon points={pts([p(0, 0, 0), p(NI, 0, 0), p(NI, 0, -8), p(0, 0, -8)])} fill="#4A7A4A" />
    </svg>
  );
}

/* ---------- destaque do piso ---------- */
function Destaque({ piso, vb, pisca }: { piso: Piso | null; vb: Caixa2D; pisca: number }) {
  if (!piso) return null;
  const { i, j } = piso;
  return (
    <svg className="hall-camada hall-destaque" viewBox={viewBox(vb)} aria-hidden="true">
      <polygon key={pisca} className={pisca ? "pisca" : undefined} points={[p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)].map((v) => v.join(",")).join(" ")} />
    </svg>
  );
}

/* ---------- móvel Habbo (imagem posicionada no piso) ---------- */
const MovelHabbo = memo(function MovelHabbo({ id, i, j, w, d, z, vb }: { id: string; i: number; j: number; w: number; d: number; z: number; vb: Caixa2D }) {
  const hm = HABBO_MOVEIS[id];
  if (!hm) return null;
  const escala = hm.escala ?? 1;
  /* o centro de baixo do móvel, no piso */
  const [x, y] = tela(i + w / 2, j + d / 2);
  /* tamanho base da imagem (ajustado pela escala do móvel) */
  const imgW = Math.max(w, d) * TW * 2 * escala;
  const imgH = imgW * 0.8;
  const left = ((x - imgW / 2 - vb.x) / vb.w) * 100;
  const top = ((y - imgH + (hm.dy ?? 0) - vb.y) / vb.h) * 100;
  return (
    <div className="habbo-movel" style={{ left: pct(left), top: pct(top), width: pct((imgW / vb.w) * 100), zIndex: z }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urlMovel(hm.classname, hm.direction)} alt={id} loading="lazy" draggable={false} />
    </div>
  );
});

/* ---------- boneco Habbo (avatar posicionado no piso) ---------- */
const BonecoHabbo = memo(function BonecoHabbo({ b, f, eu, z, vb }: { b: B; f: Rosto; eu: boolean; z: number; vb: Caixa2D }) {
  const dir = habboDir(b.sentido);
  const action = b.quadro > 0 ? "wlk" : "std";
  const figure = figureDe(f.name ?? b.name);
  const [x, y] = tela(b.i + 0.5, b.j + 0.5);
  const left = ((x - ANCORA.x - vb.x) / vb.w) * 100;
  const top = ((y - ANCORA.y - vb.y) / vb.h) * 100;
  return (
    <div className={"habbo-boneco" + (eu ? " eu" : "")} style={{ left: pct(left), top: pct(top), width: pct((CEL_W / vb.w) * 100), height: pct((CEL_H / vb.h) * 100), zIndex: z }}>
      <span className="boneco-nome">{b.name}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="habbo-avatar" src={urlAvatar(figure, dir, action)} alt={b.name} draggable={false} />
    </div>
  );
});

/* ---------- view principal ---------- */
export function HabboView({ hidden }: { hidden: boolean }) {
  const bonecos = useHall((s) => s.bonecos);
  const aviso = useHall((s) => s.aviso);
  const friends = useApp((s) => s.friends);
  const vb = useVB();
  const [destaque, setDestaque] = useState<Piso | null>(null);
  const [pisca, setPisca] = useState(0);

  useEffect(() => {
    iniciarHall();
    iniciarGanhos();
    iniciarChegadas();
  }, []);

  const { z } = useMemo(() => camadasHall(bonecos), [bonecos]);

  const tocar = (e: MouseEvent<HTMLDivElement>) => {
    const [x, y] = noSvg(e, vb);
    const piso = pisoNaTela(x, y);
    if (piso && livre(piso.i, piso.j)) andarAte(piso);
  };

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const piso = pisoLivreNaTela(...noSvg(e, vb));
    setDestaque((d) => (mesmoPiso(d, piso) ? d : piso));
  };

  const tocou = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    const piso = pisoLivreNaTela(...noSvg(e, vb));
    setDestaque(piso);
    if (piso) setPisca((n) => n + 1);
  };

  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = SETAS[e.key];
    if (!d || e.target !== e.currentTarget) return;
    e.preventDefault();
    andarUmPiso(d[0], d[1]);
  };

  return (
    <section id="view-habbo" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>K-FOFO Teste <small className="habbo-tag">Habbo Edition</small></h1>
      </header>
      <div className="hall hall-area habbo-sala">
        <div
          className="hall-palco"
          style={{ aspectRatio: `${vb.w} / ${vb.h}` }}
          tabIndex={0}
          role="group"
          aria-label="K-FOFO Teste com assets do Habbo. Clique no chão ou use as setas para andar."
          onClick={tocar}
          onKeyDown={tecla}
          onPointerMove={mover}
          onPointerLeave={() => setDestaque(null)}
          onPointerDown={tocou}
        >
          <ParedesHabbo vb={vb} />
          <PisoHabbo vb={vb} />
          <Destaque piso={destaque} vb={vb} pisca={pisca} />
          {MOVEIS.map((m, k) => (
            <MovelHabbo key={m.id} id={m.id} i={m.i} j={m.j} w={m.w} d={m.d} z={z[k]} vb={vb} />
          ))}
          {bonecos.map((b, k) => (
            <BonecoHabbo
              key={b.key}
              b={b}
              f={friendDaPresenca(b, friends) || { name: b.name }}
              eu={b.key === MY_KEY}
              z={z[MOVEIS.length + k]}
              vb={vb}
            />
          ))}
          <BaloesHall bonecos={bonecos} vb={vb} />
        </div>
        <div className="hall-esq">
          <NaSala />
          <Chegadas />
        </div>
        <Ganhos />
        <div className="hall-bolso">
          <CarteiraCanto />
          <ChatBarra />
        </div>
        <Dica />
      </div>
      <p className="hall-aviso" aria-live="polite">{aviso}</p>
      <HistoricoChat />
    </section>
  );
}
