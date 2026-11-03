/*
 * Rede social nanica (seção 18 do seguranca.sql). Só quem tem o Celular lê e escreve, e quem garante é o banco
 * (RLS com tem_item('celular')): sem o item, as consultas voltam vazias e o tempo real não chega.
 * Feed de 20 em 20, curtidas e comentários das postagens carregadas, imagem no bucket "midias" (pasta rede/<uid>/),
 * comprimida no navegador como as mídias. Postar e curtir não dão moedas.
 * InstaNanico (seção 34): stories de 24 h (foto ou texto sobre cor), "já vi" no navegador e no banco (o dono vê quem
 * viu), e a Dynamic Island do celular avisando post, story e envio.
 */
import { create } from "zustand";
import { avisarTexto } from "@/features/hall/ganhos";
import { comprimir, soltarImagem } from "@/features/midias/midiasDados";
import { aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local, newId } from "@/lib/util";
import { DIA_MS, FUNDOS, naoLidasDM, type Fundo, type Mensagem, type Story } from "./insta";

export type Post = { id: number; userId: string; texto: string; midia: string | null; em: number };
export type Comentario = { id: number; postId: number; userId: string; texto: string; em: number };

export type TipoIlha = "post" | "story" | "envio" | "mensagem";
export type AlvoIlha = { tipo: "post"; id: number } | { tipo: "story"; userId: string } | { tipo: "mensagem"; userId: string };

type Estado = {
  aberto: boolean;
  posts: Post[];
  /** não tem mais postagens antigas para buscar */
  fim: boolean;
  curtidas: Record<number, string[]>;
  comentarios: Record<number, Comentario[]>;
  /** perfil aberto (userId): mostra só as postagens dessa pessoa */
  perfil: string | null;
  carregando: boolean;
  enviando: boolean;
  naoLidas: number;
  /* InstaNanico */
  stories: Story[];
  /** ids dos stories que eu já vi (guardados no navegador) */
  vistos: number[];
  /** quem viu cada story meu (userIds), lido quando abro o meu */
  quemViu: Record<number, string[]>;
  /** a Dynamic Island aberta com um aviso (some sozinha); `fechando` = encolhendo; `alvo` = para onde o toque leva */
  ilha: { texto: string; userId: string | null; tipo: TipoIlha; alvo: AlvoIlha | null; fechando?: boolean } | null;
  /** o app pediu para abrir um post, story ou conversa (toque na ilha); a tela atende e limpa */
  pedido: AlvoIlha | null;
  /** Direct: as minhas mensagens (enviadas e recebidas) e com quem estou conversando agora */
  mensagens: Mensagem[];
  conversaAberta: string | null;
  naoLidasDM: number;
};
export const useRede = create<Estado>()(() => ({
  aberto: false, posts: [], fim: false, curtidas: {}, comentarios: {}, perfil: null, carregando: false, enviando: false, naoLidas: 0,
  stories: [], vistos: lerVistos(), quemViu: {}, ilha: null, pedido: null, mensagens: [], conversaAberta: null, naoLidasDM: 0,
}));

function lerVistos(): number[] {
  const v = local.json<unknown>("insta-vistos");
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number").slice(-400) : [];
}

const PAGINA = 20;
const lerPost = (r: Record<string, unknown>): Post => ({
  id: Number(r.id), userId: String(r.user_id), texto: String(r.texto ?? "").slice(0, 500),
  midia: typeof r.midia === "string" && r.midia.startsWith("rede/") ? r.midia : null, em: Date.parse(String(r.em)) || 0,
});
const lerComentario = (r: Record<string, unknown>): Comentario => ({
  id: Number(r.id), postId: Number(r.post_id), userId: String(r.user_id), texto: String(r.texto ?? "").slice(0, 280), em: Date.parse(String(r.em)) || 0,
});
const motivo = (e: unknown, padrao: string) => {
  const m = e as { code?: unknown; message?: unknown };
  return m.code === "P0001" && typeof m.message === "string" ? m.message.slice(0, 140) : errMsg(e, padrao);
};

