"use client";
/*
 * Peças do InstaNanico usadas em várias telas (seção 68, igual ao Instagram): texto com @menções que levam ao perfil,
 * campo que sugere nomes ao digitar @, carrossel de fotos com as bolinhas, as figurinhas que se tocam no story
 * (enquete, pergunta, contagem e publicação), o áudio do Direct (tocar e gravar) e a folha de escolher pessoas.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Imagem } from "@/features/midias/Imagem";
import { urlDaImagem } from "@/features/midias/midiasDados";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { falta, mencaoDigitando, pedacos, porcentagens, type Figurinha, type Story } from "./insta";
import { arroba, buscarPost, lerVotos, participantesAdicione, postCarregado, quemEh, responderFigurinha, useRede } from "./rede";

export const useNome = (userId: string | null | undefined) => useApp((s) => s.friends.find((x) => x.user_id === userId) ?? null);

/** A pessoa está no site agora? (o "Ativo agora" do Direct, pela presença do lobby) */
export function useAtivo(userId: string | null | undefined) {
  const fid = useNome(userId)?.id;
  return useApp((s) => !!fid && s.online.some((p) => p.fid === fid));
}

/* ---------- texto com @menções ---------- */
/** O texto com as @menções em azul; tocar numa leva ao perfil (se for alguém do grupo). */
export function TextoRico({ texto, abrirPerfil }: { texto: string; abrirPerfil: (userId: string) => void }) {
  return (
    <>
      {pedacos(texto).map((p, i) => {
        if (p.t === "texto") return <span key={i}>{p.v}</span>;
        const quem = quemEh(p.v.slice(1));
        return quem ? (
          <button key={i} type="button" className="ig-sem-botao ig-mencao" onClick={(e) => (e.stopPropagation(), abrirPerfil(quem))}>
            {p.v}
          </button>
        ) : (
          <span key={i}>{p.v}</span>
        );
      })}
    </>
  );
}

