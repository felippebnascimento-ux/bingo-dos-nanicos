import { CHAMPS } from "./dados/campeoes";

export const norm = (s: unknown) => String(s || "").trim().toLowerCase();

/** "ahri" → "Ahri": devolve o nome oficial do campeão (ou o texto como veio). */
export const canon = (s: unknown) => {
  const n = norm(s);
  if (!n) return "";
  return CHAMPS.find((c) => norm(c) === n) || String(s).trim();
};

export const lower = (s: unknown) => String(s || "").toLocaleLowerCase("pt-BR");

export function shuffle<T>(a: readonly T[], rnd: () => number = Math.random): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

export const initials = (n: unknown) =>
  String(n || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

export const hueOf = (s: unknown) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export const byName = (a: { name?: string }, b: { name?: string }) =>
  String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" });

export const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const hhmm = (t: string | number) => {
  try {
    return new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

/** Só conveniência de cada pessoa: nada importante pode morar só no navegador. */
export const local = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* navegador sem armazenamento: segue sem salvar */
    }
  },
  json<T>(k: string): T | null {
    try {
      return JSON.parse(localStorage.getItem(k) || "null") as T | null;
    } catch {
      return null;
    }
  },
  setJson(k: string, v: unknown) {
    this.set(k, JSON.stringify(v));
  },
};

export const reduzMovimento = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Rola até o elemento, sem animação para quem pediu menos movimento. */
export function rolarAte(el: Element | null | undefined) {
  el?.scrollIntoView({ behavior: reduzMovimento() ? "auto" : "smooth", block: "start" });
}

export const ehCelular = () =>
  typeof matchMedia !== "undefined" && matchMedia("(max-width:860px)").matches;