/** Tenho o celular? (a mochila vem da loja; o banco confere de novo em tudo) */
export const temCelular = () => celularNaMochila;
let celularNaMochila = false;

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

/* ---------- ler ---------- */
async function detalhes(ids: number[]) {
  if (!ids.length) return;
  const [c, k] = await Promise.all([
    sb().from("rede_curtidas").select("post_id,user_id").in("post_id", ids),
    sb().from("rede_comentarios").select("id,post_id,user_id,texto,em").in("post_id", ids).order("em"),
  ]);
  const curtidas = { ...useRede.getState().curtidas }, comentarios = { ...useRede.getState().comentarios };
  for (const id of ids) {
    curtidas[id] = [];
    comentarios[id] = [];
  }
  for (const r of c.data ?? []) curtidas[r.post_id]?.push(String(r.user_id));
  for (const r of k.data ?? []) comentarios[r.post_id]?.push(lerComentario(r));
  useRede.setState({ curtidas, comentarios });
}

/** Lê a primeira página (do feed ou do perfil aberto). */
export async function carregarRede() {
  if (!celularNaMochila) return;
  const perfil = useRede.getState().perfil;
  useRede.setState({ carregando: true });
  let q = sb().from("rede_posts").select("id,user_id,texto,midia,em").order("id", { ascending: false }).limit(PAGINA);
  if (perfil) q = q.eq("user_id", perfil);
  const { data, error } = await q;
  if (error) {
    console.warn("rede nanica indisponível", error.message);
    useRede.setState({ carregando: false });
    return;
  }
  const posts = (data ?? []).map(lerPost);
  useRede.setState({ posts, fim: posts.length < PAGINA, carregando: false });
  await detalhes(posts.map((p) => p.id));
  contarNaoLidas();
}

/** Mais 20 postagens antigas. */
export async function maisPostagens() {
  const { posts, perfil, carregando, fim } = useRede.getState();
  if (carregando || fim || !posts.length) return;
  useRede.setState({ carregando: true });
  let q = sb().from("rede_posts").select("id,user_id,texto,midia,em").lt("id", posts[posts.length - 1].id).order("id", { ascending: false }).limit(PAGINA);
  if (perfil) q = q.eq("user_id", perfil);
  const { data } = await q;
  const novos = (data ?? []).map(lerPost);
  useRede.setState({ posts: [...useRede.getState().posts, ...novos], fim: novos.length < PAGINA, carregando: false });
  await detalhes(novos.map((p) => p.id));
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
});

/** Os stories das últimas 24 h (e os meus vencidos, que o banco ainda me mostra para eu apagar). */
export async function carregarStories() {
  if (!celularNaMochila) return;
  const { data, error } = await sb().from("rede_stories").select("id,user_id,midia,texto,fundo,em").order("id");
  if (error) return console.warn("stories indisponíveis (seção 34)", error.message);
  useRede.setState({ stories: (data ?? []).map(lerStory) });
}

function onStory(row: Record<string, unknown> | null, ev: string) {
  const id = Number(row?.id);
  if (!id) return;
  const st = useRede.getState();
  if (ev === "DELETE") {
    const s = st.stories.find((x) => x.id === id);
    if (s?.midia) soltarImagem(s.midia);
    return useRede.setState({ stories: st.stories.filter((x) => x.id !== id) });
  }
  if (ev !== "INSERT" || st.stories.some((x) => x.id === id)) return;
  const s = lerStory(row!);
  useRede.setState({ stories: [...st.stories, s] });
  const app = getApp();
  if (s.userId !== app.myUid && st.aberto)
    avisarIlha(`${app.friends.find((x) => x.user_id === s.userId)?.name ?? "Alguém"} postou um story`, s.userId, "story", 4200, { tipo: "story", userId: s.userId });
}

