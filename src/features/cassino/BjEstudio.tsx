"use client";
/*
 * O estúdio do blackjack ao vivo, como nos cassinos ao vivo de verdade: a parede do estúdio com as luzes, a placa
 * da mesa, o Veião de dealer em pé atrás da mesa (a arte dele de crupiê, `cassino/veiao-crupie.webp`) e a mesa em perspectiva:
 * feltro em meia-lua com as frases impressas, o acolchoado de couro, a lateral de madeira e a sombra no chão.
 * As mãos do Veião são recortes da arte, por cima do feltro, e se mexem: a da direita dá as cartas do sapato, a da
 * esquerda paga e recolhe. Só desenho: as cartas, as fichas e os lugares continuam nos `NaMesa` do Blackjack.tsx.
 * Duas mesas: a do computador (1600 × 950) e a do celular (1000 × 1350), cada uma no formato da tela (36-mesas.css).
 */
import { Crupie, type Gesto, type Pose } from "@/features/mesa/Crupie";

/* a arte do Veião de crupiê (colete, camisa, gravata-borboleta), feita pelo grupo no estilo das outras */
const ARTE = "/arte/cassino/veiao-crupie.webp";
/* as poses do Veião (também do grupo), encaixadas na arte parada pelo colete e pela calça */
const POSES: Record<string, Pose> = {
  dar: { arte: "/arte/cassino/veiao-dar.webp", x: -47, y: 3, w: 246.3, h: 435.6, ms: 280 },
  paga: { arte: "/arte/cassino/veiao-paga.webp", x: -26, y: 3, w: 253.1, h: 435.6, ms: 1300 },
  estourou: { arte: "/arte/cassino/veiao-paga.webp", x: -26, y: 3, w: 253.1, h: 435.6, ms: 1300 },
  comemora: { arte: "/arte/cassino/veiao-comemora.webp", x: -55, y: 2, w: 314.3, h: 435.6, ms: 1400 },
};

/* bx, by: a largura do acolchoado dos lados e na frente (na frente é mais grosso: está mais perto da câmera); lado: a lateral de madeira */
type Geo = { w: number; h: number; cx: number; cy: number; rx: number; ry: number; bx: number; by: number; lado: number; texto: boolean };
const PC: Geo = { w: 1600, h: 950, cx: 800, cy: 380, rx: 690, ry: 330, bx: 46, by: 78, lado: 62, texto: true };
const CEL: Geo = { w: 1000, h: 1350, cx: 500, cy: 365, rx: 560, ry: 700, bx: 40, by: 80, lado: 60, texto: false };

/** meia elipse de baixo (o feltro em meia-lua) com centro (cx, cy) */
const meia = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;

