/* Link do op.gg de cada nanico: limpar o que a pessoa colou e tirar o nick do endereço. */
import type { Friend } from "@/lib/tipos";

/**
 * Só aceita endereço do op.gg (https://op.gg/... ou https://www.op.gg/...).
 * Devolve "" para vazio, null para link inválido e o endereço limpo (sempre https) se for válido.
 */
export function cleanOpgg(v: unknown): string | null {
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
  if (host !== "op.gg" && host !== "www.op.gg" && !host.endsWith(".op.gg")) return null;
  if (u.username || u.password || u.port) return null;
  u.protocol = "https:";
  const out = u.toString();
  return out.length <= 300 ? out : null;
}

/** op.gg salvo do nanico (só se ainda for um link válido). */
export const opggOf = (f: Friend | null | undefined) => (f && typeof f.opgg === "string" ? cleanOpgg(f.opgg) : "") || "";

/** Nick do jogador a partir do link: ".../summoners/br/Nome-BR1" → "Nome". */
export function opggNick(url: string) {
  try {
    const ps = new URL(url).pathname.split("/").filter(Boolean);
    const i = ps.findIndex((x) => /^summoners?$/i.test(x));
    let id = i >= 0 && ps[i + 2] ? ps[i + 2] : ps[ps.length - 1] || "";
    id = decodeURIComponent(id).replace(/\+/g, " ").trim();
    const c = id.lastIndexOf("-");
    return (c > 0 ? id.slice(0, c) : id).trim() || "perfil";
  } catch {
    return "perfil";
  }
}
