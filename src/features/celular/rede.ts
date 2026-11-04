/*
 * Rede social nanica (seção 18 do seguranca.sql). Só quem tem o Celular lê e escreve, e quem garante é o banco
 * (RLS com tem_item('celular')): sem o item, as consultas voltam vazias e o tempo real não chega.
 * Feed de 20 em 20, curtidas e comentários das postagens carregadas, imagem no bucket "midias" (pasta rede/<uid>/),
 * comprimida no navegador como as mídias. Postar e curtir não dão moedas.
 * InstaNanico (seção 34): stories de 24 h (foto ou texto sobre cor), "já vi" no navegador e no banco (o dono vê quem
 * viu), e a Dynamic Island do celular avisando post, story e envio.
 * Igual ao Instagram (seção 68): carrossel, marcar pessoas, editar a legenda, salvar, responder e curtir comentários,
 * figurinhas que se tocam no story (enquete, pergunta, contagem, publicação), melhores amigos, destaques, foto e
 * áudio no Direct, responder e reagir a mensagens, apagar a minha, "digitando…", notas, bio e as notificações.
 * O perfil aberto tem a lista dele (`perfilPosts`): o feed, o Explorar e as notificações não mudam por causa dele.
 * Sem o SQL da seção 68, as consultas voltam para as colunas antigas (`sem68`) e o resto continua funcionando.
 */
import { create } from "zustand";
import { avisarTexto } from "@/features/hall/ganhos";
import { comprimir, soltarImagem } from "@/features/midias/midiasDados";
import { aoMudarTabela, aoReceber, enviar, estaNaSala, limitePorPessoa } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local, newId } from "@/lib/util";
import { DIA_MS, FUNDOS, lerFigurinha, mencionados, naoLidasDM, naoLidasGrupo, type Figurinha, type Fundo, type Mensagem, type Story } from "./insta";

export type Post = {
  id: number;
  userId: string;
  texto: string;
  midia: string | null;
  em: number;
  /** as outras fotos do carrossel (a primeira é `midia`) */
  fotos: string[];
  /** quem foi marcado na foto (userIds) */
  marcados: string[];
  editadoEm: number | null;
  /* seção 69 */
  fixadoEm?: number | null;
  comentarioFixo?: number | null;
  arquivado?: boolean;
  semComentarios?: boolean;
  esconderCurtidas?: boolean;
  /** quem foi convidado para ser dono junto (e se já aceitou) */
  colaborador?: string | null;
  colabAceito?: boolean;
};
export type GrupoDM = { id: number; nome: string; criadoPor: string | null; membros: { userId: string; lidoAte: number }[] };
export type Silencio = { posts: boolean; stories: boolean };
export type Comentario = { id: number; postId: number; userId: string; texto: string; em: number; respostaA: number | null };
export type Destaque = { id: number; userId: string; nome: string; stories: number[] };
export type Nota = { userId: string; texto: string; em: number };
export type RespostaStory = { userId: string; opcao: number | null; texto: string | null; em: number; valor?: number | null };
export type TipoAtividade = "curtiu" | "comentou" | "respondeu" | "curtiu-comentario" | "marcou" | "mencionou" | "story";
export type ItemAtividade = { chave: string; tipo: TipoAtividade; userId: string; em: number; texto?: string; postId?: number; storyId?: number };

export type TipoIlha = "post" | "story" | "envio" | "mensagem";
export type AlvoIlha = { tipo: "post"; id: number } | { tipo: "story"; userId: string } | { tipo: "mensagem"; userId: string };

type Estado = {
  aberto: boolean;
  /** o feed (de todo mundo) */
  posts: Post[];
  /** não tem mais postagens antigas para buscar no feed */
  fim: boolean;
  curtidas: Record<number, string[]>;
  comentarios: Record<number, Comentario[]>;
  /** curtidas de cada comentário (userIds) */
  comCurtidas: Record<number, string[]>;
  /** perfil aberto (userId) e as postagens dele, à parte do feed */
  perfil: string | null;
  perfilPosts: Post[];
  perfilFim: boolean;
  perfilInfo: { total: number; curtidas: number } | null;
  /** publicações em que o perfil aberto foi marcado */
  perfilMarcado: Post[];
  /** publicações abertas fora do feed (do Direct, da ilha, das notificações) */
  avulsos: Record<number, Post>;
  carregando: boolean;
  enviando: boolean;
  naoLidas: number;
  /** publicações que eu salvei (ids, a mais nova primeiro) */
  salvos: number[];
  /* InstaNanico */
  stories: Story[];
  /** stories antigos que estão em destaques (o banco mostra depois das 24 h) */
  storiesDestaque: Record<number, Story>;
  /** destaques de cada pessoa já aberta */
  destaques: Record<string, Destaque[]>;
  /** os meus melhores amigos (userIds) */
  proximos: string[];
  /** ids dos stories que eu já vi (guardados no navegador) */
  vistos: number[];
  /** quem viu cada story meu (userIds), lido quando abro o meu */
  quemViu: Record<number, string[]>;
  /** respostas às figurinhas dos meus stories */
  respostas: Record<number, RespostaStory[]>;
  /** votos de cada enquete (null = ainda não posso ver) e o meu voto */
  votos: Record<number, Record<string, number> | null>;
  minhaResposta: Record<number, RespostaStory | null>;
  /** a Dynamic Island aberta com um aviso (some sozinha); `fechando` = encolhendo; `alvo` = para onde o toque leva */
  ilha: { texto: string; userId: string | null; tipo: TipoIlha; alvo: AlvoIlha | null; fechando?: boolean } | null;
  /** o app pediu para abrir um post, story ou conversa (toque na ilha); a tela atende e limpa */
  pedido: AlvoIlha | null;
  /** Direct: as minhas mensagens (enviadas e recebidas) e com quem estou conversando agora */
  mensagens: Mensagem[];
  conversaAberta: string | null;
  naoLidasDM: number;
  /** reações das mensagens: mensagem → quem → emoji */
  reacoes: Record<number, Record<string, string>>;
  /** quem está digitando para mim agora (userId → quando avisou) */
  digitando: Record<string, number>;
  notas: Nota[];
  bios: Record<string, string>;
  /** notificações (curtidas, comentários, respostas, marcações, menções e respostas aos stories) */
  atividade: ItemAtividade[];
  /** publicações novas que chegaram enquanto eu rolava o feed (o "Novas publicações" de cima) */
  novas: number;
  /** quantas pessoas viram cada publicação minha */
  visualizacoes: Record<number, number>;
  /** quem eu silenciei (posts e/ou stories somem do meu feed) */
  silenciados: Record<string, Silencio>;
  /** as minhas publicações arquivadas */
  arquivo: Post[];
  /** os grupos do Direct em que estou */
  grupos: GrupoDM[];
  /** quem está digitando em cada grupo (grupo → userId → quando avisou) */
  digitandoGrupo: Record<number, Record<string, number>>;
};
export const useRede = create<Estado>()(() => ({
  aberto: false, posts: [], fim: false, curtidas: {}, comentarios: {}, comCurtidas: {}, perfil: null, perfilPosts: [], perfilFim: false,
  perfilInfo: null, perfilMarcado: [], avulsos: {}, carregando: false, enviando: false, naoLidas: 0, salvos: [],
  stories: [], storiesDestaque: {}, destaques: {}, proximos: [], vistos: lerVistos(), quemViu: {}, respostas: {}, votos: {}, minhaResposta: {},
  ilha: null, pedido: null, mensagens: [], conversaAberta: null, naoLidasDM: 0, reacoes: {}, digitando: {}, notas: [], bios: {},
  atividade: [], novas: 0, visualizacoes: {}, silenciados: {}, arquivo: [], grupos: [], digitandoGrupo: {},
}));

function lerVistos(): number[] {
  const v = local.json<unknown>("insta-vistos");
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number").slice(-400) : [];
}

const PAGINA = 20;
const RE_MIDIA = /^rede\/[0-9a-f-]{36}\/[a-z0-9-]{6,40}\.(webp|gif)$/;
const ehUid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v);
const lerPost = (r: Record<string, unknown>): Post => ({
  id: Number(r.id),
  userId: String(r.user_id),
  texto: String(r.texto ?? "").slice(0, 500),
  midia: typeof r.midia === "string" && r.midia.startsWith("rede/") ? r.midia : null,
  em: Date.parse(String(r.em)) || 0,
  fotos: Array.isArray(r.fotos) ? r.fotos.filter((f): f is string => typeof f === "string" && RE_MIDIA.test(f)).slice(0, 9) : [],
  marcados: Array.isArray(r.marcados) ? r.marcados.filter(ehUid).slice(0, 20) : [],
  editadoEm: r.editado_em ? Date.parse(String(r.editado_em)) || null : null,
  fixadoEm: r.fixado_em ? Date.parse(String(r.fixado_em)) || null : null,
  comentarioFixo: r.comentario_fixo == null ? null : Number(r.comentario_fixo),
  arquivado: r.arquivado === true,
  semComentarios: r.sem_comentarios === true,
  esconderCurtidas: r.esconder_curtidas === true,
  colaborador: ehUid(r.colaborador) ? r.colaborador : null,
  colabAceito: r.colab_aceito === true,
});
const lerComentario = (r: Record<string, unknown>): Comentario => ({
  id: Number(r.id), postId: Number(r.post_id), userId: String(r.user_id), texto: String(r.texto ?? "").slice(0, 280), em: Date.parse(String(r.em)) || 0,
  respostaA: r.resposta_a == null ? null : Number(r.resposta_a),
});
const motivo = (e: unknown, padrao: string) => {
  const m = e as { code?: unknown; message?: unknown };
  return m.code === "P0001" && typeof m.message === "string" ? m.message.slice(0, 140) : errMsg(e, padrao);
};

