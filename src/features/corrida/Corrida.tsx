"use client";
/*
 * A corrida de cavalos no Cassino (seção 71; página refeita em 05/11/2026): a placa do páreo, a pista (Pista3D.tsx), o pódio,
 * o programa do páreo (um cartão por cavalo, com a forma, a força e as cotações de vencedor e placê), o bilhete (exata,
 * trifeta, valor, apostar e as minhas apostas), a inscrição do meu cavalo e os últimos vencedores. Tudo vem do
 * corrida_estado; o movimento na pista termina exatamente na ordem que o banco sorteou.
 */
import { useEffect, useState } from "react";
import { useSure } from "@/components/ui/useSure";
import { ValorAposta, apostaOk } from "@/features/cassino/ValorAposta";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { setApp, useApp } from "@/lib/store";
import { DesenhoCavalo } from "./Cavalo";
import { Pista3D } from "./Pista3D";
import {
  DICA_APOSTA,
  NOME_APOSTA,
  NOME_DISTANCIA,
  NOME_PISTA,
  PREMIO_DONO,
  faseEm,
  forca,
  ganhou,
  retorno,
  textoOdd,
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

type Escolha = { tipo: TipoAposta; raia: number; raia2: number | null; raia3?: number | null };
/* exata e trifeta: escolher o 1º, o 2º (e o 3º) em listas */
const COMBOS = { exata: 2, trifeta: 3 } as const;

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
  const [combo, setCombo] = useState<"exata" | "trifeta">("exata");
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
  const forcaMax = campo ? Math.max(1, ...campo.map((c) => forca(c, e.distancia, e.pista))) : 1;
  const meus = (todos ?? []).filter((c) => c.dono && c.dono === myUid);
  const inscritoMeu = e.inscritos.find((c) => c.dono === myUid);

  const oddDa = (x: Escolha) =>
    x.tipo === "exata"
      ? x.raia2 !== null
        ? e.exatas[`${x.raia}-${x.raia2}`]
        : undefined
      : x.tipo === "trifeta"
        ? x.raia2 !== null && x.raia3 != null
          ? e.trifetas[`${x.raia}-${x.raia2}-${x.raia3}`]
          : undefined
        : campo?.[x.raia]
          ? x.tipo === "vencedor"
            ? campo[x.raia].oddV
            : campo[x.raia].oddP
          : undefined;
  const posDaEscolha = (x: Escolha | null): (number | null)[] => (x && x.tipo === combo ? [x.raia, x.raia2, x.raia3 ?? null] : [null, null, null]);
  const escolherPos = (k: number, raia: number) => {
    const pos = posDaEscolha(escolha);
    pos[k] = raia;
    /* a mesma raia não pode estar em duas posições */
    for (let j = 0; j < 3; j++) if (j !== k && pos[j] === raia) pos[j] = null;
    if (pos[0] === null) return setEscolha(null);
    setEscolha({ tipo: combo, raia: pos[0], raia2: pos[1], raia3: combo === "trifeta" ? pos[2] : null });
  };
  const odd = escolha ? oddDa(escolha) : undefined;
  const pronta = f === "apostas" && !!escolha && odd !== undefined && apostaOk(valor, saldo) && e.minhas.length < 10;

  const apostar = async () => {
    if (!escolha || !pronta || !pedir()) return;
    setIndo(true);
    const r = await apostarCorrida(escolha.tipo, escolha.raia, escolha.raia2, valor, escolha.raia3 ?? null);
    setIndo(false);
    if (r) {
      setEscolha(null);
      void atualizar();
    }
  };
  const nomeDe = (raia: number | null) => (raia !== null && campo?.[raia] ? `${raia + 1}. ${campo[raia].nome}` : "?");
  const descreve = (x: { tipo: TipoAposta; raia: number; raia2: number | null; raia3?: number | null }) =>
    x.tipo === "exata"
      ? `Exata ${nomeDe(x.raia)} → ${nomeDe(x.raia2)}`
      : x.tipo === "trifeta"
        ? `Trifeta ${nomeDe(x.raia)} → ${nomeDe(x.raia2)} → ${nomeDe(x.raia3 ?? null)}`
        : `${NOME_APOSTA[x.tipo]} ${nomeDe(x.raia)}`;

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

      <Pista3D e={e} agora={agora} />

      {f === "fim" && e.ordem && campo && (
        <div className="corrida-podio" role="status">
          {e.ordem.slice(0, 3).map((r, k) => (
            <div key={r} className={"corrida-podio-item p" + (k + 1)}>
              <span className="corrida-podio-pos">{ORDINAL[k]}</span>
              <span className="corrida-podio-cav">
                <DesenhoCavalo pelagem={campo[r].pelagem} raia={r} />
              </span>
              <span className="corrida-podio-nome">
                <b>{campo[r].nome}</b>
                <small>{campo[r].dono ? `de ${nomeDono(campo[r].dono)} · +${formatarMoedas(PREMIO_DONO[k])}` : "da casa"}</small>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="corrida-grade">
        <div className="corrida-esq">
          {f === "inscricoes" && (
            <section className="block corrida-inscricao">
              <h3>Inscrições</h3>
              <p className="hint">
                Cada um põe 1 cavalo seu por páreo; a casa completa as 8 raias. O dono leva {PREMIO_DONO.map((p) => formatarMoedas(p)).join(", ")} pelo 1º, 2º e 3º lugar.
              </p>
              {e.inscritos.length > 0 && (
                <ul className="corrida-inscritos">
                  {e.inscritos.map((c) => (
                    <li key={c.id}>
                      <span className="corrida-mini">
                        <DesenhoCavalo pelagem={c.pelagem} semJoquei />
                      </span>
                      <span>
                        <b>{c.nome}</b>
                        <small>de {nomeDono(c.dono)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {inscritoMeu ? (
                <p className="status">{inscritoMeu.nome} está inscrito. Boa sorte!</p>
              ) : meus.length ? (
                <div className="corrida-meus">
                  {meus.map((c) => (
                    <button key={c.id} type="button" className="corrida-meu" onClick={() => void inscreverCavalo(c.id).then((ok) => { if (ok) void atualizar(); })}>
                      <span className="corrida-mini">
                        <DesenhoCavalo pelagem={c.pelagem} semJoquei />
                      </span>
                      <span>
                        <b>{c.nome}</b>
                        <small>Inscrever</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <button type="button" className="btn soft sm" onClick={() => setApp({ aba: "loja" })}>
                  Comprar um cavalo no Haras
                </button>
              )}
            </section>
          )}

          {campo && (
            <section className="block corrida-programa">
              <div className="corrida-sec-topo">
                <h3>Programa do páreo</h3>
                <span className="hint">Toque numa cotação para apostar</span>
              </div>
              <ul className="corrida-cavalos" aria-label="Cavalos e cotações">
                {campo.map((c, i) => {
                  const forcaC = forca(c, e.distancia, e.pista);
                  const chegou = e.ordem && f === "fim" ? e.ordem.indexOf(i) : -1;
                  return (
                    <li key={c.id} className={"corrida-cav" + (chegou === 0 ? " ganhou" : "")}>
                      <span className={`corrida-num raia-${i + 1}`}>{i + 1}</span>
                      <span className="corrida-mini">
                        <DesenhoCavalo pelagem={c.pelagem} raia={i} />
                      </span>
                      <span className="corrida-cav-info">
                        <b>
                          {c.nome}
                          {chegou >= 0 && chegou < 3 && <em className={"corrida-chegou p" + (chegou + 1)}>{ORDINAL[chegou]}</em>}
                        </b>
                        <small>{c.dono ? `de ${nomeDono(c.dono)}` : "da casa"}</small>
                        <span className="corrida-forma" aria-label={c.forma.length ? `Últimas chegadas: ${c.forma.join(", ")}` : "Estreia"}>
                          {c.forma.length ? c.forma.map((p, k) => <i key={k} className={p <= 3 ? "p" + p : undefined}>{p}</i>) : <small>estreia</small>}
                        </span>
                      </span>
                      <span className="corrida-forca" title="Favoritismo nas condições do páreo">
                        <i style={{ width: `${Math.round((forcaC / forcaMax) * 100)}%` }} />
                        <small>{Math.round(forcaC)}</small>
                      </span>
                      <span className="corrida-odds">
                        {(["vencedor", "place"] as const).map((t) => {
                          const on = escolha?.tipo === t && escolha.raia === i;
                          return (
                            <button key={t} type="button" className={"corrida-odd" + (on ? " on" : "")} aria-pressed={on} disabled={f !== "apostas"} onClick={() => setEscolha(on ? null : { tipo: t, raia: i, raia2: null })}>
                              <small>{t === "vencedor" ? "Vencedor" : "Placê"}</small>
                              {textoOdd(t === "vencedor" ? c.oddV : c.oddP)}
                            </button>
                          );
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="block corrida-bilhete" aria-label="Seu bilhete">
          <h3>Seu bilhete</h3>
          {f === "apostas" && campo ? (
            <>
              <div className="corrida-exata">
                <div className="seg corrida-combo" role="radiogroup" aria-label="Exata ou trifeta">
                  {(["exata", "trifeta"] as const).map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={combo === t} className={combo === t ? "on" : undefined} onClick={() => setCombo(t)}>
                      {NOME_APOSTA[t]}
                    </button>
                  ))}
                </div>
                {Array.from({ length: COMBOS[combo] }, (_, k) => {
                  const pos = posDaEscolha(escolha);
                  return (
                    <label key={k}>
                      <span>{k + 1}º</span>
                      <select value={pos[k] ?? ""} disabled={k > 0 && pos[0] === null} onChange={(ev) => escolherPos(k, Number(ev.target.value))}>
                        <option value="" disabled>
                          escolha o cavalo
                        </option>
                        {campo.map((c, i) => (
                          <option key={c.id} value={i}>
                            {i + 1}. {c.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
              <div className={"corrida-escolha" + (escolha ? " on" : "")}>
                {escolha ? (
                  <>
                    <b>{descreve(escolha)}</b>
                    <small>{DICA_APOSTA[escolha.tipo]}</small>
                    {odd !== undefined && <span className="corrida-escolha-odd">{textoOdd(odd)}</span>}
                  </>
                ) : (
                  <span className="hint">Toque numa cotação do programa ou monte a exata ou a trifeta aqui em cima.</span>
                )}
              </div>
              <ValorAposta valor={valor} onValor={setValor} saldo={saldo ?? undefined} disabled={indo} />
              <button type="button" className={"btn corrida-apostar" + (sure ? " sure" : "")} disabled={!pronta || indo} onClick={() => void apostar()}>
                {sure ? "Confirmar" : pronta && odd !== undefined ? `Apostar ${formatarMoedas(valor)} · paga ${formatarMoedas(retorno(valor, odd))}` : "Apostar"}
              </button>
            </>
          ) : (
            <p className="corrida-fechado">
              {f === "inscricoes" ? `As apostas abrem em ${Math.ceil(falta / 1000)} s.` : f === "correndo" ? "Apostas fechadas: os cavalos estão na pista." : "Páreo encerrado. O próximo abre já."}
            </p>
          )}
          {e.minhas.length > 0 && (
            <div className="corrida-minhas">
              <h4>Minhas apostas neste páreo</h4>
              <ul>
                {e.minhas.map((a, k) => {
                  const res = a.pagou !== null ? (a.pagou > 0 ? "ganhou" : "perdeu") : e.ordem && f === "fim" ? (ganhou(a.tipo, a.raia, a.raia2, e.ordem, a.raia3) ? "ganhou" : "perdeu") : null;
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
            </div>
          )}
        </aside>
      </div>

      {e.ultimas.length > 0 && (
        <section className="corrida-ultimas" aria-label="Últimos vencedores">
          <h4>Últimos vencedores</h4>
          <ul>
            {e.ultimas.map((u) => (
              <li key={u.id} title={`Páreo ${u.id}`}>
                <span className="corrida-mini">
                  <DesenhoCavalo pelagem={u.pelagem} semJoquei />
                </span>
                <span>
                  <b>{u.nome}</b>
                  <small>Páreo {u.id}</small>
                </span>
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
          <li>Vencedor: o cavalo chega em 1º. Placê: em 1º ou 2º. Exata: o 1º e o 2º na ordem certa. Trifeta: o 1º, o 2º e o 3º na ordem certa. Até 10 apostas por páreo; a casa leva cerca de 10%.</li>
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
