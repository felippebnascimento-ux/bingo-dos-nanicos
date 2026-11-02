/*
 * Links do perfil (Twitch, YouTube…), vídeos da galeria e o mural. Os formatos são os mesmos dos checks da
 * seção 16 do seguranca.sql (o banco recusa de qualquer jeito); aqui é só para avisar antes e mostrar o certo.
 */

export type TipoLink = "twitch" | "youtube" | "instagram" | "tiktok" | "x" | "faceit" | "leetify";

export const TIPOS_LINK: readonly { tipo: TipoLink; nome: string; exemplo: string; re: RegExp }[] = [
  { tipo: "twitch", nome: "Twitch", exemplo: "https://twitch.tv/seu_canal", re: /^https:\/\/(www\.)?twitch\.tv\/[A-Za-z0-9_]{3,25}\/?$/ },
  {
    tipo: "youtube", nome: "YouTube", exemplo: "https://youtube.com/@seucanal",
    re: /^https:\/\/(www\.)?youtube\.com\/(@[A-Za-z0-9._-]{3,30}|channel\/[A-Za-z0-9_-]{10,40}|c\/[A-Za-z0-9._-]{2,60})\/?$/,
  },
  { tipo: "instagram", nome: "Instagram", exemplo: "https://instagram.com/seu.perfil", re: /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/ },
  { tipo: "tiktok", nome: "TikTok", exemplo: "https://tiktok.com/@seuperfil", re: /^https:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9._]{2,24}\/?$/ },
  { tipo: "x", nome: "X (Twitter)", exemplo: "https://x.com/seuperfil", re: /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/ },
  { tipo: "faceit", nome: "Faceit", exemplo: "https://faceit.com/pt/players/SeuNick", re: /^https:\/\/(www\.)?faceit\.com\/[a-z]{2}(-[a-z]{2})?\/players\/[A-Za-z0-9_-]{2,30}\/?$/ },
  { tipo: "leetify", nome: "Leetify", exemplo: "https://leetify.com/app/profile/76561198000000000", re: /^https:\/\/(www\.)?leetify\.com\/app\/profile\/[0-9]{17}\/?$/ },
];

/** Põe https e tira espaços, "?utm=…" e "#…" do que a pessoa colou. */
function normalizar(v: unknown): string {
  let t = String(v ?? "").trim();
  if (!t) return "";
  if (!/^[a-z]+:/i.test(t)) t = "https://" + t.replace(/^\/+/, "");
  t = t.replace(/^http:\/\//i, "https://");
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return t;
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return t;
  }
}

/** "" para vazio, null para inválido, ou o link limpo no formato que o banco aceita. */
export function cleanLink(tipo: TipoLink, v: unknown): string | null {
  const t = normalizar(v);
  if (!t) return "";
  const def = TIPOS_LINK.find((x) => x.tipo === tipo);
  return def && t.length <= 200 && def.re.test(t) ? t : null;
}

const VIDEO =
  /^https:\/\/(((www|m)\.)?youtube\.com\/(watch\?v=|shorts\/)[A-Za-z0-9_-]{6,20}|youtu\.be\/[A-Za-z0-9_-]{6,20}|(www\.)?medal\.tv\/[A-Za-z0-9/_-]{3,200}|clips\.twitch\.tv\/[A-Za-z0-9_-]{3,100}|(www\.)?twitch\.tv\/[A-Za-z0-9_]{3,25}\/clip\/[A-Za-z0-9_-]{3,100})([?&#][^\s<>"]*)?$/;

/** Link de vídeo para a galeria (YouTube, Medal ou clipe da Twitch), ou null. */
export function cleanVideo(v: unknown): string | null {
  let t = String(v ?? "").trim();
  if (!t) return null;
  if (!/^[a-z]+:/i.test(t)) t = "https://" + t;
  t = t.replace(/^http:\/\//i, "https://");
  return t.length <= 300 && VIDEO.test(t) ? t : null;
}

const MURAL = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{2,5})?(\/[^\s<>"]*)?$/;

/** Link do mural: qualquer https (javascript:, data: etc. não passam), ou null. */
export function cleanMural(v: unknown): string | null {
  let t = String(v ?? "").trim();
  if (!t) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = "https://" + t;
  t = t.replace(/^http:\/\//i, "https://");
  return t.length <= 300 && MURAL.test(t) ? t : null;
}

/** O domínio em destaque ("u.gg"), para ninguém cair em link disfarçado. */
export function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
}
