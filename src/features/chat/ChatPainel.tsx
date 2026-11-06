"use client";
/*
 * Chat como o do Discord (seção 70): sem `canal`, o da minha sala no painel do Ao vivo; com `canal` ("geral" ou o id
 * de uma sala), o canal de texto aberto na aba Chat. Mensagens agrupadas por pessoa, separadas por dia, com a linha
 * de "Novas mensagens"; responder, reagir, editar, apagar, fixar e copiar (passando o mouse, clique direito ou
 * segurando o dedo); foto ou GIF; vídeo do YouTube, Twitch e Medal tocando ali; **formatação**, @menções (as que me
 * citam ficam em destaque); "digitando…"; mensagens antigas rolando para cima; as fixadas e a busca no topo.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { abrirCartao } from "@/components/shell/CartaoPerfil";
import { Imagem } from "@/features/midias/Imagem";
import { corDoNome, useStatus } from "@/features/status/status";
import { getApp, useApp } from "@/lib/store";
import { errMsg } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { hhmm } from "@/lib/util";
import {
  apagarChat, arrobaDe, avisarDigitandoChat, buscarNoChat, carregarAntigas, chatNovo, editarChat, enviarChat, fixadasDe, fixarChat, lidoAte, reagirChat,
  useChat, type MsgChat,
} from "./chat";
import { dia, embedDe, formatar, linksDe, meMenciona, type Trecho } from "./formato";
import { useNotas } from "@/features/status/notas";
import { ajuste, useAjustes } from "@/features/config/ajustes";

const SEM_MSGS: MsgChat[] = [];
const RAPIDAS = ["👍", "😂", "❤️", "🔥", "😮", "😢"];
export const EMOJIS: { nome: string; l: string[] }[] = [
  { nome: "Carinhas", l: ["😀", "😂", "🤣", "😅", "😊", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😏", "😴", "🤔", "🙄", "😬", "😭", "😡", "🤯", "🥶", "🤡", "💀", "👻", "🤮", "🥹", "😇", "🤠", "🫡"] },
  { nome: "Gestos", l: ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👊", "✌️", "🤞", "👌", "🫶", "👀", "🤙", "🖕"] },
  { nome: "Coisas", l: ["❤️", "💜", "💙", "💚", "🔥", "✨", "💯", "🎉", "🏆", "🎮", "⚽", "🎰", "💸", "🍻", "🍺", "🥩", "🍕", "🧉", "🚬", "🎧", "📸", "🚀", "⏰", "📌"] },
];

/* ---------- o texto formatado ---------- */
function Trechos({ l, meuAt }: { l: Trecho[]; meuAt: string }): ReactNode {
  return l.map((x, i) => {
    if (x.t === "texto") return <span key={i}>{x.v}</span>;
    if (x.t === "codigo") return <code key={i}>{x.v}</code>;
    if (x.t === "link")
      return (
        <a key={i} href={x.url} target="_blank" rel="noopener noreferrer nofollow">
          {x.v}
        </a>
      );
    if (x.t === "mencao") return <span key={i} className={"chat-mencao" + (x.v.slice(1) === meuAt || x.v === "@todos" ? " eu" : "")}>{x.v}</span>;
    const filhos = <Trechos l={x.filhos} meuAt={meuAt} />;
    if (x.t === "negrito") return <b key={i}>{filhos}</b>;
    if (x.t === "italico") return <i key={i}>{filhos}</i>;
    if (x.t === "sublinhado") return <u key={i}>{filhos}</u>;
    if (x.t === "riscado") return <s key={i}>{filhos}</s>;
    return <Spoiler key={i}>{filhos}</Spoiler>;
  });
}
function Spoiler({ children }: { children: ReactNode }) {
  const [ver, setVer] = useState(() => ajuste("spoilersAbertos"));
  return (
    <span className={"chat-spoiler" + (ver ? " ver" : "")} role="button" tabIndex={0} aria-label={ver ? undefined : "Spoiler: toque para ver"} onClick={() => setVer(true)} onKeyDown={(e) => e.key === "Enter" && setVer(true)}>
      {children}
    </span>
  );
}
export function TextoChat({ texto, meuAt }: { texto: string; meuAt: string }) {
  const linhas = useMemo(() => formatar(texto), [texto]);
  return (
    <>
      {linhas.map((l, i) =>
        l.citacao ? (
          <blockquote key={i} className="chat-citacao">
            <Trechos l={l.trechos} meuAt={meuAt} />
          </blockquote>
        ) : (
          <span key={i} className="chat-linha">
            <Trechos l={l.trechos} meuAt={meuAt} />
            {i < linhas.length - 1 && <br />}
          </span>
        ),
      )}
    </>
  );
}

