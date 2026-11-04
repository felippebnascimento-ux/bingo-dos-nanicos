"use client";
/*
 * O crupiê dos jogos ao vivo (o Veião no blackjack e o Henry na roleta), animado como os bonecos de recorte:
 * o corpo e as mãos ficam parados, apoiados na mesa (nada escorrega pelo feltro nem abre emenda na cintura), e só a
 * cabeça se mexe, girando no pescoço por baixo da gola, onde o corte não aparece.
 * - parado: respira de leve (a cabeça sobe e desce, balança um pouco);
 * - `olha` (−1 a 1): vira a cabeça para quem está na vez;
 * - `gesto` ({ nome, chave }): toca uma vez a cada `chave` nova (acena, dá as cartas, paga, comemora, treme…).
 * Gestos com pose (`poses`): o crupiê troca para outra arte dele (dando carta, pagando, comemorando…), desenhada no
 * mesmo enquadramento e encaixada pelo colete e pela calça, que são iguais em todas: na troca só os braços mudam.
 * A troca é um cruzamento rápido de transparência, fica o tempo do gesto e volta.
 * O desenho nunca é recriado: os gestos são da Web Animations API em cima do mesmo elemento, então nada pisca.
 * Quem pediu menos movimento vê o crupiê parado.
 */
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { reduzMovimento } from "@/lib/util";

export type Gesto = { nome: string; chave: string; vezes?: number };
/** uma pose: a arte e onde ela fica nas coordenadas da arte parada (x, y, largura, altura), e quanto tempo fica */
export type Pose = {
  arte: string; x: number; y: number; w: number; h: number; ms: number;
  /** usa a cabeça da arte parada por cima da pose (quando a pose saiu com o rosto diferente) */
  cabecaFixa?: boolean;
};

type Props = {
  arte: string;
  /** largura da arte (a altura é sempre 440) */
  w: number;
  /** onde a mesa corta o corpo (y da arte) e até onde descem as mãos, nos lados (x de dentro de cada mão) */
  mesa: number;
  maos: { ate: number; esq: number; dir: number };
  /** o pescoço: o ponto em que a cabeça gira, logo abaixo do queixo, na gola */
  pescoco: [number, number];
  /** quantos px a cabeça some aos poucos na beira, por cima do corpo (as duas se misturam e não fica fio no corte) */
  sobra?: number;
  olha?: number;
  gesto?: Gesto | null;
  /** as poses por nome de gesto (o gesto que tem pose troca de arte; o resto mexe só a cabeça) */
  poses?: Record<string, Pose>;
  className?: string;
};

/* o cruzamento entre a arte parada e a pose: a entrada desacelera no fim (a pose "chega") e a saída acelera no
   começo, como um movimento de verdade */
const TROCA_MS = 260;
const CHEGA = "cubic-bezier(.22,.8,.3,1)";
const VAI = "cubic-bezier(.6,0,.75,.3)";
/* os gestos da cabeça: começam e terminam devagar */
const SUAVE = "cubic-bezier(.45,0,.25,1)";

/* os gestos da cabeça: quadros de `transform` em volta do pescoço */
const GESTOS: Record<string, { quadros: Keyframe[]; ms: number }> = {
  /* dá uma carta: olha rápido para o sapato (à direita dele) e volta */
  dar: { quadros: [{ transform: "none" }, { transform: "rotate(1.6deg) translateX(.6px)" }, { transform: "none" }], ms: 280 },
  /* paga e recolhe: dois acenos para baixo */
  paga: { quadros: [{ transform: "none" }, { transform: "translateY(1.5px) rotate(-1.4deg)" }, { transform: "none" }, { transform: "translateY(1.5px) rotate(1.4deg)" }, { transform: "none" }], ms: 1100 },
  /* estourou: balança a cabeça, sem acreditar */
  estourou: { quadros: [{ transform: "none" }, { transform: "rotate(-2deg)" }, { transform: "rotate(2deg)" }, { transform: "rotate(-1.6deg)" }, { transform: "rotate(1.2deg)" }, { transform: "none" }], ms: 800 },
  /* blackjack da casa: dois pulinhos */
  comemora: { quadros: [{ transform: "none" }, { transform: "translateY(-2px) rotate(-1deg)" }, { transform: "none" }, { transform: "translateY(-1.5px) rotate(1deg)" }, { transform: "none" }], ms: 800 },
  /* abriu a rodada / falou: um aceno de cabeça */
  acena: { quadros: [{ transform: "none" }, { transform: "translateY(1.5px) rotate(-1.2deg)" }, { transform: "none" }], ms: 520 },
  fala: { quadros: [{ transform: "none" }, { transform: "rotate(-1.4deg)" }, { transform: "rotate(1deg)" }, { transform: "none" }], ms: 700 },
  /* lançou a bola na roda (à esquerda dele, na tela à direita): acompanha com a cabeça */
  lanca: { quadros: [{ transform: "none" }, { transform: "rotate(-1.2deg) translateX(-.6px)" }, { transform: "rotate(2deg) translateX(1px)" }, { transform: "none" }], ms: 900 },
};

