"use client";
/*
 * O que fica em volta das mesas de cartas, no jeito dos cassinos online (36-mesas.css):
 * a barra de cima (o jogo, o que está acontecendo com a barra do tempo, a carteira e quanto tenho na mesa), a faixa
 * do histórico, o aviso grande em cima do feltro, os botões redondos de decisão, a fileira de fichas e a bolinha da
 * soma. Só mostram: quem decide é o banco.
 */
import type { CSSProperties, ReactNode } from "react";
import { Ficha } from "./Pecas";

const fmt = (n: number) => n.toLocaleString("pt-BR");
/* --f é o quanto falta (0 a 1): a barra encolhe por transform, que a placa de vídeo anima sem recalcular a página */
const pct = (f: number | null | undefined) => ({ "--f": Math.max(0, Math.min(1, f ?? 0)).toFixed(4) }) as CSSProperties;

/** A barra do tempo (de 0 a 1, quanto falta). */
export function BarraTempo({ falta, urgente, className = "" }: { falta: number | null | undefined; urgente?: boolean; className?: string }) {
  return (
    <span className={"mesa-prazo " + (urgente ? "urgente " : "") + className} style={pct(falta)} aria-hidden="true">
      <i />
    </span>
  );
}

type BarraProps = {
  icone: ReactNode;
  nome: string;
  sub?: ReactNode;
  /** o que está acontecendo ("SUA VEZ · 11 s") */
  status?: ReactNode;
  /** de 0 a 1, quanto falta do tempo; null esconde a barra */
  falta?: number | null;
  urgente?: boolean;
  carteira?: number;
  naMesa?: number | null;
  /** no lugar do status (o placar do truco) */
  centro?: ReactNode;
  /** as regras, no botão "?" */
  regras?: ReactNode;
  /** à esquerda, antes do jogo (o "← Mesas") */
  voltar?: ReactNode;
};

/** A barra de cima do jogo. */
export function BarraJogo({ icone, nome, sub, status, falta, urgente, carteira, naMesa, centro, regras, voltar }: BarraProps) {
  return (
    <div className="mesa-hud">
      <div className="mesa-hud-jogo">
        {voltar}
        <i aria-hidden="true">{icone}</i>
        <div>
          <b>{nome}</b>
          {sub && <small>{sub}</small>}
        </div>
        {regras && (
          <details className="mesa-regras">
            <summary aria-label="Regras do jogo">?</summary>
            <div className="mesa-regras-txt">{regras}</div>
          </details>
        )}
      </div>
      <div className="mesa-hud-status" role="status">
        {centro ?? <b>{status}</b>}
        {falta != null && <BarraTempo falta={falta} urgente={urgente} />}
      </div>
      <div className="mesa-hud-carteira">
        {carteira != null && (
          <span className="ouro">
            <small>Carteira</small>
            <b>{fmt(carteira)}</b>
          </span>
        )}
        {naMesa != null && (
          <span>
            <small>Na mesa</small>
            <b>{fmt(naMesa)}</b>
          </span>
        )}
      </div>
    </div>
  );
}

/** A faixa do histórico ("Últimas do dealer: 22 19 BJ…"). `tom`: v = ganhou, p = perdeu/estourou, o = destaque. */
export function Historico({ rotulo, itens }: { rotulo: string; itens: { txt: string; tom?: "v" | "p" | "o"; dica?: string }[] }) {
  if (!itens.length) return null;
  return (
    <div className="mesa-hist">
      <span>{rotulo}</span>
      {itens.map((x, i) => (
        <b key={i} className={x.tom} title={x.dica}>
          {x.txt}
        </b>
      ))}
    </div>
  );
}

/** O aviso grande em cima do feltro ("FAÇAM SUAS APOSTAS", "VOCÊ GANHOU 200"). */
export function Faixa({ titulo, sub, falta, tom }: { titulo: ReactNode; sub?: ReactNode; falta?: number | null; tom?: "ganhou" | "perdeu" }) {
  return (
    <div className={"mesa-faixa " + (tom ?? "")}>
      <b>{titulo}</b>
      {sub && <small>{sub}</small>}
      {falta != null && <BarraTempo falta={falta} urgente={falta < 0.3} />}
    </div>
  );
}

/** A bolinha da soma ao lado das cartas (branca; BJ dourada; estourou vermelha). */
export function Soma({ valor, tipo, className = "" }: { valor: ReactNode; tipo?: "bj" | "estourou"; className?: string }) {
  return <span className={"mesa-total " + (tipo ?? "") + " " + className}>{valor}</span>;
}

type RedondoProps = { tipo: "pedir" | "parar" | "dobrar" | "dividir"; icone: ReactNode; rotulo: string; sub?: ReactNode; onClick: () => void; disabled?: boolean };

/** Botão redondo de decisão (Pedir, Parar, Dobrar, Dividir), como nas mesas online. */
export function BotaoRedondo({ tipo, icone, rotulo, sub, onClick, disabled }: RedondoProps) {
  return (
    <button type="button" className={"mesa-dec " + tipo} onClick={onClick} disabled={disabled}>
      <i aria-hidden="true">{icone}</i>
      {rotulo}
      {sub && <small>{sub}</small>}
    </button>
  );
}

/** A fileira de fichas para montar a aposta (cada toque soma a ficha). */
export function EscolherFichas({ valores, onFicha, desligadas }: { valores: number[]; onFicha: (v: number) => void; desligadas?: (v: number) => boolean }) {
  return (
    <div className="mesa-fichas" role="group" aria-label="Fichas">
      {valores.map((v) => (
        <button key={v} type="button" className="mesa-ficha-bt" onClick={() => onFicha(v)} disabled={desligadas?.(v)} aria-label={`Somar ${v}`}>
          <Ficha valor={v} tam={46} />
          <b>{v}</b>
        </button>
      ))}
    </div>
  );
}

/** Botão pequeno redondo com rótulo embaixo (Desfazer, Repetir, Dobrar a aposta). */
export function BotaoMini({ icone, rotulo, onClick, disabled }: { icone: ReactNode; rotulo: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="mesa-mini" onClick={onClick} disabled={disabled}>
      <i aria-hidden="true">{icone}</i>
      {rotulo}
    </button>
  );
}
