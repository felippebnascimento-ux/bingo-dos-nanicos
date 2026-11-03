/*
 * Acessórios da cabeça (espaço 'cabeca', seção 38 do SQL): boné, óculos, headset e cartola. São desenhados nas
 * medidas da célula do boneco (84×134, a cabeça no centro em x = 42, de y ≈ 7 a 53, os olhos em y ≈ 36), então a
 * mesma camada serve no K-FOFO, no quarto da ficha e na prévia da loja. As cores são as --loja-* do 30-loja.css.
 */

export type TipoAcessorio = "bone" | "oculos" | "headset" | "cartola";
const TIPOS = new Set<string>(["bone", "oculos", "headset", "cartola"]);
export const tipoAcessorio = (cor: string | undefined): TipoAcessorio | null => (cor && TIPOS.has(cor) ? (cor as TipoAcessorio) : null);
/** Vai no alto da cabeça (some quando há um enfeite dos troféus, que tem prioridade). */
export const noAlto = (t: TipoAcessorio) => t !== "oculos";

/** As formas na célula do boneco; de costas, os óculos não aparecem e o boné não mostra a aba. */
export function FormasAcessorio({ tipo, costas = false }: { tipo: TipoAcessorio; costas?: boolean }) {
  if (tipo === "oculos")
    return costas ? null : (
      <g>
        <rect x="26" y="32" width="14" height="9" rx="3.5" className="l-lente" />
        <rect x="44" y="32" width="14" height="9" rx="3.5" className="l-lente" />
        <path d="M40 35 Q42 33.5 44 35" fill="none" strokeWidth="1.6" className="l-armacao" />
        <path d="M28 34 L32 34" strokeWidth="1.2" strokeLinecap="round" className="l-brilho" />
        <path d="M46 34 L50 34" strokeWidth="1.2" strokeLinecap="round" className="l-brilho" />
      </g>
    );
  if (tipo === "bone")
    return (
      <g>
        <path d="M21 25 Q20 6 42 5 Q64 6 63 25 Z" className="l-bone" />
        <path d="M42 5 L42 25" strokeWidth="1" className="l-bone-costura" />
        <circle cx="42" cy="5.5" r="1.8" className="l-bone-botao" />
        {!costas && <path d="M17 24 L67 24 L69 29 Q42 32 15 29 Z" className="l-bone-aba" />}
        {costas && <rect x="36" y="20" width="12" height="4" rx="1.5" className="l-bone-aba" />}
      </g>
    );
  if (tipo === "headset")
    return (
      <g>
        <path d="M22 32 Q20 3 42 3 Q64 3 62 32" fill="none" strokeWidth="4" strokeLinecap="round" className="l-headset" />
        <rect x="16" y="27" width="9" height="15" rx="3.5" className="l-headset" />
        <rect x="59" y="27" width="9" height="15" rx="3.5" className="l-headset" />
        <rect x="17.5" y="30" width="2" height="9" rx="1" className="l-headset-luz" />
        <rect x="64.5" y="30" width="2" height="9" rx="1" className="l-headset-luz" />
        {!costas && <path d="M21 41 Q24 50 35 49" fill="none" strokeWidth="2" strokeLinecap="round" className="l-headset" />}
        {!costas && <circle cx="36" cy="49" r="2.4" className="l-headset" />}
      </g>
    );
  return (
    <g>
      <rect x="27" y="-22" width="30" height="36" rx="2" className="l-cartola" />
      <rect x="27" y="6" width="30" height="5" className="l-cartola-fita" />
      <ellipse cx="42" cy="14" rx="22" ry="4.5" className="l-cartola" />
      <path d="M30 -18 L30 4" strokeWidth="1.4" strokeLinecap="round" className="l-cartola-brilho" />
    </g>
  );
}

/** Camada por cima do boneco (mesmo tamanho da célula); `costas` quando ele está de costas. */
export function Acessorio({ tipo, costas }: { tipo: TipoAcessorio; costas: boolean }) {
  return (
    <svg className={"boneco-acessorio a-" + tipo} viewBox="0 0 84 134" aria-hidden="true">
      <FormasAcessorio tipo={tipo} costas={costas} />
    </svg>
  );
}

/** Prévia da loja e da mochila: só a cabeça, com o acessório. */
export function DesenhoAcessorio({ tipo }: { tipo: TipoAcessorio }) {
  return (
    <svg viewBox="8 -26 68 82" aria-hidden="true">
      <ellipse cx="42" cy="30" rx="20" ry="23" className="l-cabeca" />
      <FormasAcessorio tipo={tipo} />
    </svg>
  );
}
