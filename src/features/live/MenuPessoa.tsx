"use client";
/*
 * O menu de uma pessoa, como o do Discord: clique direito no nome (ou segurar o dedo no celular) na lista do canal de
 * voz, na lista de membros e nos quadrados do Ao vivo. Volume da voz (até 200%), silenciar, a transmissão dela
 * (assistir, ouvir, volume e parar de assistir) e a ficha. Tudo só no meu aparelho.
 */
import { useCallback, useRef, useState } from "react";
import { assistirLive } from "@/components/shell/People";
import { Avatar } from "@/components/ui/Avatar";
import type { PresencaNanico } from "@/lib/presenca";
import { MY_KEY, setApp, useApp } from "@/lib/store";
import { useLive } from "./estado";
import { Balao, Chave, lugarDe, type Lugar } from "./PainelVoz";
import { ouvirJunto, useOuvindo } from "./somTelas";
import { infoDaTela, LIVE, mudarVolumeTela, unwatch, VOLUME_TELA_MAX, volumeDaTela, watch } from "./tela";
import { abrirCartao } from "@/components/shell/CartaoPerfil";
import { ajustarVoz, alternarMudo, alternarSurdo, sairVoz, semSoundboardDe, silenciarNanico, useAjustesVoz, VOLUME_MAX } from "./voz";
import { castigar, castigoAte, desconectarDaVoz, ensurdecerParaTodos, moverParaCanal, silenciarParaTodos, useVozMod } from "./vozMod";
import { IcSeta } from "@/components/ui/icones";
import { useTemCelular } from "@/features/celular/Celular";
import { abrirCelular, abrirConversa } from "@/features/celular/rede";
import { arrobaDe, chamarParaCall, mencionarNoChat } from "@/features/chat/chat";
import { bloquear, ignorar, useNotas } from "@/features/status/notas";
import { toast } from "@/lib/toast";
import { semVideoDe } from "./estado";
import { cargosDe, useStatus } from "@/features/status/status";

/** Volume da voz (0 a 200%) e silenciar, de um nanico (friend id). */
export function OpcoesVoz({ fid, nome, titulo = "Volume da voz", semSilenciar }: { fid: string; nome: string; titulo?: string; semSilenciar?: boolean }) {
  const por = useAjustesVoz((s) => s.por);
  const silenciados = useAjustesVoz((s) => s.silenciados);
  const v = por[fid] ?? 1;
  return (
    <>
      <h4>{titulo}</h4>
      <label className="vz-vol">
        <input
          className="vz-faixa"
          style={{ "--pct": `${(v / VOLUME_MAX) * 100}%` } as React.CSSProperties}
          aria-label={`Volume da voz de ${nome}`}
          type="range"
          min={0}
          max={VOLUME_MAX * 100}
          step={5}
          value={Math.round(v * 100)}
          /* passa pelos 100% com um "ímã", como no Discord */
          onChange={(e) => {
            const n = Number(e.target.value);
            ajustarVoz({ por: { ...por, [fid]: (Math.abs(n - 100) <= 4 ? 100 : n) / 100 } });
          }}
          onDoubleClick={() => ajustarVoz({ por: { ...por, [fid]: 1 } })}
        />
        <b>{Math.round(v * 100)}%</b>
      </label>
      {!semSilenciar && <Chave rotulo={`Silenciar ${nome}`} ligado={silenciados.includes(fid)} onChange={(x) => silenciarNanico(fid, x)} />}
    </>
  );
}

