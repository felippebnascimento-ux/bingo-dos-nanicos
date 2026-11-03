"use client";
/*
 * Os cantos do Sítio: "Na sala agora" (em cima, à esquerda), os ganhos de moedas (em cima, à direita),
 * a carteira (embaixo, à esquerda) e a dica (embaixo, à direita). No celular, a lista vira uma fileira
 * de rostos acima do hall e o resto vai para baixo dele.
 */
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { assistirLive, usePessoasNaSala } from "@/components/shell/People";
import { pedirBolsa, podePedirBolsa, useCarteira } from "@/lib/carteira";
import { abrirCarteira, useMinhaPosicao } from "@/features/moedas/Ranking";
import { ChamaNome } from "@/features/ficha/NoSitio";
import { formatarMoedas, motivoGanho } from "@/lib/moedas";
import { friendDaPresenca, friendOf, MY_KEY, setApp, useApp } from "@/lib/store";
import { hueOf, initials, local } from "@/lib/util";
import { useGanhos } from "./ganhos";
import { irParaQuarto } from "@/features/quarto/visita";

/** "Na sala agora": tocar num nome abre a ficha; quem está ao vivo tem "Assistir". Dá para recolher. */
export function NaSala() {
  const friends = useApp((s) => s.friends);
  const meuQuarto = useApp((s) => s.meuQuarto);
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
            /* num quarto próprio (fase 35): "no quarto do Fulano", e tocar leva até lá */
            const quarto = eu ? meuQuarto : (p.quarto ?? null);
            const dono = quarto ? friends.find((x) => x.id === quarto) : undefined;
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
                    <ChamaNome fid={f?.id} />
                  </span>
                </button>
                {quarto && !eu && (quarto === "rua" || quarto === "corredor" || quarto === "banheiro") && (
                  <button type="button" className="linkish hall-sala-quarto" aria-label={quarto === "rua" ? "Ir para a rua" : quarto === "banheiro" ? "Ir para o banheiro" : "Ir para o corredor dos quartos"} onClick={() => irParaQuarto(quarto)}>
                    {quarto === "rua" ? "na rua" : quarto === "banheiro" ? "no banheiro" : "no corredor"}
                  </button>
                )}
                {dono && quarto && !eu && (
                  <button type="button" className="linkish hall-sala-quarto" aria-label={`Ir para o quarto do ${dono.name}`} onClick={() => irParaQuarto(quarto)}>
                    no quarto do {dono.name}
                  </button>
                )}
                {p.live && (
                  <button type="button" className="hall-assistir" aria-label={eu ? "Ver a sua transmissão" : `Assistir a tela de ${nome}`} onClick={() => assistirLive(p.key, p.sala)}>
                    <span className="live-pill vira">
                      <span className="a">AO VIVO</span>
                      <span className="b">▶ ASSISTIR</span>
                    </span>
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
              {a.texto ? (
                <b>{a.texto}</b>
              ) : a.pessoas && a.pessoas > 1 ? (
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

/** Carteira pequena com o meu saldo e a posição; tocar abre o ranking. Some se as moedas estiverem desligadas. */
export function CarteiraCanto() {
  const c = useCarteira((s) => s.carteira);
  const posicao = useMinhaPosicao();
  if (!c) return null;
  return (
    <button
      type="button"
      className="hall-canto hall-carteira"
      aria-label={`${formatarMoedas(c.saldo)} moedas${posicao ? `, ${posicao}` : ""}. Abrir o ranking`}
      onClick={abrirCarteira}
    >
      <span className="hall-moeda" aria-hidden="true">$</span>
      <span>
        <b>{formatarMoedas(c.saldo)}</b>
        <small>suas moedas{posicao && ` · ${posicao}`}</small>
      </span>
    </button>
  );
}

/** "Pedir a Bolsa Nanica": só aparece com menos de 100 moedas e se ainda não pegou hoje (quem decide é o banco). */
export function BotaoBolsa() {
  const pode = useCarteira((s) => podePedirBolsa(s));
  const pedindo = useCarteira((s) => s.pedindoBolsa);
  if (!pode) return null;
  return (
    <button type="button" className="btn sm hall-bolsa" disabled={pedindo} onClick={() => void pedirBolsa()}>
      {pedindo ? "Pedindo…" : "Pedir a Bolsa Nanica (+5.000)"}
    </button>
  );
}

export function Dica() {
  return <p className="hall-canto hall-dica">Clique no chão para andar · clique num amigo para ver a ficha ou zoar</p>;
}
