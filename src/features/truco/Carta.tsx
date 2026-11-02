import { FrenteCarta } from "./Baralho";
import { trN, trS, type Carta as TCarta, type Naipe } from "./engine";

const TR_NAIPE_NOME: Record<Naipe, string> = { e: "espada", b: "basto", c: "copa", o: "ouro" };

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
  /* o desenho é o do baralho espanhol (Baralho.tsx) */
  const miolo = <FrenteCarta n={trN(c)} s={s} />;
  if (botao)
    return (
      <button type="button" data-c={c} className={cls} title={nome} aria-label={nome} onClick={onClick}>
        {miolo}
      </button>
    );
  return (
    <span className={cls} title={nome} aria-label={nome}>
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
