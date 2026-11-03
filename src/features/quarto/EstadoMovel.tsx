"use client";
/*
 * O que os móveis que fazem algo mostram por cima do desenho (seção 53): o número do dado (que chacoalha por um
 * instante quando alguém rola), a luz da luminária no chão, o bilhete do quadro de recados e a cor do regulador de
 * luz pintando o quarto. Tudo vem do estado do banco (interativo.ts).
 */
import { useEffect, useState } from "react";
import type { Pt } from "./Moveis";
import { luzLigada, type CorLuz } from "./interativo";
import type { MovelCena } from "./QuartoCena";

const ROLA_MS = 900;

/** O número do dado; nos primeiros instantes depois de rolar, chacoalha. */
function Dado({ m, p }: { m: MovelCena; p: (i: number, j: number, z?: number) => Pt }) {
  const em = m.estado?.em ?? 0;
  const [rolando, setRolando] = useState(false);
  useEffect(() => {
    if (!em || Date.now() - em > ROLA_MS) return;
    const liga = setTimeout(() => setRolando(true), 0);
    const desliga = setTimeout(() => setRolando(false), Math.max(0, ROLA_MS - (Date.now() - em)));
    return () => {
      clearTimeout(liga);
      clearTimeout(desliga);
    };
  }, [em]);
  const [x, y] = p(m.ret.i + m.ret.w / 2, m.ret.j + m.ret.d / 2, 26);
  return (
    <text className={"quarto-dado" + (rolando ? " rolando" : "")} x={x} y={y + 6} textAnchor="middle" pointerEvents="none">
      {rolando ? "?" : (m.estado?.n ?? "?")}
    </text>
  );
}

export function EstadoNoMovel({ m, p }: { m: MovelCena; p: (i: number, j: number, z?: number) => Pt }) {
  const ci = m.ret.i + m.ret.w / 2, cj = m.ret.j + m.ret.d / 2;
  if (m.desenho === "dado") return <Dado m={m} p={p} />;
  if (m.desenho === "luminaria") {
    if (!luzLigada(m.estado ?? {})) return null;
    const [x, y] = p(ci, cj, 0);
    const [bx, by] = p(ci, cj, 88);
    return (
      <g pointerEvents="none">
        <ellipse className="quarto-luz-chao" cx={x} cy={y} rx={70} ry={35} />
        <circle className="quarto-luz-bulbo" cx={bx} cy={by} r={18} />
      </g>
    );
  }
  if (m.desenho === "caixa" && m.estado?.estacao && m.estado.estacao !== "desligada") {
    const [x, y] = p(ci, cj, 70);
    return (
      <text className="quarto-nota" x={x} y={y} textAnchor="middle" pointerEvents="none">
        ♪
      </text>
    );
  }
  if (m.desenho === "recado" && m.estado?.texto) {
    const [x, y] = p(ci, cj, 96);
    return (
      <g pointerEvents="none">
        <title>{m.estado.texto}</title>
        <text className="quarto-recado" x={x} y={y} textAnchor="middle">
          📝
        </text>
      </g>
    );
  }
  return null;
}

/** A cor do regulador de luz por cima do quarto inteiro (sem pegar clique). */
export function TintaQuarto({ cor, largura, altura }: { cor: Exclude<CorLuz, "desligado"> | null; largura: number; altura: number }) {
  if (!cor) return null;
  return <rect className={"quarto-tinta t-" + cor} x={0} y={0} width={largura} height={altura} pointerEvents="none" />;
}
