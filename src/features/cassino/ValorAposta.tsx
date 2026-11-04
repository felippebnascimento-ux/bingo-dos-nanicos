"use client";
/*
 * O valor da aposta, como nos cassinos online: as fichas de atalho (tocar soma a ficha ao valor), o valor escrito à
 * mão e os botões ½, 2×, TUDO (o saldo inteiro) e ↺ (zera, para montar de novo com as fichas). Vai até o que a pessoa
 * tem (0 = ainda montando; o jogo só deixa apostar com 5 ou mais); quem confere de verdade é o banco
 * (seção 64 do seguranca.sql: sem teto, só o saldo). Usado no aviãozinho, no pênalti e no caça-níquel.
 */
import { useState } from "react";
import { formatarMoedas } from "@/lib/moedas";
import { APOSTA_MIN, FICHAS_ROLETA } from "./regras";
import { FichaVisual } from "./RoletaMesa";

type Props = {
  valor: number;
  onValor: (v: number) => void;
  /** o saldo (o teto); sem saldo carregado, não limita */
  saldo: number | undefined;
  disabled?: boolean;
};

/** Põe o valor entre 0 e o saldo (inteiro). */
export function limitarAposta(v: number, saldo: number | undefined) {
  const teto = saldo === undefined ? Infinity : Math.max(0, saldo);
  return Math.max(0, Math.min(teto, Math.floor(Number.isFinite(v) ? v : 0)));
}
/** Dá para apostar esse valor? */
export const apostaOk = (v: number, saldo: number | undefined) => v >= APOSTA_MIN && (saldo === undefined || v <= saldo);

export function ValorAposta({ valor, onValor, saldo, disabled }: Props) {
  /* o que está escrito no campo (pode ficar vazio enquanto a pessoa digita) */
  const [texto, setTexto] = useState<string | null>(null);
  const por = (v: number) => {
    setTexto(null);
    onValor(limitarAposta(v, saldo));
  };
  const tudo = saldo !== undefined && valor >= saldo && saldo >= APOSTA_MIN;
  return (
    <div className="va">
      <div className="rm-fichas va-fichas" role="group" aria-label="Somar uma ficha à aposta">
        {FICHAS_ROLETA.map((v) => (
          <button key={v} type="button" disabled={disabled || (saldo !== undefined && valor + v > saldo)} onClick={() => por(valor + v)} aria-label={`Somar ${v}`}>
            <FichaVisual v={v} />
          </button>
        ))}
      </div>
      <div className="va-linha">
        <button type="button" className="va-bt" disabled={disabled || valor <= APOSTA_MIN} onClick={() => por(Math.max(APOSTA_MIN, valor / 2))} aria-label="Metade da aposta">
          ½
        </button>
        <label className="va-campo">
          <span>Aposta</span>
          <input
            inputMode="numeric"
            aria-label="Valor da aposta em moedas"
            disabled={disabled}
            value={texto ?? formatarMoedas(valor)}
            onFocus={(e) => {
              setTexto(String(valor));
              requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => {
              const limpo = e.target.value.replace(/\D/g, "");
              setTexto(limpo);
              if (limpo) onValor(limitarAposta(Number(limpo), saldo));
            }}
            onBlur={() => setTexto(null)}
          />
        </label>
        <button type="button" className="va-bt" disabled={disabled || !valor || (saldo !== undefined && valor * 2 > saldo)} onClick={() => por(valor * 2)} aria-label="Dobrar a aposta">
          2×
        </button>
        <button type="button" className={"va-bt va-tudo" + (tudo ? " on" : "")} disabled={disabled || saldo === undefined || saldo < APOSTA_MIN} onClick={() => saldo !== undefined && por(saldo)}>
          TUDO
        </button>
        <button type="button" className="va-bt va-zera" disabled={disabled || !valor} onClick={() => por(0)} aria-label="Zerar a aposta">
          ↺
        </button>
      </div>
    </div>
  );
}
