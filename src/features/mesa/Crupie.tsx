"use client";
/*
 * O crupiê dos jogos ao vivo (o Veião no blackjack e o Henry na roleta), animado como os bonecos de recorte:
 * o corpo e as mãos ficam parados, apoiados na mesa (nada escorrega pelo feltro nem abre emenda na cintura), e só a
 * cabeça se mexe, girando no pescoço por baixo da gola, onde o corte não aparece.
 * - parado: respira de leve (a cabeça sobe e desce, balança um pouco);
 * - `olha` (−1 a 1): vira a cabeça para quem está na vez;
 * - `gesto` ({ nome, chave }): toca uma vez a cada `chave` nova (acena, dá as cartas, paga, comemora, treme…).
 * Gestos com pose (`poses`): o crupiê toca uma sequência de quadros desenhados (dando carta, recolhendo, lançando a
 * bolinha…), como num desenho animado. Os quadros foram desenhados no mesmo enquadramento e encaixados pelo colete e
 * pela calça, que são iguais em todos: na troca só os braços mudam. De um quadro para o próximo há um cruzamento
 * curto, e o de baixo só some quando o de cima está inteiro (nada fica transparente). A cabeça é sempre a da arte
 * parada, por cima de tudo, então o rosto não troca entre os quadros e continua respirando e olhando.
 * O desenho nunca é recriado: os gestos são da Web Animations API em cima dos mesmos elementos, então nada pisca.
 * Quem pediu menos movimento vê o crupiê parado.
 */
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { reduzMovimento } from "@/lib/util";

export type Gesto = { nome: string; chave: string; vezes?: number };
/** um quadro: a arte e onde ela fica nas coordenadas da arte parada (x, y, largura, altura) */
export type Quadro = { arte: string; x: number; y: number; w: number; h: number };
/** uma pose: os quadros em ordem, quanto tempo a sequência leva (`ms`) e quantos quadros do fim são a volta para a
    posição parada (`volta`): com `vezes` (dar várias cartas), o começo se repete e a volta toca uma vez só */
export type Pose = { quadros: Quadro[]; ms: number; volta?: number };

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
  /** as poses por nome de gesto (o gesto que tem pose toca os quadros dela; a cabeça faz o gesto dela também) */
  poses?: Record<string, Pose>;
  /** de onde até onde vai a cabeça na largura da arte (os quadros não mostram a cabeça deles nessa faixa) */
  rosto?: [number, number];
  className?: string;
};

/* o cruzamento de um quadro para o próximo (no máximo TROCA_MS, e nunca mais que 60% do tempo de cada quadro) */
const TROCA_MS = 80;
const TROCA = "cubic-bezier(.4,0,.2,1)";
/* os gestos da cabeça: começam e terminam devagar */
const SUAVE = "cubic-bezier(.45,0,.25,1)";

