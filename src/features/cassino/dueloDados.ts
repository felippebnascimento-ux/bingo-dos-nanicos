/*
 * Pênalti x1: a lista de duelos (duelo_lista, a cada poucos segundos no saguão) e o duelo aberto na tela
 * (duelo_estado, 2 vezes por segundo com a disputa em jogo), com a diferença do relógio do banco para o anel do tempo.
 * Perguntar também faz o duelo andar no banco (cancelar o aberto vencido, sortear para quem não escolheu, pagar).
 */
import { useCallback, useRef, useState } from "react";
import { useLaco } from "./laco";
import { getApp, setApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { lerDuelo, lerListaDuelo, type Duelo, type DueloLista, type Zona } from "./dueloRegras";
import { msgDe, useJogoCassino } from "./estado";

/** Abre a aba Cassino já no Pênalti x1 (a marca do pênalti do K-FOFO usa). */
export function abrirDuelo() {
  useJogoCassino.setState({ jogo: "duelo" });
  setApp({ aba: "cassino" });
}

/* em jogo: 2 por segundo; esperando adversário: devagar; saguão: a cada 3 s (fora da tela, para: laco.ts) */
function intervalo(id: number | null, d: Duelo | null) {
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

  useLaco(ler, (d) => intervalo(id, d), ativo);

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
