"use client";
/*
 * O Haras, na loja (seção 71): comprar um cavalo (nome e pelagem), treinar os 4 atributos (cada ponto fica mais caro) e ver
 * a campanha de cada um. Embaixo, o ranking dos cavalos do hipódromo. Quem confere preço, dono e teto é o banco.
 */
import { useEffect, useState } from "react";
import { useSure } from "@/components/ui/useSure";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { setApp, useApp } from "@/lib/store";
import { useJogoCassino } from "@/features/cassino/estado";
import { DesenhoCavalo } from "./Cavalo";
import {
  ATRIBUTOS,
  ATRIB_MAX,
  CHAVE_ATRIB,
  MAX_CAVALOS,
  NOME_PELAGEM,
  PELAGENS,
  PRECO_CAVALO,
  custoTreino,
  nomeOk,
  nota,
  pontosPossiveis,
  type Atributo,
  type Cavalo,
  type Pelagem,
} from "./corridaRegras";
import { carregarCavalos, comprarCavalo, treinarCavalo, useCavalos } from "./corridaDados";

function BotaoTreino({ c, at, n }: { c: Cavalo; at: Atributo; n: number }) {
  const { sure, pedir } = useSure();
  const ocupado = useCavalos((s) => s.ocupado);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? null);
  const v = c[CHAVE_ATRIB[at]];
  const pts = pontosPossiveis(v, n);
  const custo = custoTreino(v, pts);
  if (!pts) return null;
  const falta = saldo !== null && saldo < custo;
  return (
    <button
      type="button"
      className={"btn sm" + (n === 1 ? " soft" : "") + (sure ? " sure" : "")}
      disabled={!!ocupado || falta}
      aria-label={sure ? `Confirmar: treinar +${pts} por ${custo} moedas` : `Treinar +${pts} por ${custo} moedas`}
      onClick={() => pedir() && void treinarCavalo(c.id, at, pts)}
    >
      {sure ? "Confirmar" : `+${pts} · ${formatarMoedas(custo)}`}
    </button>
  );
}