export function Crupie({ arte, w, mesa, maos, pescoco, sobra = 7, olha = 0, gesto, poses = {}, className = "" }: Props) {
  const id = useId().replace(/:/g, "");
  const cabeca = useRef<SVGGElement>(null);
  const parado = useRef<SVGGElement>(null);
  const emPose = useRef<Record<string, SVGGElement | null>>({});
  /* a pose na tela agora (para estender em vez de recomeçar quando o mesmo gesto chega de novo) */
  const naTela = useRef<{ nome: string; ate: number; anims: Animation[] } | null>(null);
  const [px, py] = pescoco;

  /* o gesto toca a cada chave nova, por cima do que já está na tela (sem recriar nada) */
  const chave = gesto ? `${gesto.nome}:${gesto.chave}` : "";
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    if (!gesto || reduzMovimento()) return;
    const vezes = Math.max(1, Math.min(12, gesto.vezes ?? 1));
    const pose = poses[gesto.nome];
    const el = pose ? emPose.current[gesto.nome] : null;
    if (pose && el && parado.current) {
      /* a pose entra por cima da arte parada (que só some quando a pose está inteira: nada fica transparente), fica o
         tempo do gesto e sai por cima dela de novo. Se a mesma pose já está na tela, só estende o tempo, sem piscar */
      const agora = performance.now();
      const atual = naTela.current;
      const continua = !!atual && atual.nome === gesto.nome && agora < atual.ate;
      atual?.anims.forEach((x) => x.cancel());
      const entrada = continua ? 0 : TROCA_MS;
      const total = entrada + pose.ms * vezes + TROCA_MS;
      const a = entrada / total, b = 1 - TROCA_MS / total;
      const opcoes = { duration: total, easing: "linear" };
      const entra = el.animate(
        [{ opacity: continua ? 1 : 0, easing: CHEGA }, { opacity: 1, offset: a }, { opacity: 1, offset: b, easing: VAI }, { opacity: 0 }],
        opcoes,
      );
      const sai = parado.current.animate(
        [{ opacity: continua ? 0 : 1 }, { opacity: continua ? 0 : 1, offset: a }, { opacity: 0, offset: a }, { opacity: 0, offset: b }, { opacity: 1, offset: b }, { opacity: 1 }],
        opcoes,
      );
      naTela.current = { nome: gesto.nome, ate: agora + total - TROCA_MS, anims: [entra, sai] };
      return;
    }
    const g = GESTOS[gesto.nome];
    if (!cabeca.current || !g) return;
    const anim = cabeca.current.animate(g.quadros, { duration: g.ms * 1.15, iterations: vezes, easing: SUAVE, composite: "add" });
    return () => anim.cancel();
    // só quando a chave muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => () => naTela.current?.anims.forEach((x) => x.cancel()), []);

  /* o corpo: tudo do pescoço para baixo até a mesa, e as mãos dos lados até a ponta dos dedos */
  const corpo = `M0 ${py - sobra - 1} H${w} V${maos.ate} H${maos.dir} V${mesa} H${maos.esq} V${maos.ate} H0 Z`;
  /* a cabeça: tudo acima do corte. O corte passa logo abaixo das pontas da gola e acima da gravata, onde só cruza
     linhas quase em pé (o contorno da gola): girando pouco em volta de um ponto do próprio corte, essas linhas só
     deslizam ao longo de si mesmas e a emenda não aparece */
  /* as poses vão até a mesa como o corpo, mas os braços podem sair dos lados da arte (cartas, fichas, mãos para cima) */
  const corpoPose = `M-200 -100 H${w + 200} V${maos.ate} H${maos.dir} V${mesa} H${maos.esq} V${maos.ate} H-200 Z`;
  const giro = { "--olha": Math.max(-1, Math.min(1, olha)), transformOrigin: `${px}px ${py}px` } as CSSProperties;
  return (
    <svg viewBox={`0 0 ${w} 440`} className={"crupie " + className} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-corpo`}>
          <path d={corpo} />
        </clipPath>
        <clipPath id={`${id}-pose`} clipPathUnits="userSpaceOnUse">
          <path d={corpoPose} />
        </clipPath>
        {/* a cabeça some aos poucos nos últimos `sobra` px, por cima do corpo, que sobe por baixo dela até ali */}
        <linearGradient id={`${id}-beira`} gradientUnits="userSpaceOnUse" x1="0" y1={py - sobra} x2="0" y2={py}>
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={`${id}-cabeca`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height="440">
          <rect x="0" y="0" width={w} height={py} fill={`url(#${id}-beira)`} />
          <rect x="0" y="0" width={w} height={py - sobra} fill="white" />
        </mask>
      </defs>
      <ellipse cx={maos.esq / 2} cy={maos.ate - 4} rx={maos.esq / 2 + 2} ry="5" className="crupie-sombra" />
      <ellipse cx={(maos.dir + w) / 2} cy={maos.ate - 4} rx={(w - maos.dir) / 2 + 2} ry="5" className="crupie-sombra" />
      <g ref={parado}>
      <image href={arte} width={w} height="440" clipPath={`url(#${id}-corpo)`} />
      {/* a cabeça, em três camadas: para onde olha (transição), o gesto (animação) e a respiração (sempre) */}
      <g className="crupie-olha" style={giro}>
        <g ref={cabeca} className="crupie-gesto" style={{ transformOrigin: `${px}px ${py}px` }}>
          <g className="crupie-respira" style={{ transformOrigin: `${px}px ${py}px` }}>
            <image href={arte} width={w} height="440" mask={`url(#${id}-cabeca)`} />
          </g>
        </g>
      </g>
      </g>
      {/* as poses, já carregadas e invisíveis (a troca não espera a imagem baixar) */}
      {Object.entries(poses).map(([nome, p]) => (
        <g
          key={nome}
          ref={(el) => {
            emPose.current[nome] = el;
          }}
          className="crupie-pose"
          clipPath={`url(#${id}-pose)`}
        >
          <image href={p.arte} x={p.x} y={p.y} width={p.w} height={p.h} />
          {p.cabecaFixa && <image href={arte} width={w} height="440" mask={`url(#${id}-cabeca)`} />}
        </g>
      ))}
    </svg>
  );
}
