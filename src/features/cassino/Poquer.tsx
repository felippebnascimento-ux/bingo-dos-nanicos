"use client";
/*
 * Pôquer Texas Hold'em entre nanicos, na mesa oval (o padrão das mesas de cartas): o salão com as mesas abertas e,
 * dentro de uma, até 6 lugares em volta (eu sempre embaixo), o botão do dealer, as apostas de cada um, o pote e as
 * cartas da mesa no meio, as minhas cartas grandes e a barra de baixo (sentar, ou jogar a vez: desistir, passar,
 * pagar, aumentar com ½ pote, ¾ pote, pote e all-in). Quem embaralha, confere e paga é o banco (seção 44).
 */
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { formatarMoedas } from "@/lib/moedas";
import { useCarteira } from "@/lib/carteira";
import { Avatar } from "@/components/ui/Avatar";
import { CartaFrancesa } from "@/features/mesa/CartaFrancesa";
import { BotaoDealer, Lugar, Mesa, NaMesa, Pilha } from "@/features/mesa/Pecas";
import { Aparece, Pula, Some, Vira, Voa } from "@/features/mesa/Animar";
import { BarraJogo, Historico } from "@/features/mesa/Painel";
import {
  baralhoPk,
  BLINDS,
  chanceDeVencer,
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
  textoAcao,
  type FasePk,
} from "./pkRegras";
import { usePoquer } from "./pkDados";

/* onde fica cada lugar na mesa, contando a partir de mim (0 = eu, embaixo à esquerda), e para onde vai a aposta */
const LUGAR_XY: [number, number][] = [[24, 86], [8, 50], [28, 13], [72, 13], [92, 50], [76, 86]];
const APOSTA_XY: [number, number][] = [[31, 68], [22, 50], [34, 31], [66, 31], [78, 50], [69, 68]];
const DEALER_XY: [number, number][] = [[38, 72], [21, 38], [42, 25], [58, 25], [79, 62], [62, 74]];
const NOME_FASE: Record<FasePk, string> = { preflop: "Pré-flop", flop: "Flop", turn: "Turn", river: "River", fim: "Fim da mão" };
const fmt = (n: number) => n.toLocaleString("pt-BR");
/* a chance de vencer é uma simulação: guardada por mão, para não refazer a cada consulta ao banco */
const chances = new Map<string, number | null>();
function chanceGuardada(minhas: string[], mesa: string[], oponentes: number) {
  const k = `${minhas.join()}|${mesa.join()}|${oponentes}`;
  if (!chances.has(k)) {
    if (chances.size > 60) chances.clear();
    chances.set(k, chanceDeVencer(minhas, mesa, oponentes, 400));
  }
  return chances.get(k) ?? null;
}
const REGRAS = (
  <>
    <p>Texas Hold&apos;em: 2 cartas para cada um e 5 na mesa (flop, turn e river). Vence a melhor mão de 5 das 7 cartas.</p>
    <p>Até 6 por mesa. Senta com pelo menos 20 big blinds, até tudo o que tem na carteira; ao levantar, o que sobrou volta. 20 s por jogada: acabou o tempo, passa se puder, senão desiste.</p>
    <p>All-in divide o pote certinho entre quem pôs. A casa leva 3% do pote, só do flop em diante.</p>
  </>
);
type Pre = { chave: string; tipo: "passar-desistir" | "pagar" | "qualquer"; aposta: number };

