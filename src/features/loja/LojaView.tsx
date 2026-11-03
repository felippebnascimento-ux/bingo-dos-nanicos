"use client";
/*
 * Aba Loja (fora do menu; abre pela geladeira do Sítio e pelo chip do Início): a vitrine, agrupada, com
 * uma prévia desenhada de cada item, e a mochila (equipar, usar no Sítio). Comprar pede o segundo toque,
 * porque gasta moedas. Quem confere preço, saldo e repetição é o banco.
 */
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcFechar, IcVoltar } from "@/components/ui/icones";
import { useSure } from "@/components/ui/useSure";
import { QuartoPrevia, type EquipQuarto } from "@/features/ficha/Quarto";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { friendOf, setApp, useApp } from "@/lib/store";
import { DesenhoItem } from "./Itens";
import { abrirCelular } from "@/features/celular/rede";
import { acumula, doGrupo, equipavel, estadoRaro, GRUPOS, MAX_MOVEL, NOME_ESPACO, NOME_RARIDADE, podeComprar, posicionavel, progressoCompra, quandoSai, raridade, type ItemLoja } from "./loja";
import { MovelPrevia, QuartoCena, type MovelCena } from "@/features/quarto/QuartoCena";
import { desenhoDo } from "@/features/quarto/Moveis";
import { abrirArrumar, iniciarQuartos, useQuartos } from "@/features/quarto/quartoDados";
import { diferenca, podeComprarQuarto } from "@/features/quarto/quarto";
import { comprar, equipar, useLoja, useMinhaMochila, usar, useRaros } from "./lojaDados";
import { MercadoAba } from "./MercadoAba";

const FOCO: Partial<Record<ItemLoja["espaco"], "parede" | "chao" | "mesa" | "poster" | "cadeira" | "planta">> = {
  parede: "parede",
  luz: "parede",
  poster: "poster",
  tapete: "chao",
  mesa: "mesa",
  cadeira: "cadeira",
  planta: "planta",
};

const SEM_EQUIP = {};
const SEM_MOVEIS: MovelCena[] = [];

/** Prévia do item: o quarto com ele, o título, o rosto com a moldura ou o desenho do consumível. */
export function Previa({ it }: { it: ItemLoja }) {
  const eu = useApp((s) => friendOf(s.myFid, s.friends));
  /* fase 34: móveis com desenho e os quartos próprios (vazios, no tamanho) */
  if (it.espaco === "quarto" && it.dados.tamanho) return <QuartoCena tamanho={it.dados.tamanho} equip={SEM_EQUIP} moveis={SEM_MOVEIS} />;
  if (posicionavel(it) && it.dados.w && it.dados.d && (it.espaco === "movel" || !FOCO[it.espaco]))
    return <MovelPrevia desenho={desenhoDo(it)} w={it.dados.w} d={it.dados.d} />;
  const foco = FOCO[it.espaco];
  if (foco) return <QuartoPrevia equip={{ [it.espaco]: it.dados.cor } as EquipQuarto} foco={foco} />;
  if (it.espaco === "titulo") return <span className="loja-titulo-previa">{it.dados.texto}</span>;
  /* efeito no boneco (seção 61): o rosto com o efeito */
  if (it.espaco === "efeito")
    return (
      <span className={"loja-efeito-previa efeito-" + it.dados.cor}>
        <Avatar f={eu ?? { name: "?" }} size="lg" />
      </span>
    );
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

type Estado = { tenho: number; equipado: boolean; saldo: number | null };

/** Cartão da vitrine: tocar na prévia ou no nome abre o detalhe; a raridade (pelo preço) pinta a borda. */
function CartaoItem({ it, tenho, equipado, saldo, abrir }: { it: ItemLoja; abrir: () => void } & Estado) {
  const r = raridade(it.preco);
  return (
    <article className={`block loja-item rar-${r}` + (equipado ? " equipado" : "")}>
      <button type="button" className="loja-previa" aria-label={`Ver ${it.nome}`} onClick={abrir}>
        <Previa it={it} />
        <span className="loja-rar">{NOME_RARIDADE[r]}</span>
        {tenho > 0 && acumula(it.espaco) && <span className="loja-qtd">×{tenho}</span>}
        {tenho > 0 && !acumula(it.espaco) && <span className="loja-qtd">{equipado ? "equipado" : "na mochila"}</span>}
      </button>
      <h3>{it.nome}</h3>
      <SeloRaro it={it} />
      <p className="hint">{it.descricao}</p>
      <AcoesItem it={it} tenho={tenho} equipado={equipado} saldo={saldo} />
    </article>
  );
}

/** Janela com o item grande, a descrição e as mesmas ações do cartão. */
function ItemDetalhe({ it, fechar, ...estado }: { it: ItemLoja; fechar: () => void } & Estado) {
  const r = raridade(it.preco);
  const fecharRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fecharRef.current?.focus();
  }, []);
  return (
    <div
      className="gate carteira-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="itemTitulo"
      onKeyDown={(e) => e.key === "Escape" && fechar()}
      onClick={(e) => e.target === e.currentTarget && fechar()}
    >
      <div className={`carteira-painel loja-detalhe rar-${r}`}>
        <div className="loja-previa grande">
          <Previa it={it} />
          <span className="loja-rar">{NOME_RARIDADE[r]}</span>
          <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar" onClick={fechar}>
            <IcFechar />
          </button>
        </div>
        <div className="loja-detalhe-tx">
          <small>{NOME_ESPACO[it.espaco]}</small>
          <h2 id="itemTitulo">{it.nome}</h2>
          <SeloRaro it={it} />
          <p>{it.descricao}</p>
        </div>
        <AcoesItem it={it} {...estado} />
      </div>
    </div>
  );
}

