"use client";
/*
 * O canal de voz como no Discord: todo mundo da voz em quadrados (câmera ou rosto, borda dourada em quem fala),
 * mais um quadrado para cada tela ao vivo. Tela que ainda não abri fica desfocada com "Assistir transmissão"
 * (só baixa o vídeo de quem eu quero ver). Clicar numa tela aberta vai para o modo foco: ela grande no Palco
 * (com reações, desenho, volume, janela flutuante e tela cheia) e o resto do canal numa faixa embaixo.
 * Clique direito (ou o botão ⋯) abre o menu do quadrado: destaque, janela flutuante, tela cheia, volumes e silenciar.
 * Só a tela principal toca som (o Palco continua montado, escondido na grade); as outras abertas vão sem som.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  IcCamera,
  IcChat,
  IcDesligar,
  IcFechar,
  IcFone,
  IcFoneDesligado,
  IcGrade,
  IcJanela,
  IcMais3,
  IcMic,
  IcMicDesligado,
  IcOlho,
  IcSemSom,
  IcSeta,
  IcTela,
  IcTelaCheia,
  IcVolume,
} from "@/components/ui/icones";
import { useNanicosOnline } from "@/components/shell/People";
import { salvarMidia, useMidia } from "@/features/config/midia";
import { entrarSala } from "@/features/salas/trocar";
import type { PresencaNanico } from "@/lib/presenca";
import { friendDaPresenca, MY_KEY, setApp, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local } from "@/lib/util";
import type { Friend } from "@/lib/tipos";
import { activeCams, camStreamOf, openCamPip } from "./camera";
import { opcaoCall, semVideoDe, setLive, useLive } from "./estado";
import { Balao, botaoCamera, botaoTela, BotaoReacoes, BotaoSoundboard, Chave, lugarDe, MenuFone, MenuMic, useBalao, type Lugar } from "./PainelVoz";
import { canShare } from "./rtc";
import { OpcoesEu, OpcoesModerador, OpcoesVoz } from "./MenuPessoa";
import { abrirCartao } from "@/components/shell/CartaoPerfil";
import { ativarSomTelas, ouvirJunto, useOuvindo } from "./somTelas";
import { LIVE, mudarVolumeTela, stopLive, unwatch, VOLUME_TELA_MAX, volumeDaTela, watch } from "./tela";
import { VideoMudo } from "./Video";
import { alternarMudo, alternarSurdo, entrarVoz, useAjustesVoz, useVoz } from "./voz";

type Quadro =
  | { tipo: "pessoa"; id: string; p: PresencaNanico; f?: Friend; nome: string; eu: boolean; cam: MediaStream | null; fala: boolean }
  | { tipo: "tela"; id: string; key: string; f?: Friend; nome: string; eu: boolean };

/** Todos os quadrados do canal: as telas ao vivo primeiro, depois quem está na voz (eu primeiro). */
function useQuadros(todos = false): Quadro[] {
  useLive((s) => s.v);
  const minhaSala = useApp((s) => s.minhaSala);
  const onlineSala = useApp((s) => s.onlineSala);
  const friends = useApp((s) => s.friends);
  const myLive = useApp((s) => s.myLiveSid);
  const naGrade = useLive((s) => s.minhaCamNaGrade);
  const falando = useVoz((s) => s.falando);
  const soVideo = useLive((s) => s.soVideo);
  const semVideo = useLive((s) => s.semVideo);
  const pessoas = useNanicosOnline().filter((p) => p.sala === minhaSala && (p.voz || p.live || p.chaves.includes(MY_KEY)));
  const telas: Quadro[] = [];
  if (myLive && LIVE.myStream) {
    const eu = pessoas.find((p) => p.chaves.includes(MY_KEY));
    telas.push({ tipo: "tela", id: "tela:" + MY_KEY, key: MY_KEY, f: eu ? friendDaPresenca(eu, friends) : undefined, nome: "Você", eu: true });
  }
  /* a tela vem da aba que transmite (a chave dela é a que se assiste) */
  for (const p of onlineSala)
    if (p.live && p.key !== MY_KEY) {
      const f = friendDaPresenca(p, friends);
      telas.push({ tipo: "tela", id: "tela:" + p.key, key: p.key, f, nome: f?.name ?? p.name, eu: false });
    }
  telas.sort((a, b) => (a.eu ? -1 : b.eu ? 1 : a.nome.localeCompare(b.nome, "pt-BR")));
  const gente: Quadro[] = pessoas
    .filter((p) => p.voz || p.chaves.includes(MY_KEY))
    .map((p) => {
      const eu = p.chaves.includes(MY_KEY);
      const f = friendDaPresenca(p, friends);
      /* a câmera que eu desliguei só para mim não aparece (como o "Desligar vídeo" do Discord) */
      const cam = eu ? (naGrade ? camStreamOf(MY_KEY) : null) : p.chaveCam && !(p.fid && semVideo.includes(p.fid)) ? camStreamOf(p.chaveCam) : null;
      return { tipo: "pessoa" as const, id: p.id, p, f, nome: eu ? "Você" : (f?.name ?? p.name), eu, cam, fala: p.chaves.some((k) => falando.includes(k)) };
    })
    .filter((x) => todos || !soVideo || !!x.cam)
    .sort((a, b) => (a.eu ? -1 : b.eu ? 1 : a.nome.localeCompare(b.nome, "pt-BR")));
  return [...telas, ...gente];
}

