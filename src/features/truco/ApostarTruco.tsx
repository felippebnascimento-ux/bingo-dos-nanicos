"use client";
/*
 * Painel "Apostar" embaixo da mesa de truco (para quem assiste e para quem joga): escolhe a dupla e o valor, mostra o
 * bolo de cada lado e o retorno estimado. Abre quando a partida começa e fecha quando a 2ª mão é dada. Quem está
 * jogando só aposta no próprio time (o banco confere). Reaproveita o visual do painel do LoL (.aposta).
 */
import { useEffect, useState } from "react";
import { useCarteira } from "@/lib/carteira";
import { useApp } from "@/lib/store";
import { APOSTA_MIN, retornoLados, type LadoN } from "@/features/jogar/apostas";
import { ValorAposta } from "@/features/cassino/ValorAposta";
import type { MesaPub } from "./engine";
import { apostarTruco, ligarApostasTruco, mercadoDaMesa, minhaApostaTruco, useApostasTruco } from "./apostasTruco";


export function ApostarTruco({ m, rotulo }: { m: MesaPub; rotulo: (t: number) => string }) {
  const mercados = useApostasTruco((s) => s.mercados);
  const minhas = useApostasTruco((s) => s.minhas);
  const enviando = useApostasTruco((s) => s.enviando);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? null);
  const myFid = useApp((s) => s.myFid);
  const [lado, setLado] = useState<LadoN | null>(null);
  const [valor, setValor] = useState(25);
  useEffect(() => {
    void ligarApostasTruco();
  }, []);

  const mk = mercadoDaMesa(mercados, m.id);
  /* só a partida em jogo (ou a que acabou de acabar, para mostrar o resultado da minha aposta) */
  if (!mk || (m.fase === "espera" && !minhaApostaTruco(minhas, mk))) return null;
  const minha = minhaApostaTruco(minhas, mk);
  const pode = mk.estado === "aberto";
  const meu = myFid && myFid in mk.times ? mk.times[myFid] : null;

  return (
    <div className="block aposta tr-aposta">
      <h3>Apostas na partida</h3>
      <p className="aposta-prazo">
        {minha ? (
          mk.estado === "pago" ? (
            mk.vencedor === minha.lado ? (
              <>
                Você ganhou <b>{minha.pago}</b> moedas na aposta.
              </>
            ) : (
              "Não foi dessa vez: a sua dupla perdeu."
            )
          ) : mk.estado === "devolvido" ? (
            <>
              Aposta devolvida: <b>{minha.valor}</b> moedas.
            </>
          ) : (
            <>
              Você apostou <b>{minha.valor}</b> em {rotulo(minha.lado)}. Se vencer, volta cerca de{" "}
              <b>{retornoLados(minha.valor, minha.lado, mk.bolos, true)}</b>.
            </>
          )
        ) : pode ? (
          "As apostas fecham quando a 2ª mão for dada. A casa leva 5%."
        ) : (
          "As apostas desta partida fecharam."
        )}
      </p>
      <div className="aposta-lados" role={minha || !pode ? undefined : "radiogroup"} aria-label="Dupla da aposta">
        {([0, 1] as const).map((l) => {
          const bloqueado = meu !== null && meu !== l;
          const escolhido = minha ? minha.lado === l : lado === l;
          return (
            <button
              key={l}
              type="button"
              role={minha || !pode ? undefined : "radio"}
              aria-checked={minha || !pode ? undefined : lado === l}
              className={"aposta-lado " + (l === 0 ? "l100" : "l200") + (escolhido ? " on" : "")}
              disabled={!!minha || !pode || bloqueado}
              onClick={() => setLado(l)}
            >
              <b>{rotulo(l)}</b>
              <span>
                bolo <b>{mk.bolos[l]}</b>
              </span>
              {bloqueado && <small>você joga do outro lado</small>}
            </button>
          );
        })}
      </div>
      {!minha && pode && (
        <>
          {/* de 5 até o saldo (seção 63) */}
          <ValorAposta valor={valor} onValor={setValor} saldo={saldo ?? undefined} />
          <div className="aposta-fim">
            <span className="hint">
              {lado !== null ? (
                <>
                  Se {rotulo(lado)} vencer, volta cerca de <b>{retornoLados(valor, lado, mk.bolos)}</b>.
                </>
              ) : (
                "Escolha uma dupla."
              )}
            </span>
            <button
              type="button"
              className="btn sm"
              disabled={lado === null || enviando || valor < APOSTA_MIN || (saldo !== null && saldo < valor)}
              onClick={() => lado !== null && void apostarTruco(mk, lado, valor)}
            >
              {valor < APOSTA_MIN ? "Monte a aposta" : saldo !== null && saldo < valor ? "Sem moedas" : `Apostar ${valor.toLocaleString("pt-BR")}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
