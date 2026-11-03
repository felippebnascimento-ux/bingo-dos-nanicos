"use client";
/*
 * Aba Sítio (tela inicial): o hall do Sítio do Mitz com o boneco de quem está no site.
 * Clique ou toque no chão para andar; pelo teclado, as setas andam um piso. A TV abre o Ao vivo,
 * a mesa de jogos abre o Truco e a geladeira da cozinha é a Loja. Nos cantos: quem está na sala, os ganhos de
 * moedas de todo mundo e a sua carteira.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useTruco } from "@/features/truco/mesa";
import { friendDaPresenca, getApp, MY_KEY, setApp, useApp } from "@/lib/store";
import { assistirLive } from "@/components/shell/People";
import { andarAte, andarUmPiso, iniciarHall, useHall } from "./bonecos";
import { Boneco } from "./Boneco";
import { BotaoCelular } from "@/features/celular/Celular";
import { Missoes } from "@/features/missoes/Missoes";
import { CarteiraCanto, Dica, Ganhos, NaSala } from "./Cantos";
import { MochilaCanto } from "@/features/loja/MochilaPainel";
import { iniciarGanhos } from "./ganhos";
import { cambalear } from "./zoeira";
import { iniciarZoeira, useZoeira } from "./zoeiraSala";
import { MenuBoneco, Revidar, ZoeiraCamada } from "./ZoeiraTela";
import { PerfilCartao } from "./PerfilCartao";
import { BotaoQuadro, QuadroTrofeus } from "./QuadroTrofeus";
import { iniciarEventos } from "./eventosSala";
import { ConsumoCamada, EfeitoCanto } from "@/features/loja/Itens";
import { balanco } from "@/features/loja/loja";
import { iniciarConsumo, useConsumo } from "@/features/loja/consumoSala";
import { ChurrascoCamada, FaixaEvento, LuzHappy, PlacaChurrasco } from "./EventosTela";
import { useRanking } from "@/features/moedas/Ranking";
import { enfeites } from "@/features/trofeus/trofeus";
import { useTrofeus } from "@/features/trofeus/trofeusDados";
import { assentoNaTela, camadasHall, CLICAVEIS, livre, MOVEIS, pisoLivreNaTela, pisoNaTela, VB_ESTREITO, VB_LARGO, type Caixa2D, type Clicavel, type Piso } from "./hall";
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

  /* z-index de cada móvel, encosto e boneco, do fundo para a frente (quem senta fica por cima do estofado) */
  const { z, encosto } = useMemo(() => camadasHall(bonecos), [bonecos]);

  /* tocar no chão anda; tocar num sofá ou poltrona leva o boneco até lá e senta */
  const tocar = (e: MouseEvent<HTMLDivElement>) => {
    const [x, y] = noSvg(e, vb);
    const piso = pisoNaTela(x, y);
    if (piso && livre(piso.i, piso.j)) return andarAte(piso);
    const assento = assentoNaTela(x, y);
    if (assento) andarAte(assento.chegar, assento.id);
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
    else if (c === "tv") {
      /* a TV assiste direto quem estiver transmitindo (de outra sala, entra só para ver); senão, abre o Ao vivo */
      const p = getApp().online.find((x) => x.live && x.key !== MY_KEY);
      if (p) assistirLive(p.key, p.sala);
      else setApp({ aba: "live" });
    }
    else if (c === "truco") setApp({ aba: "truco" });
    else if (c === "trofeus") setApp({ aba: "trofeus" });
    else setApp({ aba: "loja" });
  };
  const tv = tvCaixa(vb);

  return (
    <section id="view-hall" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>K-FOFO</h1>
      </header>
      <FaixaEvento />
      <div className="hall hall-area">
        <div
          className="hall-palco"
          style={{ aspectRatio: `${vb.w} / ${vb.h}` }}
          tabIndex={0}
          role="group"
          aria-label="Hall do K-FOFO. Clique no chão ou use as setas para andar."
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
          {Object.entries(encosto).map(([id, ze]) => (
            <MovelCamada key={"encosto-" + id} id={id} z={ze} vb={vb} encosto />
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
        <div className="hall-bolso">
          <CarteiraCanto />
          <MochilaCanto />
        </div>
        <Missoes canto />
        <BotaoCelular className="hall-canto hall-celular" />
        <Dica />
        <Revidar />
        <EfeitoCanto />
        {(() => {
          /* o cartão do perfil de quem eu toquei (inclusive eu), no canto de baixo à direita */
          const b = menu ? bonecos.find((x) => x.key === menu) : null;
          return b ? <PerfilCartao key={b.key} b={b} /> : null;
        })()}
      </div>
      <p className="hall-aviso" aria-live="polite">
        {aviso}
      </p>
    </section>
  );
}
