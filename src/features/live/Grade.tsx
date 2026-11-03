"use client";
/*
 * O canal de voz como no Discord: todo mundo da voz em quadrados (câmera ou rosto, borda dourada em quem fala),
 * mais um quadrado para cada tela ao vivo. Tela que ainda não abri fica desfocada com "Assistir transmissão"
 * (só baixa o vídeo de quem eu quero ver). Clicar numa tela aberta vai para o modo foco: ela grande no Palco
 * (com reações, desenho, volume, janela flutuante e tela cheia) e o resto do canal numa faixa embaixo.
 * Clique direito (ou o botão ⋯) abre o menu do quadrado: destaque, janela flutuante, tela cheia, volumes e silenciar.
 * Só a tela principal toca som (o Palco continua montado, escondido na grade); as outras abertas vão sem som.
 */
import { useCallback, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  IcCamera,
  IcDesligar,
  IcFoneDesligado,
  IcGrade,
  IcMais3,
  IcMic,
  IcMicDesligado,
  IcOlho,
  IcSemSom,
  IcTela,
  IcTelaCheia,
} from "@/components/ui/icones";
import { useNanicosOnline } from "@/components/shell/People";
import { entrarSala } from "@/features/salas/trocar";
import type { PresencaNanico } from "@/lib/presenca";
import { friendDaPresenca, MY_KEY, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local } from "@/lib/util";
import type { Friend } from "@/lib/tipos";
import { camStreamOf, openCamPip } from "./camera";
import { setLive, useLive } from "./estado";
import { Balao, botaoCamera, botaoTela, BotaoReacoes, Chave, lugarDe, type Lugar } from "./PainelVoz";
import { LIVE, unwatch, watch } from "./tela";
import { VideoMudo } from "./Video";
import { ajustarVoz, alternarMudo, entrarVoz, silenciarNanico, useAjustesVoz, useVoz } from "./voz";

type Quadro =
  | { tipo: "pessoa"; id: string; p: PresencaNanico; f?: Friend; nome: string; eu: boolean; cam: MediaStream | null; fala: boolean }
  | { tipo: "tela"; id: string; key: string; f?: Friend; nome: string; eu: boolean };

/** Todos os quadrados do canal: as telas ao vivo primeiro, depois quem está na voz (eu primeiro). */
function useQuadros(): Quadro[] {
  useLive((s) => s.v);
  const minhaSala = useApp((s) => s.minhaSala);
  const onlineSala = useApp((s) => s.onlineSala);
  const friends = useApp((s) => s.friends);
  const myLive = useApp((s) => s.myLiveSid);
  const naGrade = useLive((s) => s.minhaCamNaGrade);
  const falando = useVoz((s) => s.falando);
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
      const cam = eu ? (naGrade ? camStreamOf(MY_KEY) : null) : p.chaveCam ? camStreamOf(p.chaveCam) : null;
      return { tipo: "pessoa" as const, id: p.id, p, f, nome: eu ? "Você" : (f?.name ?? p.name), eu, cam, fala: p.chaves.some((k) => falando.includes(k)) };
    })
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
  if (s.modo === "foco" && !LIVE.main) setLive({ modo: "grade" });
});

