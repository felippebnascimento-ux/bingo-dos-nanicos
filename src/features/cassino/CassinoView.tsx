"use client";
/*
 * Aba Cassino: moedas fictícias (sem compra e sem saque): roleta e aviãozinho ao vivo (rodadas para todo
 * mundo junto), o blackjack ao vivo (todos contra o mesmo dealer), o pôquer entre nanicos (mesas como as do truco), o pênalti e o caça-níquel (individuais, este com jackpot do grupo), e o Pênalti x1 (duelo entre dois, sem taxa). O banco sorteia; aqui só escolhemos a aposta, animamos até o resultado que
 * o banco mandou e mostramos como conferir que nada foi trocado.
 */
import { useEffect, useState } from "react";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { BancaNanica } from "./BancaNanica";
import { carregar, msgDe, useCassino, useJogoCassino, type Aposta, type Jogo, type Revelada } from "./estado";
import { Duelo } from "./Duelo";
import { Aviaozinho } from "./Aviaozinho";
import { Blackjack } from "./Blackjack";
import { Poquer } from "./Poquer";
import { CacaNiquel } from "./CacaNiquel";
import { Penalti } from "./Penalti";
import { RoletaMesa } from "./RoletaMesa";
import { corDa, hashDaSemente, nomeLugar, refazer, resultadoGuardado, rtpSlot, vantagemDaCasa, type TipoAposta } from "./regras";

/** Uma ficha antiga (uma aposta só) ou a mesa inteira: "25 no Número 32" ou "120 em 3 lugares". */
function apostaDaRoleta(total: number, e: Record<string, unknown>) {
  if (Array.isArray(e.fichas)) return e.fichas.length === 1 ? `${total} em ${nomeLugar((e.fichas[0] as { tipo: TipoAposta }).tipo, Number((e.fichas[0] as { valor: unknown }).valor))}` : `${total} em ${e.fichas.length} lugares`;
  return `${total} em ${nomeLugar(e.tipo as TipoAposta, Number(e.valor))}`;
}
const JOGOS: { id: Jogo; nome: string }[] = [
  { id: "roleta", nome: "Roleta" },
  { id: "aviao", nome: "Aviãozinho" },
  { id: "blackjack", nome: "Blackjack" },
  { id: "poker", nome: "Pôquer" },
  { id: "penalti", nome: "Pênalti" },
  { id: "duelo", nome: "Pênalti x1" },
  { id: "slot", nome: "Caça-níquel" },
];
const NOME_JOGO: Record<Jogo, string> = { roleta: "Roleta", aviao: "Aviãozinho", limbo: "Limbo", dado: "Maior ou menor", slot: "Caça-níquel", penalti: "Pênalti", blackjack: "Blackjack", poker: "Pôquer", duelo: "Pênalti x1" };

/** Uma linha do histórico: o que apostou e o que saiu, em poucas palavras. */
function descreve(a: Aposta): { aposta: string; saiu: string; cor?: string } {
  const e = a.escolha, r = a.resultado;
  if (a.jogo === "roleta") return { aposta: apostaDaRoleta(a.aposta, e), saiu: String(r.casa), cor: corDa(Number(r.casa)) };
  if (a.jogo === "aviao")
    return { aposta: `${a.aposta}${e.auto ? ` · auto ${String(e.auto).replace(".", ",")}×` : ""}`, saiu: e.sacou ? `sacou ${Number(e.sacou).toFixed(2).replace(".", ",")}×` : `voou ${Number(r.valor).toFixed(2).replace(".", ",")}×` };
  if (a.jogo === "limbo") return { aposta: `${a.aposta} no ${String(e.alvo).replace(".", ",")}×`, saiu: `${Number(r.valor).toFixed(2).replace(".", ",")}×` };
  if (a.jogo === "dado") return { aposta: `${a.aposta} ${e.lado === "abaixo" ? "abaixo" : "acima"} de ${e.n}`, saiu: String(r.numero) };
  if (a.jogo === "penalti") {
    const g = Number(e.gols) || 0;
    return { aposta: `${a.aposta} · ${g} ${g === 1 ? "gol" : "gols"}`, saiu: a.pagou ? `${Number(r.valor).toFixed(2).replace(".", ",")}×` : "defendeu" };
  }
  if (a.jogo === "blackjack") {
    const p = Number(r.pontos), d = Number(r.dealer_pontos);
    return { aposta: `${a.aposta}${e.dobrou ? " · dobrou" : ""}${Number(e.mao) === 2 ? " · 2ª mão" : ""}`, saiu: r.estado === "estourou" ? `estourou (${p})` : r.estado === "blackjack" ? "blackjack" : `${p} × ${d > 21 ? "estourou" : d}` };
  }
  return { aposta: `${a.aposta} no caça-níquel`, saiu: Array.isArray(r.simbolos) ? `${r.simbolos.length} rolos` : "" };
}

