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
import { carregarMidias, linksDe, useMidias } from "@/features/midias/midiasDados";
import { EditorStory } from "./EditorStory";
import { setApp, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local, reduzMovimento } from "@/lib/util";
import {
  agrupar, ajustarPixels, andar, conversas, cssDoFiltro, daConversa, DIA_MS, doGrupo, ehAudio, FILTROS, formatoInicial, horaDe, inicioDoGrupo, naoLidasGrupo, nomeDoDia,
  ordemDoPerfil, PROPORCAO, recorte, resumo, SEM_AJUSTE, semMudanca, somar, STORY_MS, tempoCurto,
  type Ajustes, type Formato, type Grupo, type Mensagem, type Story,
} from "./insta";
import { Camera, temCamera } from "./Camera";
import { apagarRascunho, listarRascunhos, salvarRascunho, type Rascunho } from "./rascunhos";
import type { FigSemLugar } from "./storyEditor";
import { AudioMsg, Carrossel, FigurinhaVisual, FolhaGente, lugarDaFigurinha, podeGravar, SugestoesMencao, TextoRico, useAtivo, useGravador } from "./InstaPartes";
import {
  abrirCelular, abrirConversa, alternarProximo, apagarComentario, apagarDestaque, apagarMensagem, apagarPost, apagarStory, arroba, avisarDigitando, buscarPost,
  buscarPosts, carregarAtividade, carregarDestaques, carregarRede, comentar, curtir, curtirComentario, destacar, editarPost, enviarMensagem, fecharCelular,
  iniciarRede, lerQuemViu, maisDoPerfil, marcarVisto, maisPostagens, postar, postCarregado, postsSalvos, reagirMensagem, salvar, salvarBio, salvarNota,
  storyPorId, tirarDoDestaque, tocarIlha, useRede, verPerfil, type Comentario, type Destaque, type ItemAtividade, type Post,
  abrirUnica, aceitarColab, adicionarAoGrupo, arquivarPost, carregarArquivo, CONVITE_COLAB, criarGrupo, fixarComentario, fixarPost, marcarPostVisto,
  MENCAO_STORY, mudarComentarios, mudarCurtidas, renomearGrupo, sairDoGrupo, silenciar, type GrupoDM,
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
const IcSalvar = ({ cheio }: { cheio?: boolean }) => <Ic cheio={cheio} d={<path d="M19 21 12 15.5 5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5Z" />} />;
const IcPessoa = () => <Ic tam={20} d={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>} />;
const IcVarias = () => <Ic tam={18} cheio d={<><rect x="7" y="7" width="14" height="14" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" fill="none" /></>} />;
const IcMenu = () => <Ic d={<path d="M4 6h16M4 12h16M4 18h16" />} />;
const IcMic = () => <Ic d={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>} />;
const IcPontos = () => <Ic d={<><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>} />;
const IcX = () => <Ic d={<path d="M5 5l14 14M19 5 5 19" />} />;
const IcVoltar = () => <Ic d={<path d="M15 4 7 12l8 8" />} />;
const IcOlho = () => <Ic tam={18} d={<><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" /><circle cx="12" cy="12" r="3" /></>} />;
const IcGrade = () => <Ic tam={20} d={<><rect x="3" y="3" width="18" height="18" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>} />;
const IcCaneta = () => <Ic d={<><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 3 3" /></>} />;
const IcFoto = () => <Ic d={<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>} />;

/* ---------- pedaços comuns ---------- */
/* o endereço de uma foto escolhida: um só por arquivo (apagar cedo demais deixava a foto em branco quando a tela
   montava de novo); são poucas fotos por vez e somem quando o arquivo sai da memória */
const urls = new WeakMap<Blob, string>();
function urlDoArquivo(b: Blob) {
  let u = urls.get(b);
  if (!u) {
    u = URL.createObjectURL(b);
    urls.set(b, u);
  }
  return u;
}
let vezesStory = 0;
/** A hora de agora (fora do desenho da tela, para os cliques). */
const agoraMs = () => Date.now();
/* listas vazias fixas: ler "nada" do estado não pode criar uma lista nova a cada desenho (o React entra em laço) */
const NADA: string[] = [];
const NADA_C: Comentario[] = [];
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
function RostoAnel({ userId, tam = 32, anel = "nenhum", onClick, rotulo }: { userId: string; tam?: number; anel?: "novo" | "visto" | "nenhum" | "proximo"; onClick?: () => void; rotulo?: string }) {
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
  /** abre uma publicação pelo id (busca se não estiver carregada) */
  abrirPostId: (id: number) => void;
  /** abre o editor de story com esta publicação (o "Adicionar ao seu story") */
  storyDoPost: (p: Post) => void;
  /** vê os stories de um destaque */
  verDestaque: (d: Destaque) => void;
  /** abre o editor de story com uma figurinha pronta (repostar um story, "Adicione o seu") */
  storyCom: (fig: FigSemLugar) => void;
  /** abre um story pelo id (o do repost, o da corrente) */
  verStoryId: (id: number) => void;
  /** tema claro do app */
  claro: boolean;
  mudarTema: (claro: boolean) => void;
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
          <RostoAnel userId={g.userId} tam={66} anel={g.todosVistos ? "visto" : g.stories.some((s) => s.soProximos) ? "proximo" : "novo"} onClick={() => nav.verStories(g.userId)} />
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
/** Fecha um menu ao tocar fora dele. */
function useForaFecha(aberto: boolean, fechar: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && fechar();
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto, fechar, ref]);
}

function PostInsta({ p, nav }: { p: Post; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(p.userId);
  const curtidas = useRede((s) => s.curtidas[p.id] ?? NADA);
  const comentarios = useRede((s) => s.comentarios[p.id] ?? NADA_C);
  const salvo = useRede((s) => s.salvos.includes(p.id));
  const agora = useAgora();
  const temStory = useRede((s) => s.stories.some((x) => x.userId === p.userId && agora - x.em < DIA_MS));
  const primeiro = useNome(curtidas.find((u) => u !== eu) ?? curtidas[0]);
  const [coracao, setCoracao] = useState(0);
  const [menu, setMenu] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [verMarcados, setVerMarcados] = useState(false);
  const [legendaToda, setLegendaToda] = useState(false);
  const { sure, pedir } = useSure(3000);
  const ultimoToque = useRef(0);
  const caixaMenu = useRef<HTMLDivElement>(null);
  const fecharMenu = useMemo(() => () => setMenu(false), []);
  useForaFecha(menu, fecharMenu, caixaMenu);
  const curti = !!eu && curtidas.includes(eu);
  const fotos = p.midia ? [p.midia, ...p.fotos] : [];
  const friends = useApp((s) => s.friends);
  const nomesMarcados = useMemo(() => p.marcados.map((u) => friends.find((x) => x.user_id === u)).filter((x) => !!x), [p.marcados, friends]);
  const meu = p.userId === eu;
  const colab = useNome(p.colabAceito ? p.colaborador : null);
  const vistos = useRede((s) => s.visualizacoes[p.id]);
  const [silenciando, setSilenciando] = useState(false);
  /* conta como vista depois de 1 s com a maior parte na tela (só para o dono saber quantos viram) */
  const caixaPost = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = caixaPost.current;
    if (!el || meu || typeof IntersectionObserver === "undefined") return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        clearTimeout(t);
        if (e.isIntersecting) t = setTimeout(() => marcarPostVisto(p), 1000);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      clearTimeout(t);
      io.disconnect();
    };
  }, [p, meu]);

  /* dois toques na foto curtem (como no app), com o coração grande; um toque mostra quem está marcado */
  const tocarFoto = () => {
    const t = Date.now();
    if (t - ultimoToque.current < 320) {
      void curtir(p, "curtir");
      setCoracao((c) => c + 1);
    } else if (p.marcados.length) setTimeout(() => Date.now() - ultimoToque.current >= 300 && setVerMarcados((v) => !v), 330);
    ultimoToque.current = t;
  };
  const legendaLonga = p.texto.length > 120 && !legendaToda;

  return (
    <article ref={caixaPost} className="ig-post">
      <header className="ig-post-topo">
        <RostoAnel userId={p.userId} tam={34} anel={temStory ? "novo" : "nenhum"} onClick={() => (temStory ? nav.verStories(p.userId) : nav.perfil(p.userId))} />
        <button type="button" className="ig-sem-botao ig-user" onClick={() => nav.perfil(p.userId)}>
          {arroba(f?.name)}
        </button>
        {colab && (
          <>
            <span className="ig-cinza">e</span>
            <button type="button" className="ig-sem-botao ig-user" onClick={() => nav.perfil(colab.user_id!)}>
              {arroba(colab.name)}
            </button>
          </>
        )}
        <small className="ig-cinza">· {tempoCurto(p.em, agora)}</small>
        <div ref={caixaMenu} className="ig-pontos-caixa">
          <button type="button" className="ig-sem-botao ig-pontos" aria-label="Opções" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <IcPontos />
          </button>
          {menu && (
            <div className="ig-menu" role="menu">
              {meu && (
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setEditando(p.texto); }}>
                  Editar
                </button>
              )}
              {meu && (
                <button type="button" role="menuitem" onClick={() => { setMenu(false); void fixarPost(p, !p.fixadoEm); }}>
                  {p.fixadoEm ? "Desafixar do perfil" : "Fixar no perfil"}
                </button>
              )}
              {meu && (
                <button type="button" role="menuitem" onClick={() => { setMenu(false); void arquivarPost(p, !p.arquivado); }}>
                  {p.arquivado ? "Mostrar no perfil" : "Arquivar"}
                </button>
              )}
              {meu && (
                <button type="button" role="menuitem" onClick={() => { setMenu(false); void mudarCurtidas(p, !p.esconderCurtidas); }}>
                  {p.esconderCurtidas ? "Mostrar o número de curtidas" : "Ocultar o número de curtidas"}
                </button>
              )}
              {meu && (
                <button type="button" role="menuitem" onClick={() => { setMenu(false); void mudarComentarios(p, !p.semComentarios); }}>
                  {p.semComentarios ? "Ativar os comentários" : "Desativar os comentários"}
                </button>
              )}
              {!meu && (
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setSilenciando(true); }}>
                  Silenciar {arroba(f?.name)}
                </button>
              )}
              {p.userId === eu && (
                <button type="button" role="menuitem" className={"ig-perigo" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarPost(p)}>
                  {sure ? "Toque de novo para apagar" : "Apagar"}
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => { setMenu(false); void salvar(p); }}>
                {salvo ? "Tirar dos salvos" : "Salvar"}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); nav.storyDoPost(p); }}>
                Adicionar ao seu story
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); nav.perfil(p.userId); }}>
                Ver perfil
              </button>
              <button type="button" role="menuitem" onClick={() => setMenu(false)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="ig-midia" onClick={tocarFoto}>
        {fotos.length > 1 ? (
          <Carrossel fotos={fotos} alt={p.texto.slice(0, 80) || `Foto de ${f?.name ?? "alguém"}`} />
        ) : p.midia ? (
          <Imagem caminho={p.midia} alt={p.texto.slice(0, 80) || `Foto de ${f?.name ?? "alguém"}`} />
        ) : (
          <div className="ig-post-texto">{p.texto}</div>
        )}
        {p.marcados.length > 0 && (
          <span className="ig-marcados-icone" aria-label={`${p.marcados.length} marcados`} role="img">
            <IcPessoa />
          </span>
        )}
        {verMarcados && (
          <div className="ig-marcados" onClick={(e) => e.stopPropagation()}>
            {nomesMarcados.map((x) => (
              <button key={x.id} type="button" className="ig-marcado" onClick={() => nav.perfil(x.user_id!)}>
                {arroba(x.name)}
              </button>
            ))}
          </div>
        )}
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
        {!p.semComentarios && (
          <button type="button" className="ig-sem-botao" aria-label="Comentar" onClick={() => nav.comentarios(p)}>
            <IcBalao />
          </button>
        )}
        <button type="button" className="ig-sem-botao" aria-label="Enviar para um nanico" onClick={() => nav.compartilhar(p)}>
          <IcAviao />
        </button>
        <span className="ig-espaco" />
        <button type="button" className={"ig-sem-botao" + (salvo ? " ig-salvo" : "")} aria-pressed={salvo} aria-label={salvo ? "Tirar dos salvos" : "Salvar"} onClick={() => void salvar(p)}>
          <IcSalvar cheio={salvo} />
        </button>
      </div>
      {curtidas.length > 0 && (
        <p className="ig-curtidas">
          {/* curtidas escondidas: os outros só veem quem curtiu, sem o número (o dono vê tudo) */}
          {p.esconderCurtidas && !meu ? (
            <>
              Curtido por <b>{arroba(primeiro?.name)}</b>
              {curtidas.length > 1 && <> e <b>outras pessoas</b></>}
            </>
          ) : curtidas.length === 1 ? (
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
      {editando !== null ? (
        <form
          className="ig-editar"
          onSubmit={(e) => {
            e.preventDefault();
            void editarPost(p, editando).then((ok) => ok && setEditando(null));
          }}
        >
          <textarea aria-label="Legenda" maxLength={500} rows={3} value={editando} onChange={(e) => setEditando(e.target.value)} autoFocus />
          <SugestoesMencao texto={editando} mudar={setEditando} />
          <span className="ig-editar-bts">
            <button type="button" className="ig-sem-botao ig-cinza" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button type="submit" className="ig-sem-botao ig-azul" disabled={!editando.trim() && !p.midia}>
              Concluir
            </button>
          </span>
        </form>
      ) : (
        p.midia &&
        p.texto && (
          <p className="ig-legenda">
            <b>{arroba(f?.name)}</b> <TextoRico texto={legendaLonga ? p.texto.slice(0, 110) + "…" : p.texto} abrirPerfil={nav.perfil} />
            {legendaLonga && (
              <button type="button" className="ig-sem-botao ig-cinza" onClick={() => setLegendaToda(true)}>
                {" "}mais
              </button>
            )}
          </p>
        )
      )}
      {p.editadoEm && <small className="ig-cinza ig-editado">Editado</small>}
      {meu && vistos !== undefined && (
        <small className="ig-cinza ig-vistos-post">
          <IcOlho /> {vistos === 1 ? "1 visualização" : `${vistos} visualizações`}
        </small>
      )}
      {p.semComentarios ? (
        <small className="ig-cinza ig-sem-coments">Os comentários estão desativados.</small>
      ) : (
        <>
          {comentarios.length > 0 && (
            <button type="button" className="ig-sem-botao ig-ver-coments" onClick={() => nav.comentarios(p)}>
              {comentarios.length === 1 ? "Ver 1 comentário" : `Ver todos os ${comentarios.length} comentários`}
            </button>
          )}
          <button type="button" className="ig-sem-botao ig-add-coment" onClick={() => nav.comentarios(p)}>
            {eu && <RostoAnel userId={eu} tam={22} />} Adicione um comentário…
          </button>
        </>
      )}
      {silenciando && <FolhaSilenciar userId={p.userId} fechar={() => setSilenciando(false)} />}
    </article>
  );
}

/** Silenciar alguém: os posts e/ou os stories dele somem do meu feed (ele não fica sabendo). */
function FolhaSilenciar({ userId, fechar }: { userId: string; fechar: () => void }) {
  const f = useNome(userId);
  const atual = useRede((s) => s.silenciados[userId]);
  const posts = !!atual?.posts, stories = !!atual?.stories;
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label={`Silenciar ${f?.name ?? ""}`}>
        <span className="ig-alca" aria-hidden="true" />
        <h3>Silenciar {arroba(f?.name)}</h3>
        <p className="ig-folha-dica ig-cinza">Ele não fica sabendo. Dá para desfazer a qualquer hora no perfil dele.</p>
        <div className="ig-avancadas">
          <label className="ig-chave">
            <span>Publicações</span>
            <input type="checkbox" checked={posts} onChange={(e) => void silenciar(userId, { posts: e.target.checked, stories })} />
          </label>
          <label className="ig-chave">
            <span>Stories</span>
            <input type="checkbox" checked={stories} onChange={(e) => void silenciar(userId, { posts, stories: e.target.checked })} />
          </label>
        </div>
        <div className="ig-comp-pe">
          <button type="button" className="ig-botao-azul" onClick={fechar}>
            Concluir
          </button>
        </div>
      </section>
    </div>
  );
}

/* ---------- comentários (folha que sobe): fios de respostas e curtidas, como no Instagram ---------- */
function LinhaComentario({ c, responder, abrirPerfil, filho, fixado, fixar }: { c: Comentario; responder: (c: Comentario) => void; abrirPerfil: (u: string) => void; filho?: boolean; fixado?: boolean; fixar?: () => void }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(c.userId);
  const agora = useAgora();
  const curtidas = useRede((s) => s.comCurtidas[c.id] ?? NADA);
  const curti = !!eu && curtidas.includes(eu);
  const { sure, pedir } = useSure(3000);
  return (
    <li className={filho ? "filho" : undefined}>
      <RostoAnel userId={c.userId} tam={filho ? 26 : 32} onClick={() => abrirPerfil(c.userId)} />
      <div>
        {fixado && <small className="ig-cinza ig-fixado">📌 Fixado pelo autor</small>}
        <p>
          <b>{arroba(f?.name)}</b> <small className="ig-cinza">{tempoCurto(c.em, agora)}</small>
        </p>
        <p>
          <TextoRico texto={c.texto} abrirPerfil={abrirPerfil} />
        </p>
        <span className="ig-coment-acoes">
          {curtidas.length > 0 && <small className="ig-cinza">{curtidas.length === 1 ? "1 curtida" : `${curtidas.length} curtidas`}</small>}
          <button type="button" className="ig-sem-botao ig-cinza ig-pequeno" onClick={() => responder(c)}>
            Responder
          </button>
          {fixar && (
            <button type="button" className="ig-sem-botao ig-cinza ig-pequeno" onClick={fixar}>
              {fixado ? "Desafixar" : "Fixar"}
            </button>
          )}
          {c.userId === eu && (
            <button type="button" className={"ig-sem-botao ig-cinza ig-pequeno" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarComentario(c)}>
              {sure ? "Toque de novo para apagar" : "Apagar"}
            </button>
          )}
        </span>
      </div>
      <button type="button" className={"ig-sem-botao ig-coment-curtir" + (curti ? " on" : "")} aria-pressed={curti} aria-label={curti ? "Descurtir o comentário" : "Curtir o comentário"} onClick={() => void curtirComentario(c)}>
        <IcCoracao cheio={curti} tam={14} />
      </button>
    </li>
  );
}
function FolhaComentarios({ p: p0, fechar, abrirPerfil }: { p: Post; fechar: () => void; abrirPerfil: (u: string) => void }) {
  const eu = useApp((s) => s.myUid);
  /* a publicação mais nova (fixar um comentário muda ela) */
  const p = useRede((s) => s.posts.find((x) => x.id === p0.id) ?? s.perfilPosts.find((x) => x.id === p0.id) ?? s.avulsos[p0.id]) ?? p0;
  const lista = useRede((s) => s.comentarios[p.id] ?? NADA_C);
  const [texto, setTexto] = useState("");
  const [resposta, setResposta] = useState<Comentario | null>(null);
  const [abertos, setAbertos] = useState<number[]>([]);
  const campo = useRef<HTMLInputElement>(null);
  const nomeResp = useNome(resposta?.userId);
  const meuPost = p.userId === eu;
  /* o comentário fixado vai para o topo */
  const pais = lista.filter((c) => !c.respostaA || !lista.some((x) => x.id === c.respostaA)).sort((a, b) => Number(b.id === p.comentarioFixo) - Number(a.id === p.comentarioFixo));
  const filhos = (id: number) => lista.filter((c) => c.respostaA === id);
  const responder = (c: Comentario) => {
    const pai = c.respostaA && lista.some((x) => x.id === c.respostaA) ? lista.find((x) => x.id === c.respostaA)! : c;
    setResposta(pai);
    setAbertos((a) => (a.includes(pai.id) ? a : [...a, pai.id]));
    const at = arroba(useApp.getState().friends.find((x) => x.user_id === c.userId)?.name);
    setTexto((t) => (t.startsWith(`@${at}`) ? t : `@${at} ${t}`));
    campo.current?.focus();
  };
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label="Comentários">
        <span className="ig-alca" aria-hidden="true" />
        <h3>Comentários</h3>
        <ul className="ig-coments">
          {pais.length ? (
            pais.map((c) => {
              const fs = filhos(c.id);
              const aberto = abertos.includes(c.id);
              return (
                <li key={c.id} className="ig-fio">
                  <ul>
                    <LinhaComentario c={c} responder={responder} abrirPerfil={abrirPerfil} fixado={c.id === p.comentarioFixo} fixar={meuPost ? () => void fixarComentario(p, c.id === p.comentarioFixo ? null : c) : undefined} />
                    {fs.length > 0 && (
                      <li className="ig-ver-respostas">
                        <button type="button" className="ig-sem-botao ig-cinza ig-pequeno" onClick={() => setAbertos((a) => (aberto ? a.filter((x) => x !== c.id) : [...a, c.id]))}>
                          <i aria-hidden="true" /> {aberto ? "Ocultar respostas" : fs.length === 1 ? "Ver 1 resposta" : `Ver ${fs.length} respostas`}
                        </button>
                      </li>
                    )}
                    {aberto && fs.map((x) => <LinhaComentario key={x.id} c={x} responder={responder} abrirPerfil={abrirPerfil} filho />)}
                  </ul>
                </li>
              );
            })
          ) : (
            <li className="ig-vazio">Ainda não há comentários. Comece a conversa.</li>
          )}
        </ul>
        {resposta && (
          <div className="ig-respondendo">
            <span className="ig-cinza">Respondendo a {arroba(nomeResp?.name)}</span>
            <button type="button" className="ig-sem-botao ig-cinza" aria-label="Parar de responder" onClick={() => (setResposta(null), setTexto(""))}>
              ✕
            </button>
          </div>
        )}
        {p.semComentarios ? (
          <p className="ig-folha-dica ig-cinza ig-sem-coments-folha">Os comentários estão desativados nesta publicação.</p>
        ) : (
        <div className="ig-comentar-caixa">
          <SugestoesMencao texto={texto} mudar={setTexto} />
          <form
            className="ig-comentar"
            onSubmit={(e) => {
              e.preventDefault();
              void comentar(p, texto, resposta?.id ?? null).then((ok) => {
                if (!ok) return;
                setTexto("");
                setResposta(null);
              });
            }}
          >
            {eu && <RostoAnel userId={eu} tam={32} />}
            <input ref={campo} aria-label="Adicione um comentário" maxLength={280} placeholder="Adicione um comentário…" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <button type="submit" className="ig-sem-botao ig-azul" disabled={!texto.trim()}>
              Publicar
            </button>
          </form>
        </div>
        )}
      </section>
    </div>
  );
}

/* ---------- telas ---------- */
function Feed({ grupos, nav, abrirCriador, rolagem }: { grupos: Grupo[]; nav: Nav; abrirCriador: () => void; rolagem: React.RefObject<HTMLDivElement | null> }) {
  const todos = useRede((s) => s.posts);
  const silenciados = useRede((s) => s.silenciados);
  /* as publicações de quem eu silenciei não aparecem no feed */
  const posts = useMemo(() => todos.filter((p) => !silenciados[p.userId]?.posts), [todos, silenciados]);
  const fim = useRede((s) => s.fim);
  const carregando = useRede((s) => s.carregando);
  const novas = useRede((s) => s.novas);
  const [longe, setLonge] = useState(false);
  /* "Novas publicações" aparece só para quem já desceu no feed; no alto, as novas já estão à vista */
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const ler = () => {
      const l = el.scrollTop > 400;
      setLonge(l);
      if (!l && useRede.getState().novas) useRede.setState({ novas: 0 });
    };
    ler();
    el.addEventListener("scroll", ler, { passive: true });
    return () => el.removeEventListener("scroll", ler);
  }, [rolagem]);
  return (
    <>
      <header className="ig-topo">
        {/* no celular de verdade não tem a moldura nem o fundo para tocar: o X fecha */}
        <button type="button" className="ig-sem-botao ig-sair" aria-label="Fechar o celular" onClick={fecharCelular}>
          <IcX />
        </button>
        <Logo />
        <span className="ig-espaco" />
        <button type="button" className="ig-sem-botao" aria-label="Atividade" onClick={() => nav.ir("atividade")}>
          <IcCoracao />
        </button>
        <BotaoDirect nav={nav} />
      </header>
      {novas > 0 && longe && (
        <button
          type="button"
          className="ig-novas"
          onClick={() => {
            rolagem.current?.scrollTo({ top: 0, behavior: "smooth" });
            useRede.setState({ novas: 0 });
          }}
        >
          ↑ {novas === 1 ? "Nova publicação" : `${novas} novas publicações`}
        </button>
      )}
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
      {p.fotos.length > 0 && (
        <span className="ig-quadrado-varias" aria-label="Várias fotos" role="img">
          <IcVarias />
        </span>
      )}
      {p.fixadoEm && (
        <span className="ig-quadrado-fixado" aria-label="Fixada" role="img">
          📌
        </span>
      )}
    </button>
  );
}

