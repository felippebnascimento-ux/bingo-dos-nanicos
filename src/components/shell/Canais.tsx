"use client";
/*
 * Canais na barra lateral, como no Discord:
 * - "Canais de voz": uma linha por sala, com quem está nela embaixo (anel aceso em quem está falando)
 *   e quem está transmitindo. Clicar entra na sala e na voz e abre o Ao vivo; clicar no AO VIVO de alguém
 *   faz o mesmo e já abre a tela da pessoa.
 * - "Canais de texto": #geral e o chat de cada sala, com as não lidas e quem está olhando agora.
 * Cada categoria recolhe (fica só o canal onde eu estou). E o painel da voz conectada (microfone, fone, desligar).
 */
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcDesligar, IcFone, IcFoneDesligado, IcHash, IcMic, IcMicDesligado, IcSeta, IcVolume } from "@/components/ui/icones";
import { abrirCanalTexto, useChat } from "@/features/chat/chat";
import { alternarMudo, alternarSurdo, entrarVoz, useVoz } from "@/features/live/voz";
import { entrarSala, nomeDaSala } from "@/features/salas/trocar";
import type { PresencaNanico } from "@/lib/presenca";
import { friendDaPresenca, getApp, MY_KEY, setApp, useApp } from "@/lib/store";
import { ehCelular, local } from "@/lib/util";
import { goWatch, useNanicosOnline } from "./People";

/** Categoria recolhível; recolhida, mostra só o que `fica` deixar (o canal onde eu estou). */
function Categoria({ chave, titulo, children }: { chave: string; titulo: string; children: (recolhida: boolean) => ReactNode }) {
  /* no celular, começa recolhida (o menu fica em cima do conteúdo) */
  const [min, setMin] = useState(() => {
    const v = local.get(chave);
    return v === null ? ehCelular() : v === "1";
  });
  const alternar = () => {
    setMin(!min);
    local.set(chave, min ? "0" : "1");
  };
  return (
    <div className={"canal-cat" + (min ? " min" : "")}>
      <button type="button" className="canal-cat-t" aria-expanded={!min} onClick={alternar}>
        <IcSeta tam={12} />
        {titulo}
      </button>
      {children(min)}
    </div>
  );
}

/** Rosto pequeno de quem está num canal; o anel acende quando a pessoa fala. */
function PessoaCanal({ p, falando }: { p: PresencaNanico; falando: boolean }) {
  const friends = useApp((s) => s.friends);
  const minhaSala = useApp((s) => s.minhaSala);
  const f = friendDaPresenca(p, friends);
  const nome = f?.name ?? p.name;
  const eu = p.chaves.includes(MY_KEY);
  const naVoz = !!p.voz;
  return (
    <li className={"canal-pessoa" + (naVoz ? "" : " sem-voz") + (falando ? " falando" : "") + (eu ? " me" : "")} title={naVoz ? nome : `${nome}: na sala, fora da voz`}>
      {f ? <Avatar f={f} size="xs" /> : <span className="av xs">{nome[0]}</span>}
      <span className="nm">{nome}</span>
      {/* de outra sala: entra no canal (voz) e abre a tela da pessoa assim que ela aparecer na sala */}
      {p.live && p.sala && (
        <button
          type="button"
          className="live-pill"
          onClick={() => (p.sala === minhaSala ? goWatch(p.key) : assistirEmOutraSala(p.sala!, p.key))}
          aria-label={eu ? "Ver a sua transmissão" : p.sala === minhaSala ? `Assistir a tela de ${nome}` : `Entrar no canal e assistir a tela de ${nome}`}
        >
          AO VIVO
        </button>
      )}
      {naVoz && p.surdo ? (
        <IcFoneDesligado tam={14} aria-label="Sem ouvir" role="img" />
      ) : naVoz && p.mudo ? (
        <IcMicDesligado tam={14} aria-label="Microfone desligado" role="img" />
      ) : null}
    </li>
  );
}

/** Clicar num canal de voz: entra na sala (se precisar) e na voz, e abre o Ao vivo (as transmissões da sala). */
function clicarVoz(id: string) {
  const s = getApp();
  if (s.minhaSala !== id) entrarSala(id);
  if (!getApp().myVozSid) entrarVoz();
  setApp({ aba: "live" });
}

/**
 * AO VIVO de alguém de outra sala: entra no canal e abre a tela da pessoa quando ela aparecer
 * na lista da minha sala (a presença do canal novo leva um instante). Desiste em 10 s.
 */
function assistirEmOutraSala(sala: string, key: string) {
  clicarVoz(sala);
  const tentar = () => {
    if (getApp().minhaSala !== sala) return true;
    if (!getApp().onlineSala.some((p) => p.key === key && p.live)) return false;
    goWatch(key);
    return true;
  };
  if (tentar()) return;
  const parar = useApp.subscribe(() => {
    if (tentar()) fim();
  });
  const t = setTimeout(() => fim(), 10000);
  const fim = () => {
    parar();
    clearTimeout(t);
  };
}

