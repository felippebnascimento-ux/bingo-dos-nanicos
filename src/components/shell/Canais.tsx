"use client";
/*
 * Canais na barra lateral, como no Discord:
 * - "Canais de voz": uma linha por sala, com quem está nela embaixo (anel aceso em quem está falando)
 *   e quem está transmitindo. Clicar entra na sala e na voz e abre o Ao vivo; o AO VIVO de alguém (vira "Assistir"
 *   com o mouse em cima) entra na sala dele só para assistir, sem voz, e já abre a tela da pessoa.
 *   O chat de cada sala é o chat do canal de voz: fica no painel do Ao vivo, e o canal mostra as mensagens novas dele.
 * - "Canais de texto": só o #geral (o único chat de todo mundo), com as não lidas e quem está olhando agora.
 * Cada categoria recolhe (fica só o canal onde eu estou). O painel da voz conectada fica em features/live/PainelVoz.tsx.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcFoneDesligado, IcHash, IcMicDesligado, IcSemSom, IcSeta, IcVolume } from "@/components/ui/icones";
import { abrirCanalTexto, marcarComoLido, silenciarCanal, useChat } from "@/features/chat/chat";
import { Balao } from "@/features/live/PainelVoz";
import { MenuPessoa, useMenuDeToque } from "@/features/live/MenuPessoa";
import { entrarVoz, useAjustesVoz, useVoz } from "@/features/live/voz";
import { entrarSala } from "@/features/salas/trocar";
import type { PresencaNanico } from "@/lib/presenca";
import { friendDaPresenca, getApp, MY_KEY, setApp, useApp } from "@/lib/store";
import { ehCelular, local } from "@/lib/util";
import { abrirCartao } from "./CartaoPerfil";
import { assistirLive, useNanicosOnline } from "./People";

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
  const f = friendDaPresenca(p, friends);
  const nome = f?.name ?? p.name;
  const eu = p.chaves.includes(MY_KEY);
  const naVoz = !!p.voz;
  /* como no Discord: o clique abre o cartão de perfil (com o volume, se estamos na mesma voz); o clique direito (ou
     segurar o dedo) abre o menu com o volume, silenciar, a transmissão e a ficha */
  const menu = useMenuDeToque();
  const silenciei = useAjustesVoz((s) => !eu && !!p.fid && s.silenciados.includes(p.fid));
  const vol = useAjustesVoz((s) => (p.fid ? (s.por[p.fid] ?? 1) : 1));
  return (
    <li
      className={"canal-pessoa" + (naVoz ? "" : " sem-voz") + (falando ? " falando" : "") + (eu ? " me" : "") + (menu.lugar ? " menu" : "")}
      title={naVoz ? nome : `${nome}: na sala, fora da voz`}
      {...menu.props}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a")) return;
        abrirCartao(p.fid, e);
      }}
    >
      {f ? <Avatar f={f} size="xs" /> : <span className="av xs">{nome[0]}</span>}
      <span className="nm">{nome}</span>
      {/* um clique assiste: de outra sala, entra nela só para ver (sem voz) e abre a tela da pessoa */}
      {p.live && p.sala && (
        <button type="button" className="live-pill vira" onClick={() => assistirLive(p.key, p.sala)} aria-label={eu ? "Ver a sua transmissão" : `Assistir a tela de ${nome}`}>
          <span className="a">AO VIVO</span>
          <span className="b">▶ ASSISTIR</span>
        </button>
      )}
      {/* o volume que eu mudei e quem eu silenciei (só para mim, como no Discord) */}
      {!eu && !silenciei && vol !== 1 && (
        <small className="canal-vol" title={`Você deixou a voz de ${nome} em ${Math.round(vol * 100)}%`}>
          {Math.round(vol * 100)}%
        </small>
      )}
      {silenciei && <IcSemSom tam={14} className="canal-silenciei" aria-label={`Você silenciou ${nome}`} role="img" />}
      {naVoz && p.surdo ? (
        <IcFoneDesligado tam={14} aria-label="Sem ouvir" role="img" />
      ) : naVoz && p.mudo ? (
        <IcMicDesligado tam={14} aria-label="Microfone desligado" role="img" />
      ) : null}
      {menu.lugar && <MenuPessoa p={p} fid={p.fid ?? null} nome={nome} lugar={menu.lugar} fechar={menu.fechar} />}
    </li>
  );
}

