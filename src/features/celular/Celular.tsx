"use client";
/*
 * O Celular (item da loja): abre por cima de tudo, com moldura de celular e a hora de Brasília em cima, e um app
 * só, a rede social nanica. No celular de verdade (até 520 px) ocupa a tela inteira, sem moldura. Fecha com Esc.
 * O botão do celular só aparece para quem tem o item; quem garante o acesso à rede é o banco.
 */
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useSure } from "@/components/ui/useSure";
import { useMinhaMochila } from "@/features/loja/lojaDados";
import { Imagem } from "@/features/midias/Imagem";
import { setApp, useApp } from "@/lib/store";
import {
  abrirCelular, apagarComentario, apagarPost, comentar, curtir, fecharCelular, iniciarRede, maisPostagens, postar,
  useRede, verPerfil, type Comentario, type Post,
} from "./rede";

/** Tenho o celular na mochila? Também avisa a rede quando muda (comprou agora). */
export function useTemCelular() {
  const tem = useMinhaMochila().some((l) => l.itemId === "celular");
  useEffect(() => iniciarRede(tem), [tem]);
  return tem;
}

const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const quando = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) return `${Math.round(m / 60)} h`;
  return new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
};

/** Botão do celular (menu e canto do Sítio), com a bolinha de não lidas. Some para quem não tem o item. */
export function BotaoCelular({ className = "" }: { className?: string }) {
  const tem = useTemCelular();
  const nao = useRede((s) => s.naoLidas);
  if (!tem) return null;
  return (
    <button type="button" className={"celular-botao " + className} onClick={abrirCelular} aria-label={`Abrir o celular${nao ? `, ${nao} novas` : ""}`}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
        <path d="M10.5 18.5h3" />
      </svg>
      <span className="t">Celular</span>
      {nao > 0 && <span className="celular-bolinha">{nao > 9 ? "9+" : nao}</span>}
    </button>
  );
}

function Nome({ userId }: { userId: string }) {
  const f = useApp((s) => s.friends.find((x) => x.user_id === userId));
  return (
    <button type="button" className="rede-nome" onClick={() => verPerfil(userId)}>
      <Avatar f={f ?? { name: "?" }} size="xs" />
      <b>{f?.name ?? "Alguém"}</b>
    </button>
  );
}

function ItemComentario({ c }: { c: Comentario }) {
  const eu = useApp((s) => s.myUid);
  const nome = useApp((s) => s.friends.find((x) => x.user_id === c.userId)?.name ?? "Alguém");
  const { sure, pedir } = useSure(3000);
  return (
    <li>
      <b>{nome}</b> {c.texto}
      {c.userId === eu && (
        <button type="button" className={"linkish" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarComentario(c)}>
          {sure ? "Confirmar" : "Apagar"}
        </button>
      )}
    </li>
  );
}

