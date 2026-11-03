"use client";
/*
 * Pôquer Texas Hold'em entre nanicos, na mesa oval (o padrão das mesas de cartas): o salão com as mesas abertas e,
 * dentro de uma, até 6 lugares em volta (eu sempre embaixo), o botão do dealer, as apostas de cada um, o pote e as
 * cartas da mesa no meio, as minhas cartas grandes e a barra de baixo (sentar, ou jogar a vez: desistir, passar,
 * pagar, aumentar com ½ pote, ¾ pote, pote e all-in). Quem embaralha, confere e paga é o banco (seção 44).
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { formatarMoedas } from "@/lib/moedas";
import { useCarteira } from "@/lib/carteira";
import { Avatar } from "@/components/ui/Avatar";
import { CartaFrancesa } from "@/features/mesa/CartaFrancesa";
import { BotaoDealer, Lugar, Mesa, NaMesa, Pilha } from "@/features/mesa/Pecas";
import {
  baralhoPk,
  BLINDS,
  carta,
  compraMax,
  compraMin,
  hashBate,
  LUGARES_PK,
  melhor,
  nomeDaMao,
  nomeParcial,
  opcoesPk,
  sugestoes,
  TEMPO_VEZ_PK_MS,
  type FasePk,
} from "./pkRegras";
import { usePoquer } from "./pkDados";

/* onde fica cada lugar na mesa, contando a partir de mim (0 = eu, embaixo à esquerda), e para onde vai a aposta */
const LUGAR_XY: [number, number][] = [[24, 86], [8, 50], [28, 13], [72, 13], [92, 50], [76, 86]];
const APOSTA_XY: [number, number][] = [[31, 68], [22, 50], [34, 31], [66, 31], [78, 50], [69, 68]];
const DEALER_XY: [number, number][] = [[38, 72], [21, 38], [42, 25], [58, 25], [79, 62], [62, 74]];
const NOME_FASE: Record<FasePk, string> = { preflop: "Pré-flop", flop: "Flop", turn: "Turn", river: "River", fim: "Fim da mão" };
const fmt = (n: number) => n.toLocaleString("pt-BR");

/** O relógio do banco, andando de 1/4 em 1/4 de segundo (para as contagens). */
function useAgora(agoraBanco: () => number) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(agoraBanco()), 250);
    return () => clearInterval(t);
  }, [agoraBanco]);
  return agora;
}

function Carta({ c, className = "", ganha }: { c: string | null; className?: string; ganha?: boolean }) {
  const k = c ? carta(c) : null;
  return <CartaFrancesa v={k?.v} n={k?.n} costas={!k} className={className} ganha={ganha} />;
}