/** Marca um story como visto (no navegador e no banco, para o dono saber). */
export function marcarVisto(s: Story) {
  const st = useRede.getState();
  if (st.vistos.includes(s.id)) return;
  const vistos = [...st.vistos, s.id].slice(-400);
  useRede.setState({ vistos });
  local.setJson("insta-vistos", vistos);
  if (s.userId !== getApp().myUid) void sb().from("rede_stories_vistos").insert({ story_id: s.id }).then(() => {});
}

/** Quem viu um story meu. */
export async function lerQuemViu(s: Story) {
  const { data } = await sb().from("rede_stories_vistos").select("user_id").eq("story_id", s.id).order("em");
  useRede.setState({ quemViu: { ...useRede.getState().quemViu, [s.id]: (data ?? []).map((r) => String(r.user_id)) } });
}

/** Posta um story (foto ou texto sobre uma cor). Antes, apaga os meus vencidos (foto e linha). */
export async function postarStory(arquivo: File | null, texto: string, fundo: Fundo): Promise<boolean> {
  const uid = getApp().myUid;
  if (!uid || useRede.getState().enviando) return false;
  if (!arquivo && !texto.trim()) {
    toast("Escolha uma foto ou escreva o texto do story.");
    return false;
  }
  useRede.setState({ enviando: true });
  avisarIlha("Postando o seu story…", uid, "envio", 0);
  let midia: string | null = null;
  try {
    const vencidos = useRede.getState().stories.filter((s) => s.userId === uid && Date.now() - s.em >= DIA_MS);
    if (vencidos.length) {
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
    const { error } = await sb().from("rede_stories").insert({ midia, texto: texto.trim().slice(0, 120), fundo });
    if (error) throw error;
    avisarIlha("Seu story foi publicado", uid, "story");
    void carregarStories();
    return true;
  } catch (e) {
    if (midia) void sb().storage.from("midias").remove([midia]);
    fecharIlha();
    toast(e instanceof Error && !("code" in e) ? e.message : motivo(e, "Não deu para postar o story. Confira a internet."));
    return false;
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
  useRede.setState({ stories: useRede.getState().stories.filter((x) => x.id !== s.id) });
}

/* ---------- Direct (mensagens, seção 35) ---------- */
const lerMensagem = (r: Record<string, unknown>): Mensagem => ({
  id: Number(r.id),
  de: String(r.de),
  para: String(r.para),
  texto: String(r.texto ?? "").slice(0, 1000),
  storyId: r.story_id == null ? null : Number(r.story_id),
  postId: r.post_id == null ? null : Number(r.post_id),
  em: Date.parse(String(r.em)) || 0,
  lidaEm: r.lida_em ? Date.parse(String(r.lida_em)) || 1 : null,
});
const contarDM = () => useRede.setState({ naoLidasDM: naoLidasDM(useRede.getState().mensagens, getApp().myUid) });

/** As minhas últimas 500 mensagens (o banco só devolve as que eu mandei ou recebi). */
export async function carregarMensagens() {
  if (!celularNaMochila) return;
  const { data, error } = await sb().from("rede_mensagens").select("id,de,para,texto,story_id,post_id,em,lida_em").order("id", { ascending: false }).limit(500);
  if (error) return console.warn("mensagens indisponíveis (seção 35)", error.message);
  useRede.setState({ mensagens: (data ?? []).map(lerMensagem) });
  contarDM();
}

function onMensagem(row: Record<string, unknown> | null, ev: string) {
  const id = Number(row?.id);
  if (!id || !row) return;
  const st = useRede.getState(), eu = getApp().myUid;
  const m = lerMensagem(row);
  if (ev === "UPDATE") {
    useRede.setState({ mensagens: st.mensagens.map((x) => (x.id === id ? m : x)) });
    return contarDM();
  }
  if (ev !== "INSERT" || st.mensagens.some((x) => x.id === id)) return;
  useRede.setState({ mensagens: [m, ...st.mensagens] });
  if (m.para === eu) {
    /* conversa aberta com quem mandou: já fica lida; senão, avisa na ilha */
    if (st.aberto && st.conversaAberta === m.de) void marcarLidas(m.de);
    else if (st.aberto) {
      const nome = getApp().friends.find((x) => x.user_id === m.de)?.name ?? "Alguém";
      avisarIlha(`${nome}: ${m.postId ? "enviou uma publicação" : m.texto}`, m.de, "mensagem", 4200, { tipo: "mensagem", userId: m.de });
    }
  }
  contarDM();
}

/** Manda uma mensagem (texto, resposta a um story ou uma publicação). */
export async function enviarMensagem(para: string, texto: string, extra: { storyId?: number; postId?: number } = {}): Promise<boolean> {
  if (!texto.trim() && !extra.postId) return false;
  const { data, error } = await sb()
    .from("rede_mensagens")
    .insert({ para, texto: texto.trim().slice(0, 1000), story_id: extra.storyId ?? null, post_id: extra.postId ?? null })
    .select("id,de,para,texto,story_id,post_id,em,lida_em");
  if (error) {
    toast(motivo(error, "Não deu para mandar a mensagem. Confira a internet."));
    return false;
  }
  const nova = (data ?? []).map(lerMensagem).filter((m) => !useRede.getState().mensagens.some((x) => x.id === m.id));
  if (nova.length) useRede.setState({ mensagens: [...nova, ...useRede.getState().mensagens] });
  return true;
}

/** Abre (ou fecha, com null) a conversa e marca como lidas as mensagens dessa pessoa. */
export function abrirConversa(outro: string | null) {
  useRede.setState({ conversaAberta: outro });
  if (outro) void marcarLidas(outro);
}
export async function marcarLidas(de: string) {
  const eu = getApp().myUid;
  if (!useRede.getState().mensagens.some((m) => m.de === de && m.para === eu && !m.lidaEm)) return;
  useRede.setState({ mensagens: useRede.getState().mensagens.map((m) => (m.de === de && m.para === eu && !m.lidaEm ? { ...m, lidaEm: Date.now() } : m)) });
  contarDM();
  await sb().rpc("marcar_lidas", { p_de: de });
}

/* ---------- tempo real ---------- */
function onPost(row: Record<string, unknown> | null, ev: string) {
  const id = Number(row?.id);
  if (!id) return;
  const st = useRede.getState();
  if (ev === "DELETE") {
    const p = st.posts.find((x) => x.id === id);
    if (p?.midia) soltarImagem(p.midia);
    useRede.setState({ posts: st.posts.filter((x) => x.id !== id) });
    contarNaoLidas();
    return;
  }
  if (ev !== "INSERT" || st.posts.some((x) => x.id === id)) return;
  const p = lerPost(row!);
  const s = getApp();
  if (p.userId !== s.myUid) {
    const f = s.friends.find((x) => x.user_id === p.userId);
    avisarTexto(f?.id ?? null, `${f?.name ?? "Alguém"} postou no InstaNanico`);
    if (st.aberto) avisarIlha(`${f?.name ?? "Alguém"} publicou uma foto`, p.userId, "post", 4200, { tipo: "post", id: p.id });
  }
  if (!st.perfil || st.perfil === p.userId) {
    useRede.setState({ posts: [p, ...st.posts], curtidas: { ...st.curtidas, [p.id]: [] }, comentarios: { ...st.comentarios, [p.id]: [] } });
  }
  contarNaoLidas();
}

/* curtida ou comentário mudou: relê os detalhes daquela postagem (no DELETE de comentário só vem o id) */
function onDetalhe(row: Record<string, unknown> | null) {
  const st = useRede.getState();
  let post = Number(row?.post_id);
  if (!post && row?.id) post = Object.values(st.comentarios).flat().find((c) => c.id === Number(row.id))?.postId ?? 0;
  if (post && st.posts.some((p) => p.id === post)) void detalhes([post]);
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
}

/* ---------- abrir e fechar o celular ---------- */
export function abrirCelular() {
  useRede.setState({ aberto: true });
  contarNaoLidas();
  if (!useRede.getState().posts.length) void carregarRede();
  void carregarStories();
  void carregarMensagens();
}
export function fecharCelular() {
  /* as imagens da rede saem da memória ao fechar */
  for (const p of useRede.getState().posts) if (p.midia) soltarImagem(p.midia);
  for (const s of useRede.getState().stories) if (s.midia) soltarImagem(s.midia);
  useRede.setState({ aberto: false, ilha: null, pedido: null, conversaAberta: null });
  contarNaoLidas();
}
export function verPerfil(userId: string | null) {
  useRede.setState({ perfil: userId, posts: [], fim: false });
  void carregarRede();
}

/* ---------- escrever ---------- */
export async function postar(texto: string, arquivo: File | null): Promise<boolean> {
  const uid = getApp().myUid;
  if (!uid || useRede.getState().enviando) return false;
  if (!texto.trim() && !arquivo) {
    toast("Escolha uma foto ou escreva alguma coisa.");
    return false;
  }
  useRede.setState({ enviando: true });
  avisarIlha("Publicando…", uid, "envio", 0);
  let midia: string | null = null;
  try {
    if (arquivo) {
      const { blob, ext } = await comprimir(arquivo);
      midia = `rede/${uid}/${newId().toLowerCase()}.${ext}`;
      const up = await sb().storage.from("midias").upload(midia, blob, { contentType: ext === "gif" ? "image/gif" : "image/webp", upsert: false });
      if (up.error) throw up.error;
    }
    const { error } = await sb().from("rede_posts").insert({ texto: texto.trim().slice(0, 500), midia });
    if (error) throw error;
    avisarIlha("Publicado", uid, "post");
    return true;
  } catch (e) {
    if (midia) void sb().storage.from("midias").remove([midia]);
    fecharIlha();
    toast(e instanceof Error && !("code" in e) ? e.message : motivo(e, "Não deu para postar. Confira a internet."));
    return false;
  } finally {
    useRede.setState({ enviando: false });
  }
}

export async function curtir(post: Post) {
  const eu = getApp().myUid;
  if (!eu) return;
  const ja = (useRede.getState().curtidas[post.id] ?? []).includes(eu);
  const { error } = ja
    ? await sb().from("rede_curtidas").delete().eq("post_id", post.id).eq("user_id", eu)
    : await sb().from("rede_curtidas").insert({ post_id: post.id });
  if (error) toast(motivo(error, "Não deu para curtir."));
  await detalhes([post.id]);
}

export async function comentar(post: Post, texto: string): Promise<boolean> {
  if (!texto.trim()) return false;
  const { error } = await sb().from("rede_comentarios").insert({ post_id: post.id, texto: texto.slice(0, 280) });
  if (error) {
    toast(motivo(error, "Não deu para comentar."));
    return false;
  }
  await detalhes([post.id]);
  return true;
}

export async function apagarPost(post: Post) {
  if (post.midia) {
    await sb().storage.from("midias").remove([post.midia]);
    soltarImagem(post.midia);
  }
  const { error } = await sb().from("rede_posts").delete().eq("id", post.id);
  if (error) return toast(motivo(error, "Não deu para apagar."));
  useRede.setState({ posts: useRede.getState().posts.filter((p) => p.id !== post.id) });
}

export async function apagarComentario(c: Comentario) {
  const { error } = await sb().from("rede_comentarios").delete().eq("id", c.id);
  if (error) return toast(motivo(error, "Não deu para apagar."));
  await detalhes([c.postId]);
}