function CartaoPost({ p }: { p: Post }) {
  const eu = useApp((s) => s.myUid);
  const curtidas = useRede((s) => s.curtidas[p.id] ?? []);
  const comentarios = useRede((s) => s.comentarios[p.id] ?? []);
  const [texto, setTexto] = useState("");
  const [abrir, setAbrir] = useState(false);
  const { sure, pedir } = useSure(3000);
  const curti = !!eu && curtidas.includes(eu);
  return (
    <article className="rede-post">
      <header>
        <Nome userId={p.userId} />
        <small>{quando(p.em)}</small>
        {p.userId === eu && (
          <button type="button" className={"linkish" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarPost(p)}>
            {sure ? "Confirmar" : "Apagar"}
          </button>
        )}
      </header>
      <p className="rede-texto">{p.texto}</p>
      {p.midia && <Imagem caminho={p.midia} alt={p.texto.slice(0, 80)} />}
      <div className="rede-acoes">
        <button type="button" className={"rede-curtir" + (curti ? " on" : "")} aria-pressed={curti} onClick={() => void curtir(p)}>
          {curti ? "♥" : "♡"} {curtidas.length || ""}
        </button>
        <button type="button" className="linkish" onClick={() => setAbrir((v) => !v)}>
          {comentarios.length ? `${comentarios.length} comentário${comentarios.length > 1 ? "s" : ""}` : "Comentar"}
        </button>
      </div>
      {(abrir || comentarios.length > 0) && (
        <div className="rede-coments">
          {comentarios.length > 0 && <ul>{comentarios.map((c) => <ItemComentario key={c.id} c={c} />)}</ul>}
          {abrir && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void comentar(p, texto).then((ok) => ok && setTexto(""));
              }}
            >
              <input aria-label="Comentário" maxLength={280} placeholder="Comente…" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <button type="submit" className="btn sm" disabled={!texto.trim()}>
                Enviar
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function Postar() {
  const enviando = useRede((s) => s.enviando);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const enviar = async () => {
    if (await postar(texto, arquivo)) {
      setTexto("");
      setArquivo(null);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <form
      className="rede-postar"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <textarea aria-label="O que está rolando?" maxLength={500} rows={2} placeholder="O que está rolando?" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="row">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        <button type="button" className="btn soft sm" onClick={() => input.current?.click()}>
          {arquivo ? "Trocar imagem" : "Imagem"}
        </button>
        {arquivo && <small className="rede-arquivo">{arquivo.name}</small>}
        <span className="rede-conta">{texto.length}/500</span>
        <button type="submit" className="btn sm" disabled={enviando || !texto.trim()}>
          {enviando ? "Postando…" : "Postar"}
        </button>
      </div>
    </form>
  );
}

function Rede() {
  const posts = useRede((s) => s.posts);
  const fim = useRede((s) => s.fim);
  const carregando = useRede((s) => s.carregando);
  const perfil = useRede((s) => s.perfil);
  const fPerfil = useApp((s) => (perfil ? s.friends.find((f) => f.user_id === perfil) : undefined));
  return (
    <div className="rede">
      {perfil ? (
        <div className="rede-perfil">
          <button type="button" className="linkish" onClick={() => verPerfil(null)}>
            ← Feed
          </button>
          <b>{fPerfil?.name ?? "Perfil"}</b>
          {fPerfil && (
            <button
              type="button"
              className="btn soft sm"
              onClick={() => {
                fecharCelular();
                setApp({ fichaAberta: fPerfil.id });
              }}
            >
              Ver ficha
            </button>
          )}
        </div>
      ) : (
        <Postar />
      )}
      {posts.map((p) => (
        <CartaoPost key={p.id} p={p} />
      ))}
      {!posts.length && !carregando && <p className="status">Nada postado ainda.</p>}
      {!fim && posts.length > 0 && (
        <button type="button" className="btn soft sm rede-mais" disabled={carregando} onClick={() => void maisPostagens()}>
          {carregando ? "Carregando…" : "Ver mais"}
        </button>
      )}
    </div>
  );
}

/** O celular aberto, por cima de tudo. */
export function Celular() {
  const aberto = useRede((s) => s.aberto);
  const [agora, setAgora] = useState(hora);
  useEffect(() => {
    if (!aberto) return;
    const t = setInterval(() => setAgora(hora()), 20_000);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fecharCelular();
    window.addEventListener("keydown", esc);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  if (!aberto) return null;
  return (
    <div className="celular-fundo" onClick={(e) => e.target === e.currentTarget && fecharCelular()}>
      <div className="celular" role="dialog" aria-modal="true" aria-label="Celular: rede nanica">
        <div className="celular-barra">
          <span>{agora}</span>
          <b>rede nanica</b>
          <button type="button" className="btn soft sm" onClick={fecharCelular}>
            Fechar
          </button>
        </div>
        <div className="celular-tela">
          <Rede />
        </div>
      </div>
    </div>
  );
}