/** Colunas da grade, como o Discord: 1, 2, 2×2, 3×2, 3×3, depois 4. */
const colunas = (n: number) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);

/* cor de fundo de quem está sem câmera (só as da paleta) */
const FUNDOS = ["f-olive", "f-mint", "f-accent", "f-surface"];
const fundoDe = (id: string) => FUNDOS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % FUNDOS.length];

function telaCheiaDe(el: HTMLElement | null) {
  if (!el) return;
  const pr = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.();
  pr?.catch?.(() => toast("Seu navegador não abriu a tela cheia."));
}

async function janelaDe(v: HTMLVideoElement | null | undefined) {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (v) await v.requestPictureInPicture();
  } catch {
    toast("Seu navegador não abriu a janela flutuante.");
  }
}

/* no foco sem nenhuma tela aberta (quem eu via parou de transmitir): volta para a grade */
useLive.subscribe((s) => {
  if (s.modo === "foco" && !s.destaque && !LIVE.main) setLive({ modo: "grade" });
});

/** Abrir uma tela grande (com som) no modo foco. */
function destacar(key: string) {
  watch(key, true);
  setLive({ modo: "foco", destaque: null });
}
/** Clicou num quadro: a tela de alguém vai para o Palco; a minha tela ou uma pessoa ficam grandes como estão. */
function destacarQuadro(q: Quadro) {
  if (q.tipo === "tela" && !q.eu) return destacar(q.key);
  setLive({ modo: "foco", destaque: q.id });
}

