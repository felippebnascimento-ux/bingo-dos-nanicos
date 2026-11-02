"use client";
/*
 * Eventos com horário no Sítio: a faixa no topo (com a contagem até o fim), a luz âmbar do happy hour,
 * a brasa e a fumaça da churrasqueira no sábado e a placa "Pegar espetinho" em cima dela.
 */
import { memo } from "react";
import { fimDoEvento, happyAgora, horaBr, textoFalta } from "@/lib/eventos";
import { CHURRASQUEIRA, tela, type Caixa2D } from "./hall";
import { emPorcento, viewBox } from "./Sala";
import { pegarEspetinho, useEventos } from "./eventosSala";

const pct = (v: number) => `${v}%`;

/** Faixa do evento de agora, no topo do cômodo. */
export function FaixaEvento() {
  const evento = useEventos((s) => s.evento);
  const agora = useEventos((s) => s.agora);
  if (!evento || !agora) return null;
  const fim = fimDoEvento(new Date(agora));
  const falta = fim ? textoFalta(fim.getTime() - agora) : "";
  const dobro = happyAgora(new Date(agora));
  return (
    <div className={"hall-faixa " + evento} role="status">
      <b>{evento === "happy" ? "HAPPY HOUR" : "CHURRASCO DE SÁBADO"}</b>
      <span>{evento === "happy" ? "moedas em dobro até 00:00" : dobro ? "espetinho até 23:00 · moedas em dobro" : "pegue seu espetinho até 23:00"}</span>
      {falta && <small>faltam {falta}</small>}
    </div>
  );
}

/** Luz mais quente por cima do cômodo enquanto o tempo online paga em dobro. */
export function LuzHappy() {
  const happy = useEventos((s) => !!s.agora && happyAgora(new Date(s.agora)));
  return happy ? <div className="hall-luz-happy" aria-hidden="true" /> : null;
}

/* a boca da churrasqueira fica na frente dela (j = j + d), de i + 0,35 a i + 1,85 */
const J = CHURRASQUEIRA.j + CHURRASQUEIRA.d;
const I0 = CHURRASQUEIRA.i;
const pt = (i: number, z: number) => tela(i, J, z).join(",");
const BRASAS = [0.45, 0.7, 0.95, 1.2, 1.45, 1.65].map((d, k) => ({ i: I0 + d, k, z: 23 + (k % 2) * 2 }));
const FUMACA = [0.75, 1.1, 1.45].map((d) => I0 + d);

/** Brasa (piscando devagar) e fumaça (subindo e sumindo) na churrasqueira; mesma camada da churrasqueira. */
export const ChurrascoCamada = memo(function ChurrascoCamada({ vb, z }: { vb: Caixa2D; z: number }) {
  const aceso = useEventos((s) => s.evento === "churrasco");
  if (!aceso) return null;
  return (
    <svg className="hall-camada hall-churrasco" viewBox={viewBox(vb)} aria-hidden="true" style={{ zIndex: z }}>
      <polygon points={[pt(I0 + 0.38, 22), pt(I0 + 1.82, 22), pt(I0 + 1.82, 29), pt(I0 + 0.38, 29)].join(" ")} className="brasa-fundo" />
      {BRASAS.map((b) => (
        <polygon
          key={b.k}
          points={[pt(b.i, b.z), pt(b.i + 0.17, b.z), pt(b.i + 0.17, b.z + 4), pt(b.i, b.z + 4)].join(" ")}
          className="brasa"
          style={{ animationDelay: `${(b.k * 0.37) % 1.6}s` }}
        />
      ))}
      {FUMACA.map((i, k) => {
        const [x, y] = tela(i, J, 74);
        return <circle key={k} cx={x} cy={y} r={7} className="fumaca" style={{ animationDelay: `${k * 1.1}s` }} />;
      })}
    </svg>
  );
});

/** Placa em cima da churrasqueira: pegar o espetinho (uma vez por sábado). */
export function PlacaChurrasco({ vb }: { vb: Caixa2D }) {
  const aceso = useEventos((s) => s.evento === "churrasco");
  const pegou = useEventos((s) => !!s.agora && s.pegouDia === horaBr(new Date(s.agora)).dia);
  const ocupado = useEventos((s) => s.ocupado);
  if (!aceso) return null;
  const pos = emPorcento(vb, I0 + 1.1, J, 100);
  return (
    <button
      type="button"
      className={"hall-placa hall-placa-churrasco" + (pegou ? " pegou" : "")}
      style={{ left: pct(pos.left), top: pct(pos.top) }}
      disabled={pegou || ocupado}
      onClick={(e) => {
        e.stopPropagation();
        void pegarEspetinho();
      }}
    >
      {pegou ? "Volte sábado que vem" : "Pegar espetinho"}
    </button>
  );
}
