/*
 * InstaNanico: regras puras dos stories (agrupar por pessoa, ordem da fileira, próximo e anterior) e dos tempos.
 * Quem garante quem vê o quê é o banco (seção 34); aqui só a ordem e o "já vi" para a tela.
 */
export type Story = { id: number; userId: string; midia: string | null; texto: string; fundo: Fundo; em: number };
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
export type Mensagem = { id: number; de: string; para: string; texto: string; storyId: number | null; postId: number | null; em: number; lidaEm: number | null };
export type Conversa = { outro: string; ultima: Mensagem; naoLidas: number };

/** Uma conversa por pessoa, a mais recente primeiro, com quantas mensagens dela eu ainda não li. */
export function conversas(lista: readonly Mensagem[], eu: string | null): Conversa[] {
  if (!eu) return [];
  const por = new Map<string, Conversa>();
  for (const m of lista) {
    if (m.de !== eu && m.para !== eu) continue;
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
  lista.filter((m) => (m.de === eu && m.para === outro) || (m.de === outro && m.para === eu)).sort((a, b) => a.em - b.em || a.id - b.id);

/** Quantas mensagens recebidas eu ainda não li (no total). */
export const naoLidasDM = (lista: readonly Mensagem[], eu: string | null) => lista.filter((m) => m.para === eu && !m.lidaEm).length;

/** O resumo da última mensagem na lista de conversas ("Você: oi", "Enviou uma publicação"…). */
export function resumo(m: Mensagem, eu: string | null) {
  const meu = m.de === eu;
  const texto = m.postId ? (meu ? "Você enviou uma publicação" : "Enviou uma publicação") : m.storyId ? (meu ? `Você respondeu ao story: ${m.texto}` : `Respondeu ao seu story: ${m.texto}`) : meu ? `Você: ${m.texto}` : m.texto;
  return texto.length > 60 ? texto.slice(0, 59) + "…" : texto;
}

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
