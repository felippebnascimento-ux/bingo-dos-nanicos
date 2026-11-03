/*
 * Pênalti x1: a lista de duelos (duelo_lista, a cada poucos segundos no saguão) e o duelo aberto na tela
 * (duelo_estado, 2 vezes por segundo com a disputa em jogo), com a diferença do relógio do banco para o anel do tempo.
 * Perguntar também faz o duelo andar no banco (cancelar o aberto vencido, sortear para quem não escolheu, pagar).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { aoMudarTabela } from "@/lib/sala";
import { getApp, setApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import {
  juntarMsgs,
  lerDuelo,
  lerListaDuelo,
  lerMsgDuelo,
  lerRankingDuelo,
  MSG_MAX,
  type Duelo,
  type DueloLista,
  type LinhaRanking,
  type MsgDuelo,
  type Zona,
} from "./dueloRegras";
import { msgDe, useJogoCassino } from "./estado";

/** O ranking do Pênalti x1 (duelo_ranking, seção 50), lido a cada 10 s enquanto o saguão está na tela. null = sem o SQL. */
export function useRankingDuelo(ativo: boolean) {
  const [linhas, setLinhas] = useState<LinhaRanking[] | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    const laco = async () => {
      if (!document.hidden) {
        try {
          const { data, error } = await sb().rpc("duelo_ranking");
          if (vivo && !error) setLinhas(lerRankingDuelo(data));
        } catch {
          /* sem rede: tenta na próxima */
        }
      }
      if (vivo) t = setTimeout(laco, 10_000);
    };
    void laco();
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [ativo]);
  return linhas;
}

/* ---------- chat do duelo (duelo_mensagens, seção 50): as últimas 50 do duelo aberto na tela, pelo tempo real ---------- */
export const useChatDuelo = create<{ id: number | null; msgs: MsgDuelo[]; ok: boolean | null }>()(() => ({ id: null, msgs: [], ok: null }));

let chatLigado = false;
/** Abre o chat de um duelo: lê as últimas mensagens e passa a acompanhar as novas dele. */
export async function abrirChatDuelo(id: number) {
  if (!chatLigado) {
    chatLigado = true;
    aoMudarTabela("duelo_mensagens", (row, ev) => {
      if (ev !== "INSERT") return;
      const m = lerMsgDuelo(row);
      const s = useChatDuelo.getState();
      if (m && m.dueloId === s.id) useChatDuelo.setState({ msgs: juntarMsgs(s.msgs, [m]) });
    });
  }
  if (useChatDuelo.getState().id === id) return;
  useChatDuelo.setState({ id, msgs: [] });
  const { data, error } = await sb()
    .from("duelo_mensagens")
    .select("id,duelo_id,user_id,texto,em")
    .eq("duelo_id", id)
    .order("id", { ascending: false })
    .limit(50);
  if (useChatDuelo.getState().id !== id) return;
  if (error) return useChatDuelo.setState({ ok: false });
  const lidas = (data ?? []).map(lerMsgDuelo).filter((m): m is MsgDuelo => !!m);
  useChatDuelo.setState((s) => ({ ok: true, msgs: juntarMsgs(s.msgs, lidas) }));
}

/** Manda uma mensagem no chat do duelo (o banco põe o autor, confere se é um dos dois e limita 20 por minuto). */
export async function mandarMsgDuelo(id: number, texto: string): Promise<boolean> {
  const t = texto.trim().slice(0, MSG_MAX);
  if (!t) return false;
  const { data, error } = await sb().from("duelo_mensagens").insert({ duelo_id: id, texto: t }).select("id,duelo_id,user_id,texto,em").maybeSingle();
  if (error) {
    toast(msgDe(error, "Não deu para mandar a mensagem."));
    return false;
  }
  const m = lerMsgDuelo(data);
  const s = useChatDuelo.getState();
  if (m && m.dueloId === s.id) useChatDuelo.setState({ msgs: juntarMsgs(s.msgs, [m]) });
  return true;
}

/** Abre a aba Cassino já no Pênalti x1 (a marca do pênalti do K-FOFO usa). */
export function abrirDuelo() {
  useJogoCassino.setState({ jogo: "duelo" });
  setApp({ aba: "cassino" });
}