export function Canais() {
  const salas = useApp((s) => s.salas);
  const minhaSala = useApp((s) => s.minhaSala);
  const naAbaChat = useApp((s) => s.aba === "chat");
  const canalTexto = useApp((s) => s.canalTexto);
  const naoLidas = useChat((s) => s.naoLidas);
  const falando = useVoz((s) => s.falando);
  const friends = useApp((s) => s.friends);
  const pessoas = useNanicosOnline();
  if (!salas.length) return null;

  const fala = (p: PresencaNanico) => p.chaves.some((k) => falando.includes(k));
  const canaisTexto = [{ id: "geral", nome: "geral" }, ...salas.map((s) => ({ id: s.id, nome: s.nome.toLowerCase().replace(/\s+/g, "-") }))];

  return (
    <section className="canais" aria-label="Canais">
      <Categoria chave="canais-voz-min" titulo="Canais de voz">
        {(min) => (
          <ul className="canal-lista">
            {salas.map((s) => {
              const minha = s.id === minhaSala;
              if (min && !minha) return null;
              const nela = pessoas.filter((p) => p.sala === s.id);
              return (
                <li key={s.id} className={"canal-voz" + (minha ? " minha" : "")}>
                  <button
                    type="button"
                    className="canal"
                    aria-current={minha ? "location" : undefined}
                    aria-label={minha ? `${s.nome}: abrir as transmissões da sala` : `Entrar na ${s.nome} (voz, transmissões e chat)`}
                    title={minha ? "Abrir as transmissões da sala" : "Entrar na sala e na voz"}
                    onClick={() => clicarVoz(s.id)}
                  >
                    <IcVolume tam={16} />
                    <span className="nm">{s.nome}</span>
                    {nela.some((p) => p.live) && <span className="canal-live" title="Alguém transmitindo" aria-label="Alguém transmitindo" />}
                    {nela.length > 0 && <span className="canal-n">{nela.length}</span>}
                  </button>
                  {nela.length > 0 && (
                    <ul className="canal-pessoas">
                      {nela.map((p) => (
                        <PessoaCanal key={p.id} p={p} falando={fala(p)} />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Categoria>
      <Categoria chave="canais-texto-min" titulo="Canais de texto">
        {(min) => (
          <ul className="canal-lista">
            {canaisTexto.map((c) => {
              const aberto = naAbaChat && canalTexto === c.id;
              if (min && !aberto) return null;
              const n = naoLidas[c.id] ?? 0;
              const lendo = pessoas.filter((p) => p.texto === c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={"canal" + (aberto ? " on" : "") + (n ? " novo" : "")}
                    aria-current={aberto ? "page" : undefined}
                    aria-label={`Canal de texto ${c.nome}` + (n ? `, ${n} ${n === 1 ? "mensagem nova" : "mensagens novas"}` : "")}
                    onClick={() => abrirCanalTexto(c.id)}
                  >
                    <IcHash tam={16} />
                    <span className="nm">{c.nome}</span>
                    {lendo.length > 0 && (
                      <span className="canal-rostos" title={"Aqui agora: " + lendo.map((p) => friendDaPresenca(p, friends)?.name ?? p.name).join(", ")}>
                        {lendo.slice(0, 3).map((p) => {
                          const f = friendDaPresenca(p, friends);
                          return f ? <Avatar key={p.id} f={f} size="xs" /> : null;
                        })}
                        {lendo.length > 3 && <small>+{lendo.length - 3}</small>}
                      </span>
                    )}
                    {n > 0 && <span className="canal-novas">{n > 99 ? "99+" : n}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Categoria>
    </section>
  );
}

/**
 * Painel de quem está numa sala: voz conectada (microfone e fone) ou o convite para entrar na voz.
 * Desligar é sair da sala (encerra a voz, a tela e a câmera e volta para o lobby), como no Discord.
 */
export function VozPainel() {
  const minhaSala = useApp((s) => s.minhaSala);
  const salas = useApp((s) => s.salas);
  const voz = useApp((s) => s.myVozSid);
  const mudo = useApp((s) => s.vozMudo);
  const surdo = useApp((s) => s.vozSurdo);
  const nome = nomeDaSala(minhaSala, salas);
  if (!minhaSala || !nome) return null;
  return (
    <div className={"voz-painel" + (voz ? " on" : "")}>
      <div className="voz-info">
        <b>{voz ? "Voz conectada" : "Na sala, fora da voz"}</b>
        <small>{nome}</small>
      </div>
      <div className="voz-botoes">
        {voz ? (
          <>
            <button type="button" className={"voz-btn" + (mudo ? " off" : "")} aria-pressed={mudo} aria-label={mudo ? "Ligar o microfone" : "Desligar o microfone"} title={mudo ? "Ligar o microfone" : "Desligar o microfone"} onClick={alternarMudo}>
              {mudo ? <IcMicDesligado /> : <IcMic />}
            </button>
            <button type="button" className={"voz-btn" + (surdo ? " off" : "")} aria-pressed={surdo} aria-label={surdo ? "Voltar a ouvir" : "Parar de ouvir"} title={surdo ? "Voltar a ouvir" : "Parar de ouvir"} onClick={alternarSurdo}>
              {surdo ? <IcFoneDesligado /> : <IcFone />}
            </button>
          </>
        ) : (
          <button type="button" className="btn sm" onClick={entrarVoz}>
            Entrar na voz
          </button>
        )}
        <button type="button" className="voz-btn sair" aria-label={`Desligar e sair da ${nome}`} title="Desligar e sair da sala" onClick={() => entrarSala(null)}>
          <IcDesligar />
        </button>
      </div>
    </div>
  );
}