/* sem o SQL da seção 68 as colunas novas não existem: a consulta volta para as antigas */
let sem68 = false;
type Resposta<R> = { data: R | null; error: { code?: string; message: string } | null; count?: number | null };
async function consulta<R>(fazer: (novo: boolean) => PromiseLike<Resposta<R>>): Promise<Resposta<R>> {
  /* várias saem juntas ao abrir: cada uma que tentou com as colunas novas tenta de novo (não só a primeira a falhar) */
  const tentouNovo = !sem68;
  const r = await fazer(tentouNovo);
  if (r.error && tentouNovo && (r.error.code === "42703" || r.error.code === "PGRST204" || /column|coluna/i.test(r.error.message))) {
    if (!sem68) console.warn("InstaNanico sem as seções 68 e 69 do SQL: usando as colunas antigas");
    sem68 = true;
    return fazer(false);
  }
  return r;
}
const COL_POST = (novo: boolean) =>
  novo ? "id,user_id,texto,midia,em,fotos,marcados,editado_em,fixado_em,comentario_fixo,arquivado,sem_comentarios,esconder_curtidas,colaborador,colab_aceito" : "id,user_id,texto,midia,em";
const COL_COMENT = (novo: boolean) => (novo ? "id,post_id,user_id,texto,em,resposta_a" : "id,post_id,user_id,texto,em");
const COL_STORY = (novo: boolean) => (novo ? "id,user_id,midia,texto,fundo,em,figurinha,so_proximos" : "id,user_id,midia,texto,fundo,em");
const COL_MSG = (novo: boolean) => (novo ? "id,de,para,texto,story_id,post_id,em,lida_em,midia,resposta_a,unica,aberta_em,grupo_id" : "id,de,para,texto,story_id,post_id,em,lida_em");

/** Tenho o celular? (a mochila vem da loja; o banco confere de novo em tudo) */
export const temCelular = () => celularNaMochila;
let celularNaMochila = false;

/** O "usuário" do Instagram: o nome do nanico em minúsculas, sem espaço. */
export const arroba = (nome: string | undefined) => (nome ?? "alguem").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "");
/** Quem tem esse @ (userId), entre os nanicos. */
export const quemEh = (at: string) => getApp().friends.find((f) => f.user_id && arroba(f.name) === at)?.user_id ?? null;

/* ---------- não lidas (última postagem vista fica em "rede-visto"; só conveniência) ---------- */
const visto = () => Number(local.get("rede-visto")) || 0;
function contarNaoLidas() {
  const { posts, aberto } = useRede.getState(), eu = getApp().myUid, v = visto();
  if (aberto) {
    const max = posts.reduce((m, p) => Math.max(m, p.id), v);
    if (max > v) local.set("rede-visto", String(max));
    useRede.setState({ naoLidas: 0 });
    return;
  }
  useRede.setState({ naoLidas: posts.filter((p) => p.id > v && p.userId !== eu).length });
}

/** Acha uma publicação já carregada em qualquer lista (feed, perfil, avulsas). */
export function postCarregado(id: number): Post | undefined {
  const st = useRede.getState();
  return st.posts.find((p) => p.id === id) ?? st.perfilPosts.find((p) => p.id === id) ?? st.perfilMarcado.find((p) => p.id === id) ?? st.avulsos[id];
}
/** Troca uma publicação em todas as listas (editou a legenda). */
function trocarPost(p: Post) {
  const st = useRede.getState();
  const troca = (l: Post[]) => l.map((x) => (x.id === p.id ? p : x));
  useRede.setState({ posts: troca(st.posts), perfilPosts: troca(st.perfilPosts), perfilMarcado: troca(st.perfilMarcado), avulsos: st.avulsos[p.id] ? { ...st.avulsos, [p.id]: p } : st.avulsos });
}
function tirarPost(id: number) {
  const st = useRede.getState();
  const sem = (l: Post[]) => l.filter((x) => x.id !== id);
  const avulsos = { ...st.avulsos };
  delete avulsos[id];
  useRede.setState({ posts: sem(st.posts), perfilPosts: sem(st.perfilPosts), perfilMarcado: sem(st.perfilMarcado), avulsos, salvos: st.salvos.filter((x) => x !== id) });
}

/* ---------- ler ---------- */
async function detalhes(ids: number[]) {
  if (!ids.length) return;
  const [c, k] = await Promise.all([
    sb().from("rede_curtidas").select("post_id,user_id").in("post_id", ids),
    consulta((novo) => sb().from("rede_comentarios").select(COL_COMENT(novo)).in("post_id", ids).order("em")),
  ]);
  const curtidas = { ...useRede.getState().curtidas }, comentarios = { ...useRede.getState().comentarios };
  for (const id of ids) {
    curtidas[id] = [];
    comentarios[id] = [];
  }
  for (const r of c.data ?? []) curtidas[r.post_id]?.push(String(r.user_id));
  const lista = ((k.data ?? []) as unknown as Record<string, unknown>[]).map(lerComentario);
  for (const x of lista) comentarios[x.postId]?.push(x);
  useRede.setState({ curtidas, comentarios });
  /* quantos viram as minhas (só o dono consegue contar) */
  const eu = getApp().myUid;
  const meus = ids.filter((id) => postCarregado(id)?.userId === eu);
  if (!sem68 && meus.length) {
    const { data } = await sb().from("rede_post_vistos").select("post_id").in("post_id", meus).limit(5000);
    const visualizacoes = { ...useRede.getState().visualizacoes };
    for (const id of meus) visualizacoes[id] = 0;
    for (const r of data ?? []) visualizacoes[Number(r.post_id)] = (visualizacoes[Number(r.post_id)] ?? 0) + 1;
    useRede.setState({ visualizacoes });
  }
  if (!sem68 && lista.length) {
    const { data } = await sb().from("rede_comentario_curtidas").select("comentario_id,user_id").in("comentario_id", lista.map((x) => x.id));
    const comCurtidas = { ...useRede.getState().comCurtidas };
    for (const x of lista) comCurtidas[x.id] = [];
    for (const r of data ?? []) comCurtidas[Number(r.comentario_id)]?.push(String(r.user_id));
    useRede.setState({ comCurtidas });
  }
}

const lerPosts = (data: unknown) => ((data ?? []) as unknown as Record<string, unknown>[]).map(lerPost);

/** Lê a primeira página do feed. */
export async function carregarRede() {
  if (!celularNaMochila) return;
  useRede.setState({ carregando: true });
  const { data, error } = await consulta((novo) => sb().from("rede_posts").select(COL_POST(novo)).order("id", { ascending: false }).limit(PAGINA));
  if (error) {
    console.warn("rede nanica indisponível", error.message);
    useRede.setState({ carregando: false });
    return;
  }
  const lidos = lerPosts(data);
  /* as minhas arquivadas o banco ainda me mostra: no feed não aparecem */
  const posts = lidos.filter((p) => !p.arquivado);
  useRede.setState({ posts, fim: lidos.length < PAGINA, carregando: false, novas: 0 });
  await detalhes(posts.map((p) => p.id));
  contarNaoLidas();
}

/** Mais 20 postagens antigas do feed. */
export async function maisPostagens() {
  const { posts, carregando, fim } = useRede.getState();
  if (carregando || fim || !posts.length) return;
  useRede.setState({ carregando: true });
  const { data } = await consulta((novo) => sb().from("rede_posts").select(COL_POST(novo)).lt("id", posts[posts.length - 1].id).order("id", { ascending: false }).limit(PAGINA));
  const lidos = lerPosts(data);
  const novos = lidos.filter((p) => !p.arquivado);
  useRede.setState({ posts: [...useRede.getState().posts, ...novos], fim: lidos.length < PAGINA, carregando: false });
  await detalhes(novos.map((p) => p.id));
}

/** Abre o perfil de alguém: as postagens dele (de 20 em 20), quantas são, as curtidas, onde foi marcado, destaques e bio. */
export function verPerfil(userId: string | null) {
  useRede.setState({ perfil: userId, perfilPosts: [], perfilFim: false, perfilInfo: null, perfilMarcado: [] });
  if (userId) void carregarPerfil(userId);
}
/* as do perfil: as dele e as em que ele é colaborador (aceito), sem as arquivadas */
const doPerfil = (novo: boolean, userId: string) => {
  const q = sb().from("rede_posts").select(COL_POST(novo));
  return novo ? q.or(`user_id.eq.${userId},and(colaborador.eq.${userId},colab_aceito.eq.true)`).eq("arquivado", false) : q.eq("user_id", userId);
};
async function carregarPerfil(userId: string) {
  const { data } = await consulta((novo) => doPerfil(novo, userId).order("id", { ascending: false }).limit(PAGINA));
  if (useRede.getState().perfil !== userId) return;
  const lista = lerPosts(data);
  useRede.setState({ perfilPosts: lista, perfilFim: lista.length < PAGINA });
  void detalhes(lista.map((p) => p.id));
  void lerBio(userId);
  void carregarDestaques(userId);
  /* os números de verdade (não só o que carregou): todas as publicações e todas as curtidas recebidas */
  const ids = await (sem68 ? sb().from("rede_posts").select("id").eq("user_id", userId) : sb().from("rede_posts").select("id").eq("user_id", userId).eq("arquivado", false)).limit(1000);
  const todos = (ids.data ?? []).map((r) => Number(r.id));
  const c = todos.length ? await sb().from("rede_curtidas").select("post_id", { count: "exact", head: true }).in("post_id", todos) : { count: 0 };
  if (useRede.getState().perfil === userId) useRede.setState({ perfilInfo: { total: todos.length, curtidas: c.count ?? 0 } });
  if (!sem68) {
    const m = await sb().from("rede_posts").select(COL_POST(true)).contains("marcados", [userId]).order("id", { ascending: false }).limit(60);
    if (useRede.getState().perfil === userId) {
      const marc = lerPosts(m.data);
      useRede.setState({ perfilMarcado: marc });
      void detalhes(marc.map((p) => p.id));
    }
  }
}
/** Mais 20 postagens do perfil aberto. */
export async function maisDoPerfil() {
  const { perfil, perfilPosts, perfilFim, carregando } = useRede.getState();
  if (!perfil || carregando || perfilFim || !perfilPosts.length) return;
  useRede.setState({ carregando: true });
  const ultimo = Math.min(...perfilPosts.map((p) => p.id));
  const { data } = await consulta((novo) => doPerfil(novo, perfil).lt("id", ultimo).order("id", { ascending: false }).limit(PAGINA));
  const novos = lerPosts(data);
  if (useRede.getState().perfil === perfil) useRede.setState({ perfilPosts: [...useRede.getState().perfilPosts, ...novos], perfilFim: novos.length < PAGINA });
  useRede.setState({ carregando: false });
  await detalhes(novos.map((p) => p.id));
}

