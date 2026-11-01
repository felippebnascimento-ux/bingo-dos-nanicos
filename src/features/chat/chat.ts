/*
 * Chat da sala (fica salvo no Supabase, tabela `chat_messages`).
 * O autor é sempre quem está logado (o banco garante); aqui só lista, conta as não lidas e envia.
 */
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { getApp, setApp, useApp } from "@/lib/store";
import { q, sb } from "@/lib/supabase";

export type MsgChat = { id: string | number; user_id: string; text: string; created_at: string };

export const useChat = create<{ msgs: MsgChat[]; ok: boolean }>()(() => ({ msgs: [], ok: true }));

const COLUNAS = "id,user_id,text,created_at";

/** Confere a linha que veio do banco antes de guardar. */
function limpa(r: unknown): MsgChat | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "string" && typeof o.id !== "number") return null;
  if (typeof o.user_id !== "string" || typeof o.text !== "string" || typeof o.created_at !== "string") return null;
  return { id: o.id, user_id: o.user_id, text: o.text, created_at: o.created_at };
}

/** O chat está na tela agora (aba Ao vivo, painel Chat, janela visível)? */
export const chatVisivel = () => {
  const s = getApp();
  return s.aba === "live" && s.railTab === "chat" && !document.hidden;
};

function zerarSeVisivel() {
  if (chatVisivel() && getApp().chatUnread) setApp({ chatUnread: 0 });
}

function addChat(r: unknown) {
  const m = limpa(r);
  if (!m) return;
  const { msgs } = useChat.getState();
  if (msgs.some((x) => x.id === m.id)) return;
  const nova = [...msgs, m].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (nova.length > 200) nova.shift();
  useChat.setState({ msgs: nova });
  if (m.user_id !== getApp().myUid && !chatVisivel()) setApp({ chatUnread: getApp().chatUnread + 1 });
}

let ligado = false;
/** Carrega as últimas mensagens e passa a ouvir as novas. Chamado uma vez ao entrar no site. */
export async function carregarChat(): Promise<void> {
  if (!ligado) {
    ligado = true;
    aoMudarTabela("chat_messages", (row) => addChat(row));
    /* abriu o chat (aba ou painel) ou voltou para a janela: zera as não lidas */
    useApp.subscribe((s, p) => {
      if (s.aba !== p.aba || s.railTab !== p.railTab) zerarSeVisivel();
    });
    document.addEventListener("visibilitychange", zerarSeVisivel);
  }
  try {
    const rows = await q<unknown[]>(
      sb().from("chat_messages").select(COLUNAS).order("created_at", { ascending: false }).limit(80),
    );
    const msgs = (rows || []).map(limpa).filter((m): m is MsgChat => !!m).reverse();
    useChat.setState({ msgs, ok: true });
  } catch (e) {
    console.warn("chat indisponível", e);
    useChat.setState({ ok: false });
  }
}

/** Envia uma mensagem (até 300 letras). Lança o erro do banco se não der. */
export async function enviarChat(texto: string) {
  const rows = await q<unknown[]>(sb().from("chat_messages").insert({ text: texto.slice(0, 300) }).select(COLUNAS));
  (rows || []).forEach(addChat);
}
