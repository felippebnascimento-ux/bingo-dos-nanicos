"use client";
import { Avatar } from "@/components/ui/Avatar";
import { ChatPainel } from "@/features/chat/ChatPainel";
import { MiniCartela } from "@/features/jogar/MiniCartela";
import { friendDaPresenca, setApp, useApp } from "@/lib/store";
import type { RailTab } from "@/lib/tipos";
import { initials, local } from "@/lib/util";
import { setLive, useLive, type Fps, type Res } from "./estado";
import { canShare, chromeVer, isChromium, isMac } from "./rtc";
import { LIVE, liveStreams, startLive, stopLive, unwatch, watch } from "./tela";
import { VideoMudo } from "./Video";

/* como mandar o som do jogo: depende do navegador e do sistema */
function ComoSom() {
  if (!isChromium)
    return (
      <li>
        Este navegador não manda som. Para transmitir com o som do jogo, use o <b>Chrome</b> ou o <b>Edge</b>.
      </li>
    );
  if (isMac)
    return (
      <>
        <li>
          Na janela que abrir, escolha <b>Tela inteira</b> e ligue <b>Compartilhar áudio do sistema</b>.
        </li>
        <li>
          No Mac isso só aparece no Chrome 141 ou mais novo e no macOS 14.2 ou mais novo
          {chromeVer && chromeVer < 141 ? ` (o seu Chrome é o ${chromeVer}: atualize em Ajuda › Sobre o Google Chrome)` : ""}.
        </li>
      </>
    );
  return (
    <>
      <li>
        Na janela que abrir, escolha <b>Tela inteira</b> e ligue <b>Compartilhar áudio do sistema</b> (fica embaixo, à
        esquerda).
      </li>
      <li>
        Se escolher só a <b>janela</b> do jogo, o som pode não ir junto, dependendo da versão do navegador.
      </li>
    </>
  );
}

/* transmitindo sem som: diz o que fazer, conforme o que a pessoa escolheu */
function SemSom() {
  if (!isChromium) return <>Sem som: este navegador não transmite áudio. Use o Chrome ou o Edge.</>;
  const s = LIVE.surface;
  if (s === "window")
    return (
      <>
        Sem som: você escolheu uma janela e o navegador não mandou o som dela. Transmita de novo escolhendo{" "}
        <b>Tela inteira</b> com <b>Compartilhar áudio do sistema</b> ligado.
      </>
    );
  if (s === "browser")
    return (
      <>
        Sem som: ao escolher uma aba, ligue <b>Compartilhar áudio da guia</b>.
      </>
    );
  if (isMac)
    return (
      <>
        Sem som: escolha <b>Tela inteira</b> e ligue <b>Compartilhar áudio do sistema</b>. No Mac isso precisa do
        Chrome 141+ e do macOS 14.2+{chromeVer && chromeVer < 141 ? ` (o seu Chrome é o ${chromeVer})` : ""}.
      </>
    );
  return (
    <>
      Sem som: a opção <b>Compartilhar áudio do sistema</b> estava desligada. Transmita de novo e ligue essa opção (fica
      embaixo, à esquerda, na janela de escolher a tela).
    </>
  );
}

/** "Sua tela": escolher a qualidade e transmitir, ou ver quem está assistindo. */
function SuaTela() {
  useLive((s) => s.v);
  const fps = useLive((s) => s.fps);
  const res = useLive((s) => s.res);

  if (!LIVE.mySid) {
    const mudaRes = (r: Res) => {
      setLive({ res: r });
      local.set("live-res", String(r));
    };
    const mudaFps = (f: Fps) => {
      setLive({ fps: f });
      local.set("live-fps", String(f));
    };
    return (
      <div className="block" id="selfBlock">
        <h2>Sua tela</h2>
        {canShare ? (
          <>
            <span className="seg-lbl" id="lblRes">
              Qualidade
            </span>
            <div className="seg" role="radiogroup" aria-labelledby="lblRes">
              <button type="button" role="radio" data-res="1440" aria-checked={res === 1440} onClick={() => mudaRes(1440)}>
                1440p · 2K
              </button>
              <button type="button" role="radio" data-res="1080" aria-checked={res === 1080} onClick={() => mudaRes(1080)}>
                1080p
              </button>
            </div>
            <div className="seg" role="radiogroup" aria-label="Fluidez">
              <button type="button" role="radio" data-fps="60" aria-checked={fps === 60} onClick={() => mudaFps(60)}>
                60 fps
              </button>
              <button type="button" role="radio" data-fps="30" aria-checked={fps === 30} onClick={() => mudaFps(30)}>
                30 fps
              </button>
            </div>
            <button className="btn" id="goLive" style={{ width: "100%" }} onClick={startLive}>
              Transmitir minha tela
            </button>
            <details className="howto-d">
              <summary>Como mandar o som do jogo</summary>
              <ol className="howto">
                <ComoSom />
                {res === 1440 && (
                  <li>
                    1440p só sai em 2K se o seu monitor for 1440p ou maior, e pede uns 20 Mbps de upload por pessoa
                    assistindo.
                  </li>
                )}
                <li>Se travar para quem assiste, baixe para 30 fps ou 1080p.</li>
              </ol>
            </details>
          </>
        ) : (
          <p className="hint" style={{ margin: 0 }}>
            Transmitir só funciona no navegador do computador. Daqui você pode assistir.
          </p>
        )}
      </div>
    );
  }

  const n = [...LIVE.viewers.values()].filter((v) => v.pc.connectionState === "connected").length;
  return (
    <div className="block" id="selfBlock">
      <h2>Sua tela</h2>
      <div id="selfSlot">
        <VideoMudo stream={LIVE.myStream} className="self-prev" />
      </div>
      <div className="self-live">
        <span className="live-pill">AO VIVO</span>
        <span>{n === 1 ? "1 pessoa assistindo" : n + " pessoas assistindo"}</span>
      </div>
      {LIVE.hasAudio ? (
        <p className="status" style={{ margin: "0 0 10px" }}>
          Som: indo junto.
        </p>
      ) : (
        <>
          <p className="warn">
            <SemSom />
          </p>
          <button
            className="btn sm"
            id="retryAudio"
            style={{ width: "100%", marginBottom: 8 }}
            onClick={() => {
              stopLive();
              startLive();
            }}
          >
            Transmitir de novo com som
          </button>
        </>
      )}
      <button className="btn soft" id="stopLive" style={{ width: "100%" }} onClick={stopLive}>
        Parar transmissão
      </button>
    </div>
  );
}