/** Abrir uma tela grande (com som) no modo foco. */
function destacar(key: string) {
  watch(key, true);
  setLive({ modo: "foco" });
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
  const vol = useLive((s) => s.vol);
  const espelho = useLive((s) => s.espelho);
  const naGrade = useLive((s) => s.minhaCamNaGrade);
  const por = useAjustesVoz((s) => s.por);
  const silenciados = useAjustesVoz((s) => s.silenciados);
  const fid = q.tipo === "pessoa" ? q.p.fid : null;
  const faz = (f: () => void) => () => {
    fechar();
    f();
  };
  const assistindo = q.tipo === "tela" && !q.eu && LIVE.watching.has(q.key);
  const principal = q.tipo === "tela" && LIVE.main === q.key;
  return (
    <Balao lugar={lugar} ancora={ancora} fechar={fechar} rotulo={`Opções de ${q.nome}`}>
      <h4>{q.tipo === "tela" ? `Tela de ${q.nome}` : q.nome}</h4>
      {q.tipo === "tela" && !q.eu && (
        <button type="button" className="vz-item" onClick={faz(() => destacar(q.key))}>
          <span>{assistindo ? "Ver em destaque" : "Assistir transmissão"}</span>
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
      {principal && (
        <>
          <div className="vz-sep" />
          <h4>Volume da transmissão</h4>
          <label className="vz-vol">
            <input
              aria-label="Volume da transmissão"
              type="range"
              min={0}
              max={100}
              value={Math.round(vol * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setLive({ vol: v });
                local.set("live-vol", String(v));
                if (LIVE.mainVideo) LIVE.mainVideo.volume = v;
              }}
            />
            <b>{Math.round(vol * 100)}%</b>
          </label>
        </>
      )}
      {q.tipo === "pessoa" && !q.eu && fid && (
        <>
          <div className="vz-sep" />
          <h4>Volume da voz</h4>
          <label className="vz-vol">
            <input
              aria-label={`Volume da voz de ${q.nome}`}
              type="range"
              min={0}
              max={100}
              value={Math.round((por[fid] ?? 1) * 100)}
              onChange={(e) => ajustarVoz({ por: { ...por, [fid]: Number(e.target.value) / 100 } })}
            />
            <b>{Math.round((por[fid] ?? 1) * 100)}%</b>
          </label>
          <Chave rotulo={`Silenciar ${q.nome}`} ligado={silenciados.includes(fid)} onChange={(v) => silenciarNanico(fid, v)} />
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
      {assistindo && (
        <>
          <div className="vz-sep" />
          <button type="button" className="vz-item perigo" onClick={faz(() => unwatch(q.key))}>
            <span>Parar de assistir</span>
          </button>
        </>
      )}
    </Balao>
  );
}

/* ---------- um quadrado ---------- */
function ativarSom() {
  const v = LIVE.mainVideo;
  if (!v) return;
  v.muted = false;
  v.play()
    .then(() => setLive({ unmute: false }))
    .catch(() => {});
}

function QuadroCanal({ q, pequeno }: { q: Quadro; pequeno?: boolean }) {
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
    const st = q.eu ? (previa ? LIVE.myStream : null) : (w?.stream ?? null);
    const n = q.eu ? [...LIVE.viewers.values()].filter((v) => v.pc.connectionState === "connected").length : null;
    return (
      <div ref={el} className={"qd tela" + (pequeno ? " peq" : "") + (principal ? " principal" : "")} {...comMenu}>
        {st && <VideoMudo stream={st} onEl={setVideo} />}
        {!q.eu && !w && (
          <div className="qd-assistir">
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
        {q.eu && !previa && (
          <div className="qd-minha">
            <IcTela tam={28} />
            <b>Você está transmitindo</b>
            <button type="button" className="btn soft sm" onClick={() => setPrevia(true)}>
              Ver prévia
            </button>
          </div>
        )}
        {q.eu && previa && (
          <button type="button" className="btn soft sm qd-esconder" onClick={() => setPrevia(false)}>
            Esconder prévia
          </button>
        )}
        {w && w.state !== "live" && <div className="qd-espera">{w.state === "failed" ? "Não conectou. Toque para tentar de novo." : "Conectando…"}</div>}
        {/* tela aberta: clicar põe em destaque (ou tenta de novo, se falhou) */}
        {w && <button type="button" className="qd-tocar" aria-label={`Ver a tela de ${q.nome} em destaque`} onClick={() => destacar(q.key)} />}
        {(w || q.eu) && <span className="live-pill qd-pill">AO VIVO</span>}
        {n !== null && (
          <span className="qd-olhos" title={n === 1 ? "1 pessoa assistindo" : `${n} pessoas assistindo`}>
            <IcOlho tam={12} />
            {n}
          </span>
        )}
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
        {botaoMenu}
        {menuAberto}
      </div>
    );
  }

  const fid = q.p.fid;
  const silenciado = !q.eu && !!fid && silenciados.includes(fid);
  return (
    <div ref={el} className={"qd pessoa " + fundoDe(q.id) + (q.fala ? " fala" : "") + (pequeno ? " peq" : "") + (q.cam ? " com-cam" : "")} {...comMenu}>
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

/* ---------- barra de baixo (como a do Discord) ---------- */
function BarraCanal() {
  const voz = useApp((s) => !!s.myVozSid);
  const mudo = useApp((s) => s.vozMudo);
  const cam = useApp((s) => !!s.myCamSid);
  const live = useApp((s) => !!s.myLiveSid);
  return (
    <div className="cv-barra">
      {voz ? (
        <>
          <button type="button" className={"cb" + (mudo ? " off" : "")} aria-pressed={mudo} aria-label={mudo ? "Ligar o microfone" : "Desligar o microfone"} title={mudo ? "Ligar o microfone" : "Desligar o microfone"} onClick={alternarMudo}>
            {mudo ? <IcMicDesligado tam={20} /> : <IcMic tam={20} />}
          </button>
          <button type="button" className={"cb" + (cam ? " on" : "")} aria-pressed={cam} aria-label={cam ? "Desligar a câmera" : "Ligar a câmera"} title={cam ? "Desligar a câmera" : "Ligar a câmera"} onClick={botaoCamera}>
            <IcCamera tam={20} />
          </button>
          <button type="button" className={"cb" + (live ? " ao-vivo" : "")} aria-pressed={live} aria-label={live ? "Parar a transmissão" : "Transmitir a tela"} title={live ? "Parar a transmissão" : "Transmitir a tela"} onClick={botaoTela}>
            <IcTela tam={20} />
          </button>
          <span className="cv-reacoes">
            <BotaoReacoes />
          </span>
        </>
      ) : (
        <button type="button" className="btn sm" onClick={entrarVoz}>
          Entrar na voz
        </button>
      )}
      <button type="button" className="cb" aria-label="Tela cheia" title="Tela cheia" onClick={() => telaCheiaDe(document.getElementById("liveWrap"))}>
        <IcTelaCheia tam={20} />
      </button>
      <button type="button" className="cb sair" aria-label="Desconectar e sair da sala" title="Desconectar" onClick={() => entrarSala(null)}>
        <IcDesligar tam={22} />
      </button>
    </div>
  );
}

/** Topo do palco: quantos estão na voz e ao vivo, e o botão de grade / foco. */
export function TopoCanal() {
  const modo = useLive((s) => s.modo);
  const q = useQuadros();
  const nVoz = q.filter((x) => x.tipo === "pessoa" && !!x.p.voz).length;
  const nLive = q.filter((x) => x.tipo === "tela").length;
  const foco = modo === "foco";
  return (
    <div className="cv-topo">
      <span>
        {nVoz === 1 ? "1 na voz" : `${nVoz} na voz`}
        {nLive > 0 && ` · ${nLive} ao vivo`}
      </span>
      <button type="button" className="btn soft sm" aria-pressed={!foco} onClick={() => setLive({ modo: foco ? "grade" : "foco" })} disabled={!foco && !LIVE.main}>
        <IcGrade tam={15} />
        {foco ? "Voltar à grade" : "Tela em destaque"}
      </button>
    </div>
  );
}

/** A grade do canal (modo grade). */
export function GradeCanal() {
  const q = useQuadros();
  if (!q.length)
    return (
      <div className="cv-grade vazia">
        <p>Ninguém na voz agora.</p>
        <BarraCanal />
      </div>
    );
  return (
    <div className="cv-grade">
      <div className="cv-quadros" style={{ "--cols": colunas(q.length), "--linhas": Math.ceil(q.length / colunas(q.length)) } as React.CSSProperties}>
        {q.map((x) => (
          <QuadroCanal key={x.id} q={x} />
        ))}
      </div>
      <BarraCanal />
    </div>
  );
}

/** Modo foco: o resto do canal numa faixa embaixo da tela grande. */
export function FaixaFoco() {
  useLive((s) => s.v);
  const q = useQuadros().filter((x) => !(x.tipo === "tela" && x.key === LIVE.main));
  return (
    <div className="cv-foco">
      {q.length > 0 && (
        <div className="cv-faixa">
          {q.map((x) => (
            <QuadroCanal key={x.id} q={x} pequeno />
          ))}
        </div>
      )}
      <BarraCanal />
    </div>
  );
}