/** Os vídeos dos links (YouTube, Twitch, Medal): o player aparece só depois de tocar (não carrega à toa). */
function Embeds({ texto }: { texto: string }) {
  const vids = useMemo(() => linksDe(texto).map(embedDe).filter((e) => !!e).slice(0, 2), [texto]);
  const [abertos, setAbertos] = useState<string[]>([]);
  const mostrar = useAjustes((s) => s.videosLinks);
  if (!vids.length || !mostrar) return null;
  return (
    <>
      {vids.map((e) => {
        const k = e.tipo + e.id;
        const nome = e.tipo === "youtube" ? "YouTube" : e.tipo === "twitch" ? "Clipe da Twitch" : "Clipe do Medal";
        return abertos.includes(k) ? (
          <iframe
            key={k}
            className={"chat-embed " + e.tipo}
            src={urlEmbed(e)}
            title={nome}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button key={k} type="button" className={"chat-embed-capa " + e.tipo} onClick={() => setAbertos((l) => [...l, k])}>
            <span className="chat-embed-play" aria-hidden="true">
              ▶
            </span>
            <span>
              <b>{nome}</b>
              <small>Tocar aqui no chat</small>
            </span>
          </button>
        );
      })}
    </>
  );
}
function urlEmbed(e: NonNullable<ReturnType<typeof embedDe>>) {
  return e.tipo === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${e.id}?autoplay=1`
    : e.tipo === "twitch"
      ? `https://clips.twitch.tv/embed?clip=${e.id}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`
      : `https://medal.tv/clip/${e.id}?autoplay=1&mobilebypass=true`;
}