/**
 * Clicar num canal de voz: entra na sala (se precisar) e na voz, e abre o Ao vivo (as transmissões da sala).
 * Com mensagem nova no chat da sala, abre direto no chat.
 */
function clicarVoz(id: string) {
  const s = getApp();
  if (s.minhaSala !== id) entrarSala(id);
  if (!getApp().myVozSid) entrarVoz();
  const novas = s.minhaSala === id && (useChat.getState().naoLidas[id] ?? 0) > 0;
  setApp(novas ? { aba: "live", railTab: "chat" } : { aba: "live" });
}

/** Um canal de texto: o clique direito (ou segurar o dedo) abre "Marcar como lido" e "Silenciar canal". */
function LinhaCanal({ id, nome, children }: { id: string; nome: string; children: ReactNode }) {
  const menu = useMenuDeToque(220);
  const mudo = useChat((s) => s.mudos.includes(id));
  return (
    <li {...menu.props}>
      {children}
      {menu.lugar && (
        <Balao lugar={menu.lugar} fechar={menu.fechar} rotulo={`Opções de #${nome}`}>
          <h4>#{nome}</h4>
          <button type="button" className="vz-item" onClick={() => (menu.fechar(), marcarComoLido(id))}>
            <span>Marcar como lido</span>
          </button>
          <button type="button" className="vz-item" onClick={() => (menu.fechar(), silenciarCanal(id, !mudo))}>
            <span>{mudo ? "Voltar a avisar" : "Silenciar canal"}</span>
          </button>
          <p className="vz-dica">{mudo ? "Silenciado: só as menções a você aparecem." : "Silenciando, as mensagens novas não aparecem; só as menções a você."}</p>
        </Balao>
      )}
    </li>
  );
}

export function Canais() {
  const salas = useApp((s) => s.salas);
  const minhaSala = useApp((s) => s.minhaSala);
  const naAbaChat = useApp((s) => s.aba === "chat");
  const canalTexto = useApp((s) => s.canalTexto);
  const naoLidas = useChat((s) => s.naoLidas);
  const mencoes = useChat((s) => s.mencoes);
  const mudos = useChat((s) => s.mudos);
  const falando = useVoz((s) => s.falando);
  const friends = useApp((s) => s.friends);
  const pessoas = useNanicosOnline();
  const falandoSet = useMemo(() => new Set(falando), [falando]);
  if (!salas.length) return null;

  const fala = (p: PresencaNanico) => p.chaves.some((k) => falandoSet.has(k));
  /* o chat de cada sala é o do canal de voz (no Ao vivo); de texto, só o geral */
  const canaisTexto = [{ id: "geral", nome: "geral" }];

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
                    {/* mensagens novas no chat do canal (só o da minha sala: o das outras só dá para ler entrando) */}
                    {minha && (naoLidas[s.id] ?? 0) > 0 && (
                      <span className="canal-novas" aria-label={`${naoLidas[s.id]} no chat da sala`}>
                        {naoLidas[s.id] > 99 ? "99+" : naoLidas[s.id]}
                      </span>
                    )}
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
              const at = mencoes[c.id] ?? 0;
              const mudo = mudos.includes(c.id);
              const lendo = pessoas.filter((p) => p.texto === c.id);
              return (
                <LinhaCanal key={c.id} id={c.id} nome={c.nome}>
                  <button
                    type="button"
                    className={"canal" + (aberto ? " on" : "") + (n && !mudo ? " novo" : "") + (mudo ? " mudo" : "")}
                    aria-current={aberto ? "page" : undefined}
                    aria-label={`Canal de texto ${c.nome}` + (at ? `, ${at} ${at === 1 ? "menção" : "menções"} a você` : "") + (n ? `, ${n} ${n === 1 ? "mensagem nova" : "mensagens novas"}` : "") + (mudo ? ", silenciado" : "")}
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
                    {mudo && <IcSemSom tam={13} className="canal-mudo" aria-hidden="true" />}
                    {/* como no Discord: a bolinha vermelha conta só as menções; mensagem nova deixa o nome em destaque */}
                    {at > 0 ? <span className="canal-novas mencao">@{at > 99 ? "99+" : at}</span> : n > 0 && !mudo ? <span className="canal-ponto" aria-hidden="true" /> : null}
                  </button>
                </LinhaCanal>
              );
            })}
          </ul>
        )}
      </Categoria>
    </section>
  );
}
