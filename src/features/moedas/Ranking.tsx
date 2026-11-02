"use client";
/*
 * Painel da carteira: "Ranking" (os 14 do mais rico ao mais pobre, ao vivo pelo tempo real das carteiras)
 * e "Meu extrato" (o MoedasBloco). Abre pela carteira do Sítio e pelo chip de moedas do Início.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent as KE } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcCoroa, IcFechar } from "@/components/ui/icones";
import { carregarExtrato, carregarRanking, useCarteira } from "@/lib/carteira";
import { formatarMoedas, ordinal, posicaoDe, ranking } from "@/lib/moedas";
import { friendOf, setApp, useApp } from "@/lib/store";
import { MoedasBloco } from "./Moedas";

/** O ranking calculado (carrega as carteiras na primeira tela que precisar). */
export function useRanking() {
  const todas = useCarteira((s) => s.todas);
  const friends = useApp((s) => s.friends);
  const ligado = useCarteira((s) => !!s.carteira);
  useEffect(() => {
    if (ligado) carregarRanking();
  }, [ligado]);
  return useMemo(() => (todas ? ranking(todas, friends) : null), [todas, friends]);
}

/** "3º lugar" do nanico logado (vazio enquanto o ranking não carregou). */
export function useMinhaPosicao() {
  const lista = useRanking();
  const myUid = useApp((s) => s.myUid);
  const pos = lista ? posicaoDe(lista, myUid) : null;
  return pos ? `${ordinal(pos)} lugar` : "";
}

export const abrirCarteira = () => useCarteira.setState({ painel: "ranking" });

export function PainelCarteira() {
  const painel = useCarteira((s) => s.painel);
  return painel ? <PainelAberto aba={painel} /> : null;
}

function PainelAberto({ aba }: { aba: "ranking" | "extrato" }) {
  const c = useCarteira((s) => s.carteira);
  const subiram = useCarteira((s) => s.subiram);
  const lista = useRanking();
  const myUid = useApp((s) => s.myUid);
  const friends = useApp((s) => s.friends);
  const posicao = useMinhaPosicao();
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => useCarteira.setState({ painel: null });
  useEffect(() => {
    fecharRef.current?.focus();
  }, []);
  const tecla = (e: KE<HTMLDivElement>) => e.key === "Escape" && fechar();
  const trocar = (a: "ranking" | "extrato") => {
    useCarteira.setState({ painel: a });
    if (a === "extrato") carregarExtrato();
  };

  return (
    <div className="gate carteira-gate" role="dialog" aria-modal="true" aria-labelledby="carteiraTitulo" onKeyDown={tecla} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="carteira-painel">
        <div className="carteira-topo">
          <span className="hall-moeda" aria-hidden="true">$</span>
          <span>
            <b id="carteiraTitulo">{c ? formatarMoedas(c.saldo) : "Moedas"}</b>
            <small>suas moedas{posicao && ` · ${posicao}`}</small>
          </span>
          <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar a carteira" onClick={fechar}>
            <IcFechar />
          </button>
        </div>
        <div className="seg" role="radiogroup" aria-label="O que ver">
          {(["ranking", "extrato"] as const).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={aba === a} className={aba === a ? "on" : undefined} onClick={() => trocar(a)}>
              {a === "ranking" ? "Ranking" : "Meu extrato"}
            </button>
          ))}
        </div>
        {aba === "extrato" ? (
          <MoedasBloco />
        ) : !lista ? (
          <p className="hint">Carregando o ranking…</p>
        ) : (
          <ol className="ranking">
            {lista.map((l) => {
              const f = friendOf(l.fid, friends);
              const eu = !!myUid && l.userId === myUid;
              const subiu = !!l.userId && !!subiram[l.userId];
              return (
                <li key={l.fid} className={eu ? "eu" : undefined}>
                  <button type="button" onClick={() => setApp({ fichaAberta: l.fid })} aria-label={`${l.pos ? ordinal(l.pos) + " lugar, " : ""}${l.nome}${l.saldo !== null ? `, ${formatarMoedas(l.saldo)} moedas` : ", sem carteira"}. Abrir a ficha`}>
                    <span className="ranking-pos">{l.pos ? ordinal(l.pos) : "—"}</span>
                    <span className="ranking-rosto">
                      {l.pos === 1 && <IcCoroa className="ranking-coroa" tam={18} />}
                      {f ? <Avatar f={f} size="xs" /> : <span className="av xs">{l.nome[0]}</span>}
                    </span>
                    <span className="ranking-nome">
                      {l.nome}
                      {subiu && <em className="ranking-subiu">▲ subiu</em>}
                    </span>
                    <b>{l.saldo !== null ? formatarMoedas(l.saldo) : "—"}</b>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
