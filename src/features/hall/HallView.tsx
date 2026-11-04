"use client";
/*
 * Aba Sítio (tela inicial): o hall do Sítio do Mitz com o boneco de quem está no site.
 * Clique ou toque no chão para andar; pelo teclado, as setas andam um piso. A TV abre o Ao vivo,
 * a mesa de jogos abre o Truco e a geladeira da cozinha é a Loja. Nos cantos: quem está na sala, os ganhos de
 * moedas de todo mundo e a sua carteira.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useTruco, verMesa } from "@/features/truco/mesa";
import { iniciarMesaVerde, useMesaVerde } from "./trucoSala";
import { AssistindoJanela, PlacarMesaVerde } from "./MesaVerde";
import { friendDaPresenca, getApp, MY_KEY, setApp, useApp } from "@/lib/store";
import { assistirLive } from "@/components/shell/People";
import { andarAte, andarUmPiso, iniciarHall, useHall } from "./bonecos";
import { Boneco } from "./Boneco";
import { BotaoCelular } from "@/features/celular/Celular";
import { Missoes } from "@/features/missoes/Missoes";
import { BotaoBolsa, CarteiraCanto, Dica, Ganhos, NaSala } from "./Cantos";
import { MochilaCanto } from "@/features/loja/MochilaPainel";
import { Chegadas, iniciarChegadas } from "./Chegadas";
import { iniciarGanhos } from "./ganhos";
import { cambalear } from "./zoeira";
import { iniciarZoeira, useZoeira } from "./zoeiraSala";
import { MenuBoneco, Revidar, ZoeiraCamada } from "./ZoeiraTela";
import { PerfilCartao } from "./PerfilCartao";
import { iniciarEventos } from "./eventosSala";
import { ConsumoCamada, EfeitoCanto } from "@/features/loja/Itens";
import { balanco } from "@/features/loja/loja";
import { iniciarConsumo, useConsumo } from "@/features/loja/consumoSala";
import { ChurrascoCamada, FaixaEvento, LuzHappy, PlacaChurrasco } from "./EventosTela";
import { useRanking } from "@/features/moedas/Ranking";
import { enfeites } from "@/features/trofeus/trofeus";
import { useTrofeus } from "@/features/trofeus/trofeusDados";
import { assentoNaTela, CADEIRAS_TRUCO, camadasHall, CLICAVEIS, livre, MOVEIS, naMesaVerde, pisoDaPlateia, pisoLivreNaTela, pisoNaTela, VB_ESTREITO, VB_LARGO, type Caixa2D, type Clicavel, type Piso } from "./hall";
import { Destaque, emPorcento, FeltroTruco, Fundo, MovelCamada, tvCaixa } from "./Sala";
import { BotaoMeuQuarto, QuartoVisita, TopoQuarto } from "@/features/quarto/QuartoVisita";
import { BaloesHall, ChatBarra, HistoricoChat } from "./ChatHabbo";
import { BotaoMural, MuralJanela, QuadroMural } from "./Mural";
import { BotaoPedro, DiscoCamada, QuadroPedro } from "./Pedro";
import { festaAtiva, usePedro } from "./pedroDados";
import { abrirMural } from "./muralDados";
import { CampeoesSelados } from "./CampeoesSelados";
import { useRef } from "react";
import { Lupa, ZoomCaixa } from "./Lupa";
import { irParaQuarto } from "@/features/quarto/visita";
import { BotaoNavegador } from "@/features/quarto/NavegadorQuartos";
import { iniciarGatilhos } from "@/features/quarto/gatilhos";
import { BotaoGrupos } from "@/features/grupos/GruposJanela";

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
  const brilhos = useHall((s) => s.brilhos);
  /* fase 35: no quarto de alguém, a cena troca (a aba continua a do K-FOFO) */
  const quarto = useApp((s) => s.meuQuarto);
  const friends = useApp((s) => s.friends);
  const aoVivo = useApp((s) => !!s.myLiveSid || s.online.some((p) => p.live && p.key !== MY_KEY));
  const naMesa = useTruco((s) => s.mesas.reduce((n, m) => n + m.lugares.filter(Boolean).length, 0));
  const vb = useVB();
  const temSalas = useApp((s) => s.salas.length > 0);
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
    iniciarGatilhos();
    iniciarGanhos();
    iniciarZoeira();
    iniciarEventos();
    iniciarConsumo();
    iniciarChegadas();
    iniciarMesaVerde();
  }, []);

  /* truco na mesa verde (fase 32): quem joga aparece sentado na cadeira do seu lugar, sem mudar a presença */
  const mv = useMesaVerde();
  const vistos = useMemo(
    () => bonecos.map((b) => (b.fid && mv.sentados[b.fid] ? { ...b, senta: CADEIRAS_TRUCO[mv.sentados[b.fid].cadeira].id } : b)),
    [bonecos, mv.sentados],
  );
  const [assistindo, setAssistindo] = useState<string | null>(null);
  /* a porta de vidro abre um menu: a rua, o corredor dos quartos e as salas da lan house */
  const [porta, setPorta] = useState(false);
  const fecharAssistindo = useCallback(() => setAssistindo(null), []);

  /* z-index de cada móvel, encosto e boneco, do fundo para a frente (quem senta fica por cima do estofado) */
  const { z, encosto } = useMemo(() => camadasHall(vistos), [vistos]);

  /* tocar no chão anda; tocar num sofá ou poltrona leva o boneco até lá e senta */
  const tocar = (e: MouseEvent<HTMLDivElement>) => {
    const [x, y] = noSvg(e, vb);
    const piso = pisoNaTela(x, y);
    if (piso && livre(piso.i, piso.j)) return andarAte(piso);
    /* tocar na mesa verde é como tocar na placa do Truco */
    if (piso && naMesaVerde(piso)) return abrir("truco");
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

  const bau = useRef<HTMLDialogElement>(null);
  const abrir = (c: Clicavel["id"]) => {
    if (c === "salas") setPorta((v) => !v);
    else if (c === "tv") {
      /* a TV assiste direto quem estiver transmitindo (de outra sala, entra só para ver); senão, abre o Ao vivo */
      const p = getApp().online.find((x) => x.live && x.key !== MY_KEY);
      if (p) assistirLive(p.key, p.sala);
      else setApp({ aba: "live" });
    }
    else if (c === "truco") {
      /* com partida na mesa verde, o meu boneco chega perto para assistir e abre a janela; sem partida, a aba Truco */
      const m = useMesaVerde.getState().mesa;
      if (m && m.fase === "jogo") {
        const outros = bonecos.filter((b) => b.key !== MY_KEY).map((b) => ({ i: Math.round(b.i), j: Math.round(b.j) }));
        andarAte(pisoDaPlateia(outros));
        verMesa(m.id);
        setAssistindo(m.id);
      } else setApp({ aba: "truco" });
    }
    else if (c === "mural") abrirMural();
    else if (c === "banheiro") irParaQuarto("banheiro");
    else if (c === "bau") bau.current?.showModal();
    else setApp({ aba: "loja" });
  };
  const tv = tvCaixa(vb);
  /* o Pedro tocando: a discoteca acende e todo mundo dança */
  const disco = usePedro((s) => festaAtiva(s.festa));

  return (
    <section id="view-hall" className="inner" hidden={hidden}>
      <CampeoesSelados dialogRef={bau} friends={friends} />
      {quarto ? (
        <TopoQuarto dono={quarto} />
      ) : (
        <header className="hero">
          <h1>K-FOFO</h1>
        </header>
      )}
      <FaixaEvento />
      <div className="hall hall-area">
        <ZoomCaixa>
        {quarto ? (
          <QuartoVisita dono={quarto} />
        ) : (
        <div
          className={"hall-palco" + (disco ? " disco" : "")}
          style={{ aspectRatio: `${vb.w} / ${vb.h}` }}
          tabIndex={0}
          role="group"
          aria-label="Hall do K-FOFO. Clique no chão ou use as setas para andar."
          onClick={(e) => {
            setPorta(false);
            tocar(e);
          }}
          onKeyDown={tecla}
          onPointerMove={mover}
          onPointerLeave={() => setDestaque(null)}
          onPointerDown={tocou}
        >
          <Fundo aoVivo={aoVivo} vb={vb} />
          <QuadroMural vb={vb} />
          <QuadroPedro vb={vb} />
          <Destaque piso={destaque} vb={vb} pisca={pisca} />
          {MOVEIS.map((m, k) => (
            <MovelCamada key={m.id} id={m.id} z={z[k]} vb={vb} />
          ))}
          {Object.entries(encosto)
            .filter(([id]) => id !== "feltro")
            .map(([id, ze]) => (
              <MovelCamada key={"encosto-" + id} id={id} z={ze} vb={vb} encosto />
            ))}
          <FeltroTruco z={encosto.feltro} vb={vb} jogadas={mv.jogadas} />
          {vistos.map((b, k) => (
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
              cartas={b.fid ? mv.sentados[b.fid]?.cartas : undefined}
              fala={b.fid ? mv.sentados[b.fid]?.fala : undefined}
            />
          ))}
          <ChurrascoCamada vb={vb} z={z[CHURRASQUEIRA]} />
          <ZoeiraCamada bonecos={bonecos} vb={vb} />
          <ConsumoCamada bonecos={vistos} vb={vb} />
          <BaloesHall bonecos={vistos} vb={vb} />
          <LuzHappy />
          <DiscoCamada />
          {/* o brilho do teletransporte de quem foi para um quarto ou voltou */}
          {brilhos.map((b) => {
            const pos = emPorcento(vb, b.i + 0.5, b.j + 0.5, 50);
            return <span key={b.id} className="hall-brilho" style={{ left: pct(pos.left), top: pct(pos.top) }} aria-hidden="true" />;
          })}
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
          <BotaoMural vb={vb} />
          <BotaoPedro vb={vb} />
          <PlacaChurrasco vb={vb} />
          {CLICAVEIS.map((c) => {
            const pos = emPorcento(vb, c.rotulo.i, c.rotulo.j, c.rotulo.z);
            const rotulo = c.id === "bau" ? "Campeões Selados" : c.id === "tv" ? "Ao vivo" : c.id === "truco" ? (mv.mesa ? "Truco · ao vivo" : "Truco") : c.id === "salas" ? "Rua · Salas" : c.id === "mural" ? "Mural" : c.id === "banheiro" ? "Banheiro" : "Loja";
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
                {c.id === "truco" && mv.mesa && <span className="hall-placa-dot" aria-hidden="true" />}
                {c.id === "truco" && mv.mesa && <PlacarMesaVerde />}
                {c.id === "truco" && !mv.mesa && naMesa > 0 && <small>{naMesa} na mesa</small>}
              </button>
            );
          })}
          {porta &&
            (() => {
              const pos = emPorcento(vb, 0, 5.6, 140);
              return (
                <div className="boneco-menu hall-porta-menu" role="menu" aria-label="Para onde ir" style={{ left: pct(pos.left), top: pct(pos.top) }} onClick={(e) => e.stopPropagation()}>
                  <button type="button" role="menuitem" onClick={() => (setPorta(false), irParaQuarto("rua"))}>
                    Ir para a rua
                  </button>
                  <button type="button" role="menuitem" onClick={() => (setPorta(false), irParaQuarto("corredor"))}>
                    Corredor dos quartos
                  </button>
                  <button type="button" role="menuitem" onClick={() => (setPorta(false), irParaQuarto("arena"))}>
                    Arena de pintar o chão
                  </button>
                  <button type="button" role="menuitem" onClick={() => (setPorta(false), irParaQuarto("pirapo"))}>
                    🔑 Pirapó 114
                  </button>
                  {temSalas && (
                    <button type="button" role="menuitem" onClick={() => (setPorta(false), setApp({ salasAberto: true }))}>
                      Salas da lan house
                    </button>
                  )}
                </div>
              );
            })()}
          {(() => {
            const b = menu ? bonecos.find((x) => x.key === menu && x.key !== MY_KEY) : null;
            return b ? <MenuBoneco key={b.key} b={b} vb={vb} /> : null;
          })()}
        </div>
        )}
        </ZoomCaixa>
        <Lupa />
        <div className="hall-esq">
          <NaSala />
          <Chegadas />
        </div>
        <Ganhos />
        <div className="hall-bolso">
          <CarteiraCanto />
          <MochilaCanto />
          <BotaoMeuQuarto />
          <BotaoNavegador />
          <BotaoGrupos />
          <BotaoBolsa />
          <ChatBarra />
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
      <MuralJanela />
      <HistoricoChat />
      {assistindo && <AssistindoJanela id={assistindo} fechar={fecharAssistindo} />}
    </section>
  );
}
