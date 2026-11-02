/*
 * Rede social nanica (seção 18 do seguranca.sql). Só quem tem o Celular lê e escreve, e quem garante é o banco
 * (RLS com tem_item('celular')): sem o item, as consultas voltam vazias e o tempo real não chega.
 * Feed de 20 em 20, curtidas e comentários das postagens carregadas, imagem no bucket "midias" (pasta rede/<uid>/),
 * comprimida no navegador como as mídias. Postar e curtir não dão moedas.
 */
import { create } from "zustand";
import { avisarTexto } from "@/features/hall/ganhos";
import { comprimir, soltarImagem } from "@/features/midias/midiasDados";
import { aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local, newId } from "@/lib/util";

export type Post = { id: number; userId: string; texto: string; midia: string | null; em: number };
export type Comentario = { id: number; postId: number; userId: string; texto: string; em: number };

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
};
export const useRede = create<Estado>()(() => ({
  aberto: false, posts: [], fim: false, curtidas: {}, comentarios: {}, perfil: null, carregando: false, enviando: false, naoLidas: 0,
}));

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
    avisarTexto(f?.id ?? null, `${f?.name ?? "Alguém"} postou na rede nanica`);
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
  if (tenho && !antes) void carregarRede();
  if (ligado) return;
  ligado = true;
  aoMudarTabela("rede_posts", onPost);
  aoMudarTabela("rede_curtidas", onDetalhe);
  aoMudarTabela("rede_comentarios", onDetalhe);
}

/* ---------- abrir e fechar o celular ---------- */
export function abrirCelular() {
  useRede.setState({ aberto: true });
  contarNaoLidas();
  if (!useRede.getState().posts.length) void carregarRede();
}
export function fecharCelular() {
  /* as imagens da rede saem da memória ao fechar */
  for (const p of useRede.getState().posts) if (p.midia) soltarImagem(p.midia);
  useRede.setState({ aberto: false });
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
  if (!texto.trim()) {
    toast("Escreva alguma coisa.");
    return false;
  }
  useRede.setState({ enviando: true });
  let midia: string | null = null;
  try {
    if (arquivo) {
      const { blob, ext } = await comprimir(arquivo);
      midia = `rede/${uid}/${newId().toLowerCase()}.${ext}`;
      const up = await sb().storage.from("midias").upload(midia, blob, { contentType: ext === "gif" ? "image/gif" : "image/webp", upsert: false });
      if (up.error) throw up.error;
    }
    const { error } = await sb().from("rede_posts").insert({ texto: texto.slice(0, 500), midia });
    if (error) throw error;
    return true;
  } catch (e) {
    if (midia) void sb().storage.from("midias").remove([midia]);
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
