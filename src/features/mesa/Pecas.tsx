/*
 * Peças da mesa de cartas, o padrão do truco, do pôquer e do blackjack (36-mesas.css):
 * a mesa (borda de couro costurada, aro de madeira, feltro com textura e luz de lustre), o lugar de cada nanico
 * (rosto, nome, fichas e o anel do tempo de quem está na vez), as fichas de cassino e o botão do dealer.
 * Posições em % da mesa (x, y do centro), para a mesa crescer e encolher junto com a tela.
 */
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AnimarMesa } from "./Animar";
import type { Rosto } from "@/lib/tipos";

/** A mesa: `oval` (truco, pôquer) ou `meia-lua` (blackjack). O que vai em cima dela entra como filho. */
export function Mesa({ forma = "oval", marca, children, className = "" }: { forma?: "oval" | "meia-lua"; marca?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <AnimarMesa>
      <div className={`mesa-cartas ${forma} ${className}`}>
        <div className="mesa-couro" aria-hidden="true">
          <div className="mesa-madeira">
            <div className="mesa-feltro">{marca && <span className="mesa-marca">{marca}</span>}</div>
          </div>
        </div>
        {children}
      </div>
    </AnimarMesa>
  );
}

/** Coloca algo em cima da mesa, centrado em (x%, y%). */
export function NaMesa({ x, y, children, className = "", style }: { x: number; y: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={"na-mesa " + className} style={{ left: `${x}%`, top: `${y}%`, ...style }}>
      {children}
    </div>
  );
}

type LugarProps = {
  f: Rosto | null | undefined;
  nome: string;
  /** embaixo do nome: as fichas, "parceiro", "desistiu"… */
  info?: ReactNode;
  /** na vez: o anel do tempo (de 0 a 1, quanto falta) */
  vez?: number | null;
  /** apagado (saiu da mão, desistiu) */
  fora?: boolean;
  /** etiqueta em cima (ALL-IN, MÃO…) */
  etiqueta?: ReactNode;
  /** balão de fala (TRUCO!, ENVIDO!) */
  fala?: ReactNode;
  eu?: boolean;
  /** pouco tempo: o anel fica vermelho e pulsa */
  urgente?: boolean;
  /** ganhou a mão: o rosto brilha */
  ganhou?: boolean;
};

/** Um lugar na mesa: o rosto com o anel do tempo, a placa com o nome e as fichas. */
export function Lugar({ f, nome, info, vez = null, fora, etiqueta, fala, eu, urgente, ganhou }: LugarProps) {
  return (
    <div className={"mesa-lugar" + (vez !== null ? " vez" : "") + (vez !== null && urgente ? " urgente" : "") + (fora ? " fora" : "") + (eu ? " eu" : "") + (ganhou ? " ganhou" : "")}>
      {fala && <span className="mesa-fala">{fala}</span>}
      <span className="mesa-rosto" style={vez !== null ? ({ "--falta": Math.max(0, Math.min(1, vez)) } as CSSProperties) : undefined}>
        {f ? <Avatar f={f} /> : <span className="av">{nome[0]}</span>}
        {etiqueta && <span className="mesa-etiqueta">{etiqueta}</span>}
      </span>
      <span className="mesa-placa">
        <b>{nome}</b>
        {info && <small>{info}</small>}
      </span>
    </div>
  );
}

/* cores das fichas por valor, como num cassino: 5 vermelha, 10 azul, 25 verde, 100 preta, 500 roxa, 1000 dourada */
const COR_FICHA: [number, string][] = [
  [1000, "ouro"],
  [500, "roxa"],
  [100, "preta"],
  [25, "verde"],
  [10, "azul"],
  [5, "vermelha"],
];
export const corDaFicha = (v: number) => (COR_FICHA.find(([min]) => v >= min) ?? COR_FICHA[COR_FICHA.length - 1])[1];

/** Uma ficha de cassino (com as listras na borda). */
export function Ficha({ valor, tam = 26 }: { valor: number; tam?: number }) {
  return (
    <svg className={"mesa-ficha f-" + corDaFicha(valor)} viewBox="0 0 40 40" width={tam} height={tam} aria-hidden="true">
      <circle cx="20" cy="20" r="19" className="fi-base" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x="17" y="1.5" width="6" height="7" rx="1" className="fi-listra" transform={`rotate(${i * 60} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="12.5" className="fi-miolo" />
      <circle cx="20" cy="20" r="10.5" className="fi-fio" />
    </svg>
  );
}

/** Uma pilha de fichas com o valor do lado (aposta de alguém, o pote). */
export function Pilha({ valor, max = 6 }: { valor: number; max?: number }) {
  /* quebra o valor nas fichas maiores primeiro, só para desenhar */
  const fichas: number[] = [];
  let resto = valor;
  for (const [v] of COR_FICHA)
    while (resto >= v && fichas.length < max) {
      fichas.push(v);
      resto -= v;
    }
  if (!fichas.length && valor > 0) fichas.push(5);
  return (
    <span className="mesa-pilha">
      <span className="mesa-pilha-fichas">
        {fichas.reverse().map((v, i) => (
          <Ficha key={i} valor={v} />
        ))}
      </span>
      <b>{valor.toLocaleString("pt-BR")}</b>
    </span>
  );
}

/** O botão do dealer (D), em relevo. */
export function BotaoDealer() {
  return (
    <span className="mesa-dealer" aria-label="Dealer" role="img">
      D
    </span>
  );
}
