/* Link da Steam de cada nanico: limpar o que a pessoa colou (o banco confere o mesmo formato). */
import type { Friend } from "@/lib/tipos";

const CAMINHO = /^\/(id\/[A-Za-z0-9_-]{2,32}|profiles\/7656\d{13})\/?$/;

/**
 * Só aceita o perfil da comunidade Steam: steamcommunity.com/id/<nome> ou /profiles/<número de 17 dígitos>.
 * Devolve "" para vazio, null para link inválido e o endereço limpo (https, sem barra no fim) se for válido.
 */
export function cleanSteam(v: unknown): string | null {
  let t = String(v || "").trim();
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (host !== "steamcommunity.com" && host !== "www.steamcommunity.com") return null;
  if (u.username || u.password || u.port) return null;
  if (!CAMINHO.test(u.pathname)) return null;
  return "https://steamcommunity.com" + u.pathname.replace(/\/$/, "");
}

/** Link da Steam salvo do nanico (só se ainda for válido). */
export const steamOf = (f: Friend | null | undefined) => (f && typeof f.steam === "string" ? cleanSteam(f.steam) : "") || "";

/** Nome do perfil a partir do link: ".../id/pitoco_br" → "pitoco_br"; perfil numérico → "perfil". */
export function steamNome(url: string) {
  const m = /\/id\/([^/]+)/.exec(url);
  return m ? m[1] : "perfil";
}
