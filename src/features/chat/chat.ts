/*
 * Chat da sala (fica salvo no Supabase, tabela `chat_messages`).
 * O autor é sempre quem está logado (o banco garante); aqui só lista, conta as não lidas e envia.
 * Como no Discord (seção 70): responder, editar e apagar a própria (moderador apaga qualquer uma), foto ou GIF,
 * fixar no canal, reações com emoji, @menções (contam à parte), "digitando…" (evento `chat` do lobby, nunca no banco),
 * a linha de "novas mensagens" (o último lido de cada canal fica no aparelho, `chat-lido`), canais silenciados
 * (`chat-mudos`), mensagens antigas rolando para cima e busca. Sem o SQL da seção 70, volta para as colunas antigas.
 */
import { create } from "zustand";
import { ehComandoPresente } from "@/features/hall/comandos";
import { comprimir } from "@/features/midias/midiasDados";
import { aoMudarTabela, aoReceber, enviar, estaNaSala, limitePorPessoa } from "@/lib/sala";
import { getApp, setApp, useApp } from "@/lib/store";
import { q, sb } from "@/lib/supabase";
import { local, newId } from "@/lib/util";
import { toast } from "@/lib/toast";
import { somDeLive } from "@/features/live/sonsVoz";
import { escondoMensagensDe } from "@/features/status/notas";
import { meMenciona } from "./formato";

export type MsgChat = {
  id: string | number;
  user_id: string;
  text: string;
  created_at: string;
  sala: string;
  grito?: boolean;
  /* seção 70 */
  respostaA?: number | null;
  editadoEm?: string | null;
  midia?: string | null;
  fixadaEm?: string | null;
};

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
  /** quantas vezes me mencionaram em cada canal (fora as que eu já vi) */
  mencoes: Record<string, number>;
  /** reações: mensagem → emoji → quem */
  reacoes: Record<string, Record<string, string[]>>;
  /** quem está digitando em cada canal (canal → userId → quando avisou) */
  digitando: Record<string, Record<string, number>>;
  /** o canal ainda tem mensagens mais antigas para buscar */
  temAntigas: Record<string, boolean>;
  /** canais que eu silenciei (não contam não lidas, só menções) */
  mudos: string[];
  /** texto para pôr na caixa do chat que estiver aberto ("Mencionar" do menu de uma pessoa); `n` muda a cada pedido */
  inserir: { texto: string; n: number } | null;
}>()(() => ({ msgs: [], geral: [], porCanal: {}, naoLidas: {}, ok: true, mencoes: {}, reacoes: {}, digitando: {}, temAntigas: {}, mudos: lerMudos(), inserir: null }));

/**
 * "Mencionar", como no Discord: abre o chat (o da minha sala, no Ao vivo; fora de uma sala, o #geral) e põe o @ da
 * pessoa na caixa de texto.
 */
export function mencionarNoChat(nome: string) {
  if (getApp().minhaSala) setApp({ aba: "live", railTab: "chat" });
  else abrirCanalTexto("geral");
  /* espera a tela do chat aparecer (trocar de aba é um render) */
  setTimeout(() => {
    const n = (useChat.getState().inserir?.n ?? 0) + 1;
    useChat.setState({ inserir: { texto: `@${arrobaDe(nome)} `, n } });
  }, 150);
}

function lerMudos(): string[] {
  const v = local.json<unknown>("chat-mudos");
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
}

const comSalas = () => getApp().salas.length > 0;
/* sem o SQL da seção 70 as colunas novas não existem: volta para as antigas */
let sem70 = false;
const COLUNAS = () =>
  comSalas() ? (sem70 ? "id,user_id,text,created_at,sala,grito" : "id,user_id,text,created_at,sala,grito,resposta_a,editado_em,midia,fixada_em") : "id,user_id,text,created_at";
const erroDeColuna = (e: unknown) => {
  const m = e as { code?: string; message?: string };
  return m?.code === "42703" || m?.code === "PGRST204" || /column|coluna/i.test(String(m?.message ?? ""));
};
/** Faz a consulta com as colunas novas; se o banco ainda não tem, refaz com as antigas. */
async function comColunas<T>(fazer: () => PromiseLike<T> | T): Promise<T> {
  const tentouNovo = !sem70 && comSalas();
  try {
    return await fazer();
  } catch (e) {
    if (!tentouNovo || !erroDeColuna(e)) throw e;
    if (!sem70) console.warn("chat sem a seção 70 do SQL: usando as colunas antigas");
    sem70 = true;
    return fazer();
  }
}
export const chatNovo = () => !sem70 && comSalas();