/** Busca uma publicação que não está carregada (veio do Direct, da ilha ou das notificações). */
export async function buscarPost(id: number): Promise<Post | null> {
  const ja = postCarregado(id);
  if (ja) return ja;
  const { data } = await consulta((novo) => sb().from("rede_posts").select(COL_POST(novo)).eq("id", id).limit(1));
  const p = lerPosts(data)[0];
  if (!p) return null;
  useRede.setState({ avulsos: { ...useRede.getState().avulsos, [p.id]: p } });
  await detalhes([p.id]);
  return p;
}

/** Procura publicações pela legenda (Explorar). */
export async function buscarPosts(termo: string): Promise<Post[]> {
  const t = termo.trim().replace(/[%_,()]/g, " ").slice(0, 40);
  if (t.length < 2) return [];
  const { data } = await consulta((novo) => sb().from("rede_posts").select(COL_POST(novo)).ilike("texto", `%${t}%`).order("id", { ascending: false }).limit(30));
  const lista = lerPosts(data);
  const avulsos = { ...useRede.getState().avulsos };
  for (const p of lista) avulsos[p.id] = p;
  useRede.setState({ avulsos });
  void detalhes(lista.map((p) => p.id));
  return lista;
}

/* ---------- Dynamic Island ---------- */
let ilhaTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Abre a ilha com um aviso por uns segundos (o envio fica aberto até terminar). Como no iPhone: ela cresce, o conteúdo
 * aparece depois, e no fim o conteúdo some primeiro e ela encolhe (`fechando`, ~0,65 s) antes de sair.
 */
export function avisarIlha(texto: string, userId: string | null, tipo: TipoIlha, ms = 4200, alvo: AlvoIlha | null = null) {
  clearTimeout(ilhaTimer);
  useRede.setState({ ilha: { texto, userId, tipo, alvo } });
  if (ms > 0) ilhaTimer = setTimeout(fecharIlha, ms);
}
export function fecharIlha() {
  clearTimeout(ilhaTimer);
  const atual = useRede.getState().ilha;
  if (!atual || atual.fechando) return;
  useRede.setState({ ilha: { ...atual, fechando: true } });
  ilhaTimer = setTimeout(() => useRede.setState({ ilha: null }), 680);
}
/** Toque na ilha: fecha e pede para a tela abrir o post, o story ou a conversa. */
export function tocarIlha() {
  const alvo = useRede.getState().ilha?.alvo ?? null;
  fecharIlha();
  if (alvo) useRede.setState({ pedido: alvo });
}

/* ---------- stories ---------- */
const lerStory = (r: Record<string, unknown>): Story => ({
  id: Number(r.id),
  userId: String(r.user_id),
  midia: typeof r.midia === "string" && r.midia.startsWith("rede/") ? r.midia : null,
  texto: String(r.texto ?? "").slice(0, 120),
  fundo: FUNDOS.includes(r.fundo as Fundo) ? (r.fundo as Fundo) : "roxo",
  em: Date.parse(String(r.em)) || 0,
  figurinha: lerFigurinha(r.figurinha),
  soProximos: r.so_proximos === true,
});

/** Os stories das últimas 24 h (e os meus vencidos, que o banco ainda me mostra para eu apagar). */
export async function carregarStories() {
  if (!celularNaMochila) return;
  const desde = new Date(Date.now() - DIA_MS).toISOString();
  const eu = getApp().myUid;
  /* os em destaque também vêm do banco depois das 24 h: aqui só os do dia (e os meus vencidos) */
  const { data, error } = await consulta((novo) => {
    let q = sb().from("rede_stories").select(COL_STORY(novo)).order("id");
    if (eu) q = q.or(`em.gt.${desde},user_id.eq.${eu}`);
    return q;
  });
  if (error) return console.warn("stories indisponíveis (seção 34)", error.message);
  useRede.setState({ stories: ((data ?? []) as unknown as Record<string, unknown>[]).map(lerStory) });
  if (!sem68) void carregarProximos();
}

function onStory(row: Record<string, unknown> | null, ev: string) {
  const id = Number(row?.id);
  if (!id) return;
  const st = useRede.getState();
  if (ev === "DELETE") {
    const s = st.stories.find((x) => x.id === id) ?? st.storiesDestaque[id];
    if (s?.midia) soltarImagem(s.midia);
    const storiesDestaque = { ...st.storiesDestaque };
    delete storiesDestaque[id];
    return useRede.setState({ stories: st.stories.filter((x) => x.id !== id), storiesDestaque });
  }
  if (ev !== "INSERT" || st.stories.some((x) => x.id === id)) return;
  const s = lerStory(row!);
  useRede.setState({ stories: [...st.stories, s] });
  const app = getApp();
  if (s.userId !== app.myUid && st.aberto)
    avisarIlha(`${app.friends.find((x) => x.user_id === s.userId)?.name ?? "Alguém"} postou um story`, s.userId, "story", 4200, { tipo: "story", userId: s.userId });
}

/** Marca um story como visto (no navegador e no banco, para o dono saber). Os de destaque, depois das 24 h, só aqui. */
export function marcarVisto(s: Story) {
  const st = useRede.getState();
  if (st.vistos.includes(s.id)) return;
  const vistos = [...st.vistos, s.id].slice(-400);
  useRede.setState({ vistos });
  local.setJson("insta-vistos", vistos);
  if (s.userId !== getApp().myUid && Date.now() - s.em < DIA_MS) void sb().from("rede_stories_vistos").insert({ story_id: s.id }).then(() => {});
}

/** Quem viu um story meu (e o que responderam nas figurinhas dele). */
export async function lerQuemViu(s: Story) {
  const { data } = await sb().from("rede_stories_vistos").select("user_id").eq("story_id", s.id).order("em");
  useRede.setState({ quemViu: { ...useRede.getState().quemViu, [s.id]: (data ?? []).map((r) => String(r.user_id)) } });
  if (s.figurinha) void lerRespostas(s);
}

/** As respostas às figurinhas de um story meu. */
export async function lerRespostas(s: Story) {
  const { data } = await consulta((novo) => sb().from("rede_story_respostas").select(novo ? "user_id,opcao,texto,em,valor" : "user_id,opcao,texto,em").eq("story_id", s.id).order("em", { ascending: false }));
  const lista = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ userId: String(r.user_id), opcao: r.opcao == null ? null : Number(r.opcao), texto: r.texto == null ? null : String(r.texto).slice(0, 200), em: Date.parse(String(r.em)) || 0, valor: r.valor == null ? null : Number(r.valor) }));
  useRede.setState({ respostas: { ...useRede.getState().respostas, [s.id]: lista } });
  if (s.figurinha) void lerVotos(s);
}

/** Os votos da enquete (o banco só mostra para o dono e para quem já votou) e a minha resposta. */
export async function lerVotos(s: Story) {
  const eu = getApp().myUid;
  const [v, minha] = await Promise.all([
    sb().rpc("story_votos", { p_story: s.id }),
    eu ? consulta((novo) => sb().from("rede_story_respostas").select(novo ? "user_id,opcao,texto,em,valor" : "user_id,opcao,texto,em").eq("story_id", s.id).eq("user_id", eu).limit(1)) : Promise.resolve({ data: [] }),
  ]);
  const r = ((minha.data ?? []) as unknown as Record<string, unknown>[])[0];
  const st = useRede.getState();
  useRede.setState({
    votos: { ...st.votos, [s.id]: v.data && typeof v.data === "object" ? (v.data as Record<string, number>) : null },
    minhaResposta: { ...st.minhaResposta, [s.id]: r ? { userId: String(r.user_id), opcao: r.opcao == null ? null : Number(r.opcao), texto: r.texto == null ? null : String(r.texto), em: Date.parse(String(r.em)) || 0, valor: r.valor == null ? null : Number(r.valor) } : null },
  });
}

/** Responde à figurinha de um story: o voto (0 ou 1), o texto da pergunta ou o "lembrar" da contagem. */
export async function responderFigurinha(s: Story, resposta: { opcao?: number; texto?: string; valor?: number }): Promise<boolean> {
  const linha: Record<string, unknown> = { story_id: s.id, opcao: resposta.opcao ?? null, texto: resposta.texto?.trim().slice(0, 200) || null };
  if (resposta.valor !== undefined) linha.valor = Math.round(Math.min(100, Math.max(0, resposta.valor)));
  const { error } = await sb().from("rede_story_respostas").insert(linha);
  if (error) {
    toast(error.code === "23505" ? "Você já respondeu." : motivo(error, "Não deu para responder."));
    return false;
  }
  await lerVotos(s);
  return true;
}

/**
 * Posta um story (a imagem já montada pelo editor). Antes, apaga os meus vencidos (foto e linha), menos os que estão
 * em algum destaque. Devolve o id dele (ou null se não deu).
 */
