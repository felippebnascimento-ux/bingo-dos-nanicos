"use client";
/*
 * Os jogos novos do cassino: limbo, maior ou menor e caça-níquel dos nanicos.
 * Quem sorteia é o banco (apostar_limbo, apostar_dado, apostar_slot); aqui só animamos até o resultado.
 */
import { useEffect, useRef, useState } from "react";
import { MARCA } from "@/lib/dados/nanicos";
import { ajustarSaldo } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { reduzMovimento } from "@/lib/util";
import { carregar, msgDe, useCassino } from "./estado";
import { ALVO_MAX, ALVO_MIN, chanceDado, chanceLimbo, chanceValida, FICHAS, pagamentoDado, type Lado } from "./regras";

const pct = (c: number) => `${(c * 100).toFixed(c < 0.1 ? 2 : 1).replace(".", ",")}%`;
const virgula = (n: number) => n.toFixed(2).replace(".", ",");

/** Os valores de aposta (5 a 100), iguais em todos os jogos. */
export function Fichas({ ficha, setFicha }: { ficha: number; setFicha: (v: number) => void }) {
  return (
    <div className="seg roleta-fichas" role="radiogroup" aria-label="Valor da aposta">
      {FICHAS.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={ficha === v} className={ficha === v ? "on" : undefined} onClick={() => setFicha(v)}>
          {v}
        </button>
      ))}
    </div>
  );
}

/** Chama o jogo no banco, atualiza o saldo e avisa. Devolve a resposta (ou null se deu erro). */
async function jogar<T extends { pagou: number; saldo: number }>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) {
    toast(msgDe(error, "Não deu para jogar. Confira a internet."));
    return null;
  }
  ajustarSaldo((data as T).saldo);
  return data as T;
}

export function Limbo() {
  const [ficha, setFicha] = useState(10);
  const [alvoTxt, setAlvoTxt] = useState("2,00");
  const [mostra, setMostra] = useState<number | null>(null);
  const [jogando, setJogando] = useState(false);
  const anim = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => () => clearInterval(anim.current), []);
  const alvo = Number(alvoTxt.replace(",", "."));
  const valido = Number.isFinite(alvo) && alvo >= ALVO_MIN && alvo <= ALVO_MAX && Math.round(alvo * 100) === alvo * 100;

  const apostar = async () => {
    if (!valido || jogando) return;
    setJogando(true);
    const r = await jogar<{ valor: number; pagou: number; saldo: number }>("apostar_limbo", { p_aposta: ficha, p_alvo: alvo });
    if (r) {
      const fim = Number(r.valor);
      /* o multiplicador sobe até o resultado */
      if (reduzMovimento()) setMostra(fim);
      else {
        let v = 1;
        setMostra(1);
        await new Promise<void>((ok) => {
          anim.current = setInterval(() => {
            v = Math.min(fim, v + Math.max(0.01, (fim - v) * 0.12));
            setMostra(v);
            if (v >= fim) {
              clearInterval(anim.current);
              ok();
            }
          }, 30);
        });
      }
      toast(r.pagou ? `${virgula(fim)}×! Você ganhou ${formatarMoedas(r.pagou)} moedas` : `${virgula(fim)}×. Perdeu ${ficha} moedas`);
      carregar();
    }
    setJogando(false);
  };

  return (
    <div className="block jogo">
      <div className={"limbo-num" + (mostra !== null && mostra >= alvo ? " ganhou" : "")} aria-live="polite">
        {mostra === null ? "?" : `${virgula(mostra)}×`}
      </div>
      <label className="lbl" htmlFor="limboAlvo">
        Alvo (de 1,01× a 100×)
      </label>
      <div className="jogo-linha">
        <input id="limboAlvo" inputMode="decimal" value={alvoTxt} onChange={(e) => setAlvoTxt(e.target.value)} aria-invalid={!valido} />
        {[1.5, 2, 10].map((a) => (
          <button key={a} type="button" className="btn soft sm" onClick={() => setAlvoTxt(virgula(a))}>
            {String(a).replace(".", ",")}×
          </button>
        ))}
      </div>
      <p className="hint">{valido ? `Chance de ganhar: ${pct(chanceLimbo(alvo))} · se ganhar, recebe ${formatarMoedas(Math.floor(ficha * alvo))} moedas` : "O alvo vai de 1,01 a 100, com até 2 casas depois da vírgula."}</p>
      <Fichas ficha={ficha} setFicha={setFicha} />
      <button type="button" className="btn jogo-btn" disabled={!valido || jogando} onClick={apostar}>
        {jogando ? "Subindo…" : `Apostar ${ficha} moedas no ${virgula(valido ? alvo : 2)}×`}
      </button>
      <p className="hint">O número sobe a partir de 1×; se passar do seu alvo, você ganha alvo × aposta. A casa leva 3%.</p>
    </div>
  );
}