/* ---------- o salão: mesas abertas e abrir uma ---------- */
function Salao({ p }: { p: ReturnType<typeof usePoquer> }) {
  const friends = useApp((s) => s.friends);
  const eu = useApp((s) => s.myUid);
  const [blind, setBlind] = useState<number>(20);
  const rosto = (uid: string) => friends.find((f) => f.user_id === uid);
  const minha = p.lista.find((m) => m.criadaPor === eu);
  return (
    <div className="pk-salao">
      <div className="mesa-topo">
        <div className="mesa-topo-grupo">
          <span className="mesa-selo ouro">Texas Hold&apos;em</span>
          <span className="mesa-selo">Até 6 por mesa</span>
        </div>
        <div className="mesa-topo-grupo">
          <span className="mesa-selo">Casa 3% (só do flop em diante)</span>
        </div>
      </div>
      {p.lista.length > 0 ? (
        <ul className="pk-mesas">
          {p.lista.map((m) => (
            <li key={m.id}>
              <button type="button" className="pk-mesa-cartao" onClick={() => p.irPara(m.id)}>
                <span className="pk-mesa-feltro" aria-hidden="true">
                  {m.lugares.map((l) => (
                    <Avatar key={l.lugar} f={rosto(l.userId) ?? null} size="xs" />
                  ))}
                </span>
                <span className="pk-mesa-info">
                  <b>
                    Blinds {m.blind / 2} / {m.blind}
                  </b>
                  <small>
                    {m.lugares.length} de {LUGARES_PK} · {m.emJogo ? "mão em andamento" : "esperando jogadores"}
                  </small>
                </span>
                <span className="btn soft sm">Ver mesa</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint pk-vazio">Nenhuma mesa aberta. Abra uma e chame a turma.</p>
      )}
      {!minha && (
        <div className="mesa-acoes">
          <div className="seg three pk-blinds" role="radiogroup" aria-label="Blinds da mesa">
            {BLINDS.map((b) => (
              <button key={b} type="button" role="radio" aria-checked={blind === b} onClick={() => setBlind(b)}>
                {b / 2} / {b}
              </button>
            ))}
          </div>
          <button className="mesa-bt ouro" type="button" disabled={p.enviando} onClick={() => void p.abrir(blind)}>
            Abrir mesa<small>senta com {fmt(compraMin(blind))} a {fmt(compraMax(blind))}</small>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- a mesa ---------- */
export function Poquer({ ativa = true }: { ativa?: boolean }) {
  const p = usePoquer(ativa);
  const agora = useAgora(p.agoraBanco);
  const friends = useApp((s) => s.friends);
  const eu = useApp((s) => s.myUid);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? 0);
  const [sentarEm, setSentarEm] = useState<number | null>(null);
  const [compra, setCompra] = useState(0);
  const [aumento, setAumento] = useState<{ mao: number; fase: FasePk; valor: number } | null>(null);
  const [conferencia, setConferencia] = useState<string | null>(null);

  if (p.ligada === false) return <p className="block hint">O pôquer ainda não foi ligado no banco (seção 44 do seguranca.sql).</p>;
  if (!p.mesa) return <Salao p={p} />;
  const e = p.estado;
  if (!e) return <p className="hint pk-vazio">Abrindo a mesa…</p>;

  const bb = e.mesa.blind;
  const h = e.mao;
  const rosto = (uid: string) => friends.find((f) => f.user_id === uid);
  const nome = (uid: string) => (uid === eu ? "Você" : (rosto(uid)?.name ?? "Nanico"));
  const meu = e.lugares.find((l) => l.userId === eu);
  const base = meu?.lugar ?? 1;
  const visual = (lugar: number) => (lugar - base + LUGARES_PK) % LUGARES_PK;
  const jog = (lugar: number) => h?.jogadores.find((j) => j.lugar === lugar);
  const fim = h?.fase === "fim";
  const vezJ = h && !fim && h.vez != null ? jog(h.vez) : undefined;
  const minhaVez = !!vezJ && vezJ.userId === eu;
  const seg = h?.vezAte && !fim ? Math.max(0, Math.ceil((h.vezAte - agora) / 1000)) : null;
  const eu_j = meu ? jog(meu.lugar) : undefined;

  /* no showdown: as cartas de quem chegou e as 5 que fizeram a mão de quem ganhou */
  const mostradas = new Map((h?.mostradas ?? []).filter((m) => m.cartas).map((m) => [m.lugar, m]));
  const vencedores = new Set((h?.mostradas ?? []).filter((m) => m.ganhou > 0).map((m) => m.lugar));
  const acesas = new Set<string>();
  if (fim && h?.showdown)
    for (const l of vencedores) {
      const m = mostradas.get(l);
      if (m?.cartas) melhor([...m.cartas, ...h.mesa])?.cartas.forEach((c) => acesas.add(c));
    }
  const minhaMao = h && eu_j && h.minhas.length ? nomeParcial(h.minhas, h.mesa) : null;

  const op = minhaVez && h && meu ? opcoesPk(h, meu.fichas, meu.lugar) : null;
  const sug = op && h ? sugestoes(h, op) : [];
  /* o valor do aumento vale só para esta rodada; de resto começa no mínimo */
  const alvo = op ? Math.max(op.min, Math.min(op.max, aumento && aumento.mao === h?.id && aumento.fase === h?.fase ? aumento.valor : op.min)) : 0;
  const mudarAlvo = (v: number) => h && setAumento({ mao: h.id, fase: h.fase, valor: v });

  const aviso = !h
    ? e.lugares.length < 2
      ? "Esperando mais um nanico para começar"
      : "A mão já vai começar"
    : fim
      ? h.showdown
        ? (() => {
            const g = [...vencedores].map((l) => jog(l)).filter(Boolean);
            const v = g[0] ? mostradas.get(g[0].lugar)?.valor : null;
            return `${g.map((j) => nome(j!.userId)).join(" e ")} ${g.length > 1 ? "dividem" : "leva"}${v ? ` com ${nomeDaMao(v).toLowerCase()}` : ""}`;
          })()
        : `${[...vencedores].map((l) => nome(jog(l)?.userId ?? "")).join(" e ")} leva: os outros desistiram`
      : `${NOME_FASE[h.fase]} · ${vezJ ? (minhaVez ? "sua vez" : `vez de ${nome(vezJ.userId)}`) : "abrindo as cartas"}`;

  const sentar = async () => {
    if (sentarEm == null) return;
    const ok = await p.sentar(sentarEm, compra);
    if (ok) setSentarEm(null);
  };
  const escolherLugar = (lugar: number) => {
    setSentarEm(lugar);
    setCompra(Math.min(Math.max(compraMin(bb), Math.min(saldo, bb * 50)), compraMax(bb)));
  };
  const conferir = async () => {
    if (!h?.segredo) return;
    const ok = await hashBate(h.segredo, h.hash);
    const b = await baralhoPk(h.segredo, h.id);
    setConferencia(`${ok ? "O segredo bate com o hash mostrado no começo da mão." : "O segredo NÃO bate com o hash!"} Primeiras cartas do baralho: ${b.slice(0, 10).join(", ")}`);
  };

  return (
    <div className="pk-jogo">
      <div className="mesa-topo">
        <div className="mesa-topo-grupo">
          <button type="button" className="btn soft sm" onClick={() => p.irPara(null)}>
            ← Mesas
          </button>
          <span className="mesa-selo ouro">
            Blinds {bb / 2} / {bb}
          </span>
          {h && <span className="mesa-selo">Mão {h.id}</span>}
        </div>
        <div className="mesa-topo-grupo">
          <span className="mesa-selo">Casa 3%</span>
        </div>
      </div>
      <Mesa marca="Texas Hold'em">
        {Array.from({ length: LUGARES_PK }, (_, i) => {
          const lugar = i + 1;
          const v = visual(lugar);
          const [x, y] = LUGAR_XY[v];
          const l = e.lugares.find((q) => q.lugar === lugar);
          if (!l)
            return (
              <NaMesa key={lugar} x={x} y={y} className={"pk-v" + v}>
                {!meu ? (
                  <button type="button" className={"mesa-circulo pk-livre" + (sentarEm === lugar ? " on" : "")} onClick={() => escolherLugar(lugar)}>
                    Sentar
                  </button>
                ) : (
                  <span className="mesa-circulo pk-livre vazio" aria-label={`Lugar ${lugar} livre`} />
                )}
              </NaMesa>
            );
          const j = jog(lugar);
          const naVez = !!vezJ && vezJ.lugar === lugar;
          const m = mostradas.get(lugar);
          const ganhou = fim ? (h?.mostradas.find((q) => q.lugar === lugar)?.ganhou ?? 0) : 0;
          const souEu = l.userId === eu;
          return (
            <NaMesa key={lugar} x={x} y={y} className={"pk-lugar pk-v" + v}>
              {/* as cartas dos outros: viradas, ou abertas no showdown */}
              {!souEu && j && j.estado !== "desistiu" && (
                <span className="mesa-leque pequeno pk-cartas">
                  {m?.cartas ? m.cartas.map((c) => <Carta key={c} c={c} className="peq" ganha={acesas.has(c)} />) : [0, 1].map((k) => <Carta key={k} c={null} className="peq" />)}
                </span>
              )}
              <Lugar
                f={rosto(l.userId)}
                nome={nome(l.userId)}
                eu={souEu}
                vez={naVez && seg !== null ? seg / (TEMPO_VEZ_PK_MS / 1000) : null}
                fora={j?.estado === "desistiu" || (!j && !!h && !fim)}
                etiqueta={j?.estado === "allin" && !fim ? "ALL-IN" : l.sair ? "SAINDO" : undefined}
                fala={ganhou > 0 ? `+${fmt(ganhou)}` : undefined}
                info={naVez && seg !== null ? `${fmt(l.fichas)} · ${seg} s` : j?.estado === "desistiu" ? "desistiu" : fmt(l.fichas)}
              />
            </NaMesa>
          );
        })}
        {/* o botão e as apostas da rodada */}
        {h && (
          <NaMesa x={DEALER_XY[visual(h.botao)][0]} y={DEALER_XY[visual(h.botao)][1]} className={"pk-d" + visual(h.botao)}>
            <BotaoDealer />
          </NaMesa>
        )}
        {h &&
          !fim &&
          h.jogadores
            .filter((j) => j.naRodada > 0)
            .map((j) => {
              const v = visual(j.lugar);
              return (
                <NaMesa key={"a" + j.lugar} x={APOSTA_XY[v][0]} y={APOSTA_XY[v][1]} className={"pk-a" + v}>
                  <Pilha valor={j.naRodada} />
                </NaMesa>
              );
            })}
        {/* o meio: pote e as cartas da mesa */}
        <NaMesa x={50} y={45} className="pk-meio">
          {h && <span className="mesa-pote">Pote {fmt(h.pote - (fim ? h.rake : 0))}</span>}
          {h && (
            <div className="pk-board">
              {Array.from({ length: 5 }, (_, k) => {
                const c = h.mesa[k];
                return c ? <Carta key={k} c={c} ganha={acesas.has(c)} /> : <Carta key={k} c={null} className="vazia" />;
              })}
            </div>
          )}
          <span className="mesa-aviso" role="status">
            {aviso}
          </span>
        </NaMesa>
        {/* as minhas cartas */}
        {h && eu_j && h.minhas.length > 0 && (
          <NaMesa x={50} y={82} className="pk-minhas">
            <div className={"mesa-leque abre" + (eu_j.estado === "desistiu" ? " pk-larguei" : "")}>
              {h.minhas.map((c) => (
                <Carta key={c} c={c} className="grande" ganha={acesas.has(c) || (!fim && eu_j.estado !== "desistiu")} />
              ))}
            </div>
            {minhaMao && eu_j.estado !== "desistiu" && <span className="mesa-aviso">{minhaMao}</span>}
          </NaMesa>
        )}
      </Mesa>

      {/* a barra de baixo */}
      <div className="mesa-acoes">
        {op && h && meu ? (
          <>
            <span className="mesa-tempo">
              <b>{seg ?? "—"}</b>sua vez
            </span>
            <button className="mesa-bt verm" type="button" disabled={p.enviando} onClick={() => void p.jogar("desistir")}>
              Desistir
            </button>
            {op.passar ? (
              <button className="mesa-bt" type="button" disabled={p.enviando} onClick={() => void p.jogar("passar")}>
                Passar
              </button>
            ) : (
              <button className="mesa-bt" type="button" disabled={p.enviando} onClick={() => void p.jogar(op.pagar >= meu.fichas ? "allin" : "pagar")}>
                {op.pagar >= meu.fichas ? "All-in" : "Pagar"}
                <small>{fmt(op.pagar)}</small>
              </button>
            )}
            {op.aumentar && op.max > op.min && (
              <div className="mesa-valor">
                <div className="mesa-valor-rapido">
                  {sug.map((s) => (
                    <button key={s.nome} type="button" onClick={() => mudarAlvo(s.valor)}>
                      {s.nome}
                    </button>
                  ))}
                  <button type="button" onClick={() => mudarAlvo(op.max)}>
                    All-in
                  </button>
                </div>
                <input type="range" min={op.min} max={op.max} step={Math.max(1, bb / 2)} value={alvo} onChange={(ev) => mudarAlvo(Number(ev.target.value))} aria-label="Quanto aumentar" />
                <div className="mesa-valor-num">
                  <span>{fmt(op.min)}</span>
                  <span>{fmt(op.max)}</span>
                </div>
              </div>
            )}
            {op.aumentar && (
              <button className="mesa-bt ouro" type="button" disabled={p.enviando} onClick={() => void (alvo >= op.max ? p.jogar("allin") : p.jogar("aumentar", alvo))}>
                {alvo >= op.max ? "All-in" : h.aposta > 0 ? "Aumentar" : "Apostar"}
                <small>{alvo >= op.max ? fmt(op.max) : `para ${fmt(alvo)}`}</small>
              </button>
            )}
          </>
        ) : !meu && sentarEm != null ? (
          <>
            <div className="mesa-valor">
              <input
                type="range"
                min={compraMin(bb)}
                max={Math.max(compraMin(bb), Math.min(compraMax(bb), saldo))}
                step={bb}
                value={compra}
                onChange={(ev) => setCompra(Number(ev.target.value))}
                aria-label="Com quantas fichas sentar"
              />
              <div className="mesa-valor-num">
                <span>{fmt(compraMin(bb))}</span>
                <span>{fmt(Math.min(compraMax(bb), saldo))}</span>
              </div>
            </div>
            <button className="mesa-bt" type="button" onClick={() => setSentarEm(null)}>
              Cancelar
            </button>
            <button className="mesa-bt ouro" type="button" disabled={p.enviando || saldo < compra} onClick={() => void sentar()}>
              Sentar<small>com {formatarMoedas(compra)}</small>
            </button>
          </>
        ) : !meu ? (
          <span className="mesa-tempo pk-espera">
            {e.lugares.length >= LUGARES_PK
              ? "A mesa está cheia: dá para assistir"
              : saldo < compraMin(bb)
                ? `Para sentar aqui são pelo menos ${fmt(compraMin(bb))} moedas`
                : "Toque num lugar livre para sentar"}
          </span>
        ) : (
          <>
            <span className="mesa-tempo pk-espera">
              {meu.sair
                ? "Você levanta no fim desta mão"
                : !h
                  ? "Esperando a mão começar"
                  : fim
                    ? "Próxima mão em instantes"
                    : eu_j?.estado === "desistiu" || !eu_j
                      ? "Fora desta mão: entra na próxima"
                      : "Esperando a sua vez"}
            </span>
            {!meu.sair && (
              <button className="mesa-bt" type="button" disabled={p.enviando} onClick={() => void p.levantar()}>
                Levantar<small>leva {fmt(meu.fichas)}</small>
              </button>
            )}
          </>
        )}
      </div>
      <p className="bj-justo hint">
        Justo: o baralho é embaralhado por um segredo da mão; o código dele (hash) aparece no começo e o segredo sai no fim.
        {h && <span className="bj-hash"> Hash: {h.hash.slice(0, 16)}…</span>}
        {h?.segredo && (
          <button type="button" className="linkish" onClick={() => void conferir()}>
            Conferir esta mão
          </button>
        )}
      </p>
      {conferencia && <p className="bj-justo hint">{conferencia}</p>}
    </div>
  );
}
