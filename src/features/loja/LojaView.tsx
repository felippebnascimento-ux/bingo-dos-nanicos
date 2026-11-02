"use client";
/*
 * Aba Loja (fora do menu; abre pela geladeira do Sítio e pelo chip do Início): a vitrine, agrupada, com
 * uma prévia desenhada de cada item, e a mochila (equipar, usar no Sítio). Comprar pede o segundo toque,
 * porque gasta moedas. Quem confere preço, saldo e repetição é o banco.
 */
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcVoltar } from "@/components/ui/icones";
import { useSure } from "@/components/ui/useSure";
import { QuartoPrevia, type EquipQuarto } from "@/features/ficha/Quarto";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { friendOf, setApp, useApp } from "@/lib/store";
import { DesenhoItem } from "./Itens";
import { acumula, doGrupo, equipavel, GRUPOS, NOME_ESPACO, podeComprar, type ItemLoja } from "./loja";
import { comprar, equipar, useLoja, useMinhaMochila, usar } from "./lojaDados";

const FOCO: Partial<Record<ItemLoja["espaco"], "parede" | "chao" | "mesa" | "poster" | "cadeira" | "planta">> = {
  parede: "parede",
  luz: "parede",
  poster: "poster",
  tapete: "chao",
  mesa: "mesa",
  cadeira: "cadeira",
  planta: "planta",
};

/** Prévia do item: o quarto com ele, o título, o rosto com a moldura ou o desenho do consumível. */
export function Previa({ it }: { it: ItemLoja }) {
  const eu = useApp((s) => friendOf(s.myFid, s.friends));
  const foco = FOCO[it.espaco];
  if (foco) return <QuartoPrevia equip={{ [it.espaco]: it.dados.cor } as EquipQuarto} foco={foco} />;
  if (it.espaco === "titulo") return <span className="loja-titulo-previa">{it.dados.texto}</span>;
  if (it.espaco === "moldura")
    return (
      <span className={"loja-moldura-previa mold-" + it.dados.cor}>
        <Avatar f={eu ?? { name: "?" }} size="lg" />
      </span>
    );
  return (
    <span className="loja-desenho">
      <DesenhoItem id={it.id} />
    </span>
  );
}

function CartaoItem({ it, tenho, equipado, saldo }: { it: ItemLoja; tenho: number; equipado: boolean; saldo: number | null }) {
  const { sure, pedir } = useSure();
  const ocupado = useLoja((s) => s.ocupado);
  const pode = podeComprar(it, tenho, saldo);
  return (
    <article className={"block loja-item" + (equipado ? " equipado" : "")}>
      <div className="loja-previa">
        <Previa it={it} />
        {tenho > 0 && acumula(it.espaco) && <span className="loja-qtd">×{tenho}</span>}
      </div>
      <h3>{it.nome}</h3>
      <p className="hint">{it.descricao}</p>
      <div className="loja-acoes">
        <span className="loja-preco">
          <span className="hall-moeda" aria-hidden="true">
            $
          </span>
          {formatarMoedas(it.preco)}
        </span>
        {tenho > 0 && equipavel(it.espaco) ? (
          <button type="button" className={"btn sm" + (equipado ? " soft" : "")} disabled={!!ocupado} onClick={() => void equipar(it, !equipado)}>
            {equipado ? "Tirar" : "Equipar"}
          </button>
        ) : pode.ok ? (
          <button
            type="button"
            className={"btn sm" + (sure ? " sure" : "")}
            disabled={!!ocupado}
            aria-label={sure ? `Confirmar a compra de ${it.nome} por ${it.preco} moedas` : `Comprar ${it.nome} por ${it.preco} moedas`}
            onClick={() => pedir() && void comprar(it)}
          >
            {sure ? "Confirmar" : "Comprar"}
          </button>
        ) : (
          <span className="status">{pode.motivo}</span>
        )}
      </div>
    </article>
  );
}

