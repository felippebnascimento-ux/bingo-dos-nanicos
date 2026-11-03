"use client";
/* Desenho de um emblema (SVG próprio): o aro da cor do nível (bronze, prata, ouro) e o símbolo do emblema.
   As cores são as variáveis --emblema-* de 34-perfil.css. Passar o mouse (ou focar, ou tocar no celular) mostra
   uma dica com o nome, o nível e quanto falta para o próximo; ela vai para o body para não sair cortada. */
import { useState } from "react";
import { createPortal } from "react-dom";
import { descreverEmblema, EMBLEMAS, NIVEL, progressoEmblema, type Emblema as TEmblema, type IdEmblema } from "./emblemas";

const SIMBOLO: Record<IdEmblema, React.ReactNode> = {
  online: <path d="M6 12.5 12 7l6 5.5M8 11.5V17h8v-5.5M11 17v-3h2v3" />,
  sequencia: <path d="M12 6c.8 2.6 3.8 4.1 3.8 7.4a3.8 3.8 0 0 1-7.6 0c0-1.5.8-2.6 1.5-3.4 0 1.5.8 2.2 1.5 2.2 0-2.2-.8-3.7.8-6.2z" />,
  tela: <path d="M6.5 8h11v7.5h-11zM10 18h4M12 15.5V18" />,
  coroa: <path d="M6.5 16.5 7.5 9l3 2.7L12 7.5l1.5 4.2 3-2.7 1 7.5z" />,
  respeito: <path d="M12 17.2s-5.2-3.1-5.2-6.6a2.8 2.8 0 0 1 5.2-1.5 2.8 2.8 0 0 1 5.2 1.5c0 3.5-5.2 6.6-5.2 6.6z" />,
  elo: <path d="M8.5 7.5h7l2.5 3-6 7-6-7zM6 10.5h12M10.5 7.5 12 17.5l1.5-10" />,
  cs: <path d="M12 6.5v3M12 14.5v3M6.5 12h3M14.5 12h3M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z" />,
  trofeu: <path d="M9 7h6v3.5a3 3 0 0 1-6 0zM9 8.5H7.2a2 2 0 0 0 2 2.6M15 8.5h1.8a2 2 0 0 1-2 2.6M12 13.5V16M9.5 17.5h5" />,
  truco: <path d="M9 6.5h6.5v11H9zM12.2 9.5l1 2.2-1 2.2-1-2.2z" />,
  bingo: <path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM11 9.8h1.6a1 1 0 0 1 0 2H11zm0 2h1.9a1.1 1.1 0 0 1 0 2.2H11z" />,
  cassino: <path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM12 6.5v2.7M12 14.8v2.7M6.5 12h2.7M14.8 12h2.7" />,
  cronista: <path d="M6.5 8h11v6.5h-6l-3 2.5v-2.5h-2z" />,
};

/** Largura da dica (igual à do CSS), para não sair da tela. */
const DICA_L = 230;

export function Emblema({ e, tam = 36 }: { e: TEmblema; tam?: number }) {
  const titulo = descreverEmblema(e);
  const [dica, setDica] = useState<{ x: number; y: number; acima: boolean } | null>(null);
  const mostrar = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - DICA_L / 2), window.innerWidth - DICA_L - 8);
    const acima = r.top > 150;
    setDica({ x, y: acima ? r.top - 8 : r.bottom + 8, acima });
  };
  const esconder = () => setDica(null);
  return (
    <span
      className={"emblema em-" + NIVEL[e.nivel]}
      role="img"
      aria-label={titulo}
      tabIndex={0}
      onMouseEnter={(ev) => mostrar(ev.currentTarget)}
      onMouseLeave={esconder}
      onFocus={(ev) => mostrar(ev.currentTarget)}
      onBlur={esconder}
    >
      <svg viewBox="0 0 24 24" width={tam} height={tam} aria-hidden="true">
        <circle cx="12" cy="12" r="11" className="em-aro" />
        <circle cx="12" cy="12" r="8.6" className="em-fundo" />
        <g className="em-simbolo">{SIMBOLO[e.id]}</g>
      </svg>
      {dica && createPortal(<DicaEmblema e={e} {...dica} />, document.body)}
    </span>
  );
}

function DicaEmblema({ e, x, y, acima }: { e: TEmblema; x: number; y: number; acima: boolean }) {
  const d = EMBLEMAS[e.id];
  const p = progressoEmblema(e);
  return (
    <span className={"em-dica" + (acima ? " acima" : "")} style={{ left: x, top: y }} aria-hidden="true">
      <b>{d.nome}</b>
      <span className={"em-dica-nivel em-" + NIVEL[e.nivel]}>{NIVEL[e.nivel]}</span>
      <span className="em-dica-tx">{d.texto(e.valor)}</span>
      {p ? (
        <>
          <span className="missao-barra">
            <i style={{ width: `${p.parte * 100}%` }} />
          </span>
          <small>
            {p.prox} com {p.meta.toLocaleString("pt-BR")}
          </small>
        </>
      ) : (
        e.nivel === 3 && <small>nível máximo</small>
      )}
    </span>
  );
}