export async function postarStory(arquivo: File | null, texto: string, fundo: Fundo, extra: { figurinha?: Figurinha | null; soProximos?: boolean } = {}): Promise<number | null> {
  const uid = getApp().myUid;
  if (!uid || useRede.getState().enviando) return null;
  if (!arquivo && !texto.trim()) {
    toast("Escolha uma foto ou escreva o texto do story.");
    return null;
  }
  useRede.setState({ enviando: true });
  avisarIlha(extra.soProximos ? "Postando para os melhores amigos…" : "Postando o seu story…", uid, "envio", 0);
  let midia: string | null = null;
  try {
    const emDestaque = new Set((useRede.getState().destaques[uid] ?? []).flatMap((d) => d.stories));
    const vencidos = useRede.getState().stories.filter((s) => s.userId === uid && Date.now() - s.em >= DIA_MS && !emDestaque.has(s.id));
    if (vencidos.length && (sem68 || useRede.getState().destaques[uid])) {
      const fotos = vencidos.map((s) => s.midia).filter((m): m is string => !!m);
      if (fotos.length) await sb().storage.from("midias").remove(fotos);
      await sb().from("rede_stories").delete().in("id", vencidos.map((s) => s.id));
    }
    if (arquivo) {
      const { blob, ext } = await comprimir(arquivo);
      midia = `rede/${uid}/${newId().toLowerCase()}.${ext}`;
      const up = await sb().storage.from("midias").upload(midia, blob, { contentType: ext === "gif" ? "image/gif" : "image/webp", upsert: false });
      if (up.error) throw up.error;
    }
    const linha: Record<string, unknown> = { midia, texto: texto.trim().slice(0, 120), fundo };
    if (!sem68 && (extra.figurinha || extra.soProximos)) Object.assign(linha, { figurinha: extra.figurinha ?? null, so_proximos: !!extra.soProximos });
    const { data, error } = await sb().from("rede_stories").insert(linha).select("id").single();
    if (error) throw error;
    avisarIlha(extra.soProximos ? "Story para os melhores amigos publicado" : "Seu story foi publicado", uid, "story");
    void carregarStories();
    return (data as { id: number } | null)?.id ?? 0;
  } catch (e) {
    if (midia) void sb().storage.from("midias").remove([midia]);
    fecharIlha();
    toast(e instanceof Error && !("code" in e) ? e.message : motivo(e, "Não deu para postar o story. Confira a internet."));
    return null;
  } finally {
    useRede.setState({ enviando: false });
  }
}

export async function apagarStory(s: Story) {
  if (s.midia) {
    await sb().storage.from("midias").remove([s.midia]);
    soltarImagem(s.midia);
  }
  const { error } = await sb().from("rede_stories").delete().eq("id", s.id);
  if (error) return toast(motivo(error, "Não deu para apagar o story."));
  const st = useRede.getState();
  const storiesDestaque = { ...st.storiesDestaque };
  delete storiesDestaque[s.id];
  const destaques = Object.fromEntries(Object.entries(st.destaques).map(([u, l]) => [u, l.map((d) => ({ ...d, stories: d.stories.filter((x) => x !== s.id) }))]));
  useRede.setState({ stories: st.stories.filter((x) => x.id !== s.id), storiesDestaque, destaques });
}

/* ---------- melhores amigos ---------- */
export async function carregarProximos() {
  const eu = getApp().myUid;
  if (!eu || sem68) return;
  const { data } = await sb().from("rede_proximos").select("amigo").eq("user_id", eu);
  useRede.setState({ proximos: (data ?? []).map((r) => String(r.amigo)) });
}
export async function alternarProximo(amigo: string) {
  const on = useRede.getState().proximos.includes(amigo);
  useRede.setState({ proximos: on ? useRede.getState().proximos.filter((x) => x !== amigo) : [...useRede.getState().proximos, amigo] });
  const { error } = on
    ? await sb().from("rede_proximos").delete().eq("user_id", getApp().myUid ?? "").eq("amigo", amigo)
    : await sb().from("rede_proximos").insert({ amigo });
  if (error) {
    toast(motivo(error, "Não deu para mudar os melhores amigos."));
    void carregarProximos();
  }
}

/* ---------- destaques ---------- */
/** Os destaques de alguém e os stories deles (mesmo os de mais de 24 h). */
export async function carregarDestaques(userId: string) {
  if (sem68) return;
  const { data, error } = await sb().from("rede_destaques").select("id,user_id,nome,rede_destaque_stories(story_id,em)").eq("user_id", userId).order("id");
  if (error) return;
  const lista: Destaque[] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    userId: String(r.user_id),
    nome: String(r.nome ?? "").slice(0, 24),
    stories: ((r.rede_destaque_stories as Record<string, unknown>[] | null) ?? [])
      .sort((a, b) => Date.parse(String(a.em)) - Date.parse(String(b.em)))
      .map((x) => Number(x.story_id)),
  }));
  useRede.setState({ destaques: { ...useRede.getState().destaques, [userId]: lista } });
  const faltam = [...new Set(lista.flatMap((d) => d.stories))].filter((id) => !useRede.getState().stories.some((s) => s.id === id) && !useRede.getState().storiesDestaque[id]);
  if (!faltam.length) return;
  const st = await sb().from("rede_stories").select(COL_STORY(true)).in("id", faltam);
  const storiesDestaque = { ...useRede.getState().storiesDestaque };
  for (const r of (st.data ?? []) as unknown as Record<string, unknown>[]) storiesDestaque[Number(r.id)] = lerStory(r);
  useRede.setState({ storiesDestaque });
}
/** Põe um story meu num destaque (novo, com `nome`, ou um que já existe, pelo id). */
export async function destacar(story: Story, alvo: { id: number } | { nome: string }): Promise<boolean> {
  const eu = getApp().myUid;
  if (!eu) return false;
  let id = "id" in alvo ? alvo.id : 0;
  if (!("id" in alvo)) {
    const nome = alvo.nome.trim().slice(0, 24);
    if (!nome) return false;
    const { data, error } = await sb().from("rede_destaques").insert({ nome }).select("id").single();
    if (error) {
      toast(motivo(error, "Não deu para criar o destaque."));
      return false;
    }
    id = (data as { id: number }).id;
  }
  const { error } = await sb().from("rede_destaque_stories").insert({ destaque_id: id, story_id: story.id });
  if (error && error.code !== "23505") {
    toast(motivo(error, "Não deu para destacar."));
    return false;
  }
  await carregarDestaques(eu);
  toast("Adicionado ao destaque");
  return true;
}
export async function apagarDestaque(d: Destaque) {
  const { error } = await sb().from("rede_destaques").delete().eq("id", d.id);
  if (error) return toast(motivo(error, "Não deu para apagar o destaque."));
  await carregarDestaques(d.userId);
}
export async function tirarDoDestaque(d: Destaque, storyId: number) {
  await sb().from("rede_destaque_stories").delete().eq("destaque_id", d.id).eq("story_id", storyId);
  await carregarDestaques(d.userId);
}
/** O story pelo id (do dia ou de destaque). */
export const storyPorId = (id: number) => useRede.getState().stories.find((s) => s.id === id) ?? useRede.getState().storiesDestaque[id];

/* ---------- Direct (mensagens, seção 35) ---------- */
const lerMensagem = (r: Record<string, unknown>): Mensagem => ({
  id: Number(r.id),
  de: String(r.de),
  para: r.para == null ? "" : String(r.para),
  texto: String(r.texto ?? "").slice(0, 1000),
  storyId: r.story_id == null ? null : Number(r.story_id),
  postId: r.post_id == null ? null : Number(r.post_id),
  em: Date.parse(String(r.em)) || 0,
  lidaEm: r.lida_em ? Date.parse(String(r.lida_em)) || 1 : null,
  midia: typeof r.midia === "string" && r.midia.startsWith("rede/") ? r.midia : null,
  respostaA: r.resposta_a == null ? null : Number(r.resposta_a),
  unica: r.unica === true,
  abertaEm: r.aberta_em ? Date.parse(String(r.aberta_em)) || 1 : null,
  grupoId: r.grupo_id == null ? null : Number(r.grupo_id),
});
const contarDM = () => {
  const st = useRede.getState(), eu = getApp().myUid;
  const grupos = st.grupos.reduce((n, g) => n + naoLidasGrupo(st.mensagens, g.id, g.membros.find((m) => m.userId === eu)?.lidoAte ?? 0, eu), 0);
  useRede.setState({ naoLidasDM: naoLidasDM(st.mensagens, eu) + grupos });
};

/** As minhas últimas 500 mensagens (o banco só devolve as que eu mandei ou recebi), as reações e as notas. */
export async function carregarMensagens() {
  if (!celularNaMochila) return;
  const { data, error } = await consulta((novo) => sb().from("rede_mensagens").select(COL_MSG(novo)).order("id", { ascending: false }).limit(500));
  if (error) return console.warn("mensagens indisponíveis (seção 35)", error.message);
  useRede.setState({ mensagens: ((data ?? []) as unknown as Record<string, unknown>[]).map(lerMensagem) });
  contarDM();
  if (sem68) return;
  limparUnicas();
  void carregarGrupos();
  void carregarNotas();
  const r = await sb().from("rede_msg_reacoes").select("mensagem_id,user_id,emoji").limit(1000);
  const reacoes: Record<number, Record<string, string>> = {};
  for (const x of r.data ?? []) (reacoes[Number(x.mensagem_id)] ??= {})[String(x.user_id)] = String(x.emoji).slice(0, 8);
  useRede.setState({ reacoes });
}

function onMensagem(row: Record<string, unknown> | null, ev: string) {
  const id = Number(row?.id);
  if (!id || !row) return;
  const st = useRede.getState(), eu = getApp().myUid;
  if (ev === "DELETE") {
    const m = st.mensagens.find((x) => x.id === id);
    if (m?.midia) soltarImagem(m.midia);
    useRede.setState({ mensagens: st.mensagens.filter((x) => x.id !== id) });
    return contarDM();
  }
  const m = lerMensagem(row);
  if (ev === "UPDATE") {
    useRede.setState({ mensagens: st.mensagens.map((x) => (x.id === id ? m : x)) });
    limparUnicas();
    return contarDM();
  }
  if (ev !== "INSERT" || st.mensagens.some((x) => x.id === id)) return;
  useRede.setState({ mensagens: [m, ...st.mensagens] });
  if (m.grupoId) {
    const g = st.grupos.find((x) => x.id === m.grupoId);
    if (!g) void carregarGrupos();
    if (m.de !== eu) {
      const dg = { ...(st.digitandoGrupo[m.grupoId] ?? {}) };
      delete dg[m.de];
      useRede.setState({ digitandoGrupo: { ...useRede.getState().digitandoGrupo, [m.grupoId]: dg } });
      if (st.aberto && st.conversaAberta === `g:${m.grupoId}`) void lerGrupo(m.grupoId);
      else if (st.aberto) {
        const nome = getApp().friends.find((x) => x.user_id === m.de)?.name ?? "Alguém";
        avisarIlha(`${nome} em ${g?.nome ?? "grupo"}: ${m.midia ? "mandou um arquivo" : m.postId ? "enviou uma publicação" : m.texto}`, m.de, "mensagem", 4200, { tipo: "mensagem", userId: `g:${m.grupoId}` });
      }
    }
    return contarDM();
  }
  if (m.para === eu) {
    /* chegou a mensagem: o "digitando…" dele some */
    if (st.digitando[m.de]) {
      const digitando = { ...st.digitando };
      delete digitando[m.de];
      useRede.setState({ digitando });
    }
    /* conversa aberta com quem mandou: já fica lida; senão, avisa na ilha */
    if (st.aberto && st.conversaAberta === m.de) void marcarLidas(m.de);
    else if (st.aberto) {
      const nome = getApp().friends.find((x) => x.user_id === m.de)?.name ?? "Alguém";
      const oque = m.midia ? (/\.(webm|m4a|ogg|mp4)$/.test(m.midia) ? "mandou um áudio" : "mandou uma foto") : m.postId ? "enviou uma publicação" : m.texto;
      avisarIlha(`${nome}: ${oque}`, m.de, "mensagem", 4200, { tipo: "mensagem", userId: m.de });
    }
  }
  contarDM();
}