/** A transmissão de quem está ao vivo: assistir, volume (até 200%), ouvir junto, as informações e parar de assistir. */
export function OpcoesTela({ chave, sala, nome, fechar }: { chave: string; sala: string | null; nome: string; fechar: () => void }) {
  useLive((s) => s.v);
  useLive((s) => s.volTelas);
  const junto = useOuvindo((s) => s.junto);
  const vendo = LIVE.watching.has(chave);
  const principal = vendo && LIVE.main === chave;
  const ouvindo = principal || junto.includes(chave);
  const vol = volumeDaTela(chave);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof infoDaTela>> | "carregando" | null>(null);
  return (
    <>
      <h4>Transmissão</h4>
      {!vendo ? (
        <button type="button" className="vz-item" onClick={() => (fechar(), assistirLive(chave, sala))}>
          <span>Assistir a tela de {nome}</span>
        </button>
      ) : (
        <>
          {ouvindo && (
            <label className="vz-vol">
              <input
                className="vz-faixa"
                style={{ "--pct": `${Math.round((vol / VOLUME_TELA_MAX) * 100)}%` } as React.CSSProperties}
                aria-label={`Volume da transmissão de ${nome}`}
                type="range"
                min={0}
                max={VOLUME_TELA_MAX * 100}
                value={Math.round(vol * 100)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  mudarVolumeTela((Math.abs(n - 100) <= 4 ? 100 : n) / 100, chave);
                }}
                onDoubleClick={() => mudarVolumeTela(1, chave)}
              />
              <b>{Math.round(vol * 100)}%</b>
            </label>
          )}
          {!principal && (
            <>
              <Chave rotulo="Ouvir junto com a principal" ligado={junto.includes(chave)} onChange={(x) => ouvirJunto(chave, x)} />
              <button type="button" className="vz-item" onClick={() => (fechar(), watch(chave, true))}>
                <span>Pôr em destaque</span>
              </button>
            </>
          )}
          <button type="button" className="vz-item" onClick={() => (setInfo("carregando"), void infoDaTela(chave).then(setInfo))}>
            <span>Informações da transmissão</span>
          </button>
          {info === "carregando" ? (
            <p className="vz-dica">Medindo…</p>
          ) : info ? (
            <p className="vz-dica vz-info">
              {info.res}
              {info.fps != null ? ` · ${info.fps} fps` : ""}
              {info.mbps != null ? ` · ${info.mbps} Mbps` : ""}
              {info.codec ? ` · ${info.codec}` : ""}
              <br />
              {info.ping != null ? `Atraso ${info.ping} ms` : ""}
              {info.perda != null ? ` · perda ${info.perda}%` : ""}
            </p>
          ) : null}
          <button type="button" className="vz-item perigo" onClick={() => (fechar(), unwatch(chave))}>
            <span>Parar de assistir</span>
          </button>
        </>
      )}
    </>
  );
}

/** Um item que abre a lista dele logo embaixo (a setinha ">" do Discord). */
function Sub({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className="vz-item" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <span>{rotulo}</span>
        <IcSeta tam={14} className={"vz-seta-dir" + (aberto ? " aberta" : "")} />
      </button>
      {aberto && <div className="vz-subs">{children}</div>}
    </>
  );
}

const CASTIGOS = [
  { nome: "1 minuto", min: 1 },
  { nome: "5 minutos", min: 5 },
  { nome: "10 minutos", min: 10 },
  { nome: "1 hora", min: 60 },
  { nome: "1 dia", min: 1440 },
];

const ehMod = (myFid: string | null, mods: string[]) => !!myFid && mods.includes(myFid);

