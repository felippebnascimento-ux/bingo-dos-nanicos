/*
 * Loja e mochila (puro e testado): os espaços, a vitrine agrupada, o que cada um tem equipado e se dá
 * para comprar. Só serve para MOSTRAR: quem confere preço, saldo e repetição é o banco (comprar(), seção 15).
 */
export type Espaco = "cadeira" | "mesa" | "tapete" | "poster" | "planta" | "parede" | "luz" | "titulo" | "moldura" | "escudo" | "consumivel" | "celular";
export type Anim = "fumar" | "charuto" | "beber" | "tremer" | "tonto";
export type ItemLoja = { id: string; nome: string; descricao: string; espaco: Espaco; preco: number; dados: { cor?: string; texto?: string; anim?: Anim }; ordem: number };
export type LinhaMochila = { userId: string; itemId: string; qtd: number; equipado: boolean };

/** Os grupos da vitrine, na ordem em que aparecem (`curto` é o filtro no topo). */
export const GRUPOS: readonly { id: string; nome: string; curto: string; espacos: readonly Espaco[] }[] = [
  { id: "celular", nome: "A meta grande", curto: "Celular", espacos: ["celular"] },
  { id: "consumivel", nome: "Para usar no K-FOFO", curto: "Consumíveis", espacos: ["consumivel"] },
  { id: "quarto", nome: "Para o quarto", curto: "Quarto", espacos: ["cadeira", "mesa", "tapete", "poster", "planta", "parede", "luz"] },
  { id: "visual", nome: "Títulos e molduras", curto: "Visual", espacos: ["titulo", "moldura"] },
  { id: "escudo", nome: "Proteção", curto: "Proteção", espacos: ["escudo"] },
];

/** Raridade pelo preço (só aparência; o banco não sabe dela): até 99 comum, até 499 rara, até 1.499 épica, depois lendária. */
export type Raridade = "comum" | "rara" | "epica" | "lendaria";
export const raridade = (preco: number): Raridade => (preco >= 1500 ? "lendaria" : preco >= 500 ? "epica" : preco >= 100 ? "rara" : "comum");
export const NOME_RARIDADE: Readonly<Record<Raridade, string>> = { comum: "Comum", rara: "Rara", epica: "Épica", lendaria: "Lendária" };

export const NOME_ESPACO: Readonly<Record<Espaco, string>> = {
  cadeira: "Cadeira",
  mesa: "Mesa",
  tapete: "Tapete",
  poster: "Pôster",
  planta: "Planta",
  parede: "Parede",
  luz: "Luz",
  titulo: "Título",
  moldura: "Moldura",
  escudo: "Escudo",
  consumivel: "Consumível",
  celular: "Celular",
};

/** Escudo e consumíveis acumulam; o resto só se compra uma vez e se equipa (menos o celular, que se abre). */
export const acumula = (e: Espaco) => e === "escudo" || e === "consumivel";
export const equipavel = (e: Espaco) => !acumula(e) && e !== "celular";

/** Quanto já juntei para um item caro (0 a 1) e quanto falta, para a barra da loja. */
export function progressoCompra(preco: number, saldo: number | null) {
  const s = Math.max(0, saldo ?? 0);
  return { parte: Math.min(1, s / Math.max(1, preco)), falta: Math.max(0, preco - s) };
}
export const MAX_ESCUDOS = 3;
export const MAX_CONSUMIVEL = 20;

const ESPACOS = new Set<string>(Object.keys(NOME_ESPACO));
const ANIMS = new Set<string>(["fumar", "charuto", "beber", "tremer", "tonto"]);

/** Confere uma linha de loja_itens vinda do banco. */
export function lerItem(r: Record<string, unknown>): ItemLoja | null {
  if (typeof r.id !== "string" || typeof r.nome !== "string" || typeof r.espaco !== "string" || !ESPACOS.has(r.espaco)) return null;
  if (typeof r.preco !== "number" || !Number.isInteger(r.preco)) return null;
  const d = (r.dados && typeof r.dados === "object" ? r.dados : {}) as Record<string, unknown>;
  return {
    id: r.id,
    nome: r.nome,
    descricao: typeof r.descricao === "string" ? r.descricao : "",
    espaco: r.espaco as Espaco,
    preco: r.preco,
    dados: {
      cor: typeof d.cor === "string" ? d.cor.slice(0, 20) : undefined,
      texto: typeof d.texto === "string" ? d.texto.slice(0, 40) : undefined,
      anim: typeof d.anim === "string" && ANIMS.has(d.anim) ? (d.anim as Anim) : undefined,
    },
    ordem: typeof r.ordem === "number" ? r.ordem : 0,
  };
}