/** Chave do chat de onde eu estou. */
export const chatAtual = () => getApp().minhaSala ?? "geral";

/** Confere a linha que veio do banco antes de guardar. */
function limpa(r: unknown): MsgChat | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "string" && typeof o.id !== "number") return null;
  if (typeof o.user_id !== "string" || typeof o.text !== "string" || typeof o.created_at !== "string") return null;
  const sala = typeof o.sala === "string" && /^[a-z0-9-]{2,20}$/.test(o.sala) ? o.sala : "geral";
  return {
    id: o.id,
    user_id: o.user_id,
    text: o.text,
    created_at: o.created_at,
    sala,
    ...(o.grito === true ? { grito: true } : {}),
    respostaA: o.resposta_a == null ? null : Number(o.resposta_a),
    editadoEm: typeof o.editado_em === "string" ? o.editado_em : null,
    midia: typeof o.midia === "string" && /^[0-9a-f-]{36}\/chat-[a-z0-9-]{6,40}\.(webp|gif)$/.test(o.midia) ? o.midia : null,
    fixadaEm: typeof o.fixada_em === "string" ? o.fixada_em : null,
  };
}

/* mensagens guardadas por chat ("geral" ou o id da sala) */
const porSala = new Map<string, MsgChat[]>();
const publicar = () =>
  useChat.setState({ msgs: porSala.get(chatAtual()) ?? [], geral: porSala.get("geral") ?? [], porCanal: Object.fromEntries(porSala) });

/* ---------- o último lido de cada canal (no aparelho) ---------- */
const lerLidos = (): Record<string, number> => {
  const v = local.json<Record<string, unknown>>("chat-lido");
  return v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === "number")) : {};
};
/** Até qual mensagem eu li neste canal (0 = nunca abri). */
export const lidoAte = (canal: string) => lerLidos()[canal] ?? 0;
function marcarLido(canal: string) {
  const ultima = (porSala.get(canal) ?? []).reduce((n, m) => Math.max(n, Number(m.id) || 0), 0);
  const lidos = lerLidos();
  if (ultima > (lidos[canal] ?? 0)) local.setJson("chat-lido", { ...lidos, [canal]: ultima });
}
/** "Marcar como lido": zera as não lidas e as menções do canal. */
export function marcarComoLido(canal: string) {
  marcarLido(canal);
  const st = useChat.getState();
  useChat.setState({ naoLidas: { ...st.naoLidas, [canal]: 0 }, mencoes: { ...st.mencoes, [canal]: 0 } });
  if (canal === chatAtual()) setApp({ chatUnread: 0 });
}
/** Silenciar um canal: as mensagens não contam como não lidas (só as menções a mim). */
export function silenciarCanal(canal: string, sim: boolean) {
  const mudos = sim ? [...new Set([...useChat.getState().mudos, canal])] : useChat.getState().mudos.filter((c) => c !== canal);
  local.setJson("chat-mudos", mudos);
  useChat.setState({ mudos });
  if (sim) useChat.setState({ naoLidas: { ...useChat.getState().naoLidas, [canal]: 0 } });
}

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
  const nl = useChat.getState().naoLidas, mc = useChat.getState().mencoes;
  const vistos = [...new Set([...Object.keys(nl), ...Object.keys(mc)])].filter((c) => (nl[c] || mc[c]) && canalVisivel(c));
  if (vistos.length)
    useChat.setState({
      naoLidas: { ...nl, ...Object.fromEntries(vistos.map((c) => [c, 0])) },
      mencoes: { ...mc, ...Object.fromEntries(vistos.map((c) => [c, 0])) },
    });
  for (const c of [...porSala.keys()]) if (canalVisivel(c)) marcarLido(c);
}

/** O meu @ (o nome em minúsculas, sem espaço). */
export const arrobaDe = (nome: string | undefined) => (nome ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "");
const meuAt = () => arrobaDe(getApp().friends.find((f) => f.user_id === getApp().myUid)?.name ?? getApp().myName);