/** Só para moderador (o banco confere de novo): mover de canal, silenciar e ensurdecer no servidor, desconectar e castigo. */
export function OpcoesModerador({ userId, naVoz, sala, fechar }: { userId: string; naVoz: boolean; sala?: string | null; fechar: () => void }) {
  const mods = useStatus((s) => s.mods);
  const myFid = useApp((s) => s.myFid);
  const salas = useApp((s) => s.salas);
  const silenciado = useVozMod((s) => s.silenciados.includes(userId));
  const surdo = useVozMod((s) => s.surdos.includes(userId));
  const castigo = useVozMod((s) => s.castigos[userId] ?? 0);
  const [certeza, setCerteza] = useState(false);
  if (!ehMod(myFid, mods)) return null;
  const outras = salas.filter((x) => x.id !== sala);
  const deCastigo = castigoAte(castigo) > 0;
  return (
    <>
      {naVoz && outras.length > 0 && (
        <Sub rotulo="Mover para">
          {outras.map((x) => (
            <button key={x.id} type="button" className="vz-item" onClick={() => (fechar(), void moverParaCanal(userId, x.id))}>
              <span>🔊 {x.nome}</span>
            </button>
          ))}
        </Sub>
      )}
      <div className="vz-sep" />
      <Chave caixa perigo rotulo="Silenciar voz no servidor" ligado={silenciado} onChange={(x) => void silenciarParaTodos(userId, x)} />
      <Chave caixa perigo rotulo="Desativar áudio no servidor" ligado={surdo} onChange={(x) => void ensurdecerParaTodos(userId, x)} />
      {naVoz && (
        <button
          type="button"
          className={"vz-item perigo" + (certeza ? " sure" : "")}
          onClick={() => {
            if (!certeza) {
              setCerteza(true);
              setTimeout(() => setCerteza(false), 3000);
              return;
            }
            fechar();
            void desconectarDaVoz(userId);
          }}
        >
          <span>{certeza ? "Confirmar: desconectar" : "Desconectar"}</span>
        </button>
      )}
      {deCastigo ? (
        <button type="button" className="vz-item perigo" onClick={() => (fechar(), void castigar(userId, 0))}>
          <span>Tirar o castigo</span>
          <small className="vz-item-sub">até {new Date(castigo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
        </button>
      ) : (
        <Sub rotulo="Castigo">
          {CASTIGOS.map((c) => (
            <button key={c.min} type="button" className="vz-item perigo" onClick={() => (fechar(), void castigar(userId, c.min))}>
              <span>{c.nome}</span>
            </button>
          ))}
          <p className="vz-dica">Sem falar no chat e na voz pelo tempo escolhido.</p>
        </Sub>
      )}
    </>
  );
}

/** Como no Discord, logo abaixo de "Perfil": mencionar no chat e mandar mensagem (no Direct, para quem tem o Celular). */
export function OpcoesConversa({ nome, userId, fechar }: { nome: string; userId: string | null | undefined; fechar: () => void }) {
  const temCelular = useTemCelular();
  return (
    <>
      <button type="button" className="vz-item" onClick={() => (fechar(), mencionarNoChat(nome))}>
        <span>Mencionar</span>
      </button>
      {temCelular && userId && (
        <button type="button" className="vz-item" onClick={() => (fechar(), abrirCelular(), abrirConversa(userId))}>
          <span>Mensagem</span>
        </button>
      )}
    </>
  );
}

/** "Iniciar chamada" e "Adicionar nota" do Discord. */
function ChamarENota({ fid, naMinhaVoz, fechar }: { fid: string; naMinhaVoz: boolean; fechar: () => void }) {
  const naVoz = useApp((s) => !!s.myVozSid);
  const nota = useNotas((s) => s.porFid[fid]);
  return (
    <>
      {naVoz && !naMinhaVoz && (
        <button type="button" className="vz-item" onClick={() => (fechar(), chamarParaCall(fid))}>
          <span>Chamar para a call</span>
        </button>
      )}
      <button type="button" className="vz-item vz-item-2" onClick={(e) => (fechar(), abrirCartao(fid, e, true))}>
        <span>{nota ? "Editar nota" : "Adicionar nota"}</span>
        <small>{nota ? nota : "Visível apenas para você"}</small>
      </button>
    </>
  );
}

/** As caixinhas do Discord: silenciar, silenciar efeitos sonoros (a soundboard) e desativar vídeo (só para mim). */
export function OpcoesSoParaMim({ fid }: { fid: string }) {
  const semVideo = useLive((s) => s.semVideo);
  const semSb = useAjustesVoz((s) => s.semSoundboard);
  const silenciados = useAjustesVoz((s) => s.silenciados);
  return (
    <>
      <Chave caixa rotulo="Silenciar" ligado={silenciados.includes(fid)} onChange={(x) => silenciarNanico(fid, x)} />
      <Chave caixa rotulo="Silenciar efeitos sonoros" ligado={semSb.includes(fid)} onChange={(v) => semSoundboardDe(fid, v)} />
      <Chave caixa rotulo="Desativar vídeo" ligado={semVideo.includes(fid)} onChange={(v) => semVideoDe(fid, v)} />
    </>
  );
}

/** Ignorar e bloquear (as mensagens somem do meu chat; bloquear também silencia a voz e a soundboard). */
function IgnorarBloquear({ fid, fechar }: { fid: string; fechar: () => void }) {
  const ignorado = useNotas((s) => s.ignorados.includes(fid));
  const bloqueado = useNotas((s) => s.bloqueados.includes(fid));
  return (
    <>
      <button type="button" className="vz-item" onClick={() => (fechar(), ignorar(fid, !ignorado), toast(ignorado ? "Não está mais ignorado" : "Ignorado: as mensagens dele ficam escondidas no seu chat"))}>
        <span>{ignorado ? "Deixar de ignorar" : "Ignorar"}</span>
      </button>
      <button
        type="button"
        className="vz-item perigo"
        onClick={() => {
          fechar();
          bloquear(fid, !bloqueado);
          silenciarNanico(fid, !bloqueado);
          semSoundboardDe(fid, !bloqueado);
          toast(bloqueado ? "Desbloqueado" : "Bloqueado: você não vê as mensagens nem ouve a voz dele");
        }}
      >
        <span>{bloqueado ? "Desbloquear" : "Bloquear"}</span>
      </button>
    </>
  );
}

/** Os cargos da pessoa, numa lista (como o "Cargos >" do Discord). */
function Cargos({ fid }: { fid: string }) {
  const f = useApp((s) => s.friends.find((x) => x.id === fid));
  const mods = useStatus((s) => s.mods);
  return (
    <Sub rotulo="Cargos">
      {cargosDe(f, mods).map((c) => (
        <span key={c.nome} className={"vz-item vz-cargo cargo " + c.cls}>
          <i aria-hidden="true" />
          {c.nome}
        </span>
      ))}
    </Sub>
  );
}

/** No meu próprio nome, como no Discord: status, perfil, microfone, som e sair da voz (o volume é dos outros). */
export function OpcoesEu({ fechar }: { fechar: () => void }) {
  const naVoz = useApp((s) => !!s.myVozSid);
  const mudo = useApp((s) => s.vozMudo);
  const surdo = useApp((s) => s.vozSurdo);
  const myFid = useApp((s) => s.myFid);
  return (
    <>
      <button type="button" className="vz-item" onClick={(e) => (fechar(), abrirCartao(myFid, e))}>
        <span>Mudar o status</span>
      </button>
      <button type="button" className="vz-item" onClick={() => (fechar(), setApp({ aba: "perfil" }))}>
        <span>Editar perfil</span>
      </button>
      {naVoz && (
        <>
          <div className="vz-sep" />
          <Chave caixa rotulo="Silenciar" ligado={mudo} onChange={() => alternarMudo()} />
          <Chave caixa rotulo="Ensurdecer" ligado={surdo} onChange={() => alternarSurdo()} />
        </>
      )}
      <button type="button" className="vz-item" onClick={() => (fechar(), setApp({ configAberto: true }))}>
        <span>Configurações de voz</span>
      </button>
      {naVoz && (
        <button type="button" className="vz-item perigo" onClick={() => (fechar(), sairVoz())}>
          <span>Sair da voz</span>
        </button>
      )}
    </>
  );
}

/**
 * O corpo do menu de uma pessoa, na ordem do Discord (do "Perfil" ao "Copiar nome de usuário"). Usado no menu da lista
 * do canal, dos membros e dos quadrados da call (`eu` = sou eu; `live` = mostrar as opções da transmissão dela).
 */
export function CorpoPessoa({ p, fid, nome, eu, fechar, semTela }: { p: Pick<PresencaNanico, "key" | "voz" | "sala" | "live"> | null; fid: string | null; nome: string; eu: boolean; fechar: () => void; semTela?: boolean }) {
  const f = useApp((s) => (fid ? s.friends.find((x) => x.id === fid) : undefined));
  const naMinhaVoz = useApp((s) => !!s.myVozSid && !!p?.voz && p.sala === s.minhaSala);
  const copiar = () => void navigator.clipboard?.writeText("@" + arrobaDe(nome)).then(() => toast("Copiado"));
  return (
    <>
        {fid && (
          <button type="button" className="vz-item" onClick={(e) => (fechar(), abrirCartao(fid, e))}>
            <span>Perfil</span>
          </button>
        )}
        {eu ? (
          <OpcoesEu fechar={fechar} />
        ) : (
          <>
            <OpcoesConversa nome={nome} userId={f?.user_id} fechar={fechar} />
            {fid && <ChamarENota fid={fid} naMinhaVoz={naMinhaVoz} fechar={fechar} />}
            {fid && (
              <>
                <div className="vz-sep" />
                <OpcoesVoz fid={fid} nome={nome} titulo="Volume do usuário" semSilenciar />
                <div className="vz-sep" />
                <OpcoesSoParaMim fid={fid} />
                <IgnorarBloquear fid={fid} fechar={fechar} />
              </>
            )}
          </>
        )}
        {!eu && !semTela && p?.live && (
          <>
            <div className="vz-sep" />
            <OpcoesTela chave={p.key} sala={p.sala ?? null} nome={nome} fechar={fechar} />
          </>
        )}
        <div className="vz-sep" />
        {fid && <Cargos fid={fid} />}
        {!eu && f?.user_id && <OpcoesModerador userId={f.user_id} naVoz={!!p?.voz} sala={p?.sala} fechar={fechar} />}
        <div className="vz-sep" />
        {fid && (
          <button type="button" className="vz-item" onClick={() => (fechar(), setApp({ fichaAberta: fid }))}>
            <span>{eu ? "Ver a minha ficha" : "Ver a ficha"}</span>
          </button>
        )}
        <button type="button" className="vz-item" onClick={() => (fechar(), copiar())}>
          <span>Copiar nome de usuário</span>
        </button>
    </>
  );
}

/** O menu inteiro de uma pessoa: o rosto e o nome em cima, e o corpo. */
export function MenuPessoa({ p, fid, nome, lugar, fechar }: { p: PresencaNanico | null; fid: string | null; nome: string; lugar: Lugar; fechar: () => void }) {
  const eu = !!p?.chaves.includes(MY_KEY);
  const f = useApp((s) => (fid ? s.friends.find((x) => x.id === fid) : undefined));
  /* o balão vai para o corpo da página, mas os eventos do React sobem pela árvore: sem isto, tocar no menu contaria
     como tocar na linha da pessoa (abrir a ficha, entrar no canal) */
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <span className="menu-pessoa" onClick={parar} onPointerDown={parar} onContextMenu={parar} onKeyDown={parar}>
      <Balao lugar={lugar} fechar={fechar} rotulo={`Opções de ${nome}`}>
        {/* cabeçalho como o do Discord: o rosto grande e o nome */}
        <div className="mp-cab">
          {f ? <Avatar f={f} size="lg" /> : <span className="av lg">{nome[0]}</span>}
          <b>{nome}</b>
          {p?.live && <span className="live-pill">AO VIVO</span>}
        </div>
        <CorpoPessoa p={p} fid={fid} nome={nome} eu={eu} fechar={fechar} />
      </Balao>
    </span>
  );
}

/**
 * Abre um menu com o clique direito ou segurando o dedo (0,5 s) no celular, como no Discord. Depois de segurar, o
 * toque que vem em seguida não conta como clique (senão abriria a ficha ou entraria no canal junto).
 */
export function useMenuDeToque(largura = 280) {
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const engolir = useRef(false);
  const abrirEm = (x: number, y: number) => setLugar(lugarDe(new DOMRect(x, y, 0, 0), largura));
  const cancelar = () => {
    clearTimeout(timer.current);
    inicio.current = null;
  };
  const fechar = useCallback(() => setLugar(null), []);
  const props = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cancelar();
      abrirEm(e.clientX, e.clientY);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const { clientX: x, clientY: y } = e;
      inicio.current = { x, y };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        engolir.current = true;
        navigator.vibrate?.(15);
        abrirEm(x, y);
      }, 500);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const i = inicio.current;
      if (i && Math.hypot(e.clientX - i.x, e.clientY - i.y) > 10) cancelar();
    },
    onPointerUp: cancelar,
    onPointerCancel: cancelar,
    onClickCapture: (e: React.MouseEvent) => {
      if (!engolir.current) return;
      engolir.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return { lugar, fechar, props };
}