function MesaDesenho({ g, id }: { g: Geo; id: string }) {
  const { cx, cy, rx, ry, bx, by, lado } = g;
  return (
    <svg viewBox={`0 0 ${g.w} ${g.h}`} className={"bj-mesa-svg " + id} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-feltro`} cx="50%" cy="8%" r="95%">
          <stop offset="0" className="bj-st-feltro0" />
          <stop offset=".55" className="bj-st-feltro1" />
          <stop offset="1" className="bj-st-feltro2" />
        </radialGradient>
        <linearGradient id={`${id}-couro`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="bj-st-couro0" />
          <stop offset=".45" className="bj-st-couro1" />
          <stop offset="1" className="bj-st-couro2" />
        </linearGradient>
        <linearGradient id={`${id}-madeira`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="bj-st-madeira0" />
          <stop offset="1" className="bj-st-madeira1" />
        </linearGradient>
        <radialGradient id={`${id}-luz`} cx="50%" cy="20%" r="60%">
          <stop offset="0" className="bj-st-luz0" />
          <stop offset="1" className="bj-st-luz1" />
        </radialGradient>
        {/* a textura do feltro (fios) e o recorte da meia-lua, para a textura e o reflexo não saírem dela */}
        <filter id={`${id}-ruido`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0" />
        </filter>
        <clipPath id={`${id}-recorte`}>
          <path d={meia(cx, cy, rx, ry) + "Z"} />
        </clipPath>
        <linearGradient id={`${id}-reflexo`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="bj-st-luz1" />
          <stop offset=".5" className="bj-st-reflexo" />
          <stop offset="1" className="bj-st-luz1" />
        </linearGradient>
        <path id={`${id}-arco1`} d={meia(cx, cy, rx * 0.5, ry * 0.5)} />
        <path id={`${id}-arco2`} d={meia(cx, cy, rx * 0.4, ry * 0.36)} />
      </defs>
      {/* a sombra da mesa no chão do estúdio */}
      <ellipse cx={cx} cy={cy + ry + by + lado + 10} rx={rx + bx + 40} ry={50} className="bj-chao-sombra" />
      {/* a lateral de madeira, embaixo do acolchoado (a espessura da mesa) */}
      <path d={meia(cx, cy + lado, rx + bx, ry + by) + `L${cx + rx + bx} ${cy} L${cx - rx - bx} ${cy} Z`} fill={`url(#${id}-madeira)`} />
      <path d={meia(cx, cy + lado * 0.55, rx + bx, ry + by)} className="bj-madeira-fio" />
      <path d={meia(cx, cy + lado, rx + bx, ry + by)} className="bj-madeira-pe" />
      {/* o acolchoado de couro, em volta do feltro */}
      <path d={meia(cx, cy, rx + bx, ry + by) + "Z"} fill={`url(#${id}-couro)`} />
      <path d={meia(cx, cy, rx + bx * 0.5, ry + by * 0.5)} className="bj-costura" />
      <path d={meia(cx, cy, rx + bx * 0.25, ry + by * 0.22)} className="bj-couro-brilho" />
      {/* o feltro, com a luz do lustre de cima */}
      <path d={meia(cx, cy, rx, ry) + "Z"} fill={`url(#${id}-feltro)`} />
      <rect x={cx - rx} y={cy} width={rx * 2} height={ry} filter={`url(#${id}-ruido)`} clipPath={`url(#${id}-recorte)`} />
      <path d={meia(cx, cy, rx, ry) + "Z"} fill={`url(#${id}-luz)`} />
      {/* um brilho de luz que passa devagar pelo feltro */}
      <g clipPath={`url(#${id}-recorte)`}>
        <rect x={cx - rx} y={cy} width={rx * 0.6} height={ry} fill={`url(#${id}-reflexo)`} className="bj-reflexo" />
      </g>
      <path d={meia(cx, cy, rx - 4, ry - 4)} className="bj-feltro-sombra" />
      {/* a borda de trás, do lado do dealer, com o friso de madeira */}
      <rect x={cx - rx - bx} y={cy - 12} width={(rx + bx) * 2} height={14} rx={5} className="bj-borda-tras" />
      {/* o que vem impresso no feltro */}
      <path d={meia(cx, cy, rx * 0.86, ry * 0.86)} className="bj-fio-ouro" />
      <path d={meia(cx, cy, rx * 0.84, ry * 0.84)} className="bj-fio-ouro fino" />
      {g.texto && (
        <>
          <text className="bj-impresso grande">
            <textPath href={`#${id}-arco1`} startOffset="50%" textAnchor="middle">
              BLACKJACK PAGA 3 PARA 2
            </textPath>
          </text>
          <text className="bj-impresso">
            <textPath href={`#${id}-arco2`} startOffset="50%" textAnchor="middle">
              O DEALER PEDE ATÉ 16 E PARA EM 17
            </textPath>
          </text>
        </>
      )}
    </svg>
  );
}

type EstudioProps = {
  /** o que o Veião está falando (o balão) */
  fala?: string | null;
  /** para onde ele se vira: −1 (lugar 1, à esquerda dele na tela) a 1 (lugar 5) */
  olha?: number;
  /** reação: "estourou" (treme), "comemora" (pulinho), "paga" (a mão esquerda varre a mesa) */
  gesto?: string;
  /** a mão que dá as cartas: muda a `chave` a cada lote de cartas novas, `n` cartas nesse lote */
  dar?: { chave: string; n: number };
};

/** O fundo do blackjack: o estúdio, o Veião e a mesa (o resto do jogo vai por cima). */
export function EstudioBj({ fala, olha = 0, gesto, dar }: EstudioProps) {
    /* o que a cabeça faz agora: dar as cartas (uma vez por carta), a reação do fim, ou um aceno a cada fala nova */
  const rodada = dar?.chave.split("-")[0] ?? "";
  const gestoCabeca: Gesto | null = gesto
    ? { nome: gesto, chave: gesto + rodada }
    : dar && dar.n > 0
      ? { nome: "dar", chave: dar.chave, vezes: dar.n }
      : fala
        ? { nome: "fala", chave: fala }
        : null;
  return (
    <>
      <div className="bj-estudio" aria-hidden="true">
        <div className="bj-parede" />
        <div className="bj-luzes" />
        <div className="bj-placa">
          <small>Nanicos Live</small>
          <b>BLACKJACK</b>
        </div>
      </div>
      <MesaDesenho g={PC} id="bj-pc" />
      <MesaDesenho g={CEL} id="bj-cel" />
      {/* a luz atrás dele, na parede (atrás da mesa) */}
      <span className="bj-veiao-luz" />
      {/* o Veião: o corpo e as mãos parados na mesa, a cabeça vira para quem joga, acena, acompanha as cartas e reage */}
      <div className="bj-veiao">
        <Crupie arte={ARTE} w={201} mesa={288} maos={{ ate: 334, esq: 42, dir: 160 }} pescoco={[103, 144]} olha={olha} gesto={gestoCabeca} poses={POSES} />
        <span className="bj-veiao-nome">Veião · dealer</span>
      </div>
      {fala && (
        <span className="bj-fala" key={fala} role="status">
          {fala}
        </span>
      )}
    </>
  );
}