export function MaiorMenor() {
  const [ficha, setFicha] = useState(10);
  const [lado, setLado] = useState<Lado>("abaixo");
  const [n, setN] = useState(5000);
  const [num, setNum] = useState<number | null>(null);
  const [jogando, setJogando] = useState(false);
  const chance = chanceDado(lado, n);
  const ok = chanceValida(chance);

  const apostar = async () => {
    if (!ok || jogando) return;
    setJogando(true);
    const r = await jogar<{ numero: number; pagou: number; saldo: number }>("apostar_dado", { p_aposta: ficha, p_lado: lado, p_n: n });
    if (r) {
      setNum(r.numero);
      toast(r.pagou ? `Deu ${r.numero}! Você ganhou ${formatarMoedas(r.pagou)} moedas` : `Deu ${r.numero}. Perdeu ${ficha} moedas`);
      carregar();
    }
    setJogando(false);
  };

  return (
    <div className="block jogo">
      <div className="limbo-num" aria-live="polite">
        {num ?? "?"}
      </div>
      <div className="seg" role="radiogroup" aria-label="Abaixo ou acima">
        {(["abaixo", "acima"] as const).map((l) => (
          <button key={l} type="button" role="radio" aria-checked={lado === l} className={lado === l ? "on" : undefined} onClick={() => setLado(l)}>
            {l === "abaixo" ? `Abaixo de ${n}` : `Acima de ${n}`}
          </button>
        ))}
      </div>
      <input type="range" min={1} max={9998} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Número N, de 1 a 9998" className="dado-n" />
      <p className="hint">
        {ok ? `Sorteio de 0 a 9999 · chance ${pct(chance)} · se ganhar, recebe ${formatarMoedas(pagamentoDado(lado, n, ficha))} moedas` : "A chance precisa ficar entre 1% e 95%: mexa no número."}
      </p>
      <Fichas ficha={ficha} setFicha={setFicha} />
      <button type="button" className="btn jogo-btn" disabled={!ok || jogando} onClick={apostar}>
        {jogando ? "Sorteando…" : `Apostar ${ficha} moedas`}
      </button>
      <p className="hint">Paga 0,97 dividido pela chance: quanto menor a chance, maior o prêmio. A casa leva 3%.</p>
    </div>
  );
}

/** Um símbolo do caça-níquel: o rosto do nanico n1…n14 (a arte que já existe), a bola de bingo ou a moeda. */
function Simbolo({ s }: { s: string }) {
  if (s === "moeda")
    return (
      <span className="hall-moeda slot-moeda" role="img" aria-label="moeda">
        $
      </span>
    );
  const src = s === "bola" ? MARCA : `/arte/nanicos/${Number(s.slice(1))}-rosto.webp`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="slot-img" src={src} alt={s === "bola" ? "bola de bingo" : "rosto de um nanico"} />;
}

export function CacaNiquel() {
  const { rolos, pagamentos } = useCassino();
  const [ficha, setFicha] = useState(10);
  const [rolo, setRolo] = useState<string[]>(["n1", "bola", "moeda"]);
  const [parados, setParados] = useState(3);
  const [jogando, setJogando] = useState(false);
  const anim = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  /* quantos rolos já pararam (lido dentro do intervalo da animação) */
  const paradosRef = useRef(3);
  useEffect(() => () => clearInterval(anim.current), []);

  const girar = async () => {
    if (jogando || !rolos.length) return;
    setJogando(true);
    const simbolos = rolos.map((r) => r.simbolo);
    const sorteio = (k: number) => simbolos[(Date.now() / 70 + k * 5) % simbolos.length | 0];
    if (!reduzMovimento()) {
      setParados(0);
      anim.current = setInterval(() => setRolo((v) => v.map((x, k) => (k >= paradosRef.current ? sorteio(k) : x))), 80);
    }
    const r = await jogar<{ simbolos: string[]; pagou: number; saldo: number }>("apostar_slot", { p_aposta: ficha });
    if (r) {
      /* os rolos param um por um */
      for (let k = 0; k < 3; k++) {
        if (!reduzMovimento()) await new Promise((ok) => setTimeout(ok, 450));
        paradosRef.current = k + 1;
        setParados(k + 1);
        setRolo((v) => v.map((x, i) => (i === k ? r.simbolos[k] : x)));
      }
      toast(r.pagou ? `Você ganhou ${formatarMoedas(r.pagou)} moedas!` : `Não foi dessa vez. Perdeu ${ficha} moedas`);
      carregar();
    }
    clearInterval(anim.current);
    paradosRef.current = 3;
    setParados(3);
    setJogando(false);
  };

  const LINHAS: [string, string][] = [
    ["tres_bola", "3 bolas de bingo"],
    ["tres_moeda", "3 moedas"],
    ["tres_rosto", "3 rostos iguais"],
    ["duas_moedas", "2 moedas"],
    ["uma_moeda", "1 moeda"],
  ];
  return (
    <div className="block jogo">
      <div className="slot-rolos" aria-live="polite" aria-label={parados === 3 ? `Rolos: ${rolo.join(", ")}` : "Rolos girando"}>
        {rolo.map((s, k) => (
          <span key={k} className={"slot-rolo" + (k >= parados ? " girando" : "")}>
            <Simbolo s={s} />
          </span>
        ))}
      </div>
      <Fichas ficha={ficha} setFicha={setFicha} />
      <button type="button" className="btn jogo-btn" disabled={jogando || !rolos.length} onClick={girar}>
        {jogando ? "Girando…" : `Girar: ${ficha} moedas`}
      </button>
      <details className="slot-tabela">
        <summary>Tabela de pagamentos (a casa leva 8%)</summary>
        <ul>
          {LINHAS.map(([k, t]) => (
            <li key={k}>
              <span>{t}</span>
              <b>{pagamentos[k] ? `${pagamentos[k]}× a aposta` : "…"}</b>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
