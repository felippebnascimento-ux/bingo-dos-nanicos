"use client";
/*
 * Pedro no K-FOFO (seção 63): o botão vermelho na parede da esquerda, entre o baú e a porta de vidro, a janelinha que
 * confirma os 200 e a discoteca (bola espelhada, luzes coloridas e todo mundo dançando) enquanto a música toca.
 * O som e a regra ficam em pedroDados.ts (não pode se chamar pedro.ts: o Windows confunde com Pedro.tsx).
 */
import { memo, useEffect, useState } from "react";
import { friendName, useApp } from "@/lib/store";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { tela, TH, TW, type Caixa2D } from "./hall";
import { emPorcento, viewBox } from "./Sala";
import { festaAtiva, PEDRO_PRECO, tocarPedro, usePedro } from "./pedroDados";

/* o quadro na parede da esquerda (i = 0): de j = A até j = B, da altura Z0 até Z1 (em cima do baú, acima da placa
   "Campeões Selados" e abaixo das janelinhas) */
const A = 1.15;
const B = 2.45;
const Z0 = 94;
const Z1 = 150;
const L = Math.hypot(TW, TH);
const LARG = (B - A) * L;
const ALT = Z1 - Z0;
/* papel reto (u para a direita, v para baixo) entortado para a parede da esquerda: u anda no sentido de j menor */
const [ox, oy] = tela(0, B, Z1);
const PAREDE = `matrix(${TW / L} ${-TH / L} 0 1 ${ox} ${oy})`;

/** A caixa de som com o botão vermelho, desenhada na parede. */
export const QuadroPedro = memo(function QuadroPedro({ vb }: { vb: Caixa2D }) {
  const tocando = usePedro((s) => festaAtiva(s.festa));
  return (
    <svg className="hall-camada hall-pedro" viewBox={viewBox(vb)} aria-hidden="true">
      <g transform={PAREDE}>
        <rect x={0} y={0} width={LARG} height={ALT} rx={3} className="f-madeira s-madeiral" strokeWidth={2} />
        <rect x={4} y={4} width={LARG - 8} height={ALT - 8} rx={2} className="pedro-painel" />
        <text x={LARG / 2} y={14} textAnchor="middle" className="pedro-titulo">
          PEDRO
        </text>
        <circle cx={LARG / 2} cy={ALT * 0.54} r={12} className="pedro-aro" />
        <circle cx={LARG / 2} cy={ALT * 0.54} r={9} className={"pedro-botao" + (tocando ? " on" : "")} />
        <ellipse cx={LARG / 2 - 2.5} cy={ALT * 0.54 - 3.5} rx={3.2} ry={2} className="pedro-brilho" />
        <text x={LARG / 2} y={ALT - 6} textAnchor="middle" className="pedro-preco">
          {PEDRO_PRECO} 🪙
        </text>
      </g>
    </svg>
  );
});

/** Caixa (em % do palco) por cima do quadro. */
function pedroCaixa(vb: Caixa2D) {
  const pts = [tela(0, A, Z0), tela(0, A, Z1), tela(0, B, Z0), tela(0, B, Z1)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { left: ((x0 - vb.x) / vb.w) * 100, top: ((y0 - vb.y) / vb.h) * 100, width: ((x1 - x0) / vb.w) * 100, height: ((y1 - y0) / vb.h) * 100 };
}

const pct = (n: number) => `${n}%`;

/** O botão por cima do quadro e a janelinha que confirma os 200 (pagar é sempre com um segundo toque). */
export function BotaoPedro({ vb }: { vb: Caixa2D }) {
  const [aberto, setAberto] = useState(false);
  const festa = usePedro((s) => s.festa);
  const pedindo = usePedro((s) => s.pedindo);
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const tocando = festaAtiva(festa);

  /* fecha ao tocar fora ou com Esc */
  useEffect(() => {
    if (!aberto) return;
    const fecha = () => setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fecha();
    document.addEventListener("click", fecha);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", fecha);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const c = pedroCaixa(vb);
  const pos = emPorcento(vb, 0, (A + B) / 2, Z1 + 6);
  const semSaldo = typeof saldo === "number" && saldo < PEDRO_PRECO;
  return (
    <>
      <button
        type="button"
        className="hall-tv hall-pedro-botao"
        aria-label={`Tocar o Pedro para todo mundo no K-FOFO (${PEDRO_PRECO} moedas)`}
        aria-expanded={aberto}
        style={{ left: pct(c.left), top: pct(c.top), width: pct(c.width), height: pct(c.height) }}
        onClick={(e) => {
          e.stopPropagation();
          setAberto((v) => !v);
        }}
      />
      {aberto && (
        <div className="boneco-menu pedro-menu" role="dialog" aria-label="Tocar o Pedro" style={{ left: pct(pos.left), top: pct(pos.top) }} onClick={(e) => e.stopPropagation()}>
          <b>Pedro pedro pedro</b>
          <p className="hint">Toca para todo mundo que está no K-FOFO e acende a discoteca.</p>
          <button
            type="button"
            className="btn sm"
            disabled={tocando || pedindo || semSaldo}
            onClick={() => {
              setAberto(false);
              void tocarPedro();
            }}
          >
            {tocando ? "Já está tocando" : semSaldo ? `Faltam moedas (${formatarMoedas(PEDRO_PRECO)})` : `Tocar por ${formatarMoedas(PEDRO_PRECO)}`}
          </button>
        </div>
      )}
    </>
  );
}

/** A discoteca: bola espelhada, luzes girando e o aviso de quem pagou, enquanto a música dura. */
export function DiscoCamada() {
  const festa = usePedro((s) => s.festa);
  const friends = useApp((s) => s.friends);
  if (!festaAtiva(festa)) return null;
  const quem = friends.find((f) => f.user_id === festa.userId);
  const nome = quem ? friendName(quem.id, friends) : "Alguém";
  return (
    <div className="hall-disco" aria-live="polite">
      <span className="disco-luz l1" aria-hidden="true" />
      <span className="disco-luz l2" aria-hidden="true" />
      <span className="disco-luz l3" aria-hidden="true" />
      <span className="disco-luz l4" aria-hidden="true" />
      <span className="disco-bola" aria-hidden="true" />
      <span className="disco-aviso">
        🎶 Pedro pedro pedro · <b>{nome}</b> pagou a rodada
      </span>
    </div>
  );
}
