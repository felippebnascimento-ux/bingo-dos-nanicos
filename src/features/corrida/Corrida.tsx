"use client";
/*
 * A corrida de cavalos no Cassino (seção 71): a pista com as 8 raias, o quadro de cotações (vencedor, placê e exata),
 * o valor da aposta, as minhas apostas, a inscrição do meu cavalo e os últimos vencedores. Tudo vem do corrida_estado;
 * o movimento na pista é calculado aqui (corrida.ts) para terminar exatamente na ordem que o banco sorteou.
 */
import { useEffect, useMemo, useState } from "react";
import { useSure } from "@/components/ui/useSure";
import { ValorAposta, apostaOk } from "@/features/cassino/ValorAposta";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { setApp, useApp } from "@/lib/store";
import { reduzMovimento } from "@/lib/util";
import { DesenhoCavalo } from "./Cavalo";
import {
  DICA_APOSTA,
  NOME_APOSTA,
  NOME_DISTANCIA,
  NOME_PISTA,
  PREMIO_DONO,
  RAIAS,
  estilo,
  faseEm,
  forca,
  ganhou,
  posicao,
  retorno,
  temposDeChegada,
  textoOdd,
  type CavaloCampo,
  type EstadoCorrida,
  type Tempos,
  type TipoAposta,
} from "./corridaRegras";
import { apostarCorrida, carregarCavalos, inscreverCavalo, useCavalos, useCorrida } from "./corridaDados";

/** Relógio do banco, atualizado a cada quadro durante a corrida e a cada 250 ms no resto. */
function useAgora(dif: { current: number }, tempos: Tempos | null) {
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    let id = 0;
    let ultimo = -1e9;
    const passo = (t: number) => {
      const ag = Date.now() + dif.current;
      const correndo = !!tempos && ag >= tempos.fechaEm && ag < tempos.fimEm + 300;
      if (correndo || t - ultimo >= 250) {
        ultimo = t;
        setAgora(ag);
      }
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [dif, tempos]);
  return agora;
}

const ORDINAL = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º"];

function useNomeDono() {
  const friends = useApp((s) => s.friends);
  return (uid: string | null) => (uid ? (friends.find((f) => f.user_id === uid)?.name ?? "um nanico") : null);
}

/** A pista: 8 raias, a linha de chegada e cada cavalo onde a conta manda. */
export function Pista({ e, agora }: { e: EstadoCorrida; agora: number }) {
  const fase = faseEm(e.tempos, agora);
  const campo = e.campo;
  const tempos = useMemo(() => (e.pontos ? temposDeChegada(e.pontos) : null), [e.pontos]);
  const estilos = useMemo(() => campo?.map((c, i) => estilo(c, i)) ?? [], [campo]);
  const desde = agora - e.tempos.fechaEm;
  const posDe = (i: number) => {
    if (!campo || !tempos || fase === "inscricoes" || fase === "apostas") return 0;
    if (fase === "fim" || reduzMovimento()) return 1;
    return posicao(desde / tempos[i], estilos[i]);
  };
  const colocacao = (i: number) => (e.ordem && (fase === "fim" || (tempos && desde >= tempos[i])) ? e.ordem.indexOf(i) : -1);
  const linhas: { nome: string; pelagem: CavaloCampo["pelagem"] | null }[] = campo
    ? campo.map((c) => ({ nome: c.nome, pelagem: c.pelagem }))
    : Array.from({ length: RAIAS }, (_, i) => (e.inscritos[i] ? { nome: e.inscritos[i].nome, pelagem: e.inscritos[i].pelagem } : { nome: "", pelagem: null }));
  return (
    <div className={"corrida-pista" + (e.pista === "pesada" ? " pesada" : "")} role="img" aria-label={campo ? "A pista com os 8 cavalos" : "Os portões de largada"}>
      <span className="corrida-chegada" aria-hidden="true" />
      {linhas.map((l, i) => {
        const p = posDe(i);
        const col = colocacao(i);
        return (
          <div key={i} className="corrida-raia">
            <span className={`corrida-num raia-${i + 1}`}>{i + 1}</span>
            {l.pelagem ? (
              <span className="corrida-cavalo" style={{ left: `calc(${(p * 100).toFixed(3)}% * 0.86)` }}>
                <DesenhoCavalo pelagem={l.pelagem} raia={i} correndo={fase === "correndo" && p < 1} />
              </span>
            ) : (
              <span className="corrida-vaga">{campo ? "" : "vaga da casa"}</span>
            )}
            <span className="corrida-nome">{l.nome}</span>
            {col >= 0 && <span className={"corrida-col" + (col < 3 ? " podio" : "")}>{ORDINAL[col]}</span>}
          </div>
        );
      })}
    </div>
  );
}