/* ---------- menu do quadrado ---------- */
function MenuQuadro({
  q,
  lugar,
  ancora,
  fechar,
  el,
  video,
}: {
  q: Quadro;
  lugar: Lugar;
  ancora: HTMLElement | null;
  fechar: () => void;
  el: React.RefObject<HTMLDivElement | null>;
  video: HTMLVideoElement | null;
}) {
  useLive((s) => s.volTelas);
  const chaveTela = q.tipo === "tela" ? q.key : null;
  const junto = useOuvindo((s) => !!chaveTela && s.junto.includes(chaveTela));
  const volQ = volumeDaTela(chaveTela);
  const semVideo = useLive((s) => s.semVideo);
  const espelho = useLive((s) => s.espelho);
  const naGrade = useLive((s) => s.minhaCamNaGrade);
  const fid = q.tipo === "pessoa" ? q.p.fid : null;
  const faz = (f: () => void) => () => {
    fechar();
    f();
  };
  const assistindo = q.tipo === "tela" && !q.eu && LIVE.watching.has(q.key);
  const principal = q.tipo === "tela" && LIVE.main === q.key;
  return (
    <Balao lugar={lugar} ancora={ancora} fechar={fechar} rotulo={`Opções de ${q.nome}`}>
      <div className="mp-cab">
        {q.f ? <Avatar f={q.f} size="lg" /> : <span className="av lg">{q.nome[0]}</span>}
        <b>{q.tipo === "tela" ? `Tela de ${q.nome}` : q.nome}</b>
      </div>
      {q.tipo === "tela" && !q.eu && (
        <button type="button" className="vz-item" onClick={faz(() => destacar(q.key))}>
          <span>{assistindo ? "Ver em destaque" : "Assistir transmissão"}</span>
        </button>
      )}
      {(q.tipo === "pessoa" || q.eu) && (
        <button type="button" className="vz-item" onClick={faz(() => destacarQuadro(q))}>
          <span>Ver em destaque</span>
        </button>
      )}
      {(assistindo || (q.tipo === "pessoa" && q.cam)) && (
        <button type="button" className="vz-item" onClick={faz(() => (q.tipo === "pessoa" ? openCamPip(q.eu ? MY_KEY : (q.p.chaveCam ?? null)) : janelaDe(principal ? LIVE.mainVideo : video)))}>
          <span>Abrir em janela flutuante</span>
        </button>
      )}
      <button type="button" className="vz-item" onClick={faz(() => telaCheiaDe(el.current))}>
        <span>Tela cheia</span>
      </button>
      {assistindo && (
        <>
          <div className="vz-sep" />
          <h4>Som da transmissão</h4>
          {(principal || junto) && (
            <label className="vz-vol">
              <input
                className="vz-faixa"
                style={{ "--pct": `${Math.round((volQ / VOLUME_TELA_MAX) * 100)}%` } as React.CSSProperties}
                aria-label="Volume da transmissão"
                type="range"
                min={0}
                max={VOLUME_TELA_MAX * 100}
                value={Math.round(volQ * 100)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  mudarVolumeTela((Math.abs(n - 100) <= 4 ? 100 : n) / 100, q.key);
                }}
              />
              <b>{Math.round(volQ * 100)}%</b>
            </label>
          )}
          {!principal && <Chave rotulo="Ouvir junto com a principal" ligado={junto} onChange={(x) => ouvirJunto(q.key, x)} />}
        </>
      )}
      {q.tipo === "pessoa" && q.f && (
        <button type="button" className="vz-item" onClick={(e) => (fechar(), abrirCartao(q.f!.id, e))}>
          <span>Perfil</span>
        </button>
      )}
      {q.tipo === "pessoa" && q.eu && (
        <>
          <div className="vz-sep" />
          <OpcoesEu fechar={fechar} />
        </>
      )}
      {q.tipo === "pessoa" && !q.eu && fid && (
        <>
          <div className="vz-sep" />
          <OpcoesVoz fid={fid} nome={q.nome} />
          {/* como no Discord: deixar de ver a câmera dela (só para mim; ela continua ligada para os outros) */}
          {(q.p.chaveCam || semVideo.includes(fid)) && <Chave rotulo="Desligar o vídeo (só para você)" ligado={semVideo.includes(fid)} onChange={(v) => semVideoDe(fid, v)} />}
        </>
      )}
      {q.eu && q.tipo === "pessoa" && (
        <>
          <div className="vz-sep" />
          <Chave
            rotulo="Espelhar a minha imagem"
            ligado={espelho}
            onChange={(v) => {
              setLive({ espelho: v });
              local.set("cam-espelho", v ? "1" : "0");
            }}
          />
          <Chave
            rotulo="Ver a minha câmera na grade"
            ligado={naGrade}
            onChange={(v) => {
              setLive({ minhaCamNaGrade: v });
              local.set("cam-na-grade", v ? "1" : "0");
            }}
          />
        </>
      )}
      {q.tipo === "pessoa" && !q.eu && q.f?.user_id && <OpcoesModerador userId={q.f.user_id} naVoz={!!q.p.voz} fechar={fechar} />}
      {q.f && (
        <>
          <div className="vz-sep" />
          <button type="button" className="vz-item" onClick={faz(() => setApp({ fichaAberta: q.f!.id }))}>
            <span>{q.eu ? "Ver a minha ficha" : "Ver a ficha"}</span>
          </button>
        </>
      )}
      {assistindo && (
        <>
          <div className="vz-sep" />
          <button type="button" className="vz-item perigo" onClick={faz(() => unwatch(q.key))}>
            <span>Parar de assistir</span>
          </button>
        </>
      )}
      {q.eu && q.tipo === "tela" && (
        <>
          <div className="vz-sep" />
          <button type="button" className="vz-item perigo" onClick={faz(stopLive)}>
            <span>Parar a transmissão</span>
          </button>
        </>
      )}
    </Balao>
  );
}