function addChat(r: unknown) {
  const m = limpa(r);
  if (!m) return;
  const msgs = porSala.get(m.sala) ?? [];
  if (msgs.some((x) => x.id === m.id)) return;
  const nova = [...msgs, m].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (nova.length > 400) nova.shift();
  porSala.set(m.sala, nova);
  /* quem mandou parou de digitar */
  const dg = useChat.getState().digitando[m.sala];
  if (dg?.[m.user_id]) {
    const resto = { ...dg };
    delete resto[m.user_id];
    useChat.setState({ digitando: { ...useChat.getState().digitando, [m.sala]: resto } });
  }
  publicar();
  if (m.user_id === getApp().myUid) {
    if (canalVisivel(m.sala)) marcarLido(m.sala);
    return;
  }
  const mudo = useChat.getState().mudos.includes(m.sala);
  const mencionou = meMenciona(m.text, meuAt());
  /* não lidas do menu "Ao vivo": só do chat de onde eu estou */
  if (m.sala === chatAtual() && !chatVisivel() && !mudo) setApp({ chatUnread: getApp().chatUnread + 1 });
  /* não lidas e menções de cada canal de texto */
  if (!canalVisivel(m.sala)) {
    const st = useChat.getState();
    if (!mudo) useChat.setState({ naoLidas: { ...st.naoLidas, [m.sala]: (st.naoLidas[m.sala] ?? 0) + 1 } });
    if (mencionou) useChat.setState({ mencoes: { ...st.mencoes, [m.sala]: (st.mencoes[m.sala] ?? 0) + 1 } });
  } else marcarLido(m.sala);
}

/* editou, fixou ou apagou (no DELETE só vem o id) */
function mudouChat(r: unknown, ev: string) {
  const o = (r ?? {}) as Record<string, unknown>;
  if (ev === "DELETE") {
    const id = o.id;
    for (const [sala, l] of porSala) if (l.some((x) => String(x.id) === String(id))) porSala.set(sala, l.filter((x) => String(x.id) !== String(id)));
    publicar();
    return;
  }
  const m = limpa(r);
  if (!m) return;
  const l = porSala.get(m.sala);
  if (!l) return;
  porSala.set(m.sala, l.map((x) => (String(x.id) === String(m.id) ? m : x)));
  publicar();
}

async function carregarSala(sala: string) {
  const rows = await comColunas(() => {
    let pedido = sb().from("chat_messages").select(COLUNAS()).order("created_at", { ascending: false }).limit(80);
    if (comSalas()) pedido = pedido.eq("sala", sala);
    return q<unknown[]>(pedido);
  });
  const lista = (rows || []).map(limpa).filter((m): m is MsgChat => !!m).reverse();
  porSala.set(sala, lista);
  useChat.setState({ temAntigas: { ...useChat.getState().temAntigas, [sala]: lista.length >= 80 } });
  /* menções que chegaram enquanto eu estava fora (depois do último lido) */
  const lido = lidoAte(sala);
  if (lido) {
    const at = meuAt();
    const n = lista.filter((m) => Number(m.id) > lido && m.user_id !== getApp().myUid && meMenciona(m.text, at)).length;
    if (n && !canalVisivel(sala)) useChat.setState({ mencoes: { ...useChat.getState().mencoes, [sala]: n } });
  }
  void carregarReacoes(lista.map((m) => m.id));
}

/** Mais 60 mensagens antigas (rolando para cima). */
export async function carregarAntigas(sala: string): Promise<number> {
  const l = porSala.get(sala) ?? [];
  if (!l.length || !useChat.getState().temAntigas[sala]) return 0;
  const rows = await comColunas(() => {
    let pedido = sb().from("chat_messages").select(COLUNAS()).lt("created_at", l[0].created_at).order("created_at", { ascending: false }).limit(60);
    if (comSalas()) pedido = pedido.eq("sala", sala);
    return q<unknown[]>(pedido);
  });
  const antigas = (rows || []).map(limpa).filter((m): m is MsgChat => !!m).reverse();
  porSala.set(sala, [...antigas.filter((a) => !l.some((x) => x.id === a.id)), ...(porSala.get(sala) ?? [])]);
  useChat.setState({ temAntigas: { ...useChat.getState().temAntigas, [sala]: antigas.length >= 60 } });
  publicar();
  void carregarReacoes(antigas.map((m) => m.id));
  return antigas.length;
}

