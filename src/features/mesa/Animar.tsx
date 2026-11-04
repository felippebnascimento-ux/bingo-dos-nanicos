"use client";
/*
 * Movimento das mesas de cartas (truco, pôquer, blackjack), só para dar retorno do que aconteceu:
 * - <Voa de="…">: a peça nasce voando de outro ponto da mesa (a carta sai do baralho, a ficha sai do pote).
 * - <Vira>: a carta acabou de ser revelada e gira de costas para a frente.
 * - <Pula>: o número mudou (o pote cresceu) e dá um pulinho.
 * Tudo com a Web Animations API, medindo onde as coisas estão na tela (vale para o computador e para o celular,
 * que têm posições diferentes). Quem pediu menos movimento não vê nada disso, e a mesa recém-aberta também não
 * (senão tudo que já estava na mesa voaria de novo).
 */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { reduzMovimento } from "@/lib/util";

/** Quando a mesa apareceu na tela (as peças que já estavam lá não animam). */
const MesaViva = createContext<number>(0);

export function AnimarMesa({ children }: { children: ReactNode }) {
  const [desde] = useState(() => Date.now());
  return <MesaViva.Provider value={desde}>{children}</MesaViva.Provider>;
}

/** Pode animar agora? (passou o primeiro instante da mesa e a pessoa não pediu menos movimento) */
function useLiberado() {
  const desde = useContext(MesaViva);
  return () => !reduzMovimento() && (!desde || Date.now() - desde > 700);
}

const centro = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

type VoaProps = {
  /** seletor do ponto de partida, procurado dentro da mesa (`.mesa-cartas`) */
  de: string;
  /** espera antes de sair (para dar as cartas uma de cada vez) */
  atraso?: number;
  duracao?: number;
  /** quanto a peça gira no caminho */
  giro?: number;
  /** começa menor (a carta sai do baralho pequena) */
  escala?: number;
  /** sobe esses px no meio do caminho e assenta com um tranco (a carta jogada pelo dealer); 0 = reto */
  arco?: number;
  className?: string;
  children: ReactNode;
};

/** A peça nasce voando do ponto `de` até onde ela fica. */
export function Voa({ de, atraso = 0, duracao = 420, giro = -12, escala = 0.7, arco = 0, className = "", children }: VoaProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const liberado = useLiberado();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !liberado()) return;
    const origem = el.closest(".mesa-cartas")?.querySelector(de);
    if (!origem) return;
    const a = centro(origem.getBoundingClientRect()), b = centro(el.getBoundingClientRect());
    const dx = a.x - b.x, dy = a.y - b.y;
    /* termina exatamente como o CSS deixa a peça (a carta do leque fica inclinada), sem pulo no fim */
    const fim = getComputedStyle(el).transform;
    const base = fim && fim !== "none" ? fim : "";
    const quadros: Keyframe[] = arco
      ? [
          { transform: `translate(${dx}px, ${dy}px) rotate(${giro}deg) scale(${escala}) ${base}`, opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - arco}px) rotate(${giro * 0.4}deg) scale(${(escala + 1) / 2 + 0.1}) ${base}`, offset: 0.5 },
          { transform: `translateY(${arco * 0.08}px) scale(.97) ${base}`, offset: 0.86 },
          { transform: base || "none", opacity: 1 },
        ]
      : [
          { transform: `translate(${dx}px, ${dy}px) rotate(${giro}deg) scale(${escala}) ${base}`, opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { transform: base || "none", opacity: 1 },
        ];
    const anim = el.animate(
      quadros,
      { duration: duracao, delay: atraso, easing: "cubic-bezier(.2,.8,.25,1)", fill: "backwards" },
    );
    return () => anim.cancel();
    // só quando nasce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span ref={ref} className={"mesa-voa " + className}>
      {children}
    </span>
  );
}

/** A carta foi revelada agora: gira de lado e aparece de frente (com um brilho). */
export function Vira({ atraso = 0, children }: { atraso?: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const liberado = useLiberado();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !liberado()) return;
    const anim = el.animate(
      [
        { transform: "perspective(600px) rotateY(90deg) scale(1.08)", filter: "brightness(1.6)" },
        { transform: "perspective(600px) rotateY(0deg) scale(1.08)", filter: "brightness(1.25)", offset: 0.6 },
        { transform: "none", filter: "none" },
      ],
      { duration: 460, delay: atraso, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" },
    );
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span ref={ref} className="mesa-vira">
      {children}
    </span>
  );
}

/** Dá um pulinho toda vez que `valor` muda (o pote cresceu, a soma mudou). */
export function Pula({ valor, children, className = "" }: { valor: number | string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const antes = useRef(valor);
  const liberado = useLiberado();
  useEffect(() => {
    if (antes.current === valor) return;
    antes.current = valor;
    const el = ref.current;
    if (!el || !liberado()) return;
    el.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
  }, [valor, liberado]);
  return (
    <span ref={ref} className={"mesa-pula " + className}>
      {children}
    </span>
  );
}

/**
 * Sai voando até o ponto `para` e some (as cartas de quem desistiu vão para o meio, a aposta perdida vai para a
 * banca). Só aparece se nascer com a mesa já viva: quem chega na mesa no meio da mão não vê nada.
 */
export function Some({ para, atraso = 0, duracao = 520, children }: { para: string; atraso?: number; duracao?: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const liberado = useLiberado();
  const [vivo] = useState(liberado);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !vivo) return;
    const alvo = el.closest(".mesa-cartas")?.querySelector(para);
    if (!alvo) {
      el.style.opacity = "0";
      return;
    }
    const a = centro(el.getBoundingClientRect()), b = centro(alvo.getBoundingClientRect());
    const anim = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) rotate(14deg) scale(.55)`, opacity: 0 },
      ],
      { duration: duracao, delay: atraso, easing: "cubic-bezier(.5,0,.75,.4)", fill: "forwards" },
    );
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!vivo) return null;
  return (
    <span ref={ref} className="mesa-voa mesa-some">
      {children}
    </span>
  );
}

/** Aparece depois de `atraso` (a soma e o selo esperam as cartas chegarem). */
export function Aparece({ atraso, children }: { atraso: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const liberado = useLiberado();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !liberado() || atraso <= 0) return;
    const anim = el.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: atraso, easing: "ease-out", fill: "backwards" });
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span ref={ref} className="mesa-voa">
      {children}
    </span>
  );
}

/**
 * Quando `ir` liga, a peça desliza até o ponto `para` e some (no fim da rodada o dealer recolhe as cartas para o
 * descarte). Antes disso, fica parada onde está.
 */
export function Vai({ para, ir, atraso = 0, duracao = 520, children }: { para: string; ir: boolean; atraso?: number; duracao?: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const liberado = useLiberado();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ir) return;
    const alvo = el.closest(".mesa-cartas")?.querySelector(para);
    if (!alvo || !liberado()) {
      el.style.opacity = "0";
      return () => void (el.style.opacity = "");
    }
    const a = centro(el.getBoundingClientRect()), b = centro(alvo.getBoundingClientRect());
    const anim = el.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${(b.x - a.x) * 0.15}px, ${(b.y - a.y) * 0.15 - 6}px) scale(1.03)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) rotate(-8deg) scale(.6)`, opacity: 0 },
      ],
      { duration: duracao, delay: atraso, easing: "cubic-bezier(.45,0,.3,1)", fill: "forwards" },
    );
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ir]);
  return (
    <span ref={ref} className="mesa-voa">
      {children}
    </span>
  );
}
