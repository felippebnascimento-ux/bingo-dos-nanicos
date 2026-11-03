/*
 * Chat estilo Habbo no K-FOFO: cada mensagem nova do #geral vira um balão em cima do boneco de quem escreveu, por
 * alguns segundos. As mensagens são as do chat de sempre (`chat_messages`, sala "geral", gravadas pelo banco e
 * entregues pelo tempo real), então nada de broadcast novo: o balão só aparece para quem está na mesma cena que o
 * boneco (o K-FOFO ou o mesmo quarto), porque só os bonecos da cena são desenhados.
 */
import { create } from "zustand";
import { useChat } from "@/features/chat/chat";

export type Balao = { id: string; uid: string; texto: string; ate: number };

/** quanto tempo o balão fica na tela */
export const BALAO_MS = 9000;
/** no máximo 3 balões por pessoa: o mais velho sai */
const POR_PESSOA = 3;

export const useBaloes = create<{ lista: Balao[] }>()(() => ({ lista: [] }));

/** Junta os balões novos aos que ainda valem (puro): tira os vencidos e deixa só os últimos 3 de cada um. */
export function juntarBaloes(lista: readonly Balao[], novos: readonly Balao[], agora: number): Balao[] {
  const todos = [...lista, ...novos].filter((b) => b.ate > agora);
  const cont = new Map<string, number>();
  const fica: Balao[] = [];
  for (let k = todos.length - 1; k >= 0; k--) {
    const n = cont.get(todos[k].uid) ?? 0;
    if (n >= POR_PESSOA) continue;
    cont.set(todos[k].uid, n + 1);
    fica.unshift(todos[k]);
  }
  return fica;
}

let ligado = false;
const vistos = new Set<string>();
let poda: ReturnType<typeof setTimeout> | undefined;

function podar() {
  clearTimeout(poda);
  const lista = juntarBaloes(useBaloes.getState().lista, [], Date.now());
  useBaloes.setState({ lista });
  if (lista.length) poda = setTimeout(podar, Math.max(200, Math.min(...lista.map((b) => b.ate)) - Date.now() + 50));
}

/** Passa a transformar as mensagens novas do #geral em balões (as que já estavam carregadas não viram balão). */
export function iniciarBaloes() {
  if (ligado) return;
  ligado = true;
  for (const m of useChat.getState().geral) vistos.add(String(m.id));
  useChat.subscribe((s, p) => {
    if (s.geral === p.geral) return;
    const agora = Date.now();
    const novos: Balao[] = [];
    for (const m of s.geral) {
      const id = String(m.id);
      if (vistos.has(id)) continue;
      vistos.add(id);
      /* mensagem antiga que chegou agora (carregou o histórico): sem balão */
      if (Math.abs(agora - Date.parse(m.created_at)) > 300_000) continue;
      novos.push({ id, uid: m.user_id, texto: m.text, ate: agora + BALAO_MS });
    }
    if (!novos.length) return;
    useBaloes.setState({ lista: juntarBaloes(useBaloes.getState().lista, novos, agora) });
    podar();
  });
}
