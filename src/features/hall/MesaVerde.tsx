"use client";
/*
 * Peças do truco na mesa verde do K-FOFO (fase 32): o placar dentro da plaquinha "Truco · ao vivo", o leque de
 * cartas na mão do boneco (só o verso, com a quantidade do `nc`) e a janela "Assistindo", que mostra a mesa como
 * quem assiste (MesaTela, sem sentar) com o painel de apostas da fase 31.
 */
import { useEffect, useRef } from "react";
import { IcFechar } from "@/components/ui/icones";
import { MesaTela } from "@/features/truco/MesaTela";
import { useTruco } from "@/features/truco/mesa";
import { useMesaVerde } from "./trucoSala";

const nomeDupla = (m: { modo: number; lugares: ({ nome: string } | null)[] }, t: number) =>
  m.modo === 2 ? (m.lugares[t]?.nome ?? "?") : `${m.lugares[t]?.nome ?? "?"} e ${m.lugares[t + 2]?.nome ?? "?"}`;

/** "Lightzin e Max 12 × 9 Gamer e Pin · Vale 25 · +1 mesa"; no fim, quem ganhou. */
export function PlacarMesaVerde() {
  const { mesa: m, extra, terminou, valor } = useMesaVerde();
  if (!m) return null;
  return (
    <small className="hall-placa-placar">
      {terminou && m.vencedor !== null ? (
        <b>{nomeDupla(m, m.vencedor)} venceu!</b>
      ) : (
        <>
          {nomeDupla(m, 0)} <b>{m.placar[0]}</b> × <b>{m.placar[1]}</b> {nomeDupla(m, 1)}
        </>
      )}
      {valor > 0 && ` · Vale ${valor}`}
      {extra > 0 && ` · +${extra} ${extra === 1 ? "mesa" : "mesas"}`}
    </small>
  );
}

/** Leque de cartas de verso na mão do boneco sentado (de 1 a 3), desenhado dentro do boneco como o chapéu. */
export function CartasNaMao({ n }: { n: number }) {
  const k = Math.max(0, Math.min(3, n));
  if (!k) return null;
  return (
    <svg className="boneco-cartas" viewBox="0 0 30 20" aria-hidden="true">
      {Array.from({ length: k }, (_, i) => {
        const rot = (i - (k - 1) / 2) * 16;
        return <rect key={i} x="11" y="3" width="8" height="12" rx="1.2" className="cm-verso" transform={`rotate(${rot} 15 17)`} />;
      })}
    </svg>
  );
}

/** Janela "Assistindo" por cima do K-FOFO: a mesa ao vivo (como quem assiste) e as apostas. Fecha no X, Esc ou fora. */
export function AssistindoJanela({ id, fechar }: { id: string; fechar: () => void }) {
  const m = useTruco((s) => s.mesas.find((x) => x.id === id) ?? null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fecharRef.current?.focus();
  }, []);
  /* a mesa sumiu (fechada ou esquecida): a janela fecha sozinha */
  useEffect(() => {
    if (!m) fechar();
  }, [m, fechar]);
  if (!m) return null;
  return (
    <div
      className="gate assistindo-gate"
      role="dialog"
      aria-modal="true"
      aria-label="Assistindo o truco"
      onKeyDown={(e) => e.key === "Escape" && fechar()}
      onClick={(e) => e.target === e.currentTarget && fechar()}
    >
      <div className="assistindo">
        <div className="assistindo-topo">
          <b>Assistindo o truco</b>
          <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar" onClick={fechar}>
            <IcFechar />
          </button>
        </div>
        <MesaTela m={m} />
      </div>
    </div>
  );
}