/** Sobe a foto ou o áudio do Direct para a minha pasta. */
async function subirArquivo(arquivo: Blob, tipo: "foto" | "audio"): Promise<string> {
  const uid = getApp().myUid;
  if (!uid) throw new Error("Entre de novo para mandar.");
  if (tipo === "foto") {
    const { blob, ext } = await comprimir(arquivo instanceof File ? arquivo : new File([arquivo], "foto.webp", { type: arquivo.type }));
    const caminho = `rede/${uid}/${newId().toLowerCase()}.${ext}`;
    const up = await sb().storage.from("midias").upload(caminho, blob, { contentType: ext === "gif" ? "image/gif" : "image/webp", upsert: false });
    if (up.error) throw up.error;
    return caminho;
  }
  if (arquivo.size > 5 * 1024 * 1024) throw new Error("Áudio grande demais (até 5 MB).");
  const mp4 = /mp4|m4a|aac/.test(arquivo.type);
  const caminho = `rede/${uid}/${newId().toLowerCase()}.${mp4 ? "m4a" : "webm"}`;
  const up = await sb().storage.from("midias").upload(caminho, arquivo, { contentType: mp4 ? "audio/mp4" : "audio/webm", upsert: false });
  if (up.error) throw up.error;
  return caminho;
}

/** Manda uma mensagem (texto, resposta a um story, uma publicação, foto ou áudio, ou respondendo outra mensagem). */
export async function enviarMensagem(
  para: string,
  texto: string,
  extra: { storyId?: number; postId?: number; arquivo?: Blob; tipo?: "foto" | "audio"; respostaA?: number | null; grupoId?: number | null; unica?: boolean } = {},
): Promise<boolean> {
  if (!texto.trim() && !extra.postId && !extra.arquivo) return false;
  let midia: string | null = null;
  try {
    if (extra.arquivo) {
      if (sem68) throw new Error("Foto e áudio no Direct precisam do SQL novo (seção 68).");
      midia = await subirArquivo(extra.arquivo, extra.tipo ?? "foto");
    }
    if (extra.grupoId && sem68) throw new Error("Grupos precisam do SQL novo (seção 69).");
    const linha: Record<string, unknown> = { para: extra.grupoId ? null : para, texto: texto.trim().slice(0, 1000), story_id: extra.storyId ?? null, post_id: extra.postId ?? null };
    if (!sem68) Object.assign(linha, { midia, resposta_a: extra.respostaA ?? null, grupo_id: extra.grupoId ?? null, unica: !!(extra.unica && midia) });
    const { data, error } = await consulta((novo) => sb().from("rede_mensagens").insert(novo ? linha : { para: linha.para, texto: linha.texto, story_id: linha.story_id, post_id: linha.post_id }).select(COL_MSG(novo)));
    if (error) throw error;
    const nova = ((data ?? []) as unknown as Record<string, unknown>[]).map(lerMensagem).filter((m) => !useRede.getState().mensagens.some((x) => x.id === m.id));
    if (nova.length) useRede.setState({ mensagens: [...nova, ...useRede.getState().mensagens] });
    /* a foto de ver uma vez: guardo o caminho para apagar o arquivo quando ela for aberta */
    if (extra.unica && midia) for (const m of nova) guardarUnica(m.id, midia);
    if (extra.grupoId) void lerGrupo(extra.grupoId);
    return true;
  } catch (e) {
    if (midia) void sb().storage.from("midias").remove([midia]);
    toast(e instanceof Error && !("code" in e) ? e.message : motivo(e, "Não deu para mandar a mensagem. Confira a internet."));
    return false;
  }
}

/** Apaga uma mensagem que eu mandei (some para os dois, como o "cancelar envio" do Instagram). */
export async function apagarMensagem(m: Mensagem) {
  const { error } = await sb().from("rede_mensagens").delete().eq("id", m.id);
  if (error) return toast(motivo(error, "Não deu para apagar a mensagem."));
  if (m.midia) {
    void sb().storage.from("midias").remove([m.midia]);
    soltarImagem(m.midia);
  }
  useRede.setState({ mensagens: useRede.getState().mensagens.filter((x) => x.id !== m.id) });
  contarDM();
}

/** Reage a uma mensagem com um emoji (o mesmo de novo tira a reação). */
export async function reagirMensagem(m: Mensagem, emoji: string) {
  const eu = getApp().myUid;
  if (!eu) return;
  const st = useRede.getState();
  const antes = st.reacoes[m.id]?.[eu];
  const daMsg = { ...(st.reacoes[m.id] ?? {}) };
  if (antes === emoji) delete daMsg[eu];
  else daMsg[eu] = emoji;
  useRede.setState({ reacoes: { ...st.reacoes, [m.id]: daMsg } });
  const { error } =
    antes === emoji
      ? await sb().from("rede_msg_reacoes").delete().eq("mensagem_id", m.id).eq("user_id", eu)
      : antes
        ? await sb().from("rede_msg_reacoes").update({ emoji }).eq("mensagem_id", m.id).eq("user_id", eu)
        : await sb().from("rede_msg_reacoes").insert({ mensagem_id: m.id, emoji });
  if (error) toast(motivo(error, "Não deu para reagir."));
}
function onReacao(row: Record<string, unknown> | null, ev: string) {
  const id = Number(row?.mensagem_id), quem = String(row?.user_id ?? "");
  if (!id || !quem) {
    /* no DELETE só vem a chave; relê tudo */
    if (ev === "DELETE") void carregarMensagens();
    return;
  }
  const st = useRede.getState();
  const daMsg = { ...(st.reacoes[id] ?? {}) };
  if (ev === "DELETE") delete daMsg[quem];
  else daMsg[quem] = String(row?.emoji ?? "").slice(0, 8);
  useRede.setState({ reacoes: { ...st.reacoes, [id]: daMsg } });
}

/** Abre (ou fecha, com null) a conversa e marca como lidas as mensagens dessa pessoa. */
export function abrirConversa(outro: string | null) {
  useRede.setState({ conversaAberta: outro });
  if (outro?.startsWith("g:")) void lerGrupo(Number(outro.slice(2)));
  else if (outro) void marcarLidas(outro);
}
export async function marcarLidas(de: string) {
  const eu = getApp().myUid;
  if (!useRede.getState().mensagens.some((m) => m.de === de && m.para === eu && !m.lidaEm)) return;
  useRede.setState({ mensagens: useRede.getState().mensagens.map((m) => (m.de === de && m.para === eu && !m.lidaEm ? { ...m, lidaEm: Date.now() } : m)) });
  contarDM();
  await sb().rpc("marcar_lidas", { p_de: de });
}

/* ---------- "digitando…" (vai pelo lobby, de quem está no site; nunca grava no banco) ---------- */
let ultimoDigitando = 0;
/** Estou digitando para alguém: avisa no máximo a cada 2,5 s. */
export function avisarDigitando(para: string) {
  const agora = Date.now();
  if (agora - ultimoDigitando < 2500) return;
  ultimoDigitando = agora;
  if (para.startsWith("g:")) enviar("insta", { t: "digitando", grupo: Number(para.slice(2)) });
  else enviar("insta", { t: "digitando", para });
}
const limiteInsta = limitePorPessoa(40, 10000);
function onInsta(m: Record<string, unknown>) {
  const eu = getApp().myUid;
  if (m.t !== "digitando" || !estaNaSala(m.from) || !limiteInsta(String(m.from))) return;
  /* quem mandou é quem está naquela aba (pela presença), não o que veio escrito */
  const fid = getApp().online.find((p) => p.key === m.from)?.fid;
  const de = getApp().friends.find((f) => f.id === fid)?.user_id;
  if (!de || de === eu) return;
  if (typeof m.grupo === "number") {
    /* no grupo: só vale se nós dois estamos nele */
    const g = useRede.getState().grupos.find((x) => x.id === m.grupo);
    if (!g || !g.membros.some((x) => x.userId === de)) return;
    const st = useRede.getState();
    useRede.setState({ digitandoGrupo: { ...st.digitandoGrupo, [g.id]: { ...(st.digitandoGrupo[g.id] ?? {}), [de]: Date.now() } } });
    return;
  }
  if (m.para !== eu) return;
  useRede.setState({ digitando: { ...useRede.getState().digitando, [de]: Date.now() } });
}

/* ---------- notas e bio ---------- */
export async function carregarNotas() {
  if (sem68) return;
  const { data } = await sb().from("rede_notas").select("user_id,texto,em");
  useRede.setState({ notas: (data ?? []).map((r) => ({ userId: String(r.user_id), texto: String(r.texto ?? "").slice(0, 60), em: Date.parse(String(r.em)) || 0 })).filter((n) => Date.now() - n.em < DIA_MS) });
}
export async function salvarNota(texto: string): Promise<boolean> {
  const eu = getApp().myUid;
  const t = texto.trim().slice(0, 60);
  if (!eu) return false;
  const { error } = t
    ? await sb().from("rede_notas").upsert({ user_id: eu, texto: t })
    : await sb().from("rede_notas").delete().eq("user_id", eu);
  if (error) {
    toast(motivo(error, "Não deu para salvar a nota."));
    return false;
  }
  await carregarNotas();
  return true;
}
export async function lerBio(userId: string) {
  if (sem68) return;
  const { data } = await sb().from("rede_perfis").select("bio").eq("user_id", userId).limit(1);
  useRede.setState({ bios: { ...useRede.getState().bios, [userId]: String((data ?? [])[0]?.bio ?? "").slice(0, 150) } });
}
export async function salvarBio(bio: string): Promise<boolean> {
  const eu = getApp().myUid;
  if (!eu) return false;
  const { error } = await sb().from("rede_perfis").upsert({ user_id: eu, bio: bio.trim().slice(0, 150) });
  if (error) {
    toast(motivo(error, "Não deu para salvar a bio."));
    return false;
  }
  await lerBio(eu);
  return true;
}

