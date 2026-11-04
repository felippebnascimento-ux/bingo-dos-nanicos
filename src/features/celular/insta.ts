/*
 * InstaNanico: regras puras dos stories (agrupar por pessoa, ordem da fileira, próximo e anterior) e dos tempos.
 * Quem garante quem vê o quê é o banco (seção 34); aqui só a ordem e o "já vi" para a tela.
 */
export type Story = {
  id: number;
  userId: string;
  midia: string | null;
  texto: string;
  fundo: Fundo;
  em: number;
  /** a figurinha que se toca (enquete, pergunta, contagem ou publicação), seção 68 */
  figurinha?: Figurinha | null;
  /** só para os melhores amigos do dono (anel verde) */
  soProximos?: boolean;
};

/* ---------- figurinhas que se tocam (ficam por cima da imagem do story, não dentro dela) ---------- */
type Lugar = { x: number; y: number; escala: number; rot: number };
export type Figurinha =
  | (Lugar & { tipo: "enquete"; pergunta: string; opcoes: [string, string] })
  | (Lugar & { tipo: "pergunta"; pergunta: string })
  | (Lugar & { tipo: "contagem"; titulo: string; alvo: number })
  | (Lugar & { tipo: "post"; postId: number })
  /** quiz: de 2 a 4 respostas, `certa` é a certa (seção 69) */
  | (Lugar & { tipo: "quiz"; pergunta: string; opcoes: string[]; certa: number })
  /** barrinha de emoji: arrasta de 0 a 100 */
  | (Lugar & { tipo: "barra"; pergunta: string; emoji: string })
  /** "Adicione o seu": cada um responde com o próprio story; `origem` é o primeiro story da corrente */
  | (Lugar & { tipo: "adicione"; pergunta: string; origem: number | null })
  /** o story em que me mencionaram, repostado */
  | (Lugar & { tipo: "story"; storyId: number; autor: string });

const num = (v: unknown, min: number, max: number, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").slice(0, max) : "");

/** Lê a figurinha que veio do banco (é de outro navegador: confere tudo). */
export function lerFigurinha(v: unknown): Figurinha | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lugar = { x: num(o.x, 0, 1, 0.5), y: num(o.y, 0, 1, 0.5), escala: num(o.escala, 0.25, 6, 1), rot: num(o.rot, -7, 7, 0) };
  if (o.tipo === "enquete") {
    const op = Array.isArray(o.opcoes) ? o.opcoes : [];
    return { ...lugar, tipo: "enquete", pergunta: txt(o.pergunta, 80), opcoes: [txt(op[0], 24) || "Sim", txt(op[1], 24) || "Não"] };
  }
  if (o.tipo === "pergunta") return { ...lugar, tipo: "pergunta", pergunta: txt(o.pergunta, 80) || "Me pergunte algo" };
  if (o.tipo === "contagem" && typeof o.alvo === "number" && Number.isFinite(o.alvo)) return { ...lugar, tipo: "contagem", titulo: txt(o.titulo, 40) || "Contagem", alvo: o.alvo };
  if (o.tipo === "post" && typeof o.postId === "number" && o.postId > 0) return { ...lugar, tipo: "post", postId: Math.floor(o.postId) };
  if (o.tipo === "quiz") {
    const op = (Array.isArray(o.opcoes) ? o.opcoes : []).map((x) => txt(x, 24)).filter(Boolean).slice(0, 4);
    if (op.length < 2) return null;
    return { ...lugar, tipo: "quiz", pergunta: txt(o.pergunta, 80), opcoes: op, certa: Math.floor(num(o.certa, 0, op.length - 1, 0)) };
  }
  if (o.tipo === "barra") return { ...lugar, tipo: "barra", pergunta: txt(o.pergunta, 80), emoji: [...txt(o.emoji, 8)].slice(0, 2).join("") || "😍" };
  if (o.tipo === "adicione")
    return { ...lugar, tipo: "adicione", pergunta: txt(o.pergunta, 80) || "Adicione o seu", origem: typeof o.origem === "number" && o.origem > 0 ? Math.floor(o.origem) : null };
  if (o.tipo === "story" && typeof o.storyId === "number" && o.storyId > 0) return { ...lugar, tipo: "story", storyId: Math.floor(o.storyId), autor: txt(o.autor, 40).replace(/[^0-9a-f-]/g, "") };
  return null;
}

