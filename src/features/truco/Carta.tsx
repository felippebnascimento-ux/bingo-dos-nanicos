import type { CSSProperties, ReactNode } from "react";
import { trN, trS, type Carta as TCarta, type Naipe } from "./engine";

/* cor de cada naipe: vai na variável --nc que o CSS da carta usa */
const TR_COR: Record<Naipe, string> = { e: "#3E6FB0", b: "#4E7D3A", c: "#C0392B", o: "#C9952B" };
const TR_NAIPE_NOME: Record<Naipe, string> = { e: "espada", b: "basto", c: "copa", o: "ouro" };

const TR_ICONE: Record<Naipe, ReactNode> = {
  e: (
    <>
      <path d="M12 2l2.2 3.2V15h-4.4V5.2z" fill="currentColor" />
      <path d="M7 15.5h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 16v5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  b: (
    <>
      <path d="M10.2 3.5c1.6-1.4 4.4-.6 4.3 1.6l-.7 13.6c-.1 2.4-4.2 2.4-4.3 0L8.9 6.3c0-1.2.4-2.1 1.3-2.8z" fill="currentColor" />
      <circle cx="11" cy="8" r="1" fill="#fff" opacity=".5" />
      <circle cx="12.8" cy="12" r="1" fill="#fff" opacity=".5" />
    </>
  ),
  c: (
    <>
      <path d="M5.5 4h13v3.2a6.5 6.5 0 0 1-13 0z" fill="currentColor" />
      <path d="M12 13.5v4.5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M7.5 20.5h9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  o: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".6" />
      <circle cx="12" cy="12" r="1.6" fill="#fff" opacity=".6" />
    </>
  ),
};

export function trNomeCarta(c: TCarta) {
  if (c === "1e") return "Espadão (1 de espada)";
  if (c === "1b") return "Bastião (1 de basto)";
  if (c === "7e") return "7 de espada";
  if (c === "7o") return "7 de ouro";
  return `${trN(c)} de ${TR_NAIPE_NOME[trS(c)]}`;
}

type Props = { c: TCarta; peq?: boolean; ganha?: boolean; indo?: boolean; onClick?: () => void; botao?: boolean };

/** Uma carta virada para cima. `botao` = carta da minha mão (dá para clicar). */
export function Carta({ c, peq, ganha, indo, botao, onClick }: Props) {
  const s = trS(c), nome = trNomeCarta(c);
  const cls = ["tc", peq && "peq", ganha && "ganha", indo && "indo"].filter(Boolean).join(" ");
  const style = { "--nc": TR_COR[s] } as CSSProperties;
  const miolo = (
    <>
      <b className="v">{trN(c)}</b>
      <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
        {TR_ICONE[s]}
      </svg>
      <b className="v v2">{trN(c)}</b>
    </>
  );
  if (botao)
    return (
      <button type="button" data-c={c} className={cls} style={style} title={nome} aria-label={nome} onClick={onClick}>
        {miolo}
      </button>
    );
  return (
    <span className={cls} style={style} title={nome} aria-label={nome}>
      {miolo}
    </span>
  );
}

/** Cartas viradas para baixo (as dos outros). */
export function Costas({ n, mini = true }: { n: number; mini?: boolean }) {
  return (
    <>
      {Array.from({ length: Math.max(0, Math.min(3, n)) }, (_, i) => (
        <span key={i} className={"tc costas" + (mini ? " mini" : "")} aria-hidden="true" />
      ))}
    </>
  );
}
