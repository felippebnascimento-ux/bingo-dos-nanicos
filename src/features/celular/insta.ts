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
