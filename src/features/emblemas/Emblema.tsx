"use client";
/* Desenho de um emblema (SVG próprio, viewBox 64): cada emblema tem a silhueta, as cores e a ilustração dele
   (desenhos.tsx). O nível aparece no aro de metal (bronze, prata, ouro, com luz de cima à esquerda) e nos enfeites:
   a prata ganha os louros e o ouro, louros, a fita com três estrelas e o brilho. Elo e GC usam o brasão oficial e o
   círculo da GC. As cores são as variáveis --emblema-* e --em-* de 34-perfil.css. Passar o mouse (ou focar, ou tocar
   no celular) mostra uma dica com o nome, o nível e quanto falta para o próximo; ela vai para o body para não sair
   cortada. */
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { TIERS } from "@/features/ficha/numeros";
import { BrasaoElo, NivelGc } from "./brasao";
import { CAULE, DESENHOS, ESTRELA_FITA, faisca, FOLHAS } from "./desenhos";
import { descreverEmblema, EMBLEMAS, NIVEL, progressoEmblema, type Emblema as TEmblema } from "./emblemas";

/** Largura da dica (igual à do CSS), para não sair da tela. */
const DICA_L = 230;

/** O desenho de um emblema comum (todos menos elo e GC). `id` deixa os gradientes únicos: as abas ficam montadas. */
function Desenho({ e, tam, id }: { e: TEmblema; tam: number; id: string }) {
  if (e.id === "elo" || e.id === "gc") return null;
  const d = DESENHOS[e.id];
  const f = d.forma;
  const u = (s: string) => `url(#${id}${s})`;
  const [cx, cy] = f.c ?? [32, 29];
  const encolher = `translate(${cx} ${cy}) scale(${f.k ?? 0.8}) translate(${-cx} ${-cy})`;
  const face = f.dentro ? <path d={f.dentro} /> : <path d={f.fora} transform={encolher} />;
  return (
    <svg viewBox="0 0 64 64" width={tam} height={tam} aria-hidden="true">
      <defs>
        {/* metal: claro em cima à esquerda, escuro embaixo à direita; o sulco em volta da face é o contrário */}
        <linearGradient id={id + "m"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="em-c-claro" />
          <stop offset=".45" className="em-c-meio" />
          <stop offset="1" className="em-c-escuro" />
        </linearGradient>
        <linearGradient id={id + "s"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="em-c-escuro" />
          <stop offset="1" className="em-c-claro" />
        </linearGradient>
        <radialGradient id={id + "f"} cx=".38" cy=".3" r=".8">
          <stop offset="0" className="em-fa" />
          <stop offset="1" className="em-fb" />
        </radialGradient>
        <clipPath id={id + "k"}>{face}</clipPath>
        <path id={id + "p"} d={f.fora} fillRule={f.furo ? "evenodd" : undefined} />
      </defs>
      {e.nivel >= 2 && (
        <g className="em-louro">
          {[0, 1].map((lado) => (
            <g key={lado} transform={lado ? "matrix(-1 0 0 1 64 0)" : undefined}>
              <path d={CAULE} fill="none" stroke={u("m")} strokeWidth="1.6" strokeLinecap="round" />
              {FOLHAS.map((l, i) => (
                <ellipse key={i} cx={l.x} cy={l.y} rx="4.3" ry="1.9" fill={u("m")} transform={`rotate(${l.r} ${l.x} ${l.y})`} />
              ))}
            </g>
          ))}
        </g>
      )}
      <use href={`#${id}p`} className="em-chao" transform="translate(0 1.6)" />
      {d.atras?.(u("m"))}
      <use href={`#${id}p`} fill={u("m")} stroke={u("m")} strokeWidth="2" strokeLinejoin="round" />
      <g fill={u("f")} stroke={u("s")} strokeWidth="1.6" strokeLinejoin="round">
        {face}
      </g>
      {/* a ilustração duas vezes: uma escura deslocada (o relevo) e a de verdade por cima */}
      <g className="em-sombra" transform="translate(.6 1)">
        {d.arte(u("k"))}
      </g>
      {d.arte(u("k"))}
      <ellipse cx="23" cy="16" rx="15" ry="7.5" className="em-gloss" transform="rotate(-28 23 16)" clipPath={u("k")} />
      {d.frente}
      {e.nivel === 3 && (
        <>
          <path d="M7 53.5h9v7.5H7l2.6-3.75zM57 53.5h-9v7.5h9l-2.6-3.75z" className="em-fita-ponta" />
          <path d="M14 52h36v9H14z" className="em-fita" />
          {[24, 32, 40].map((x) => (
            <path key={x} d={ESTRELA_FITA(x)} className="em-astro" />
          ))}
          <path d={faisca(51, 9, 5)} className="em-faisca" />
          <path d={faisca(13.5, 14, 3)} className="em-faisca" />
        </>
      )}
    </svg>
  );
}

/** `detalhe`: o texto da dica no lugar do padrão (o elo com divisão e fila, "Platina IV na flex"). */
export function Emblema({ e, tam = 36, detalhe }: { e: TEmblema; tam?: number; detalhe?: string }) {
  const titulo = detalhe ? `${EMBLEMAS[e.id].nome}: ${detalhe}` : descreverEmblema(e);
  /* elo e GC são desenhados com o brasão oficial e o círculo da GC, no lugar da medalha */
  const imagem = e.id === "elo" || e.id === "gc";
  const [dica, setDica] = useState<{ x: number; y: number; acima: boolean } | null>(null);
  const mostrar = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - DICA_L / 2), window.innerWidth - DICA_L - 8);
    const acima = r.top > 150;
    setDica({ x, y: acima ? r.top - 8 : r.bottom + 8, acima });
  };
  const esconder = () => setDica(null);
  /* o useId tem caracteres que não servem num url(#…) */
  const id = "em" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span
      className={"emblema " + (imagem ? "em-imagem" : `em-${NIVEL[e.nivel]} em-d-${e.id}`)}
      role="img"
      aria-label={titulo}
      tabIndex={0}
      onMouseEnter={(ev) => mostrar(ev.currentTarget)}
      onMouseLeave={esconder}
      onFocus={(ev) => mostrar(ev.currentTarget)}
      onBlur={esconder}
    >
      {e.id === "elo" ? (
        <BrasaoElo tier={TIERS[e.valor - 1]} tam={tam} />
      ) : e.id === "gc" ? (
        <NivelGc n={e.valor} tam={tam} />
      ) : (
        <Desenho e={e} tam={tam} id={id} />
      )}
      {dica && createPortal(<DicaEmblema e={e} detalhe={detalhe} {...dica} />, document.body)}
    </span>
  );
}

function DicaEmblema({ e, x, y, acima, detalhe }: { e: TEmblema; x: number; y: number; acima: boolean; detalhe?: string }) {
  const d = EMBLEMAS[e.id];
  const p = progressoEmblema(e);
  return (
    <span className={"em-dica" + (acima ? " acima" : "")} style={{ left: x, top: y }} aria-hidden="true">
      <b>{d.nome}</b>
      {e.id !== "elo" && e.id !== "gc" && <span className={"em-dica-nivel em-" + NIVEL[e.nivel]}>{NIVEL[e.nivel]}</span>}
      <span className="em-dica-tx">{detalhe ?? d.texto(e.valor)}</span>
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
