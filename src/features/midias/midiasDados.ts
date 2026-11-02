/*
 * Mídias, mural e links do perfil (seção 16 do seguranca.sql). As imagens ficam no bucket PRIVADO "midias":
 * para mostrar, o site baixa o arquivo com o login e cria uma URL blob: (a CSP já aceita), sob demanda.
 * Antes de subir, a imagem é comprimida no navegador (webp, lado maior até 1920 px); GIF vai como está.
 * Quem pode o quê fica no banco (RLS e gatilhos); aqui é só pedir e mostrar.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { errMsg, sb } from "@/lib/supabase";
import { getApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { newId } from "@/lib/util";
import type { TipoLink } from "@/features/perfil/links";

export type Midia = { id: number; userId: string; caminho: string | null; link: string | null; legenda: string; sala: string | null; em: number };
export type LinkMural = { id: number; userId: string; url: string; titulo: string; em: number };
export type LinkPerfil = { friendId: string; tipo: TipoLink; url: string };

type Estado = {
  /** null = ainda não sei; false = o SQL da seção 16 não rodou (a aba mostra o aviso) */
  ok: boolean | null;
  midias: Midia[];
  mural: LinkMural[];
  links: LinkPerfil[];
  enviando: boolean;
};
export const useMidias = create<Estado>()(() => ({ ok: null, midias: [], mural: [], links: [], enviando: false }));

const MAX_BYTES = 5 * 1024 * 1024;
const LADO = 1920;
const TIPOS_IMG = ["image/webp", "image/png", "image/jpeg", "image/gif"];
const TIPOS: readonly string[] = ["twitch", "youtube", "instagram", "tiktok", "x", "faceit", "leetify"];

/* recusa do banco (P0001 ou check) vem com texto; mostra a do gatilho, senão o padrão */
const motivo = (e: unknown, padrao: string) => {
  const m = e as { code?: unknown; message?: unknown };
  return m.code === "P0001" && typeof m.message === "string" ? m.message.slice(0, 140) : errMsg(e, padrao);
};

/* ---------- ler ---------- */
const linhaMidia = (r: Record<string, unknown>): Midia => ({
  id: Number(r.id), userId: String(r.user_id), caminho: typeof r.caminho === "string" ? r.caminho : null,
  link: typeof r.link === "string" ? r.link : null, legenda: String(r.legenda ?? "").slice(0, 140),
  sala: typeof r.sala === "string" ? r.sala : null, em: Date.parse(String(r.em)) || 0,
});
const linhaMural = (r: Record<string, unknown>): LinkMural => ({
  id: Number(r.id), userId: String(r.user_id), url: String(r.url ?? ""), titulo: String(r.titulo ?? "").slice(0, 80), em: Date.parse(String(r.em)) || 0,
});

export async function carregarMidias() {
  const [m, l, p] = await Promise.all([
    sb().from("midias").select("id,user_id,caminho,link,legenda,sala,em").order("em", { ascending: false }).limit(200),
    sb().from("mural_links").select("id,user_id,url,titulo,em").order("em", { ascending: false }).limit(200),
    sb().from("perfil_links").select("friend_id,tipo,url"),
  ]);
  if (m.error || l.error || p.error) {
    if (useMidias.getState().ok !== false) console.warn("mídias indisponíveis: rode a seção 16 do seguranca.sql", (m.error || l.error || p.error)?.message);
    useMidias.setState({ ok: false });
    return;
  }
  const midias = (m.data ?? []).map(linhaMidia);
  /* imagem que saiu da galeria (apagada por alguém) solta a URL blob: */
  const vivos = new Set(midias.map((x) => x.caminho));
  for (const c of [...urls.keys()]) if (!vivos.has(c)) soltarImagem(c);
  useMidias.setState({
    ok: true,
    midias,
    mural: (l.data ?? []).map(linhaMural),
    links: (p.data ?? [])
      .filter((r) => TIPOS.includes(r.tipo) && typeof r.url === "string" && r.url.startsWith("https://"))
      .map((r) => ({ friendId: String(r.friend_id), tipo: r.tipo as TipoLink, url: r.url })),
  });
}

let tRecarga: ReturnType<typeof setTimeout> | undefined;
const recarregar = () => {
  clearTimeout(tRecarga);
  tRecarga = setTimeout(() => void carregarMidias(), 300);
};
let ligado = false;
/** Liga mídias, mural e links (uma vez, depois do login): lê tudo e acompanha o tempo real. */
export function iniciarMidias() {
  if (ligado) return;
  ligado = true;
  void carregarMidias();
  aoMudarTabela("midias", recarregar);
  aoMudarTabela("mural_links", recarregar);
  aoMudarTabela("perfil_links", recarregar);
}

