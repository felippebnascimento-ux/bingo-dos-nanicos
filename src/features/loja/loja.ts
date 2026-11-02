/*
 * Loja e mochila (puro e testado): os espaços, a vitrine agrupada, o que cada um tem equipado e se dá
 * para comprar. Só serve para MOSTRAR: quem confere preço, saldo e repetição é o banco (comprar(), seção 15).
 */
export type Espaco = "cadeira" | "mesa" | "tapete" | "poster" | "planta" | "parede" | "luz" | "titulo" | "moldura" | "escudo" | "consumivel";
export type Anim = "fumar" | "charuto" | "beber" | "tremer" | "tonto";
export type ItemLoja = { id: string; nome: string; descricao: string; espaco: Espaco; preco: number; dados: { cor?: string; texto?: string; anim?: Anim }; ordem: number };
export type LinhaMochila = { userId: string; itemId: string; qtd: number; equipado: boolean };

/** Os grupos da vitrine, na ordem em que aparecem. */
export const GRUPOS: readonly { id: string; nome: string; espacos: readonly Espaco[] }[] = [
  { id: "consumivel", nome: "Para usar no Sítio", espacos: ["consumivel"] },
  { id: "quarto", nome: "Para o quarto", espacos: ["cadeira", "mesa", "tapete", "poster", "planta", "parede", "luz"] },
  { id: "visual", nome: "Títulos e molduras", espacos: ["titulo", "moldura"] },
  { id: "escudo", nome: "Proteção", espacos: ["escudo"] },
];

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
};

/** Escudo e consumíveis acumulam; o resto só se compra uma vez e se equipa. */
export const acumula = (e: Espaco) => e === "escudo" || e === "consumivel";
export const equipavel = (e: Espaco) => !acumula(e);
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
export const DURA_ANIM: Readonly<Record<Anim, number>> = { fumar: 6000, charuto: 7000, beber: 4500, tremer: 5000, tonto: 7000 };

/** Balanço do boneco (graus) durante a animação: tremer é rápido e curto, tonto é largo e lento. */
export function balanco(anim: Anim, t: number) {
  if (anim === "tremer" && t < DURA_ANIM.tremer) return Math.sin(t / 22) * 3;
  if (anim === "tonto" && t > 1800 && t < DURA_ANIM.tonto) {
    const k = (t - 1800) / (DURA_ANIM.tonto - 1800);
    return Math.sin(k * Math.PI * 5) * 10 * (1 - k);
  }
  return 0;
}

/** Texto do aviso no canto do Sítio ("Pitoco acendeu um cigarrinho"). */
export function textoConsumo(nome: string, it: Pick<ItemLoja, "id" | "nome">) {
  const n = it.nome.toLowerCase();
  if (it.id === "cigarro" || it.id === "charuto") return `${nome} acendeu um ${n}`;
  if (it.id === "chimarrao") return `${nome} tomou um chimarrão`;
  return `${nome} tomou um${it.id === "cerveja" || it.id === "caipirinha" ? "a" : ""} ${n}`;
}