/* ---------- volume da tela (só a principal toca som) ---------- */
let volAntesDoMudo = 1;
const mudarVolume = mudarVolumeTela;

/** Em cima da tela, como no Discord: alto-falante (tira e põe o som), a barrinha do volume e a tela cheia. */
function ControlesTela({ q, principal, el }: { q: Quadro; principal: boolean; el: React.RefObject<HTMLDivElement | null> }) {
  const vol = useLive((s) => s.vol);
  if (q.tipo !== "tela") return null;
  return (
    <div className="qd-ctrl" onClick={(e) => e.stopPropagation()}>
      {principal ? (
        <>
          <button
            type="button"
            className="qd-ctrl-b"
            aria-label={vol ? "Tirar o som da transmissão" : "Pôr o som da transmissão"}
            title={vol ? "Tirar o som" : "Pôr o som"}
            onClick={() => {
              if (vol) {
                volAntesDoMudo = vol;
                mudarVolume(0);
              } else mudarVolume(volAntesDoMudo || 1);
            }}
          >
            {vol ? <IcVolume tam={18} /> : <IcSemSom tam={18} />}
          </button>
          <input className="qd-vol" type="range" min={0} max={VOLUME_TELA_MAX * 100} value={Math.round(vol * 100)} aria-label={`Volume da tela de ${q.nome}`} onChange={(e) => mudarVolume(Number(e.target.value) / 100)} />
        </>
      ) : (
        /* só a tela em destaque toca som: tocar aqui passa o som para esta */
        <button type="button" className="qd-ctrl-b" aria-label={`Ouvir a tela de ${q.nome}`} title="Ouvir esta tela" onClick={() => watch(q.key, true)}>
          <IcSemSom tam={18} />
        </button>
      )}
      <button type="button" className="qd-ctrl-b" aria-label="Tela cheia" title="Tela cheia" onClick={() => telaCheiaDe(el.current)}>
        <IcTelaCheia tam={18} />
      </button>
      {/* como no Discord: parar de assistir sem precisar abrir o menu */}
      {!q.eu && LIVE.watching.has(q.key) && (
        <button type="button" className="qd-ctrl-b parar" aria-label={`Parar de assistir a tela de ${q.nome}`} title="Parar de assistir" onClick={() => unwatch(q.key)}>
          <IcFechar tam={18} />
        </button>
      )}
    </div>
  );
}

/* ---------- um quadrado ---------- */
const ativarSom = ativarSomTelas;