/* ---------- imagens do bucket (sob demanda, com cache de URL blob:) ---------- */
const urls = new Map<string, Promise<string | null>>();
/** URL blob: da imagem (baixa uma vez só por caminho). */
export function urlDaImagem(caminho: string): Promise<string | null> {
  let p = urls.get(caminho);
  if (!p) {
    p = sb()
      .storage.from("midias")
      .download(caminho)
      .then(({ data, error }) => (error || !data ? null : URL.createObjectURL(data)))
      .catch(() => null);
    urls.set(caminho, p);
  }
  return p;
}
/** Solta a URL de uma imagem que saiu da galeria. */
export function soltarImagem(caminho: string) {
  const p = urls.get(caminho);
  urls.delete(caminho);
  void p?.then((u) => u && URL.revokeObjectURL(u));
}

/* ---------- enviar ---------- */
/** Comprime para webp (lado maior até 1920 px, qualidade 0,82). GIF vai como está. */
export async function comprimir(f: File): Promise<{ blob: Blob; ext: "webp" | "gif" }> {
  if (!TIPOS_IMG.includes(f.type)) throw new Error("Só dá para mandar imagem (png, jpg, webp ou gif). Vídeo vai como link.");
  if (f.type === "image/gif") {
    if (f.size > MAX_BYTES) throw new Error("GIF de no máximo 5 MB.");
    return { blob: f, ext: "gif" };
  }
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, LADO / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(bmp.width * k));
  cv.height = Math.max(1, Math.round(bmp.height * k));
  cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close();
  for (const q of [0.82, 0.7, 0.55]) {
    const b = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/webp", q));
    if (b && b.size <= MAX_BYTES) return { blob: b, ext: "webp" };
  }
  throw new Error("A imagem ficou grande demais mesmo comprimida.");
}

export async function enviarImagem(f: File, legenda: string): Promise<boolean> {
  const uid = getApp().myUid;
  if (!uid || useMidias.getState().enviando) return false;
  useMidias.setState({ enviando: true });
  let caminho: string | null = null;
  try {
    const { blob, ext } = await comprimir(f);
    caminho = `${uid}/${newId().toLowerCase()}.${ext}`;
    const up = await sb().storage.from("midias").upload(caminho, blob, { contentType: ext === "gif" ? "image/gif" : "image/webp", upsert: false });
    if (up.error) throw up.error;
    const { error } = await sb().from("midias").insert({ caminho, legenda, sala: getApp().minhaSala });
    if (error) throw error;
    toast("Mídia enviada");
    await carregarMidias();
    return true;
  } catch (e) {
    /* o arquivo subiu mas a linha não: apaga o arquivo para não ficar órfão */
    if (caminho) void sb().storage.from("midias").remove([caminho]);
    toast(e instanceof Error && !("code" in e) ? e.message : motivo(e, "Não deu para enviar. Confira a internet."));
    return false;
  } finally {
    useMidias.setState({ enviando: false });
  }
}

export async function enviarVideo(link: string, legenda: string): Promise<boolean> {
  const { error } = await sb().from("midias").insert({ link, legenda, sala: getApp().minhaSala });
  if (error) {
    toast(motivo(error, "Não deu para mandar o link."));
    return false;
  }
  toast("Vídeo adicionado");
  await carregarMidias();
  return true;
}

export async function apagarMidia(m: Midia) {
  if (m.caminho) {
    const r = await sb().storage.from("midias").remove([m.caminho]);
    if (r.error) return toast(motivo(r.error, "Não deu para apagar."));
    soltarImagem(m.caminho);
  }
  const { error } = await sb().from("midias").delete().eq("id", m.id);
  if (error) return toast(motivo(error, "Não deu para apagar."));
  toast("Apagada");
  await carregarMidias();
}

/* ---------- mural ---------- */
export async function adicionarMural(url: string, titulo: string): Promise<boolean> {
  const { error } = await sb().from("mural_links").insert({ url, titulo });
  if (error) {
    toast(motivo(error, "Não deu para pôr no mural."));
    return false;
  }
  await carregarMidias();
  return true;
}

export async function apagarMural(id: number) {
  const { error } = await sb().from("mural_links").delete().eq("id", id);
  if (error) return toast(motivo(error, "Não deu para apagar."));
  await carregarMidias();
}

/* ---------- links do perfil ---------- */
/** Grava (ou tira, com url vazia) um link do meu perfil. */
export async function salvarLinkPerfil(tipo: TipoLink, url: string): Promise<boolean> {
  const fid = getApp().myFid;
  if (!fid) return false;
  const { error } = url
    ? await sb().from("perfil_links").upsert({ friend_id: fid, tipo, url })
    : await sb().from("perfil_links").delete().eq("friend_id", fid).eq("tipo", tipo);
  if (error) {
    toast(motivo(error, "Não deu para salvar o link."));
    return false;
  }
  await carregarMidias();
  return true;
}

/** Os links de um nanico, na ordem dos tipos. */
export const linksDe = (links: LinkPerfil[], fid: string | null | undefined) =>
  fid ? TIPOS.flatMap((t) => links.filter((l) => l.friendId === fid && l.tipo === t)) : [];
