/*
 * Pôquer: o salão (pk_mesas_lista) e a mesa aberta (pk_estado), perguntados ao banco enquanto estão na tela, com a
 * diferença do relógio do banco para as contagens; e as jogadas. Perguntar também faz a mesa andar no banco (começar
 * a mão, jogar por quem estourou o tempo, levantar quem saiu).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { local } from "@/lib/util";
import { lerEstadoPk, lerListaPk, type EstadoPk, type MesaListaPk } from "./pkRegras";
import { carregar, msgDe } from "./estado";

/* mais rápido com a mão em andamento; devagar no salão ou com a aba escondida */
function intervalo(mesa: number | null, e: EstadoPk | null, ativo: boolean) {
  if (!ativo || document.hidden) return 4000;
  if (!mesa) return 3000;
  if (!e?.mao || e.mao.fase === "fim") return 1200;
  return 700;
}

export type AcaoPk = "desistir" | "passar" | "pagar" | "aumentar" | "allin";

export function usePoquer(ativo = true) {
  const [mesa, setMesaId] = useState<number | null>(() => Number(local.get("pk-mesa")) || null);
  const [estado, setEstado] = useState<EstadoPk | null>(null);
  const [lista, setLista] = useState<MesaListaPk[]>([]);
  const [ligada, setLigada] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const dif = useRef(0);
  const pagou = useRef<number | null>(null);

  const irPara = useCallback((id: number | null) => {
    local.set("pk-mesa", id ? String(id) : "");
    setEstado(null);
    setMesaId(id);
  }, []);

  const usar = useCallback(
    (data: unknown, antes: number) => {
      const e = lerEstadoPk(data);
      if (!e) return null;
      dif.current = e.agora - (antes + (Date.now() - antes) / 2);
      setLigada(true);
      if (e.mesa.fechada) {
        toast("Essa mesa fechou.");
        irPara(null);
        return null;
      }
      setEstado(e);
      /* mão paga: as fichas mudaram (e quem levantou recebeu as dele) */
      if (e.mao?.fase === "fim" && pagou.current !== e.mao.id) {
        pagou.current = e.mao.id;
        void carregar();
      }
      return e;
    },
    [irPara],
  );

  const ler = useCallback(async () => {
    const antes = Date.now();
    if (!mesa) {
      const { data, error } = await sb().rpc("pk_mesas_lista");
      if (error) {
        if (/pk_mesas_lista|function|does not exist/i.test(error.message)) setLigada(false);
        return null;
      }
      setLigada(true);
      setLista(lerListaPk(data));
      return null;
    }
    const { data, error } = await sb().rpc("pk_estado", { p_mesa: mesa });
    if (error) {
      if (/não existe/i.test(error.message)) irPara(null);
      else if (/pk_estado|function|does not exist/i.test(error.message)) setLigada(false);
      return null;
    }
    return usar(data, antes);
  }, [mesa, usar, irPara]);

  useEffect(() => {
    let vivo = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    const laco = async () => {
      const e = await ler().catch(() => null);
      if (!vivo) return;
      t = setTimeout(laco, intervalo(mesa, e, ativo));
    };
    void laco();
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [ler, ativo, mesa]);

  /** Chama uma função do pôquer; as que devolvem o estado já atualizam a mesa. */
  const chamar = useCallback(
    async (fn: string, args: Record<string, unknown>, erro: string) => {
      if (enviando) return null;
      setEnviando(true);
      const antes = Date.now();
      try {
        const { data, error } = await sb().rpc(fn, args);
        if (error) throw error;
        if (fn !== "pk_abrir") usar(data, antes);
        if (fn !== "pk_acao") void carregar();
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

  const abrir = async (blind: number) => {
    const id = await chamar("pk_abrir", { p_blind: blind }, "Não deu para abrir a mesa.");
    if (typeof id === "number") irPara(id);
  };
  const sentar = (lugar: number, fichas: number) => chamar("pk_sentar", { p_mesa: mesa, p_lugar: lugar, p_fichas: fichas }, "Não deu para sentar.");
  const levantar = () => chamar("pk_levantar", { p_mesa: mesa }, "Não deu para levantar.");
  const jogar = (acao: AcaoPk, valor?: number) => chamar("pk_acao", { p_mesa: mesa, p_acao: acao, p_valor: valor ?? null }, "Não deu para jogar.");
  /** a hora do banco agora (para as contagens) */
  const agoraBanco = useCallback(() => Date.now() + dif.current, []);

  return { mesa, estado, lista, ligada, enviando, irPara, abrir, sentar, levantar, jogar, agoraBanco };
}
