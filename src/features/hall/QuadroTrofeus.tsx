"use client";
/*
 * Quadro "Troféus da semana" na parede da esquerda do hall (entre a TV e a porta de vidro), com o
 * vencedor de três troféus. Fica numa camada própria (o texto muda toda semana) e um botão por cima
 * abre a aba Troféus. Sem troféus (ninguém com op.gg), o quadro não aparece.
 */
import { memo } from "react";
import { friendName, setApp, useApp } from "@/lib/store";
import { podio } from "@/features/trofeus/trofeus";
import { useTrofeus } from "@/features/trofeus/trofeusDados";
import { tela, TH, TW, type Caixa2D } from "./hall";
import { viewBox } from "./Sala";

/* o quadro na parede da esquerda (i = 0): de j = A a j = B, de z = Z0 a z = Z1 */
const A = 3.2;
const B = 4.5;
const Z0 = 72;
const Z1 = 150;
/** comprimento na tela de 1 piso ao longo da parede */
const L = Math.hypot(TW, TH);
const LARG = (B - A) * L;
const ALT = Z1 - Z0;
/* desenha num papel reto (u para a direita, v para baixo) e entorta para o plano da parede */
const [ex, ey] = tela(0, B, Z1);
const PAREDE = `matrix(${TW / L} ${-TH / L} 0 1 ${ex} ${ey})`;

const LINHAS = [
  { id: "lol_vitorias", rotulo: "LoL" },
  { id: "cs_vitorias", rotulo: "CS2" },
  { id: "lol_kda", rotulo: "KDA" },
] as const;

export const QuadroTrofeus = memo(function QuadroTrofeus({ vb }: { vb: Caixa2D }) {
  const linhas = useTrofeus((s) => s.linhas);
  const friends = useApp((s) => s.friends);
  const semana = linhas?.[0]?.semana ?? null;
  if (!linhas || !semana) return null;
  return (
    <svg className="hall-camada hall-quadro" viewBox={viewBox(vb)} aria-hidden="true">
      <g transform={PAREDE}>
        <rect x={0} y={0} width={LARG} height={ALT} rx={2} className="f-madeira s-madeiral" strokeWidth={1.5} />
        <rect x={4} y={4} width={LARG - 8} height={ALT - 8} className="quadro-papel" />
        <text x={LARG / 2} y={15} textAnchor="middle" className="quadro-titulo">
          HALL DA FAMA
        </text>
        {LINHAS.map((l, k) => {
          const quem = podio(linhas, l.id, semana)[0];
          return (
            <text key={l.id} x={8} y={31 + k * 14} className="quadro-linha">
              <tspan className="quadro-rotulo">{l.rotulo}: </tspan>
              {quem ? friendName(quem.fid, friends) : "—"}
            </text>
          );
        })}
      </g>
    </svg>
  );
});

/** Caixa (em % do palco) do botão por cima do quadro. */
export function quadroCaixa(vb: Caixa2D) {
  const [xa, ya] = tela(0, A, Z1); /* canto de cima, à direita */
  const [xb, yb] = tela(0, B, Z0); /* canto de baixo, à esquerda */
  return {
    left: ((xb - vb.x) / vb.w) * 100,
    top: ((ya - vb.y) / vb.h) * 100,
    width: ((xa - xb) / vb.w) * 100,
    height: ((yb - ya) / vb.h) * 100,
  };
}

/** Botão invisível por cima do quadro: abre a aba Troféus. */
export function BotaoQuadro({ vb }: { vb: Caixa2D }) {
  const tem = useTrofeus((s) => !!s.linhas?.length);
  if (!tem) return null;
  const c = quadroCaixa(vb);
  return (
    <button
      type="button"
      className="hall-tv hall-quadro-botao"
      tabIndex={-1}
      aria-hidden="true"
      style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${c.width}%`, height: `${c.height}%` }}
      onClick={(e) => {
        e.stopPropagation();
        setApp({ aba: "trofeus" });
      }}
    />
  );
}