/* ---------- notificações ---------- */
/**
 * O que aconteceu comigo: curtidas e comentários nas minhas publicações (com a hora de cada um), respostas e curtidas
 * nos meus comentários, quando me marcaram ou me @mencionaram, e as respostas aos meus stories. As 60 mais novas.
 */
export async function carregarAtividade() {
  const eu = getApp().myUid;
  if (!eu || !celularNaMochila) return;
  const meuAt = arroba(getApp().friends.find((f) => f.user_id === eu)?.name);
  const out: ItemAtividade[] = [];
  const meus = await sb().from("rede_posts").select("id").eq("user_id", eu).order("id", { ascending: false }).limit(200);
  const ids = (meus.data ?? []).map((r) => Number(r.id));
  const [curt, com, meusCom, marcou, citou] = await Promise.all([
    ids.length ? sb().from("rede_curtidas").select("post_id,user_id,em").in("post_id", ids).neq("user_id", eu).order("em", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
    ids.length ? consulta((novo) => sb().from("rede_comentarios").select(COL_COMENT(novo)).in("post_id", ids).neq("user_id", eu).order("em", { ascending: false }).limit(60)) : Promise.resolve({ data: [] }),
    sb().from("rede_comentarios").select("id").eq("user_id", eu).order("id", { ascending: false }).limit(200),
    sem68 ? Promise.resolve({ data: [] }) : sb().from("rede_posts").select("id,user_id,em").contains("marcados", [eu]).neq("user_id", eu).order("id", { ascending: false }).limit(30),
    meuAt.length >= 2 ? consulta((novo) => sb().from("rede_comentarios").select(COL_COMENT(novo)).ilike("texto", `%@${meuAt}%`).neq("user_id", eu).order("em", { ascending: false }).limit(30)) : Promise.resolve({ data: [] }),
  ]);
  for (const r of (curt.data ?? []) as unknown as Record<string, unknown>[]) out.push({ chave: `c${r.post_id}${r.user_id}`, tipo: "curtiu", userId: String(r.user_id), em: Date.parse(String(r.em)) || 0, postId: Number(r.post_id) });
  for (const c of ((com.data ?? []) as unknown as Record<string, unknown>[]).map(lerComentario)) out.push({ chave: `k${c.id}`, tipo: "comentou", userId: c.userId, em: c.em, texto: c.texto, postId: c.postId });
  for (const r of (marcou.data ?? []) as unknown as Record<string, unknown>[]) out.push({ chave: `m${r.id}`, tipo: "marcou", userId: String(r.user_id), em: Date.parse(String(r.em)) || 0, postId: Number(r.id) });
  for (const c of ((citou.data ?? []) as unknown as Record<string, unknown>[]).map(lerComentario))
    if (mencionados(c.texto).includes(meuAt) && !out.some((x) => x.chave === `k${c.id}`)) out.push({ chave: `@${c.id}`, tipo: "mencionou", userId: c.userId, em: c.em, texto: c.texto, postId: c.postId });
  const meusIds = (meusCom.data ?? []).map((r) => Number(r.id));
  if (!sem68 && meusIds.length) {
    const [resp, ccurt] = await Promise.all([
      sb().from("rede_comentarios").select(COL_COMENT(true)).in("resposta_a", meusIds).neq("user_id", eu).order("em", { ascending: false }).limit(40),
      sb().from("rede_comentario_curtidas").select("comentario_id,user_id,em").in("comentario_id", meusIds).neq("user_id", eu).order("em", { ascending: false }).limit(40),
    ]);
    const postDoComentario = new Map<number, number>();
    if (ccurt.data?.length) {
      const pc = await sb().from("rede_comentarios").select("id,post_id").in("id", ccurt.data.map((r) => Number(r.comentario_id)));
      for (const r of pc.data ?? []) postDoComentario.set(Number(r.id), Number(r.post_id));
    }
    for (const c of ((resp.data ?? []) as unknown as Record<string, unknown>[]).map(lerComentario))
      if (!out.some((x) => x.chave === `k${c.id}`)) out.push({ chave: `r${c.id}`, tipo: "respondeu", userId: c.userId, em: c.em, texto: c.texto, postId: c.postId });
    for (const r of (ccurt.data ?? []) as unknown as Record<string, unknown>[]) out.push({ chave: `cc${r.comentario_id}${r.user_id}`, tipo: "curtiu-comentario", userId: String(r.user_id), em: Date.parse(String(r.em)) || 0, postId: postDoComentario.get(Number(r.comentario_id)) });
  }
  /* respostas aos meus stories chegam pelo Direct */
  for (const m of useRede.getState().mensagens)
    if (m.para === eu && m.storyId) out.push({ chave: `s${m.id}`, tipo: "story", userId: m.de, em: m.em, texto: m.texto, storyId: m.storyId });
  useRede.setState({ atividade: out.sort((a, b) => b.em - a.em).slice(0, 60) });
}

/* ---------- tempo real ---------- */
function onPost(row: Record<string, unknown> | null, ev: string) {
  const id = Number(row?.id);
  if (!id) return;
  const st = useRede.getState();
  if (ev === "DELETE") {
    const p = postCarregado(id);
    for (const f of p ? [p.midia, ...p.fotos] : []) if (f) soltarImagem(f);
    tirarPost(id);
    contarNaoLidas();
    return;
  }
  if (ev === "UPDATE") {
    if (postCarregado(id)) trocarPost(lerPost(row!));
    return;
  }
  if (ev !== "INSERT" || st.posts.some((x) => x.id === id)) return;
  const p = lerPost(row!);
  const s = getApp();
  if (p.userId !== s.myUid) {
    const f = s.friends.find((x) => x.user_id === p.userId);
    avisarTexto(f?.id ?? null, `${f?.name ?? "Alguém"} postou no InstaNanico`);
    if (st.aberto) avisarIlha(`${f?.name ?? "Alguém"} publicou uma foto`, p.userId, "post", 4200, { tipo: "post", id: p.id });
    if (s.myUid && p.marcados.includes(s.myUid)) void carregarAtividade();
  }
  useRede.setState({
    posts: [p, ...st.posts],
    curtidas: { ...st.curtidas, [p.id]: [] },
    comentarios: { ...st.comentarios, [p.id]: [] },
    novas: p.userId === s.myUid ? st.novas : st.novas + 1,
    perfilPosts: st.perfil === p.userId ? [p, ...st.perfilPosts] : st.perfilPosts,
  });
  contarNaoLidas();
}

/* curtida ou comentário mudou: relê os detalhes daquela postagem (no DELETE de comentário só vem o id) */
function onDetalhe(row: Record<string, unknown> | null) {
  const st = useRede.getState();
  let post = Number(row?.post_id);
  if (!post && row?.id) post = Object.values(st.comentarios).flat().find((c) => c.id === Number(row.id))?.postId ?? 0;
  if (!post && row?.comentario_id) post = Object.values(st.comentarios).flat().find((c) => c.id === Number(row.comentario_id))?.postId ?? 0;
  if (post && postCarregado(post)) void detalhes([post]);
}

let ligado = false;
/** Liga a rede (uma vez, depois do login). `tenho` diz se o celular está na mochila (muda ao comprar). */
export function iniciarRede(tenho: boolean) {
  const antes = celularNaMochila;
  celularNaMochila = tenho;
  if (tenho && !antes) {
    void carregarRede();
    void carregarStories();
    void carregarMensagens();
  }
  if (ligado) return;
  ligado = true;
  aoMudarTabela("rede_posts", onPost);
  aoMudarTabela("rede_stories", onStory);
  aoMudarTabela("rede_mensagens", onMensagem);
  aoMudarTabela("rede_curtidas", onDetalhe);
  aoMudarTabela("rede_comentarios", onDetalhe);
  aoMudarTabela("rede_comentario_curtidas", onDetalhe);
  aoMudarTabela("rede_msg_reacoes", onReacao);
  aoMudarTabela("rede_notas", () => void carregarNotas());
  aoMudarTabela("rede_story_respostas", (row) => {
    const s = storyPorId(Number(row?.story_id));
    if (s && s.userId === getApp().myUid) void lerRespostas(s);
  });
  aoMudarTabela("rede_destaque_stories", () => {
    const p = useRede.getState().perfil;
    if (p) void carregarDestaques(p);
  });
  aoReceber("insta", onInsta);
  aoMudarTabela("rede_grupos", () => void carregarGrupos());
  aoMudarTabela("rede_grupo_membros", () => void carregarGrupos());
}

/* ---------- abrir e fechar o celular ---------- */
export function abrirCelular() {
  useRede.setState({ aberto: true });
  contarNaoLidas();
  if (!useRede.getState().posts.length) void carregarRede();
  void carregarStories();
  void carregarMensagens();
  void carregarSalvos();
  void carregarSilenciados();
  const eu = getApp().myUid;
  if (eu) void carregarDestaques(eu);
}
export function fecharCelular() {
  /* as imagens da rede saem da memória ao fechar */
  const st = useRede.getState();
  for (const p of [...st.posts, ...st.perfilPosts, ...st.perfilMarcado, ...Object.values(st.avulsos)]) for (const f of [p.midia, ...p.fotos]) if (f) soltarImagem(f);
  for (const s of [...st.stories, ...Object.values(st.storiesDestaque)]) if (s.midia) soltarImagem(s.midia);
  useRede.setState({ aberto: false, ilha: null, pedido: null, conversaAberta: null });
  contarNaoLidas();
}

/* ---------- escrever ---------- */
/** Publica: uma foto, várias (carrossel, até 10) ou só texto; com legenda e pessoas marcadas. */
export async function postar(
  texto: string,
  arquivos: File[],
  marcados: string[] = [],
  opcoes: { colaborador?: string | null; semComentarios?: boolean; esconderCurtidas?: boolean } = {},
): Promise<number | null> {
  const uid = getApp().myUid;
  if (!uid || useRede.getState().enviando) return null;
  if (!texto.trim() && !arquivos.length) {
    toast("Escolha uma foto ou escreva alguma coisa.");
    return null;
  }
  if (arquivos.length > 1 && sem68) {
    toast("Carrossel precisa do SQL novo (seção 68). Vai só a primeira foto.");
    arquivos = arquivos.slice(0, 1);
  }
  useRede.setState({ enviando: true });
  avisarIlha(arquivos.length > 1 ? `Publicando ${arquivos.length} fotos…` : "Publicando…", uid, "envio", 0);
  const subidas: string[] = [];
  try {
    for (const arquivo of arquivos.slice(0, 10)) {
      const { blob, ext } = await comprimir(arquivo);
      const caminho = `rede/${uid}/${newId().toLowerCase()}.${ext}`;
      const up = await sb().storage.from("midias").upload(caminho, blob, { contentType: ext === "gif" ? "image/gif" : "image/webp", upsert: false });
      if (up.error) throw up.error;
      subidas.push(caminho);
    }
    const linha: Record<string, unknown> = { texto: texto.trim().slice(0, 500), midia: subidas[0] ?? null };
    if (!sem68)
      Object.assign(linha, {
        fotos: subidas.slice(1),
        marcados: marcados.filter((m) => m !== uid).slice(0, 20),
        colaborador: opcoes.colaborador && opcoes.colaborador !== uid ? opcoes.colaborador : null,
        sem_comentarios: !!opcoes.semComentarios,
        esconder_curtidas: !!opcoes.esconderCurtidas,
      });
    const { data, error } = await consulta((novo) => sb().from("rede_posts").insert(linha).select(COL_POST(novo)).single());
    if (error) throw error;
    const id = Number((data as { id?: unknown } | null)?.id) || 0;
    /* aparece na hora para quem postou (o tempo real chega depois e não repete) */
    if (id && !useRede.getState().posts.some((x) => x.id === id)) {
      const p = lerPost(data as unknown as Record<string, unknown>);
      const st = useRede.getState();
      useRede.setState({ posts: [p, ...st.posts], curtidas: { ...st.curtidas, [id]: [] }, comentarios: { ...st.comentarios, [id]: [] } });
    }
    avisarIlha("Publicado", uid, "post");
    /* o convite de colaboração chega pelo Direct, com a publicação e os botões de aceitar */
    if (id && opcoes.colaborador && opcoes.colaborador !== uid && !sem68) void enviarMensagem(opcoes.colaborador, CONVITE_COLAB, { postId: id });
    return id || 1;
  } catch (e) {
    if (subidas.length) void sb().storage.from("midias").remove(subidas);
    fecharIlha();
    toast(e instanceof Error && !("code" in e) ? e.message : motivo(e, "Não deu para postar. Confira a internet."));
    return null;
  } finally {
    useRede.setState({ enviando: false });
  }
}

/** Troca a legenda (e quem está marcado) de uma publicação minha. */
export async function editarPost(post: Post, texto: string, marcados = post.marcados): Promise<boolean> {
  const { data, error } = await sb().from("rede_posts").update({ texto: texto.trim().slice(0, 500), marcados }).eq("id", post.id).select(COL_POST(true));
  if (error) {
    toast(motivo(error, "Não deu para editar."));
    return false;
  }
  const p = lerPosts(data)[0];
  if (p) trocarPost(p);
  return true;
}

/* as curtidas mudam na hora na tela (como no app) e voltam se o banco recusar; um toque de cada vez por publicação */
const curtindo = new Set<number>();
export async function curtir(post: Post, so: "curtir" | "alternar" = "alternar") {
  const eu = getApp().myUid;
  if (!eu || curtindo.has(post.id)) return;
  const lista = useRede.getState().curtidas[post.id] ?? [];
  const ja = lista.includes(eu);
  if (ja && so === "curtir") return;
  curtindo.add(post.id);
  useRede.setState({ curtidas: { ...useRede.getState().curtidas, [post.id]: ja ? lista.filter((u) => u !== eu) : [...lista, eu] } });
  const { error } = ja
    ? await sb().from("rede_curtidas").delete().eq("post_id", post.id).eq("user_id", eu)
    : await sb().from("rede_curtidas").insert({ post_id: post.id });
  curtindo.delete(post.id);
  if (error && error.code !== "23505") toast(motivo(error, "Não deu para curtir."));
  await detalhes([post.id]);
}

const curtindoCom = new Set<number>();
export async function curtirComentario(c: Comentario) {
  const eu = getApp().myUid;
  if (!eu || curtindoCom.has(c.id)) return;
  const lista = useRede.getState().comCurtidas[c.id] ?? [];
  const ja = lista.includes(eu);
  curtindoCom.add(c.id);
  useRede.setState({ comCurtidas: { ...useRede.getState().comCurtidas, [c.id]: ja ? lista.filter((u) => u !== eu) : [...lista, eu] } });
  const { error } = ja
    ? await sb().from("rede_comentario_curtidas").delete().eq("comentario_id", c.id).eq("user_id", eu)
    : await sb().from("rede_comentario_curtidas").insert({ comentario_id: c.id });
  curtindoCom.delete(c.id);
  if (error && error.code !== "23505") {
    toast(motivo(error, "Não deu para curtir o comentário."));
    await detalhes([c.postId]);
  }
}

export async function comentar(post: Post, texto: string, respostaA: number | null = null): Promise<boolean> {
  if (!texto.trim()) return false;
  const linha: Record<string, unknown> = { post_id: post.id, texto: texto.slice(0, 280) };
  if (respostaA && !sem68) linha.resposta_a = respostaA;
  const { error } = await sb().from("rede_comentarios").insert(linha);
  if (error) {
    toast(motivo(error, "Não deu para comentar."));
    return false;
  }
  await detalhes([post.id]);
  return true;
}

export async function apagarPost(post: Post) {
  const fotos = [post.midia, ...post.fotos].filter((f): f is string => !!f);
  if (fotos.length) {
    await sb().storage.from("midias").remove(fotos);
    for (const f of fotos) soltarImagem(f);
  }
  const { error } = await sb().from("rede_posts").delete().eq("id", post.id);
  if (error) return toast(motivo(error, "Não deu para apagar."));
  tirarPost(post.id);
}

export async function apagarComentario(c: Comentario) {
  const { error } = await sb().from("rede_comentarios").delete().eq("id", c.id);
  if (error) return toast(motivo(error, "Não deu para apagar."));
  await detalhes([c.postId]);
}

/* ---------- salvos ---------- */
export async function carregarSalvos() {
  const eu = getApp().myUid;
  if (!eu || !celularNaMochila || sem68) return;
  const { data, error } = await sb().from("rede_salvos").select("post_id").eq("user_id", eu).order("em", { ascending: false }).limit(300);
  if (!error) useRede.setState({ salvos: (data ?? []).map((r) => Number(r.post_id)) });
}
export async function salvar(post: Post) {
  const eu = getApp().myUid;
  if (!eu) return;
  if (sem68) return toast("Salvar precisa do SQL novo (seção 68).");
  const ja = useRede.getState().salvos.includes(post.id);
  useRede.setState({ salvos: ja ? useRede.getState().salvos.filter((x) => x !== post.id) : [post.id, ...useRede.getState().salvos] });
  const { error } = ja
    ? await sb().from("rede_salvos").delete().eq("user_id", eu).eq("post_id", post.id)
    : await sb().from("rede_salvos").insert({ post_id: post.id });
  if (error && error.code !== "23505") {
    toast(motivo(error, "Não deu para salvar."));
    void carregarSalvos();
  } else if (!ja) toast("Salvo");
}
/** As publicações salvas, buscando as que não estão carregadas. */
export async function postsSalvos(): Promise<Post[]> {
  const ids = useRede.getState().salvos;
  const faltam = ids.filter((id) => !postCarregado(id));
  if (faltam.length) {
    const { data } = await consulta((novo) => sb().from("rede_posts").select(COL_POST(novo)).in("id", faltam));
    const avulsos = { ...useRede.getState().avulsos };
    const lista = lerPosts(data);
    for (const p of lista) avulsos[p.id] = p;
    useRede.setState({ avulsos });
    void detalhes(lista.map((p) => p.id));
  }
  return ids.map((id) => postCarregado(id)).filter((p): p is Post => !!p);
}

/* ============ seção 69: fixar, arquivar, colaboração, visualizações, silenciar, visualização única e grupos ============ */
/** O texto do convite de colaboração no Direct (a tela reconhece por ele e mostra Aceitar/Recusar). */
export const CONVITE_COLAB = "Convidou você para colaborar numa publicação";
/** O texto que o editor manda quando menciona alguém no story (a tela mostra "Adicionar ao seu story"). */
export const MENCAO_STORY = "Mencionou você no story";

/** Muda uma publicação minha (fixar, arquivar, comentários, curtidas, comentário fixado). */
async function ajustarPost(post: Post, campos: Record<string, unknown>, ok?: string): Promise<boolean> {
  if (sem68) {
    toast("Isso precisa do SQL novo (seção 69).");
    return false;
  }
  const { data, error } = await sb().from("rede_posts").update(campos).eq("id", post.id).select(COL_POST(true));
  if (error) {
    toast(motivo(error, "Não deu para mudar a publicação."));
    return false;
  }
  const p = lerPosts(data)[0];
  if (p) {
    trocarPost(p);
    if (p.arquivado) {
      const st = useRede.getState();
      useRede.setState({ posts: st.posts.filter((x) => x.id !== p.id), perfilPosts: st.perfilPosts.filter((x) => x.id !== p.id), arquivo: [p, ...st.arquivo.filter((x) => x.id !== p.id)] });
    } else if ("arquivado" in campos) {
      const st = useRede.getState();
      useRede.setState({ arquivo: st.arquivo.filter((x) => x.id !== p.id), perfilPosts: st.perfil === p.userId ? [p, ...st.perfilPosts.filter((x) => x.id !== p.id)] : st.perfilPosts });
    }
  }
  if (ok) toast(ok);
  return true;
}
export const fixarPost = (p: Post, sim: boolean) => ajustarPost(p, { fixado_em: sim ? new Date().toISOString() : null }, sim ? "Fixada no seu perfil" : "Desafixada");
export const arquivarPost = (p: Post, sim: boolean) => ajustarPost(p, { arquivado: sim }, sim ? "Arquivada: só você vê no Arquivo" : "Voltou para o perfil");
export const fixarComentario = (p: Post, c: Comentario | null) => ajustarPost(p, { comentario_fixo: c?.id ?? null }, c ? "Comentário fixado" : "Comentário desafixado");
export const mudarComentarios = (p: Post, desativar: boolean) => ajustarPost(p, { sem_comentarios: desativar }, desativar ? "Comentários desativados" : "Comentários ativados");
export const mudarCurtidas = (p: Post, esconder: boolean) => ajustarPost(p, { esconder_curtidas: esconder }, esconder ? "Curtidas escondidas" : "Curtidas à mostra");

/** As minhas publicações arquivadas. */
export async function carregarArquivo() {
  const eu = getApp().myUid;
  if (!eu || sem68) return;
  const { data } = await sb().from("rede_posts").select(COL_POST(true)).eq("user_id", eu).eq("arquivado", true).order("id", { ascending: false }).limit(200);
  const arquivo = lerPosts(data);
  useRede.setState({ arquivo });
  void detalhes(arquivo.map((p) => p.id));
}

/** Aceitar (ou recusar) o convite para colaborar numa publicação. */
export async function aceitarColab(post: Post, aceitar: boolean) {
  const { data, error } = await sb().rpc("aceitar_colab", { p_post: post.id, p_aceitar: aceitar });
  if (error || !data) return toast(motivo(error ?? {}, "Esse convite não vale mais."));
  const p = { ...post, colabAceito: aceitar, colaborador: aceitar ? post.colaborador : null };
  trocarPost(p);
  useRede.setState({ avulsos: { ...useRede.getState().avulsos, [p.id]: p } });
  toast(aceitar ? "Agora a publicação aparece no seu perfil também" : "Convite recusado");
}

/* quem viu: cada publicação conta uma vez por pessoa (o banco ignora a repetida) */
const jaViPosts = new Set<number>();
export function marcarPostVisto(p: Post) {
  const eu = getApp().myUid;
  if (!eu || sem68 || p.userId === eu || jaViPosts.has(p.id)) return;
  jaViPosts.add(p.id);
  void sb().from("rede_post_vistos").upsert({ post_id: p.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true }).then(() => {});
}

/* ---------- silenciar ---------- */
export async function carregarSilenciados() {
  const eu = getApp().myUid;
  if (!eu || sem68 || !celularNaMochila) return;
  const { data } = await sb().from("rede_silenciados").select("alvo,posts,stories").eq("user_id", eu);
  useRede.setState({ silenciados: Object.fromEntries((data ?? []).map((r) => [String(r.alvo), { posts: r.posts !== false, stories: r.stories !== false }])) });
}
/** Silencia os posts e/ou os stories de alguém (os dois falsos = deixa de silenciar). */
export async function silenciar(alvo: string, s: Silencio) {
  const eu = getApp().myUid;
  if (!eu || sem68) return toast("Silenciar precisa do SQL novo (seção 69).");
  const silenciados = { ...useRede.getState().silenciados };
  if (s.posts || s.stories) silenciados[alvo] = s;
  else delete silenciados[alvo];
  useRede.setState({ silenciados });
  const { error } =
    s.posts || s.stories
      ? await sb().from("rede_silenciados").upsert({ user_id: eu, alvo, posts: s.posts, stories: s.stories })
      : await sb().from("rede_silenciados").delete().eq("user_id", eu).eq("alvo", alvo);
  if (error) {
    toast(motivo(error, "Não deu para silenciar."));
    void carregarSilenciados();
  }
}

/* ---------- foto de visualização única ---------- */
const lerUnicas = () => {
  const v = local.json<Record<string, unknown>>("insta-unicas");
  return v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string" && RE_ARQUIVO.test(e[1]))) : {};
};
const RE_ARQUIVO = /^rede\/[0-9a-f-]{36}\/[a-z0-9-]{6,40}\.(webp|gif|webm|m4a|ogg|mp4)$/;
function guardarUnica(id: number, caminho: string) {
  local.setJson("insta-unicas", { ...lerUnicas(), [id]: caminho });
}
/** Quem mandou apaga o arquivo das fotos de ver uma vez que já foram abertas (ou cujas mensagens sumiram). */
function limparUnicas() {
  const guardadas = lerUnicas();
  const ms = useRede.getState().mensagens;
  const apagar = Object.entries(guardadas).filter(([id]) => {
    const m = ms.find((x) => x.id === Number(id));
    return m ? !!m.abertaEm : false;
  });
  if (!apagar.length) return;
  void sb().storage.from("midias").remove(apagar.map(([, c]) => c));
  for (const [id] of apagar) delete guardadas[id];
  local.setJson("insta-unicas", guardadas);
}
/** Abre a foto de ver uma vez (só quem recebeu, uma vez): devolve o endereço para mostrar agora. */
export async function abrirUnica(m: Mensagem): Promise<string | null> {
  const { data, error } = await sb().rpc("abrir_unica", { p_msg: m.id });
  const caminho = typeof data === "string" && RE_ARQUIVO.test(data) ? data : null;
  useRede.setState({ mensagens: useRede.getState().mensagens.map((x) => (x.id === m.id ? { ...x, midia: null, abertaEm: Date.now() } : x)) });
  if (error || !caminho) {
    toast("Essa foto já foi aberta.");
    return null;
  }
  const { data: blob } = await sb().storage.from("midias").download(caminho);
  return blob ? URL.createObjectURL(blob) : null;
}

/* ---------- grupos do Direct ---------- */
export async function carregarGrupos() {
  if (sem68 || !celularNaMochila) return;
  const { data, error } = await sb().from("rede_grupos").select("id,nome,criado_por,rede_grupo_membros(user_id,lido_ate)").order("id");
  if (error) return;
  useRede.setState({
    grupos: ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      nome: String(r.nome ?? "").slice(0, 40),
      criadoPor: ehUid(r.criado_por) ? r.criado_por : null,
      membros: ((r.rede_grupo_membros as Record<string, unknown>[] | null) ?? []).filter((x) => ehUid(x.user_id)).map((x) => ({ userId: String(x.user_id), lidoAte: Number(x.lido_ate) || 0 })),
    })),
  });
  contarDM();
}
export async function criarGrupo(nome: string, membros: string[]): Promise<number | null> {
  if (sem68) {
    toast("Grupos precisam do SQL novo (seção 69).");
    return null;
  }
  const { data, error } = await sb().rpc("criar_grupo", { p_nome: nome.trim().slice(0, 40), p_membros: membros });
  if (error) {
    toast(motivo(error, "Não deu para criar o grupo."));
    return null;
  }
  await carregarGrupos();
  return Number(data) || null;
}
export async function adicionarAoGrupo(g: GrupoDM, membros: string[]) {
  const { error } = await sb().rpc("grupo_adicionar", { p_grupo: g.id, p_membros: membros });
  if (error) return toast(motivo(error, "Não deu para adicionar."));
  await carregarGrupos();
}
export async function renomearGrupo(g: GrupoDM, nome: string) {
  const { error } = await sb().from("rede_grupos").update({ nome: nome.trim().slice(0, 40) }).eq("id", g.id);
  if (error) return toast(motivo(error, "Não deu para mudar o nome."));
  await carregarGrupos();
}
export async function sairDoGrupo(g: GrupoDM) {
  const eu = getApp().myUid;
  const { error } = await sb().from("rede_grupo_membros").delete().eq("grupo_id", g.id).eq("user_id", eu ?? "");
  if (error) return toast(motivo(error, "Não deu para sair do grupo."));
  const st = useRede.getState();
  useRede.setState({ grupos: st.grupos.filter((x) => x.id !== g.id), mensagens: st.mensagens.filter((m) => m.grupoId !== g.id), conversaAberta: st.conversaAberta === `g:${g.id}` ? null : st.conversaAberta });
  contarDM();
}
/** Marca o grupo como lido até a última mensagem. */
export async function lerGrupo(id: number) {
  const eu = getApp().myUid;
  const ultima = useRede.getState().mensagens.filter((m) => m.grupoId === id).reduce((n, m) => Math.max(n, m.id), 0);
  const st = useRede.getState();
  const g = st.grupos.find((x) => x.id === id);
  if (!g || !eu || (g.membros.find((m) => m.userId === eu)?.lidoAte ?? 0) >= ultima) return;
  useRede.setState({ grupos: st.grupos.map((x) => (x.id === id ? { ...x, membros: x.membros.map((m) => (m.userId === eu ? { ...m, lidoAte: ultima } : m)) } : x)) });
  contarDM();
  await sb().rpc("grupo_lido", { p_grupo: id, p_ate: ultima });
}

/* ---------- "Adicione o seu" ---------- */
/** Quem já entrou na corrente (o primeiro story e os que responderam), dos que eu posso ver. */
export async function participantesAdicione(origem: number): Promise<Story[]> {
  if (sem68) return [];
  const { data } = await sb().from("rede_stories").select(COL_STORY(true)).or(`id.eq.${origem},figurinha->>origem.eq.${origem}`).order("id").limit(100);
  const lista = ((data ?? []) as unknown as Record<string, unknown>[]).map(lerStory);
  const storiesDestaque = { ...useRede.getState().storiesDestaque };
  for (const s of lista) if (!useRede.getState().stories.some((x) => x.id === s.id)) storiesDestaque[s.id] = s;
  useRede.setState({ storiesDestaque });
  return lista;
}
