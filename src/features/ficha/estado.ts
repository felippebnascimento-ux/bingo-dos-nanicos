/*
 * Ficha do nanico: pede os números à função ficha-jogos (que guarda por 6 h) e lembra o que já veio.
 * A Riot e a Steam nunca são chamadas do navegador: a chave fica no servidor.
 */
import { create } from "zustand";
import { sb } from "@/lib/supabase";
import { lerNumeros, type NumerosFicha } from "./numeros";
import { lerAtributos, lerTodos, limparNotas, type Atributos, type Notas } from "@/features/nanicos/atributos";

type Estado = { porNanico: Record<string, NumerosFicha>; carregando: Record<string, boolean>; falhou: Record<string, boolean> };

export const useFicha = create<Estado>()(() => ({ porNanico: {}, carregando: {}, falhou: {} }));

const marcar = (campo: "carregando" | "falhou", fid: string, v: boolean) =>
  useFicha.setState((s) => ({ [campo]: { ...s[campo], [fid]: v } }));

/** Busca (ou pega do cache do servidor) os números de um nanico. */
export async function carregarFicha(fid: string) {
  if (useFicha.getState().carregando[fid]) return;
  marcar("carregando", fid, true);
  marcar("falhou", fid, false);
  try {
    const { data, error } = await sb().functions.invoke("ficha-jogos", { body: { friend_id: fid } });
    if (error) throw error;
    useFicha.setState((s) => ({ porNanico: { ...s.porNanico, [fid]: lerNumeros(data) } }));
  } catch (e) {
    console.warn("ficha indisponível", e);
    marcar("falhou", fid, true);
  } finally {
    marcar("carregando", fid, false);
  }
}

/* ---------- atributos votados (metade zoeira) ---------- */
/** `travado` = votei há menos de uma semana (calculado ao carregar, não a cada desenho) */
type MeuVoto = { notas: Notas | null; mudaEm: string | null; travado: boolean };
type EstadoAtributos = { todos: Record<string, Atributos> | null; meu: Record<string, MeuVoto> };

/** `todos` = null enquanto não carregou (ou se o SQL dos atributos ainda não rodou: aí fica escondido). */
export const useAtributos = create<EstadoAtributos>()(() => ({ todos: null, meu: {} }));

let pedindoTodos = false;
/** Médias de todos os nanicos de uma vez (uma chamada só para a grade inteira). */
export async function carregarAtributos() {
  if (pedindoTodos) return;
  pedindoTodos = true;
  try {
    const { data, error } = await sb().rpc("atributos_todos");
    if (error) throw error;
    useAtributos.setState({ todos: lerTodos(data) });
  } catch (e) {
    console.warn("atributos indisponíveis", e);
  } finally {
    pedindoTodos = false;
  }
}

/** As minhas notas para um nanico e a partir de quando posso mudar. */
export async function carregarMeuVoto(fid: string) {
  const { data, error } = await sb().rpc("meu_voto", { p_para: fid });
  if (error) return;
  const o = (data ?? {}) as { notas?: unknown; muda_em?: unknown };
  const mudaEm = typeof o.muda_em === "string" ? o.muda_em : null;
  const meu: MeuVoto = { notas: limparNotas(o.notas), mudaEm, travado: !!mudaEm && Date.parse(mudaEm) > Date.now() };
  useAtributos.setState((s) => ({ meu: { ...s.meu, [fid]: meu } }));
}

/** Manda as 6 notas. Quem confere tudo (semana, si mesmo, 0 a 10) é o banco; o erro dele vai para a pessoa. */
export async function votar(fid: string, notas: Notas) {
  const limpas = limparNotas(notas);
  if (!limpas) throw new Error("Cada nota é um número inteiro de 0 a 10.");
  const { error } = await sb().rpc("votar_atributos", { p_para: fid, p_notas: limpas });
  if (error) throw error;
  const { data } = await sb().rpc("atributos_de", { p_para: fid });
  const at = lerAtributos(data);
  if (at) useAtributos.setState((s) => ({ todos: { ...(s.todos ?? {}), [fid]: at } }));
  await carregarMeuVoto(fid);
}