/** Quanto falta para a contagem (dias, horas, minutos, segundos); null = já chegou. */
export function falta(alvo: number, agora: number) {
  const s = Math.floor((alvo - agora) / 1000);
  if (s <= 0) return null;
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Os votos da enquete em porcentagem inteira (somam 100 quando tem voto). */
export function porcentagens(votos: Record<string, number> | null | undefined): [number, number] {
  const a = votos?.["0"] ?? 0, b = votos?.["1"] ?? 0, t = a + b;
  if (!t) return [0, 0];
  const pa = Math.round((a / t) * 100);
  return [pa, 100 - pa];
}

/* ---------- menções (@nome) no texto ---------- */
export type Pedaco = { t: "texto"; v: string } | { t: "mencao"; v: string };
/** Separa o texto em pedaços comuns e @menções (o @ vai no começo do pedaço da menção). */
export function pedacos(texto: string): Pedaco[] {
  const out: Pedaco[] = [];
  let i = 0;
  for (const m of texto.matchAll(/(^|[^a-z0-9_])@([a-z0-9_]{2,30})/gi)) {
    const ini = (m.index ?? 0) + m[1].length;
    if (ini > i) out.push({ t: "texto", v: texto.slice(i, ini) });
    out.push({ t: "mencao", v: "@" + m[2].toLowerCase() });
    i = ini + 1 + m[2].length;
  }
  if (i < texto.length) out.push({ t: "texto", v: texto.slice(i) });
  return out;
}
/** Os @nomes citados num texto (sem o @, sem repetir). */
export const mencionados = (texto: string) => [...new Set(pedacos(texto).filter((p) => p.t === "mencao").map((p) => p.v.slice(1)))];
/** A palavra com @ que está sendo digitada no fim do texto (para sugerir nomes), ou null. */
export function mencaoDigitando(texto: string): string | null {
  const m = texto.match(/(?:^|\s)@([a-z0-9_]{0,30})$/i);
  return m ? m[1].toLowerCase() : null;
}
export type Fundo = "roxo" | "laranja" | "verde" | "azul" | "preto";
export const FUNDOS: Fundo[] = ["roxo", "laranja", "verde", "azul", "preto"];
export const DIA_MS = 24 * 60 * 60 * 1000;
/** Quanto tempo cada story fica na tela antes de passar sozinho. */
export const STORY_MS = 5000;

export type Grupo = { userId: string; stories: Story[]; todosVistos: boolean; ultimo: number };

/** Só os stories das últimas 24 h (o dono recebe também os vencidos, para apagar). */
export const vivos = (lista: readonly Story[], agora: number) => lista.filter((s) => agora - s.em < DIA_MS);

/**
 * A fileira de stories: um grupo por pessoa, cada um com os stories em ordem de tempo. Eu primeiro (se tiver);
 * depois quem tem story que eu não vi, do mais novo para o mais velho; por último quem eu já vi inteiro.
 */
export function agrupar(lista: readonly Story[], vistos: ReadonlySet<number>, eu: string | null, agora: number): Grupo[] {
  const porPessoa = new Map<string, Story[]>();
  for (const s of vivos(lista, agora)) porPessoa.set(s.userId, [...(porPessoa.get(s.userId) ?? []), s]);
  const grupos: Grupo[] = [...porPessoa].map(([userId, ss]) => {
    const ordem = [...ss].sort((a, b) => a.em - b.em || a.id - b.id);
    return { userId, stories: ordem, todosVistos: ordem.every((s) => vistos.has(s.id)), ultimo: ordem[ordem.length - 1].em };
  });
  return grupos.sort((a, b) => {
    if (a.userId === eu) return -1;
    if (b.userId === eu) return 1;
    if (a.todosVistos !== b.todosVistos) return a.todosVistos ? 1 : -1;
    return b.ultimo - a.ultimo;
  });
}

/** Onde começar a ver o grupo: no primeiro story que eu ainda não vi (ou no primeiro, se vi todos). */
export function inicioDoGrupo(g: Grupo, vistos: ReadonlySet<number>) {
  const k = g.stories.findIndex((s) => !vistos.has(s.id));
  return k < 0 ? 0 : k;
}

/** Próximo (ou anterior) story na fileira: passa para o grupo seguinte no fim; null = acabou (fecha). */
export function andar(grupos: readonly Grupo[], g: number, s: number, passo: 1 | -1): { g: number; s: number } | null {
  const grupo = grupos[g];
  if (!grupo) return null;
  const ns = s + passo;
  if (ns >= 0 && ns < grupo.stories.length) return { g, s: ns };
  const ng = g + passo;
  if (ng < 0 || ng >= grupos.length) return passo < 0 ? { g, s: 0 } : null;
  return { g: ng, s: passo > 0 ? 0 : grupos[ng].stories.length - 1 };
}

/** "agora", "5 min", "3 h", "2 d" (estilo Instagram). */
export function tempoCurto(t: number, agora: number) {
  const m = Math.floor((agora - t) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} h`;
  if (m < 7 * 24 * 60) return `${Math.floor(m / (24 * 60))} d`;
  return `${Math.floor(m / (7 * 24 * 60))} sem`;
}

/* ---------- Direct (mensagens) ---------- */
export type Mensagem = {
  id: number;
  de: string;
  para: string;
  texto: string;
  storyId: number | null;
  postId: number | null;
  em: number;
  lidaEm: number | null;
  /** foto ou áudio (pasta rede/<uid>/), seção 68 */
  midia?: string | null;
  /** a mensagem que esta responde */
  respostaA?: number | null;
  /** foto de visualização única (some depois de aberta) e quando foi aberta (seção 69) */
  unica?: boolean;
  abertaEm?: number | null;
  /** mensagem de grupo (aí `para` vem vazio) */
  grupoId?: number | null;
};
/** A mídia da mensagem é áudio? (pela extensão) */
export const ehAudio = (midia: string | null | undefined) => !!midia && /\.(webm|m4a|ogg|mp4)$/.test(midia);
export type Conversa = { outro: string; ultima: Mensagem; naoLidas: number };

/** Uma conversa por pessoa, a mais recente primeiro, com quantas mensagens dela eu ainda não li. */
export function conversas(lista: readonly Mensagem[], eu: string | null): Conversa[] {
  if (!eu) return [];
  const por = new Map<string, Conversa>();
  for (const m of lista) {
    if (m.grupoId || (m.de !== eu && m.para !== eu)) continue;
    const outro = m.de === eu ? m.para : m.de;
    const c = por.get(outro) ?? { outro, ultima: m, naoLidas: 0 };
    if (m.em > c.ultima.em || (m.em === c.ultima.em && m.id > c.ultima.id)) c.ultima = m;
    if (m.para === eu && !m.lidaEm) c.naoLidas++;
    por.set(outro, c);
  }
  return [...por.values()].sort((a, b) => b.ultima.em - a.ultima.em);
}

/** As mensagens de uma conversa, da mais velha para a mais nova. */
export const daConversa = (lista: readonly Mensagem[], eu: string | null, outro: string) =>
  lista.filter((m) => !m.grupoId && ((m.de === eu && m.para === outro) || (m.de === outro && m.para === eu))).sort((a, b) => a.em - b.em || a.id - b.id);
/** As mensagens de um grupo, da mais velha para a mais nova. */
export const doGrupo = (lista: readonly Mensagem[], grupo: number) => lista.filter((m) => m.grupoId === grupo).sort((a, b) => a.em - b.em || a.id - b.id);
/** Quantas mensagens do grupo eu ainda não li (as dos outros depois de `lidoAte`). */
export const naoLidasGrupo = (lista: readonly Mensagem[], grupo: number, lidoAte: number, eu: string | null) =>
  lista.filter((m) => m.grupoId === grupo && m.de !== eu && m.id > lidoAte).length;

/** Quantas mensagens recebidas eu ainda não li (no total). */
export const naoLidasDM = (lista: readonly Mensagem[], eu: string | null) => lista.filter((m) => !m.grupoId && m.para === eu && !m.lidaEm).length;

/** O resumo da última mensagem na lista de conversas ("Você: oi", "Enviou uma publicação"…). */
export function resumo(m: Mensagem, eu: string | null) {
  const meu = m.de === eu;
  const texto = m.unica ? (meu ? (m.abertaEm ? "Sua foto foi aberta" : "Você enviou uma foto (ver uma vez)") : m.abertaEm ? "Foto aberta" : "📷 Foto para ver uma vez") : m.midia ? (ehAudio(m.midia) ? (meu ? "Você enviou um áudio" : "Enviou um áudio") : meu ? "Você enviou uma foto" : "Enviou uma foto") : m.postId ? (meu ? "Você enviou uma publicação" : "Enviou uma publicação") : m.storyId ? (meu ? `Você respondeu ao story: ${m.texto}` : `Respondeu ao seu story: ${m.texto}`) : meu ? `Você: ${m.texto}` : m.texto;
  return texto.length > 60 ? texto.slice(0, 59) + "…" : texto;
}

/** "Hoje", "Ontem" ou a data (seg., 2 de nov.), para separar a conversa por dia. */
export function nomeDoDia(t: number, agora: number) {
  const dia = (x: number) => new Date(x).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (dia(t) === dia(agora)) return "Hoje";
  if (dia(t) === dia(agora - DIA_MS)) return "Ontem";
  return new Date(t).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
}
/** Hora da mensagem (21:43). */
export const horaDe = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/* ---------- perfil ---------- */
/** As publicações do perfil: as fixadas primeiro (a fixada por último no topo), depois as outras da mais nova para a mais velha. */
export function ordemDoPerfil<T extends { id: number; fixadoEm?: number | null }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => (b.fixadoEm ?? 0) - (a.fixadoEm ?? 0) || b.id - a.id);
}

/* ---------- filtros de foto (como os do Instagram) ---------- */
/** Os ajustes de uma foto: 1 = sem mudar (sépia e preto e branco de 0 a 1). */
export type Ajustes = { brilho: number; contraste: number; saturacao: number; sepia: number; pb: number };
export const SEM_AJUSTE: Ajustes = { brilho: 1, contraste: 1, saturacao: 1, sepia: 0, pb: 0 };
export type Filtro = { id: string; nome: string; a: Ajustes };
export const FILTROS: Filtro[] = [
  { id: "normal", nome: "Normal", a: SEM_AJUSTE },
  { id: "clarendon", nome: "Clarendon", a: { brilho: 1.05, contraste: 1.2, saturacao: 1.35, sepia: 0, pb: 0 } },
  { id: "juno", nome: "Juno", a: { brilho: 1.05, contraste: 1.1, saturacao: 1.4, sepia: 0.12, pb: 0 } },
  { id: "lark", nome: "Lark", a: { brilho: 1.12, contraste: 0.92, saturacao: 1.1, sepia: 0, pb: 0 } },
  { id: "gingham", nome: "Gingham", a: { brilho: 1.06, contraste: 0.88, saturacao: 0.85, sepia: 0.08, pb: 0 } },
  { id: "valencia", nome: "Valencia", a: { brilho: 1.08, contraste: 1.05, saturacao: 1.1, sepia: 0.25, pb: 0 } },
  { id: "aden", nome: "Aden", a: { brilho: 1.12, contraste: 0.9, saturacao: 0.8, sepia: 0.18, pb: 0 } },
  { id: "inkwell", nome: "Inkwell", a: { brilho: 1.08, contraste: 1.15, saturacao: 1, sepia: 0.25, pb: 1 } },
  { id: "moon", nome: "Moon", a: { brilho: 1.1, contraste: 1.1, saturacao: 1, sepia: 0, pb: 1 } },
];
/** Os ajustes juntos com o filtro (o filtro primeiro, depois a mão da pessoa). */
export const somar = (f: Ajustes, m: Ajustes): Ajustes => ({
  brilho: f.brilho * m.brilho,
  contraste: f.contraste * m.contraste,
  saturacao: f.saturacao * m.saturacao,
  sepia: Math.min(1, f.sepia + m.sepia),
  pb: Math.min(1, f.pb + m.pb),
});
/** O mesmo filtro em CSS (para a prévia na tela). */
export const cssDoFiltro = (a: Ajustes) => `brightness(${a.brilho}) contrast(${a.contraste}) saturate(${a.saturacao}) sepia(${a.sepia}) grayscale(${a.pb})`;
/**
 * Aplica os ajustes nos pixels (RGBA), com as mesmas contas do CSS (Filter Effects): brilho, contraste, saturação,
 * sépia e preto e branco, nessa ordem. Assim a foto que sobe fica igual à prévia em qualquer navegador.
 */
export function ajustarPixels(px: Uint8ClampedArray, a: Ajustes) {
  const s = a.saturacao, sp = a.sepia, g = a.pb;
  /* matrizes do saturate(), sepia() e grayscale() do CSS */
  const sat = [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s];
  const sep = [0.393 + 0.607 * (1 - sp), 0.769 - 0.769 * (1 - sp), 0.189 - 0.189 * (1 - sp), 0.349 - 0.349 * (1 - sp), 0.686 + 0.314 * (1 - sp), 0.168 - 0.168 * (1 - sp), 0.272 - 0.272 * (1 - sp), 0.534 - 0.534 * (1 - sp), 0.131 + 0.869 * (1 - sp)];
  const gr = [0.2126 + 0.7874 * (1 - g), 0.7152 - 0.7152 * (1 - g), 0.0722 - 0.0722 * (1 - g), 0.2126 - 0.2126 * (1 - g), 0.7152 + 0.2848 * (1 - g), 0.0722 - 0.0722 * (1 - g), 0.2126 - 0.2126 * (1 - g), 0.7152 - 0.7152 * (1 - g), 0.0722 + 0.9278 * (1 - g)];
  const mat = (m: number[], r: number, gg: number, b: number): [number, number, number] => [m[0] * r + m[1] * gg + m[2] * b, m[3] * r + m[4] * gg + m[5] * b, m[6] * r + m[7] * gg + m[8] * b];
  const um = (v: number) => Math.min(1, Math.max(0, v));
  for (let i = 0; i < px.length; i += 4) {
    let r = um((px[i] / 255) * a.brilho), gg = um((px[i + 1] / 255) * a.brilho), b = um((px[i + 2] / 255) * a.brilho);
    r = um((r - 0.5) * a.contraste + 0.5);
    gg = um((gg - 0.5) * a.contraste + 0.5);
    b = um((b - 0.5) * a.contraste + 0.5);
    [r, gg, b] = mat(sat, r, gg, b).map(um) as [number, number, number];
    if (sp) [r, gg, b] = mat(sep, r, gg, b).map(um) as [number, number, number];
    if (g) [r, gg, b] = mat(gr, r, gg, b).map(um) as [number, number, number];
    px[i] = Math.round(r * 255);
    px[i + 1] = Math.round(gg * 255);
    px[i + 2] = Math.round(b * 255);
  }
}
export const semMudanca = (a: Ajustes) => a.brilho === 1 && a.contraste === 1 && a.saturacao === 1 && !a.sepia && !a.pb;

/* ---------- recorte da foto (como no Instagram) ---------- */
export type Formato = "1:1" | "4:5" | "1.91:1" | "9:16";
/** largura ÷ altura de cada formato */
export const PROPORCAO: Record<Formato, number> = { "1:1": 1, "4:5": 4 / 5, "1.91:1": 1.91, "9:16": 9 / 16 };

/** O formato que o Instagram escolheria para a foto: em pé vira 4:5, deitada vira 1,91:1, quase quadrada vira 1:1. */
export function formatoInicial(w: number, h: number): Formato {
  const r = w / h;
  if (r < 0.9) return "4:5";
  if (r > 1.25) return "1.91:1";
  return "1:1";
}

/**
 * A foto `foto` (w × h) dentro da moldura `caixa` (W × H, na tela), cobrindo tudo, com zoom `z` (≥ 1) e arrastada
 * `dx`, `dy` (px da tela). Devolve o deslocamento já limitado (a foto nunca deixa buraco) e o pedaço da foto original
 * que aparece na moldura (x, y, largura, altura em px da foto), que é o que vai ser cortado.
 */
export function recorte(foto: { w: number; h: number }, caixa: { W: number; H: number }, z: number, dx: number, dy: number) {
  const base = Math.max(caixa.W / foto.w, caixa.H / foto.h);
  const s = base * Math.max(1, z);
  const iw = foto.w * s, ih = foto.h * s;
  const mx = (iw - caixa.W) / 2, my = (ih - caixa.H) / 2;
  const cx = Math.max(-mx, Math.min(mx, dx)), cy = Math.max(-my, Math.min(my, dy));
  return {
    dx: cx,
    dy: cy,
    escala: s,
    x: (mx - cx) / s,
    y: (my - cy) / s,
    largura: caixa.W / s,
    altura: caixa.H / s,
  };
}