/* ---------- uma mensagem ---------- */
type Acoes = {
  responder: (m: MsgChat) => void;
  editar: (m: MsgChat) => void;
  irPara: (id: number) => void;
};
function Mensagem({ m, primeira, eu, mod, meuAt, acoes, editando, fimEdicao, citada }: {
  m: MsgChat;
  primeira: boolean;
  eu: boolean;
  mod: boolean;
  meuAt: string;
  acoes: Acoes;
  editando: boolean;
  fimEdicao: () => void;
  citada: MsgChat | null | undefined;
}) {
  const friends = useApp((s) => s.friends);
  const mods = useStatus((s) => s.mods);
  const reacoes = useChat((s) => s.reacoes[String(m.id)]);
  const myUid = useApp((s) => s.myUid);
  const [menu, setMenu] = useState(false);
  const [escolher, setEscolher] = useState(false);
  const [texto, setTexto] = useState(m.text);
  const segura = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const f = friends.find((x) => x.user_id === m.user_id);
  const bloqueado = useNotas((st) => !!f && st.bloqueados.includes(f.id));
  const escondida = useNotas((st) => !!f && (st.ignorados.includes(f.id) || st.bloqueados.includes(f.id)));
  const [mostrar, setMostrar] = useState(false);
  const imagensChat = useAjustes((st) => st.imagensChat);
  const [verFoto, setVerFoto] = useState(false);
  const autorCitada = citada ? friends.find((x) => x.user_id === citada.user_id) : undefined;
  const novo = chatNovo();
  const mencionaMe = !eu && meMenciona(m.text, meuAt);
  const nome = <b className={corDoNome(f, mods)} role="button" tabIndex={0} onClick={(e) => abrirCartao(f?.id, e)}>{f ? f.name : "Alguém"}</b>;
  const salvar = () => {
    const t = texto.trim();
    if (!t && !m.midia) return;
    if (t !== m.text) void editarChat(m, t).catch((e) => toast(errMsg(e, "Não deu para editar.")));
    fimEdicao();
  };
  const lista = Object.entries(reacoes ?? {}).filter(([, q]) => q.length);
  if (escondida && !mostrar)
    return (
      <div data-msg={m.id} className={"msg msg-escondida" + (primeira ? " first" : "")}>
        <span className="msg-hora" aria-hidden="true" />
        <div className="tx">
          {bloqueado ? "Mensagem de alguém que você bloqueou" : "Mensagem de alguém que você ignorou"} ·{" "}
          <button type="button" className="link" onClick={() => setMostrar(true)}>
            Mostrar
          </button>
        </div>
      </div>
    );
  return (
    <div
      data-msg={m.id}
      className={"msg" + (primeira || m.respostaA ? " first" : "") + (eu ? " mine" : "") + (mencionaMe ? " mencao" : "") + (menu ? " menu" : "")}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest("a,iframe")) return;
        e.preventDefault();
        setMenu(true);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        segura.current = setTimeout(() => {
          navigator.vibrate?.(12);
          setMenu(true);
        }, 480);
      }}
      onPointerUp={() => clearTimeout(segura.current)}
      onPointerMove={() => clearTimeout(segura.current)}
      onPointerLeave={() => setMenu(false)}
    >
      {citada !== undefined && m.respostaA && (
        <button type="button" className="msg-citada" onClick={() => citada && acoes.irPara(Number(citada.id))}>
          <span className="msg-citada-linha" aria-hidden="true" />
          {citada ? (
            <>
              {autorCitada && <Avatar f={autorCitada} size="xs" />}
              <b>{autorCitada?.name ?? "Alguém"}</b>
              <span>{citada.text || (citada.midia ? "🖼 Imagem" : "")}</span>
            </>
          ) : (
            <i>A mensagem original foi apagada</i>
          )}
        </button>
      )}
      {primeira || m.respostaA ? (
        <>
          <span className="msg-rosto" role="button" tabIndex={-1} onClick={(e) => abrirCartao(f?.id, e)}>
            {f ? <Avatar f={f} /> : <span className="av">?</span>}
          </span>
          <div className="hd">
            {nome}
            <time dateTime={m.created_at}>{hhmm(m.created_at)}</time>
          </div>
        </>
      ) : (
        <time className="msg-hora" dateTime={m.created_at} aria-hidden="true">
          {hhmm(m.created_at)}
        </time>
      )}
      <div className="tx">
        {editando ? (
          <div className="msg-editar">
            <textarea
              aria-label="Editar a mensagem"
              maxLength={300}
              value={texto}
              autoFocus
              rows={Math.min(6, texto.split("\n").length)}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  salvar();
                } else if (e.key === "Escape") fimEdicao();
              }}
            />
            <small>
              Esc para <button type="button" className="link" onClick={fimEdicao}>cancelar</button> · Enter para <button type="button" className="link" onClick={salvar}>salvar</button>
            </small>
          </div>
        ) : (
          <>
            {m.text && <TextoChat texto={m.text} meuAt={meuAt} />}
            {m.editadoEm && <small className="msg-editado" title={`Editado às ${hhmm(m.editadoEm)}`}> (editado)</small>}
            {m.fixadaEm && <small className="msg-fixada" title="Fixada no canal"> 📌</small>}
          </>
        )}
        {m.midia && (imagensChat || verFoto) && (
          <span className="msg-foto">
            <Imagem caminho={m.midia} alt="Imagem no chat" />
          </span>
        )}
        {m.midia && !imagensChat && !verFoto && (
          <button type="button" className="link msg-foto-mostrar" onClick={() => setVerFoto(true)}>
            🖼 Imagem · Mostrar
          </button>
        )}
        {m.text && <Embeds texto={m.text} />}
        {lista.length > 0 && (
          <span className="msg-reacoes">
            {lista.map(([em, q]) => (
              <button key={em} type="button" className={"msg-reacao" + (myUid && q.includes(myUid) ? " minha" : "")} title={q.map((u) => friends.find((x) => x.user_id === u)?.name ?? "Alguém").join(", ")} onClick={() => void reagirChat(m, em)}>
                {em} <b>{q.length}</b>
              </button>
            ))}
            {novo && (
              <button type="button" className="msg-reacao mais" aria-label="Adicionar reação" onClick={() => setEscolher(true)}>
                +
              </button>
            )}
          </span>
        )}
      </div>
      {/* as ações, como no Discord: aparecem passando o mouse (ou com o clique direito / segurando o dedo) */}
      {!editando && (
        <div className="msg-acoes" role="toolbar" aria-label="Ações da mensagem">
          {novo && RAPIDAS.slice(0, 3).map((em) => (
            <button key={em} type="button" aria-label={`Reagir com ${em}`} onClick={() => void reagirChat(m, em)}>
              {em}
            </button>
          ))}
          {novo && (
            <button type="button" aria-label="Adicionar reação" title="Adicionar reação" onClick={() => setEscolher((v) => !v)}>
              ☺+
            </button>
          )}
          {novo && (
            <button type="button" aria-label="Responder" title="Responder" onClick={() => acoes.responder(m)}>
              ↩
            </button>
          )}
          {eu && novo && (
            <button type="button" aria-label="Editar" title="Editar" onClick={() => acoes.editar(m)}>
              ✎
            </button>
          )}
          {novo && (
            <button type="button" aria-label={m.fixadaEm ? "Desafixar" : "Fixar"} title={m.fixadaEm ? "Desafixar" : "Fixar no canal"} onClick={() => void fixarChat(m, !m.fixadaEm).then(() => toast(m.fixadaEm ? "Desafixada" : "Fixada no canal")).catch((e) => toast(errMsg(e, "Não deu para fixar.")))}>
              📌
            </button>
          )}
          {m.text && (
            <button type="button" aria-label="Copiar o texto" title="Copiar o texto" onClick={() => void navigator.clipboard?.writeText(m.text).then(() => toast("Copiado"))}>
              ⧉
            </button>
          )}
          {(eu || mod) && novo && <BotaoApagar m={m} />}
        </div>
      )}
      {escolher && (
        <EscolherEmoji
          fechar={() => setEscolher(false)}
          escolher={(em) => {
            setEscolher(false);
            void reagirChat(m, em);
          }}
        />
      )}
    </div>
  );
}
function BotaoApagar({ m }: { m: MsgChat }) {
  const [certeza, setCerteza] = useState(false);
  return (
    <button
      type="button"
      className={"perigo" + (certeza ? " sure" : "")}
      aria-label={certeza ? "Toque de novo para apagar" : "Apagar"}
      title={certeza ? "Toque de novo para apagar" : "Apagar"}
      onClick={() => {
        if (!certeza) {
          setCerteza(true);
          setTimeout(() => setCerteza(false), 3000);
          return;
        }
        void apagarChat(m).catch((e) => toast(errMsg(e, "Não deu para apagar.")));
      }}
    >
      {certeza ? "Apagar?" : "🗑"}
    </button>
  );
}