/** Raro (seção 55): quantos restam, esgotado ou quando sai, e os números que eu tenho. */
function useRaro(it: ItemLoja) {
  const numeros = useRaros((s) => s.numeros);
  const myUid = useApp((s) => s.myUid);
  const [agora] = useState(() => Date.now());
  const doItem = it.estoque ? numeros.filter((n) => n.item === it.id) : [];
  return { raro: estadoRaro(it, doItem.length, agora), meus: doItem.filter((n) => n.uid === myUid).map((n) => n.numero) };
}

function SeloRaro({ it }: { it: ItemLoja }) {
  const { raro, meus } = useRaro(it);
  if (!raro) return null;
  return (
    <p className={"loja-ltd" + (raro.esgotado ? " fim" : "")}>
      <b>RARO</b> {raro.esgotado ? "Esgotado" : raro.saiEm ? `Sai ${quandoSai(raro.saiEm)} · ${raro.total} no mundo` : `Restam ${raro.restam} de ${raro.total}`}
      {meus.length > 0 && <span> · seu nº {meus.join(", ")}</span>}
    </p>
  );
}

function AcoesItem({ it, tenho, equipado, saldo }: { it: ItemLoja } & Estado) {
  const { sure, pedir } = useSure();
  const ocupado = useLoja((s) => s.ocupado);
  const { raro } = useRaro(it);
  const pode = podeComprar(it, tenho, saldo, raro);
  return (
    <>
      {it.espaco === "celular" && tenho === 0 && saldo !== null && saldo < it.preco && (
        <div className="loja-meta">
          <span className="missao-barra" role="progressbar" aria-valuemin={0} aria-valuemax={it.preco} aria-valuenow={saldo} aria-label="Quanto já juntei">
            <i style={{ width: `${progressoCompra(it.preco, saldo).parte * 100}%` }} />
          </span>
          <small>faltam {formatarMoedas(progressoCompra(it.preco, saldo).falta)} moedas</small>
        </div>
      )}
      <div className="loja-acoes">
        <span className="loja-preco">
          <span className="hall-moeda" aria-hidden="true">
            $
          </span>
          {formatarMoedas(it.preco)}
        </span>
        {it.espaco === "quarto" ? (
          <BotaoQuarto it={it} saldo={saldo} />
        ) : tenho > 0 && it.espaco === "celular" ? (
          <button type="button" className="btn sm" onClick={abrirCelular}>
            Abrir
          </button>
        ) : tenho > 0 && equipavel(it.espaco) ? (
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
            {sure ? "Confirmar" : posicionavel(it) && tenho > 0 ? `Comprar (${tenho + 1} de ${MAX_MOVEL})` : "Comprar"}
          </button>
        ) : (
          <span className="status">{pode.motivo}</span>
        )}
      </div>
    </>
  );
}

