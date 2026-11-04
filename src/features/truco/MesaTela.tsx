"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSure } from "@/components/ui/useSure";
import { friendOf, useApp } from "@/lib/store";
import { TR_ENV, TR_TEMPO_MS, TR_TRUCO, trOpcoes, trQuemDeve, trValido, type Carta as TCarta, type MesaPub } from "./engine";
import { Carta, Costas } from "./Carta";
import { fecharMesa, fimDaJogada, garantirTempo, levantar, meuLugar, revanche, trCartasDaMao, trEnviar, useTruco, voltarAoLobby } from "./mesa";
import { ApostarTruco } from "./ApostarTruco";
import { Lugar, Mesa, NaMesa } from "@/features/mesa/Pecas";
import { BarraJogo, BarraTempo } from "@/features/mesa/Painel";
import { useCarteira } from "@/lib/carteira";

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

/** Quanto falta do tempo da jogada (de 0 a 1), para o anel do lugar de quem está na vez. */
function useFalta(fim: number | null) {
  const [agora, setAgora] = useState(() => Date.now());
  const fimRef = useRef(fim);
  useEffect(() => { fimRef.current = fim; });
  useEffect(() => {
    const t = setInterval(() => {
      if (fimRef.current !== null && !document.hidden) setAgora(Date.now());
    }, 250);
    return () => clearInterval(t);
  }, []);
  return fim === null ? null : Math.max(0, Math.min(1, (fim - agora) / TR_TEMPO_MS));
}

type Pos = "sul" | "leste" | "norte" | "oeste";
/* onde fica cada lugar na mesa oval (em % da mesa) e para que lado a carta jogada vai, a partir do meio */
const LUGAR_XY: Record<Pos, [number, number]> = { norte: [50, 12], oeste: [12, 46], leste: [88, 46], sul: [19, 84] };
const JOGADA_XY: Record<Pos, [number, number, number]> = { norte: [50, 34, -4], oeste: [31, 47, -8], leste: [69, 47, 7], sul: [50, 62, 3] };
/* as cartas da mão ficam na mesa: cada vaza um passo, em fileira na frente de quem está em cima ou embaixo e em coluna nos lados */
const VAZA_PASSO: Record<Pos, [number, number]> = { norte: [8, 0], oeste: [0, 8], leste: [0, 8], sul: [8, 0] };

/** Os tentos em palitinhos, como no placar de papel (um por ponto, até o alvo). */
function Tentos({ n, alvo }: { n: number; alvo: number }) {
  return (
    <span className="tr-tentos" aria-hidden="true">
      {Array.from({ length: alvo }, (_, i) => (
        <i key={i} className={i < n ? "" : "v"} />
      ))}
    </span>
  );
}

const REGRAS: ReactNode = (
  <>
    <p>Truco gaudério com o baralho espanhol: 3 cartas, a melhor de 3 vazas leva a mão. Espadão, bastião, 7 de espada e 7 de ouro mandam.</p>
    <p>Truco vale 2, retruco 3 e vale-quatro 4. Envido, real envido e falta envido valem antes da primeira vaza acabar.</p>
    <p>20 s por jogada: acabou o tempo, a mesa joga por você. Ganha quem chegar primeiro ao alvo.</p>
  </>
);

