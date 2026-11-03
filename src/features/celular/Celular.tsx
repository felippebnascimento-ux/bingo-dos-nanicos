"use client";
/*
 * O Celular (item da loja): um iPhone 17 Pro Max por cima de tudo (moldura de titânio, Dynamic Island, barra de
 * status e indicador de início) rodando o InstaNanico, o Instagram do grupo: stories de 24 h, feed com curtir
 * (inclusive com dois toques na foto), comentários em folha, explorar, novo post ou story, atividade e perfil.
 * No celular de verdade (até 520 px) ocupa a tela inteira, sem moldura. Fecha com Esc ou tocando fora.
 * O botão só aparece para quem tem o item; quem garante o acesso à rede é o banco (seções 18 e 34).
 * As cores são da ilustração (--ig-* e --iph-*, em 33-celular.css), como o modo escuro do Instagram.
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useSure } from "@/components/ui/useSure";
import { useMinhaMochila } from "@/features/loja/lojaDados";
import { Imagem } from "@/features/midias/Imagem";
import { EditorStory } from "./EditorStory";
import { setApp, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { reduzMovimento } from "@/lib/util";
import {
  agrupar, andar, conversas, daConversa, formatoInicial, inicioDoGrupo, PROPORCAO, recorte, resumo, STORY_MS, tempoCurto,
  type Formato, type Grupo, type Mensagem, type Story,
} from "./insta";
import {
  abrirCelular, abrirConversa, apagarComentario, apagarPost, apagarStory, comentar, curtir, enviarMensagem, fecharCelular, iniciarRede,
  lerQuemViu, marcarVisto, maisPostagens, postar, tocarIlha, useRede, verPerfil, type Comentario, type Post,
} from "./rede";

/** Tenho o celular na mochila? Também avisa a rede quando muda (comprou agora). */
export function useTemCelular() {
  const tem = useMinhaMochila().some((l) => l.itemId === "celular");
  useEffect(() => iniciarRede(tem), [tem]);
  return tem;
}