/** A caixinha de escolher emoji (do botão de reagir e do botão ao lado da caixa de texto). */
export function EscolherEmoji({ escolher, fechar }: { escolher: (e: string) => void; fechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: PointerEvent) => caixa.current && !caixa.current.contains(e.target as Node) && fechar();
    const t = setTimeout(() => document.addEventListener("pointerdown", fora), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fora);
    };
  }, [fechar]);
  return (
    <div ref={caixa} className="chat-emojis" role="dialog" aria-label="Escolher emoji">
      {EMOJIS.map((g) => (
        <div key={g.nome}>
          <small>{g.nome}</small>
          <span>
            {g.l.map((em) => (
              <button key={em} type="button" aria-label={em} onClick={() => escolher(em)}>
                {em}
              </button>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Quem está digitando no canal agora (o aviso vale por 6 s). */
function Digitando({ canal }: { canal: string }) {
  const quem = useChat((s) => s.digitando[canal]);
  const friends = useApp((s) => s.friends);
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    if (!quem) return;
    const t = setTimeout(() => setAgora(Date.now()), 0);
    const i = setInterval(() => setAgora(Date.now()), 1500);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [quem]);
  const nomes = Object.entries(quem ?? {})
    .filter(([, t]) => agora - t < 6000)
    .map(([u]) => friends.find((f) => f.user_id === u)?.name ?? "Alguém");
  return (
    <div className="chat-digitando" aria-live="polite">
      {nomes.length > 0 && (
        <>
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <b>{nomes.length > 3 ? "Várias pessoas" : nomes.join(", ")}</b> {nomes.length === 1 ? "está digitando…" : "estão digitando…"}
        </>
      )}
    </div>
  );
}

/** Sugestões de @ enquanto digita (com @todos). */
function SugestoesArroba({ texto, mudar }: { texto: string; mudar: (t: string) => void }) {
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const m = texto.match(/(?:^|\s)@([a-z0-9_]{0,30})$/i);
  if (!m) return null;
  const parte = m[1].toLowerCase();
  const lista = [
    ...friends.filter((f) => f.user_id && f.user_id !== myUid && arrobaDe(f.name).startsWith(parte)).slice(0, 6).map((f) => ({ at: arrobaDe(f.name), nome: f.name, f })),
    ...("todos".startsWith(parte) ? [{ at: "todos", nome: "Avisa todo mundo do canal", f: null }] : []),
  ];
  if (!lista.length) return null;
  return (
    <ul className="chat-sugestoes" role="listbox" aria-label="Mencionar">
      {lista.map((x) => (
        <li key={x.at}>
          <button type="button" role="option" aria-selected={false} onPointerDown={(e) => e.preventDefault()} onClick={() => mudar(texto.replace(/@([a-z0-9_]{0,30})$/i, `@${x.at} `))}>
            {x.f ? <Avatar f={x.f} size="xs" /> : <span className="av xs">@</span>}
            <b>@{x.at}</b>
            <small>{x.nome}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Chat: sem `canal`, o da minha sala no painel do Ao vivo; com `canal` ("geral" ou o id de uma sala),
 * o canal de texto aberto na aba Chat.
 */
export function ChatPainel({ canal, placeholder = "Mensagem para a sala" }: { canal?: string; placeholder?: string }) {
  const minhaSala = useApp((s) => s.minhaSala);
  const chave = canal ?? minhaSala ?? "geral";
  const msgs = useChat((s) => (canal ? (s.porCanal[canal] ?? SEM_MSGS) : s.msgs));
  const ok = useChat((s) => s.ok);
  const temAntigas = useChat((s) => !!s.temAntigas[chave]);
  const carregando = useChat((s) => !(chave in s.porCanal));
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const myFid = useApp((s) => s.myFid);
  const mods = useStatus((s) => s.mods);
  const visivel = useApp((s) => (canal ? s.aba === "chat" && s.canalTexto === canal : s.aba === "live" && s.railTab === "chat" && !s.railFechado));
  const enterEnvia = useAjustes((s) => s.enterEnvia);
  const [texto, setTexto] = useState("");
  const [resposta, setResposta] = useState<MsgChat | null>(null);
  const [editando, setEditando] = useState<string | number | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [emojis, setEmojis] = useState(false);
  const [painel, setPainel] = useState<null | "fixadas" | "busca">(null);
  const [lista2, setLista2] = useState<MsgChat[] | null>(null);
  const [busca, setBusca] = useState("");
  const [longe, setLonge] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  /* a linha de "Novas mensagens": o último lido quando o chat abriu */
  const [lidoAoAbrir] = useState(() => lidoAte(chave));
  /* "Hoje"/"Ontem": a hora de quando o chat abriu basta */
  const [agora] = useState(() => Date.now());
  /* só desce sozinho se a pessoa já estava no fim da conversa */
  const noFim = useRef(true);
  const meuAt = arrobaDe(friends.find((f) => f.user_id === myUid)?.name ?? getApp().myName);
  const mod = !!myFid && mods.includes(myFid);
  const fotoUrl = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => void (fotoUrl && URL.revokeObjectURL(fotoUrl)), [fotoUrl]);

  const descer = () => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
    noFim.current = true;
    setLonge(false);
  };

  useLayoutEffect(() => {
    const el = lista.current;
    if (el && noFim.current) el.scrollTop = el.scrollHeight;
  }, [msgs, ok]);

  useEffect(() => {
    const el = lista.current;
    if (!visivel || !el) return;
    el.scrollTop = el.scrollHeight;
    noFim.current = true;
  }, [visivel]);

  /* "Mencionar" do menu de uma pessoa: só o chat que está na tela recebe o @ */
  const naTela = useRef(visivel);
  useEffect(() => {
    naTela.current = visivel;
  }, [visivel]);
  useEffect(
    () =>
      useChat.subscribe((s, p) => {
        if (!s.inserir || s.inserir === p.inserir || !naTela.current) return;
        const t = s.inserir.texto;
        setTexto((x) => (x && !x.endsWith(" ") ? x + " " : x) + t);
        setTimeout(() => campo.current?.focus(), 50);
      }),
    [],
  );

  /* a caixa de texto cresce com o texto (até 6 linhas) */
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [texto]);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if ((!t && !foto) || !getApp().db) return;
    if (!ok) return toast("O chat ainda não está ligado no Supabase.");
    const r = resposta, fo = foto;
    setTexto("");
    setResposta(null);
    setFoto(null);
    try {
      await enviarChat(t, canal, false, { respostaA: r ? Number(r.id) : null, arquivo: fo });
      requestAnimationFrame(descer);
    } catch (err) {
      console.error(err);
      setTexto(t);
      setResposta(r);
      setFoto(fo);
      toast(err instanceof Error && !("code" in err) ? err.message : errMsg(err, "Não deu para enviar. Confira a internet."));
    }
  }

  const porId = useMemo(() => new Map(msgs.map((m) => [String(m.id), m])), [msgs]);
  const irPara = (id: number) => {
    const el = lista.current?.querySelector(`[data-msg="${id}"]`);
    if (!el) return toast("Essa mensagem é antiga demais para aparecer aqui.");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("piscar");
    setTimeout(() => el.classList.remove("piscar"), 1600);
  };
  const acoes: Acoes = {
    responder: (m) => {
      setResposta(m);
      setEditando(null);
      campo.current?.focus();
    },
    editar: (m) => setEditando(m.id),
    irPara,
  };
  const abrirPainel = async (p: "fixadas" | "busca") => {
    if (painel === p) return setPainel(null);
    setPainel(p);
    setLista2(null);
    if (p === "fixadas") setLista2(await fixadasDe(chave));
  };
  const novaPrimeira = msgs.find((m) => lidoAoAbrir && Number(m.id) > lidoAoAbrir && m.user_id !== myUid);
  return (
    <div className="block chat">
      <div className="chat-barra">
        {chatNovo() && (
          <button type="button" className={"chat-barra-bt" + (painel === "fixadas" ? " on" : "")} aria-pressed={painel === "fixadas"} onClick={() => void abrirPainel("fixadas")}>
            📌 Fixadas
          </button>
        )}
        <button type="button" className={"chat-barra-bt" + (painel === "busca" ? " on" : "")} aria-pressed={painel === "busca"} onClick={() => void abrirPainel("busca")}>
          🔍 Buscar
        </button>
      </div>
      {painel && (
        <div className="chat-painel2">
          {painel === "busca" && (
            <form
              className="chat-busca"
              onSubmit={(e) => {
                e.preventDefault();
                void buscarNoChat(chave, busca).then(setLista2);
              }}
            >
              <input aria-label="Buscar no canal" placeholder="Buscar mensagens…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
              <button type="submit" className="btn sm">
                Buscar
              </button>
            </form>
          )}
          <div className="chat-painel2-lista">
            {lista2 === null ? (
              painel === "fixadas" ? <p className="chat-empty">Carregando…</p> : null
            ) : lista2.length ? (
              lista2.map((m) => {
                const f = friends.find((x) => x.user_id === m.user_id);
                return (
                  <button key={m.id} type="button" className="chat-achado" onClick={() => (porId.has(String(m.id)) ? irPara(Number(m.id)) : toast("Essa mensagem é antiga demais para aparecer na conversa."))}>
                    {f && <Avatar f={f} size="xs" />}
                    <b>{f?.name ?? "Alguém"}</b>
                    <time>{dia(Date.parse(m.created_at), agora)} {hhmm(m.created_at)}</time>
                    <span>{m.text || (m.midia ? "🖼 Imagem" : "")}</span>
                  </button>
                );
              })
            ) : (
              <p className="chat-empty">{painel === "fixadas" ? "Nenhuma mensagem fixada. Passe o mouse numa mensagem e toque no 📌." : "Nada encontrado."}</p>
            )}
          </div>
        </div>
      )}
      <div
        className="chat-list"
        id={canal ? undefined : "chatList"}
        ref={lista}
        onScroll={(e) => {
          const el = e.currentTarget;
          noFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          setLonge(el.scrollHeight - el.scrollTop - el.clientHeight > 500);
          /* chegou no alto: busca as mais antigas, sem pular a rolagem */
          if (el.scrollTop < 40 && temAntigas) {
            const antes = el.scrollHeight;
            void carregarAntigas(chave).then((n) => {
              if (n) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - antes + el.scrollTop));
            });
          }
        }}
      >
        {!ok ? (
          <p className="chat-empty">O chat ainda não está ligado. Peça para o admin rodar o SQL novo no Supabase.</p>
        ) : carregando ? (
          /* as mensagens ainda vêm do banco: o esqueleto no formato delas */
          <div className="esq-chat" aria-label="Carregando as mensagens">
            {[70, 45, 85, 55].map((w, i) => (
              <div key={i} className="esq-msg">
                <span className="esq esq-redondo" />
                <span>
                  <span className="esq esq-linha" style={{ "--w": "22%" } as React.CSSProperties} />
                  <span className="esq esq-linha" style={{ "--w": `${w}%` } as React.CSSProperties} />
                </span>
              </div>
            ))}
          </div>
        ) : !msgs.length ? (
          <p className="chat-empty">Nenhuma mensagem ainda. Mande a primeira.</p>
        ) : (
          <>
            {!temAntigas && <p className="chat-comeco">Começo do canal. Daqui para cima não tem mais nada.</p>}
            {msgs.map((m, i) => {
              const prev: MsgChat | undefined = msgs[i - 1];
              const t = Date.parse(m.created_at);
              const novoDia = !prev || dia(Date.parse(prev.created_at), agora) !== dia(t, agora);
              const first = novoDia || !prev || prev.user_id !== m.user_id || t - Date.parse(prev.created_at) > 5 * 60e3;
              return (
                <div key={m.id} className="msg-bloco">
                  {novoDia && (
                    <p className="chat-dia">
                      <span>{dia(t, agora)}</span>
                    </p>
                  )}
                  {novaPrimeira === m && (
                    <p className="chat-novas">
                      <span>Novas mensagens</span>
                    </p>
                  )}
                  <Mensagem
                    m={m}
                    primeira={first || novaPrimeira === m}
                    eu={m.user_id === myUid}
                    mod={mod}
                    meuAt={meuAt}
                    acoes={acoes}
                    editando={editando === m.id}
                    fimEdicao={() => setEditando(null)}
                    citada={m.respostaA ? (porId.get(String(m.respostaA)) ?? null) : undefined}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>
      {longe && (
        <button type="button" className="chat-pular" onClick={descer}>
          Pular para as mais novas ↓
        </button>
      )}
      <Digitando canal={chave} />
      {resposta && (
        <div className="chat-respondendo">
          <span>
            Respondendo a <b>{friends.find((f) => f.user_id === resposta.user_id)?.name ?? "Alguém"}</b>
          </span>
          <button type="button" className="link" aria-label="Parar de responder" onClick={() => setResposta(null)}>
            ✕
          </button>
        </div>
      )}
      {fotoUrl && (
        <div className="chat-anexo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoUrl} alt="Imagem para mandar" />
          <button type="button" className="link" aria-label="Tirar a imagem" onClick={() => setFoto(null)}>
            ✕
          </button>
        </div>
      )}
      <form className="chat-form" id={canal ? undefined : "chatForm"} autoComplete="off" onSubmit={(e) => void enviar(e)}>
        <SugestoesArroba texto={texto} mudar={setTexto} />
        {chatNovo() && (
          <button type="button" className="chat-mais" aria-label="Mandar imagem ou GIF" title="Mandar imagem ou GIF" onClick={() => arquivo.current?.click()}>
            +
          </button>
        )}
        <textarea
          ref={campo}
          id={canal ? undefined : "chatInput"}
          maxLength={300}
          rows={1}
          placeholder={resposta ? "Escreva a resposta…" : placeholder}
          aria-label="Mensagem"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (e.target.value.trim()) avisarDigitandoChat(chave);
          }}
          onKeyDown={(e) => {
            /* Enter manda; Shift+Enter pula linha (ao contrário, se a pessoa desligou "Enter envia");
               seta para cima edita a minha última (como no Discord) */
            const manda = ajuste("enterEnvia") ? !e.shiftKey : e.shiftKey || e.ctrlKey || e.metaKey;
            if (e.key === "Enter" && manda) {
              e.preventDefault();
              void enviar();
            } else if (e.key === "ArrowUp" && !texto && chatNovo()) {
              const minha = [...msgs].reverse().find((m) => m.user_id === myUid);
              if (minha) {
                e.preventDefault();
                setEditando(minha.id);
              }
            } else if (e.key === "Escape" && resposta) setResposta(null);
          }}
          onPaste={(e) => {
            const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
            if (f && chatNovo()) {
              e.preventDefault();
              setFoto(f);
            }
          }}
        />
        {texto.length > 250 && <small className="chat-conta">{300 - texto.length}</small>}
        <span className="chat-emoji-caixa">
          <button type="button" className="chat-mais" aria-label="Emoji" title="Emoji" onClick={() => setEmojis((v) => !v)}>
            😊
          </button>
          {emojis && (
            <EscolherEmoji
              fechar={() => setEmojis(false)}
              escolher={(em) => {
                setTexto((t) => (t + em).slice(0, 300));
                campo.current?.focus();
              }}
            />
          )}
        </span>
        <button className="btn sq" type="submit">
          Enviar
        </button>
        <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => (setFoto(e.target.files?.[0] ?? null), (e.target.value = ""))} />
      </form>
      <small className="chat-ajuda">**negrito** *itálico* ~~riscado~~ ||spoiler|| `código` &gt; citação · {enterEnvia ? "Shift+Enter pula linha" : "Shift+Enter envia"}</small>
    </div>
  );
}
