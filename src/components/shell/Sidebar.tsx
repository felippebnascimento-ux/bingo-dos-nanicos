"use client";
import { useEffect, type ComponentType } from "react";
import { IcAjustes, IcAoVivo, IcCassino, IcInicio, IcJogar, IcSitio, IcNanicadas, IcNanicos, IcPerfil, IcTruco, IcVoltar } from "@/components/ui/icones";
import { fecharSeletores } from "@/components/ui/FriendPicker";
import { Avatar } from "@/components/ui/Avatar";
import { CamBotoes } from "@/features/live/CamBotoes";
import { CarteiraChip } from "@/features/moedas/Moedas";
import { VERSION } from "@/lib/dados/changelog";
import { temNovidade } from "@/lib/dados/novidades";
import { CREW, MARCA } from "@/lib/dados/nanicos";
import { friendOf, MY_KEY, salaLol, setApp, useApp } from "@/lib/store";
import type { Aba } from "@/lib/tipos";
import { local } from "@/lib/util";
import { nomeDaSala } from "@/features/salas/trocar";
import { Canais, VozPainel } from "./Canais";

const ABAS: { aba: Aba; t: string; Ic: ComponentType }[] = [
  { aba: "inicio", t: "Início", Ic: IcInicio },
  { aba: "hall", t: "Sítio", Ic: IcSitio },
  { aba: "jogar", t: "Jogar", Ic: IcJogar },
  { aba: "frases", t: "Nanicadas", Ic: IcNanicadas },
  { aba: "nanicos", t: "Nanicos", Ic: IcNanicos },
  { aba: "live", t: "Ao vivo", Ic: IcAoVivo },
  { aba: "truco", t: "Truco", Ic: IcTruco },
  { aba: "cassino", t: "Cassino", Ic: IcCassino },
  { aba: "perfil", t: "Perfil", Ic: IcPerfil },
];

export function setSideMin(on: boolean) {
  setApp({ sideMin: on });
  local.set("side-min", on ? "1" : "0");
}

function Nav() {
  const aba = useApp((s) => s.aba);
  const nFrases = useApp((s) => s.phrases.length);
  const nAmigos = useApp((s) => s.friends.length);
  const nLive = useApp((s) => s.onlineSala.filter((p) => p.live && p.key !== MY_KEY).length + (s.myLiveSid ? 1 : 0));
  const nTruco = useApp((s) => s.trucoAbertas);
  const unread = useApp((s) => s.chatUnread > 0);
  /* o item Perfil mostra o meu rosto (sem nanico, continua o ícone) */
  const eu = useApp((s) => friendOf(s.myFid, s.friends));
  /* a aba Jogar (escalação e bingo) só existe nas salas de LoL; sem o SQL das salas, sempre aparece */
  const temJogar = useApp((s) => !s.salas.length || !!salaLol(s));
  const temSalas = useApp((s) => s.salas.length > 0);

  const contagem = (a: Aba) => {
    if (a === "frases") return <span className="count" id="nFrases">{nFrases || ""}</span>;
    if (a === "nanicos") return <span className="count" id="nAmigos">{nAmigos || ""}</span>;
    if (a === "live") return <span className={"count" + (nLive ? " on" : "")} id="nLive">{nLive ? `● ${nLive}` : ""}</span>;
    if (a === "truco") return <span className={"count" + (nTruco ? " on" : "")} id="nTruco">{nTruco ? `● ${nTruco}` : ""}</span>;
    return null;
  };

  return (
    <nav className="nav" role="tablist" aria-label="Seções">
      {ABAS.filter((x) => x.aba !== "jogar" || temJogar).map(({ aba: a, t, Ic }) => (
        <button
          key={a}
          role="tab"
          aria-selected={aba === a}
          data-tab={a}
          id={a === "live" ? "navLive" : undefined}
          /* com salas, o Ao vivo se abre pelos canais de voz; o item fica só na barra de abas do celular */
          className={[a === "live" && unread ? "unread" : "", a === "live" && temSalas ? "so-celular" : ""].join(" ").trim() || undefined}
          title={t}
          onClick={() => {
            setApp({ aba: a });
            fecharSeletores();
          }}
        >
          {a === "perfil" && eu ? <Avatar f={eu} size="xs" className="nav-rosto" /> : <Ic />}
          <span className="t">{t}</span>
          {contagem(a)}
        </button>
      ))}
    </nav>
  );
}