/** As fixadas de um canal (da mais nova para a mais velha). */
export async function fixadasDe(sala: string): Promise<MsgChat[]> {
  if (!chatNovo()) return [];
  const rows = await q<unknown[]>(sb().from("chat_messages").select(COLUNAS()).eq("sala", sala).not("fixada_em", "is", null).order("fixada_em", { ascending: false }).limit(50));
  return (rows || []).map(limpa).filter((m): m is MsgChat => !!m);
}

/** Procura mensagens do canal pelo texto (as 50 mais novas). */
export async function buscarNoChat(sala: string, termo: string): Promise<MsgChat[]> {
  const t = termo.trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (t.length < 2) return [];
  const rows = await comColunas(() => {
    let pedido = sb().from("chat_messages").select(COLUNAS()).ilike("text", `%${t}%`).order("created_at", { ascending: false }).limit(50);
    if (comSalas()) pedido = pedido.eq("sala", sala);
    return q<unknown[]>(pedido);
  });
  return (rows || []).map(limpa).filter((m): m is MsgChat => !!m);
}

/* ---------- reações ---------- */
async function carregarReacoes(ids: (string | number)[]) {
  if (!chatNovo() || !ids.length) return;
  const { data } = await sb().from("chat_reacoes").select("mensagem_id,user_id,emoji").in("mensagem_id", ids.slice(-200));
  const reacoes = { ...useChat.getState().reacoes };
  for (const id of ids) reacoes[String(id)] = {};
  for (const r of data ?? []) {
    const d = (reacoes[String(r.mensagem_id)] ??= {});
    (d[String(r.emoji)] ??= []).push(String(r.user_id));
  }
  useChat.setState({ reacoes });
}
/** Reage (ou tira a reação) com um emoji, na hora na tela. */
export async function reagirChat(m: MsgChat, emoji: string) {
  const eu = getApp().myUid;
  if (!eu || !chatNovo()) return;
  const id = String(m.id);
  const st = useChat.getState();
  const daMsg = { ...(st.reacoes[id] ?? {}) };
  const quem = daMsg[emoji] ?? [];
  const ja = quem.includes(eu);
  daMsg[emoji] = ja ? quem.filter((u) => u !== eu) : [...quem, eu];
  if (!daMsg[emoji].length) delete daMsg[emoji];
  useChat.setState({ reacoes: { ...st.reacoes, [id]: daMsg } });
  const { error } = ja
    ? await sb().from("chat_reacoes").delete().eq("mensagem_id", m.id).eq("user_id", eu).eq("emoji", emoji)
    : await sb().from("chat_reacoes").insert({ mensagem_id: m.id, emoji });
  if (error && error.code !== "23505") void carregarReacoes([m.id]);
}
function mudouReacao(r: Record<string, unknown> | null) {
  const id = r?.mensagem_id;
  if (id != null) void carregarReacoes([id as number]);
  else {
    /* no DELETE só vem a chave: relê as do canal aberto */
    const ids = (porSala.get(getApp().canalTexto) ?? []).map((m) => m.id);
    void carregarReacoes(ids);
  }
}

/* ---------- digitando ---------- */
let ultimoDigitando = 0;
/** Estou digitando neste canal (avisa no máximo a cada 3 s). */
export function avisarDigitandoChat(canal: string) {
  const agora = Date.now();
  if (agora - ultimoDigitando < 3000) return;
  ultimoDigitando = agora;
  enviar("chat", { t: "digitando", canal });
}
const limiteChat = limitePorPessoa(30, 10000);
const limiteChamar = limitePorPessoa(3, 60_000);
/** "Iniciar chamada" do Discord: chama alguém para o canal de voz em que estou (aviso para ele, pelo evento `chat`). */
export function chamarParaCall(fid: string) {
  const sala = getApp().minhaSala;
  if (!sala || !getApp().myVozSid) return toast("Entre num canal de voz para chamar alguém.");
  if (!limiteChamar("eu")) return toast("Calma: espere um pouco para chamar de novo.");
  enviar("chat", { t: "chamar", para: fid, sala });
  toast("Chamado. Ele recebe o aviso na tela.");
}
function onChamado(m: Record<string, unknown>) {
  const { myFid, salas, online, friends, minhaSala, myVozSid } = getApp();
  if (m.para !== myFid || typeof m.sala !== "string" || !estaNaSala(m.from) || !limiteChamar(String(m.from))) return;
  const sala = salas.find((s) => s.id === m.sala);
  const fid = online.find((p) => p.key === m.from)?.fid;
  const quem = friends.find((f) => f.id === fid);
  if (!sala || !quem || (minhaSala === sala.id && myVozSid)) return;
  if (escondoMensagensDe(quem.id)) return;
  somDeLive(1);
  toast(`📞 ${quem.name} está chamando você para a ${sala.nome}. Entre pelo canal no menu.`);
}