/** Comprar um quarto próprio: quem já tem um menor paga só a diferença; o banco confere de novo. */
function BotaoQuarto({ it, saldo }: { it: ItemLoja; saldo: number | null }) {
  const { sure, pedir } = useSure();
  const ocupado = useLoja((s) => s.ocupado);
  const itens = useLoja((s) => s.itens);
  const meu = useQuartos((s) => (s.quartos[useApp.getState().myUid ?? ""] ?? null));
  useEffect(() => {
    void iniciarQuartos();
  }, []);
  const tam = it.dados.tamanho ?? 0;
  const pode = podeComprarQuarto(tam, meu);
  if (!pode.ok) return meu === tam ? (
    <button type="button" className="btn sm soft" onClick={abrirArrumar}>
      Arrumar
    </button>
  ) : (
    <span className="status">{pode.motivo}</span>
  );
  const atual = meu ? (itens ?? []).find((x) => x.espaco === "quarto" && x.dados.tamanho === meu) : undefined;
  const custo = diferenca(it.preco, tam, atual && meu ? { tamanho: meu, preco: atual.preco } : null) ?? it.preco;
  if (saldo !== null && saldo < custo) return <span className="status">Faltam {formatarMoedas(custo - saldo)}</span>;
  return (
    <button type="button" className={"btn sm" + (sure ? " sure" : "")} disabled={!!ocupado} onClick={() => pedir() && void comprar(it)}>
      {sure ? "Confirmar" : meu ? `Comprar por ${formatarMoedas(custo)} (diferença)` : "Comprar"}
    </button>
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
              Usar no K-FOFO
            </button>
          ) : it.espaco === "celular" ? (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                useLoja.setState({ mochilaAberta: false });
                abrirCelular();
              }}
            >
              Abrir
            </button>
          ) : it.espaco === "escudo" ? (
            <span className="status">Gasto sozinho</span>
          ) : it.espaco === "quarto" || it.espaco === "movel" ? (
            /* o quarto próprio e os móveis se mexem na tela de arrumar (os de piso antigos ainda se equipam no quarto fixo) */
            <button type="button" className="btn sm" onClick={abrirArrumar}>
              Arrumar
            </button>
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
  const [aba, setAba] = useState<"vitrine" | "mochila" | "mercado">("vitrine");
  const [filtro, setFiltro] = useState("tudo");
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const qtd = (id: string) => minhas.find((l) => l.itemId === id)?.qtd ?? 0;
  const eq = (id: string) => !!minhas.find((l) => l.itemId === id)?.equipado;
  const aberto = detalhe ? itens?.find((i) => i.id === detalhe) : undefined;
  const grupos = itens ? GRUPOS.filter((g) => doGrupo(itens, g.espacos).length) : [];

  return (
    <section id="view-loja" className="inner" hidden={hidden}>
      <button type="button" className="linkish trofeus-voltar" onClick={() => setApp({ aba: "hall" })}>
        <IcVoltar tam={14} /> Voltar ao K-FOFO
      </button>
      <header className="hero loja-topo">
        <div>
          <h1>Loja</h1>
          <p>Itens para o seu quarto, títulos, molduras e coisas para usar no K-FOFO.</p>
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
      <div className="seg loja-abas" role="radiogroup" aria-label="Vitrine, mercado ou mochila">
        <button type="button" role="radio" aria-checked={aba === "vitrine"} className={aba === "vitrine" ? "on" : undefined} onClick={() => setAba("vitrine")}>
          Vitrine
        </button>
        <button type="button" role="radio" aria-checked={aba === "mochila"} className={aba === "mochila" ? "on" : undefined} onClick={() => setAba("mochila")}>
          Mochila{minhas.length > 0 && ` (${minhas.length})`}
        </button>
        <button type="button" role="radio" aria-checked={aba === "mercado"} className={aba === "mercado" ? "on" : undefined} onClick={() => setAba("mercado")}>
          Mercado
        </button>
      </div>
      {!itens && <p className="hint">Abrindo a loja…</p>}
      {itens && aba === "vitrine" && (
        <div className="loja-filtros" role="radiogroup" aria-label="Filtrar a vitrine">
          {[{ id: "tudo", curto: "Tudo" }, ...grupos].map((g) => (
            <button key={g.id} type="button" role="radio" aria-checked={filtro === g.id} className={filtro === g.id ? "on" : undefined} onClick={() => setFiltro(g.id)}>
              {g.curto}
            </button>
          ))}
        </div>
      )}
      {itens && aba === "vitrine" &&
        grupos
          .filter((g) => filtro === "tudo" || filtro === g.id)
          .map((g) => (
            <section key={g.id} className="loja-grupo" aria-labelledby={"loja-" + g.id}>
              <h2 id={"loja-" + g.id}>{g.nome}</h2>
              <div className="loja-grade">
                {doGrupo(itens, g.espacos).map((it) => (
                  <CartaoItem key={it.id} it={it} tenho={qtd(it.id)} equipado={eq(it.id)} saldo={saldo} abrir={() => setDetalhe(it.id)} />
                ))}
              </div>
            </section>
          ))}
      {aberto && <ItemDetalhe it={aberto} tenho={qtd(aberto.id)} equipado={eq(aberto.id)} saldo={saldo} fechar={() => setDetalhe(null)} />}
      {itens && aba === "mercado" && <MercadoAba />}
      {itens && aba === "mochila" && (
        <section className="block">
          <MochilaLista />
        </section>
      )}
    </section>
  );
}
