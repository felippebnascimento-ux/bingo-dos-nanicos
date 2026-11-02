"use client";
import { Fragment, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useSure } from "@/components/ui/useSure";
import { friendOf, useApp } from "@/lib/store";
import { TR_ENV, TR_TRUCO, trOpcoes, trValido, type Carta as TCarta, type MesaPub } from "./engine";
import { Carta, Costas } from "./Carta";
import { fecharMesa, levantar, meuLugar, revanche, trEnviar, trNaMesa, useTruco, voltarAoLobby } from "./mesa";

/** As minhas cartas. A que eu cliquei sobe na hora ("indo") até o servidor devolver a mão nova; se ele recusar, desce. */
function MinhaMao({ cartas, pode }: { cartas: TCarta[]; pode: boolean }) {
  const [indo, setIndo] = useState<string | null>(null);
  return (
    <>
      {cartas.map((c) => (
        <Carta
          key={c}
          c={c}
          botao
          indo={indo === c}
          onClick={
            pode
              ? () => {
                  setIndo(c);
                  void trEnviar("jogar", c).then((ok) => {
                    if (!ok) setIndo(null);
                  });
                }
              : undefined
          }
        />
      ))}
    </>
  );
}

/** A mesa aberta: lugares em volta do pano, cartas no meio, minha mão e as ações embaixo. */
export function MesaTela({ m }: { m: MesaPub }) {
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const mao = useTruco((s) => s.mao);
  const minhaId = useTruco((s) => s.minhaId);
  const falas = useTruco((s) => s.falas);
  const novas = useTruco((s) => s.novas);
  const mazo = useSure(3000);
  const fechar = useSure(3000);

  const N = m.modo, h = m.h, souHost = minhaId === m.id;
  const eu = meuLugar(m, myUid), base = eu >= 0 ? eu : 0;
  /* eu sempre embaixo (sul); quem assiste vê do lugar 0 */
  const pos = (i: number) => {
    const r = (i - base + N) % N;
    return N === 2 ? (r === 0 ? "sul" : "norte") : ["sul", "leste", "norte", "oeste"][r];
  };
  const meuTime = eu >= 0 ? eu % 2 : 0;
  const nome = (i: number) => m.lugares[i]?.nome || "?";
  const nomeT = (t: number) => (N === 2 ? nome(t) : `${nome(t)} e ${nome(t + 2)}`);
  const rotulo = (t: number) => (eu >= 0 ? (t === meuTime ? "Nós" : "Eles") : nomeT(t));
  const op = eu >= 0 && h ? trOpcoes(m, eu) : null;
  const minhas = eu >= 0 && h && mao && mao.id === m.id && mao.n === h.n ? mao.cartas : [];
  const naMesa = h ? trNaMesa(h) : null;
  const pode = !!op?.jogar && !!h && !h.fim;

  const lugar = (i: number) => {
    const l = m.lugares[i], p = pos(i);
    if (!l)
      return (
        <div key={i} className={`tr-lugar ${p} vazio`}>
          {m.fase === "espera" && eu < 0 ? (
            <button className="btn sm" type="button" onClick={() => trEnviar("sentar", i)}>
              Sentar aqui
            </button>
          ) : (
            <span className="status">Lugar livre</span>
          )}
        </div>
      );
    const vez = !!h && !h.fim && h.vez === i && !h.truco.pend && h.env.st !== "pend";
    const nc = h ? (h.nc[i] ?? 0) : 0;
    const sobra = h && h.fim && h.sobra && i !== eu ? (h.sobra[i] || []).filter(trValido) : [];
    return (
      <div key={i} className={`tr-lugar ${p}${vez ? " vez" : ""}${i === eu ? " eu" : ""}`}>
        {falas[i] ? <span className="tr-fala">{falas[i]}</span> : null}
        <div className="tr-id">
          <Avatar f={friendOf(l.fid, friends) || { name: l.nome }} />
          <span className="nm">{i === eu ? "Você" : l.nome}</span>
          {h && h.mano === i ? (
            <span className="tr-tag" title="Mão: começa a rodada e ganha os empates">
              mão
            </span>
          ) : null}
        </div>
        {i !== eu && h ? (
          <div className="tr-costas">
            {sobra.length ? sobra.map((c) => <Carta key={c} c={c} peq />) : <Costas n={nc} />}
          </div>
        ) : null}
      </div>
    );
  };

  const centro = () => {
    if (m.fase === "espera")
      return (
        <div className="tr-msg">
          <b>Esperando a turma</b>
          <span>
            {m.lugares.filter(Boolean).length} de {N} sentados
          </span>
          {souHost && m.lugares.every(Boolean) ? (
            <button className="btn" type="button" id="trComecar" onClick={() => trEnviar("comecar")}>
              Começar
            </button>
          ) : null}
        </div>
      );
    if (m.fase === "fim") {
      const v = m.vencedor ?? 0;
      return (
        <div className="tr-msg fim">
          <b>
            {rotulo(v)} {eu >= 0 && v === meuTime ? "ganhamos!" : "ganharam."}
          </b>
          <span>
            {m.placar[v]} a {m.placar[1 - v]}
          </span>
          {souHost ? (
            <button className="btn" type="button" id="trRevanche" onClick={revanche}>
              Jogar de novo
            </button>
          ) : (
            <span className="status">O {m.lugares[0]?.nome || "anfitrião"} pode começar outra.</span>
          )}
        </div>
      );
    }
    if (!h || !naMesa) return null;
    return (
      <>
        {naMesa.cartas.map((x) => (
          <div key={`${h.n}:${x.c}`} className={`tr-jogada ${pos(x.s)}${novas.includes(x.c) ? " novo" : ""}`}>
            <Carta c={x.c} ganha={naMesa.vence !== null && naMesa.por === x.s} />
          </div>
        ))}
        {h.fim ? (
          <div className="tr-msg mini">
            <b>{h.fim.motivo}</b>
            <span>
              +{h.fim.pontos} para {rotulo(h.fim.team)}
            </span>
          </div>
        ) : null}
      </>
    );
  };

  /* pergunta para o meu time (truco ou envido esperando resposta) */
  let pergunta = null;
  if (op?.quero && h) {
    const ep = h.env.st === "pend";
    const quem = ep ? h.env.por : (h.truco.pend?.por ?? null);
    const oque = ep ? h.env.apostas.map((k) => TR_ENV[k]).join(" + ") : TR_TRUCO[h.truco.pend?.nivel ?? 2];
    pergunta = (
      <div className="tr-pergunta" role="alert">
        <b>
          {quem !== null ? m.lugares[quem]?.nome || "" : ""} pediu {oque}
        </b>
        <div className="tr-acoes">
          <button className="btn" type="button" onClick={() => trEnviar("quero")}>
            Quero
          </button>
          <button className="btn soft" type="button" onClick={() => trEnviar("naoquero")}>
            Não quero
          </button>
          {op.truco && !ep ? (
            <button className="btn tr-cant" type="button" onClick={() => trEnviar("truco")}>
              {TR_TRUCO[op.truco]}!
            </button>
          ) : null}
          {op.envido.map((k) => (
            <button key={k} className="btn tr-cant" type="button" onClick={() => trEnviar("envido", k)}>
              {TR_ENV[k]}!
            </button>
          ))}
        </div>
      </div>
    );
  }

  const acoes =
    op && !op.quero && op.jogar ? (
      <div className="tr-acoes">
        {op.truco ? (
          <button className="btn tr-cant" type="button" onClick={() => trEnviar("truco")}>
            {TR_TRUCO[op.truco]}!
          </button>
        ) : null}
        {op.envido.map((k) => (
          <button key={k} className="btn soft" type="button" onClick={() => trEnviar("envido", k)}>
            {TR_ENV[k]}
          </button>
        ))}
      </div>
    ) : null;

  const esperando =
    h && !h.fim && op && !op.jogar && !op.quero ? (
      <span className="status">
        {h.truco.pend || h.env.st === "pend" ? "Esperando a resposta…" : `Vez de ${m.lugares[h.vez]?.nome || ""}`}
      </span>
    ) : null;

  const times = eu >= 0 && meuTime === 1 ? [1, 0] : [0, 1];

  return (
    <div className="tr-mesa">
      <div className="tr-top">
        <button className="btn soft sm" type="button" id="trVoltar" onClick={voltarAoLobby}>
          Mesas
        </button>
        <div className="tr-placar">
          {times.map((t, k) => (
            <Fragment key={t}>
              {k === 1 ? <span className="tr-alvo">até {m.alvo}</span> : null}
              <div className={"tr-time" + (eu >= 0 && t === meuTime ? " nos" : "")}>
                <span>{rotulo(t)}</span>
                <b>{m.placar[t]}</b>
              </div>
            </Fragment>
          ))}
        </div>
        <div className="tr-top-d">
          {h && m.fase === "jogo" && h.truco.valor > 1 ? <span className="tr-valendo">Valendo {h.truco.valor}</span> : null}
          <span className="tr-vazas">
            {h
              ? h.vazas
                  .filter((v) => v.vence !== null)
                  .map((v, k) => (
                    <i
                      key={k}
                      className={`tr-pip ${v.vence === -1 ? "parda" : v.vence === meuTime ? "nos" : "eles"}`}
                      title={v.vence === -1 ? "Parda" : rotulo(v.vence!)}
                    />
                  ))
              : null}
          </span>
          {souHost ? (
            <button
              className={"btn soft sm" + (fechar.sure ? " sure" : "")}
              type="button"
              id="trFechar"
              onClick={() => fechar.pedir() && fecharMesa()}
            >
              {fechar.sure ? "Confirmar: fechar" : "Fechar mesa"}
            </button>
          ) : eu >= 0 && m.fase === "espera" ? (
            <button className="btn soft sm" type="button" id="trLevantar" onClick={levantar}>
              Levantar
            </button>
          ) : null}
        </div>
      </div>
      <div className={`tr-feltro n${N}`}>
        {m.lugares.map((_, i) => lugar(i))}
        <div className="tr-centro">{centro()}</div>
      </div>
      {eu >= 0 && h && m.fase === "jogo" ? (
        <div className="tr-eu">
          {pergunta}
          <div className={"tr-mao" + (pode ? " pode" : "")}>
            {minhas.length ? (
              <MinhaMao key={`${h.n}:${minhas.join()}`} cartas={minhas} pode={pode} />
            ) : h.fim ? null : (
              <span className="status">Carregando suas cartas…</span>
            )}
          </div>
          <div className="tr-rodape">
            {pode ? <span className="tr-sua">Sua vez</span> : esperando}
            {acoes}
            {op?.mazo ? (
              <button
                className={"linkish" + (mazo.sure ? " sure" : "")}
                type="button"
                onClick={() => mazo.pedir() && trEnviar("mazo")}
              >
                {mazo.sure ? "Confirmar: ir ao mazo" : "Ir ao mazo"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <ol className="tr-log">
        {(m.log || []).slice(-4).map((t, k) => (
          <li key={k}>{String(t).slice(0, 120)}</li>
        ))}
      </ol>
    </div>
  );
}