function onChatEvento(m: Record<string, unknown>) {
  if (m.t === "chamar") return onChamado(m);
  if (m.t !== "digitando" || typeof m.canal !== "string" || !estaNaSala(m.from) || !limiteChat(String(m.from))) return;
  if (m.canal !== "geral" && !getApp().salas.some((s) => s.id === m.canal)) return;
  /* quem é vem da presença daquela aba, não do que veio escrito */
  const fid = getApp().online.find((p) => p.key === m.from)?.fid;
  const uid = getApp().friends.find((f) => f.id === fid)?.user_id;
  if (!uid || uid === getApp().myUid) return;
  const st = useChat.getState();
  useChat.setState({ digitando: { ...st.digitando, [m.canal]: { ...(st.digitando[m.canal] ?? {}), [uid]: Date.now() } } });
}

let ligado = false;
/** Carrega as últimas mensagens (do geral e da minha sala) e passa a ouvir as novas. */
export async function carregarChat(): Promise<void> {
  if (!ligado) {
    ligado = true;
    aoMudarTabela("chat_messages", (row, ev) => (ev === "INSERT" || !ev ? addChat(row) : mudouChat(row, ev)));
    aoMudarTabela("chat_reacoes", (row) => mudouReacao(row));
    aoReceber("chat", onChatEvento);
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

/** Manda uma mensagem (até 300 letras) para o chat de onde eu estou, ou para `sala`. Lança o erro do banco se não der. */
/** Manda uma mensagem; `grito` (K-FOFO, seção 52) faz o balão sair grande; `extra`: responder e foto (seção 70). */
export async function enviarChat(texto: string, sala = chatAtual(), grito = false, extra: { respostaA?: number | null; arquivo?: File | null } = {}) {
  if (ehComandoPresente(texto)) return; /* sem aviso: o comando é escondido */
  let midia: string | null = null;
  if (extra.arquivo) {
    if (!chatNovo()) throw new Error("Foto no chat precisa do SQL novo (seção 70).");
    const uid = getApp().myUid;
    const { blob, ext } = await comprimir(extra.arquivo);
    midia = `${uid}/chat-${newId().toLowerCase()}.${ext}`;
    const up = await sb().storage.from("midias").upload(midia, blob, { contentType: ext === "gif" ? "image/gif" : "image/webp", upsert: false });
    if (up.error) throw up.error;
  }
  const linha: Record<string, unknown> = comSalas() ? { text: texto.slice(0, 300), sala, ...(grito ? { grito: true } : {}) } : { text: texto.slice(0, 300) };
  if (chatNovo()) Object.assign(linha, { resposta_a: extra.respostaA ?? null, midia });
  try {
    const rows = await comColunas(() => q<unknown[]>(sb().from("chat_messages").insert(chatNovo() ? linha : { text: linha.text, ...(comSalas() ? { sala } : {}) }).select(COLUNAS())));
    (rows || []).forEach(addChat);
  } catch (e) {
    if (midia) void sb().storage.from("midias").remove([midia]);
    throw e;
  }
}

/** Edita uma mensagem minha (fica "editado"). */
export async function editarChat(m: MsgChat, texto: string) {
  const rows = await q<unknown[]>(sb().from("chat_messages").update({ text: texto.slice(0, 300) }).eq("id", m.id).select(COLUNAS()));
  for (const r of rows || []) mudouChat(r, "UPDATE");
}
/** Apaga uma mensagem (a minha, ou qualquer uma se eu for moderador). */
export async function apagarChat(m: MsgChat) {
  await q(sb().from("chat_messages").delete().eq("id", m.id));
  if (m.midia) void sb().storage.from("midias").remove([m.midia]);
  mudouChat({ id: m.id }, "DELETE");
}
/** Fixa (ou desafixa) uma mensagem no canal. */
export async function fixarChat(m: MsgChat, sim: boolean) {
  const rows = await q<unknown[]>(sb().from("chat_messages").update({ fixada_em: sim ? new Date().toISOString() : null }).eq("id", m.id).select(COLUNAS()));
  for (const r of rows || []) mudouChat(r, "UPDATE");
}
