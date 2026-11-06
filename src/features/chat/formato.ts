/*
 * O texto do chat como no Discord (seção 70): **negrito**, *itálico*, __sublinhado__, ~~riscado~~, `código`,
 * ||spoiler||, citação com "> " no começo da linha, links e @menções. Puro e testado em formato.test.ts; quem desenha é
 * o ChatPainel (sem HTML cru: cada pedaço vira um elemento do React).
 */

export type Trecho =
  | { t: "texto"; v: string }
  | { t: "negrito" | "italico" | "sublinhado" | "riscado" | "spoiler"; filhos: Trecho[] }
  | { t: "codigo"; v: string }
  | { t: "link"; url: string; v: string }
  | { t: "mencao"; v: string };
export type Linha = { citacao: boolean; trechos: Trecho[] };

const MARCAS: [string, Exclude<Trecho["t"], "texto" | "codigo" | "link" | "mencao">][] = [
  ["**", "negrito"],
  ["__", "sublinhado"],
  ["~~", "riscado"],
  ["||", "spoiler"],
  ["*", "italico"],
  ["_", "italico"],
];
const RE_LINK = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/y;
const RE_MENCAO = /@([a-z0-9_]{2,30})/iy;

/** Os pedaços de uma linha (as marcas podem ficar umas dentro das outras). */
export function trechos(s: string): Trecho[] {
  const out: Trecho[] = [];
  let texto = "";
  const solta = () => {
    if (texto) out.push({ t: "texto", v: texto });
    texto = "";
  };
  let i = 0;
  while (i < s.length) {
    /* código: nada dentro dele é formatado */
    if (s[i] === "`") {
      const fim = s.indexOf("`", i + 1);
      if (fim > i + 1) {
        solta();
        out.push({ t: "codigo", v: s.slice(i + 1, fim) });
        i = fim + 1;
        continue;
      }
    }
    if (s.startsWith("http", i) && (i === 0 || /\s|\(/.test(s[i - 1]))) {
      RE_LINK.lastIndex = i;
      const m = RE_LINK.exec(s);
      if (m) {
        solta();
        out.push({ t: "link", url: m[0], v: m[0] });
        i += m[0].length;
        continue;
      }
    }
    if (s[i] === "@" && (i === 0 || !/[a-z0-9_]/i.test(s[i - 1]))) {
      RE_MENCAO.lastIndex = i;
      const m = RE_MENCAO.exec(s);
      if (m) {
        solta();
        out.push({ t: "mencao", v: "@" + m[1].toLowerCase() });
        i += m[0].length;
        continue;
      }
    }
    const marca = MARCAS.find(([m]) => s.startsWith(m, i));
    if (marca) {
      const [m, tipo] = marca;
      let fim = s.indexOf(m, i + m.length);
      /* "***": o fechamento do negrito é o último par (o * de dentro fecha o itálico) */
      if (m === "**") while (fim > 0 && s[fim + 2] === "*") fim++;
      /* "_" só marca palavra inteira (nome_de_arquivo continua igual) */
      const palavra = m !== "_" || ((i === 0 || /\s/.test(s[i - 1])) && (fim + 1 >= s.length || /[\s.,!?]/.test(s[fim + 1] ?? " ")));
      if (fim > i + m.length && palavra && s.slice(i + m.length, fim).trim()) {
        solta();
        out.push({ t: tipo, filhos: trechos(s.slice(i + m.length, fim)) });
        i = fim + m.length;
        continue;
      }
    }
    texto += s[i];
    i++;
  }
  solta();
  return out;
}

/** O texto em linhas, com as citações ("> ") marcadas. */
export function formatar(texto: string): Linha[] {
  return texto.split("\n").map((l) => (/^>\s/.test(l) ? { citacao: true, trechos: trechos(l.replace(/^>\s/, "")) } : { citacao: false, trechos: trechos(l) }));
}

/** Os @ citados no texto (minúsculos, sem o @). */
export function mencoesDe(texto: string): string[] {
  const out = new Set<string>();
  const anda = (l: Trecho[]) => {
    for (const x of l) {
      if (x.t === "mencao") out.add(x.v.slice(1));
      else if ("filhos" in x) anda(x.filhos);
    }
  };
  for (const l of formatar(texto)) anda(l.trechos);
  return [...out];
}
/** A mensagem me menciona? (pelo meu @ ou por @todos / @everyone) */
export const meMenciona = (texto: string, meuAt: string) => {
  const m = mencoesDe(texto);
  return m.includes(meuAt) || m.includes("todos") || m.includes("everyone");
};

/** Os links de um texto. */
export function linksDe(texto: string): string[] {
  const out: string[] = [];
  const anda = (l: Trecho[]) => {
    for (const x of l) {
      if (x.t === "link") out.push(x.url);
      else if ("filhos" in x) anda(x.filhos);
    }
  };
  for (const l of formatar(texto)) anda(l.trechos);
  return out;
}

/** O vídeo que dá para tocar no chat (YouTube, clipe da Twitch ou Medal), ou null. */
export type Embed = { tipo: "youtube" | "twitch" | "medal"; id: string };
export function embedDe(url: string): Embed | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const id = (v: string | null | undefined) => (v && /^[A-Za-z0-9_-]{6,64}$/.test(v) ? v : null);
  if (host === "youtu.be") {
    const v = id(u.pathname.slice(1));
    return v ? { tipo: "youtube", id: v } : null;
  }
  if (host === "youtube.com") {
    const v = id(u.searchParams.get("v")) ?? id(u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]);
    return v ? { tipo: "youtube", id: v } : null;
  }
  if (host === "clips.twitch.tv") {
    const v = id(u.pathname.slice(1).split("/")[0]);
    return v ? { tipo: "twitch", id: v } : null;
  }
  if (host === "twitch.tv") {
    const v = id(u.pathname.match(/\/clip\/([^/]+)/)?.[1]);
    return v ? { tipo: "twitch", id: v } : null;
  }
  if (host === "medal.tv") {
    const v = id(u.pathname.match(/\/clips?\/([^/?]+)/)?.[1]);
    return v ? { tipo: "medal", id: v } : null;
  }
  return null;
}
/** O endereço do player (só domínios liberados na CSP: youtube-nocookie, player da Twitch e Medal). */
export function urlDoEmbed(e: Embed, host: string) {
  if (e.tipo === "youtube") return `https://www.youtube-nocookie.com/embed/${e.id}`;
  if (e.tipo === "twitch") return `https://clips.twitch.tv/embed?clip=${e.id}&parent=${encodeURIComponent(host)}&autoplay=false`;
  return `https://medal.tv/clip/${e.id}?autoplay=0&mobilebypass=true`;
}

/** "Hoje", "Ontem" ou a data, para separar a conversa por dia. */
export function dia(t: number, agora: number) {
  const d = (x: number) => new Date(x).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (d(t) === d(agora)) return "Hoje";
  if (d(t) === d(agora - 86_400_000)) return "Ontem";
  return new Date(t).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}