const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Botão do celular (menu e canto do Sítio), com a bolinha de não lidas. Some para quem não tem o item. */
export function BotaoCelular({ className = "" }: { className?: string }) {
  const tem = useTemCelular();
  const nao = useRede((s) => s.naoLidas + s.naoLidasDM);
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

/* ---------- ícones do Instagram (traço 2, como os do app) ---------- */
const Ic = ({ d, cheio, tam = 24 }: { d: ReactNode; cheio?: boolean; tam?: number }) => (
  <svg viewBox="0 0 24 24" width={tam} height={tam} fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const IcCasa = ({ cheio }: { cheio?: boolean }) => <Ic cheio={cheio} d={<path d="M3 10.5 12 3l9 7.5V21h-6v-6.5H9V21H3Z" />} />;
const IcLupa = () => <Ic d={<><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5.5 5.5" /></>} />;
const IcMais = () => <Ic d={<><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 7.5v9M7.5 12h9" /></>} />;
const IcCoracao = ({ cheio, tam }: { cheio?: boolean; tam?: number }) => (
  <Ic tam={tam} cheio={cheio} d={<path d="M12 20.5s-8.5-4.9-8.5-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9c0 6.1-8.5 11-8.5 11Z" />} />
);
const IcBalao = () => <Ic d={<path d="M20.6 12a8.6 8.6 0 1 1-4-7.3 8.6 8.6 0 0 1 4 7.3Zm0 0 .9 8.5-5-2.2" />} />;
const IcAviao = () => <Ic d={<><path d="M21.5 3 9.5 13.5" /><path d="M21.5 3 15 21l-5.5-7.5L2.5 9Z" /></>} />;
const IcSalvar = () => <Ic d={<path d="M19 21 12 15.5 5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5Z" />} />;
const IcPontos = () => <Ic d={<><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>} />;
const IcX = () => <Ic d={<path d="M5 5l14 14M19 5 5 19" />} />;
const IcVoltar = () => <Ic d={<path d="M15 4 7 12l8 8" />} />;
const IcOlho = () => <Ic tam={18} d={<><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" /><circle cx="12" cy="12" r="3" /></>} />;
const IcGrade = () => <Ic tam={20} d={<><rect x="3" y="3" width="18" height="18" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>} />;
const IcCaneta = () => <Ic d={<><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 3 3" /></>} />;
const IcFoto = () => <Ic d={<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>} />;

/* ---------- pedaços comuns ---------- */
/** "Agora" para os tempos da tela ("5 min", stories de 24 h): anda sozinho a cada 30 s. */
function useAgora() {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

function useNome(userId: string | null | undefined) {
  return useApp((s) => s.friends.find((x) => x.user_id === userId) ?? null);
}

/** Rosto com o anel dos stories: colorido (story novo), cinza (já vi) ou sem anel. */
function RostoAnel({ userId, tam = 32, anel = "nenhum", onClick, rotulo }: { userId: string; tam?: number; anel?: "novo" | "visto" | "nenhum"; onClick?: () => void; rotulo?: string }) {
  const f = useNome(userId);
  const conteudo = (
    <span className={"ig-anel " + anel} style={{ width: tam, height: tam }}>
      <Avatar f={f ?? { name: "?" }} className="ig-rosto" />
    </span>
  );
  return onClick ? (
    <button type="button" className="ig-sem-botao" onClick={onClick} aria-label={rotulo ?? `Ver ${f?.name ?? "perfil"}`}>
      {conteudo}
    </button>
  ) : (
    conteudo
  );
}

/** O "usuário" do Instagram: o nome do nanico em minúsculas, sem espaço. */
const arroba = (nome: string | undefined) => (nome ?? "alguem").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "");

type Tela = "inicio" | "explorar" | "novo" | "atividade" | "perfil" | "direct";
type Nav = {
  ir: (t: Tela) => void;
  perfil: (userId: string) => void;
  verStories: (userId: string) => void;
  comentarios: (p: Post) => void;
  abrirPost: (p: Post) => void;
  /** abre a conversa com um nanico no Direct */
  conversa: (userId: string) => void;
  /** abre a folha para mandar a publicação para alguém */
  compartilhar: (p: Post) => void;
};

/* ---------- Dynamic Island ---------- */
/* Como no iPhone: a pílula cresce, o conteúdo aparece depois; ao fechar, o conteúdo some e só então ela encolhe.
   Sempre o mesmo botão (trocar de elemento cortaria a animação); tocar leva ao post, story ou conversa do aviso. */
function Ilha() {
  const ilha = useRede((s) => s.ilha);
  const f = useNome(ilha?.userId);
  const fase = !ilha ? "" : ilha.fechando ? " fechando" : " aberta";
  const podeTocar = !!ilha?.alvo && !ilha.fechando;
  return (
    <button
      type="button"
      className={"iph-ilha" + fase + (podeTocar ? " toca" : "")}
      onClick={podeTocar ? tocarIlha : undefined}
      tabIndex={podeTocar ? 0 : -1}
      aria-label={podeTocar ? `${ilha?.texto}. Abrir` : undefined}
      aria-hidden={!ilha || undefined}
    >
      <span className="iph-ilha-conteudo" aria-live="polite">
        {ilha && (
          <>
            {ilha.userId ? <Avatar f={f ?? { name: "?" }} className="iph-ilha-rosto" /> : <span />}
            <span className="iph-ilha-texto">
              <small>{ilha.tipo === "mensagem" ? "Direct" : ilha.tipo === "envio" ? "Enviando" : "InstaNanico"}</small>
              {ilha.texto}
            </span>
            {ilha.tipo === "envio" ? <span className="iph-ilha-gira" aria-hidden="true" /> : <span className={"iph-ilha-ponto " + ilha.tipo} aria-hidden="true" />}
          </>
        )}
      </span>
    </button>
  );
}

/* ---------- topo e stories ---------- */
function Logo() {
  return <span className="ig-logo">InstaNanico</span>;
}

function FileiraStories({ grupos, nav, abrirCriador }: { grupos: Grupo[]; nav: Nav; abrirCriador: () => void }) {
  const eu = useApp((s) => s.myUid);
  const meu = grupos.find((g) => g.userId === eu);
  const outros = grupos.filter((g) => g.userId !== eu);
  return (
    <div className="ig-stories" role="list" aria-label="Stories">
      <div className="ig-story-item" role="listitem">
        <div className="ig-story-eu">
          {eu && <RostoAnel userId={eu} tam={66} anel={meu ? (meu.todosVistos ? "visto" : "novo") : "nenhum"} onClick={meu ? () => nav.verStories(eu) : abrirCriador} rotulo={meu ? "Ver o seu story" : "Criar story"} />}
          <button type="button" className="ig-story-mais" aria-label="Criar story" onClick={abrirCriador}>
            +
          </button>
        </div>
        <small className="ig-cinza">Seu story</small>
      </div>
      {outros.map((g) => (
        <div key={g.userId} className="ig-story-item" role="listitem">
          <RostoAnel userId={g.userId} tam={66} anel={g.todosVistos ? "visto" : "novo"} onClick={() => nav.verStories(g.userId)} />
          <NomeCurto userId={g.userId} />
        </div>
      ))}
    </div>
  );
}
function NomeCurto({ userId }: { userId: string }) {
  const f = useNome(userId);
  return <small>{arroba(f?.name)}</small>;
}

/* ---------- uma postagem ---------- */
function PostInsta({ p, nav }: { p: Post; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(p.userId);
  const curtidas = useRede((s) => s.curtidas[p.id] ?? []);
  const comentarios = useRede((s) => s.comentarios[p.id] ?? []);
  const agora = useAgora();
  const temStory = useRede((s) => s.stories.some((x) => x.userId === p.userId && agora - x.em < 86_400_000));
  const primeiro = useNome(curtidas.find((u) => u !== eu) ?? curtidas[0]);
  const [coracao, setCoracao] = useState(0);
  const [menu, setMenu] = useState(false);
  const { sure, pedir } = useSure(3000);
  const ultimoToque = useRef(0);
  const curti = !!eu && curtidas.includes(eu);

  /* dois toques na foto curtem (como no app), com o coração grande */
  const tocarFoto = () => {
    const t = Date.now();
    if (t - ultimoToque.current < 320) {
      if (!curti) void curtir(p);
      setCoracao((c) => c + 1);
    }
    ultimoToque.current = t;
  };

  return (
    <article className="ig-post">
      <header className="ig-post-topo">
        <RostoAnel userId={p.userId} tam={34} anel={temStory ? "novo" : "nenhum"} onClick={() => (temStory ? nav.verStories(p.userId) : nav.perfil(p.userId))} />
        <button type="button" className="ig-sem-botao ig-user" onClick={() => nav.perfil(p.userId)}>
          {arroba(f?.name)}
        </button>
        <small className="ig-cinza">· {tempoCurto(p.em, agora)}</small>
        <button type="button" className="ig-sem-botao ig-pontos" aria-label="Opções" onClick={() => setMenu((m) => !m)}>
          <IcPontos />
        </button>
        {menu && (
          <div className="ig-menu" role="menu">
            {p.userId === eu && (
              <button type="button" role="menuitem" className={"ig-perigo" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarPost(p)}>
                {sure ? "Toque de novo para apagar" : "Apagar"}
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => { setMenu(false); nav.perfil(p.userId); }}>
              Ver perfil
            </button>
            <button type="button" role="menuitem" onClick={() => setMenu(false)}>
              Cancelar
            </button>
          </div>
        )}
      </header>
      <div className="ig-midia" onClick={tocarFoto}>
        {p.midia ? <Imagem caminho={p.midia} alt={p.texto.slice(0, 80) || `Foto de ${f?.name ?? "alguém"}`} /> : <div className="ig-post-texto">{p.texto}</div>}
        {coracao > 0 && (
          <span key={coracao} className="ig-coracao-grande" aria-hidden="true">
            <IcCoracao cheio tam={96} />
          </span>
        )}
      </div>
      <div className="ig-acoes">
        <button type="button" className={"ig-sem-botao ig-curtir" + (curti ? " on" : "")} aria-pressed={curti} aria-label={curti ? "Descurtir" : "Curtir"} onClick={() => void curtir(p)}>
          <IcCoracao cheio={curti} />
        </button>
        <button type="button" className="ig-sem-botao" aria-label="Comentar" onClick={() => nav.comentarios(p)}>
          <IcBalao />
        </button>
        <button type="button" className="ig-sem-botao" aria-label="Enviar para um nanico" onClick={() => nav.compartilhar(p)}>
          <IcAviao />
        </button>
        <span className="ig-espaco" />
        <button type="button" className="ig-sem-botao" aria-label="Salvar (em breve)" disabled>
          <IcSalvar />
        </button>
      </div>
      {curtidas.length > 0 && (
        <p className="ig-curtidas">
          {curtidas.length === 1 ? (
            <>
              Curtido por <b>{arroba(primeiro?.name)}</b>
            </>
          ) : (
            <>
              Curtido por <b>{arroba(primeiro?.name)}</b> e <b>{curtidas.length - 1 === 1 ? "outra pessoa" : `outras ${curtidas.length - 1} pessoas`}</b>
            </>
          )}
        </p>
      )}
      {p.midia && p.texto && (
        <p className="ig-legenda">
          <b>{arroba(f?.name)}</b> {p.texto}
        </p>
      )}
      {comentarios.length > 0 && (
        <button type="button" className="ig-sem-botao ig-ver-coments" onClick={() => nav.comentarios(p)}>
          {comentarios.length === 1 ? "Ver 1 comentário" : `Ver todos os ${comentarios.length} comentários`}
        </button>
      )}
      <button type="button" className="ig-sem-botao ig-add-coment" onClick={() => nav.comentarios(p)}>
        {eu && <RostoAnel userId={eu} tam={22} />} Adicione um comentário…
      </button>
    </article>
  );
}

/* ---------- comentários (folha que sobe) ---------- */
function LinhaComentario({ c }: { c: Comentario }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(c.userId);
  const agora = useAgora();
  const { sure, pedir } = useSure(3000);
  return (
    <li>
      <RostoAnel userId={c.userId} tam={32} />
      <div>
        <p>
          <b>{arroba(f?.name)}</b> <small className="ig-cinza">{tempoCurto(c.em, agora)}</small>
        </p>
        <p>{c.texto}</p>
        {c.userId === eu && (
          <button type="button" className={"ig-sem-botao ig-cinza ig-pequeno" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarComentario(c)}>
            {sure ? "Toque de novo para apagar" : "Apagar"}
          </button>
        )}
      </div>
    </li>
  );
}
function FolhaComentarios({ p, fechar }: { p: Post; fechar: () => void }) {
  const eu = useApp((s) => s.myUid);
  const lista = useRede((s) => s.comentarios[p.id] ?? []);
  const [texto, setTexto] = useState("");
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label="Comentários">
        <span className="ig-alca" aria-hidden="true" />
        <h3>Comentários</h3>
        <ul className="ig-coments">
          {lista.length ? lista.map((c) => <LinhaComentario key={c.id} c={c} />) : <li className="ig-vazio">Ainda não há comentários. Comece a conversa.</li>}
        </ul>
        <form
          className="ig-comentar"
          onSubmit={(e) => {
            e.preventDefault();
            void comentar(p, texto).then((ok) => ok && setTexto(""));
          }}
        >
          {eu && <RostoAnel userId={eu} tam={32} />}
          <input aria-label="Adicione um comentário" maxLength={280} placeholder="Adicione um comentário…" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button type="submit" className="ig-sem-botao ig-azul" disabled={!texto.trim()}>
            Publicar
          </button>
        </form>
      </section>
    </div>
  );
}

/* ---------- telas ---------- */
function Feed({ grupos, nav, abrirCriador }: { grupos: Grupo[]; nav: Nav; abrirCriador: () => void }) {
  const posts = useRede((s) => s.posts);
  const fim = useRede((s) => s.fim);
  const carregando = useRede((s) => s.carregando);
  return (
    <>
      <header className="ig-topo">
        <Logo />
        <span className="ig-espaco" />
        <button type="button" className="ig-sem-botao" aria-label="Atividade" onClick={() => nav.ir("atividade")}>
          <IcCoracao />
        </button>
        <BotaoDirect nav={nav} />
      </header>
      <FileiraStories grupos={grupos} nav={nav} abrirCriador={abrirCriador} />
      {posts.map((p) => (
        <PostInsta key={p.id} p={p} nav={nav} />
      ))}
      {!posts.length && !carregando && <p className="ig-vazio">Nada publicado ainda. Toque no + para postar a primeira foto.</p>}
      {!fim && posts.length > 0 && (
        <button type="button" className="ig-sem-botao ig-azul ig-mais" disabled={carregando} onClick={() => void maisPostagens()}>
          {carregando ? "Carregando…" : "Ver mais publicações"}
        </button>
      )}
    </>
  );
}

function Quadrado({ p, onClick }: { p: Post; onClick: () => void }) {
  return (
    <button type="button" className="ig-quadrado" onClick={onClick} aria-label="Abrir publicação">
      {p.midia ? <Imagem caminho={p.midia} alt="" /> : <span className="ig-quadrado-texto">{p.texto}</span>}
    </button>
  );
}

function Explorar({ nav }: { nav: Nav }) {
  const posts = useRede((s) => s.posts);
  const [busca, setBusca] = useState("");
  const friends = useApp((s) => s.friends);
  const achados = busca.trim() ? friends.filter((f) => f.user_id && arroba(f.name).includes(arroba(busca))) : [];
  return (
    <>
      <div className="ig-busca">
        <IcLupa />
        <input aria-label="Pesquisar" placeholder="Pesquisar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {achados.length > 0 ? (
        <ul className="ig-lista-gente">
          {achados.map((f) => (
            <li key={f.id}>
              <button type="button" className="ig-sem-botao" onClick={() => nav.perfil(f.user_id!)}>
                <RostoAnel userId={f.user_id!} tam={44} />
                <span>
                  <b>{arroba(f.name)}</b>
                  <small className="ig-cinza">{f.name}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ig-grade explorar">
          {posts.map((p) => (
            <Quadrado key={p.id} p={p} onClick={() => nav.abrirPost(p)} />
          ))}
        </div>
      )}
    </>
  );
}

function Atividade({ nav }: { nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const posts = useRede((s) => s.posts);
  const curtidas = useRede((s) => s.curtidas);
  const comentarios = useRede((s) => s.comentarios);
  /* o que aconteceu nas minhas publicações carregadas: curtidas e comentários dos outros */
  const itens = useMemo(() => {
    const out: { chave: string; userId: string; texto: string; post: Post; em: number }[] = [];
    for (const p of posts.filter((x) => x.userId === eu)) {
      for (const u of curtidas[p.id] ?? []) if (u !== eu) out.push({ chave: `c${p.id}${u}`, userId: u, texto: "curtiu sua publicação.", post: p, em: p.em });
      for (const c of comentarios[p.id] ?? []) if (c.userId !== eu) out.push({ chave: `k${c.id}`, userId: c.userId, texto: `comentou: ${c.texto}`, post: p, em: c.em });
    }
    return out.sort((a, b) => b.em - a.em).slice(0, 60);
  }, [posts, curtidas, comentarios, eu]);
  return (
    <>
      <header className="ig-topo">
        <button type="button" className="ig-sem-botao" aria-label="Voltar" onClick={() => nav.ir("inicio")}>
          <IcVoltar />
        </button>
        <b className="ig-titulo">Notificações</b>
      </header>
      <ul className="ig-atividade">
        {itens.length ? (
          itens.map((x) => <ItemAtividade key={x.chave} {...x} nav={nav} />)
        ) : (
          <li className="ig-vazio">Quando alguém curtir ou comentar suas publicações, aparece aqui.</li>
        )}
      </ul>
    </>
  );
}
function ItemAtividade({ userId, texto, post, em, nav }: { userId: string; texto: string; post: Post; em: number; nav: Nav }) {
  const f = useNome(userId);
  const agora = useAgora();
  return (
    <li>
      <RostoAnel userId={userId} tam={44} onClick={() => nav.perfil(userId)} />
      <p>
        <b>{arroba(f?.name)}</b> {texto} <small className="ig-cinza">{tempoCurto(em, agora)}</small>
      </p>
      <span className="ig-mini">
        <Quadrado p={post} onClick={() => nav.abrirPost(post)} />
      </span>
    </li>
  );
}

function Perfil({ userId, nav }: { userId: string; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(userId);
  const todos = useRede((s) => s.posts);
  const posts = useMemo(() => todos.filter((p) => p.userId === userId), [todos, userId]);
  const curtidas = useRede((s) => s.curtidas);
  const agora = useAgora();
  const temStory = useRede((s) => s.stories.some((x) => x.userId === userId && agora - x.em < 86_400_000));
  const recebidas = posts.reduce((n, p) => n + (curtidas[p.id]?.length ?? 0), 0);
  const nanicos = useApp((s) => s.friends.filter((x) => x.user_id).length);
  return (
    <>
      <header className="ig-topo">
        {userId !== eu && (
          <button type="button" className="ig-sem-botao" aria-label="Voltar" onClick={() => nav.ir("inicio")}>
            <IcVoltar />
          </button>
        )}
        <b className="ig-titulo">{arroba(f?.name)}</b>
      </header>
      <div className="ig-perfil">
        <RostoAnel userId={userId} tam={86} anel={temStory ? "novo" : "nenhum"} onClick={temStory ? () => nav.verStories(userId) : undefined} />
        <dl>
          <div>
            <dt>{posts.length}</dt>
            <dd>publicações</dd>
          </div>
          <div>
            <dt>{recebidas}</dt>
            <dd>curtidas</dd>
          </div>
          <div>
            <dt>{nanicos}</dt>
            <dd>nanicos</dd>
          </div>
        </dl>
      </div>
      <p className="ig-bio">
        <b>{f?.name ?? "Nanico"}</b>
        <span className="ig-cinza">Membro do grupo dos nanicos</span>
      </p>
      {f && (
        <div className="ig-perfil-botoes">
          <button
            type="button"
            className="ig-botao-cinza"
            onClick={() => {
              fecharCelular();
              setApp({ fichaAberta: f.id });
            }}
          >
            Ver ficha
          </button>
          {userId === eu ? (
            <button type="button" className="ig-botao-cinza" onClick={() => nav.ir("novo")}>
              Nova publicação
            </button>
          ) : (
            /* como no Instagram: do perfil de alguém, direto para a conversa */
            <button type="button" className="ig-botao-cinza" onClick={() => nav.conversa(userId)}>
              Mensagem
            </button>
          )}
        </div>
      )}
      <div className="ig-aba-grade" aria-hidden="true">
        <IcGrade />
      </div>
      <div className="ig-grade">
        {posts.map((p) => (
          <Quadrado key={p.id} p={p} onClick={() => nav.abrirPost(p)} />
        ))}
      </div>
      {!posts.length && <p className="ig-vazio">Nenhuma publicação ainda.</p>}
    </>
  );
}

/* ---------- editor de corte (como no Instagram): arrasta, zoom e formato ---------- */
type Corte = { cortar: () => Promise<File> };
const FORMATOS_POST: Formato[] = ["1:1", "4:5", "1.91:1"];
const NOME_FORMATO: Record<Formato, string> = { "1:1": "Quadrado", "4:5": "Em pé", "1.91:1": "Deitado", "9:16": "Story" };

function Cortador({ arquivo, story, corte }: { arquivo: File; story: boolean; corte: Ref<Corte> }) {
  /* o endereço da foto é solto quando ela carrega (o corte desenha do <img> já carregado) */
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo]);
  const caixa = useRef<HTMLDivElement>(null);
  const foto = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [tam, setTam] = useState<{ W: number; H: number } | null>(null);
  const [formato, setFormato] = useState<Formato>(story ? "9:16" : "1:1");
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ dx: 0, dy: 0 });
  const arraste = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const gif = arquivo.type === "image/gif";

  /* o tamanho da moldura na tela (muda com o formato) */
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ler = () => setTam({ W: el.clientWidth, H: el.clientHeight });
    ler();
    const ro = new ResizeObserver(ler);
    ro.observe(el);
    return () => ro.disconnect();
  }, [formato]);

  const r = nat && tam ? recorte(nat, tam, z, pos.dx, pos.dy) : null;
  /* o editor entrega o corte em 1080 px de largura, no formato escolhido (GIF vai inteiro, para não perder o movimento) */
  useImperativeHandle(corte, () => ({
      cortar: async () => {
        const img = foto.current;
        if (gif || !img || !nat || !tam) return arquivo;
        const k = recorte(nat, tam, z, pos.dx, pos.dy);
        const largura = Math.min(1080, Math.round(k.largura));
        const altura = Math.round(largura / PROPORCAO[formato]);
        const c = document.createElement("canvas");
        c.width = largura;
        c.height = altura;
        c.getContext("2d")!.drawImage(img, k.x, k.y, k.largura, k.altura, 0, 0, largura, altura);
        const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/webp", 0.9));
        return blob ? new File([blob], "foto.webp", { type: "image/webp" }) : arquivo;
      },
  }));

  return (
    <div className="ig-corte">
      <div
        ref={caixa}
        className="ig-corte-caixa"
        style={{ aspectRatio: String(PROPORCAO[formato]) }}
        onPointerDown={(e) => {
          if (!r) return;
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            /* sem captura, o arraste vale enquanto o dedo está na foto */
          }
          arraste.current = { x: e.clientX, y: e.clientY, dx: r.dx, dy: r.dy };
        }}
        onPointerMove={(e) => {
          const a = arraste.current;
          if (a) setPos({ dx: a.dx + e.clientX - a.x, dy: a.dy + e.clientY - a.y });
        }}
        onPointerUp={() => {
          arraste.current = null;
          if (r) setPos({ dx: r.dx, dy: r.dy });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={foto}
          src={url}
          alt="Foto escolhida"
          draggable={false}
          onLoad={(e) => {
            const w = e.currentTarget.naturalWidth, h = e.currentTarget.naturalHeight;
            setNat({ w, h });
            URL.revokeObjectURL(url);
            if (!story) setFormato(formatoInicial(w, h));
          }}
          style={r && nat ? { width: nat.w * r.escala, height: nat.h * r.escala, transform: `translate(calc(-50% + ${r.dx}px), calc(-50% + ${r.dy}px))` } : undefined}
        />
        <span className="ig-corte-grade" aria-hidden="true" />
      </div>
      {!gif && (
        <div className="ig-corte-ctrl">
          {!story && (
            <div className="ig-corte-formatos" role="radiogroup" aria-label="Formato">
              {FORMATOS_POST.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={formato === f} className={formato === f ? "on" : undefined} onClick={() => { setFormato(f); setPos({ dx: 0, dy: 0 }); }}>
                  <i className={"ig-forma f" + f.replace(/[.:]/g, "")} aria-hidden="true" />
                  {NOME_FORMATO[f]}
                </button>
              ))}
            </div>
          )}
          <label className="ig-corte-zoom">
            <span>Zoom</span>
            <input type="range" min={1} max={3} step={0.01} value={z} onChange={(e) => setZ(Number(e.target.value))} aria-label="Zoom da foto" />
          </label>
          <small className="ig-cinza">Arraste a foto para escolher o pedaço que aparece.</small>
        </div>
      )}
    </div>
  );
}

/* ---------- novo post ou story ---------- */
function Novo({ nav, modoInicial }: { nav: Nav; modoInicial: "post" | "story" }) {
  const enviando = useRede((s) => s.enviando);
  const [modo, setModo] = useState<"post" | "story">(modoInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const corte = useRef<Corte | null>(null);
  /* o story tem o editor dele, como no Instagram (texto, desenho, figurinhas) */
  if (modo === "story") return <EditorStory fechar={() => nav.ir("inicio")} postou={() => nav.ir("inicio")} irParaPost={() => setModo("post")} />;
  const publicar = async () => {
    /* a foto sobe já cortada no formato escolhido */
    const foto = arquivo && corte.current ? await corte.current.cortar() : arquivo;
    if (await postar(texto, foto)) nav.ir("inicio");
  };
  return (
    <div className="ig-novo post">
      <header className="ig-topo">
        <button type="button" className="ig-sem-botao" aria-label="Cancelar" onClick={() => nav.ir("inicio")}>
          <IcX />
        </button>
        <b className="ig-titulo">Nova publicação</b>
        <span className="ig-espaco" />
        <button type="button" className="ig-sem-botao ig-azul" disabled={enviando || (!arquivo && !texto.trim())} onClick={() => void publicar()}>
          {enviando ? "Enviando…" : "Compartilhar"}
        </button>
      </header>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      {arquivo ? (
        <Cortador key={arquivo.name + arquivo.size} arquivo={arquivo} story={false} corte={corte} />
      ) : (
        <div className="ig-novo-previa" onClick={() => input.current?.click()}>
          <span className="ig-novo-vazio">
            <IcFoto />
            Toque para escolher uma foto
          </span>
        </div>
      )}
      <textarea
        className="ig-novo-texto"
        aria-label="Legenda"
        maxLength={500}
        rows={3}
        placeholder="Escreva uma legenda…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {arquivo && (
        <div className="ig-novo-trocar">
          <button type="button" className="ig-sem-botao ig-azul ig-pequeno" onClick={() => input.current?.click()}>
            Trocar foto
          </button>
          <button type="button" className="ig-sem-botao ig-cinza ig-pequeno" onClick={() => setArquivo(null)}>
            Tirar a foto
          </button>
        </div>
      )}
      <div className="ig-modos" role="radiogroup" aria-label="Publicar como">
        {(["post", "story"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={modo === m} className={modo === m ? "on" : undefined} onClick={() => setModo(m)}>
            {m === "post" ? "PUBLICAÇÃO" : "STORY"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- ver stories ---------- */
function VerStories({ grupos, inicio, fechar }: { grupos: Grupo[]; inicio: { g: number; s: number }; fechar: () => void }) {
  const eu = useApp((s) => s.myUid);
  const quemViu = useRede((s) => s.quemViu);
  const [pos, setPos] = useState(inicio);
  const [pausa, setPausa] = useState(false);
  const [lista, setLista] = useState(false);
  /* respondendo: o story para de andar enquanto a pessoa digita */
  const [resposta, setResposta] = useState("");
  const [digitando, setDigitando] = useState(false);
  /* reação que voou (o emoji grande subindo), como no Instagram */
  const [voando, setVoando] = useState<{ id: number; emoji: string } | null>(null);
  const { sure, pedir } = useSure(3000);
  const grupo = grupos[pos.g];
  const story: Story | undefined = grupo?.stories[pos.s];
  const f = useNome(grupo?.userId);
  const meu = grupo?.userId === eu;
  const agora = useAgora();

  useEffect(() => {
    if (!story) return;
    marcarVisto(story);
    if (story.userId === eu) void lerQuemViu(story);
  }, [story, eu]);

  /* passa sozinho depois de STORY_MS (para enquanto segura ou com a lista de quem viu aberta) */
  const ir = (passo: 1 | -1) => {
    const n = andar(grupos, pos.g, pos.s, passo);
    if (!n) return fechar();
    setPos(n);
  };
  /* teclado: setas passam, Esc fecha, espaço pausa (fora do campo de resposta) */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, textarea")) return;
      if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
      else if (e.key === "Escape") fechar();
      else if (e.key === " ") {
        e.preventDefault();
        setPausa((p) => !p);
      } else return;
      /* o Esc fecha só o story, não o celular inteiro */
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  });

  useEffect(() => {
    if (pausa || lista || digitando || !story) return;
    const t = setTimeout(() => {
      const n = andar(grupos, pos.g, pos.s, 1);
      if (!n) fechar();
      else setPos(n);
    }, STORY_MS);
    return () => clearTimeout(t);
  }, [pos, pausa, lista, digitando, story, grupos, fechar]);

  if (!grupo || !story) return null;
  const viu = quemViu[story.id] ?? [];
  /* reação rápida: vai pelo Direct como resposta ao story */
  const reagir = (emoji: string) => {
    setVoando({ id: story.id * 100 + Math.floor(performance.now() % 100), emoji });
    void enviarMensagem(grupo.userId, emoji, { storyId: story.id }).then((ok) => ok && toast(`Reação enviada para ${f?.name ?? "o nanico"}`));
  };
  return (
    <div className={"ig-story-tela" + (pausa ? " segurando" : "")} role="dialog" aria-label={`Story de ${f?.name ?? "alguém"}`}>
      <div className="ig-barras" aria-hidden="true">
        {grupo.stories.map((s, k) => (
          <span key={s.id} className={k < pos.s ? "cheia" : ""}>
            {k === pos.s && <i key={`${story.id}-${pausa || lista || digitando}`} className={pausa || lista || digitando ? "pausa" : ""} style={{ animationDuration: `${STORY_MS}ms` }} />}
          </span>
        ))}
      </div>
      <header className="ig-story-topo">
        <RostoAnel userId={grupo.userId} tam={32} />
        <b>{arroba(f?.name)}</b>
        <small>{tempoCurto(story.em, agora)}</small>
        <span className="ig-espaco" />
        <button type="button" className="ig-sem-botao" aria-label="Fechar" onClick={fechar}>
          <IcX />
        </button>
      </header>
      <div
        className={"ig-story-corpo f-" + story.fundo}
        onPointerDown={() => setPausa(true)}
        onPointerUp={() => setPausa(false)}
        onPointerLeave={() => setPausa(false)}
      >
        {story.midia ? <Imagem caminho={story.midia} alt={story.texto || `Story de ${f?.name ?? "alguém"}`} cheia /> : null}
        {story.texto && <p className={"ig-story-legenda" + (story.midia ? " sobre-foto" : "")}>{story.texto}</p>}
        {voando && (
          <span key={voando.id} className="ig-story-voa" aria-hidden="true" onAnimationEnd={() => setVoando(null)}>
            {voando.emoji}
          </span>
        )}
        <button type="button" className="ig-story-lado esq" aria-label="Story anterior" onClick={() => ir(-1)} />
        <button type="button" className="ig-story-lado dir" aria-label="Próximo story" onClick={() => ir(1)} />
      </div>
      {meu ? (
        <footer className="ig-story-pe">
          <button type="button" className="ig-sem-botao ig-visto" onClick={() => setLista((v) => !v)}>
            <IcOlho /> {viu.length ? `Visto por ${viu.length}` : "Ninguém viu ainda"}
          </button>
          <span className="ig-espaco" />
          <button type="button" className={"ig-sem-botao ig-perigo" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarStory(story).then(() => ir(1))}>
            {sure ? "Toque de novo" : "Apagar"}
          </button>
        </footer>
      ) : (
        <form
          className="ig-story-pe"
          onSubmit={(e) => {
            e.preventDefault();
            if (!resposta.trim()) return;
            void enviarMensagem(grupo.userId, resposta, { storyId: story.id }).then((ok) => {
              if (!ok) return;
              setResposta("");
              setDigitando(false);
              toast(`Enviada para ${f?.name ?? "o nanico"}`);
            });
          }}
        >
          <input
            className="ig-responder"
            aria-label={`Responder ao story de ${f?.name ?? "alguém"}`}
            maxLength={1000}
            placeholder={`Envie uma mensagem para ${arroba(f?.name)}`}
            value={resposta}
            onFocus={() => setDigitando(true)}
            onBlur={() => !resposta.trim() && setDigitando(false)}
            onChange={(e) => setResposta(e.target.value)}
          />
          {resposta.trim() ? (
            <button type="submit" className="ig-sem-botao ig-azul">
              Enviar
            </button>
          ) : (
            <>
              <button type="button" className="ig-sem-botao" aria-label="Curtir o story" onClick={() => reagir("❤️")}>
                <IcCoracao />
              </button>
            </>
          )}
          {/* reações rápidas, como no Instagram: aparecem ao tocar no campo */}
          {digitando && !resposta.trim() && (
            <div className="ig-story-reacoes" role="group" aria-label="Reações rápidas">
              {["😂", "😮", "😍", "😢", "👏", "🔥", "🎉", "💯"].map((em) => (
                <button key={em} type="button" aria-label={`Reagir com ${em}`} onPointerDown={(e) => e.preventDefault()} onClick={() => reagir(em)}>
                  {em}
                </button>
              ))}
            </div>
          )}
        </form>
      )}
      {lista && (
        <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && setLista(false)}>
          <section className="ig-folha" aria-label="Quem viu">
            <span className="ig-alca" aria-hidden="true" />
            <h3>Visualizações</h3>
            <ul className="ig-lista-gente">
              {viu.length ? viu.map((u) => <Visualizou key={u} userId={u} />) : <li className="ig-vazio">Ninguém viu ainda.</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
function Visualizou({ userId }: { userId: string }) {
  const f = useNome(userId);
  return (
    <li>
      <RostoAnel userId={userId} tam={40} />
      <span>
        <b>{arroba(f?.name)}</b>
        <small className="ig-cinza">{f?.name}</small>
      </span>
    </li>
  );
}

/* ---------- Direct ---------- */
function BotaoDirect({ nav }: { nav: Nav }) {
  const n = useRede((s) => s.naoLidasDM);
  return (
    <button type="button" className="ig-sem-botao ig-direct-botao" aria-label={`Mensagens${n ? `, ${n} não lidas` : ""}`} onClick={() => nav.ir("direct")}>
      <IcAviao />
      {n > 0 && <span className="ig-selo">{n > 9 ? "9+" : n}</span>}
    </button>
  );
}

function ItemConversa({ outro, ultima, naoLidas, nav }: { outro: string; ultima: Mensagem; naoLidas: number; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(outro);
  const agora = useAgora();
  return (
    <li>
      <button type="button" className={"ig-sem-botao ig-conversa-item" + (naoLidas ? " nova" : "")} onClick={() => nav.conversa(outro)}>
        <RostoAnel userId={outro} tam={52} />
        <span className="ig-conversa-txt">
          <b>{f?.name ?? "Alguém"}</b>
          <small>
            {resumo(ultima, eu)} · {tempoCurto(ultima.em, agora)}
          </small>
        </span>
        {naoLidas > 0 && <span className="ig-ponto-azul" aria-label={`${naoLidas} não lidas`} />}
      </button>
    </li>
  );
}

function DirectLista({ nav }: { nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const meu = useNome(eu);
  const mensagens = useRede((s) => s.mensagens);
  const friends = useApp((s) => s.friends);
  const [nova, setNova] = useState(false);
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => conversas(mensagens, eu), [mensagens, eu]);
  const gente = friends.filter((f) => f.user_id && f.user_id !== eu && (!busca.trim() || arroba(f.name).includes(arroba(busca))));
  const semConversa = gente.filter((f) => !lista.some((c) => c.outro === f.user_id));
  return (
    <>
      <header className="ig-topo">
        <button type="button" className="ig-sem-botao" aria-label="Voltar" onClick={() => (nova ? setNova(false) : nav.ir("inicio"))}>
          <IcVoltar />
        </button>
        <b className="ig-titulo">{nova ? "Nova mensagem" : arroba(meu?.name)}</b>
        <span className="ig-espaco" />
        {!nova && (
          <button type="button" className="ig-sem-botao" aria-label="Nova mensagem" onClick={() => setNova(true)}>
            <IcCaneta />
          </button>
        )}
      </header>
      <div className="ig-busca">
        <IcLupa />
        <input aria-label="Pesquisar" placeholder="Pesquisar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {nova || busca.trim() ? (
        <ul className="ig-lista-gente">
          {gente.map((f) => (
            <li key={f.id}>
              <button type="button" className="ig-sem-botao" onClick={() => nav.conversa(f.user_id!)}>
                <RostoAnel userId={f.user_id!} tam={44} />
                <span>
                  <b>{f.name}</b>
                  <small className="ig-cinza">{arroba(f.name)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="ig-secao">Mensagens</p>
          <ul className="ig-conversas">
            {lista.length ? lista.map((c) => <ItemConversa key={c.outro} {...c} nav={nav} />) : <li className="ig-vazio">Nenhuma conversa ainda. Mande a primeira mensagem.</li>}
          </ul>
          {semConversa.length > 0 && (
            <>
              <p className="ig-secao">Sugestões</p>
              <ul className="ig-lista-gente">
                {semConversa.slice(0, 8).map((f) => (
                  <li key={f.id}>
                    <button type="button" className="ig-sem-botao" onClick={() => nav.conversa(f.user_id!)}>
                      <RostoAnel userId={f.user_id!} tam={44} />
                      <span>
                        <b>{f.name}</b>
                        <small className="ig-cinza">Toque para mandar mensagem</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}

/** Um balão da conversa: texto, resposta a story ou publicação enviada. */
function Balao({ m, meu, nav }: { m: Mensagem; meu: boolean; nav: Nav }) {
  const post = useRede((s) => (m.postId ? s.posts.find((p) => p.id === m.postId) : undefined));
  const autor = useNome(post?.userId);
  return (
    <div className={"ig-balao-linha" + (meu ? " meu" : "")}>
      <div className="ig-balao-col">
        {m.storyId && <small className="ig-cinza ig-balao-nota">{meu ? "Você respondeu ao story" : "Respondeu ao seu story"}</small>}
        {m.postId &&
          (post ? (
            <button type="button" className="ig-balao-post" onClick={() => nav.abrirPost(post)}>
              <span className="ig-balao-post-topo">
                <RostoAnel userId={post.userId} tam={22} /> <b>{arroba(autor?.name)}</b>
              </span>
              {post.midia ? <Imagem caminho={post.midia} alt="" /> : <span className="ig-quadrado-texto">{post.texto}</span>}
            </button>
          ) : (
            <span className="ig-balao ig-cinza">Publicação</span>
          ))}
        {m.texto && <span className={"ig-balao" + (meu ? " meu" : "")}>{m.texto}</span>}
      </div>
    </div>
  );
}

function Conversa({ outro, nav }: { outro: string; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(outro);
  const mensagens = useRede((s) => s.mensagens);
  const lista = useMemo(() => daConversa(mensagens, eu, outro), [mensagens, eu, outro]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const ultimaVista = lista[lista.length - 1];
  const vista = !!ultimaVista && ultimaVista.de === eu && !!ultimaVista.lidaEm;
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [lista.length]);
  const mandar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    if (await enviarMensagem(outro, texto)) setTexto("");
    setEnviando(false);
  };
  return (
    <div className="ig-chat">
      <header className="ig-topo">
        <button type="button" className="ig-sem-botao" aria-label="Voltar" onClick={() => nav.ir("direct")}>
          <IcVoltar />
        </button>
        <button type="button" className="ig-sem-botao ig-chat-quem" onClick={() => nav.perfil(outro)}>
          <RostoAnel userId={outro} tam={30} />
          <span>
            <b>{f?.name ?? "Alguém"}</b>
            <small className="ig-cinza">{arroba(f?.name)}</small>
          </span>
        </button>
      </header>
      <div className="ig-chat-lista">
        <div className="ig-chat-cabeca">
          <RostoAnel userId={outro} tam={86} />
          <b>{f?.name}</b>
          <small className="ig-cinza">{arroba(f?.name)} · InstaNanico</small>
        </div>
        {lista.map((m) => (
          <Balao key={m.id} m={m} meu={m.de === eu} nav={nav} />
        ))}
        {vista && <small className="ig-cinza ig-visto-chat">Visto</small>}
        <div ref={fim} />
      </div>
      <form
        className="ig-chat-campo"
        onSubmit={(e) => {
          e.preventDefault();
          void mandar();
        }}
      >
        <input aria-label="Mensagem" maxLength={1000} placeholder="Mensagem…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        {texto.trim() && (
          <button type="submit" className="ig-sem-botao ig-azul" disabled={enviando}>
            Enviar
          </button>
        )}
      </form>
    </div>
  );
}

/** Folha para mandar uma publicação para um ou mais nanicos. */
function FolhaCompartilhar({ p, fechar }: { p: Post; fechar: () => void }) {
  const eu = useApp((s) => s.myUid);
  const friends = useApp((s) => s.friends);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const gente = friends.filter((f) => f.user_id && f.user_id !== eu);
  const mandar = async () => {
    setEnviando(true);
    let ok = 0;
    for (const u of marcados) if (await enviarMensagem(u, "", { postId: p.id })) ok++;
    setEnviando(false);
    if (ok) {
      toast(ok === 1 ? "Enviada" : `Enviada para ${ok} nanicos`);
      fechar();
    }
  };
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label="Enviar para">
        <span className="ig-alca" aria-hidden="true" />
        <h3>Enviar para</h3>
        <div className="ig-compartilhar">
          {gente.map((f) => {
            const on = marcados.includes(f.user_id!);
            return (
              <button
                key={f.id}
                type="button"
                className={"ig-sem-botao ig-comp-item" + (on ? " on" : "")}
                aria-pressed={on}
                onClick={() => setMarcados((m) => (on ? m.filter((x) => x !== f.user_id) : [...m, f.user_id!]))}
              >
                <RostoAnel userId={f.user_id!} tam={60} />
                <small>{f.name}</small>
                {on && <span className="ig-comp-ok">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="ig-comp-pe">
          <button type="button" className="ig-botao-azul" disabled={!marcados.length || enviando} onClick={() => void mandar()}>
            {enviando ? "Enviando…" : marcados.length > 1 ? `Enviar separadamente (${marcados.length})` : "Enviar"}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ---------- o app inteiro ---------- */
function InstaNanico() {
  const eu = useApp((s) => s.myUid);
  const stories = useRede((s) => s.stories);
  const vistos = useRede((s) => s.vistos);
  const perfilAberto = useRede((s) => s.perfil);
  const conversaAberta = useRede((s) => s.conversaAberta);
  const [tela, setTela] = useState<Tela>("inicio");
  const [compartilhando, setCompartilhando] = useState<Post | null>(null);
  const [modoNovo, setModoNovo] = useState<"post" | "story">("post");
  const [vendo, setVendo] = useState<{ grupos: Grupo[]; g: number; s: number } | null>(null);
  const [folha, setFolha] = useState<Post | null>(null);
  const [postAberto, setPostAberto] = useState<Post | null>(null);
  const agora = useAgora();
  const rolagem = useRef<HTMLDivElement>(null);
  const vistosSet = useMemo(() => new Set(vistos), [vistos]);
  const grupos = useMemo(() => agrupar(stories, vistosSet, eu, agora), [stories, vistosSet, eu, agora]);

  const nav: Nav = {
    ir: (t) => {
      if (conversaAberta) abrirConversa(null);
      if (t === "inicio" && perfilAberto) verPerfil(null);
      if (t === "perfil" && eu && perfilAberto !== eu) verPerfil(eu);
      if (t === "novo") setModoNovo("post");
      setPostAberto(null);
      setTela(t);
      rolagem.current?.scrollTo({ top: 0 });
    },
    perfil: (userId) => {
      if (conversaAberta) abrirConversa(null);
      setPostAberto(null);
      if (perfilAberto !== userId) verPerfil(userId);
      setTela("perfil");
      rolagem.current?.scrollTo({ top: 0 });
    },
    verStories: (userId) => {
      const g = grupos.findIndex((x) => x.userId === userId);
      if (g >= 0) setVendo({ grupos, g, s: inicioDoGrupo(grupos[g], vistosSet) });
    },
    comentarios: (p) => setFolha(p),
    abrirPost: (p) => setPostAberto(p),
    conversa: (userId) => {
      setPostAberto(null);
      setVendo(null);
      abrirConversa(userId);
      setTela("direct");
    },
    compartilhar: (p) => setCompartilhando(p),
  };
  /* toque na Dynamic Island: abre o que o aviso mostrava (a ref guarda o nav da última renderização) */
  const navAtual = useRef(nav);
  useEffect(() => {
    navAtual.current = nav;
  });
  useEffect(
    () =>
      useRede.subscribe((st, antes) => {
        const p = st.pedido;
        if (!p || p === antes.pedido) return;
        useRede.setState({ pedido: null });
        setFolha(null);
        setCompartilhando(null);
        if (p.tipo === "mensagem") navAtual.current.conversa(p.userId);
        else if (p.tipo === "story") navAtual.current.verStories(p.userId);
        else {
          const post = useRede.getState().posts.find((x) => x.id === p.id);
          if (!post) return;
          setVendo(null);
          if (useRede.getState().conversaAberta) abrirConversa(null);
          navAtual.current.abrirPost(post);
        }
      }),
    [],
  );
  const abrirCriador = () => {
    setModoNovo("story");
    setTela("novo");
  };

  return (
    <div className="ig">
      <div className="ig-rola" ref={rolagem}>
        {conversaAberta && !postAberto ? (
          <Conversa outro={conversaAberta} nav={nav} />
        ) : postAberto ? (
          <>
            <header className="ig-topo">
              <button type="button" className="ig-sem-botao" aria-label="Voltar" onClick={() => setPostAberto(null)}>
                <IcVoltar />
              </button>
              <b className="ig-titulo">Publicação</b>
            </header>
            <PostInsta p={postAberto} nav={nav} />
          </>
        ) : tela === "inicio" ? (
          <Feed grupos={grupos} nav={nav} abrirCriador={abrirCriador} />
        ) : tela === "explorar" ? (
          <Explorar nav={nav} />
        ) : tela === "novo" ? (
          <Novo key={modoNovo} nav={nav} modoInicial={modoNovo} />
        ) : tela === "atividade" ? (
          <Atividade nav={nav} />
        ) : tela === "direct" ? (
          <DirectLista nav={nav} />
        ) : (
          <Perfil userId={perfilAberto ?? eu ?? ""} nav={nav} />
        )}
      </div>
      <nav className="ig-barra" aria-label="InstaNanico" hidden={!!conversaAberta && !postAberto}>
        <button type="button" className={"ig-sem-botao" + (tela === "inicio" ? " on" : "")} aria-label="Início" onClick={() => nav.ir("inicio")}>
          <IcCasa cheio={tela === "inicio"} />
        </button>
        <button type="button" className={"ig-sem-botao" + (tela === "explorar" ? " on" : "")} aria-label="Pesquisar e explorar" onClick={() => nav.ir("explorar")}>
          <IcLupa />
        </button>
        <button type="button" className={"ig-sem-botao" + (tela === "novo" ? " on" : "")} aria-label="Nova publicação" onClick={() => nav.ir("novo")}>
          <IcMais />
        </button>
        <button type="button" className={"ig-sem-botao" + (tela === "atividade" ? " on" : "")} aria-label="Atividade" onClick={() => nav.ir("atividade")}>
          <IcCoracao cheio={tela === "atividade"} />
        </button>
        <button type="button" className={"ig-sem-botao ig-eu" + (tela === "perfil" && perfilAberto === eu ? " on" : "")} aria-label="Seu perfil" onClick={() => nav.ir("perfil")}>
          {eu && <RostoAnel userId={eu} tam={26} />}
        </button>
      </nav>
      {folha && <FolhaComentarios p={folha} fechar={() => setFolha(null)} />}
      {compartilhando && <FolhaCompartilhar p={compartilhando} fechar={() => setCompartilhando(null)} />}
      {vendo && <VerStories grupos={vendo.grupos} inicio={{ g: vendo.g, s: vendo.s }} fechar={() => setVendo(null)} />}
    </div>
  );
}

/** O celular aberto, por cima de tudo: o iPhone com o InstaNanico. */
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
    <div className={"celular-fundo" + (reduzMovimento() ? "" : " anima")} onClick={(e) => e.target === e.currentTarget && fecharCelular()}>
      <div className="iphone" role="dialog" aria-modal="true" aria-label="Celular: InstaNanico">
        <span className="iph-botao acao" aria-hidden="true" />
        <span className="iph-botao vol1" aria-hidden="true" />
        <span className="iph-botao vol2" aria-hidden="true" />
        <span className="iph-botao power" aria-hidden="true" />
        <span className="iph-botao camera" aria-hidden="true" />
        <div className="iph-tela">
          <Ilha />
          <div className="iph-status">
            <span className="iph-hora">{agora}</span>
            <span aria-hidden="true" />
            <span className="iph-icones" aria-hidden="true">
              <svg viewBox="0 0 18 12" width="18" height="12">
                <rect x="0" y="8" width="3" height="4" rx="1" />
                <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                <rect x="10" y="3" width="3" height="9" rx="1" />
                <rect x="15" y="0" width="3" height="12" rx="1" />
              </svg>
              <svg viewBox="0 0 16 12" width="16" height="12">
                <path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Zm-4-4.2a5.7 5.7 0 0 1 8 0l1.4-1.4a7.7 7.7 0 0 0-10.8 0Zm-2.8-2.8a9.7 9.7 0 0 1 13.6 0L16.2 3a11.7 11.7 0 0 0-16.4 0Z" />
              </svg>
              <span className="iph-bateria">
                <i />
              </span>
            </span>
          </div>
          <InstaNanico />
          <button type="button" className="iph-inicio" aria-label="Fechar o celular" onClick={fecharCelular} />
        </div>
      </div>
    </div>
  );
}