/** Sugestões de @ enquanto digita (fica em cima do campo). Tocar completa o nome. */
export function SugestoesMencao({ texto, mudar }: { texto: string; mudar: (t: string) => void }) {
  const eu = useApp((s) => s.myUid);
  const friends = useApp((s) => s.friends);
  const parte = mencaoDigitando(texto);
  if (parte === null) return null;
  const lista = friends.filter((f) => f.user_id && f.user_id !== eu && arroba(f.name).startsWith(parte)).slice(0, 6);
  if (!lista.length) return null;
  return (
    <ul className="ig-sugestoes" role="listbox" aria-label="Mencionar">
      {lista.map((f) => (
        <li key={f.id}>
          <button type="button" className="ig-sem-botao" role="option" aria-selected={false} onPointerDown={(e) => e.preventDefault()} onClick={() => mudar(texto.replace(/@([a-z0-9_]{0,30})$/i, `@${arroba(f.name)} `))}>
            <Avatar f={f} className="ig-sug-rosto" />
            <span>
              <b>{arroba(f.name)}</b>
              <small className="ig-cinza">{f.name}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- carrossel ---------- */
/** As fotos de uma publicação, passando para o lado (como no Instagram), com as bolinhas e o "1/3". */
export function Carrossel({ fotos, alt }: { fotos: string[]; alt: string }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const ir = (i: number) => {
    const el = trilho.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  return (
    <div className="ig-carrossel">
      <div ref={trilho} className="ig-carrossel-trilho" onScroll={(e) => setAtual(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}>
        {fotos.map((f, i) => (
          <div key={f} className="ig-carrossel-foto">
            <Imagem caminho={f} alt={`${alt} (${i + 1} de ${fotos.length})`} />
          </div>
        ))}
      </div>
      <span className="ig-carrossel-num" aria-hidden="true">
        {atual + 1}/{fotos.length}
      </span>
      {atual > 0 && (
        <button type="button" className="ig-carrossel-seta esq" aria-label="Foto anterior" onClick={(e) => (e.stopPropagation(), ir(atual - 1))}>
          ‹
        </button>
      )}
      {atual < fotos.length - 1 && (
        <button type="button" className="ig-carrossel-seta dir" aria-label="Próxima foto" onClick={(e) => (e.stopPropagation(), ir(atual + 1))}>
          ›
        </button>
      )}
      <div className="ig-bolinhas" aria-hidden="true">
        {fotos.map((f, i) => (
          <i key={f} className={i === atual ? "on" : undefined} />
        ))}
      </div>
    </div>
  );
}

/* ---------- figurinhas que se tocam ---------- */
/** A posição da figurinha por cima do story (em frações da tela do story), igual no editor e na hora de ver. */
export const lugarDaFigurinha = (f: Pick<Figurinha, "x" | "y" | "escala" | "rot">): React.CSSProperties => ({
  left: `${f.x * 100}%`,
  top: `${f.y * 100}%`,
  transform: `translate(-50%, -50%) rotate(${f.rot}rad) scale(${f.escala})`,
});

function Contagem({ alvo }: { alvo: number }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const f = falta(alvo, agora);
  if (!f) return <b className="ig-fig-acabou">Chegou a hora! 🎉</b>;
  const dois = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="ig-fig-digitos">
      {f.d > 0 && (
        <span>
          <b>{dois(f.d)}</b>
          <small>dias</small>
        </span>
      )}
      <span>
        <b>{dois(f.h)}</b>
        <small>horas</small>
      </span>
      <span>
        <b>{dois(f.m)}</b>
        <small>min</small>
      </span>
      {f.d === 0 && (
        <span>
          <b>{dois(f.s)}</b>
          <small>seg</small>
        </span>
      )}
    </span>
  );
}

/**
 * Uma figurinha. No editor só mostra (`story` null); vendo um story, dá para votar, responder, lembrar ou abrir a
 * publicação. `pausar` para o story enquanto a pessoa responde.
 */
export function FigurinhaVisual({
  f,
  story,
  meu,
  pausar,
  abrirPost,
  abrirStory,
  entrar,
}: {
  f: Figurinha;
  story: Story | null;
  meu?: boolean;
  pausar?: (sim: boolean) => void;
  abrirPost?: (id: number) => void;
  /** a figurinha do story repostado leva ao story original */
  abrirStory?: (id: number) => void;
  /** "Adicione o seu": abre o editor com a mesma pergunta, na mesma corrente */
  entrar?: (pergunta: string, origem: number) => void;
}) {
  const votos = useRede((s) => (story ? s.votos[story.id] : undefined));
  const minha = useRede((s) => (story ? s.minhaResposta[story.id] : undefined));
  const [texto, setTexto] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  const postId = f.tipo === "post" ? f.postId : 0;
  const post = useRede((s) => (postId ? (s.avulsos[postId] ?? s.posts.find((p) => p.id === postId)) : undefined));
  const repostado = useRede((s) => (f.tipo === "story" ? (s.stories.find((x) => x.id === f.storyId) ?? s.storiesDestaque[f.storyId]) : undefined));
  const autor = useNome(f.tipo === "story" ? (repostado?.userId ?? f.autor) : post?.userId);
  const [barra, setBarra] = useState<number | null>(null);
  const [participantes, setParticipantes] = useState<Story[] | null>(null);
  const origem = f.tipo === "adicione" ? (f.origem ?? story?.id ?? 0) : 0;
  useEffect(() => {
    if (story && f.tipo !== "post" && f.tipo !== "story" && f.tipo !== "adicione") void lerVotos(story);
  }, [story, f.tipo]);
  useEffect(() => {
    if (postId && !postCarregado(postId)) void buscarPost(postId);
  }, [postId]);
  useEffect(() => {
    if (story && origem) void participantesAdicione(origem).then(setParticipantes);
  }, [story, origem]);
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();
  const ativo = !!story && !meu;

  let corpo: ReactNode;
  if (f.tipo === "enquete") {
    const votou = minha?.opcao != null || (meu && votos != null);
    const [pa, pb] = porcentagens(votos);
    corpo = (
      <>
        {f.pergunta && <p className="ig-fig-pergunta">{f.pergunta}</p>}
        <div className="ig-fig-opcoes">
          {f.opcoes.map((op, i) => (
            <button
              key={i}
              type="button"
              className={"ig-fig-opcao" + (votou ? " votou" : "") + (minha?.opcao === i ? " minha" : "")}
              disabled={!ativo || votou}
              style={votou ? ({ "--pct": `${i ? pb : pa}%` } as React.CSSProperties) : undefined}
              onClick={() => story && void responderFigurinha(story, { opcao: i })}
            >
              <span>{op}</span>
              {votou && <b>{i ? pb : pa}%</b>}
            </button>
          ))}
        </div>
      </>
    );
  } else if (f.tipo === "pergunta") {
    corpo = (
      <>
        <p className="ig-fig-pergunta">{f.pergunta}</p>
        {ativo && !minha ? (
          <form
            className="ig-fig-responder"
            onSubmit={(e) => {
              e.preventDefault();
              if (!texto.trim() || !story) return;
              void responderFigurinha(story, { texto }).then((ok) => {
                if (ok) toast("Resposta enviada");
                pausar?.(false);
              });
            }}
          >
            <input
              aria-label="Sua resposta"
              maxLength={200}
              placeholder="Escreva algo…"
              value={texto}
              onFocus={() => pausar?.(true)}
              onBlur={() => !texto.trim() && pausar?.(false)}
              onChange={(e) => setTexto(e.target.value)}
            />
            {texto.trim() && <button type="submit">Enviar</button>}
          </form>
        ) : (
          <span className="ig-fig-campo">{minha ? "Você respondeu ✓" : meu ? "As respostas aparecem em Visto por" : "Toque para responder"}</span>
        )}
      </>
    );
  } else if (f.tipo === "contagem") {
    corpo = (
      <>
        <p className="ig-fig-titulo">{f.titulo}</p>
        <Contagem alvo={f.alvo} />
        {ativo && (
          <button type="button" className="ig-fig-lembrar" disabled={!!minha} onClick={() => story && void responderFigurinha(story, {}).then((ok) => ok && toast("Vamos te lembrar"))}>
            {minha ? "✓ Lembrete ativado" : "🔔 Lembrar"}
          </button>
        )}
      </>
    );
  } else if (f.tipo === "quiz") {
    const respondi = minha?.opcao != null || (meu && votos != null);
    const total = Object.entries(votos ?? {}).filter(([k]) => /^\d$/.test(k)).reduce((n, [, v]) => n + Number(v), 0);
    corpo = (
      <>
        <p className="ig-fig-pergunta">{f.pergunta || "Quiz"}</p>
        <div className="ig-fig-quiz">
          {f.opcoes.map((op, i) => {
            const certa = respondi && i === f.certa, errei = respondi && minha?.opcao === i && i !== f.certa;
            const pct = total ? Math.round((Number(votos?.[String(i)] ?? 0) / total) * 100) : 0;
            return (
              <button
                key={i}
                type="button"
                className={"ig-fig-quiz-op" + (certa ? " certa" : "") + (errei ? " errada" : "")}
                disabled={!ativo || respondi}
                style={respondi ? ({ "--pct": `${pct}%` } as React.CSSProperties) : undefined}
                onClick={() => story && void responderFigurinha(story, { opcao: i }).then((ok) => ok && toast(i === f.certa ? "Acertou! 🎉" : "Errou 😅"))}
              >
                <i>{certa ? "✓" : errei ? "✕" : "ABCD"[i]}</i>
                <span>{op}</span>
                {respondi && <b>{pct}%</b>}
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (f.tipo === "barra") {
    const respondi = minha?.valor != null || (meu && votos != null);
    const media = typeof votos?.media === "number" ? votos.media : null;
    const valor = barra ?? minha?.valor ?? (respondi ? (media ?? 50) : 0);
    corpo = (
      <>
        {f.pergunta && <p className="ig-fig-pergunta">{f.pergunta}</p>}
        <div className="ig-fig-barra" style={{ "--v": `${valor}%` } as React.CSSProperties}>
          <span className="ig-fig-barra-trilho" aria-hidden="true">
            <i />
          </span>
          {respondi && media != null && <span className="ig-fig-barra-media" style={{ left: `${media}%` }} title={`Média: ${media}`} aria-hidden="true" />}
          <span className="ig-fig-barra-emoji" aria-hidden="true">
            {f.emoji}
          </span>
          {ativo && !respondi && (
            <input
              type="range"
              min={0}
              max={100}
              value={valor}
              aria-label={f.pergunta || "Quanto você gostou"}
              onPointerDown={() => pausar?.(true)}
              onChange={(e) => setBarra(Number(e.target.value))}
              onPointerUp={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                pausar?.(false);
                if (story) void responderFigurinha(story, { valor: v });
              }}
              onKeyUp={(e) => e.key.startsWith("Arrow") && story && void responderFigurinha(story, { valor: Number((e.target as HTMLInputElement).value) })}
            />
          )}
        </div>
        {respondi && media != null && <small className="ig-fig-barra-txt">Média de {votos?.n ?? 0}: {media}%</small>}
      </>
    );
  } else if (f.tipo === "adicione") {
    const n = participantes?.length ?? 0;
    corpo = (
      <>
        <p className="ig-fig-titulo">Adicione o seu</p>
        <p className="ig-fig-pergunta">{f.pergunta}</p>
        {n > 0 && <small className="ig-fig-participantes">{n === 1 ? "1 participante" : `${n} participantes`}</small>}
        {story && entrar && !meu && (
          <button type="button" className="ig-fig-lembrar" onClick={() => entrar(f.pergunta, origem)}>
            ⊕ Adicione o seu
          </button>
        )}
      </>
    );
  } else if (f.tipo === "story") {
    corpo = (
      <button type="button" className="ig-fig-post-botao" disabled={!abrirStory || !repostado} onClick={() => abrirStory?.(f.storyId)}>
        <span className="ig-fig-post-topo">
          <Avatar f={autor ?? { name: "?" }} className="ig-fig-post-rosto" />
          <b>@{arroba(autor?.name)}</b>
        </span>
        {repostado?.midia ? <span className="ig-fig-story-img"><Imagem caminho={repostado.midia} alt="" /></span> : <span className="ig-fig-post-texto">{repostado ? repostado.texto : "Story indisponível"}</span>}
      </button>
    );
  } else {
    corpo = (
      <button
        type="button"
        className="ig-fig-post-botao"
        disabled={!abrirPost || abrindo}
        onClick={() => {
          if (!abrirPost) return;
          setAbrindo(true);
          abrirPost(f.postId);
        }}
      >
        <span className="ig-fig-post-topo">
          {post && <Avatar f={autor ?? { name: "?" }} className="ig-fig-post-rosto" />}
          <b>@{arroba(autor?.name)}</b>
        </span>
        {post?.midia ? <Imagem caminho={post.midia} alt="" /> : <span className="ig-fig-post-texto">{post?.texto ?? "Publicação"}</span>}
        {abrirPost && <small>Ver publicação</small>}
      </button>
    );
  }
  return (
    <div className={"ig-fig " + f.tipo} onPointerDown={ativo ? parar : undefined} onClick={ativo ? parar : undefined}>
      {corpo}
    </div>
  );
}

/* ---------- áudio do Direct ---------- */
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** Toca um áudio do Direct: play/pausa, a barrinha andando e o tempo. */
export function AudioMsg({ caminho, meu }: { caminho: string; meu: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  useEffect(() => {
    let vivo = true;
    void urlDaImagem(caminho).then((u) => vivo && setUrl(u));
    return () => void (vivo = false);
  }, [caminho]);
  const alternar = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => toast("Não deu para tocar o áudio."));
    else a.pause();
  };
  return (
    <span className={"ig-audio" + (meu ? " meu" : "")}>
      <button type="button" className="ig-sem-botao ig-audio-play" aria-label={tocando ? "Pausar o áudio" : "Tocar o áudio"} disabled={!url} onClick={alternar}>
        {tocando ? "❚❚" : "▶"}
      </button>
      <span className="ig-audio-onda" aria-hidden="true">
        <i style={{ width: `${dur ? (pos / dur) * 100 : 0}%` }} />
      </span>
      <small>{mmss(tocando || pos ? pos : dur)}</small>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)}
          onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
          onEnded={() => {
            setTocando(false);
            setPos(0);
          }}
        />
      )}
    </span>
  );
}

/** O melhor formato que este navegador grava (o Safari grava mp4; o Chrome, webm). */
function tipoGravacao() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return "";
}
export const podeGravar = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && tipoGravacao() !== null;

/** Gravar um áudio (até 1 minuto): começa, mostra o tempo e entrega o arquivo ao enviar (ou nada, se cancelar). */
export function useGravador(aoTerminar: (b: Blob) => void) {
  const [gravando, setGravando] = useState(false);
  const [seg, setSeg] = useState(0);
  const rec = useRef<{ mr: MediaRecorder; partes: Blob[]; enviar: boolean; t: ReturnType<typeof setInterval>; fim: ReturnType<typeof setTimeout> } | null>(null);
  const parar = (enviar: boolean) => {
    const r = rec.current;
    if (!r) return;
    r.enviar = enviar;
    clearInterval(r.t);
    clearTimeout(r.fim);
    if (r.mr.state !== "inactive") r.mr.stop();
  };
  const comecar = async () => {
    if (rec.current) return;
    const tipo = tipoGravacao();
    if (tipo === null) return toast("Este navegador não grava áudio.");
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(st, tipo ? { mimeType: tipo, audioBitsPerSecond: 48000 } : undefined);
      const partes: Blob[] = [];
      const inicio = Date.now();
      const r = { mr, partes, enviar: false, t: setInterval(() => setSeg(Math.floor((Date.now() - inicio) / 1000)), 250), fim: setTimeout(() => parar(true), 60_000) };
      rec.current = r;
      mr.ondataavailable = (e) => e.data.size && partes.push(e.data);
      mr.onstop = () => {
        st.getTracks().forEach((t) => t.stop());
        rec.current = null;
        setGravando(false);
        setSeg(0);
        if (r.enviar && partes.length && Date.now() - inicio > 700) aoTerminar(new Blob(partes, { type: mr.mimeType || tipo || "audio/webm" }));
      };
      mr.start(250);
      setGravando(true);
    } catch {
      toast("O microfone foi bloqueado. Libere no cadeado ao lado do endereço do site.");
    }
  };
  useEffect(() => () => parar(false), []);
  return { gravando, seg, comecar, enviar: () => parar(true), cancelar: () => parar(false), tempo: mmss(seg) };
}

/* ---------- escolher pessoas (marcar na foto, melhores amigos) ---------- */
export function FolhaGente({
  titulo,
  marcados,
  mudar,
  fechar,
  dica,
}: {
  titulo: string;
  marcados: string[];
  mudar: (userId: string) => void;
  fechar: () => void;
  dica?: string;
}) {
  const eu = useApp((s) => s.myUid);
  const friends = useApp((s) => s.friends);
  const [busca, setBusca] = useState("");
  const gente = friends.filter((f) => f.user_id && f.user_id !== eu && (!busca.trim() || arroba(f.name).includes(arroba(busca))));
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label={titulo}>
        <span className="ig-alca" aria-hidden="true" />
        <h3>{titulo}</h3>
        {dica && <p className="ig-folha-dica ig-cinza">{dica}</p>}
        <div className="ig-busca">
          <input aria-label="Pesquisar" placeholder="Pesquisar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <ul className="ig-lista-gente ig-escolher">
          {gente.map((f) => {
            const on = marcados.includes(f.user_id!);
            return (
              <li key={f.id}>
                <button type="button" className="ig-sem-botao" aria-pressed={on} onClick={() => mudar(f.user_id!)}>
                  <Avatar f={f} className="ig-sug-rosto" />
                  <span>
                    <b>{arroba(f.name)}</b>
                    <small className="ig-cinza">{f.name}</small>
                  </span>
                  <i className={"ig-check" + (on ? " on" : "")} aria-hidden="true">
                    {on ? "✓" : ""}
                  </i>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="ig-comp-pe">
          <button type="button" className="ig-botao-azul" onClick={fechar}>
            Concluir
          </button>
        </div>
      </section>
    </div>
  );
}
