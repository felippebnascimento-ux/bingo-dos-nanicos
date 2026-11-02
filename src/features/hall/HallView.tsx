"use client";
/*
 * Aba Sítio (tela inicial): o hall do Sítio do Mitz com o boneco de quem está no site.
 * Clique ou toque no chão para andar; pelo teclado, as setas andam um piso. A TV abre o Ao vivo,
 * a mesa verde abre o Truco e a geladeira é a Loja. Nos cantos: quem está na sala, os ganhos de
 * moedas de todo mundo e a sua carteira.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useTruco } from "@/features/truco/mesa";
import { friendDaPresenca, MY_KEY, setApp, useApp } from "@/lib/store";
import { andarAte, andarUmPiso, iniciarHall, useHall } from "./bonecos";
import { Boneco } from "./Boneco";
import { CarteiraCanto, Dica, Ganhos, NaSala } from "./Cantos";
import { iniciarGanhos } from "./ganhos";
import { cambalear } from "./zoeira";
import { iniciarZoeira, useZoeira } from "./zoeiraSala";
import { MenuBoneco, Revidar, ZoeiraCamada } from "./ZoeiraTela";
import { BotaoQuadro, QuadroTrofeus } from "./QuadroTrofeus";
import { iniciarEventos } from "./eventosSala";
import { ConsumoCamada } from "@/features/loja/Itens";
import { balanco } from "@/features/loja/loja";
import { iniciarConsumo, useConsumo } from "@/features/loja/consumoSala";
import { ChurrascoCamada, FaixaEvento, LuzHappy, PlacaChurrasco } from "./EventosTela";
import { useRanking } from "@/features/moedas/Ranking";
import { enfeites } from "@/features/trofeus/trofeus";
import { useTrofeus } from "@/features/trofeus/trofeusDados";
import { caixaDoBoneco, caixaDoMovel, CLICAVEIS, MOVEIS, ordemZ, pisoLivreNaTela, pisoNaTela, VB_ESTREITO, VB_LARGO, type Caixa2D, type Clicavel, type Piso } from "./hall";
import { Destaque, emPorcento, Fundo, MovelCamada, tvCaixa } from "./Sala";

/** Setas → um piso: direita/esquerda seguem a parede da direita, cima/baixo a da esquerda. */
const SETAS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

