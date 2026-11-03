/*
 * Blackjack ao vivo: pergunta ao banco como está a mesa (bj_estado) enquanto ela está na tela, guarda a diferença do
 * relógio do banco para o do aparelho (para as contagens) e manda as apostas e as jogadas. Perguntar também faz a
 * mesa andar no banco (dar as cartas, passar a vez de quem demorou, o dealer jogar e pagar).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { lerEstado, type EstadoBj } from "./bjRegras";
import { carregar, msgDe } from "./estado";

/* mais rápido com a rodada em andamento; devagar com a mesa parada ou a aba escondida */
function intervalo(e: EstadoBj | null, ativo: boolean) {
  if (!ativo || document.hidden) return 4000;
  if (!e?.rodada || e.rodada.fase === "fim") return 1500;
  return 600;
}

export function useBlackjack(ativo = true) {
  const [estado, setEstado] = useState<EstadoBj | null>(null);
  const [ligada, setLigada] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const dif = useRef(0);
  const pagou = useRef<number | null>(null);

  const usar = useCallback((data: unknown, antes: number) => {
    const e = lerEstado(data);
    if (!e) return null;
    /* metade da viagem de ida e volta: o relógio do banco no meio do caminho */
    dif.current = e.agora - (antes + (Date.now() - antes) / 2);
    setLigada(true);
    setEstado(e);
    /* rodada paga: atualiza a carteira e "Minhas apostas" uma vez */
    if (e.rodada?.fase === "fim" && pagou.current !== e.rodada.id) {
      pagou.current = e.rodada.id;
      void carregar();
    }
    return e;
  }, []);

  const ler = useCallback(async () => {
    const antes = Date.now();
    const { data, error } = await sb().rpc("bj_estado");
    if (error) {
      /* sem o SQL da seção 43, a mesa não existe */
      if (/bj_estado|function|não existe|does not exist/i.test(error.message)) setLigada(false);
      return null;
    }
    return usar(data, antes);
  }, [usar]);

  useEffect(() => {
    let vivo = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    const laco = async () => {
      const e = await ler().catch(() => null);
      if (!vivo) return;
      t = setTimeout(laco, intervalo(e, ativo));
    };
    void laco();
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [ler, ativo]);

  /** Chama uma função do blackjack e já mostra o estado que ela devolve. */
  const chamar = useCallback(
    async (fn: "bj_apostar" | "bj_acao", args: Record<string, unknown>, erro: string) => {
      if (enviando) return false;
      setEnviando(true);
      const antes = Date.now();
      try {
        const { data, error } = await sb().rpc(fn, args);
        if (error) throw error;
        usar(data, antes);
        if (fn === "bj_apostar") void carregar();
        return true;
      } catch (e) {
        toast(msgDe(e, erro));
        return false;
      } finally {
        setEnviando(false);
      }
    },
    [enviando, usar],
  );

  const apostar = (valor: number) => chamar("bj_apostar", { p_aposta: valor }, "Não deu para apostar.");
  const jogar = (acao: "pedir" | "parar" | "dobrar" | "dividir") => chamar("bj_acao", { p_acao: acao }, "Não deu para jogar.");
  /** a hora do banco agora (para as contagens) */
  const agoraBanco = () => Date.now() + dif.current;

  return { estado, ligada, enviando, apostar, jogar, agoraBanco };
}