export function CassinoView({ hidden }: { hidden: boolean }) {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const { ligado, estado, historico, reveladas, feed, rolos, pagamentos } = useCassino();
  const jogo = useJogoCassino((s) => s.jogo);
  const setJogo = (j: Jogo) => useJogoCassino.setState({ jogo: j });
  /* null = ainda não mexeu: mostra a semente do cliente atual */
  const [clienteEditado, setCliente] = useState<string | null>(null);
  const cliente = clienteEditado ?? estado?.cliente ?? "";
  const [conferencia, setConferencia] = useState<Record<number, string>>({});

  const abriu = !hidden;
  useEffect(() => {
    if (abriu) carregar();
  }, [abriu]);

  const trocarSemente = async () => {
    try {
      const { error } = await sb().rpc("trocar_semente", { p_cliente: cliente.trim() || "nanico" });
      if (error) throw error;
      toast("Semente trocada: a antiga foi revelada");
      setCliente(null);
      carregar();
    } catch (e) {
      toast(msgDe(e, "Não deu para trocar a semente."));
    }
  };

  const conferirSemente = async (r: Revelada) => {
    const minhas = historico.filter((a) => a.hash === r.hash);
    const hashOk = (await hashDaSemente(r.semente_hex)) === r.hash;
    let batem = 0;
    for (const a of minhas) if ((await refazer(a.jogo, a.nonce, r.semente_hex, r.semente_cliente, rolos)) === resultadoGuardado(a.jogo, a.resultado)) batem++;
    setConferencia((c) => ({
      ...c,
      [r.id]: `${hashOk ? "A semente bate com o hash mostrado antes" : "A semente NÃO bate com o hash"} · ${batem} de ${minhas.length} apostas recalculadas batem`,
    }));
  };

  /* quanto a casa leva no jogo escolhido */
  const casaLeva =
    jogo === "duelo" ? 0 : jogo === "roleta" ? vantagemDaCasa() : jogo === "blackjack" ? 0.5 : jogo === "poker" ? 3 : jogo === "slot" ? (rolos.length ? Math.round((1 - rtpSlot(rolos, pagamentos)) * 1000) / 10 : 8) : 3;

  return (
    <section id="view-cassino" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Cassino</h1>
        <BancaNanica />
      </header>
      {ligado === false ? (
        <p className="block hint">O cassino ainda não foi ligado no banco (seção 11 do seguranca.sql).</p>
      ) : (
        <>
          <div className="cassino-topo">
            <span className="cassino-saldo">
              <b>{saldo !== undefined ? formatarMoedas(saldo) : "…"}</b> moedas
            </span>
            <span className="hint">Moedas de mentira: não dá para comprar nem sacar. {jogo === "duelo" ? "Neste jogo não há taxa: é um contra o outro." : `Neste jogo, a casa leva ${String(casaLeva).replace(".", ",")}%.`}</span>
          </div>
          <div className="seg cassino-jogos" role="radiogroup" aria-label="Escolha o jogo">
            {JOGOS.map((j) => (
              <button key={j.id} type="button" role="radio" aria-checked={jogo === j.id} className={jogo === j.id ? "on" : undefined} onClick={() => setJogo(j.id)}>
                {j.nome}
              </button>
            ))}
          </div>
          <div className="cassino-grid">
            {jogo === "aviao" && (
              <div className="rm-caixa">
                <Aviaozinho />
              </div>
            )}
            {jogo === "blackjack" && (
              <div className="rm-caixa bj-caixa">
                <Blackjack ativa={!hidden} />
              </div>
            )}
            {jogo === "poker" && (
              <div className="rm-caixa bj-caixa">
                <Poquer ativa={!hidden} />
              </div>
            )}
            {jogo === "penalti" && (
              <div className="rm-caixa">
                <Penalti />
              </div>
            )}
            {jogo === "duelo" && (
              <div className="rm-caixa">
                <Duelo ativa={!hidden} />
              </div>
            )}
            {jogo === "slot" && (
              <div className="rm-caixa">
                <CacaNiquel />
              </div>
            )}
            {/* a roleta fica sempre montada (a roda não pode sumir no meio do giro) */}
            <div className="rm-caixa" hidden={jogo !== "roleta"}>
              <RoletaMesa ativa={!hidden && jogo === "roleta"} />
            </div>
            <div className="cassino-lado">
              <details className="block cassino-justo">
                <summary>Como conferir que é justo</summary>
                <p className="hint">
                  Antes de cada aposta, o banco já guardou a semente dele: você vê o hash dela abaixo. O número sai de uma conta com essa semente, a sua
                  semente e o contador. Ao trocar a semente, a antiga é revelada e o site refaz a conta das suas apostas.
                </p>
                {estado && (
                  <dl>
                    <dt>Hash da semente atual</dt>
                    <dd className="hash">{estado.hash}</dd>
                    <dt>Contador (nonce)</dt>
                    <dd>{estado.nonce}</dd>
                  </dl>
                )}
                <label className="lbl" htmlFor="cassinoCliente">
                  Sua semente
                </label>
                <div className="cassino-semente">
                  <input id="cassinoCliente" value={cliente} maxLength={32} onChange={(e) => setCliente(e.target.value)} />
                  <button type="button" className="btn soft sm" onClick={trocarSemente}>
                    Trocar semente e revelar a antiga
                  </button>
                </div>
                {reveladas.length > 0 && (
                  <ul className="cassino-reveladas">
                    {reveladas.map((r) => (
                      <li key={r.id}>
                        <span className="hash">{r.hash.slice(0, 16)}…</span>
                        <button type="button" className="linkish" onClick={() => conferirSemente(r)}>
                          Conferir
                        </button>
                        {conferencia[r.id] && <small>{conferencia[r.id]}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
              {historico.length > 0 && (
                <div className="block">
                  <h3>Minhas apostas</h3>
                  <ul className="cassino-lista">
                    {historico.slice(0, 12).map((a) => {
                      const d = descreve(a);
                      return (
                        <li key={a.id}>
                          <span>
                            <small>{NOME_JOGO[a.jogo] ?? a.jogo}</small> {d.aposta}
                          </span>
                          <span className={"casa-mini " + (d.cor ?? "neutro")}>{d.saiu}</span>
                          <b className={a.pagou ? "ganhou" : "perdeu"}>{a.pagou ? `+${a.pagou}` : `−${a.aposta}`}</b>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {feed.length > 0 && (
                <div className="block">
                  <h3>Últimas da mesa</h3>
                  <ul className="cassino-lista">
                    {feed.slice(0, 10).map((f, k) => (
                      <li key={k}>
                        <span>{f.nome ?? "Alguém"}</span>
                        <span className="casa-mini neutro">{NOME_JOGO[f.jogo] ?? f.jogo}</span>
                        <b className={f.pagou ? "ganhou" : "perdeu"}>{f.pagou ? `+${f.pagou}` : `−${f.aposta}`}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