/** Itens de um grupo da vitrine, em ordem. */
export const doGrupo = (itens: readonly ItemLoja[], espacos: readonly Espaco[]) => itens.filter((i) => espacos.includes(i.espaco)).sort((a, b) => a.ordem - b.ordem);

/** O que cada pessoa tem equipado: userId → espaço → item. */
export function equipados(linhas: readonly LinhaMochila[], itens: readonly ItemLoja[]) {
  const porId = new Map(itens.map((i) => [i.id, i]));
  const out: Record<string, Partial<Record<Espaco, ItemLoja>>> = {};
  for (const l of linhas) {
    const it = porId.get(l.itemId);
    if (!l.equipado || !it || !equipavel(it.espaco)) continue;
    (out[l.userId] ??= {})[it.espaco] = it;
  }
  return out;
}

/** Dá para comprar? Devolve o motivo para o botão (o banco confere de novo). */
export function podeComprar(it: ItemLoja, tenho: number, saldo: number | null): { ok: boolean; motivo?: string } {
  if (!acumula(it.espaco) && tenho > 0) return { ok: false, motivo: "Na mochila" };
  if (it.espaco === "escudo" && tenho >= MAX_ESCUDOS) return { ok: false, motivo: `Máximo de ${MAX_ESCUDOS}` };
  if (it.espaco === "consumivel" && tenho >= MAX_CONSUMIVEL) return { ok: false, motivo: `Máximo de ${MAX_CONSUMIVEL}` };
  if (saldo !== null && saldo < it.preco) return { ok: false, motivo: `Faltam ${it.preco - saldo}` };
  return { ok: true };
}

/** Quanto dura a animação de cada consumível no Sítio. */
/** Um ciclo da animação (um gole, um trago, uma tremedeira); ela se repete enquanto o efeito dura. */
export const DURA_ANIM: Readonly<Record<Anim, number>> = { fumar: 6000, charuto: 7000, beber: 4500, tremer: 5000, tonto: 7000 };
/** Quanto o efeito dura no boneco (ms): o cigarrinho dura 3 min, o charuto 5, a bebida 2 a 4. */
export const DURA_EFEITO: Readonly<Record<Anim, number>> = { fumar: 180_000, charuto: 300_000, beber: 120_000, tremer: 180_000, tonto: 240_000 };
/** Entre um ciclo e outro do tremer e do tonto, o boneco fica parado um pouco (a tremedeira vem e vai). */
const PAUSA: Partial<Record<Anim, number>> = { tremer: 9000, tonto: 6000 };

/** Balanço do boneco (graus) durante o efeito: tremer é rápido e curto, tonto é largo e lento; repete até acabar. */
export function balanco(anim: Anim, t: number) {
  if (t < 0 || t >= DURA_EFEITO[anim]) return 0;
  const ciclo = DURA_ANIM[anim] + (PAUSA[anim] ?? 0);
  const c = t % ciclo;
  if (anim === "tremer" && c < DURA_ANIM.tremer) return Math.sin(c / 22) * 3;
  if (anim === "tonto" && c > 1800 && c < DURA_ANIM.tonto) {
    const k = (c - 1800) / (DURA_ANIM.tonto - 1800);
    return Math.sin(k * Math.PI * 5) * 10 * (1 - k);
  }
  return 0;
}

/** "2:05" que falta do efeito (vazio quando acabou). */
export function restanteEfeito(anim: Anim, t: number) {
  const s = Math.ceil((DURA_EFEITO[anim] - t) / 1000);
  if (s <= 0) return "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Texto do aviso no canto do Sítio ("Pitoco acendeu um cigarrinho"). */
export function textoConsumo(nome: string, it: Pick<ItemLoja, "id" | "nome">) {
  const n = it.nome.toLowerCase();
  if (it.id === "cigarro" || it.id === "charuto") return `${nome} acendeu um ${n}`;
  if (it.id === "chimarrao") return `${nome} tomou um chimarrão`;
  if (it.id === "pipoca" || it.id === "pizza") return `${nome} comeu uma ${n}`;
  if (it.id === "champanhe") return `${nome} estourou um champanhe`;
  return `${nome} tomou um${it.id === "cerveja" || it.id === "caipirinha" ? "a" : ""} ${n}`;
}
