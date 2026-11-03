"use client";
/*
 * Aba Mercado da Loja (seção 56): os anúncios de todo mundo, os meus (com Retirar) e o formulário de vender um item
 * livre da mochila. Comprar pede o segundo toque.
 */
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useSure } from "@/components/ui/useSure";
import { useQuartos } from "@/features/quarto/quartoDados";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { useApp } from "@/lib/store";
import { useLoja, useMinhaMochila } from "./lojaDados";
import { anunciar, comprarAnuncio, iniciarMercado, recebe, retirarAnuncio, useMercado, type Anuncio } from "./mercado";

export function MercadoAba() {
  const anuncios = useMercado((s) => s.anuncios);
  const carregou = useMercado((s) => s.carregou);
  const myUid = useApp((s) => s.myUid);
  useEffect(iniciarMercado, []);
  const meus = anuncios.filter((a) => a.vendedor === myUid);
  const outros = anuncios.filter((a) => a.vendedor !== myUid);
  return (
    <div className="mercado">
      <Vender />
      <section className="block">
        <h2>À venda</h2>
        {!carregou && <p className="hint">Abrindo o mercado…</p>}
        {carregou && !outros.length && <p className="hint">Ninguém anunciou nada ainda.</p>}
        <ul className="mercado-lista">
          {outros.map((a) => (
            <LinhaAnuncio key={a.id} a={a} />
          ))}
        </ul>
      </section>
      {meus.length > 0 && (
        <section className="block">
          <h2>Meus anúncios</h2>
          <ul className="mercado-lista">
            {meus.map((a) => (
              <LinhaAnuncio key={a.id} a={a} meu />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LinhaAnuncio({ a, meu }: { a: Anuncio; meu?: boolean }) {
  const itens = useLoja((s) => s.itens);
  const vendedor = useApp((s) => s.friends.find((f) => f.user_id === a.vendedor));
  const saldo = useCarteira((s) => s.carteira?.saldo ?? 0);
  const { sure, pedir } = useSure();
  const [indo, setIndo] = useState(false);
  const it = itens?.find((x) => x.id === a.item);
  const agir = async () => {
    if (!meu && !pedir()) return;
    setIndo(true);
    await (meu ? retirarAnuncio(a.id) : comprarAnuncio(a.id));
    setIndo(false);
  };
  return (
    <li className="mercado-linha">
      <span className="mercado-item">
        <b>{it?.nome ?? a.item}</b>
        {a.numero !== null && <small className="loja-ltd"> nº {a.numero}</small>}
        <small>
          {vendedor && <Avatar f={vendedor} size="xs" />} {meu ? `você recebe ${formatarMoedas(recebe(a.preco))}` : vendedor?.name ?? "alguém"}
        </small>
      </span>
      <span className="loja-preco">
        <span className="hall-moeda" aria-hidden="true">
          $
        </span>
        {formatarMoedas(a.preco)}
      </span>
      {meu ? (
        <button type="button" className="btn soft sm" disabled={indo} onClick={() => void agir()}>
          Retirar
        </button>
      ) : saldo < a.preco ? (
        <span className="status">Faltam {formatarMoedas(a.preco - saldo)}</span>
      ) : (
        <button type="button" className={"btn sm" + (sure ? " sure" : "")} disabled={indo} onClick={() => void agir()}>
          {sure ? "Confirmar" : "Comprar"}
        </button>
      )}
    </li>
  );
}

/** Vender: um item livre da mochila (sem os móveis colocados no quarto e sem o quarto) pelo preço que eu quiser. */
function Vender() {
  const itens = useLoja((s) => s.itens);
  const mochila = useMinhaMochila();
  const moveis = useQuartos((s) => s.moveis);
  const myUid = useApp((s) => s.myUid);
  const [item, setItem] = useState("");
  const [preco, setPreco] = useState(100);
  const [indo, setIndo] = useState(false);
  const livres = useMemo(() => {
    const colocados: Record<string, number> = {};
    for (const m of Object.values(moveis)) if (m.userId === myUid) colocados[m.itemId] = (colocados[m.itemId] ?? 0) + 1;
    return mochila.flatMap((l) => {
      const it = itens?.find((x) => x.id === l.itemId);
      return it && it.espaco !== "quarto" && l.qtd - (colocados[l.itemId] ?? 0) > 0 ? [it] : [];
    });
  }, [mochila, moveis, myUid, itens]);
  const valido = !!item && livres.some((x) => x.id === item) && preco >= 10 && preco <= 100000;
  return (
    <form
      className="block mercado-vender"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valido || indo) return;
        setIndo(true);
        if (await anunciar(item, preco)) setItem("");
        setIndo(false);
      }}
    >
      <h2>Vender um item</h2>
      {!livres.length ? (
        <p className="hint">Nada livre na mochila para vender (móveis colocados no quarto não entram: guarde antes).</p>
      ) : (
        <div className="mercado-campos">
          <select value={item} onChange={(e) => setItem(e.target.value)} aria-label="Item para vender">
            <option value="">Escolha um item…</option>
            {livres.map((it) => (
              <option key={it.id} value={it.id}>
                {it.nome}
              </option>
            ))}
          </select>
          <label>
            Preço
            <input type="number" min={10} max={100000} inputMode="numeric" value={preco} onChange={(e) => setPreco(Math.floor(Number(e.target.value) || 0))} />
          </label>
          <button type="submit" className="btn sm" disabled={!valido || indo}>
            Anunciar
          </button>
        </div>
      )}
      <p className="hint">O item sai da mochila e fica no anúncio até alguém comprar (ou você retirar). Você recebe o preço menos 5%, que vão para a Banca Nanica.</p>
    </form>
  );
}