function QuadroCanal({ q, pequeno, grande }: { q: Quadro; pequeno?: boolean; grande?: boolean }) {
  useLive((s) => s.v);
  const espelho = useLive((s) => s.espelho);
  const unmute = useLive((s) => s.unmute);
  const silenciados = useAjustesVoz((s) => s.silenciados);
  const [menu, setMenu] = useState<{ lugar: Lugar; ancora: HTMLElement | null } | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  /* a minha própria tela: como no Discord, sem prévia (senão vira tela dentro da tela, sem fim); dá para ligar */
  const [previa, setPrevia] = useState(false);

  const fecharMenu = useCallback(() => setMenu(null), []);
  const comMenu = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setMenu({ lugar: lugarDe(new DOMRect(e.clientX, e.clientY, 0, 0), 280), ancora: null });
    },
  };
  const botaoMenu = (
    <button
      type="button"
      className="qd-mais"
      aria-label={`Opções de ${q.nome}`}
      onClick={(e) => {
        const el = e.currentTarget;
        setMenu((m) => (m ? null : { lugar: lugarDe(el, 280), ancora: el }));
      }}
    >
      <IcMais3 tam={18} />
    </button>
  );
  const menuAberto = menu && <MenuQuadro q={q} lugar={menu.lugar} ancora={menu.ancora} fechar={fecharMenu} el={el} video={video} />;

  if (q.tipo === "tela") {
    const w = q.eu ? null : LIVE.watching.get(q.key);
    const principal = !q.eu && LIVE.main === q.key;
    /* em destaque (a pessoa pediu), a minha tela aparece mesmo */
    const st = q.eu ? (previa || grande ? LIVE.myStream : null) : (w?.stream ?? null);
    const n = q.eu ? quemAssiste().length : null;
    return (
      <div ref={el} className={"qd tela" + (pequeno ? " peq" : "") + (grande ? " grande" : "") + (principal ? " principal" : "")} {...comMenu}>
        {st && <VideoMudo stream={st} onEl={setVideo} />}
        {!q.eu && !w && (
          <div className="qd-assistir">
            {/* como a prévia borrada do Discord: o rosto de quem transmite, grande e desfocado, atrás */}
            <span className="qd-borrado" aria-hidden="true">
              {q.f && <Avatar f={q.f} />}
            </span>
            <span className="live-pill">AO VIVO</span>
            {!pequeno && <b>{q.nome} está transmitindo</b>}
            <button type="button" className="btn sm" onClick={() => destacar(q.key)}>
              {pequeno ? (
                "Assistir"
              ) : (
                <>
                  <span className="qd-longo">Assistir transmissão</span>
                  <span className="qd-curto">Assistir</span>
                </>
              )}
            </button>
          </div>
        )}
        {q.eu && !previa && !grande && (
          <button type="button" className="qd-tocar" aria-label="Ver a sua transmissão em destaque" onClick={() => destacarQuadro(q)} />
        )}
        {q.eu && !previa && !grande && (
          <div className="qd-minha">
            <IcTela tam={28} />
            <b>Você está transmitindo</b>
            <button type="button" className="btn soft sm" onClick={() => setPrevia(true)}>
              Ver prévia
            </button>
          </div>
        )}
        {q.eu && previa && !grande && (
          <button type="button" className="btn soft sm qd-esconder" onClick={() => setPrevia(false)}>
            Esconder prévia
          </button>
        )}
        {w && w.state !== "live" && <div className="qd-espera">{w.state === "failed" ? "Não conectou. Toque para tentar de novo." : "Conectando…"}</div>}
        {/* tela aberta: clicar põe em destaque (ou tenta de novo, se falhou) */}
        {w && <button type="button" className="qd-tocar" aria-label={`Ver a tela de ${q.nome} em destaque`} onClick={() => destacar(q.key)} />}
        {(w || q.eu) && <span className="live-pill qd-pill">AO VIVO</span>}
        {n !== null && <OlhosDaLive n={n} />}
        {principal && unmute && (
          <button type="button" className="btn sm qd-som" onClick={ativarSom}>
            Ativar som
          </button>
        )}
        <span className="qd-nome">
          <IcTela tam={14} />
          {q.eu ? "Sua tela" : q.nome}
          {w && !principal && (
            <small title="Só a tela em destaque toca som">
              <IcSemSom tam={13} />
            </small>
          )}
        </span>
        {w && w.state === "live" && <ControlesTela q={q} principal={principal} el={el} />}
        {botaoMenu}
        {menuAberto}
      </div>
    );
  }

  const fid = q.p.fid;
  const silenciado = !q.eu && !!fid && silenciados.includes(fid);
  return (
    <div ref={el} className={"qd pessoa " + fundoDe(q.id) + (q.fala ? " fala" : "") + (pequeno ? " peq" : "") + (grande ? " grande" : "") + (q.cam ? " com-cam" : "")} {...comMenu}>
      {!grande && <button type="button" className="qd-tocar" aria-label={`Ver ${q.nome} em destaque`} onClick={() => destacarQuadro(q)} />}
      {q.cam ? (
        <div className={q.eu && espelho ? "qd-cam espelho" : "qd-cam"}>
          <VideoMudo stream={q.cam} onEl={setVideo} />
        </div>
      ) : (
        <span className="qd-rosto">{q.f ? <Avatar f={q.f} /> : <span className="av">{q.nome[0]}</span>}</span>
      )}
      <span className="qd-nome">
        {q.cam && <IcCamera tam={14} />}
        {q.nome}
        {q.p.surdo ? <IcFoneDesligado tam={14} className="qd-mudo" aria-label="Sem ouvir" role="img" /> : q.p.mudo ? <IcMicDesligado tam={14} className="qd-mudo" aria-label="Microfone desligado" role="img" /> : null}
        {silenciado && <IcSemSom tam={14} className="qd-mudo" aria-label="Você silenciou" role="img" />}
      </span>
      {botaoMenu}
      {menuAberto}
    </div>
  );
}

