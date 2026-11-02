"use client";
/*
 * Aba Cassino: moedas fictícias (sem compra e sem saque): roleta europeia, limbo, maior ou menor
 * e caça-níquel. O banco sorteia; aqui só escolhemos a aposta, animamos até o resultado que
 * o banco mandou e mostramos como conferir que nada foi trocado.
 */
import { useEffect, useRef, useState } from "react";
import { ajustarSaldo, useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { reduzMovimento } from "@/lib/util";
import { carregar, msgDe, useCassino, type Aposta, type Jogo, type Revelada } from "./estado";
import { CacaNiquel, Fichas, Limbo, MaiorMenor } from "./Jogos";
import { corDa, hashDaSemente, refazer, resultadoGuardado, rtpSlot, vantagemDaCasa, type TipoAposta } from "./regras";

const NUMEROS = Array.from({ length: 36 }, (_, k) => k + 1);
const FORA: { tipo: TipoAposta; valor: number; nome: string }[] = [
  { tipo: "cor", valor: 0, nome: "Vermelho" },
  { tipo: "cor", valor: 1, nome: "Preto" },
  { tipo: "paridade", valor: 0, nome: "Par" },
  { tipo: "paridade", valor: 1, nome: "Ímpar" },
  { tipo: "metade", valor: 0, nome: "1–18" },
  { tipo: "metade", valor: 1, nome: "19–36" },
];
const nomeAposta = (t: TipoAposta, v: number) => (t === "numero" ? `no ${v}` : `no ${FORA.find((f) => f.tipo === t && f.valor === v)?.nome}`);
const JOGOS: { id: Jogo; nome: string }[] = [
  { id: "roleta", nome: "Roleta" },
  { id: "limbo", nome: "Limbo" },
  { id: "dado", nome: "Maior ou menor" },
  { id: "slot", nome: "Caça-níquel" },
];
const NOME_JOGO: Record<Jogo, string> = { roleta: "Roleta", limbo: "Limbo", dado: "Maior ou menor", slot: "Caça-níquel" };

/** Uma linha do histórico: o que apostou e o que saiu, em poucas palavras. */
function descreve(a: Aposta): { aposta: string; saiu: string; cor?: string } {
  const e = a.escolha, r = a.resultado;
  if (a.jogo === "roleta") return { aposta: `${a.aposta} ${nomeAposta(e.tipo as TipoAposta, Number(e.valor))}`, saiu: String(r.casa), cor: corDa(Number(r.casa)) };
  if (a.jogo === "limbo") return { aposta: `${a.aposta} no ${String(e.alvo).replace(".", ",")}×`, saiu: `${Number(r.valor).toFixed(2).replace(".", ",")}×` };
  if (a.jogo === "dado") return { aposta: `${a.aposta} ${e.lado === "abaixo" ? "abaixo" : "acima"} de ${e.n}`, saiu: String(r.numero) };
  return { aposta: `${a.aposta} no caça-níquel`, saiu: Array.isArray(r.simbolos) ? `${r.simbolos.length} rolos` : "" };
}

export function CassinoView({ hidden }: { hidden: boolean }) {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const { ligado, estado, historico, reveladas, feed, rolos, pagamentos } = useCassino();
  const [jogo, setJogo] = useState<Jogo>("roleta");
  const [escolha, setEscolha] = useState<{ tipo: TipoAposta; valor: number }>({ tipo: "cor", valor: 0 });
  const [ficha, setFicha] = useState<number>(10);
  const [roda, setRoda] = useState<number | null>(null);
  const [girando, setGirando] = useState(false);
  /* null = ainda não mexeu: mostra a semente do cliente atual */
  const [clienteEditado, setCliente] = useState<string | null>(null);
  const cliente = clienteEditado ?? estado?.cliente ?? "";
  const [conferencia, setConferencia] = useState<Record<number, string>>({});
  const giro = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const abriu = !hidden;
  useEffect(() => {
    if (abriu) carregar();
  }, [abriu]);
  useEffect(() => () => clearInterval(giro.current), []);

  const girar = async () => {
    if (girando) return;
    setGirando(true);
    /* a roda gira enquanto o banco sorteia; para na casa que ele mandou */
    if (!reduzMovimento()) giro.current = setInterval(() => setRoda(Math.floor(Math.random() * 37)), 70);
    const inicio = Date.now();
    try {
      const { data, error } = await sb().rpc("apostar_roleta", { p_aposta: ficha, p_tipo: escolha.tipo, p_valor: escolha.valor });
      if (error) throw error;
      const r = data as { casa: number; pagou: number; saldo: number };
      const falta = reduzMovimento() ? 0 : Math.max(0, 1400 - (Date.now() - inicio));
      await new Promise((ok) => setTimeout(ok, falta));
      clearInterval(giro.current);
      setRoda(r.casa);
      ajustarSaldo(r.saldo);
      toast(r.pagou > 0 ? `Deu ${r.casa}! Você ganhou ${formatarMoedas(r.pagou)} moedas` : `Deu ${r.casa}. Perdeu ${ficha} moedas`);
      carregar();
    } catch (e) {
      clearInterval(giro.current);
      setRoda(null);
      toast(msgDe(e, "Não deu para girar. Confira a internet."));
    } finally {
      setGirando(false);
    }
  };

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

  const corRoda = roda === null ? "" : corDa(roda);
  /* quanto a casa leva no jogo escolhido */
  const casaLeva =
    jogo === "roleta" ? vantagemDaCasa() : jogo === "slot" ? (rolos.length ? Math.round((1 - rtpSlot(rolos, pagamentos)) * 1000) / 10 : 8) : 3;

  return (
    <section id="view-cassino" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Cassino</h1>
      </header>
      {ligado === false ? (
        <p className="block hint">O cassino ainda não foi ligado no banco (seção 11 do seguranca.sql).</p>
      ) : (
        <>
          <div className="cassino-topo">
            <span className="cassino-saldo">
              <b>{saldo !== undefined ? formatarMoedas(saldo) : "…"}</b> moedas
            </span>
            <span className="hint">Moedas de mentira: não dá para comprar nem sacar. Neste jogo, a casa leva {String(casaLeva).replace(".", ",")}%.</span>
          </div>
          <div className="seg cassino-jogos" role="radiogroup" aria-label="Escolha o jogo">
            {JOGOS.map((j) => (
              <button key={j.id} type="button" role="radio" aria-checked={jogo === j.id} className={jogo === j.id ? "on" : undefined} onClick={() => setJogo(j.id)}>
                {j.nome}
              </button>
            ))}
          </div>
          <div className="cassino-grid">
            {jogo === "limbo" && <Limbo />}
            {jogo === "dado" && <MaiorMenor />}
            {jogo === "slot" && <CacaNiquel />}
            <div className="block roleta" hidden={jogo !== "roleta"}>
              <div className={"roleta-roda " + corRoda + (girando ? " girando" : "")} aria-live="polite" aria-label={roda === null ? "Roleta parada" : `Deu ${roda}`}>
                {roda ?? "?"}
              </div>
              <div className="roleta-mesa" role="group" aria-label="Escolha a aposta">
                <button type="button" className={"casa verde" + (escolha.tipo === "numero" && escolha.valor === 0 ? " on" : "")} onClick={() => setEscolha({ tipo: "numero", valor: 0 })}>
                  0
                </button>
                {NUMEROS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={"casa " + corDa(n) + (escolha.tipo === "numero" && escolha.valor === n ? " on" : "")}
                    aria-pressed={escolha.tipo === "numero" && escolha.valor === n}
                    onClick={() => setEscolha({ tipo: "numero", valor: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="roleta-fora">
                {FORA.map((f) => (
                  <button
                    key={f.nome}
                    type="button"
                    className={"btn soft sm" + (escolha.tipo === f.tipo && escolha.valor === f.valor ? " on" : "")}
                    aria-pressed={escolha.tipo === f.tipo && escolha.valor === f.valor}
                    onClick={() => setEscolha({ tipo: f.tipo, valor: f.valor })}
                  >
                    {f.nome}
                  </button>
                ))}
              </div>
              <Fichas ficha={ficha} setFicha={setFicha} />
              <button type="button" className="btn roleta-girar" disabled={girando} onClick={girar}>
                {girando ? "Girando…" : `Girar: ${ficha} moedas ${nomeAposta(escolha.tipo, escolha.valor)}`}
              </button>
              <p className="hint">Número paga 35 vezes; cor, par/ímpar e metade pagam 1 vez. O 0 perde nas apostas de fora.</p>
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