/** Eu, embaixo do menu: rosto, nome e onde estou (abre o Perfil), as moedas e a engrenagem das Configurações. */
function EuPainel() {
  const eu = useApp((s) => friendOf(s.myFid, s.friends));
  const myName = useApp((s) => s.myName);
  const sala = useApp((s) => nomeDaSala(s.minhaSala, s.salas));
  const temSalas = useApp((s) => s.salas.length > 0);
  const naAba = useApp((s) => s.aba === "perfil");
  const naConfig = useApp((s) => s.configAberto);
  if (!myName) return null;
  return (
    <div className="eu-painel">
      <button type="button" className={"eu" + (naAba ? " on" : "")} aria-current={naAba ? "page" : undefined} title="Abrir o meu perfil" onClick={() => setApp({ aba: "perfil" })}>
        {eu ? <Avatar f={eu} /> : <span className="av">{myName[0]}</span>}
        <span className="eu-txt">
          <b>{eu?.name ?? myName}</b>
          {temSalas && <small>{sala ?? "No lobby"}</small>}
        </span>
      </button>
      <CarteiraChip />
      <button type="button" className={"eu-cfg" + (naConfig ? " on" : "")} aria-label="Configurações" title="Configurações" aria-expanded={naConfig} onClick={() => setApp({ configAberto: true })}>
        <IcAjustes />
      </button>
    </div>
  );
}

/** Barra lateral: marca, navegação e canais (rolam); embaixo, fixos, voz, câmera, eu, moedas e rodapé. No celular vira faixa no topo. */
export function Sidebar() {
  const sideMin = useApp((s) => s.sideMin);
  const conn = useApp((s) => s.conn);
  /* selo de novidade: o mesmo "já vi" do Log (conta, com o navegador de reserva) */
  const logNovo = useApp((s) => !s.logAberto && temNovidade(s.logVisto));
  const mostraCam = useApp((s) => !!s.myVozSid || !!s.myCamSid || !s.salas.length);

  useEffect(() => {
    document.body.classList.toggle("side-min", sideMin);
  }, [sideMin]);

  return (
    <aside className="side">
      <button
        className="side-toggle"
        id="sideToggle"
        type="button"
        aria-label={sideMin ? "Abrir menu" : "Recolher menu"}
        title={sideMin ? "Abrir menu" : "Recolher menu"}
        aria-expanded={!sideMin}
        onClick={() => setSideMin(!sideMin)}
      >
        <IcVoltar />
      </button>
      {/* a parte de cima rola; a de baixo (voz, câmera, eu e moedas) fica sempre à vista, como no Discord */}
      <div className="side-rolagem">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-mini" id="brandMini" src={MARCA} alt="Bingo dos Nanicos" onClick={() => setApp({ aba: "inicio" })} />
        {/* a marca leva de volta ao Início */}
        <button type="button" className="brand" aria-label="Bingo dos Nanicos: voltar ao Início" onClick={() => setApp({ aba: "inicio" })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-img" src={CREW} alt="Os Nanicos" width={1100} height={681} decoding="async" />
          <div className="brand-txt">
            <small>Bingo dos</small>
            <b>
              Nanicos<i>.</i>
            </b>
          </div>
        </button>

        <Nav />
        <Canais />
      </div>

      <div className="side-base">
        <VozPainel />
        {/* a câmera é da voz: o botão aparece na voz (ou com a câmera ligada, para dar para desligar) */}
        {mostraCam && <CamBotoes />}
        <EuPainel />
        {/* trocar senha e sair ficam nas Configurações */}
        <div className="side-foot">
          <div className="foot-row">
            <span className="conn" id="conn">{conn}</span>
            <span className="ver" id="ver">{VERSION}</span>
            <button
              className={"log-btn" + (logNovo ? " new" : "")}
              id="logBtn"
              type="button"
              aria-label="Ver o que mudou em cada versão"
              onClick={() => setApp({ logAberto: true })}
            >
              Log
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
