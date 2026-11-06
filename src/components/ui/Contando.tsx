"use client";
/*
 * Número que conta até o valor novo (saldo, prêmios), como nos apps de banco e de jogo: em vez de trocar de repente,
 * sobe ou desce em ~0,8 s, desacelerando no fim. Com menos movimento (sistema ou Configurações), troca direto.
 */
import { useEffect, useRef, useState } from "react";

const semMovimento = () =>
  typeof window !== "undefined" && (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("menos-movimento"));

export function Contando({ valor, formatar = (n) => n.toLocaleString("pt-BR"), ms = 800 }: { valor: number; formatar?: (n: number) => string; ms?: number }) {
  const [mostra, setMostra] = useState(valor);
  const atual = useRef(valor);
  useEffect(() => {
    const de = atual.current;
    if (de === valor) return;
    if (semMovimento()) {
      atual.current = valor;
      const t = setTimeout(() => setMostra(valor), 0);
      return () => clearTimeout(t);
    }
    const t0 = performance.now();
    let id = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const n = Math.round(de + (valor - de) * (1 - Math.pow(1 - k, 3)));
      atual.current = n;
      setMostra(n);
      if (k < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [valor, ms]);
  return <span className="contando">{formatar(mostra)}</span>;
}
