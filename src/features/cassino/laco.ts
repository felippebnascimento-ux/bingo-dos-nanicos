/*
 * O laço das mesas ao vivo (roleta, aviãozinho, blackjack, pôquer, pênalti x1): pergunta ao banco de tempos em tempos
 * enquanto o jogo está na tela. Com a aba do Cassino fechada (ativo = false) ou o navegador em outra aba, para de
 * perguntar; ao voltar, pergunta na hora e segue. Antes, cada aparelho continuava perguntando escondido, e como cada
 * pergunta faz a mesa andar no banco, as apostas de quem estava jogando esperavam na fila (03/11/2026).
 */
import { useEffect, useRef } from "react";

/**
 * `ler` faz a pergunta e devolve o que leu (ou null); `espera(lido)` diz quantos ms até a próxima.
 * `ler` deve ser estável (useCallback): quando muda (outra mesa, outro duelo), o laço recomeça na hora.
 */
export function useLaco<T>(ler: () => Promise<T | null>, espera: (lido: T | null) => number, ativo: boolean) {
  /* a espera pode depender de estado da tela: sempre a mais nova, sem recomeçar o laço */
  const esperaAgora = useRef(espera);
  useEffect(() => {
    esperaAgora.current = espera;
  }, [espera]);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    /* cada volta tem um número: se o laço recomeçar no meio de uma pergunta, a volta antiga não marca outra */
    let volta = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const laco = async (minha: number) => {
      const lido = await ler().catch(() => null);
      if (!vivo || minha !== volta || document.hidden) return;
      t = setTimeout(() => void laco(minha), esperaAgora.current(lido));
    };
    const recomecar = () => {
      clearTimeout(t);
      volta++;
      if (!document.hidden) void laco(volta);
    };
    document.addEventListener("visibilitychange", recomecar);
    recomecar();
    return () => {
      vivo = false;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", recomecar);
    };
  }, [ler, ativo]);
}