/* os gestos da cabeça: quadros de `transform` em volta do pescoço */
const GESTOS: Record<string, { quadros: Keyframe[]; ms: number }> = {
  /* dá uma carta: olha rápido para o sapato (à direita dele) e volta */
  dar: { quadros: [{ transform: "none" }, { transform: "rotate(1.6deg) translateX(.6px)" }, { transform: "none" }], ms: 560 },
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

/**
 * Monta as animações de opacidade de uma sequência: começa no que está na tela (`atual`: o índice do quadro, ou −1
 * para a arte parada), passa por cada quadro de `seq` e volta para a parada. Quem está mais acima na página entra por
 * cima do outro, que só some depois; quem está abaixo aparece inteiro por baixo e o de cima some por cima dele.
 */
function sequencia(todos: (SVGGElement | null)[], parado: SVGGElement, seq: number[], quadroMs: number, atual: number): Animation[] {
  const el = (i: number) => (i < 0 ? parado : todos[i]);
  const T = Math.min(TROCA_MS, quadroMs * 0.6);
  const pontos = new Map<number, [number, number][]>();
  const marca = (i: number, t: number, o: number) => {
    if (!pontos.has(i)) pontos.set(i, [[0, i === atual ? 1 : 0]]);
    pontos.get(i)!.push([t, o]);
  };
  marca(atual, 0, 1);
  if (atual >= 0) marca(-1, 0, 0);
  let t = 0;
  for (const prox of [...seq, -1]) {
    if (prox !== atual) {
      if (prox > atual) {
        marca(prox, t, 0); marca(prox, t + T, 1);
        marca(atual, t + T, 1); marca(atual, t + T, 0);
      } else {
        marca(prox, t, 0); marca(prox, t, 1);
        marca(atual, t, 1); marca(atual, t + T, 0);
      }
      atual = prox;
    }
    t += prox < 0 ? T : quadroMs;
  }
  const total = Math.max(t, 1);
  const anims: Animation[] = [];
  for (const [i, ps] of pontos) {
    const alvo = el(i);
    if (!alvo) continue;
    ps.sort((a, b) => a[0] - b[0]);
    const fim = ps[ps.length - 1][1];
    const quadros: Keyframe[] = ps.map(([tt, o]) => ({ offset: Math.min(1, tt / total), opacity: o, easing: TROCA }));
    quadros.push({ offset: 1, opacity: fim });
    anims.push(alvo.animate(quadros, { duration: total, easing: "linear" }));
  }
  return anims;
}

export function Crupie({ arte, w, mesa, maos, pescoco, sobra = 7, olha = 0, gesto, poses = {}, rosto, className = "" }: Props) {
  const id = useId().replace(/:/g, "");
  const cabeca = useRef<SVGGElement>(null);
  const parado = useRef<SVGGElement>(null);
  /* todos os quadros de todas as poses, na ordem da página; `inicio[nome]` é onde começam os da pose */
  const todos = useRef<(SVGGElement | null)[]>([]);
  const nomes = Object.keys(poses);
  const inicio: Record<string, number> = {};
  let n = 0;
  for (const nome of nomes) {
    inicio[nome] = n;
    n += poses[nome].quadros.length;
  }
  /* o que está tocando agora (para seguir do quadro que está na tela quando chega outro gesto) */
  const tocando = useRef<Animation[]>([]);
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
    if (pose && parado.current) {
      /* parte do quadro que está mais visível agora (o de cima, se dois estão cruzando) */
      let atual = -1;
      todos.current.forEach((el, i) => {
        if (el && Number(getComputedStyle(el).opacity) > 0.5) atual = i;
      });
      tocando.current.forEach((a) => a.cancel());
      const q = pose.quadros.map((_, k) => inicio[gesto.nome] + k);
      const volta = Math.min(pose.volta ?? 0, q.length - 1);
      const meio = q.slice(0, q.length - volta);
      const seq = [...Array.from({ length: vezes }, () => meio).flat(), ...q.slice(q.length - volta)];
      tocando.current = sequencia(todos.current, parado.current, seq, pose.ms / q.length, atual);
    }
    /* e a cabeça faz o gesto dela por cima (acena, acompanha a carta, balança) */
    const g = GESTOS[gesto.nome];
    if (!cabeca.current || !g) return;
    const anim = cabeca.current.animate(g.quadros, { duration: g.ms * 1.15, iterations: vezes, easing: SUAVE, composite: "add" });
    return () => anim.cancel();
    // só quando a chave muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => () => tocando.current.forEach((x) => x.cancel()), []);

  /* o corpo: tudo do pescoço para baixo até a mesa, e as mãos dos lados até a ponta dos dedos */
  const corpo = `M0 ${py - sobra - 1} H${w} V${maos.ate} H${maos.dir} V${mesa} H${maos.esq} V${maos.ate} H0 Z`;
  /* a cabeça: tudo acima do corte. O corte passa logo abaixo das pontas da gola e acima da gravata, onde só cruza
     linhas quase em pé (o contorno da gola): girando pouco em volta de um ponto do próprio corte, essas linhas só
     deslizam ao longo de si mesmas e a emenda não aparece */
  /* os quadros vão até a mesa como o corpo, mas os braços podem sair dos lados da arte (cartas, fichas, mãos para
     cima); a cabeça deles fica de fora (o recorte tira a caixa da cabeça), porque a cabeça é a da arte parada */
  const [cx0, cx1] = rosto ?? [0, w];
  const corpoPose = `M-200 -100 H${w + 200} V${maos.ate} H${maos.dir} V${mesa} H${maos.esq} V${maos.ate} H-200 Z M${cx0} -100 H${cx1} V${py - sobra} H${cx0} Z`;
  const giro = { "--olha": Math.max(-1, Math.min(1, olha)), transformOrigin: `${px}px ${py}px` } as CSSProperties;
  return (
    <svg viewBox={`0 0 ${w} 440`} className={"crupie " + className} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-corpo`}>
          <path d={corpo} />
        </clipPath>
        <clipPath id={`${id}-pose`} clipPathUnits="userSpaceOnUse">
          <path d={corpoPose} clipRule="evenodd" />
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
      </g>
      {/* os quadros das poses, já carregados e invisíveis (a troca não espera a imagem baixar) */}
      {nomes.flatMap((nome) =>
        poses[nome].quadros.map((q, k) => (
          <g
            key={`${nome}-${k}`}
            ref={(el) => {
              todos.current[inicio[nome] + k] = el;
            }}
            className="crupie-pose"
            clipPath={`url(#${id}-pose)`}
          >
            <image href={q.arte} x={q.x} y={q.y} width={q.w} height={q.h} />
          </g>
        )),
      )}
      {/* a cabeça, por cima de tudo, em três camadas: para onde olha (transição), o gesto (animação) e a respiração */}
      <g className="crupie-olha" style={giro}>
        <g ref={cabeca} className="crupie-gesto" style={{ transformOrigin: `${px}px ${py}px` }}>
          <g className="crupie-respira" style={{ transformOrigin: `${px}px ${py}px` }}>
            <image href={arte} width={w} height="440" mask={`url(#${id}-cabeca)`} />
          </g>
        </g>
      </g>
    </svg>
  );
}