/* tela estreita: o cômodo ocupa tudo e os cantos vão para fora dele */
const ESTREITO = "(max-width: 760px)";
const assinarTela = (cb: () => void) => {
  const m = matchMedia(ESTREITO);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useVB = (): Caixa2D => (useSyncExternalStore(assinarTela, () => matchMedia(ESTREITO).matches, () => false) ? VB_ESTREITO : VB_LARGO);

const pct = (v: number) => `${v}%`;

/** Ponto do mouse (em coordenadas do SVG) dentro do palco. */
function noSvg(e: { clientX: number; clientY: number; currentTarget: Element }, vb: Caixa2D) {
  const r = e.currentTarget.getBoundingClientRect();
  return [vb.x + ((e.clientX - r.left) / r.width) * vb.w, vb.y + ((e.clientY - r.top) / r.height) * vb.h] as const;
}

/* a brasa e a fumaça ficam na mesma camada da churrasqueira (quem passa na frente cobre) */
const CHURRASQUEIRA = MOVEIS.findIndex((m) => m.id === "churrasqueira");

const mesmoPiso = (a: Piso | null, b: Piso | null) => a === b || (!!a && !!b && a.i === b.i && a.j === b.j);

export function HallView({ hidden }: { hidden: boolean }) {
  const bonecos = useHall((s) => s.bonecos);
  const aviso = useHall((s) => s.aviso);
  const friends = useApp((s) => s.friends);
  const aoVivo = useApp((s) => !!s.myLiveSid || s.online.some((p) => p.live && p.key !== MY_KEY));
  const naMesa = useTruco((s) => s.mesas.reduce((n, m) => n + m.lugares.filter(Boolean).length, 0));
  const vb = useVB();
  const temSalas = useApp((s) => s.salas.length > 0);
  const temTrofeus = useTrofeus((s) => !!s.linhas?.length);
  const [destaque, setDestaque] = useState<Piso | null>(null);
  const [pisca, setPisca] = useState(0);

  const menu = useZoeira((s) => s.menu);
  const trofeus = useTrofeus((s) => s.linhas);
  const ranking = useRanking();
  /* chapéu de burro, coroa dourada e a coroa de moedas do mais rico (troca na hora em que alguém passa) */
  const maisRico = ranking?.[0]?.saldo != null ? ranking[0].fid : null;
  const enfeite = useMemo(() => enfeites(trofeus ?? [], trofeus?.[0]?.semana ?? null, maisRico), [trofeus, maisRico]);
  const pancada = useZoeira((s) => s.pancada);
  const agora = useZoeira((s) => s.agora);
  /* quem tomou energético treme e quem tomou caipirinha fica tonto */
  const consumos = useConsumo((s) => s.ativos);
  const agoraC = useConsumo((s) => s.agora);

  useEffect(() => {
    iniciarHall();
    iniciarGanhos();
    iniciarZoeira();
    iniciarEventos();
    iniciarConsumo();
  }, []);

  /* z-index de cada móvel e boneco, do fundo para a frente */
  const z = useMemo(() => {
    const caixas = [...MOVEIS.map(caixaDoMovel), ...bonecos.map((b) => caixaDoBoneco(b.i, b.j))];
    const out: number[] = [];
    ordemZ(caixas).forEach((k, pos) => (out[k] = pos + 2));
    return out;
  }, [bonecos]);

  const tocar = (e: MouseEvent<HTMLDivElement>) => {
    const piso = pisoNaTela(...noSvg(e, vb));
    if (piso) andarAte(piso);
  };

  /* o destaque só muda quando o piso embaixo do mouse muda */
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const piso = pisoLivreNaTela(...noSvg(e, vb));
    setDestaque((d) => (mesmoPiso(d, piso) ? d : piso));
  };
  /* no celular, o piso tocado pisca o contorno uma vez */
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

  const abrir = (c: Clicavel["id"]) => {
    if (c === "salas") setApp({ salasAberto: true });
    else if (c === "tv") setApp({ aba: "live" });
    else if (c === "truco") setApp({ aba: "truco" });
    else if (c === "trofeus") setApp({ aba: "trofeus" });
    else setApp({ aba: "loja" });
  };
  const tv = tvCaixa(vb);

  return (
    <section id="view-hall" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Sítio do Mitz</h1>
      </header>
      <FaixaEvento />
      <div className="hall hall-area">
        <div
          className="hall-palco"
          style={{ aspectRatio: `${vb.w} / ${vb.h}` }}
          tabIndex={0}
          role="group"
          aria-label="Hall do Sítio. Clique no chão ou use as setas para andar."
          onClick={tocar}
          onKeyDown={tecla}
          onPointerMove={mover}
          onPointerLeave={() => setDestaque(null)}
          onPointerDown={tocou}
        >
          <Fundo aoVivo={aoVivo} vb={vb} />
          <QuadroTrofeus vb={vb} />
          <Destaque piso={destaque} vb={vb} pisca={pisca} />
          {MOVEIS.map((m, k) => (
            <MovelCamada key={m.id} id={m.id} z={z[k]} vb={vb} />
          ))}
          {bonecos.map((b, k) => (
            <Boneco
              key={b.key}
              b={b}
              f={friendDaPresenca(b, friends) || { name: b.name }}
              eu={b.key === MY_KEY}
              z={z[MOVEIS.length + k]}
              vb={vb}
              rot={(() => {
                if (!b.fid) return 0;
                if (pancada[b.fid]) return cambalear(agora - pancada[b.fid]);
                const c = consumos.find((x) => x.fid === b.fid);
                return c ? balanco(c.anim, agoraC - c.inicio) : 0;
              })()}
              enfeite={b.fid ? enfeite[b.fid] : undefined}
            />
          ))}
          <ChurrascoCamada vb={vb} z={z[CHURRASQUEIRA]} />
          <ZoeiraCamada bonecos={bonecos} vb={vb} />
          <ConsumoCamada bonecos={bonecos} vb={vb} />
          <LuzHappy />
          <button
            type="button"
            className="hall-tv"
            tabIndex={-1}
            aria-hidden="true"
            style={{ left: pct(tv.left), top: pct(tv.top), width: pct(tv.width), height: pct(tv.height) }}
            onClick={(e) => {
              e.stopPropagation();
              abrir("tv");
            }}
          />
          <BotaoQuadro vb={vb} />
          <PlacaChurrasco vb={vb} />
          {CLICAVEIS.filter((c) => (c.id !== "salas" || temSalas) && (c.id !== "trofeus" || temTrofeus)).map((c) => {
            const pos = emPorcento(vb, c.rotulo.i, c.rotulo.j, c.rotulo.z);
            const rotulo = c.id === "tv" ? "Ao vivo" : c.id === "truco" ? "Truco" : c.id === "salas" ? "Salas" : c.id === "trofeus" ? "Troféus" : "Loja";
            return (
              <button
                key={c.id}
                type="button"
                className="hall-placa"
                style={{ left: pct(pos.left), top: pct(pos.top) }}
                aria-label={c.id === "loja" ? "Abrir a Loja" : `Abrir o ${rotulo}`}
                onClick={(e) => {
                  e.stopPropagation();
                  abrir(c.id);
                }}
              >
                {rotulo}
                {c.id === "tv" && aoVivo && <span className="live-pill">AO VIVO</span>}
                {c.id === "truco" && naMesa > 0 && <small>{naMesa} na mesa</small>}
              </button>
            );
          })}
          {(() => {
            const b = menu ? bonecos.find((x) => x.key === menu && x.key !== MY_KEY) : null;
            return b ? <MenuBoneco key={b.key} b={b} vb={vb} /> : null;
          })()}
        </div>
        <NaSala />
        <Ganhos />
        <CarteiraCanto />
        <Dica />
        <Revidar />
      </div>
      <p className="hall-aviso" aria-live="polite">
        {aviso}
      </p>
    </section>
  );
}