/** A minha mochila: equipar e tirar, usar os consumíveis no Sítio e quantos escudos tenho. */
export function MochilaLista() {
  const itens = useLoja((s) => s.itens);
  const ocupado = useLoja((s) => s.ocupado);
  const minhas = useMinhaMochila();
  if (!itens) return null;
  const linhas = minhas
    .map((l) => ({ l, it: itens.find((i) => i.id === l.itemId) }))
    .filter((x): x is { l: (typeof minhas)[number]; it: ItemLoja } => !!x.it)
    .sort((a, b) => a.it.ordem - b.it.ordem);
  if (!linhas.length) return <p className="hint">A mochila está vazia. Compre algo na loja.</p>;
  return (
    <ul className="mochila">
      {linhas.map(({ l, it }) => (
        <li key={it.id} className={l.equipado ? "equipado" : undefined}>
          <span className="mochila-previa">
            <Previa it={it} />
          </span>
          <span className="mochila-nome">
            <b>{it.nome}</b>
            <small>
              {NOME_ESPACO[it.espaco]}
              {acumula(it.espaco) && ` · ×${l.qtd}`}
              {l.equipado && " · equipado"}
            </small>
          </span>
          {it.espaco === "consumivel" ? (
            <button type="button" className="btn sm" disabled={!!ocupado} onClick={() => void usar(it)}>
              Usar no Sítio
            </button>
          ) : it.espaco === "escudo" ? (
            <span className="status">Gasto sozinho</span>
          ) : (
            <button type="button" className={"btn sm" + (l.equipado ? " soft" : "")} disabled={!!ocupado} onClick={() => void equipar(it, !l.equipado)}>
              {l.equipado ? "Tirar" : "Equipar"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function LojaView({ hidden }: { hidden: boolean }) {
  const itens = useLoja((s) => s.itens);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? null);
  const minhas = useMinhaMochila();
  const [aba, setAba] = useState<"vitrine" | "mochila">("vitrine");
  const qtd = (id: string) => minhas.find((l) => l.itemId === id)?.qtd ?? 0;
  const eq = (id: string) => !!minhas.find((l) => l.itemId === id)?.equipado;

  return (
    <section id="view-loja" className="inner" hidden={hidden}>
      <button type="button" className="linkish trofeus-voltar" onClick={() => setApp({ aba: "hall" })}>
        <IcVoltar tam={14} /> Voltar ao Sítio
      </button>
      <header className="hero loja-topo">
        <div>
          <h1>Loja</h1>
          <p>Itens para o seu quarto, títulos, molduras e coisas para usar no Sítio.</p>
        </div>
        {saldo !== null && (
          <span className="loja-saldo">
            <span className="hall-moeda" aria-hidden="true">
              $
            </span>
            <b>{formatarMoedas(saldo)}</b> moedas
          </span>
        )}
      </header>
      <div className="seg loja-abas" role="radiogroup" aria-label="Loja ou mochila">
        <button type="button" role="radio" aria-checked={aba === "vitrine"} className={aba === "vitrine" ? "on" : undefined} onClick={() => setAba("vitrine")}>
          Vitrine
        </button>
        <button type="button" role="radio" aria-checked={aba === "mochila"} className={aba === "mochila" ? "on" : undefined} onClick={() => setAba("mochila")}>
          Mochila{minhas.length > 0 && ` (${minhas.length})`}
        </button>
      </div>
      {!itens && <p className="hint">Abrindo a loja…</p>}
      {itens && aba === "vitrine" &&
        GRUPOS.map((g) => {
          const lista = doGrupo(itens, g.espacos);
          if (!lista.length) return null;
          return (
            <section key={g.id} className="loja-grupo" aria-labelledby={"loja-" + g.id}>
              <h2 id={"loja-" + g.id}>{g.nome}</h2>
              <div className="loja-grade">
                {lista.map((it) => (
                  <CartaoItem key={it.id} it={it} tenho={qtd(it.id)} equipado={eq(it.id)} saldo={saldo} />
                ))}
              </div>
            </section>
          );
        })}
      {itens && aba === "mochila" && (
        <section className="block">
          <MochilaLista />
        </section>
      )}
    </section>
  );
}
