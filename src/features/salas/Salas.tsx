"use client";
/*
 * Janela das salas (abre pela porta de vidro do Sítio): um cartão por sala,
 * como uma máquina de lan house, com quem está ali, quem está ao vivo e quem está em partida;
 * o chat geral ao lado (embaixo, no celular). No menu, as salas aparecem como canais de voz (shell/Canais.tsx).
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as KE } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcFechar } from "@/components/ui/icones";
import { enviarChat, useChat } from "@/features/chat/chat";
import { carregarFicha, useFicha } from "@/features/ficha/estado";
import { csTexto, eloTexto, kdaTexto } from "@/features/ficha/numeros";
import { riotEmJogo, useRiot } from "@/features/jogar/riot";
import { opggOf } from "@/features/perfil/opgg";
import { steamOf } from "@/features/perfil/steam";
import { friendDaPresenca, MY_KEY, setApp, useApp } from "@/lib/store";
import { errMsg } from "@/lib/supabase";
import type { Friend, Presence, Sala } from "@/lib/tipos";
import { toast } from "@/lib/toast";
import { entrarSala } from "./trocar";

const JOGO: Record<Sala["jogo"], string> = { lol: "League of Legends", cs: "Counter-Strike 2", outro: "Resenha" };

/** Rosto num cartão de sala; passando o mouse (ou tocando), mostra os números daquele jogo e os links. */
function RostoSala({ p, f, jogo }: { p: Presence; f: Friend | undefined; jogo: Sala["jogo"] }) {
  const [aberto, setAberto] = useState(false);
  const num = useFicha((s) => (f ? s.porNanico[f.id] : undefined));
  const abrir = () => {
    setAberto(true);
    if (f && !num) carregarFicha(f.id);
  };
  const nome = f?.name ?? p.name;
  const lol = num?.lol?.dados;
  const cs = csTexto(num?.cs?.dados);
  const opgg = f ? opggOf(f) : "";
  const st = f ? steamOf(f) : "";
  return (
    <span className="rosto-sala" onMouseEnter={abrir} onMouseLeave={() => setAberto(false)}>
      <button type="button" aria-label={`${nome}: ver números e links`} aria-expanded={aberto} onFocus={abrir} onBlur={() => setAberto(false)} onClick={abrir}>
        {f ? <Avatar f={f} size="xs" /> : <span className="av xs">{nome[0]}</span>}
      </button>
      {aberto && (
        <span className="rosto-info" role="tooltip">
          <b>{nome}</b>
          {jogo === "lol" && lol && (
            <span>
              {eloTexto(lol)}
              {lol.kda !== null && ` · KDA ${kdaTexto(lol.kda)}`}
            </span>
          )}
          {jogo === "cs" && cs && <span>{cs}</span>}
          {(opgg || st) && (
            <span className="links">
              {opgg && (
                <a href={opgg} target="_blank" rel="noopener noreferrer">
                  op.gg ↗
                </a>
              )}
              {st && (
                <a href={st} target="_blank" rel="noopener noreferrer">
                  Steam ↗
                </a>
              )}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function CartaoSala({ sala, pessoas, minha }: { sala: Sala; pessoas: Presence[]; minha: boolean }) {
  const friends = useApp((s) => s.friends);
  const jogos = useRiot((s) => s.jogos);
  const emJogo = riotEmJogo(jogos);
  const aoVivo = pessoas.filter((p) => p.live).length;
  const emPartida = pessoas.filter((p) => {
    const f = friendDaPresenca(p, friends);
    return f && emJogo.has(f.id);
  }).length;
  return (
    <article className={"block sala-card" + (minha ? " minha" : "")}>
      <header>
        <h3>{sala.nome}</h3>
        <small>{JOGO[sala.jogo]}</small>
      </header>
      <div className="sala-rostos">
        {pessoas.length ? (
          pessoas.map((p) => <RostoSala key={p.key} p={p} f={friendDaPresenca(p, friends)} jogo={sala.jogo} />)
        ) : (
          <span className="hint">Ninguém ainda</span>
        )}
      </div>
      <p className="sala-status">
        {aoVivo > 0 && <span className="live-pill">{aoVivo} AO VIVO</span>}
        {emPartida > 0 && <span className="ingame-pill">{emPartida} EM PARTIDA</span>}
        {sala.discord && <span className="hint">Discord: {sala.discord}</span>}
      </p>
      {minha ? (
        <button type="button" className="btn soft sm" onClick={() => entrarSala(null)}>
          Sair para o lobby
        </button>
      ) : (
        <button type="button" className="btn sm" onClick={() => entrarSala(sala.id)}>
          Entrar na sala
        </button>
      )}
    </article>
  );
}

/** Chat geral do lobby (o mesmo para todo mundo, esteja onde estiver). */
function ChatGeral() {
  const msgs = useChat((s) => s.geral);
  const friends = useApp((s) => s.friends);
  const [texto, setTexto] = useState("");
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [msgs.length]);
  const mandar = async (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    try {
      await enviarChat(t, "geral");
      setTexto("");
    } catch (err) {
      toast(errMsg(err, "Não deu para mandar. Confira a internet."));
    }
  };
  return (
    <section className="block chat-geral" aria-labelledby="chatGeralTitulo">
      <h3 id="chatGeralTitulo">Chat geral</h3>
      <div className="chat-geral-lista" ref={lista}>
        {msgs.length ? (
          msgs.slice(-40).map((m) => {
            const f = friends.find((x) => x.user_id === m.user_id);
            return (
              <p key={m.id}>
                <b>{f?.name ?? "Alguém"}:</b> {m.text}
              </p>
            );
          })
        ) : (
          <p className="hint">Ninguém falou ainda.</p>
        )}
      </div>
      <form onSubmit={mandar}>
        <input value={texto} maxLength={300} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva para todo mundo" aria-label="Mensagem para o chat geral" />
        <button className="btn sm" type="submit">
          Enviar
        </button>
      </form>
    </section>
  );
}

/** A janela das salas. */
export function SalasJanela() {
  const aberto = useApp((s) => s.salasAberto);
  return aberto ? <SalasAberta /> : null;
}

function SalasAberta() {
  const salas = useApp((s) => s.salas);
  const online = useApp((s) => s.online);
  const minha = useApp((s) => s.minhaSala);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => setApp({ salasAberto: false });
  useEffect(() => {
    fecharRef.current?.focus();
  }, []);
  const tecla = (e: KE<HTMLDivElement>) => e.key === "Escape" && fechar();
  return (
    <div className="gate salas-gate" role="dialog" aria-modal="true" aria-labelledby="salasTitulo" onKeyDown={tecla} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="salas-card">
        <div className="salas-topo">
          <h2 id="salasTitulo">Salas</h2>
          <p className="hint">Cada sala tem voz, live, câmeras e chat próprios.</p>
          <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar as salas" onClick={fechar}>
            <IcFechar />
          </button>
        </div>
        <div className="salas-corpo">
          <div className="salas-grade">
            {salas.map((s) => (
              <CartaoSala key={s.id} sala={s} minha={minha === s.id} pessoas={online.filter((p) => p.sala === s.id || (p.key === MY_KEY && minha === s.id))} />
            ))}
          </div>
          <ChatGeral />
        </div>
      </div>
    </div>
  );
}