/** O relógio do banco, andando de 1/4 em 1/4 de segundo (para as contagens). */
function useAgora(agoraBanco: () => number) {
  const [agora, setAgora] = useState(() => Date.now());
  const ref = useRef(agoraBanco);
  useEffect(() => { ref.current = agoraBanco; });
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) setAgora(ref.current());
    }, 250);
    return () => clearInterval(t);
  }, []);
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
            Abrir mesa<small>senta com {fmt(compraMin(blind))} ou mais</small>
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
  /* a jogada marcada antes da vez (vale só nesta rodada de apostas) */
  const [pre, setPre] = useState<Pre | null>(null);
  const feito = useRef("");
  const jogarAgora = p.jogar;
  useEffect(() => {
    const h = p.estado?.mao;
    const meu = p.estado?.lugares.find((l) => l.userId === eu);
    if (!h || !pre || !meu || h.fase === "fim" || h.vez !== meu.lugar || pre.chave !== `${h.id}-${h.fase}`) return;
    const vezDe = `${h.id}-${h.fase}-${h.aposta}`;
    if (feito.current === vezDe) return;
    const j = h.jogadores.find((x) => x.lugar === meu.lugar);
    const deve = Math.max(0, h.aposta - (j?.naRodada ?? 0));
    feito.current = vezDe;
    if (pre.tipo === "passar-desistir") void jogarAgora(deve > 0 ? "desistir" : "passar");
    else if (pre.tipo === "qualquer") void jogarAgora(deve === 0 ? "passar" : deve >= meu.fichas ? "allin" : "pagar");
    else if (h.aposta === pre.aposta) void jogarAgora(deve === 0 ? "passar" : deve >= meu.fichas ? "allin" : "pagar");
  }, [p.estado, pre, eu, jogarAgora]);

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
  /* quanto falta da vez (0 a 1), pelo relógio em ms: o anel e as barras andam lisos, não de segundo em segundo */
  const fracVez = h?.vezAte && !fim ? Math.max(0, Math.min(1, (h.vezAte - agora) / TEMPO_VEZ_PK_MS)) : null;
  const eu_j = meu ? jog(meu.lugar) : undefined;
  /* as cartas saem do baralho uma de cada vez, a partir de quem está depois do botão (duas voltas) */
  const naMao = h ? [...h.jogadores].sort((a, b) => ((a.lugar - h.botao + 5) % 6) - ((b.lugar - h.botao + 5) % 6)).map((j) => j.lugar) : [];
  const atrasoDar = (lugar: number, volta: number) => (Math.max(0, naMao.indexOf(lugar)) + volta * naMao.length) * 110;
  const urgente = seg !== null && seg <= 5;

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
  const oponentes = h ? h.jogadores.filter((j) => j.lugar !== meu?.lugar && j.estado !== "desistiu").length : 0;
  const chance = h && eu_j && eu_j.estado !== "desistiu" && !fim && h.minhas.length === 2 ? chanceGuardada(h.minhas, h.mesa, oponentes) : null;
  const chavePre = h ? `${h.id}-${h.fase}` : "";
  /* "Pagar 120" deixa de valer se alguém aumentou depois de marcar */
  const preAgora = pre && pre.chave === chavePre && (pre.tipo !== "pagar" || pre.aposta === h?.aposta) ? pre : null;
  const marcar = (tipo: Pre["tipo"]) => setPre(preAgora?.tipo === tipo ? null : { chave: chavePre, tipo, aposta: h?.aposta ?? 0 });
  const deveAgora = h && eu_j ? Math.max(0, h.aposta - eu_j.naRodada) : 0;

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
    <div className="mesa-jogo pk-jogo">
      <BarraJogo
        voltar={
          <button type="button" className="mesa-voltar" onClick={() => p.irPara(null)} aria-label="Voltar às mesas">
            ←
          </button>
        }
        icone="♠"
        nome="Texas Hold'em"
        sub={`Mesa ${e.mesa.id} · Blinds ${bb / 2}/${bb}${h ? ` · Mão ${h.id}` : ""}`}
        status={!h ? (e.lugares.length < 2 ? "Esperando jogadores" : "A mão já vai começar") : fim ? "Fim da mão" : minhaVez ? `Sua vez · ${seg} s` : vezJ ? `Vez de ${nome(vezJ.userId)} · ${seg} s` : NOME_FASE[h.fase]}
        falta={vezJ && fracVez !== null ? fracVez : null}
        urgente={urgente}
        carteira={saldo}
        naMesa={meu ? meu.fichas : null}
        regras={REGRAS}
      />
      <Historico
        rotulo="Últimas mãos:"
        itens={e.historico.flatMap((x) =>
          x.ganhadores.slice(0, 1).map((g) => ({ txt: `${nome(g.userId)} +${fmt(g.ganhou)}`, tom: g.userId === eu ? ("v" as const) : undefined, dica: g.valor != null ? nomeDaMao(g.valor) : "os outros desistiram" })),
        )}
      />
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
                  {m?.cartas
                    ? m.cartas.map((c) => (
                        <Vira key={c}>
                          <Carta c={c} className={"peq" + (acesas.has(c) ? " brilha" : "")} ganha={acesas.has(c)} />
                        </Vira>
                      ))
                    : [0, 1].map((k) => (
                        <Voa key={`${h?.id}-${k}`} de=".pk-baralho" atraso={atrasoDar(lugar, k)}>
                          <Carta c={null} className="peq" />
                        </Voa>
                      ))}
                </span>
              )}
              {/* desistiu agora: as cartas vão para o meio */}
              {!souEu && j?.estado === "desistiu" && (
                <span className="mesa-leque pequeno pk-cartas" key={`larga-${h?.id}`}>
                  <Some para=".pk-pote">
                    <span className="mesa-leque pequeno">
                      <Carta c={null} className="peq" />
                      <Carta c={null} className="peq" />
                    </span>
                  </Some>
                </span>
              )}
              <Lugar
                f={rosto(l.userId)}
                nome={nome(l.userId)}
                eu={souEu}
                vez={naVez && fracVez !== null ? fracVez : null}
                urgente={naVez && urgente}
                ganhou={ganhou > 0}
                fora={j?.estado === "desistiu" || (!j && !!h && !fim)}
                etiqueta={j?.estado === "allin" && !fim ? "ALL-IN" : l.sair ? "SAINDO" : undefined}
                info={naVez && seg !== null ? `${fmt(l.fichas)} · ${seg} s` : fmt(l.fichas)}
              />
              {naVez && seg !== null && (
                <span className={"mesa-tb" + (urgente ? " urgente" : "")} style={{ ["--p" as string]: `${((fracVez ?? 0) * 100).toFixed(2)}%` }} aria-hidden="true">
                  <i />
                </span>
              )}
              {!fim && !naVez && j?.acao && (
                <span className={"mesa-acao " + j.acao} key={`${j.acao}-${j.acaoValor}`}>
                  {textoAcao(j.acao, j.acaoValor)}
                </span>
              )}
            </NaMesa>
          );
        })}
        {/* o botão e as apostas da rodada */}
        {/* o baralho, de onde saem as cartas */}
        <NaMesa x={50} y={14} className="pk-deck">
          <span className="pk-baralho" aria-hidden="true">
            <CartaFrancesa costas />
            <CartaFrancesa costas />
            <CartaFrancesa costas />
          </span>
        </NaMesa>
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
                <NaMesa key={`a${j.lugar}-${h.id}-${h.fase}`} x={APOSTA_XY[v][0]} y={APOSTA_XY[v][1]} className={"pk-a" + v}>
                  {/* a ficha sai da frente de quem apostou; aumentou, dá um pulinho */}
                  <Voa de={`.pk-v${v} .mesa-rosto`} giro={0} escala={0.8} duracao={380}>
                    <Pula valor={j.naRodada}>
                      <Pilha valor={j.naRodada} />
                    </Pula>
                  </Voa>
                </NaMesa>
              );
            })}
        {/* fim da mão: o pote vai para quem ganhou */}
        {h &&
          fim &&
          h.mostradas
            .filter((m) => m.ganhou > 0)
            .map((m) => {
              const v = visual(m.lugar);
              return (
                <NaMesa key={`g${m.lugar}-${h.id}`} x={APOSTA_XY[v][0]} y={APOSTA_XY[v][1]} className={"pk-a" + v}>
                  <Voa de=".pk-pote" giro={0} escala={1.2} duracao={750} atraso={h.showdown ? 900 : 200}>
                    <Pilha valor={m.ganhou} />
                  </Voa>
                </NaMesa>
              );
            })}
        {/* o meio: pote e as cartas da mesa */}
        <NaMesa x={50} y={45} className="pk-meio">
          {h && (
            <Pula valor={h.pote}>
              <span className={"mesa-pote pk-pote" + (fim && h.mostradas.some((m) => m.ganhou > 0) ? (h.showdown ? " vai" : " vai cedo") : "")}>Pote {fmt(h.pote - (fim ? h.rake : 0))}</span>
            </Pula>
          )}
          {h && (
            <div className="pk-board">
              {Array.from({ length: 5 }, (_, k) => {
                const c = h.mesa[k];
                /* a carta nova sai do baralho e vira (o flop, uma de cada vez) */
                return c ? (
                  <Voa key={`${h.id}-${c}`} de=".pk-baralho" atraso={k < 3 ? k * 160 : 0} giro={0} escala={0.6} duracao={380}>
                    <Vira atraso={(k < 3 ? k * 160 : 0) + 330}>
                      <Carta c={c} ganha={acesas.has(c)} className={acesas.has(c) ? "brilha" : ""} />
                    </Vira>
                  </Voa>
                ) : (
                  <Carta key={k} c={null} className="vazia" />
                );
              })}
            </div>
          )}
          <span className="mesa-aviso" role="status" key={aviso}>
            {aviso}
          </span>
        </NaMesa>
        {/* as minhas cartas */}
        {h && eu_j && h.minhas.length > 0 && (
          <NaMesa x={50} y={82} className="pk-minhas">
            <div className={"mesa-leque abre" + (eu_j.estado === "desistiu" ? " pk-larguei" : "")}>
              {h.minhas.map((c, k) => (
                <Voa key={`${h.id}-${c}`} de=".pk-baralho" atraso={atrasoDar(eu_j.lugar, k)} giro={k ? 14 : -14} duracao={480}>
                  <Vira atraso={atrasoDar(eu_j.lugar, k) + 420}>
                    <Carta c={c} className={"grande" + (fim && acesas.has(c) ? " brilha" : "")} ganha={acesas.has(c) || (!fim && eu_j.estado !== "desistiu")} />
                  </Vira>
                </Voa>
              ))}
            </div>
            {eu_j.estado !== "desistiu" && (minhaMao || chance !== null) && (
              <Aparece atraso={h.mesa.length ? 0 : atrasoDar(eu_j.lugar, 1) + 700}>
                <span className="mesa-forca" key={minhaMao ?? "alta"}>
                  {/* no celular, só o começo ("Dois pares"); o resto ("Ases e Reis") só no computador */}
                  <b>
                    {(minhaMao ?? "Carta alta").split(/[:,]/)[0]}
                    <span className="pk-longo">{(minhaMao ?? "").slice((minhaMao ?? "").split(/[:,]/)[0].length)}</span>
                  </b>
                  {chance !== null && (
                    <small>
                      {Math.round(chance * 100)}%<span className="pk-longo"> de vencer{oponentes > 1 ? ` contra ${oponentes}` : ""}</span>
                    </small>
                  )}
                </span>
              </Aparece>
            )}
          </NaMesa>
        )}
      </Mesa>

      {/* o painel de baixo: na minha vez, os atalhos, o controle e os três botões grandes; antes dela, a jogada marcada */}
      {op && h && meu ? (
        <div className={"mesa-painel minha-vez" + (urgente ? " urgente" : "")} key="vez">
          {op.aumentar && op.max > op.min && (
            <>
              <div className="mesa-presets">
                <button type="button" className={alvo === op.min ? "on" : ""} onClick={() => mudarAlvo(op.min)}>
                  Mín
                </button>
                {sug.map((x) => (
                  <button key={x.nome} type="button" className={alvo === x.valor && x.valor !== op.min ? "on" : ""} onClick={() => mudarAlvo(x.valor)}>
                    {x.nome}
                  </button>
                ))}
                <button type="button" className={alvo >= op.max ? "on" : ""} onClick={() => mudarAlvo(op.max)}>
                  All-in
                </button>
              </div>
              <div className="mesa-slider">
                <button type="button" onClick={() => mudarAlvo(Math.max(op.min, alvo - bb))} aria-label="Menos">
                  −
                </button>
                <input type="range" min={op.min} max={op.max} step={Math.max(1, bb / 2)} value={alvo} onChange={(ev) => mudarAlvo(Number(ev.target.value))} aria-label="Quanto apostar" />
                <button type="button" onClick={() => mudarAlvo(Math.min(op.max, alvo + bb))} aria-label="Mais">
                  +
                </button>
                <output>{fmt(alvo)}</output>
              </div>
            </>
          )}
          <div className="mesa-grandes">
            <button className="mesa-grande desistir" type="button" disabled={p.enviando} onClick={() => void p.jogar("desistir")}>
              Desistir
            </button>
            {op.passar ? (
              <button className="mesa-grande pagar" type="button" disabled={p.enviando} onClick={() => void p.jogar("passar")}>
                Passar
              </button>
            ) : (
              <button className="mesa-grande pagar" type="button" disabled={p.enviando} onClick={() => void p.jogar(op.pagar >= meu.fichas ? "allin" : "pagar")}>
                {op.pagar >= meu.fichas ? "All-in" : "Pagar"}
                <small>{fmt(op.pagar)}</small>
              </button>
            )}
            {op.aumentar ? (
              <button className="mesa-grande aumentar" type="button" disabled={p.enviando} onClick={() => void (alvo >= op.max ? p.jogar("allin") : p.jogar("aumentar", alvo))}>
                {alvo >= op.max ? "All-in" : h.aposta > 0 ? "Aumentar" : "Apostar"}
                <small>{alvo >= op.max ? fmt(op.max) : h.aposta > 0 ? `para ${fmt(alvo)}` : fmt(alvo)}</small>
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      ) : meu && h && !fim && eu_j && eu_j.estado === "ativo" ? (
        <div className="mesa-painel" key="pre">
          <div className="mesa-pre" role="group" aria-label="Marcar a jogada antes da vez">
            <label className={preAgora?.tipo === "passar-desistir" ? "on" : ""}>
              <input type="checkbox" checked={preAgora?.tipo === "passar-desistir"} onChange={() => marcar("passar-desistir")} /> {deveAgora > 0 ? "Desistir" : "Passar / desistir"}
            </label>
            <label className={preAgora?.tipo === "pagar" ? "on" : ""}>
              <input type="checkbox" checked={preAgora?.tipo === "pagar"} onChange={() => marcar("pagar")} /> {deveAgora > 0 ? `Pagar ${fmt(Math.min(deveAgora, meu.fichas))}` : "Passar"}
            </label>
            <label className={preAgora?.tipo === "qualquer" ? "on" : ""}>
              <input type="checkbox" checked={preAgora?.tipo === "qualquer"} onChange={() => marcar("qualquer")} /> Pagar qualquer
            </label>
          </div>
          <div className="mesa-linha dica">{preAgora ? "Marcado: o jogo faz essa jogada quando chegar a sua vez" : vezJ ? `Vez de ${nome(vezJ.userId)}` : "Abrindo as cartas"}</div>
        </div>
      ) : !meu && sentarEm != null ? (
        <div className="mesa-painel" key="sentar">
          <div className="mesa-slider">
            <button type="button" onClick={() => setCompra(Math.max(compraMin(bb), compra - bb * 10))} aria-label="Menos">
              −
            </button>
            <input
              type="range"
              min={compraMin(bb)}
              max={Math.max(compraMin(bb), Math.min(compraMax(bb), saldo))}
              step={bb}
              value={compra}
              onChange={(ev) => setCompra(Number(ev.target.value))}
              aria-label="Com quantas fichas sentar"
            />
            <button type="button" onClick={() => setCompra(Math.min(compraMax(bb), saldo, compra + bb * 10))} aria-label="Mais">
              +
            </button>
            <output>{fmt(compra)}</output>
            <button type="button" className="mesa-tudo" onClick={() => setCompra(Math.max(compraMin(bb), saldo))} disabled={saldo < compraMin(bb) || compra >= saldo}>
              Tudo
            </button>
          </div>
          <div className="mesa-linha">
            <button className="mesa-bt" type="button" onClick={() => setSentarEm(null)}>
              Cancelar
            </button>
            <button className="mesa-bt ouro" type="button" disabled={p.enviando || saldo < compra} onClick={() => void sentar()}>
              Sentar no lugar {sentarEm}
              <small>com {formatarMoedas(compra)}</small>
            </button>
          </div>
        </div>
      ) : (
        <div className="mesa-painel" key="espera">
          <div className="mesa-linha">
            <span className="mesa-linha dica">
              {!meu
                ? e.lugares.length >= LUGARES_PK
                  ? "A mesa está cheia: dá para assistir"
                  : saldo < compraMin(bb)
                    ? `Para sentar aqui são pelo menos ${fmt(compraMin(bb))} moedas`
                    : "Toque num lugar livre para sentar"
                : meu.sair
                  ? "Você levanta no fim desta mão"
                  : !h
                    ? "Esperando a mão começar"
                    : fim
                      ? "Próxima mão em instantes"
                      : "Fora desta mão: entra na próxima"}
            </span>
            {meu && !meu.sair && (
              <button className="mesa-bt" type="button" disabled={p.enviando} onClick={() => void p.levantar()}>
                Levantar<small>leva {fmt(meu.fichas)}</small>
              </button>
            )}
          </div>
        </div>
      )}
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
