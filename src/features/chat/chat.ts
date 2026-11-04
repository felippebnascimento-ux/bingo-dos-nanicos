/*
 * Chat da sala (fica salvo no Supabase, tabela `chat_messages`).
 * O autor é sempre quem está logado (o banco garante); aqui só lista, conta as não lidas e envia.
 */
import { create } from "zustand";
import { ehComandoPresente } from "@/features/hall/comandos";
import { aoMudarTabela } from "@/lib/sala";
import { getApp, setApp, useApp } from "@/lib/store";
import { q, sb } from "@/lib/supabase";

export type MsgChat = { id: string | number; user_id: string; text: string; created_at: string; sala: string; grito?: boolean };

/**
 * `msgs` = o chat de onde eu estou (a minha sala, ou o geral no lobby); `geral` = o chat do lobby,
 * que aparece na janela das salas; `porCanal` = todos os canais de texto já carregados (aba Chat);
 * `naoLidas` = mensagens novas por canal desde que abri o site. Sem o SQL das salas, tudo é o chat único de antes.
 */
export const useChat = create<{
  msgs: MsgChat[];
  geral: MsgChat[];
  porCanal: Record<string, MsgChat[]>;
  naoLidas: Record<string, number>;
  ok: boolean;
}>()(() => ({ msgs: [], geral: [], porCanal: {}, naoLidas: {}, ok: true }));

const comSalas = () => getApp().salas.length > 0;
const COLUNAS = () => (comSalas() ? "id,user_id,text,created_at,sala,grito" : "id,user_id,text,created_at");
/** Chave do chat de onde eu estou. */
export const chatAtual = () => getApp().minhaSala ?? "geral";

/** Confere a linha que veio do banco antes de guardar. */
function limpa(r: unknown): MsgChat | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "string" && typeof o.id !== "number") return null;
  if (typeof o.user_id !== "string" || typeof o.text !== "string" || typeof o.created_at !== "string") return null;
  const sala = typeof o.sala === "string" && /^[a-z0-9-]{2,20}$/.test(o.sala) ? o.sala : "geral";
  return { id: o.id, user_id: o.user_id, text: o.text, created_at: o.created_at, sala, ...(o.grito === true ? { grito: true } : {}) };
}

/* mensagens guardadas por chat ("geral" ou o id da sala) */
const porSala = new Map<string, MsgChat[]>();
const publicar = () =>
  useChat.setState({ msgs: porSala.get(chatAtual()) ?? [], geral: porSala.get("geral") ?? [], porCanal: Object.fromEntries(porSala) });

/** O chat da minha sala está na tela agora (aba Ao vivo, painel Chat, janela visível)? */
export const chatVisivel = () => {
  const s = getApp();
  return s.aba === "live" && s.railTab === "chat" && !document.hidden;
};

/** Este canal de texto está na tela agora (aba Chat nele, ou o painel do Ao vivo, se for o da minha sala)? */
const canalVisivel = (canal: string) => {
  const s = getApp();
  return !document.hidden && ((s.aba === "chat" && s.canalTexto === canal) || (canal === chatAtual() && chatVisivel()));
};

function zerarSeVisivel() {
  if (chatVisivel() && getApp().chatUnread) setApp({ chatUnread: 0 });
  const nl = useChat.getState().naoLidas;
  const vistos = Object.keys(nl).filter((c) => nl[c] && canalVisivel(c));
  if (vistos.length) useChat.setState({ naoLidas: { ...nl, ...Object.fromEntries(vistos.map((c) => [c, 0])) } });
}

function addChat(r: unknown) {
  const m = limpa(r);
  if (!m) return;
  const msgs = porSala.get(m.sala) ?? [];
  if (msgs.some((x) => x.id === m.id)) return;
  const nova = [...msgs, m].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (nova.length > 200) nova.shift();
  porSala.set(m.sala, nova);
  publicar();
  if (m.user_id === getApp().myUid) return;
  /* não lidas do menu "Ao vivo": só do chat de onde eu estou */
  if (m.sala === chatAtual() && !chatVisivel()) setApp({ chatUnread: getApp().chatUnread + 1 });
  /* não lidas de cada canal de texto */
  if (!canalVisivel(m.sala)) {
    const nl = useChat.getState().naoLidas;
    useChat.setState({ naoLidas: { ...nl, [m.sala]: (nl[m.sala] ?? 0) + 1 } });
  }
}

async function carregarSala(sala: string) {
  let pedido = sb().from("chat_messages").select(COLUNAS()).order("created_at", { ascending: false }).limit(80);
  if (comSalas()) pedido = pedido.eq("sala", sala);
  const rows = await q<unknown[]>(pedido);
  porSala.set(sala, (rows || []).map(limpa).filter((m): m is MsgChat => !!m).reverse());
}

let ligado = false;
/** Carrega as últimas mensagens (do geral e da minha sala) e passa a ouvir as novas. */
export async function carregarChat(): Promise<void> {
  if (!ligado) {
    ligado = true;
    aoMudarTabela("chat_messages", (row) => addChat(row));
    /* abriu o chat (aba ou painel) ou voltou para a janela: zera as não lidas */
    useApp.subscribe((s, p) => {
      if (s.aba !== p.aba || s.railTab !== p.railTab || s.canalTexto !== p.canalTexto) zerarSeVisivel();
      /* trocou de sala: o chat passa a ser o da sala nova */
      if (s.minhaSala !== p.minhaSala) {
        setApp({ chatUnread: 0 });
        carregarChat();
      }
    });
    document.addEventListener("visibilitychange", zerarSeVisivel);
  }
  try {
    await Promise.all([carregarSala("geral"), chatAtual() !== "geral" ? carregarSala(chatAtual()) : null]);
    publicar();
    useChat.setState({ ok: true });
  } catch (e) {
    console.warn("chat indisponível", e);
    useChat.setState({ ok: false });
  }
}

/** Abre um canal de texto na aba Chat (carrega as mensagens dele na primeira vez). */
export function abrirCanalTexto(canal: string) {
  setApp({ aba: "chat", canalTexto: canal });
  if (porSala.has(canal) || !comSalas()) return;
  carregarSala(canal)
    .then(publicar)
    .catch((e) => console.warn("canal indisponível", e));
}

/** Envia uma mensagem (até 300 letras) para o chat de onde eu estou, ou para `sala`. Lança o erro do banco se não der. */
/** Manda uma mensagem; `grito` (K-FOFO, seção 52) faz o balão sair grande. */
export async function enviarChat(texto: string, sala = chatAtual(), grito = false) {
  if (ehComandoPresente(texto)) return; /* sem aviso: o comando é escondido */
  const linha = comSalas() ? { text: texto.slice(0, 300), sala, ...(grito ? { grito: true } : {}) } : { text: texto.slice(0, 300) };
  const rows = await q<unknown[]>(sb().from("chat_messages").insert(linha).select(COLUNAS()));
  (rows || []).forEach(addChat);
}