type Escolha = { tipo: TipoAposta; raia: number; raia2: number | null };

export function Corrida({ ativa }: { ativa: boolean }) {
  const { estado: e, ligada, dif, atualizar } = useCorrida(ativa);
  const agora = useAgora(dif, e?.tempos ?? null);
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const myUid = useApp((s) => s.myUid);
  const nomeDono = useNomeDono();
  const todos = useCavalos((s) => s.todos);
  /* a escolha vale só para o páreo em que foi feita */
  const [sel, setSel] = useState<{ id: number; x: Escolha } | null>(null);
  const [valor, setValor] = useState(10);
  const [indo, setIndo] = useState(false);
  const { sure, pedir } = useSure();

  useEffect(() => {
    if (ativa) void carregarCavalos();
  }, [ativa]);

  if (ligada === false) return <p className="hint">A corrida de cavalos ainda não abriu (falta o SQL da seção 71).</p>;
  if (!e || !agora) return <p className="hint">Abrindo o hipódromo…</p>;
  const escolha = sel && sel.id === e.id ? sel.x : null;
  const setEscolha = (x: Escolha | null) => setSel(x ? { id: e.id, x } : null);

  const f = faseEm(e.tempos, agora);
  const ate = f === "inscricoes" ? e.tempos.apostasEm : f === "apostas" ? e.tempos.fechaEm : f === "correndo" ? e.tempos.fimEm : e.tempos.fimEm + 10000;
  const total = f === "inscricoes" ? e.tempos.apostasEm - e.tempos.abreEm : f === "apostas" ? e.tempos.fechaEm - e.tempos.apostasEm : f === "correndo" ? e.tempos.fimEm - e.tempos.fechaEm : 10000;
  const falta = Math.max(0, ate - agora);
  const textoFase = f === "inscricoes" ? "Inscrições abertas" : f === "apostas" ? "Apostas abertas" : f === "correndo" ? "Correndo!" : "Resultado";
  const campo = e.campo;
  const meus = (todos ?? []).filter((c) => c.dono && c.dono === myUid);
  const inscritoMeu = e.inscritos.find((c) => c.dono === myUid);

  const oddDa = (x: Escolha) => (x.tipo === "exata" ? (x.raia2 !== null ? e.exatas[`${x.raia}-${x.raia2}`] : undefined) : campo?.[x.raia] ? (x.tipo === "vencedor" ? campo[x.raia].oddV : campo[x.raia].oddP) : undefined);
  const odd = escolha ? oddDa(escolha) : undefined;
  const pronta = f === "apostas" && !!escolha && odd !== undefined && apostaOk(valor, saldo) && e.minhas.length < 10;

  const apostar = async () => {
    if (!escolha || !pronta || !pedir()) return;
    setIndo(true);
    const r = await apostarCorrida(escolha.tipo, escolha.raia, escolha.raia2, valor);
    setIndo(false);
    if (r) {
      setEscolha(null);
      void atualizar();
    }
  };
  const nomeDe = (raia: number | null) => (raia !== null && campo?.[raia] ? `${raia + 1}. ${campo[raia].nome}` : "?");
  const descreve = (x: { tipo: TipoAposta; raia: number; raia2: number | null }) => (x.tipo === "exata" ? `Exata ${nomeDe(x.raia)} → ${nomeDe(x.raia2)}` : `${NOME_APOSTA[x.tipo]} ${nomeDe(x.raia)}`);

  return (
    <div className="corrida">
      <header className="corrida-topo">
        <div>
          <b>Páreo {e.id}</b>
          <span>{NOME_DISTANCIA[e.distancia]}</span>
          <span className={"corrida-piso" + (e.pista === "pesada" ? " pesada" : "")}>{NOME_PISTA[e.pista]}</span>
        </div>
        <div className={"corrida-fase f-" + f}>
          {textoFase}
          {f !== "correndo" && <small> · {Math.ceil(falta / 1000)} s</small>}
        </div>
        <span className="corrida-tempo" aria-hidden="true">
          <i style={{ width: `${Math.max(0, Math.min(100, (falta / total) * 100))}%` }} />
        </span>
      </header>

      <Pista e={e} agora={agora} />

      {f === "fim" && e.ordem && campo && (
        <div className="corrida-podio" role="status">
          {e.ordem.slice(0, 3).map((r, k) => (
            <span key={r} className={"corrida-podio-item p" + (k + 1)}>
              <b>{ORDINAL[k]}</b> {r + 1}. {campo[r].nome}
              {campo[r].dono && <small> de {nomeDono(campo[r].dono)}</small>}
            </span>
          ))}
        </div>
      )}

      {f === "inscricoes" && (
        <section className="block corrida-inscricao">
          <h3>Inscrições</h3>
          <p className="hint">
            Cada um põe 1 cavalo seu por corrida; a casa completa as 8 raias. O dono leva {PREMIO_DONO.map((p) => formatarMoedas(p)).join(", ")} pelo 1º, 2º e 3º lugar.
          </p>
          {e.inscritos.length > 0 && (
            <ul className="corrida-inscritos">
              {e.inscritos.map((c) => (
                <li key={c.id}>
                  <DesenhoCavalo pelagem={c.pelagem} semJoquei />
                  <span>
                    {c.nome} <small>de {nomeDono(c.dono)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {inscritoMeu ? (
            <p className="status">{inscritoMeu.nome} está inscrito.</p>
          ) : meus.length ? (
            <div className="corrida-meus">
              {meus.map((c) => (
                <button key={c.id} type="button" className="btn sm" onClick={() => void inscreverCavalo(c.id).then((ok) => { if (ok) void atualizar(); })}>
                  Inscrever {c.nome}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="linkish" onClick={() => setApp({ aba: "loja" })}>
              Compre um cavalo no Haras da loja e ponha ele para correr
            </button>
          )}
        </section>
      )}

      {campo && (
        <section className="block corrida-quadro">
          <h3>Cotações</h3>
          <p className="hint">Toque numa cotação para escolher. Cada aposta paga o valor vezes a cotação que você pegou.</p>
          <div className="corrida-tabela" role="table" aria-label="Cavalos e cotações">
            <div role="row" className="corrida-linha cab">
              <span role="columnheader">Cavalo</span>
              <span role="columnheader">Forma</span>
              <span role="columnheader">Força</span>
              <span role="columnheader">Vencedor</span>
              <span role="columnheader">Placê</span>
            </div>
            {campo.map((c, i) => (
              <div role="row" key={c.id} className={"corrida-linha" + (e.ordem && f === "fim" && e.ordem[0] === i ? " ganhou" : "")}>
                <span role="cell" className="corrida-quem">
                  <span className={`corrida-num raia-${i + 1}`}>{i + 1}</span>
                  <span>
                    <b>{c.nome}</b>
                    <small>{c.dono ? `de ${nomeDono(c.dono)}` : "da casa"}</small>
                  </span>
                </span>
                <span role="cell" className="corrida-forma">{c.forma.length ? c.forma.join("-") : "estreia"}</span>
                <span role="cell" className="corrida-forca">{Math.round(forca(c, e.distancia, e.pista))}</span>
                {(["vencedor", "place"] as const).map((t) => {
                  const on = escolha?.tipo === t && escolha.raia === i;
                  return (
                    <span role="cell" key={t}>
                      <button type="button" className={"corrida-odd" + (on ? " on" : "")} aria-pressed={on} disabled={f !== "apostas"} onClick={() => setEscolha(on ? null : { tipo: t, raia: i, raia2: null })}>
                        {textoOdd(t === "vencedor" ? c.oddV : c.oddP)}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="corrida-exata">
            <b>Exata</b>
            <label>
              1º
              <select value={escolha?.tipo === "exata" ? escolha.raia : ""} disabled={f !== "apostas"} onChange={(ev) => setEscolha({ tipo: "exata", raia: Number(ev.target.value), raia2: escolha?.tipo === "exata" && escolha.raia2 !== Number(ev.target.value) ? escolha.raia2 : null })}>
                <option value="" disabled>
                  escolha
                </option>
                {campo.map((c, i) => (
                  <option key={c.id} value={i}>
                    {i + 1}. {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              2º
              <select value={escolha?.tipo === "exata" && escolha.raia2 !== null ? escolha.raia2 : ""} disabled={f !== "apostas" || escolha?.tipo !== "exata"} onChange={(ev) => escolha?.tipo === "exata" && setEscolha({ ...escolha, raia2: Number(ev.target.value) })}>
                <option value="" disabled>
                  escolha
                </option>
                {campo.map((c, i) =>
                  escolha?.tipo === "exata" && escolha.raia === i ? null : (
                    <option key={c.id} value={i}>
                      {i + 1}. {c.nome}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          {f === "apostas" && (
            <div className="corrida-apostar">
              <p className="corrida-escolha">
                {escolha ? (
                  <>
                    <b>{descreve(escolha)}</b> <small>({DICA_APOSTA[escolha.tipo]})</small>
                    {odd !== undefined && <span> · {textoOdd(odd)}</span>}
                  </>
                ) : (
                  <span className="hint">Escolha uma cotação no quadro ou monte a exata.</span>
                )}
              </p>
              <ValorAposta valor={valor} onValor={setValor} saldo={saldo ?? undefined} disabled={indo} />
              <button type="button" className={"btn" + (sure ? " sure" : "")} disabled={!pronta || indo} onClick={() => void apostar()}>
                {sure ? "Confirmar" : pronta && odd !== undefined ? `Apostar ${formatarMoedas(valor)} (paga ${formatarMoedas(retorno(valor, odd))})` : "Apostar"}
              </button>
            </div>
          )}
        </section>
      )}

      {e.minhas.length > 0 && (
        <section className="block corrida-minhas">
          <h3>Minhas apostas neste páreo</h3>
          <ul>
            {e.minhas.map((a, k) => {
              const res = a.pagou !== null ? (a.pagou > 0 ? "ganhou" : "perdeu") : e.ordem && f === "fim" ? (ganhou(a.tipo, a.raia, a.raia2, e.ordem) ? "ganhou" : "perdeu") : null;
              return (
                <li key={k} className={res ?? undefined}>
                  <span>{descreve(a)}</span>
                  <span>
                    {formatarMoedas(a.valor)} a {textoOdd(a.odd)}
                    {res === "ganhou" && <b> +{formatarMoedas(a.pagou ?? retorno(a.valor, a.odd))}</b>}
                    {res === "perdeu" && <small> perdeu</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {e.ultimas.length > 0 && (
        <section className="corrida-ultimas" aria-label="Últimos vencedores">
          <small>Últimos vencedores</small>
          <ul>
            {e.ultimas.map((u) => (
              <li key={u.id} title={`Páreo ${u.id}`}>
                <DesenhoCavalo pelagem={u.pelagem} semJoquei />
                {u.nome}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="block corrida-regras">
        <summary>Como funciona</summary>
        <ul className="hint">
          <li>Cada páreo tem 20 s de inscrições, 30 s de apostas e a corrida. A distância e a pista saem na abertura.</li>
          <li>Velocidade vale em todas as distâncias; arrancada pesa nos 1.000 m; resistência nos 2.400 m e na pista pesada; constância diminui a zebra contra o cavalo.</li>
          <li>A &quot;força&quot; do quadro é o favoritismo nas condições do páreo (sem a sorte). Na pista pesada a sorte pesa mais.</li>
          <li>Vencedor: o cavalo chega em 1º. Placê: em 1º ou 2º. Exata: o 1º e o 2º na ordem certa. Até 10 apostas por páreo; a casa leva cerca de 10%.</li>
          <li>
            O resultado sai de um segredo sorteado no fechamento das inscrições: o hash aparece antes da corrida e o segredo depois.
            {e.hash && (
              <>
                {" "}
                Hash: <code>{e.hash.slice(0, 16)}…</code>
              </>
            )}
            {e.segredo && (
              <>
                {" "}
                Segredo: <code>{e.segredo.slice(0, 16)}…</code>
              </>
            )}
          </li>
        </ul>
      </details>
    </div>
  );
}