/** "Transmitindo agora": quem está ao vivo, com assistir / abrir sem som / fechar. */
function Transmitindo() {
  useLive((s) => s.v);
  const online = useApp((s) => s.online);
  const friends = useApp((s) => s.friends);
  const ls = liveStreams(online);
  return (
    <div className="block" id="lcardsBlock" hidden={!ls.length}>
      <h2>Transmitindo agora</h2>
      <div className="lcards" id="lcards">
        {ls.map((p) => {
          const w = LIVE.watching.get(p.key),
            isMain = LIVE.main === p.key && !!w;
          const f = friendDaPresenca(p, friends);
          const st = isMain ? "Tela principal, com som" : w ? "Aberta sem som" : "Ao vivo";
          return (
            <div key={p.key} className={"lcard" + (isMain ? " main" : "")}>
              {f ? <Avatar f={f} /> : <span className="av">{initials(p.name)}</span>}
              <div style={{ minWidth: 0 }}>
                <div className="nm">{f ? f.name : p.name}</div>
                <div className="st">{st}</div>
              </div>
              <div className="acts">
                {isMain ? (
                  <button className="btn soft sm" onClick={() => unwatch(p.key)}>
                    Fechar
                  </button>
                ) : w ? (
                  <>
                    <button className="btn sm" onClick={() => watch(p.key, true)}>
                      Tornar principal
                    </button>
                    <button className="btn soft sm" onClick={() => unwatch(p.key)}>
                      Fechar
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn sm" onClick={() => watch(p.key, true)}>
                      Assistir
                    </button>
                    <button className="btn soft sm" onClick={() => watch(p.key, false)}>
                      Abrir sem som
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ABAS: { rt: RailTab; t: string }[] = [
  { rt: "telas", t: "Telas" },
  { rt: "chat", t: "Chat" },
  { rt: "cartela", t: "Cartela" },
];

/** Painel da direita do Ao vivo: Telas / Chat / Cartela. */
export function Painel() {
  const railTab = useApp((s) => s.railTab);
  const unread = useApp((s) => s.chatUnread);
  const setRail = (t: RailTab) => {
    setApp(t === "chat" ? { railTab: t, chatUnread: 0 } : { railTab: t });
    local.set("rail-tab", t);
  };
  return (
    <aside className="rail">
      <div className="rail-tabs" role="tablist" aria-label="Painel">
        {ABAS.map(({ rt, t }) => (
          <button key={rt} role="tab" data-rt={rt} aria-selected={railTab === rt} onClick={() => setRail(rt)}>
            {t}
            {rt === "chat" && (
              <>
                {" "}
                <span className="count" id="nChat">
                  {unread ? (unread > 99 ? "99+" : String(unread)) : ""}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      <div className="rail-pane" data-pane="telas" hidden={railTab !== "telas"}>
        <SuaTela />
        <Transmitindo />
      </div>
      <div className="rail-pane" data-pane="chat" hidden={railTab !== "chat"}>
        <ChatPainel />
      </div>
      <div className="rail-pane" data-pane="cartela" hidden={railTab !== "cartela"}>
        <div className="block" id="miniCardBlock">
          <MiniCartela />
        </div>
      </div>
    </aside>
  );
}
