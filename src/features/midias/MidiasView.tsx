"use client";
/*
 * Aba Mídias: galeria de prints e vídeos do grupo (vídeo entra como link) e o mural de links.
 * Imagens vêm do bucket privado como blob: e só carregam quando aparecem na tela. Link externo abre em nova aba,
 * sem iframe e sem prévia (a CSP bloqueia, de propósito).
 */
import { useEffect, useRef, useState } from "react";
import { Imagem } from "./Imagem";
import { Avatar } from "@/components/ui/Avatar";
import { useSure } from "@/components/ui/useSure";
import { cleanMural, cleanVideo, dominio } from "@/features/perfil/links";
import { friendOf, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import {
  adicionarMural, apagarMidia, apagarMural, enviarImagem, enviarVideo, useMidias,
  type LinkMural, type Midia,
} from "./midiasDados";

const quando = (t: number) =>
  t ? new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "";

function CartaoMidia({ m, abrir }: { m: Midia; abrir: (m: Midia) => void }) {
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const salas = useApp((s) => s.salas);
  const autor = friends.find((f) => f.user_id === m.userId);
  const sala = salas.find((s) => s.id === m.sala)?.nome;
  const { sure, pedir } = useSure(3000);
  return (
    <li className="midia">
      {m.caminho ? (
        <button type="button" className="midia-abrir" onClick={() => abrir(m)} aria-label={`Abrir ${m.legenda || "imagem"}`}>
          <Imagem caminho={m.caminho} alt={m.legenda || "Print do grupo"} />
        </button>
      ) : (
        <a className="midia-video" href={m.link!} target="_blank" rel="noopener noreferrer">
          <span className="midia-play" aria-hidden="true">▶</span>
          <b>{dominio(m.link!)}</b>
          <small>Abrir o vídeo ↗</small>
        </a>
      )}
      <div className="midia-info">
        {m.legenda && <p>{m.legenda}</p>}
        <span className="midia-quem">
          <Avatar f={autor ?? { name: "?" }} size="xs" />
          <small>
            {autor?.name ?? "Alguém"} · {quando(m.em)}
            {sala && ` · ${sala}`}
          </small>
          {m.userId === myUid && (
            <button type="button" className={"linkish" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarMidia(m)}>
              {sure ? "Confirmar" : "Apagar"}
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

function Enviar() {
  const enviando = useMidias((s) => s.enviando);
  const [legenda, setLegenda] = useState("");
  const [link, setLink] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  const mandarArquivo = async (f: File | undefined) => {
    if (!f) return;
    if (await enviarImagem(f, legenda)) setLegenda("");
    if (arquivo.current) arquivo.current.value = "";
  };
  const mandarLink = async () => {
    const v = cleanVideo(link);
    if (!v) return toast("Esse link não é de vídeo. Use um do YouTube, do Medal ou um clipe da Twitch.");
    if (await enviarVideo(v, legenda)) {
      setLink("");
      setLegenda("");
    }
  };
  return (
    <div className="block midias-enviar">
      <h2>Mandar uma mídia</h2>
      <label className="lbl" htmlFor="midiaLegenda">
        Legenda (opcional)
      </label>
      <input id="midiaLegenda" maxLength={140} value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="o que rolou aqui?" />
      <div className="row midias-acoes">
        <input
          ref={arquivo}
          id="midiaArquivo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => void mandarArquivo(e.target.files?.[0])}
        />
        <button type="button" className="btn" disabled={enviando} onClick={() => arquivo.current?.click()}>
          {enviando ? "Enviando…" : "Escolher imagem"}
        </button>
      </div>
      <form
        className="row midias-link"
        onSubmit={(e) => {
          e.preventDefault();
          void mandarLink();
        }}
      >
        <input
          type="url"
          inputMode="url"
          aria-label="Link de vídeo"
          placeholder="ou cole um link de vídeo (YouTube, Medal, clipe da Twitch)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button type="submit" className="btn soft" disabled={!link.trim()}>
          Adicionar vídeo
        </button>
      </form>
      <p className="hint">Imagens até 5 MB (o site comprime antes de mandar). Vídeo entra como link.</p>
    </div>
  );
}

function ItemMural({ l }: { l: LinkMural }) {
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const autor = friends.find((f) => f.user_id === l.userId);
  const { sure, pedir } = useSure(3000);
  return (
    <li className="mural-item">
      <a href={l.url} target="_blank" rel="noopener noreferrer">
        <b className="mural-dominio">{dominio(l.url)}</b>
        <span>{l.titulo || l.url}</span>
      </a>
      <span className="midia-quem">
        <Avatar f={autor ?? { name: "?" }} size="xs" />
        <small>
          {autor?.name ?? "Alguém"} · {quando(l.em)}
        </small>
        {l.userId === myUid && (
          <button type="button" className={"linkish" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarMural(l.id)}>
            {sure ? "Confirmar" : "Apagar"}
          </button>
        )}
      </span>
    </li>
  );
}

function Mural() {
  const mural = useMidias((s) => s.mural);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const adicionar = async () => {
    const v = cleanMural(url);
    if (!v) return toast("Use um link que comece com https://");
    if (await adicionarMural(v, titulo)) {
      setUrl("");
      setTitulo("");
    }
  };
  return (
    <>
      <form
        className="block mural-form"
        onSubmit={(e) => {
          e.preventDefault();
          void adicionar();
        }}
      >
        <h2>Pôr no mural</h2>
        <input type="url" inputMode="url" aria-label="Link" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input aria-label="Título" maxLength={80} placeholder="Título (build do Garen, jogo para jogar…)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <button type="submit" className="btn" disabled={!url.trim()}>
          Pôr no mural
        </button>
      </form>
      {mural.length ? (
        <ul className="mural">{mural.map((l) => <ItemMural key={l.id} l={l} />)}</ul>
      ) : (
        <p className="status">O mural está vazio. Ponha o primeiro link.</p>
      )}
    </>
  );
}

export function MidiasView({ hidden }: { hidden: boolean }) {
  const ok = useMidias((s) => s.ok);
  const midias = useMidias((s) => s.midias);
  const friends = useApp((s) => s.friends);
  const [aba, setAba] = useState<"galeria" | "mural">("galeria");
  const [aberta, setAberta] = useState<Midia | null>(null);
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta]);

  return (
    <section id="view-midias" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Mídias</h1>
        <p>Prints, vídeos e links do grupo.</p>
      </header>
      {ok === false ? (
        <p className="status">As mídias ainda não estão ligadas no banco.</p>
      ) : (
        <>
          <div className="seg midias-abas" role="radiogroup" aria-label="Galeria ou mural">
            <button type="button" role="radio" aria-checked={aba === "galeria"} onClick={() => setAba("galeria")}>
              Galeria
            </button>
            <button type="button" role="radio" aria-checked={aba === "mural"} onClick={() => setAba("mural")}>
              Mural de links
            </button>
          </div>
          {aba === "galeria" ? (
            <>
              <Enviar />
              {midias.length ? (
                <ul className="midias-grade">{midias.map((m) => <CartaoMidia key={m.id} m={m} abrir={setAberta} />)}</ul>
              ) : (
                <p className="status">Nenhuma mídia ainda. Mande o primeiro print.</p>
              )}
            </>
          ) : (
            <Mural />
          )}
        </>
      )}
      {aberta?.caminho && (
        <div className="midia-tela" role="dialog" aria-modal="true" aria-label={aberta.legenda || "Imagem"} onClick={() => setAberta(null)}>
          <Imagem caminho={aberta.caminho} alt={aberta.legenda || "Print do grupo"} cheia />
          <p>
            {aberta.legenda}
            {aberta.legenda && " · "}
            {friendOf(friends.find((f) => f.user_id === aberta.userId)?.id, friends)?.name ?? ""}
          </p>
          <button type="button" className="btn soft sm" onClick={() => setAberta(null)}>
            Fechar
          </button>
        </div>
      )}
    </section>
  );
}
