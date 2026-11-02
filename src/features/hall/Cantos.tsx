"use client";
/*
 * Os cantos do Sítio: "Na sala agora" (em cima, à esquerda), os ganhos de moedas (em cima, à direita),
 * a carteira (embaixo, à esquerda) e a dica (embaixo, à direita). No celular, a lista vira uma fileira
 * de rostos acima do hall e o resto vai para baixo dele.
 */
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { goWatch, usePessoasNaSala } from "@/components/shell/People";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas, motivoGanho } from "@/lib/moedas";
import { friendDaPresenca, friendOf, MY_KEY, setApp, useApp } from "@/lib/store";
import { hueOf, initials, local } from "@/lib/util";
import { useGanhos } from "./ganhos";

/** "Na sala agora": tocar num nome abre a ficha; quem está ao vivo tem "Assistir". Dá para recolher. */
export function NaSala() {
  const friends = useApp((s) => s.friends);
  const lista = usePessoasNaSala(true);
  const [min, setMin] = useState(() => local.get("hall-sala-min") === "1");
  const alternar = () => {
    setMin(!min);
    local.set("hall-sala-min", min ? "0" : "1");
  };
  return (
    <section className={"hall-canto hall-sala" + (min ? " min" : "")} aria-labelledby="hallSalaTitulo">
      <h3 id="hallSalaTitulo">
        <button type="button" className="hall-sala-alterna" aria-expanded={!min} onClick={alternar}>
          <span className="dot" aria-hidden="true" />
          Na sala agora ({lista.length})
        </button>
      </h3>
      {!min && (
        <ul>
          {lista.map((p) => {
            const f = friendDaPresenca(p, friends);
            const nome = f ? f.name : p.name;
            const eu = p.key === MY_KEY;
            return (
              <li key={p.key} className={eu ? "eu" : undefined}>
                <button
                  type="button"
                  className="hall-sala-nome"
                  disabled={!f}
                  aria-label={f ? `Abrir a ficha de ${nome}` : nome}
                  onClick={() => f && setApp({ fichaAberta: f.id })}
                >
                  {f ? (
                    <Avatar f={f} size="xs" />
                  ) : (
                    <span className="u" style={{ ["--h" as string]: hueOf(p.name) }} aria-hidden="true">
                      {initials(p.name)}
                    </span>
                  )}
                  <span className="nm">
                    {nome}
                    {eu && " (você)"}
                  </span>
                </button>
                {p.live && (
                  <button type="button" className="hall-assistir" aria-label={eu ? "Ver a sua transmissão" : `Assistir a tela de ${nome}`} onClick={() => goWatch(p.key)}>
                    <span className="live-pill">AO VIVO</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Os últimos ganhos de moedas de todo mundo (no máximo 3; cada um some em 5 s). */
export function Ganhos() {
  const avisos = useGanhos((s) => s.avisos);
  const friends = useApp((s) => s.friends);
  return (
    <div className="hall-canto hall-ganhos" aria-live="polite">
      {avisos.map((a, k) => {
        const f = friendOf(a.fid, friends);
        const motivo = a.pessoas && a.pessoas > 1 ? "" : motivoGanho(a.motivo);
        return (
          <div key={a.id} className={"hall-ganho" + (avisos.length === 3 && k === 2 ? " velho" : "")}>
            {f ? <Avatar f={f} size="xs" /> : <span className="hall-moeda" aria-hidden="true">$</span>}
            <div>
              {a.pessoas && a.pessoas > 1 ? (
                <>
                  <b>+{formatarMoedas(a.valor)}</b> {a.valor === 1 ? "moeda" : "moedas"} de tempo online para {a.nome}
                </>
              ) : (
                <>
                  <b>
                    {a.nome} +{formatarMoedas(a.valor)}
                  </b>{" "}
                  {a.valor === 1 ? "moeda" : "moedas"}
                  {motivo && <small>{motivo}</small>}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Carteira pequena com o meu saldo; tocar abre o extrato no Perfil. Some se as moedas estiverem desligadas. */
export function CarteiraCanto() {
  const c = useCarteira((s) => s.carteira);
  if (!c) return null;
  return (
    <button
      type="button"
      className="hall-canto hall-carteira"
      aria-label={`${formatarMoedas(c.saldo)} moedas. Abrir o extrato no Perfil`}
      onClick={() => setApp({ aba: "perfil" })}
    >
      <span className="hall-moeda" aria-hidden="true">$</span>
      <span>
        <b>{formatarMoedas(c.saldo)}</b>
        <small>suas moedas</small>
      </span>
    </button>
  );
}

export function Dica() {
  return <p className="hall-canto hall-dica">Clique no chão para andar · clique num rosto para ver a ficha</p>;
}