/* pesquisas recentes do Explorar (só neste aparelho): pessoas abertas e palavras procuradas */
type Recente = { t: "p"; id: string } | { t: "q"; v: string };
const lerRecentes = (): Recente[] => {
  const v = local.json<unknown[]>("insta-recentes");
  return Array.isArray(v)
    ? v.filter((x): x is Recente => !!x && typeof x === "object" && (((x as Recente).t === "p" && typeof (x as { id?: unknown }).id === "string") || ((x as Recente).t === "q" && typeof (x as { v?: unknown }).v === "string"))).slice(0, 12)
    : [];
};
function lembrarRecente(r: Recente) {
  const igual = (a: Recente) => (a.t === "p" && r.t === "p" ? a.id === r.id : a.t === "q" && r.t === "q" ? a.v === r.v : false);
  local.setJson("insta-recentes", [r, ...lerRecentes().filter((x) => !igual(x))].slice(0, 12));
}
function Explorar({ nav }: { nav: Nav }) {
  const posts = useRede((s) => s.posts);
  const [busca, setBusca] = useState("");
  const [foco, setFoco] = useState(false);
  const [recentes, setRecentes] = useState<Recente[]>(lerRecentes);
  const friendsR = useApp((s) => s.friends);
  const abrirPessoa = (id: string) => {
    lembrarRecente({ t: "p", id });
    setRecentes(lerRecentes());
    nav.perfil(id);
  };
  const [achadosPosts, setAchadosPosts] = useState<Post[] | null>(null);
  const friends = useApp((s) => s.friends);
  const achados = busca.trim() ? friends.filter((f) => f.user_id && (arroba(f.name).includes(arroba(busca)) || f.name.toLowerCase().includes(busca.trim().toLowerCase()))) : [];
  /* também procura nas legendas (espera parar de digitar) */
  useEffect(() => {
    const t = busca.trim();
    if (t.length < 2) return;
    const id = setTimeout(() => void buscarPosts(t).then(setAchadosPosts), 350);
    return () => clearTimeout(id);
  }, [busca]);
  const postsAchados = busca.trim().length >= 2 ? achadosPosts : null;
  const comFoto = posts.filter((p) => p.midia);
  return (
    <>
      <div className="ig-busca">
        <IcLupa />
        <input
          aria-label="Pesquisar"
          placeholder="Pesquisar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => {
            setTimeout(() => setFoco(false), 200);
            if (busca.trim().length >= 2) {
              lembrarRecente({ t: "q", v: busca.trim().slice(0, 40) });
              setRecentes(lerRecentes());
            }
          }}
        />
      </div>
      {!busca.trim() && foco && recentes.length > 0 ? (
        <>
          <p className="ig-secao ig-secao-linha">
            Recentes
            <button type="button" className="ig-sem-botao ig-azul ig-pequeno" onPointerDown={(e) => e.preventDefault()} onClick={() => (local.setJson("insta-recentes", []), setRecentes([]))}>
              Limpar tudo
            </button>
          </p>
          <ul className="ig-lista-gente">
            {recentes.map((r) => {
              const f = r.t === "p" ? friendsR.find((x) => x.user_id === r.id) : null;
              if (r.t === "p" && !f) return null;
              return (
                <li key={r.t === "p" ? r.id : "q" + r.v}>
                  <button type="button" className="ig-sem-botao" onPointerDown={(e) => e.preventDefault()} onClick={() => (r.t === "p" ? abrirPessoa(r.id) : setBusca(r.v))}>
                    {r.t === "p" ? <RostoAnel userId={r.id} tam={44} /> : <span className="ig-recente-lupa"><IcLupa /></span>}
                    <span>
                      <b>{r.t === "p" ? arroba(f?.name) : r.v}</b>
                      {r.t === "p" && <small className="ig-cinza">{f?.name}</small>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ig-sem-botao ig-cinza ig-recente-tirar"
                    aria-label="Tirar das recentes"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      local.setJson("insta-recentes", recentes.filter((x) => x !== r));
                      setRecentes(lerRecentes());
                    }}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : busca.trim() ? (
        <>
          {achados.length > 0 && (
            <ul className="ig-lista-gente">
              {achados.map((f) => (
                <li key={f.id}>
                  <button type="button" className="ig-sem-botao" onClick={() => abrirPessoa(f.user_id!)}>
                    <RostoAnel userId={f.user_id!} tam={44} />
                    <span>
                      <b>{arroba(f.name)}</b>
                      <small className="ig-cinza">{f.name}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {postsAchados && postsAchados.length > 0 && (
            <>
              <p className="ig-secao">Publicações</p>
              <div className="ig-grade">
                {postsAchados.map((p) => (
                  <Quadrado key={p.id} p={p} onClick={() => nav.abrirPost(p)} />
                ))}
              </div>
            </>
          )}
          {!achados.length && postsAchados?.length === 0 && <p className="ig-vazio">Nada encontrado para “{busca.trim()}”.</p>}
        </>
      ) : (
        /* a grade do Explorar: de vez em quando um quadro grande, como no Instagram */
        <div className="ig-grade explorar">
          {(comFoto.length ? comFoto : posts).map((p) => (
            <Quadrado key={p.id} p={p} onClick={() => nav.abrirPost(p)} />
          ))}
        </div>
      )}
    </>
  );
}

const TEXTO_ATIVIDADE: Record<ItemAtividade["tipo"], string> = {
  curtiu: "curtiu sua publicação.",
  comentou: "comentou:",
  respondeu: "respondeu seu comentário:",
  "curtiu-comentario": "curtiu seu comentário.",
  marcou: "marcou você numa publicação.",
  mencionou: "mencionou você num comentário:",
  story: "respondeu ao seu story:",
};
function Atividade({ nav }: { nav: Nav }) {
  const itens = useRede((s) => s.atividade);
  const [carregou, setCarregou] = useState(false);
  useEffect(() => {
    void carregarAtividade().then(() => setCarregou(true));
  }, []);
  const agora = useAgora();
  const hoje = itens.filter((x) => agora - x.em < DIA_MS);
  const semana = itens.filter((x) => agora - x.em >= DIA_MS && agora - x.em < 7 * DIA_MS);
  const antes = itens.filter((x) => agora - x.em >= 7 * DIA_MS);
  const grupo = (titulo: string, l: ItemAtividade[]) =>
    l.length > 0 && (
      <>
        <li className="ig-secao">{titulo}</li>
        {l.map((x) => (
          <ItemAtividadeLinha key={x.chave} x={x} nav={nav} />
        ))}
      </>
    );
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
          <>
            {grupo("Hoje", hoje)}
            {grupo("Esta semana", semana)}
            {grupo("Antes", antes)}
          </>
        ) : (
          <li className="ig-vazio">{carregou ? "Quando alguém curtir, comentar, marcar você ou responder seus stories, aparece aqui." : "Carregando…"}</li>
        )}
      </ul>
    </>
  );
}
function ItemAtividadeLinha({ x, nav }: { x: ItemAtividade; nav: Nav }) {
  const f = useNome(x.userId);
  const agora = useAgora();
  const post = useRede((s) => (x.postId ? (s.posts.find((p) => p.id === x.postId) ?? s.avulsos[x.postId] ?? s.perfilPosts.find((p) => p.id === x.postId)) : undefined));
  useEffect(() => {
    if (x.postId && !postCarregado(x.postId)) void buscarPost(x.postId);
  }, [x.postId]);
  const abrir = () => (x.tipo === "story" ? nav.conversa(x.userId) : x.postId ? nav.abrirPostId(x.postId) : nav.perfil(x.userId));
  return (
    <li>
      <RostoAnel userId={x.userId} tam={44} onClick={() => nav.perfil(x.userId)} />
      <p onClick={abrir}>
        <b>{arroba(f?.name)}</b> {TEXTO_ATIVIDADE[x.tipo]} {x.texto && <TextoRico texto={x.texto.slice(0, 120)} abrirPerfil={nav.perfil} />} <small className="ig-cinza">{tempoCurto(x.em, agora)}</small>
      </p>
      {post && (
        <span className="ig-mini">
          <Quadrado p={post} onClick={() => nav.abrirPost(post)} />
        </span>
      )}
    </li>
  );
}

function Perfil({ userId, nav }: { userId: string; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(userId);
  const posts = useRede((s) => s.perfilPosts);
  const fim = useRede((s) => s.perfilFim);
  const carregando = useRede((s) => s.carregando);
  const info = useRede((s) => s.perfilInfo);
  const marcado = useRede((s) => s.perfilMarcado);
  const salvos = useRede((s) => s.salvos);
  const bio = useRede((s) => s.bios[userId]);
  const destaques = useRede((s) => s.destaques[userId]);
  const curtidas = useRede((s) => s.curtidas);
  const agora = useAgora();
  const temStory = useRede((s) => s.stories.some((x) => x.userId === userId && agora - x.em < DIA_MS));
  const todosLinks = useMidias((s) => s.links);
  const links = useMemo(() => linksDe(todosLinks, f?.id), [todosLinks, f?.id]);
  const midiasOk = useMidias((s) => s.ok);
  const [aba, setAba] = useState<"grade" | "marcados" | "salvos">("grade");
  const [listaSalvos, setListaSalvos] = useState<Post[]>([]);
  const [editarBio, setEditarBio] = useState<string | null>(null);
  const [folha, setFolha] = useState<null | "proximos" | "destaque" | "config" | "arquivo" | "silenciar">(null);
  const silenciado = useRede((s) => s.silenciados[userId]);
  const proximos = useRede((s) => s.proximos);
  const meu = userId === eu;
  useEffect(() => {
    if (midiasOk === null) void carregarMidias();
  }, [midiasOk]);
  useEffect(() => {
    if (aba === "salvos" && meu) void postsSalvos().then(setListaSalvos);
  }, [aba, meu, salvos]);
  const total = info?.total ?? posts.length;
  const recebidas = info?.curtidas ?? posts.reduce((n, p) => n + (curtidas[p.id]?.length ?? 0), 0);
  const lista = aba === "grade" ? ordemDoPerfil(posts.filter((p) => !p.arquivado)) : aba === "marcados" ? marcado : listaSalvos;
  return (
    <>
      <header className="ig-topo">
        {!meu && (
          <button type="button" className="ig-sem-botao" aria-label="Voltar" onClick={() => nav.ir("inicio")}>
            <IcVoltar />
          </button>
        )}
        <b className="ig-titulo">{arroba(f?.name)}</b>
        <span className="ig-espaco" />
        {meu ? (
          <button type="button" className="ig-sem-botao" aria-label="Configurações" onClick={() => setFolha("config")}>
            <IcMenu />
          </button>
        ) : (
          <button type="button" className="ig-sem-botao" aria-label="Mais opções" onClick={() => setFolha("silenciar")}>
            <IcPontos />
          </button>
        )}
      </header>
      {silenciado && !meu && (
        <p className="ig-aviso-silencio ig-cinza">
          Você silenciou {[silenciado.posts && "as publicações", silenciado.stories && "os stories"].filter(Boolean).join(" e ")} de {arroba(f?.name)}.
        </p>
      )}
      <div className="ig-perfil">
        <RostoAnel userId={userId} tam={86} anel={temStory ? "novo" : "nenhum"} onClick={temStory ? () => nav.verStories(userId) : undefined} />
        <dl>
          <div>
            <dt>{total}</dt>
            <dd>publicações</dd>
          </div>
          <div>
            <dt>{recebidas}</dt>
            <dd>curtidas</dd>
          </div>
          <div>
            <dt>{marcado.length}</dt>
            <dd>marcações</dd>
          </div>
        </dl>
      </div>
      <div className="ig-bio">
        <b>{f?.name ?? "Nanico"}</b>
        {bio ? <span className="ig-bio-texto">{bio}</span> : <span className="ig-cinza">Membro do grupo dos nanicos</span>}
        {links.map((l) => (
          <a key={l.tipo} className="ig-bio-link" href={l.url} target="_blank" rel="noopener noreferrer">
            🔗 {l.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
          </a>
        ))}
      </div>
      {f && (
        <div className="ig-perfil-botoes">
          {meu ? (
            <>
              <button type="button" className="ig-botao-cinza" onClick={() => setEditarBio(bio ?? "")}>
                Editar perfil
              </button>
              <button type="button" className="ig-botao-cinza" onClick={() => setFolha("proximos")}>
                Melhores amigos
              </button>
            </>
          ) : (
            /* como no Instagram: do perfil de alguém, direto para a conversa */
            <button type="button" className="ig-botao-cinza" onClick={() => nav.conversa(userId)}>
              Mensagem
            </button>
          )}
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
        </div>
      )}
      {(meu || (destaques && destaques.length > 0)) && (
        <div className="ig-destaques" role="list" aria-label="Destaques">
          {meu && (
            <div className="ig-destaque" role="listitem">
              <button type="button" className="ig-sem-botao ig-destaque-novo" aria-label="Novo destaque" onClick={() => setFolha("destaque")}>
                +
              </button>
              <small>Novo</small>
            </div>
          )}
          {(destaques ?? []).map((d) => (
            <BolinhaDestaque key={d.id} d={d} nav={nav} meu={meu} />
          ))}
        </div>
      )}
      <div className="ig-abas-perfil" role="tablist" aria-label="Publicações">
        <button type="button" role="tab" aria-selected={aba === "grade"} className={aba === "grade" ? "on" : undefined} aria-label="Publicações" onClick={() => setAba("grade")}>
          <IcGrade />
        </button>
        <button type="button" role="tab" aria-selected={aba === "marcados"} className={aba === "marcados" ? "on" : undefined} aria-label="Marcações" onClick={() => setAba("marcados")}>
          <IcPessoa />
        </button>
        {meu && (
          <button type="button" role="tab" aria-selected={aba === "salvos"} className={aba === "salvos" ? "on" : undefined} aria-label="Salvos" onClick={() => setAba("salvos")}>
            <IcSalvar />
          </button>
        )}
      </div>
      <div className="ig-grade">
        {lista.map((p) => (
          <Quadrado key={p.id} p={p} onClick={() => nav.abrirPost(p)} />
        ))}
      </div>
      {!lista.length && <p className="ig-vazio">{aba === "grade" ? "Nenhuma publicação ainda." : aba === "marcados" ? "Ninguém marcou ainda." : "Toque no marcador de uma publicação para salvar aqui. Só você vê."}</p>}
      {aba === "grade" && !fim && posts.length > 0 && (
        <button type="button" className="ig-sem-botao ig-azul ig-mais" disabled={carregando} onClick={() => void maisDoPerfil()}>
          {carregando ? "Carregando…" : "Ver mais publicações"}
        </button>
      )}
      {editarBio !== null && (
        <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && setEditarBio(null)}>
          <section className="ig-folha" aria-label="Editar perfil">
            <span className="ig-alca" aria-hidden="true" />
            <h3>Editar perfil</h3>
            <form
              className="ig-form-bio"
              onSubmit={(e) => {
                e.preventDefault();
                void salvarBio(editarBio).then((ok) => ok && setEditarBio(null));
              }}
            >
              <label>
                <span className="ig-cinza">Bio</span>
                <textarea maxLength={150} rows={4} value={editarBio} onChange={(e) => setEditarBio(e.target.value)} placeholder="Conte um pouco sobre você" />
                <small className="ig-cinza">{editarBio.length}/150</small>
              </label>
              <small className="ig-cinza">Os links (Twitch, YouTube…) vêm da sua ficha.</small>
              <button type="submit" className="ig-botao-azul">
                Salvar
              </button>
            </form>
          </section>
        </div>
      )}
      {folha === "proximos" && (
        <FolhaGente
          titulo="Melhores amigos"
          dica="Só essas pessoas veem os stories que você postar para os melhores amigos (anel verde). Ninguém fica sabendo quem está na lista."
          marcados={proximos}
          mudar={(u) => void alternarProximo(u)}
          fechar={() => setFolha(null)}
        />
      )}
      {folha === "destaque" && <FolhaNovoDestaque fechar={() => setFolha(null)} />}
      {folha === "silenciar" && <FolhaSilenciar userId={userId} fechar={() => setFolha(null)} />}
      {folha === "config" && (
        <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && setFolha(null)}>
          <section className="ig-folha ig-folha-menu" aria-label="Configurações">
            <span className="ig-alca" aria-hidden="true" />
            <h3>Configurações</h3>
            <label className="ig-chave">
              <span>☀️ Tema claro</span>
              <input type="checkbox" checked={nav.claro} onChange={(e) => nav.mudarTema(e.target.checked)} />
            </label>
            <button type="button" className="ig-sem-botao" onClick={() => setFolha("arquivo")}>
              🗂 Arquivo
            </button>
            <button type="button" className="ig-sem-botao" onClick={() => setFolha("proximos")}>
              ★ Melhores amigos
            </button>
            <button type="button" className="ig-sem-botao" onClick={() => setAba("salvos")}>
              🔖 Salvos
            </button>
          </section>
        </div>
      )}
      {folha === "arquivo" && <FolhaArquivo nav={nav} fechar={() => setFolha(null)} />}
    </>
  );
}

/** O Arquivo: as minhas publicações arquivadas (só eu vejo; tocar abre e o ⋯ traz de volta para o perfil). */
function FolhaArquivo({ nav, fechar }: { nav: Nav; fechar: () => void }) {
  const arquivo = useRede((s) => s.arquivo);
  const [carregou, setCarregou] = useState(false);
  useEffect(() => {
    void carregarArquivo().then(() => setCarregou(true));
  }, []);
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label="Arquivo">
        <span className="ig-alca" aria-hidden="true" />
        <h3>Arquivo</h3>
        <p className="ig-folha-dica ig-cinza">Só você vê. Abra uma e toque em ⋯ › Mostrar no perfil para trazer de volta.</p>
        <div className="ig-grade ig-grade-folha">
          {arquivo.map((p) => (
            <Quadrado key={p.id} p={p} onClick={() => (fechar(), nav.abrirPost(p))} />
          ))}
        </div>
        {!arquivo.length && <p className="ig-vazio">{carregou ? "Nada arquivado." : "Carregando…"}</p>}
      </section>
    </div>
  );
}

/** A bolinha de um destaque no perfil (a capa é o primeiro story dele). Segurar no meu apaga. */
function BolinhaDestaque({ d, nav, meu }: { d: Destaque; nav: Nav; meu: boolean }) {
  const capa = useRede((s) => d.stories.map((id) => s.stories.find((x) => x.id === id) ?? s.storiesDestaque[id]).find((x) => !!x));
  const { sure, pedir } = useSure(3000);
  return (
    <div className="ig-destaque" role="listitem">
      <button type="button" className="ig-sem-botao ig-destaque-capa" aria-label={`Destaque ${d.nome}`} disabled={!d.stories.length} onClick={() => nav.verDestaque(d)}>
        {capa?.midia ? <Imagem caminho={capa.midia} alt="" /> : <span className={"f-" + (capa?.fundo ?? "preto")} />}
      </button>
      <small>{d.nome}</small>
      {meu && (
        <button type="button" className={"ig-sem-botao ig-destaque-apagar" + (sure ? " sure" : "")} aria-label={`Apagar o destaque ${d.nome}`} onClick={() => pedir() && void apagarDestaque(d)}>
          {sure ? "Apagar?" : "×"}
        </button>
      )}
    </div>
  );
}

/** Novo destaque: o nome e quais dos meus stories entram (os de hoje e os antigos que ainda guardo). */
function FolhaNovoDestaque({ fechar }: { fechar: () => void }) {
  const eu = useApp((s) => s.myUid);
  const stories = useRede((s) => s.stories);
  const antigos = useRede((s) => s.storiesDestaque);
  const unicos = useMemo(() => {
    const meus = [...stories, ...Object.values(antigos)].filter((x) => x.userId === eu);
    return meus.filter((s, i) => meus.findIndex((x) => x.id === s.id) === i).sort((a, b) => b.em - a.em);
  }, [stories, antigos, eu]);
  const [nome, setNome] = useState("");
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [indo, setIndo] = useState(false);
  const criar = async () => {
    if (!nome.trim() || !escolhidos.length) return;
    setIndo(true);
    const [primeiro, ...resto] = escolhidos;
    const s0 = storyPorId(primeiro);
    if (s0 && (await destacar(s0, { nome }))) {
      const d = (useRede.getState().destaques[eu ?? ""] ?? []).find((x) => x.nome === nome.trim().slice(0, 24) && x.stories.includes(primeiro));
      for (const id of resto) {
        const s = storyPorId(id);
        if (s && d) await destacar(s, { id: d.id });
      }
      fechar();
    }
    setIndo(false);
  };
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label="Novo destaque">
        <span className="ig-alca" aria-hidden="true" />
        <h3>Novo destaque</h3>
        <div className="ig-busca">
          <input aria-label="Nome do destaque" maxLength={24} placeholder="Nome do destaque" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        {unicos.length ? (
          <div className="ig-escolher-stories">
            {unicos.map((s) => {
              const on = escolhidos.includes(s.id);
              return (
                <button key={s.id} type="button" className={"ig-sem-botao ig-story-mini" + (on ? " on" : "")} aria-pressed={on} onClick={() => setEscolhidos((l) => (on ? l.filter((x) => x !== s.id) : [...l, s.id]))}>
                  {s.midia ? <Imagem caminho={s.midia} alt="" /> : <span className={"f-" + s.fundo}>{s.texto}</span>}
                  <i aria-hidden="true">{on ? escolhidos.indexOf(s.id) + 1 : ""}</i>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="ig-vazio">Você não tem stories guardados. Poste um story e depois destaque ele.</p>
        )}
        <div className="ig-comp-pe">
          <button type="button" className="ig-botao-azul" disabled={!nome.trim() || !escolhidos.length || indo} onClick={() => void criar()}>
            {indo ? "Criando…" : "Criar destaque"}
          </button>
        </div>
      </section>
    </div>
  );
}

/* ---------- editor de corte (como no Instagram): arrasta, zoom e formato ---------- */
type Corte = { cortar: () => Promise<File> };
const FORMATOS_POST: Formato[] = ["1:1", "4:5", "1.91:1"];
const NOME_FORMATO: Record<Formato, string> = { "1:1": "Quadrado", "4:5": "Em pé", "1.91:1": "Deitado", "9:16": "Story" };

function Cortador({ arquivo, story, corte, formatoFixo, formatoComeco, aoFormato }: { arquivo: File; story: boolean; corte: Ref<Corte>; formatoFixo?: Formato; formatoComeco?: Formato; aoFormato?: (f: Formato) => void }) {
  /* o endereço da foto é solto quando ela carrega (o corte desenha do <img> já carregado) */
  const url = urlDoArquivo(arquivo);
  const caixa = useRef<HTMLDivElement>(null);
  const foto = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [tam, setTam] = useState<{ W: number; H: number } | null>(null);
  const [formatoProprio, setFormatoProprio] = useState<Formato>(story ? "9:16" : (formatoComeco ?? "1:1"));
  const formato = formatoFixo ?? formatoProprio;
  const setFormato = (f: Formato) => {
    setFormatoProprio(f);
    aoFormato?.(f);
  };
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ dx: 0, dy: 0 });
  const arraste = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const gif = arquivo.type === "image/gif";
  /* filtros e ajustes, como no Instagram (a prévia é CSS; a foto que sobe passa pelas mesmas contas, em ajustarPixels) */
  const [filtro, setFiltro] = useState(FILTROS[0].id);
  const [mao, setMao] = useState<Ajustes>(SEM_AJUSTE);
  const [aba, setAba] = useState<"filtros" | "editar">("filtros");
  const ajuste = somar(FILTROS.find((f) => f.id === filtro)?.a ?? SEM_AJUSTE, mao);

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
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, k.x, k.y, k.largura, k.altura, 0, 0, largura, altura);
        if (!semMudanca(ajuste)) {
          const d = g.getImageData(0, 0, largura, altura);
          ajustarPixels(d.data, ajuste);
          g.putImageData(d, 0, 0);
        }
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
            if (!story && !formatoFixo && !formatoComeco) setFormato(formatoInicial(w, h));
          }}
          style={r && nat ? { width: nat.w * r.escala, height: nat.h * r.escala, transform: `translate(calc(-50% + ${r.dx}px), calc(-50% + ${r.dy}px))`, filter: semMudanca(ajuste) ? undefined : cssDoFiltro(ajuste) } : undefined}
        />
        <span className="ig-corte-grade" aria-hidden="true" />
      </div>
      {!gif && (
        <div className="ig-corte-ctrl">
          {!story && !formatoFixo && (
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
          <div className="ig-abas-folha ig-abas-filtro" role="tablist">
            <button type="button" role="tab" aria-selected={aba === "filtros"} className={aba === "filtros" ? "on" : undefined} onClick={() => setAba("filtros")}>
              Filtros
            </button>
            <button type="button" role="tab" aria-selected={aba === "editar"} className={aba === "editar" ? "on" : undefined} onClick={() => setAba("editar")}>
              Editar
            </button>
          </div>
          {aba === "filtros" ? (
            <div className="ig-filtros" role="radiogroup" aria-label="Filtro">
              {FILTROS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={filtro === f.id} className={filtro === f.id ? "on" : undefined} onClick={() => setFiltro(f.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ filter: cssDoFiltro(somar(f.a, mao)) }} />
                  <small>{f.nome}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="ig-ajustes">
              {([["brilho", "Brilho"], ["contraste", "Contraste"], ["saturacao", "Saturação"]] as const).map(([k, nome]) => (
                <label key={k} className="ig-corte-zoom">
                  <span>{nome}</span>
                  <input type="range" min={0.5} max={1.5} step={0.01} value={mao[k]} aria-label={nome} onChange={(e) => setMao((m) => ({ ...m, [k]: Number(e.target.value) }))} onDoubleClick={() => setMao((m) => ({ ...m, [k]: 1 }))} />
                </label>
              ))}
              <button type="button" className="ig-sem-botao ig-azul ig-pequeno" onClick={() => setMao(SEM_AJUSTE)}>
                Voltar ao original
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- novo post ou story ---------- */
function Novo({ nav, modoInicial, figInicial }: { nav: Nav; modoInicial: "post" | "story"; figInicial?: FigSemLugar | null }) {
  const enviando = useRede((s) => s.enviando);
  const [modo, setModo] = useState<"post" | "story">(modoInicial);
  /* carrossel: até 10 fotos, todas no formato da primeira; cada uma é cortada quando sai da tela */
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [cortadas, setCortadas] = useState<Record<number, File>>({});
  const [atual, setAtual] = useState(0);
  const [formato, setFormato] = useState<Formato | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [marcando, setMarcando] = useState(false);
  /* seção 69: câmera, rascunhos, colaborador e as opções avançadas */
  const [camera, setCamera] = useState(false);
  const [colaborador, setColaborador] = useState<string | null>(null);
  const [escolhendoColab, setEscolhendoColab] = useState(false);
  const [semComentarios, setSemComentarios] = useState(false);
  const [esconderCurtidas, setEsconderCurtidas] = useState(false);
  const [avancadas, setAvancadas] = useState(false);
  const [rascunhos, setRascunhos] = useState<Rascunho[] | null>(null);
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [perguntaSair, setPerguntaSair] = useState(false);
  const nomeColab = useNome(colaborador);
  const input = useRef<HTMLInputElement>(null);
  const corte = useRef<Corte | null>(null);
  useEffect(() => {
    void listarRascunhos().then(setRascunhos);
  }, []);
  /* o story tem o editor dele, como no Instagram (texto, desenho, figurinhas) */
  if (modo === "story") return <EditorStory fechar={() => nav.ir("inicio")} postou={() => nav.ir("inicio")} irParaPost={figInicial ? undefined : () => setModo("post")} figInicial={figInicial ?? null} />;
  const temAlgo = arquivos.length > 0 || !!texto.trim();
  const sair = () => (temAlgo ? setPerguntaSair(true) : nav.ir("inicio"));
  const guardarRascunho = async () => {
    const prontas = await guardarAtual();
    const em = agoraMs();
    const ok = await salvarRascunho({ id: rascunhoId ?? String(em), texto, marcados, fotos: arquivos.map((a, i) => prontas[i] ?? a), em });
    toast(ok ? "Rascunho salvo neste aparelho" : "Este navegador não deixou salvar o rascunho.");
    nav.ir("inicio");
  };
  const abrirRascunho = (r: Rascunho) => {
    setArquivos(r.fotos.map((b, i) => new File([b], `rascunho-${i}.webp`, { type: b.type || "image/webp" })));
    setCortadas({});
    setAtual(0);
    setTexto(r.texto);
    setMarcados(r.marcados);
    setRascunhoId(r.id);
    setRascunhos(null);
  };
  const guardarAtual = async () => {
    const arq = arquivos[atual];
    if (!arq || !corte.current) return cortadas;
    const c = await corte.current.cortar();
    const novas = { ...cortadas, [atual]: c };
    setCortadas(novas);
    return novas;
  };
  const irPara = async (i: number) => {
    if (i === atual) return;
    await guardarAtual();
    setAtual(i);
  };
  const escolher = (lista: FileList | null) => {
    const novos = [...(lista ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, 10 - arquivos.length);
    if (!novos.length) return;
    if (arquivos.length + novos.length > 10) toast("No máximo 10 fotos.");
    setArquivos((l) => [...l, ...novos]);
  };
  const tirar = (i: number) => {
    setArquivos((l) => l.filter((_, k) => k !== i));
    setCortadas((c) => Object.fromEntries(Object.entries(c).filter(([k]) => Number(k) !== i).map(([k, v]) => [Number(k) > i ? Number(k) - 1 : Number(k), v])));
    setAtual((a) => Math.max(0, a >= i ? a - 1 : a));
    if (arquivos.length <= 1) setFormato(undefined);
  };
  const publicar = async () => {
    /* as fotos sobem já cortadas no formato escolhido */
    const prontas = await guardarAtual();
    const fotos = arquivos.map((a, i) => prontas[i] ?? a);
    if (await postar(texto, fotos, marcados, { colaborador, semComentarios, esconderCurtidas })) {
      if (rascunhoId) void apagarRascunho(rascunhoId);
      nav.ir("inicio");
    }
  };
  const arquivo = arquivos[atual];
  return (
    <div className="ig-novo post">
      <header className="ig-topo">
        <button type="button" className="ig-sem-botao" aria-label="Cancelar" onClick={sair}>
          <IcX />
        </button>
        <b className="ig-titulo">Nova publicação</b>
        <span className="ig-espaco" />
        <button type="button" className="ig-sem-botao ig-azul" disabled={enviando || (!arquivos.length && !texto.trim())} onClick={() => void publicar()}>
          {enviando ? "Enviando…" : "Compartilhar"}
        </button>
      </header>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => (escolher(e.target.files), (e.target.value = ""))} />
      {arquivo ? (
        <Cortador key={arquivo.name + arquivo.size + atual} arquivo={arquivo} story={false} corte={corte} formatoFixo={atual > 0 ? formato : undefined} formatoComeco={formato} aoFormato={setFormato} />
      ) : (
        <>
          <div className="ig-novo-previa" onClick={() => input.current?.click()}>
            <span className="ig-novo-vazio">
              <IcFoto />
              Toque para escolher fotos (até 10)
            </span>
          </div>
          <div className="ig-novo-atalhos">
            {temCamera() && (
              <button type="button" className="ig-botao-cinza" onClick={() => setCamera(true)}>
                📷 Câmera
              </button>
            )}
          </div>
          {!!rascunhos?.length && <p className="ig-secao">Rascunhos</p>}
          {!!rascunhos?.length && (
            <div className="ig-rascunhos" role="list" aria-label="Rascunhos">
              {rascunhos.map((r) => (
                <span key={r.id} className="ig-rascunho" role="listitem">
                  <button type="button" className="ig-sem-botao" aria-label="Continuar o rascunho" onClick={() => abrirRascunho(r)}>
                    {r.fotos[0] ? <MiniArquivo arquivo={r.fotos[0]} /> : <span className="ig-quadrado-texto">{r.texto.slice(0, 40)}</span>}
                  </button>
                  <button type="button" className="ig-sem-botao ig-novo-tirar" aria-label="Apagar o rascunho" onClick={() => void apagarRascunho(r.id).then(() => setRascunhos((l) => l?.filter((x) => x.id !== r.id) ?? null))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
      {arquivos.length > 0 && (
        <div className="ig-novo-fotos" role="list" aria-label="Fotos da publicação">
          {arquivos.map((a, i) => (
            <span key={a.name + a.size + i} className={"ig-novo-mini" + (i === atual ? " on" : "")} role="listitem">
              <button type="button" className="ig-sem-botao" aria-label={`Foto ${i + 1}`} onClick={() => void irPara(i)}>
                <MiniArquivo arquivo={cortadas[i] ?? a} />
              </button>
              <button type="button" className="ig-sem-botao ig-novo-tirar" aria-label={`Tirar a foto ${i + 1}`} onClick={() => tirar(i)}>
                ×
              </button>
            </span>
          ))}
          {arquivos.length < 10 && (
            <button type="button" className="ig-sem-botao ig-novo-mais" aria-label="Mais fotos" onClick={() => input.current?.click()}>
              +
            </button>
          )}
        </div>
      )}
      <div className="ig-novo-legenda">
        <textarea
          className="ig-novo-texto"
          aria-label="Legenda"
          maxLength={500}
          rows={3}
          placeholder="Escreva uma legenda… (use @ para mencionar)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <SugestoesMencao texto={texto} mudar={setTexto} />
      </div>
      {arquivos.length > 0 && (
        <button type="button" className="ig-sem-botao ig-novo-linha" onClick={() => setMarcando(true)}>
          <IcPessoa />
          <span>Marcar pessoas</span>
          <small className="ig-cinza">{marcados.length ? `${marcados.length} marcad${marcados.length === 1 ? "a" : "as"}` : ""}</small>
        </button>
      )}
      <button type="button" className="ig-sem-botao ig-novo-linha" onClick={() => setEscolhendoColab(true)}>
        <span aria-hidden="true">👥</span>
        <span>Convidar colaborador</span>
        <small className="ig-cinza">{nomeColab ? arroba(nomeColab.name) : ""}</small>
      </button>
      <button type="button" className="ig-sem-botao ig-novo-linha" aria-expanded={avancadas} onClick={() => setAvancadas((a) => !a)}>
        <span aria-hidden="true">⚙</span>
        <span>Configurações avançadas</span>
        <small className="ig-cinza">{avancadas ? "▴" : "▾"}</small>
      </button>
      {avancadas && (
        <div className="ig-avancadas">
          <label className="ig-chave">
            <span>Ocultar o número de curtidas</span>
            <input type="checkbox" checked={esconderCurtidas} onChange={(e) => setEsconderCurtidas(e.target.checked)} />
          </label>
          <label className="ig-chave">
            <span>Desativar os comentários</span>
            <input type="checkbox" checked={semComentarios} onChange={(e) => setSemComentarios(e.target.checked)} />
          </label>
        </div>
      )}
      <div className="ig-modos" role="radiogroup" aria-label="Publicar como">
        {(["post", "story"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={modo === m} className={modo === m ? "on" : undefined} onClick={() => setModo(m)}>
            {m === "post" ? "PUBLICAÇÃO" : "STORY"}
          </button>
        ))}
      </div>
      {marcando && (
        <FolhaGente titulo="Marcar pessoas" marcados={marcados} mudar={(u) => setMarcados((l) => (l.includes(u) ? l.filter((x) => x !== u) : [...l, u]))} fechar={() => setMarcando(false)} />
      )}
      {escolhendoColab && (
        <FolhaGente
          titulo="Convidar colaborador"
          dica="Se aceitar, a publicação aparece no perfil dos dois, com os dois nomes."
          marcados={colaborador ? [colaborador] : []}
          mudar={(u) => (setColaborador((c) => (c === u ? null : u)), setEscolhendoColab(false))}
          fechar={() => setEscolhendoColab(false)}
        />
      )}
      {camera && (
        <Camera
          proporcao={1}
          fechar={() => setCamera(false)}
          pronto={(f) => {
            setCamera(false);
            setArquivos((l) => [...l, f].slice(0, 10));
          }}
        />
      )}
      {perguntaSair && (
        <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && setPerguntaSair(false)}>
          <section className="ig-folha ig-folha-menu" aria-label="Sair da publicação">
            <span className="ig-alca" aria-hidden="true" />
            <h3>Salvar como rascunho?</h3>
            <p className="ig-folha-dica ig-cinza">Fica só neste aparelho. Você continua depois em Nova publicação.</p>
            <button type="button" className="ig-sem-botao ig-azul" onClick={() => void guardarRascunho()}>
              Salvar rascunho
            </button>
            <button type="button" className="ig-sem-botao ig-perigo" onClick={() => nav.ir("inicio")}>
              Descartar
            </button>
            <button type="button" className="ig-sem-botao" onClick={() => setPerguntaSair(false)}>
              Continuar editando
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
/** A miniatura de uma foto escolhida (o endereço sai da memória quando ela some). */
function MiniArquivo({ arquivo }: { arquivo: Blob }) {
  const url = urlDoArquivo(arquivo);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" /> : null;
}

/* ---------- ver stories ---------- */
function VerStories({ grupos, inicio, fechar, nav, destaque }: { grupos: Grupo[]; inicio: { g: number; s: number }; fechar: () => void; nav: Nav; destaque?: Destaque | null }) {
  const eu = useApp((s) => s.myUid);
  const quemViu = useRede((s) => s.quemViu);
  const respostas = useRede((s) => s.respostas);
  /* a lista é guardada aqui: apagar um story tira ele daqui também (antes, voltando, ele aparecia sem a imagem) */
  const [lista_, setLista_] = useState(grupos);
  const [pos, setPos] = useState(inicio);
  const [pausa, setPausa] = useState(false);
  const [lista, setLista] = useState<null | "vistos" | "respostas">(null);
  const [destacando, setDestacando] = useState(false);
  /* respondendo: o story para de andar enquanto a pessoa digita */
  const [resposta, setResposta] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [noFig, setNoFig] = useState(false);
  /* reação que voou (o emoji grande subindo), como no Instagram */
  const [voando, setVoando] = useState<{ id: number; emoji: string } | null>(null);
  const { sure, pedir } = useSure(3000);
  const quadro = useRef<HTMLDivElement>(null);
  const [u, setU] = useState(0.35);
  const grupo = lista_[pos.g];
  const story: Story | undefined = grupo?.stories[pos.s];
  const f = useNome(grupo?.userId);
  const meu = grupo?.userId === eu;
  const agora = useAgora();
  const parado = pausa || !!lista || digitando || noFig || destacando;

  /* o tamanho da imagem na tela (as figurinhas são medidas em pontos do story, 1080 de largura) */
  useEffect(() => {
    const el = quadro.current;
    if (!el) return;
    const ler = () => setU(el.clientWidth / 1080);
    ler();
    const ro = new ResizeObserver(ler);
    ro.observe(el);
    return () => ro.disconnect();
  }, [story?.id]);

  useEffect(() => {
    if (!story) return;
    marcarVisto(story);
    if (story.userId === eu) void lerQuemViu(story);
  }, [story, eu]);

  /* passa sozinho depois de STORY_MS (para enquanto segura ou com a lista de quem viu aberta) */
  const ir = (passo: 1 | -1) => {
    const n = andar(lista_, pos.g, pos.s, passo);
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
    if (parado || !story) return;
    const t = setTimeout(() => {
      const n = andar(lista_, pos.g, pos.s, 1);
      if (!n) fechar();
      else setPos(n);
    }, STORY_MS);
    return () => clearTimeout(t);
  }, [pos, parado, story, lista_, fechar]);

  if (!grupo || !story) return null;
  const viu = quemViu[story.id] ?? [];
  const resp = respostas[story.id] ?? [];
  /* reação rápida: vai pelo Direct como resposta ao story */
  const reagir = (emoji: string) => {
    setVoando({ id: story.id * 100 + Math.floor(performance.now() % 100), emoji });
    void enviarMensagem(grupo.userId, emoji, { storyId: story.id }).then((ok) => ok && toast(`Reação enviada para ${f?.name ?? "o nanico"}`));
  };
  const apagarEste = async () => {
    await apagarStory(story);
    const novos = lista_.map((g, i) => (i === pos.g ? { ...g, stories: g.stories.filter((x) => x.id !== story.id) } : g)).filter((g) => g.stories.length);
    if (!novos.length) return fechar();
    const g = Math.min(pos.g, novos.length - 1);
    setLista_(novos);
    setPos({ g, s: Math.min(g === pos.g ? pos.s : 0, novos[g].stories.length - 1) });
  };
  return (
    <div className={"ig-story-tela" + (pausa ? " segurando" : "")} role="dialog" aria-label={`Story de ${f?.name ?? "alguém"}`}>
      <div className="ig-barras" aria-hidden="true">
        {grupo.stories.map((s, k) => (
          <span key={s.id} className={k < pos.s ? "cheia" : ""}>
            {k === pos.s && <i key={`${story.id}-${parado}`} className={parado ? "pausa" : ""} style={{ animationDuration: `${STORY_MS}ms` }} />}
          </span>
        ))}
      </div>
      <header className="ig-story-topo">
        <RostoAnel userId={grupo.userId} tam={32} />
        <b>{destaque ? destaque.nome : arroba(f?.name)}</b>
        <small>{tempoCurto(story.em, agora)}</small>
        {story.soProximos && (
          <span className="ig-selo-proximos" title="Só para os melhores amigos">
            ★ Melhores amigos
          </span>
        )}
        <span className="ig-espaco" />
        <button type="button" className="ig-sem-botao" aria-label="Fechar" onClick={fechar}>
          <IcX />
        </button>
      </header>
      <div
        className={"ig-story-corpo " + (story.midia ? "com-midia" : "f-" + story.fundo)}
        onPointerDown={() => setPausa(true)}
        onPointerUp={() => setPausa(false)}
        onPointerLeave={() => setPausa(false)}
      >
        {story.midia ? (
          /* a imagem do story fica inteira, em 9:16, e as figurinhas que se tocam vão por cima, no mesmo lugar do editor */
          <div ref={quadro} className="ig-story-quadro" style={{ "--u": `${u}px` } as React.CSSProperties}>
            <Imagem caminho={story.midia} alt={story.texto || `Story de ${f?.name ?? "alguém"}`} cheia />
            {story.figurinha && (
              <div className="ig-fig-lugar" style={lugarDaFigurinha(story.figurinha)}>
                <FigurinhaVisual
                  f={story.figurinha}
                  story={story}
                  meu={meu}
                  pausar={setNoFig}
                  abrirPost={(id) => (fechar(), nav.abrirPostId(id))}
                  abrirStory={(id) => (fechar(), nav.verStoryId(id))}
                  entrar={(pergunta, origem) => (fechar(), nav.storyCom({ tipo: "adicione", pergunta, origem }))}
                />
              </div>
            )}
          </div>
        ) : null}
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
          <button type="button" className="ig-sem-botao ig-visto" onClick={() => setLista("vistos")}>
            <IcOlho /> {viu.length ? `Visto por ${viu.length}` : "Ninguém viu ainda"}
          </button>
          {story.figurinha && !["post", "story", "adicione"].includes(story.figurinha.tipo) && (
            <button type="button" className="ig-sem-botao ig-visto" onClick={() => setLista("respostas")}>
              {resp.length === 1 ? "1 resposta" : `${resp.length} respostas`}
            </button>
          )}
          <span className="ig-espaco" />
          <button type="button" className="ig-sem-botao ig-story-acao" onClick={() => setDestacando(true)}>
            <span aria-hidden="true">♡</span> Destacar
          </button>
          {destaque ? (
            <button type="button" className="ig-sem-botao ig-perigo" onClick={() => void tirarDoDestaque(destaque, story.id).then(() => ir(1))}>
              Tirar do destaque
            </button>
          ) : (
            <button type="button" className={"ig-sem-botao ig-perigo" + (sure ? " sure" : "")} onClick={() => pedir() && void apagarEste()}>
              {sure ? "Toque de novo" : "Apagar"}
            </button>
          )}
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
            <button type="button" className="ig-sem-botao" aria-label="Curtir o story" onClick={() => reagir("❤️")}>
              <IcCoracao />
            </button>
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
        <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && setLista(null)}>
          <section className="ig-folha" aria-label={lista === "vistos" ? "Quem viu" : "Respostas"}>
            <span className="ig-alca" aria-hidden="true" />
            {story.figurinha && !["post", "story", "adicione"].includes(story.figurinha.tipo) ? (
              <div className="ig-abas-folha" role="tablist">
                <button type="button" role="tab" aria-selected={lista === "vistos"} className={lista === "vistos" ? "on" : undefined} onClick={() => setLista("vistos")}>
                  Visualizações ({viu.length})
                </button>
                <button type="button" role="tab" aria-selected={lista === "respostas"} className={lista === "respostas" ? "on" : undefined} onClick={() => setLista("respostas")}>
                  Respostas ({resp.length})
                </button>
              </div>
            ) : (
              <h3>Visualizações</h3>
            )}
            <ul className="ig-lista-gente">
              {lista === "vistos"
                ? viu.length
                  ? viu.map((x) => <Visualizou key={x} userId={x} />)
                  : <li className="ig-vazio">Ninguém viu ainda.</li>
                : resp.length
                  ? resp.map((r) => (
                      <Visualizou
                        key={r.userId}
                        userId={r.userId}
                        extra={
                          r.texto ??
                          (r.opcao != null && (story.figurinha?.tipo === "enquete" || story.figurinha?.tipo === "quiz")
                            ? `${story.figurinha.tipo === "quiz" ? (r.opcao === story.figurinha.certa ? "Acertou: " : "Errou: ") : "Votou em "}“${story.figurinha.opcoes[r.opcao] ?? "?"}”`
                            : r.valor != null && story.figurinha?.tipo === "barra"
                              ? `${story.figurinha.emoji} ${r.valor}%`
                              : story.figurinha?.tipo === "contagem"
                                ? "Pediu para lembrar"
                                : "")
                        }
                      />
                    ))
                  : <li className="ig-vazio">Ninguém respondeu ainda.</li>}
            </ul>
          </section>
        </div>
      )}
      {destacando && <FolhaDestacar story={story} fechar={() => setDestacando(false)} />}
    </div>
  );
}
/** Pôr o story num destaque do perfil (um que já existe ou um novo). */
function FolhaDestacar({ story, fechar }: { story: Story; fechar: () => void }) {
  const eu = useApp((s) => s.myUid);
  const meus = useRede((s) => s.destaques[eu ?? ""]);
  const [nome, setNome] = useState("");
  useEffect(() => {
    if (eu && !meus) void carregarDestaques(eu);
  }, [eu, meus]);
  const ir = (alvo: { id: number } | { nome: string }) => void destacar(story, alvo).then((ok) => ok && fechar());
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label="Destacar">
        <span className="ig-alca" aria-hidden="true" />
        <h3>Adicionar ao destaque</h3>
        <ul className="ig-lista-gente">
          {(meus ?? []).map((d) => (
            <li key={d.id}>
              <button type="button" className="ig-sem-botao" disabled={d.stories.includes(story.id)} onClick={() => ir({ id: d.id })}>
                <span className="ig-destaque-capa pequena" aria-hidden="true" />
                <span>
                  <b>{d.nome}</b>
                  <small className="ig-cinza">{d.stories.includes(story.id) ? "Já está aqui" : `${d.stories.length} stories`}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <form
          className="ig-comentar"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim()) ir({ nome });
          }}
        >
          <input aria-label="Nome do destaque novo" maxLength={24} placeholder="Novo destaque…" value={nome} onChange={(e) => setNome(e.target.value)} />
          <button type="submit" className="ig-sem-botao ig-azul" disabled={!nome.trim()}>
            Criar
          </button>
        </form>
      </section>
    </div>
  );
}
function Visualizou({ userId, extra }: { userId: string; extra?: string }) {
  const f = useNome(userId);
  return (
    <li>
      <RostoAnel userId={userId} tam={40} />
      <span>
        <b>{arroba(f?.name)}</b>
        <small className="ig-cinza">{extra || f?.name}</small>
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

/** Está digitando para mim agora? (o aviso vale por 4 s) */
function useDigitando(userId: string) {
  const quando = useRede((s) => s.digitando[userId] ?? 0);
  /* o "digitando…" some 4 s depois do último aviso (ou quando a mensagem chega) */
  const [apagou, setApagou] = useState(0);
  useEffect(() => {
    if (!quando) return;
    const t = setTimeout(() => setApagou(quando), Math.max(0, quando + 4000 - Date.now()));
    return () => clearTimeout(t);
  }, [quando]);
  return !!quando && apagou !== quando;
}

function ItemConversa({ outro, ultima, naoLidas, nav }: { outro: string; ultima: Mensagem; naoLidas: number; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const f = useNome(outro);
  const agora = useAgora();
  const ativo = useAtivo(outro);
  const digitando = useDigitando(outro);
  return (
    <li>
      <button type="button" className={"ig-sem-botao ig-conversa-item" + (naoLidas ? " nova" : "")} onClick={() => nav.conversa(outro)}>
        <span className="ig-rosto-ativo">
          <RostoAnel userId={outro} tam={52} />
          {ativo && <i className="ig-ponto-ativo" aria-label="Ativo agora" />}
        </span>
        <span className="ig-conversa-txt">
          <b>{f?.name ?? "Alguém"}</b>
          <small>{digitando ? <span className="ig-digitando-txt">digitando…</span> : <>{resumo(ultima, eu)} · {tempoCurto(ultima.em, agora)}</>}</small>
        </span>
        {naoLidas > 0 && <span className="ig-ponto-azul" aria-label={`${naoLidas} não lidas`} />}
      </button>
    </li>
  );
}

/** As notas de 24 h em cima das conversas (a minha primeiro, com o "+" para escrever). */
function Notas({ nav }: { nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const notas = useRede((s) => s.notas);
  const friends = useApp((s) => s.friends);
  const minha = notas.find((n) => n.userId === eu);
  const outras = notas.filter((n) => n.userId !== eu && friends.some((f) => f.user_id === n.userId)).sort((a, b) => b.em - a.em);
  const [escrevendo, setEscrevendo] = useState<string | null>(null);
  return (
    <>
      <div className="ig-notas" role="list" aria-label="Notas">
        <div className="ig-nota" role="listitem">
          <button type="button" className="ig-sem-botao" aria-label={minha ? "Mudar a sua nota" : "Escrever uma nota"} onClick={() => setEscrevendo(minha?.texto ?? "")}>
            <span className={"ig-nota-balao" + (minha ? "" : " vazia")}>{minha ? minha.texto : "Deixe uma nota…"}</span>
            {eu && <RostoAnel userId={eu} tam={62} />}
          </button>
          <small className="ig-cinza">Sua nota</small>
        </div>
        {outras.map((n) => (
          <div key={n.userId} className="ig-nota" role="listitem">
            <button type="button" className="ig-sem-botao" aria-label={`Nota: ${n.texto}. Responder`} onClick={() => nav.conversa(n.userId)}>
              <span className="ig-nota-balao">{n.texto}</span>
              <RostoAnel userId={n.userId} tam={62} />
            </button>
            <NomeCurto userId={n.userId} />
          </div>
        ))}
      </div>
      {escrevendo !== null && (
        <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && setEscrevendo(null)}>
          <section className="ig-folha" aria-label="Nota">
            <span className="ig-alca" aria-hidden="true" />
            <h3>Nova nota</h3>
            <p className="ig-folha-dica ig-cinza">Todo mundo vê em cima das conversas por 24 horas.</p>
            <form
              className="ig-comentar"
              onSubmit={(e) => {
                e.preventDefault();
                void salvarNota(escrevendo).then((ok) => ok && setEscrevendo(null));
              }}
            >
              <input aria-label="Nota" maxLength={60} placeholder="Compartilhe um pensamento…" value={escrevendo} onChange={(e) => setEscrevendo(e.target.value)} autoFocus />
              <button type="submit" className="ig-sem-botao ig-azul">
                {escrevendo.trim() ? "Compartilhar" : minha ? "Apagar" : "OK"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

/** Um grupo na lista do Direct. */
function ItemGrupo({ g, nav }: { g: GrupoDM; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const mensagens = useRede((s) => s.mensagens);
  const friends = useApp((s) => s.friends);
  const agora = useAgora();
  const ultima = useMemo(() => doGrupo(mensagens, g.id).at(-1), [mensagens, g.id]);
  const nao = naoLidasGrupo(mensagens, g.id, g.membros.find((m) => m.userId === eu)?.lidoAte ?? 0, eu);
  const quem = ultima ? (ultima.de === eu ? "Você" : (friends.find((f) => f.user_id === ultima.de)?.name ?? "Alguém")) : "";
  return (
    <li>
      <button type="button" className={"ig-sem-botao ig-conversa-item" + (nao ? " nova" : "")} onClick={() => nav.conversa(`g:${g.id}`)}>
        <RostosGrupo g={g} tam={52} />
        <span className="ig-conversa-txt">
          <b>{g.nome}</b>
          <small>{ultima ? <>{quem}: {resumo(ultima, eu).replace(/^Você: /, "")} · {tempoCurto(ultima.em, agora)}</> : `${g.membros.length} pessoas`}</small>
        </span>
        {nao > 0 && <span className="ig-ponto-azul" aria-label={`${nao} não lidas`} />}
      </button>
    </li>
  );
}

function DirectLista({ nav }: { nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const meu = useNome(eu);
  const mensagens = useRede((s) => s.mensagens);
  const grupos = useRede((s) => s.grupos);
  const friends = useApp((s) => s.friends);
  const [nova, setNova] = useState(false);
  const [busca, setBusca] = useState("");
  /* novo grupo: quem entra e o nome */
  const [noGrupo, setNoGrupo] = useState<string[] | null>(null);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [criando, setCriando] = useState(false);
  const lista = useMemo(() => conversas(mensagens, eu), [mensagens, eu]);
  /* conversas e grupos juntos, da mais recente para a mais velha */
  const tudo = useMemo(() => {
    const ultimaDoGrupo = (id: number) => mensagens.filter((m) => m.grupoId === id).reduce((n, m) => Math.max(n, m.em), 0);
    return [...lista.map((c) => ({ t: "c" as const, em: c.ultima.em, c })), ...grupos.map((g) => ({ t: "g" as const, em: ultimaDoGrupo(g.id) || Infinity, g }))].sort((a, b) => b.em - a.em);
  }, [lista, grupos, mensagens]);
  const gente = friends.filter((f) => f.user_id && f.user_id !== eu && (!busca.trim() || arroba(f.name).includes(arroba(busca))));
  const semConversa = gente.filter((f) => !lista.some((c) => c.outro === f.user_id));
  return (
    <>
      <header className="ig-topo">
        <button type="button" className="ig-sem-botao" aria-label="Voltar" onClick={() => (noGrupo ? setNoGrupo(null) : nova ? setNova(false) : nav.ir("inicio"))}>
          <IcVoltar />
        </button>
        <b className="ig-titulo">{noGrupo ? "Novo grupo" : nova ? "Nova mensagem" : arroba(meu?.name)}</b>
        <span className="ig-espaco" />
        {!nova && (
          <button type="button" className="ig-sem-botao" aria-label="Nova mensagem" onClick={() => setNova(true)}>
            <IcCaneta />
          </button>
        )}
        {nova && !noGrupo && (
          <button type="button" className="ig-sem-botao ig-azul" onClick={() => setNoGrupo([])}>
            Criar grupo
          </button>
        )}
        {noGrupo && (
          <button
            type="button"
            className="ig-sem-botao ig-azul"
            disabled={noGrupo.length < 2 || !nomeGrupo.trim() || criando}
            onClick={() => {
              setCriando(true);
              void criarGrupo(nomeGrupo, noGrupo).then((id) => {
                setCriando(false);
                if (!id) return;
                setNoGrupo(null);
                setNova(false);
                setNomeGrupo("");
                nav.conversa(`g:${id}`);
              });
            }}
          >
            {criando ? "Criando…" : "Criar"}
          </button>
        )}
      </header>
      {noGrupo && (
        <div className="ig-busca">
          <input aria-label="Nome do grupo" maxLength={40} placeholder="Nome do grupo (ex.: Churrasco)" value={nomeGrupo} onChange={(e) => setNomeGrupo(e.target.value)} />
        </div>
      )}
      <div className="ig-busca">
        <IcLupa />
        <input aria-label="Pesquisar" placeholder="Pesquisar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {nova || busca.trim() ? (
        <ul className={"ig-lista-gente" + (noGrupo ? " ig-escolher" : "")}>
          {noGrupo && <li className="ig-folha-dica ig-cinza">Escolha pelo menos 2 pessoas.</li>}
          {gente.map((f) => {
            const on = !!noGrupo?.includes(f.user_id!);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className="ig-sem-botao"
                  aria-pressed={noGrupo ? on : undefined}
                  onClick={() => (noGrupo ? setNoGrupo((l) => (on ? (l ?? []).filter((x) => x !== f.user_id) : [...(l ?? []), f.user_id!])) : nav.conversa(f.user_id!))}
                >
                  <RostoAnel userId={f.user_id!} tam={44} />
                  <span>
                    <b>{f.name}</b>
                    <small className="ig-cinza">{arroba(f.name)}</small>
                  </span>
                  {noGrupo && (
                    <i className={"ig-check" + (on ? " on" : "")} aria-hidden="true">
                      {on ? "✓" : ""}
                    </i>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <Notas nav={nav} />
          <p className="ig-secao">Mensagens</p>
          <ul className="ig-conversas">
            {tudo.length ? (
              tudo.map((x) => (x.t === "c" ? <ItemConversa key={x.c.outro} {...x.c} nav={nav} /> : <ItemGrupo key={"g" + x.g.id} g={x.g} nav={nav} />))
            ) : (
              <li className="ig-vazio">Nenhuma conversa ainda. Mande a primeira mensagem.</li>
            )}
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

/** A miniatura do story que a mensagem responde (se ele ainda estiver no ar ou num destaque). */
function StoryMini({ id }: { id: number }) {
  const s = useRede((st) => st.stories.find((x) => x.id === id) ?? st.storiesDestaque[id]);
  if (!s) return <span className="ig-story-mini-msg sumiu">Story indisponível</span>;
  return <span className="ig-story-mini-msg">{s.midia ? <Imagem caminho={s.midia} alt="Story" /> : <span className={"f-" + s.fundo}>{s.texto}</span>}</span>;
}

const REACOES_DM = ["❤️", "😂", "😮", "😢", "😡", "👍"];

/** Um balão da conversa: texto, foto, áudio, resposta a story ou publicação; com reações, responder e apagar. */
function Balao({ m, meu, nav, responder, citada, grupo }: { m: Mensagem; meu: boolean; nav: Nav; responder: (m: Mensagem) => void; citada?: Mensagem | null; grupo?: boolean }) {
  const eu = useApp((s) => s.myUid);
  const remetente = useNome(grupo && !meu ? m.de : null);
  const [vendoUnica, setVendoUnica] = useState<string | null>(null);
  const post = useRede((s) => (m.postId ? (s.posts.find((p) => p.id === m.postId) ?? s.avulsos[m.postId]) : undefined));
  const autor = useNome(post?.userId);
  const nomeCitada = useNome(citada?.de);
  const reacoes = useRede((s) => s.reacoes[m.id]);
  const [menu, setMenu] = useState(false);
  const [arraste, setArraste] = useState(0);
  const toque = useRef<{ x: number; t: number; segura?: ReturnType<typeof setTimeout> } | null>(null);
  const ultimoToque = useRef(0);
  const caixa = useRef<HTMLDivElement>(null);
  const fecharMenu = useMemo(() => () => setMenu(false), []);
  useForaFecha(menu, fecharMenu, caixa);
  const { sure, pedir } = useSure(3000);
  useEffect(() => {
    if (m.postId && !post) void buscarPost(m.postId);
  }, [m.postId, post]);
  const lista = Object.entries(reacoes ?? {});
  /* como no Instagram: dois toques curtem; segurar (ou o clique direito) abre as reações; arrastar para o lado responde */
  const eventos = {
    onPointerDown: (e: React.PointerEvent) => {
      toque.current = { x: e.clientX, t: Date.now(), segura: setTimeout(() => setMenu(true), 480) };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const t = toque.current;
      if (!t) return;
      const dx = (e.clientX - t.x) * (meu ? -1 : 1);
      if (Math.abs(e.clientX - t.x) > 8) clearTimeout(t.segura);
      if (dx > 0) setArraste(Math.min(70, dx));
    },
    onPointerUp: () => {
      const t = toque.current;
      if (t) clearTimeout(t.segura);
      if (arraste > 50) responder(m);
      else if (t && Date.now() - t.t < 250) {
        const agora = Date.now();
        if (agora - ultimoToque.current < 320) void reagirMensagem(m, "❤️");
        ultimoToque.current = agora;
      }
      toque.current = null;
      setArraste(0);
    },
    onPointerCancel: () => {
      if (toque.current) clearTimeout(toque.current.segura);
      toque.current = null;
      setArraste(0);
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setMenu(true);
    },
  };
  return (
    <div className={"ig-balao-linha" + (meu ? " meu" : "")}>
      <div ref={caixa} className="ig-balao-col" style={arraste ? { transform: `translateX(${meu ? -arraste : arraste}px)` } : undefined} {...eventos}>
        {arraste > 20 && <span className="ig-balao-responder" aria-hidden="true">↩</span>}
        {citada && (
          <span className="ig-balao-citada">
            <small className="ig-cinza">{citada.de === eu ? "Você" : arroba(nomeCitada?.name)}</small>
            {citada.texto || (citada.midia ? (ehAudio(citada.midia) ? "🎤 Áudio" : "📷 Foto") : citada.postId ? "Publicação" : "")}
          </span>
        )}
        {m.storyId && (
          <>
            <small className="ig-cinza ig-balao-nota">{meu ? "Você respondeu ao story" : "Respondeu ao seu story"}</small>
            <StoryMini id={m.storyId} />
          </>
        )}
        {m.postId &&
          (post ? (
            <button type="button" className="ig-balao-post" onClick={() => nav.abrirPost(post)}>
              <span className="ig-balao-post-topo">
                <RostoAnel userId={post.userId} tam={22} /> <b>{arroba(autor?.name)}</b>
              </span>
              {post.midia ? <Imagem caminho={post.midia} alt="" /> : <span className="ig-quadrado-texto">{post.texto}</span>}
            </button>
          ) : (
            <span className="ig-balao ig-cinza">Publicação indisponível</span>
          ))}
        {grupo && !meu && <small className="ig-cinza ig-balao-autor">{remetente?.name ?? "Alguém"}</small>}
        {m.unica ? (
          meu ? (
            <span className="ig-balao meu ig-balao-unica">① Foto de ver uma vez · {m.abertaEm ? "Aberta" : "Enviada"}</span>
          ) : m.abertaEm || !m.midia ? (
            <span className="ig-balao ig-balao-unica ig-cinza">① Foto aberta</span>
          ) : (
            <button type="button" className="ig-balao ig-balao-unica ig-sem-botao" onClick={() => void abrirUnica(m).then(setVendoUnica)}>
              ① Toque para ver a foto (uma vez)
            </button>
          )
        ) : (
          m.midia && (ehAudio(m.midia) ? <AudioMsg caminho={m.midia} meu={meu} /> : <span className="ig-balao-foto"><Imagem caminho={m.midia} alt="Foto" /></span>)
        )}
        {m.texto && <span className={"ig-balao" + (meu ? " meu" : "")}>{m.texto}</span>}
        {/* o story em que me mencionaram: dá para repostar, como no Instagram */}
        {!meu && m.storyId && m.texto === MENCAO_STORY && (
          <button type="button" className="ig-sem-botao ig-balao-acao" onClick={() => nav.storyCom({ tipo: "story", storyId: m.storyId!, autor: m.de })}>
            ⊕ Adicionar ao seu story
          </button>
        )}
        {/* convite para colaborar: quem foi convidado aceita ou recusa */}
        {!meu && m.texto === CONVITE_COLAB && post && post.colaborador === eu && (
          post.colabAceito ? (
            <small className="ig-cinza">Você aceitou: a publicação está no seu perfil</small>
          ) : (
            <span className="ig-balao-acoes">
              <button type="button" className="ig-botao-azul" onClick={() => void aceitarColab(post, true)}>
                Aceitar
              </button>
              <button type="button" className="ig-botao-cinza" onClick={() => void aceitarColab(post, false)}>
                Recusar
              </button>
            </span>
          )
        )}
        {vendoUnica && (
          <span className="ig-unica-tela" role="dialog" aria-label="Foto de ver uma vez" onClick={() => (URL.revokeObjectURL(vendoUnica), setVendoUnica(null))}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vendoUnica} alt="Foto de ver uma vez" />
            <small>Toque para fechar. Depois ela some.</small>
          </span>
        )}
        {lista.length > 0 && (
          <span className="ig-balao-reacoes" aria-label={`Reações: ${lista.map(([, e]) => e).join(" ")}`}>
            {[...new Set(lista.map(([, e]) => e))].join("")}
            {lista.length > 1 && <small>{lista.length}</small>}
          </span>
        )}
        {menu && (
          <div className={"ig-balao-menu" + (meu ? " meu" : "")} role="menu" onPointerDown={(e) => e.stopPropagation()}>
            <span className="ig-balao-emojis">
              {REACOES_DM.map((em) => (
                <button key={em} type="button" className={reacoes?.[eu ?? ""] === em ? "on" : undefined} aria-label={`Reagir com ${em}`} onClick={() => (setMenu(false), void reagirMensagem(m, em))}>
                  {em}
                </button>
              ))}
            </span>
            <button type="button" role="menuitem" onClick={() => (setMenu(false), responder(m))}>
              Responder
            </button>
            {m.texto && (
              <button type="button" role="menuitem" onClick={() => (setMenu(false), void navigator.clipboard?.writeText(m.texto).then(() => toast("Copiado")))}>
                Copiar
              </button>
            )}
            {meu && (
              <button type="button" role="menuitem" className={"ig-perigo" + (sure ? " sure" : "")} onClick={() => pedir() && (setMenu(false), void apagarMensagem(m))}>
                {sure ? "Toque de novo para apagar" : "Cancelar envio"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Conversa({ outro, nav }: { outro: string; nav: Nav }) {
  const eu = useApp((s) => s.myUid);
  const grupoId = outro.startsWith("g:") ? Number(outro.slice(2)) : null;
  const grupo = useRede((s) => (grupoId ? s.grupos.find((g) => g.id === grupoId) : undefined));
  const f = useNome(grupoId ? null : outro);
  const mensagens = useRede((s) => s.mensagens);
  const lista = useMemo(() => (grupoId ? doGrupo(mensagens, grupoId) : daConversa(mensagens, eu, outro)), [mensagens, eu, outro, grupoId]);
  const digitandoG = useRede((s) => (grupoId ? s.digitandoGrupo[grupoId] : undefined));
  const [infoGrupo, setInfoGrupo] = useState(false);
  const [fotoEscolhida, setFotoEscolhida] = useState<File | null>(null);
  const [umaVez, setUmaVez] = useState(false);
  const friendsG = useApp((s) => s.friends);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [respondendo, setRespondendo] = useState<Mensagem | null>(null);
  const nomeResp = useNome(respondendo?.de);
  const ativo = useAtivo(grupoId ? null : outro);
  const digitandoDM = useDigitando(grupoId ? "" : outro);
  const [agoraG, setAgoraG] = useState(0);
  useEffect(() => {
    if (!digitandoG) return;
    const t = setTimeout(() => setAgoraG(Date.now()), 0);
    const t2 = setTimeout(() => setAgoraG(Date.now()), 4100);
    return () => (clearTimeout(t), clearTimeout(t2));
  }, [digitandoG]);
  const quemDigitaG = Object.entries(digitandoG ?? {}).filter(([, t]) => agoraG - t < 4000).map(([u]) => friendsG.find((x) => x.user_id === u)?.name ?? "Alguém");
  const digitando = grupoId ? quemDigitaG.length > 0 : digitandoDM;
  const fim = useRef<HTMLDivElement>(null);
  const foto = useRef<HTMLInputElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const agora = useAgora();
  const ultimaVista = lista[lista.length - 1];
  const vista = !grupoId && !!ultimaVista && ultimaVista.de === eu && !!ultimaVista.lidaEm;
  const gravador = useGravador((b) => void mandarArquivo(b, "audio"));
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [lista.length, digitando]);
  const mandar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    if (await enviarMensagem(outro, texto, { respostaA: respondendo?.id ?? null, grupoId })) {
      setTexto("");
      setRespondendo(null);
    }
    setEnviando(false);
  };
  async function mandarArquivo(b: Blob, tipo: "foto" | "audio", unica = false) {
    setEnviando(true);
    await enviarMensagem(outro, "", { arquivo: b, tipo, respostaA: respondendo?.id ?? null, grupoId, unica });
    setRespondendo(null);
    setEnviando(false);
  }
  const porId = new Map(lista.map((m) => [m.id, m]));
  return (
    <div className="ig-chat">
      <header className="ig-topo">
        <button type="button" className="ig-sem-botao" aria-label="Voltar" onClick={() => nav.ir("direct")}>
          <IcVoltar />
        </button>
        {grupo ? (
          <button type="button" className="ig-sem-botao ig-chat-quem" onClick={() => setInfoGrupo(true)}>
            <RostosGrupo g={grupo} tam={30} />
            <span>
              <b>{grupo.nome}</b>
              <small className="ig-cinza">{digitando ? `${quemDigitaG.join(", ")} digitando…` : `${grupo.membros.length} pessoas`}</small>
            </span>
          </button>
        ) : (
          <button type="button" className="ig-sem-botao ig-chat-quem" onClick={() => nav.perfil(outro)}>
            <span className="ig-rosto-ativo">
              <RostoAnel userId={outro} tam={30} />
              {ativo && <i className="ig-ponto-ativo" aria-hidden="true" />}
            </span>
            <span>
              <b>{f?.name ?? "Alguém"}</b>
              <small className="ig-cinza">{digitando ? "digitando…" : ativo ? "Ativo agora" : arroba(f?.name)}</small>
            </span>
          </button>
        )}
      </header>
      <div className="ig-chat-lista">
        <div className="ig-chat-cabeca">
          {grupo ? <RostosGrupo g={grupo} tam={86} /> : <RostoAnel userId={outro} tam={86} />}
          <b>{grupo ? grupo.nome : f?.name}</b>
          <small className="ig-cinza">{grupo ? `Grupo · ${grupo.membros.length} pessoas` : `${arroba(f?.name)} · InstaNanico`}</small>
        </div>
        {lista.map((m, i) => {
          const antes = lista[i - 1];
          const novoDia = !antes || nomeDoDia(antes.em, agora) !== nomeDoDia(m.em, agora);
          const pausa = !antes || m.em - antes.em > 30 * 60_000;
          return (
            <div key={m.id}>
              {(novoDia || pausa) && (
                <p className="ig-chat-dia">
                  {novoDia ? nomeDoDia(m.em, agora) + " " : ""}
                  {horaDe(m.em)}
                </p>
              )}
              <Balao m={m} meu={m.de === eu} nav={nav} grupo={!!grupoId} responder={(x) => (setRespondendo(x), campo.current?.focus())} citada={m.respostaA ? (porId.get(m.respostaA) ?? null) : null} />
            </div>
          );
        })}
        {digitando && (
          <div className="ig-balao-linha">
            <span className="ig-balao ig-digitando" aria-label={`${grupoId ? quemDigitaG.join(", ") : (f?.name ?? "Alguém")} está digitando`}>
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        {vista && <small className="ig-cinza ig-visto-chat">Visto</small>}
        <div ref={fim} />
      </div>
      {respondendo && (
        <div className="ig-respondendo">
          <span>
            <small className="ig-cinza">Respondendo a {respondendo.de === eu ? "você mesmo" : arroba(nomeResp?.name)}</small>
            <span className="ig-respondendo-txt">{respondendo.texto || (respondendo.midia ? (ehAudio(respondendo.midia) ? "🎤 Áudio" : "📷 Foto") : "Publicação")}</span>
          </span>
          <button type="button" className="ig-sem-botao ig-cinza" aria-label="Parar de responder" onClick={() => setRespondendo(null)}>
            ✕
          </button>
        </div>
      )}
      {gravador.gravando ? (
        <div className="ig-chat-campo gravando">
          <button type="button" className="ig-sem-botao ig-perigo" onClick={gravador.cancelar}>
            Cancelar
          </button>
          <span className="ig-gravando">
            <i aria-hidden="true" /> Gravando {gravador.tempo}
          </span>
          <button type="button" className="ig-sem-botao ig-azul" onClick={gravador.enviar}>
            Enviar
          </button>
        </div>
      ) : (
        <form
          className="ig-chat-campo"
          onSubmit={(e) => {
            e.preventDefault();
            void mandar();
          }}
        >
          <button type="button" className="ig-sem-botao ig-chat-camera" aria-label="Mandar uma foto" disabled={enviando} onClick={() => foto.current?.click()}>
            <IcFoto />
          </button>
          <input
            ref={campo}
            aria-label="Mensagem"
            maxLength={1000}
            placeholder="Mensagem…"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (e.target.value.trim()) avisarDigitando(outro);
            }}
          />
          {texto.trim() ? (
            <button type="submit" className="ig-sem-botao ig-azul" disabled={enviando}>
              Enviar
            </button>
          ) : (
            podeGravar() && (
              <button type="button" className="ig-sem-botao" aria-label="Gravar um áudio" disabled={enviando} onClick={() => void gravador.comecar()}>
                <IcMic />
              </button>
            )
          )}
          <input ref={foto} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => {
            const a = e.target.files?.[0];
            e.target.value = "";
            if (a) {
              setUmaVez(false);
              setFotoEscolhida(a);
            }
          }} />
        </form>
      )}
      {fotoEscolhida && (
        <FotoParaMandar
          arquivo={fotoEscolhida}
          podeUmaVez={!grupoId}
          umaVez={umaVez}
          mudarUmaVez={setUmaVez}
          cancelar={() => setFotoEscolhida(null)}
          mandar={() => {
            const a = fotoEscolhida;
            setFotoEscolhida(null);
            void mandarArquivo(a, "foto", umaVez);
          }}
        />
      )}
      {infoGrupo && grupo && <FolhaGrupo g={grupo} fechar={() => setInfoGrupo(false)} sair={() => (setInfoGrupo(false), nav.ir("direct"))} />}
    </div>
  );
}

/** A prévia da foto antes de mandar no Direct, com o "ver uma vez" (como o ① do Instagram). */
function FotoParaMandar({ arquivo, podeUmaVez, umaVez, mudarUmaVez, cancelar, mandar }: { arquivo: File; podeUmaVez: boolean; umaVez: boolean; mudarUmaVez: (v: boolean) => void; cancelar: () => void; mandar: () => void }) {
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && cancelar()}>
      <section className="ig-folha ig-foto-mandar" aria-label="Mandar foto">
        <span className="ig-alca" aria-hidden="true" />
        <MiniArquivo arquivo={arquivo} />
        <div className="ig-foto-mandar-pe">
          {podeUmaVez && (
            <button type="button" className={"ig-umavez" + (umaVez ? " on" : "")} aria-pressed={umaVez} onClick={() => mudarUmaVez(!umaVez)}>
              ① {umaVez ? "Ver uma vez" : "Deixar na conversa"}
            </button>
          )}
          <span className="ig-espaco" />
          <button type="button" className="ig-botao-cinza" onClick={cancelar}>
            Cancelar
          </button>
          <button type="button" className="ig-botao-azul" onClick={mandar}>
            Enviar
          </button>
        </div>
      </section>
    </div>
  );
}

/** Dois rostos do grupo, um em cima do outro (como o Instagram mostra os grupos). */
function RostosGrupo({ g, tam }: { g: GrupoDM; tam: number }) {
  const eu = useApp((s) => s.myUid);
  const dois = g.membros.filter((m) => m.userId !== eu).slice(0, 2);
  return (
    <span className="ig-rostos-grupo" style={{ width: tam, height: tam }}>
      {dois.map((m) => (
        <RostoAnel key={m.userId} userId={m.userId} tam={Math.round(tam * 0.68)} />
      ))}
    </span>
  );
}

/** Informações do grupo: quem está, pôr mais gente, mudar o nome e sair. */
function FolhaGrupo({ g, fechar, sair }: { g: GrupoDM; fechar: () => void; sair: () => void }) {
  const eu = useApp((s) => s.myUid);
  const [nome, setNome] = useState(g.nome);
  const [pondo, setPondo] = useState<string[] | null>(null);
  const { sure, pedir } = useSure(3000);
  return (
    <div className="ig-folha-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <section className="ig-folha" aria-label="Detalhes do grupo">
        <span className="ig-alca" aria-hidden="true" />
        <h3>Detalhes</h3>
        <form
          className="ig-comentar"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim() && nome.trim() !== g.nome) void renomearGrupo(g, nome);
          }}
        >
          <input aria-label="Nome do grupo" maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} />
          <button type="submit" className="ig-sem-botao ig-azul" disabled={!nome.trim() || nome.trim() === g.nome}>
            Salvar
          </button>
        </form>
        <p className="ig-secao">{g.membros.length} pessoas</p>
        <ul className="ig-lista-gente">
          {g.membros.map((m) => (
            <Visualizou key={m.userId} userId={m.userId} extra={m.userId === g.criadoPor ? "Criou o grupo" : m.userId === eu ? "Você" : undefined} />
          ))}
        </ul>
        <div className="ig-comp-pe ig-grupo-bts">
          <button type="button" className="ig-botao-cinza" onClick={() => setPondo([])}>
            Adicionar pessoas
          </button>
          <button type="button" className={"ig-botao-cinza ig-perigo" + (sure ? " sure" : "")} onClick={() => pedir() && void sairDoGrupo(g).then(sair)}>
            {sure ? "Toque de novo para sair" : "Sair do grupo"}
          </button>
        </div>
      </section>
      {pondo && (
        <FolhaGente
          titulo="Adicionar ao grupo"
          marcados={[...g.membros.map((m) => m.userId), ...pondo]}
          mudar={(u) => !g.membros.some((m) => m.userId === u) && setPondo((l) => (l?.includes(u) ? l.filter((x) => x !== u) : [...(l ?? []), u]))}
          fechar={() => {
            if (pondo.length) void adicionarAoGrupo(g, pondo);
            setPondo(null);
          }}
        />
      )}
    </div>
  );
}

/** Folha para mandar uma publicação para um ou mais nanicos (ou pôr no seu story). */
function FolhaCompartilhar({ p, fechar, noStory }: { p: Post; fechar: () => void; noStory: () => void }) {
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
          {marcados.length ? (
            <button type="button" className="ig-botao-azul" disabled={enviando} onClick={() => void mandar()}>
              {enviando ? "Enviando…" : marcados.length > 1 ? `Enviar separadamente (${marcados.length})` : "Enviar"}
            </button>
          ) : (
            <button type="button" className="ig-botao-cinza ig-comp-story" onClick={() => (fechar(), noStory())}>
              ⊕ Adicionar ao seu story
            </button>
          )}
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
  const [vendo, setVendo_] = useState<{ grupos: Grupo[]; g: number; s: number; destaque?: Destaque; vez?: number } | null>(null);
  /* cada vez que abre é uma tela nova de stories (de um story para outro, a lista muda) */
  const setVendo = (v: { grupos: Grupo[]; g: number; s: number; destaque?: Destaque } | null) => setVendo_(v && { ...v, vez: ++vezesStory });
  const [figInicial, setFigInicial] = useState<FigSemLugar | null>(null);
  const [claro, setClaro] = useState(() => local.get("insta-tema") === "claro");
  const silenciados = useRede((s) => s.silenciados);
  const [puxando, setPuxando] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const [folha, setFolha] = useState<Post | null>(null);
  const [postAberto, setPostAberto] = useState<Post | null>(null);
  const agora = useAgora();
  const rolagem = useRef<HTMLDivElement>(null);
  const vistosSet = useMemo(() => new Set(vistos), [vistos]);
  /* os stories de quem eu silenciei não aparecem na fileira (como no Instagram) */
  const grupos = useMemo(() => agrupar(stories.filter((x) => !silenciados[x.userId]?.stories), vistosSet, eu, agora), [stories, vistosSet, eu, agora, silenciados]);

  const nav: Nav = {
    ir: (t) => {
      if (conversaAberta) abrirConversa(null);
      if (t === "inicio" && perfilAberto) verPerfil(null);
      if (t === "perfil" && eu && perfilAberto !== eu) verPerfil(eu);
      if (t === "novo") {
        setModoNovo("post");
        setFigInicial(null);
      }
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
    abrirPostId: (id) => {
      const ja = postCarregado(id);
      if (ja) return setPostAberto(ja);
      void buscarPost(id).then((p) => (p ? setPostAberto(p) : toast("Essa publicação foi apagada.")));
    },
    storyDoPost: (p) => nav.storyCom({ tipo: "post", postId: p.id }),
    storyCom: (fig) => {
      setPostAberto(null);
      setVendo(null);
      if (conversaAberta) abrirConversa(null);
      setFigInicial(fig);
      setModoNovo("story");
      setTela("novo");
    },
    verStoryId: (id) => {
      const s = storyPorId(id);
      if (!s) return toast("Esse story já sumiu.");
      setVendo({ grupos: [{ userId: s.userId, stories: [s], todosVistos: true, ultimo: s.em }], g: 0, s: 0 });
    },
    claro,
    mudarTema: (c) => {
      setClaro(c);
      local.set("insta-tema", c ? "claro" : "escuro");
    },
    verDestaque: (d) => {
      const stories = d.stories.map((id) => storyPorId(id)).filter((x): x is Story => !!x);
      if (!stories.length) return toast("Esse destaque está vazio.");
      setVendo({ grupos: [{ userId: d.userId, stories, todosVistos: true, ultimo: stories[stories.length - 1].em }], g: 0, s: 0, destaque: d });
    },
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
          setVendo(null);
          if (useRede.getState().conversaAberta) abrirConversa(null);
          navAtual.current.abrirPostId(p.id);
        }
      }),
    [],
  );
  const abrirCriador = () => {
    setFigInicial(null);
    setModoNovo("story");
    setTela("novo");
  };
  /* puxar o feed para baixo atualiza, como no app */
  const puxar = useRef<{ y: number } | null>(null);
  const puxarEventos =
    tela === "inicio" && !postAberto && !conversaAberta
      ? {
          onTouchStart: (e: React.TouchEvent) => {
            if ((rolagem.current?.scrollTop ?? 1) <= 0) puxar.current = { y: e.touches[0].clientY };
          },
          onTouchMove: (e: React.TouchEvent) => {
            if (!puxar.current) return;
            const d = e.touches[0].clientY - puxar.current.y;
            setPuxando(d > 0 ? Math.min(90, d * 0.5) : 0);
          },
          onTouchEnd: () => {
            if (puxar.current && puxando > 60) {
              setAtualizando(true);
              void carregarRede().finally(() => setAtualizando(false));
            }
            puxar.current = null;
            setPuxando(0);
          },
        }
      : {};

  return (
    <div className={"ig" + (claro ? " claro" : "")}>
      <div className="ig-rola" ref={rolagem} {...puxarEventos}>
        {(puxando > 0 || atualizando) && (
          <div className="ig-puxar" style={{ height: atualizando ? 48 : puxando }} aria-live="polite">
            <span className={"ig-puxar-gira" + (atualizando || puxando > 60 ? " pronto" : "")} aria-label={atualizando ? "Atualizando" : undefined} />
          </div>
        )}
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
          <Feed grupos={grupos} nav={nav} abrirCriador={abrirCriador} rolagem={rolagem} />
        ) : tela === "explorar" ? (
          <Explorar nav={nav} />
        ) : tela === "novo" ? (
          <Novo key={modoNovo + JSON.stringify(figInicial)} nav={nav} modoInicial={modoNovo} figInicial={figInicial} />
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
      {folha && <FolhaComentarios p={folha} fechar={() => setFolha(null)} abrirPerfil={(u) => (setFolha(null), nav.perfil(u))} />}
      {compartilhando && <FolhaCompartilhar p={compartilhando} fechar={() => setCompartilhando(null)} noStory={() => nav.storyDoPost(compartilhando)} />}
      {vendo && <VerStories key={vendo.vez} grupos={vendo.grupos} inicio={{ g: vendo.g, s: vendo.s }} fechar={() => setVendo(null)} nav={nav} destaque={vendo.destaque ?? null} />}
    </div>
  );
}

/* o "voltar" do celular (ou do navegador) fecha o celular, como num app: abrir põe um passo no histórico */
let ignorarVolta = false;
const temPasso = () => !!(history.state as { celular?: boolean } | null)?.celular;
function useVoltarFecha(aberto: boolean) {
  useEffect(() => {
    if (!aberto) return;
    let porVolta = false;
    if (!temPasso()) history.pushState({ celular: true }, "");
    const volta = () => {
      if (ignorarVolta) {
        ignorarVolta = false;
        return;
      }
      porVolta = true;
      fecharCelular();
    };
    addEventListener("popstate", volta);
    return () => {
      removeEventListener("popstate", volta);
      /* fechou pelo X, pelo Esc ou pelo fundo: tira o passo que pusemos (sem fechar de novo). Espera um instante:
         se o celular continuar aberto (o efeito só foi refeito), o passo fica */
      if (porVolta) return;
      setTimeout(() => {
        if (useRede.getState().aberto || !temPasso()) return;
        ignorarVolta = true;
        history.back();
      }, 0);
    };
  }, [aberto]);
}

/** O celular aberto, por cima de tudo: o iPhone com o InstaNanico. */
export function Celular() {
  const aberto = useRede((s) => s.aberto);
  useVoltarFecha(aberto);
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