/** A mesa aberta, no padrão das mesas de cartas: lugares em volta da mesa oval, cartas no meio, minha mão embaixo. */
export function MesaTela({ m }: { m: MesaPub }) {
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const mao = useTruco((s) => s.mao);
  const minhaId = useTruco((s) => s.minhaId);
  const falas = useTruco((s) => s.falas);
  const novas = useTruco((s) => s.novas);
  const valor = useTruco((s) => s.valores[m.id] ?? 0);
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const mazo = useSure(3000);
  const fechar = useSure(3000);

  const N = m.modo, h = m.h, souHost = minhaId === m.id;
  const eu = meuLugar(m, myUid), base = eu >= 0 ? eu : 0;
  /* eu sempre embaixo (sul); quem assiste vê do lugar 0 */
  const pos = (i: number): Pos => {
    const r = (i - base + N) % N;
    return N === 2 ? (r === 0 ? "sul" : "norte") : (["sul", "leste", "norte", "oeste"] as const)[r];
  };
  const meuTime = eu >= 0 ? eu % 2 : 0;
  const nome = (i: number) => m.lugares[i]?.nome || "?";
  const nomeT = (t: number) => (N === 2 ? nome(t) : `${nome(t)} e ${nome(t + 2)}`);
  const rotulo = (t: number) => (eu >= 0 ? (t === meuTime ? "Nós" : "Eles") : nomeT(t));
  const op = eu >= 0 && h ? trOpcoes(m, eu) : null;
  const minhas = eu >= 0 && h && mao && mao.id === m.id && mao.n === h.n ? mao.cartas : [];
  const pode = !!op?.jogar && !!h && !h.fim;
  /* o relógio de 20 s: de quem é a vez de agir e até quando */
  const fim = fimDaJogada(m);
  const deve = fim !== null ? trQuemDeve(m) : null;
  const falta = useFalta(fim);
  useEffect(() => {
    if (fim !== null && eu >= 0) garantirTempo(m.id);
  }, [fim, eu, m.id]);

  const lugar = (i: number) => {
    const l = m.lugares[i], p = pos(i);
    const [x, y] = LUGAR_XY[p];
    if (!l)
      return (
        <NaMesa key={i} x={x} y={y}>
          {m.fase === "espera" && eu < 0 ? (
            <button className="btn sm" type="button" onClick={() => trEnviar("sentar", i)}>
              Sentar aqui
            </button>
          ) : (
            <span className="mesa-aviso">Lugar livre</span>
          )}
        </NaMesa>
      );
    const nc = h ? (h.nc[i] ?? 0) : 0;
    const sobra = h && h.fim && h.sobra && i !== eu ? (h.sobra[i] || []).filter(trValido) : [];
    const naVez = fim !== null && deve === i;
    const parceiro = N === 4 && eu >= 0 && i !== eu && i % 2 === meuTime;
    const info = naVez ? `na vez · ${Math.ceil(((falta ?? 0) * TR_TEMPO_MS) / 1000)} s` : h && h.mano === i ? "mão" : parceiro ? "parceiro" : undefined;
    return (
      <NaMesa key={i} x={x} y={y} className={"tr-lugar-mesa " + p}>
        <Lugar f={friendOf(l.fid, friends) || { name: l.nome }} nome={i === eu ? "Você" : l.nome} info={info} vez={naVez ? falta : null} fala={falas[i] || undefined} eu={i === eu} />
        {i !== eu && h ? (
          <span className="mesa-leque pequeno">{sobra.length ? sobra.map((c) => <Carta key={c} c={c} peq />) : <Costas n={nc} />}</span>
        ) : null}
      </NaMesa>
    );
  };

  const centro = () => {
    if (m.fase === "espera")
      return (
        <NaMesa x={50} y={47}>
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
        </NaMesa>
      );
    if (m.fase === "fim") {
      const v = m.vencedor ?? 0;
      return (
        <NaMesa x={50} y={47}>
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
        </NaMesa>
      );
    }
    if (!h) return null;
    return (
      <>
        {trCartasDaMao(h).map((x) => {
          const p = pos(x.s);
          const [cx, cy, giro] = JOGADA_XY[p];
          const [dx, dy] = VAZA_PASSO[p];
          return (
            <NaMesa
              key={`${h.n}:${x.c}`}
              x={cx + dx * (x.vaza - 1)}
              y={cy + dy * (x.vaza - 1)}
              className={"tr-jogada" + (x.passou ? " passou" : "") + (novas.includes(x.c) ? " novo" : "")}
              style={{ rotate: `${giro}deg` }}
            >
              <Carta c={x.c} ganha={x.ganha} />
            </NaMesa>
          );
        })}
        {h.fim ? (
          <NaMesa x={50} y={47}>
            <div className="tr-msg mini">
              <b>{h.fim.motivo}</b>
              <span>
                +{h.fim.pontos} para {rotulo(h.fim.team)}
              </span>
            </div>
          </NaMesa>
        ) : null}
      </>
    );
  };

  /* pergunta para o meu time (truco ou envido esperando resposta): no meio da mesa e, no celular, no painel de baixo */
  let pergunta: { quem: string; oque: string; botoes: ReactNode } | null = null;
  if (op?.quero && h) {
    const ep = h.env.st === "pend";
    const quem = ep ? h.env.por : (h.truco.pend?.por ?? null);
    const oque = ep ? h.env.apostas.map((k) => TR_ENV[k]).join(" + ") : TR_TRUCO[h.truco.pend?.nivel ?? 2];
    pergunta = {
      quem: quem !== null ? m.lugares[quem]?.nome || "" : "",
      oque,
      botoes: (
        <>
          <button className="mesa-pill verde" type="button" onClick={() => trEnviar("quero")}>
            QUERO
          </button>
          <button className="mesa-pill cinza" type="button" onClick={() => trEnviar("naoquero")}>
            NÃO QUERO
          </button>
          {op.truco && !ep ? (
            <button className="mesa-pill ouro" type="button" onClick={() => trEnviar("truco")}>
              {TR_TRUCO[op.truco].toUpperCase()}!
            </button>
          ) : null}
          {op.envido.map((k) => (
            <button key={k} className="mesa-pill ouro" type="button" onClick={() => trEnviar("envido", k)}>
              {TR_ENV[k].toUpperCase()}!
            </button>
          ))}
        </>
      ),
    };
  }

  const esperando =
    h && !h.fim && op && !op.jogar && !op.quero ? (h.truco.pend || h.env.st === "pend" ? "Esperando a resposta…" : `Vez de ${m.lugares[h.vez]?.nome || ""}`) : null;
  const meuSeg = fim !== null && deve === eu ? Math.ceil(((falta ?? 0) * TR_TEMPO_MS) / 1000) : null;

  const times = eu >= 0 && meuTime === 1 ? [1, 0] : [0, 1];
  const vazas = h ? h.vazas.filter((v) => v.vence !== null) : [];

  return (
    <div className="mesa-jogo tr-mesa">
      <BarraJogo
        voltar={
          <button className="mesa-voltar" type="button" id="trVoltar" onClick={voltarAoLobby} aria-label="Voltar às mesas">
            ←
          </button>
        }
        icone="T"
        nome="Truco gaudério"
        sub={`${N === 4 ? "2 contra 2" : "1 contra 1"} · até ${m.alvo}${valor > 0 ? ` · bolo de ${valor * N}` : ""}`}
        falta={fim !== null ? falta : null}
        urgente={falta !== null && falta < 0.25}
        carteira={saldo}
        naMesa={valor > 0 && eu >= 0 ? valor : null}
        regras={REGRAS}
        centro={
          <div className="tr-placar">
            {times.map((t) => (
              <div key={t} className={"tr-time" + (eu >= 0 && t === meuTime ? " nos" : "")}>
                <b>{m.placar[t]}</b>
                <small>{rotulo(t)}</small>
                <Tentos n={m.placar[t]} alvo={m.alvo} />
              </div>
            ))}
            {h && m.fase === "jogo" && h.truco.valor > 1 ? (
              <div className="tr-valendo">
                <small>Valendo</small>
                <b>{h.truco.valor}</b>
              </div>
            ) : null}
          </div>
        }
      />
      <div className="tr-linha">
        <span className="mesa-hist">
          {vazas.length > 0 ? (
            <>
              <span>Vazas desta mão:</span>
              <span className="tr-vazas" aria-label="Vazas desta mão">
                {vazas.map((v, k) => (
                  <i key={k} className={`tr-pip ${v.vence === -1 ? "parda" : v.vence === meuTime ? "nos" : "eles"}`} title={v.vence === -1 ? "Parda" : rotulo(v.vence!)} />
                ))}
              </span>
            </>
          ) : (
            <span>{m.fase === "jogo" ? "Primeira vaza da mão" : m.fase === "espera" ? "Esperando a turma sentar" : "Partida encerrada"}</span>
          )}
        </span>
        {souHost ? (
          <button className={"btn soft sm" + (fechar.sure ? " sure" : "")} type="button" id="trFechar" onClick={() => fechar.pedir() && fecharMesa()}>
            {fechar.sure ? "Confirmar: fechar" : "Fechar mesa"}
          </button>
        ) : eu >= 0 && m.fase === "espera" ? (
          <button className="btn soft sm" type="button" id="trLevantar" onClick={levantar}>
            Levantar
          </button>
        ) : null}
      </div>
      <Mesa marca="Truco gaudério" className={`tr-mesa-oval n${N}`}>
        {m.lugares.map((_, i) => lugar(i))}
        {centro()}
        {pergunta ? (
          <NaMesa x={50} y={47} className="tr-pedido-pc">
            <div className="tr-pedido" role="alert">
              <small>{pergunta.quem} pediu</small>
              <b>{pergunta.oque.toUpperCase()}!</b>
              <div className="mesa-linha">{pergunta.botoes}</div>
              {falta !== null && <BarraTempo falta={falta} urgente={falta < 0.3} />}
            </div>
          </NaMesa>
        ) : null}
        {/* a minha mão, grande, na beira da mesa do meu lado */}
        {eu >= 0 && h && m.fase === "jogo" ? (
          <NaMesa x={50} y={86} className="tr-minha">
            <div className={"tr-mao mesa-leque abre" + (pode ? " pode" : "")}>
              {minhas.length ? (
                <MinhaMao key={`${h.n}:${minhas.join()}`} cartas={minhas} pode={pode} />
              ) : h.fim ? null : (
                <span className="mesa-aviso">Carregando suas cartas…</span>
              )}
            </div>
          </NaMesa>
        ) : null}
      </Mesa>
      {eu >= 0 && h && m.fase === "jogo" ? (
        pergunta ? (
          <div className="mesa-painel urgente tr-pedido-cel" role="alert">
            <div className="mesa-linha">
              <b className="tr-pedido-tit">
                {pergunta.quem} pediu {pergunta.oque}!
              </b>
              {meuSeg !== null || falta !== null ? <span className="mesa-tempo">{Math.ceil(((falta ?? 0) * TR_TEMPO_MS) / 1000)} s</span> : null}
            </div>
            <div className="mesa-linha">{pergunta.botoes}</div>
          </div>
        ) : (
          <div className={"mesa-painel" + (pode ? " minha-vez" + ((falta ?? 1) < 0.25 ? " urgente" : "") : "")} key={pode ? "vez" : "espera"}>
            <div className="mesa-linha">
              {op && !op.quero && op.jogar && op.truco ? (
                <button className="mesa-pill verm grande" type="button" onClick={() => trEnviar("truco")}>
                  {TR_TRUCO[op.truco].toUpperCase()}!
                </button>
              ) : null}
              {op && !op.quero && op.jogar
                ? op.envido.map((k) => (
                    <button key={k} className="mesa-pill cinza" type="button" onClick={() => trEnviar("envido", k)}>
                      {TR_ENV[k].toUpperCase()}
                    </button>
                  ))
                : null}
              {op?.mazo ? (
                <button className={"mesa-pill cinza" + (mazo.sure ? " sure" : "")} type="button" onClick={() => mazo.pedir() && trEnviar("mazo")}>
                  {mazo.sure ? "CONFIRMAR" : "IR AO MAZO"}
                </button>
              ) : null}
            </div>
            <div className="mesa-linha dica">{pode ? `Sua vez · ${meuSeg ?? "—"} s · toque numa carta para jogar` : (esperando ?? "")}</div>
          </div>
        )
      ) : null}
      <ApostarTruco m={m} rotulo={nomeT} />
      <ol className="tr-log">
        {(m.log || []).slice(-4).map((t, k) => (
          <li key={k}>{String(t).slice(0, 120)}</li>
        ))}
      </ol>
    </div>
  );
}
