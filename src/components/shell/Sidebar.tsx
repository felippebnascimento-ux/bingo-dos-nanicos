"use client";
import { useEffect, type ComponentType } from "react";
import { IcAoVivo, IcJogar, IcNanicadas, IcNanicos, IcPerfil, IcTruco, IcVoltar } from "@/components/ui/icones";
import { fecharSeletores } from "@/components/ui/FriendPicker";
import { CamBotoes } from "@/features/live/CamBotoes";
import { logout } from "@/lib/dados";
import { VERSION } from "@/lib/dados/changelog";
import { CREW, MARCA } from "@/lib/dados/nanicos";
import { MY_KEY, setApp, useApp } from "@/lib/store";
import type { Aba } from "@/lib/tipos";
import { local } from "@/lib/util";
import { People } from "./People";

const ABAS: { aba: Aba; t: string; Ic: ComponentType }[] = [
  { aba: "jogar", t: "Jogar", Ic: IcJogar },
  { aba: "frases", t: "Nanicadas", Ic: IcNanicadas },
  { aba: "nanicos", t: "Nanicos", Ic: IcNanicos },
  { aba: "live", t: "Ao vivo", Ic: IcAoVivo },
  { aba: "truco", t: "Truco", Ic: IcTruco },
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
  const nLive = useApp((s) => s.online.filter((p) => p.live && p.key !== MY_KEY).length + (s.myLiveSid ? 1 : 0));
  const nTruco = useApp((s) => s.trucoAbertas);
  const unread = useApp((s) => s.chatUnread > 0);

  const contagem = (a: Aba) => {
    if (a === "frases") return <span className="count" id="nFrases">{nFrases || ""}</span>;
    if (a === "nanicos") return <span className="count" id="nAmigos">{nAmigos || ""}</span>;
    if (a === "live") return <span className={"count" + (nLive ? " on" : "")} id="nLive">{nLive ? `● ${nLive}` : ""}</span>;
    if (a === "truco") return <span className={"count" + (nTruco ? " on" : "")} id="nTruco">{nTruco ? `● ${nTruco}` : ""}</span>;
    return null;
  };

  return (
    <nav className="nav" role="tablist" aria-label="Seções">
      {ABAS.map(({ aba: a, t, Ic }) => (
        <button
          key={a}
          role="tab"
          aria-selected={aba === a}
          data-tab={a}
          id={a === "live" ? "navLive" : undefined}
          className={a === "live" && unread ? "unread" : undefined}
          title={t}
          onClick={() => {
            setApp({ aba: a });
            fecharSeletores();
          }}
        >
          <Ic />
          <span className="t">{t}</span>
          {contagem(a)}
        </button>
      ))}
    </nav>
  );
}

/** Barra lateral: marca, quem está na sala, navegação, câmera e rodapé. No celular vira faixa no topo. */
export function Sidebar() {
  const sideMin = useApp((s) => s.sideMin);
  const conn = useApp((s) => s.conn);
  /* o site só monta no navegador, então dá para ler o localStorage direto aqui */
  const logAberto = useApp((s) => s.logAberto);
  const logNovo = !logAberto && local.get("log-visto") !== VERSION;

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-mini" id="brandMini" src={MARCA} alt="Bingo dos Nanicos" />
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-img" src={CREW} alt="Os Nanicos" width={1100} height={681} decoding="async" />
        <div className="brand-txt">
          <small>Bingo dos</small>
          <b>
            Nanicos<i>.</i>
          </b>
        </div>
      </div>

      <People />
      <Nav />
      <CamBotoes />

      <div className="side-foot">
        <div className="links">
          <button className="linkish" id="trocarSenha" onClick={() => setApp({ pwAberto: true })}>
            Trocar senha
          </button>
          <button className="linkish" id="sair" onClick={logout}>
            Sair
          </button>
        </div>
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
    </aside>
  );
}
