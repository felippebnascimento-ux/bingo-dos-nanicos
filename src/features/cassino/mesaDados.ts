/*
 * Mesas ao vivo: pergunta ao banco como está a mesa (mesa_estado) algumas vezes por segundo enquanto ela está na tela,
 * guarda a diferença do relógio do banco para o do aparelho e deixa a tela chamar as apostas.
 * Perguntar também faz a mesa andar no banco (sortear e pagar), então não precisa de servidor.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import { carregar } from "./estado";
import { diferencaRelogio, lerEstado, type EstadoMesa, type JogoMesa } from "./mesa";

/** Mais rápido quando o tempo importa (avião no ar, contagem acabando); devagar com a mesa parada ou a aba escondida. */
function intervalo(e: EstadoMesa | null, ativo: boolean) {
  if (!ativo || document.hidden) return 4000;
  if (!e || e.fase === "parada") return 1500;
  if (e.jogo === "aviao" && e.fase === "jogo") return 250;
  return 700;
}

export function useMesa(jogo: JogoMesa, ativo = true) {
  const [estado, setEstado] = useState<EstadoMesa | null>(null);
  const [ligada, setLigada] = useState<boolean | null>(null);
  const dif = useRef(0);
  const ultimoId = useRef<number | null>(null);
  const liquidou = useRef<number | null>(null);

  const ler = useCallback(async () => {
    const antes = Date.now();
    const { data, error } = await sb().rpc("mesa_estado", { p_jogo: jogo });
    if (error) {
      /* sem o SQL da seção 32, a mesa ao vivo não existe */
      if (/mesa_estado|function|não existe|does not exist/i.test(error.message)) setLigada(false);
      return null;
    }
    const e = lerEstado(data);
    if (!e) return null;
    /* metade da viagem de ida e volta: o relógio do banco no meio do caminho */
    dif.current = diferencaRelogio(e.agora, antes + (Date.now() - antes) / 2);
    setLigada(true);
    setEstado(e);
    /* rodada paga: atualiza "Minhas apostas" e o feed uma vez */
    if (e.rodada && e.fase === "resultado" && liquidou.current !== e.rodada.id && e.rodada.segredo) {
      liquidou.current = e.rodada.id;
      void carregar();
    }
    ultimoId.current = e.rodada?.id ?? null;
    return e;
  }, [jogo]);

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

  /** Relógio do banco agora (ms). */
  const agora = useCallback(() => Date.now() + dif.current, []);
  return { estado, ligada, agora, recarregar: ler };
}

/** Chama uma função da mesa e devolve o erro em texto (ou null). */
export async function chamarMesa(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw error;
  return data as Record<string, unknown>;
}