/* em jogo: 2 por segundo; esperando adversário: devagar; saguão: a cada 3 s; aba escondida: quase parado */
function intervalo(id: number | null, d: Duelo | null, ativo: boolean) {
  if (!ativo || document.hidden) return 5000;
  if (!id) return 3000;
  if (d?.estado === "jogando") return 500;
  if (d?.estado === "aberto") return 1500;
  return 4000;
}

export function useDuelo(ativo = true) {
  const [id, setId] = useState<number | null>(null);
  const [duelo, setDuelo] = useState<Duelo | null>(null);
  const [lista, setLista] = useState<DueloLista[]>([]);
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const dif = useRef(0);
  /* quem saiu de um duelo dele não é puxado de volta pela lista */
  const largou = useRef<number | null>(null);

  const irPara = useCallback((novo: number | null) => {
    if (!novo && id) largou.current = id;
    setDuelo(null);
    setId(novo);
  }, [id]);

  const usar = useCallback((data: unknown, antes: number) => {
    const d = lerDuelo(data);
    if (!d) return null;
    dif.current = d.agora - (antes + (Date.now() - antes) / 2);
    setLigado(true);
    setDuelo(d);
    return d;
  }, []);

  const ler = useCallback(async () => {
    const antes = Date.now();
    if (!id) {
      const { data, error } = await sb().rpc("duelo_lista");
      if (error) {
        if (/duelo_lista|function|does not exist/i.test(error.message)) setLigado(false);
        return null;
      }
      setLigado(true);
      const l = lerListaDuelo(data);
      setLista(l);
      /* recarregou a página no meio de um duelo meu: volta para ele */
      const eu = getApp().myUid;
      const meu = l.find((x) => x.id !== largou.current && (x.criador === eu || x.desafiante === eu));
      if (meu) setId(meu.id);
      return null;
    }
    const { data, error } = await sb().rpc("duelo_estado", { p_id: id });
    if (error) {
      if (/não existe/i.test(error.message)) setId(null);
      else if (/duelo_estado|function|does not exist/i.test(error.message)) setLigado(false);
      return null;
    }
    return usar(data, antes);
  }, [id, usar]);

  useEffect(() => {
    let vivo = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    const laco = async () => {
      const d = await ler().catch(() => null);
      if (!vivo) return;
      t = setTimeout(laco, intervalo(id, d, ativo));
    };
    void laco();
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [ler, ativo, id]);

  /** Chama uma função do duelo; as que devolvem o estado já atualizam a tela. */
  const chamar = useCallback(
    async (fn: string, args: Record<string, unknown>, erro: string) => {
      if (enviando) return null;
      setEnviando(true);
      const antes = Date.now();
      try {
        const { data, error } = await sb().rpc(fn, args);
        if (error) throw error;
        if (fn !== "duelo_abrir") usar(data, antes);
        return data as unknown;
      } catch (e) {
        toast(msgDe(e, erro));
        return null;
      } finally {
        setEnviando(false);
      }
    },
    [enviando, usar],
  );

  const abrir = async (aposta: number) => {
    const r = (await chamar("duelo_abrir", { p_aposta: aposta }, "Não deu para abrir o duelo.")) as { id?: unknown } | null;
    if (r && typeof r.id === "number") {
      largou.current = null;
      setId(r.id);
    }
  };
  const entrar = async (alvo: number) => {
    const r = await chamar("duelo_entrar", { p_id: alvo }, "Não deu para entrar no duelo.");
    if (r) {
      largou.current = null;
      setId(alvo);
    }
  };
  const cancelar = () => (id ? chamar("duelo_cancelar", { p_id: id }, "Não deu para cancelar.") : null);
  const escolher = (zona: Zona) => (id ? chamar("duelo_escolher", { p_id: id, p_zona: zona }, "Não deu para escolher.") : null);
  /** a hora do banco agora (para o anel do tempo) */
  const agoraBanco = useCallback(() => Date.now() + dif.current, []);

  return { id, duelo, lista, ligado, enviando, irPara, abrir, entrar, cancelar, escolher, agoraBanco };
}
