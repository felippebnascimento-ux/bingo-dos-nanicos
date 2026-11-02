"use client";
/*
 * Os jogos novos do cassino: limbo, maior ou menor e caça-níquel dos nanicos.
 * Quem sorteia é o banco (apostar_limbo, apostar_dado, apostar_slot); aqui só animamos até o resultado.
 */
import { useEffect, useRef, useState } from "react";
import { ajustarSaldo } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { reduzMovimento } from "@/lib/util";
import { carregar, msgDe } from "./estado";
import { ALVO_MAX, ALVO_MIN, chanceLimbo, FICHAS } from "./regras";

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