/* ---------- quem assiste a minha transmissão (como no Discord: o olhinho mostra os nomes) ---------- */
function quemAssiste(): string[] {
  const online = useApp.getState().onlineSala;
  const nomes = new Set<string>();
  for (const [key, v] of LIVE.viewers) if (v.pc.connectionState === "connected") nomes.add(online.find((x) => x.key === key)?.name ?? "Alguém");
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
function OlhosDaLive({ n }: { n: number }) {
  const nomes = quemAssiste();
  return (
    <span className="qd-olhos" tabIndex={0} aria-label={n === 1 ? "1 pessoa assistindo" : `${n} pessoas assistindo`}>
      <IcOlho tam={12} />
      {n}
      <span className="qd-olhos-lista" role="tooltip">
        <b>{n ? "Assistindo" : "Ninguém assistindo ainda"}</b>
        {nomes.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </span>
    </span>
  );
}

/* ---------- barra de baixo (como a do Discord): flutua no fundo da call e some com o mouse parado ---------- */
export function BarraCanal() {
  const voz = useApp((s) => !!s.myVozSid);
  const mudo = useApp((s) => s.vozMudo);
  const surdo = useApp((s) => s.vozSurdo);
  const cam = useApp((s) => !!s.myCamSid);
  const live = useApp((s) => !!s.myLiveSid);
  const mic = useBalao();
  const fone = useBalao();
  const tela = useBalao();
  const mais = useBalao();
  return (
    <div className="cv-barra">
      {voz ? (
        <>
          {/* microfone e fone com a setinha (aparelho, ruído, eco, saída de som e volume), como no Discord */}
          <span className={"cb-duplo" + (mudo ? " off" : "")}>
            <button type="button" className="cb" aria-pressed={mudo} aria-label={mudo ? "Ligar o microfone" : "Desligar o microfone"} title={mudo ? "Ligar o microfone" : "Desligar o microfone"} onClick={alternarMudo}>
              {mudo ? <IcMicDesligado tam={20} /> : <IcMic tam={20} />}
            </button>
            <button type="button" className="cb-seta" aria-label="Opções do microfone" aria-expanded={!!mic.lugar} onClick={(e) => mic.alternar(e)}>
              <IcSeta tam={12} />
            </button>
          </span>
          <span className={"cb-duplo" + (surdo ? " off" : "")}>
            <button type="button" className="cb" aria-pressed={surdo} aria-label={surdo ? "Voltar a ouvir" : "Parar de ouvir"} title={surdo ? "Voltar a ouvir" : "Ensurdecer"} onClick={alternarSurdo}>
              {surdo ? <IcFoneDesligado tam={20} /> : <IcFone tam={20} />}
            </button>
            <button type="button" className="cb-seta" aria-label="Opções do fone" aria-expanded={!!fone.lugar} onClick={(e) => fone.alternar(e)}>
              <IcSeta tam={12} />
            </button>
          </span>
          <span className="cb-sep" aria-hidden="true" />
          <span className={"cb-duplo" + (cam ? " on" : "")}>
            <button type="button" className="cb" aria-pressed={cam} aria-label={cam ? "Desligar a câmera" : "Ligar a câmera"} title={cam ? "Desligar a câmera" : "Ligar a câmera"} onClick={botaoCamera}>
              <IcCamera tam={20} />
            </button>
            <button type="button" className="cb-seta" aria-label="Escolher a câmera" onClick={() => setLive({ previaCam: true })}>
              <IcSeta tam={12} />
            </button>
          </span>
          {(canShare || live) && (
            <span className={"cb-duplo" + (live ? " ao-vivo" : "")}>
              <button type="button" className="cb" aria-pressed={live} aria-label={live ? "Parar a transmissão" : "Transmitir a tela"} title={live ? "Parar a transmissão" : "Transmitir a tela"} onClick={botaoTela}>
                <IcTela tam={20} />
              </button>
              <button type="button" className="cb-seta" aria-label="Opções da transmissão" aria-expanded={!!tela.lugar} onClick={(e) => (live ? tela.alternar(e) : setLive({ janelaTela: true }))}>
                <IcSeta tam={12} />
              </button>
            </span>
          )}
          <span className="cv-reacoes">
            <BotaoReacoes />
            <BotaoSoundboard />
          </span>
          {mic.lugar && <MenuMic lugar={mic.lugar} ancora={mic.ancora} fechar={mic.fechar} />}
          {fone.lugar && <MenuFone lugar={fone.lugar} ancora={fone.ancora} fechar={fone.fechar} />}
          {tela.lugar && <MenuTransmissao lugar={tela.lugar} ancora={tela.ancora} fechar={tela.fechar} />}
        </>
      ) : (
        <button type="button" className="btn sm" onClick={entrarVoz}>
          Entrar na voz
        </button>
      )}
      <button type="button" className={"cb" + (mais.lugar ? " aberto" : "")} aria-label="Mais opções" title="Mais opções" aria-expanded={!!mais.lugar} onClick={(e) => mais.alternar(e)}>
        <IcMais3 tam={20} />
      </button>
      {mais.lugar && <MenuMais lugar={mais.lugar} ancora={mais.ancora} fechar={mais.fechar} />}
      <button type="button" className="cb sair" aria-label="Desconectar e sair da sala" title="Desconectar" onClick={() => entrarSala(null)}>
        <IcDesligar tam={22} />
      </button>
    </div>
  );
}

/** A setinha da transmissão (estando ao vivo): trocar a qualidade, trocar a tela e parar. */
function MenuTransmissao({ lugar, ancora, fechar }: { lugar: Lugar; ancora: HTMLElement | null; fechar: () => void }) {
  useLive((s) => s.v);
  const res = useLive((s) => s.res);
  const fps = useLive((s) => s.fps);
  const n = quemAssiste().length;
  const faz = (f: () => void) => () => (fechar(), f());
  return (
    <Balao lugar={lugar} ancora={ancora} fechar={fechar} rotulo="Opções da transmissão">
      <h4>Sua transmissão</h4>
      <p className="mp-info">
        {res}p · {fps} fps · {n === 1 ? "1 pessoa assistindo" : `${n} pessoas assistindo`}
      </p>
      <button type="button" className="vz-item" onClick={faz(() => setLive({ janelaTela: true }))}>
        <span>Trocar a qualidade ou a tela</span>
      </button>
      <button type="button" className="vz-item" onClick={faz(() => setLive({ modo: "foco", destaque: "tela:" + MY_KEY }))}>
        <span>Ver a minha transmissão</span>
      </button>
      <div className="vz-sep" />
      <button type="button" className="vz-item perigo" onClick={faz(stopLive)}>
        <span>Parar a transmissão</span>
      </button>
    </Balao>
  );
}

/** O "⋯" da barra: como a grade aparece, ruído, câmeras numa janela, tela cheia e as configurações. */
function MenuMais({ lugar, ancora, fechar }: { lugar: Lugar; ancora: HTMLElement | null; fechar: () => void }) {
  const soVideo = useLive((s) => s.soVideo);
  const semNomes = useLive((s) => s.semNomes);
  const ruido = useMidia((s) => s.ruido);
  const nCams = activeCams().length;
  const faz = (f: () => void) => () => (fechar(), f());
  return (
    <Balao lugar={lugar} ancora={ancora} fechar={fechar} rotulo="Mais opções">
      <h4>Na grade</h4>
      <Chave rotulo="Mostrar quem está sem câmera" ligado={!soVideo} onChange={(v) => opcaoCall("soVideo", !v)} />
      <Chave rotulo="Mostrar os nomes" ligado={!semNomes} onChange={(v) => opcaoCall("semNomes", !v)} />
      <div className="vz-sep" />
      <Chave rotulo="Supressão de ruído" ligado={ruido} onChange={(v) => salvarMidia({ ruido: v })} />
      <div className="vz-sep" />
      <button type="button" className="vz-item" disabled={!nCams} onClick={faz(() => openCamPip(null))}>
        <span>{nCams ? "Câmeras numa janela flutuante" : "Ninguém com câmera"}</span>
      </button>
      <button type="button" className="vz-item" onClick={faz(() => telaCheiaDe(document.getElementById("liveWrap")))}>
        <span>Tela cheia</span>
      </button>
      <button type="button" className="vz-item" onClick={faz(() => setApp({ configAberto: true }))}>
        <span>Configurações de voz e vídeo</span>
      </button>
    </Balao>
  );
}

/** Barra de cima da call (fina, como a do Discord): o canal, quantos estão nele, grade/destaque e o chat. */
export function TopoCanal({ sala, chat, alternarChat }: { sala: string | null; chat: boolean; alternarChat: () => void }) {
  const modo = useLive((s) => s.modo);
  const q = useQuadros(true);
  const nVoz = q.filter((x) => x.tipo === "pessoa" && !!x.p.voz).length;
  const nLive = q.filter((x) => x.tipo === "tela").length;
  const foco = modo === "foco";
  return (
    <div className="cv-topo">
      <span className="cv-canal">
        <IcVolume tam={20} />
        <h1>{sala ?? "Ao vivo"}</h1>
        <small>
          {nVoz === 1 ? "1 na voz" : `${nVoz} na voz`}
          {nLive > 0 && ` · ${nLive} ao vivo`}
        </small>
      </span>
      <span className="cv-topo-bts">
        <button
          type="button"
          className={"cv-tb" + (foco ? "" : " on")}
          aria-pressed={!foco}
          aria-label={foco ? "Voltar à grade" : "Tela em destaque"}
          title={foco ? "Voltar à grade" : "Tela em destaque"}
          onClick={() => setLive({ modo: foco ? "grade" : "foco", destaque: null })}
          disabled={!foco && !LIVE.main}
        >
          <IcGrade tam={20} />
        </button>
        <button
          type="button"
          className="cv-tb"
          aria-label="Abrir numa janela flutuante"
          title={LIVE.main ? "Live numa janela flutuante" : "Câmeras numa janela flutuante"}
          disabled={!LIVE.main && !activeCams().length}
          onClick={() => (LIVE.main ? janelaDe(LIVE.mainVideo) : openCamPip(null))}
        >
          <IcJanela tam={20} />
        </button>
        <button type="button" className="cv-tb" aria-label="Tela cheia" title="Tela cheia" onClick={() => telaCheiaDe(document.getElementById("liveWrap"))}>
          <IcTelaCheia tam={20} />
        </button>
        <span className="cv-topo-sep" aria-hidden="true" />
        <button type="button" className={"cv-tb" + (chat ? " on" : "")} aria-pressed={chat} aria-label={chat ? "Fechar o chat" : "Abrir o chat"} title={chat ? "Fechar o chat" : "Abrir o chat"} onClick={alternarChat}>
          <IcChat tam={20} />
        </button>
      </span>
    </div>
  );
}

/** A grade do canal (modo grade). */
export function GradeCanal() {
  const q = useQuadros();
  const soVideo = useLive((s) => s.soVideo);
  if (!q.length)
    return (
      <div className="cv-grade vazia">
        <p>{soVideo ? "Ninguém com a câmera ligada." : "Ninguém na voz agora."}</p>
        {soVideo && (
          <button type="button" className="btn soft sm" onClick={() => opcaoCall("soVideo", false)}>
            Mostrar todo mundo
          </button>
        )}
      </div>
    );
  return (
    <div className="cv-grade">
      <div className="cv-quadros" style={{ "--cols": colunas(q.length), "--linhas": Math.ceil(q.length / colunas(q.length)) } as React.CSSProperties}>
        {q.map((x) => (
          <QuadroCanal key={x.id} q={x} />
        ))}
      </div>
    </div>
  );
}

/** Foco num quadro que não vai para o Palco (a minha tela, uma câmera, alguém só com o rosto): ele grande. */
export function DestaqueCanal() {
  const dest = useLive((s) => s.destaque);
  const q = useQuadros();
  const alvo = dest ? q.find((x) => x.id === dest) : undefined;
  /* o quadro sumiu (parou de transmitir, desligou a câmera, saiu da voz): volta para a grade */
  useEffect(() => {
    if (dest && !alvo) setLive({ modo: "grade", destaque: null });
  }, [dest, alvo]);
  if (!alvo) return null;
  return (
    <div className="cv-destaque">
      <QuadroCanal key={alvo.id} q={alvo} grande />
    </div>
  );
}

/** Modo foco: o resto do canal numa faixa embaixo da tela grande. */
export function FaixaFoco() {
  useLive((s) => s.v);
  const dest = useLive((s) => s.destaque);
  const q = useQuadros().filter((x) => (dest ? x.id !== dest : !(x.tipo === "tela" && x.key === LIVE.main)));
  return (
    <div className="cv-foco">
      {q.length > 0 && (
        <div className="cv-faixa">
          {q.map((x) => (
            <QuadroCanal key={x.id} q={x} pequeno />
          ))}
        </div>
      )}
    </div>
  );
}