function CartaoCavalo({ c }: { c: Cavalo }) {
  return (
    <article className="block haras-cavalo">
      <div className="haras-cab">
        <span className="haras-desenho">
          <DesenhoCavalo pelagem={c.pelagem} semJoquei />
        </span>
        <div>
          <h3>{c.nome}</h3>
          <small>
            {NOME_PELAGEM[c.pelagem]} · nota {nota(c)}
          </small>
          <p className="haras-campanha">
            {c.corridas ? `${c.corridas} corridas · ${c.vitorias} vitórias · ${c.podios} pódios · ${formatarMoedas(c.ganhos)} em prêmios` : "Ainda não correu."}
            {c.forma.length > 0 && <span> · forma {c.forma.join("-")}</span>}
          </p>
        </div>
      </div>
      <ul className="haras-atributos">
        {ATRIBUTOS.map((a) => {
          const v = c[CHAVE_ATRIB[a.id]];
          return (
            <li key={a.id}>
              <span className="haras-at-nome">
                <b>{a.nome}</b>
                <small>{a.dica}</small>
              </span>
              <span className="haras-barra" role="meter" aria-valuemin={0} aria-valuemax={ATRIB_MAX} aria-valuenow={v} aria-label={a.nome}>
                <i style={{ width: `${v}%` }} />
                <em>{v}</em>
              </span>
              <span className="haras-treino">
                {v >= ATRIB_MAX ? (
                  <span className="status">Máximo</span>
                ) : (
                  <>
                    <BotaoTreino c={c} at={a.id} n={1} />
                    <BotaoTreino c={c} at={a.id} n={5} />
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/** A compra de um potro: nome, pelagem (com o desenho dela) e o botão. Fica no Haras e na janela do cavalo da vitrine da loja. */
export function ComprarCavalo({ aoComprar }: { aoComprar?: () => void } = {}) {
  const [nome, setNome] = useState("");
  const [pelagem, setPelagem] = useState<Pelagem>("castanho");
  const { sure, pedir } = useSure();
  const ocupado = useCavalos((s) => s.ocupado);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? null);
  const ok = nomeOk(nome);
  const falta = saldo !== null && saldo < PRECO_CAVALO;
  return (
    <section className="block haras-comprar">
      <h3>Comprar um potro</h3>
      <p className="hint">Começa com 40 em tudo. Treine para ele brigar com os cavalos da casa (que estão entre 40 e 78).</p>
      <div className="haras-comprar-linha">
        <span className="haras-desenho grande">
          <DesenhoCavalo pelagem={pelagem} semJoquei />
        </span>
        <div className="haras-form">
          <label>
            Nome
            <input value={nome} maxLength={20} placeholder="Ex.: Pé de Pano II" onChange={(e) => setNome(e.target.value)} />
          </label>
          <div className="haras-pelagens" role="radiogroup" aria-label="Pelagem">
            {PELAGENS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={pelagem === p} className={`haras-pelagem cav-${p}` + (pelagem === p ? " on" : "")} onClick={() => setPelagem(p)}>
                <i aria-hidden="true" />
                {NOME_PELAGEM[p]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={"btn" + (sure ? " sure" : "")}
            disabled={!ok || !!ocupado || falta}
            onClick={() =>
              pedir() &&
              void comprarCavalo(nome, pelagem).then((r) => {
                if (!r) return;
                setNome("");
                aoComprar?.();
              })
            }
          >
            {sure ? "Confirmar" : falta ? `Faltam ${formatarMoedas(PRECO_CAVALO - (saldo ?? 0))}` : `Comprar por ${formatarMoedas(PRECO_CAVALO)}`}
          </button>
          {nome && !ok && <small className="hint">2 a 20 letras (pode ter número, espaço, ponto e hífen).</small>}
        </div>
      </div>
    </section>
  );
}

export function Haras() {
  const todos = useCavalos((s) => s.todos);
  const myUid = useApp((s) => s.myUid);
  const friends = useApp((s) => s.friends);
  useEffect(() => {
    void carregarCavalos();
  }, []);
  const meus = (todos ?? []).filter((c) => c.dono && c.dono === myUid).sort((a, b) => a.id - b.id);
  const ranking = [...(todos ?? [])].filter((c) => c.corridas > 0).sort((a, b) => b.vitorias - a.vitorias || b.podios - a.podios || nota(b) - nota(a)).slice(0, 10);
  const dono = (uid: string | null) => (uid ? (friends.find((f) => f.user_id === uid)?.name ?? "um nanico") : "da casa");
  const verCorrida = () => {
    useJogoCassino.setState({ jogo: "corrida" });
    setApp({ aba: "cassino" });
  };
  return (
    <div className="haras">
      <div className="haras-topo">
        <p>
          Compre até {MAX_CAVALOS} cavalos, treine os atributos e inscreva no páreo da corrida. O dono ganha pelo pódio, e todo mundo aposta.
        </p>
        <button type="button" className="btn soft sm" onClick={verCorrida}>
          Ver a corrida
        </button>
      </div>
      {!todos && <p className="hint">Abrindo o haras…</p>}
      {meus.map((c) => (
        <CartaoCavalo key={c.id} c={c} />
      ))}
      {todos && meus.length < MAX_CAVALOS && <ComprarCavalo />}
      {ranking.length > 0 && (
        <section className="block haras-ranking">
          <h3>Ranking do hipódromo</h3>
          <ol>
            {ranking.map((c) => (
              <li key={c.id}>
                <span className="haras-desenho mini">
                  <DesenhoCavalo pelagem={c.pelagem} semJoquei />
                </span>
                <span>
                  <b>{c.nome}</b> <small>{dono(c.dono)}</small>
                </span>
                <span className="haras-placar">
                  {c.vitorias} V · {c.podios} pódios · {c.corridas} corridas
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
