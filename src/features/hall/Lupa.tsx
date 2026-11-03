"use client";
/*
 * Lupa do K-FOFO (e das cenas: quarto, rua, corredor): aumenta e diminui a visão do cômodo. O zoom fica no navegador
 * (`hall-zoom`, só conveniência) e a cena cresce dentro de uma caixa que rola; ao mudar, o meio continua no meio.
 * `ZoomCaixa` embrulha a cena e `Lupa` são os botões.
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { create } from "zustand";
import { local } from "@/lib/util";

export const ZOOMS = [1, 1.25, 1.5, 2] as const;
const salvo = Number(local.get("hall-zoom"));
export const useZoom = create<{ z: number }>()(() => ({ z: (ZOOMS as readonly number[]).includes(salvo) ? salvo : 1 }));
const mudar = (passo: number) => {
  const k = ZOOMS.indexOf(useZoom.getState().z as (typeof ZOOMS)[number]);
  const z = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, k + passo))];
  useZoom.setState({ z });
  local.set("hall-zoom", String(z));
};

export function ZoomCaixa({ children }: { children: ReactNode }) {
  const z = useZoom((s) => s.z);
  const caixa = useRef<HTMLDivElement>(null);
  const antes = useRef(z);
  /* mantém o centro: a mesma fração do meio antes e depois do zoom */
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const fx = (el.scrollLeft + el.clientWidth / 2) / Math.max(1, el.scrollWidth / (z / antes.current));
    const fy = (el.scrollTop + el.clientHeight / 2) / Math.max(1, el.scrollHeight / (z / antes.current));
    el.scrollLeft = fx * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = fy * el.scrollHeight - el.clientHeight / 2;
    antes.current = z;
  }, [z]);
  /* arrastar com o mouse para andar pela cena aumentada (sem atrapalhar o toque no chão: só conta se mexeu) */
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let ini: { x: number; y: number; l: number; t: number } | null = null;
    let mexeu = false;
    const down = (e: PointerEvent) => {
      if (useZoom.getState().z === 1 || e.pointerType !== "mouse" || e.button !== 0) return;
      ini = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
      mexeu = false;
    };
    const move = (e: PointerEvent) => {
      if (!ini) return;
      const dx = e.clientX - ini.x, dy = e.clientY - ini.y;
      if (!mexeu && Math.hypot(dx, dy) < 6) return;
      mexeu = true;
      el.scrollLeft = ini.l - dx;
      el.scrollTop = ini.t - dy;
    };
    const up = () => (ini = null);
    /* depois de arrastar, o clique não vira "andar até aqui" */
    const click = (e: MouseEvent) => {
      if (mexeu) {
        e.stopPropagation();
        e.preventDefault();
        mexeu = false;
      }
    };
    el.addEventListener("pointerdown", down);
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      el.removeEventListener("click", click, true);
    };
  }, []);
  return (
    <div ref={caixa} className={"hall-zoom" + (z > 1 ? " ampliado" : "")} style={{ ["--zoom" as string]: z } as CSSProperties}>
      {children}
    </div>
  );
}

export function Lupa() {
  const z = useZoom((s) => s.z);
  return (
    <div className="hall-lupa" role="group" aria-label={`Zoom da cena: ${Math.round(z * 100)}%`}>
      <button type="button" aria-label="Aumentar a cena" disabled={z === ZOOMS[ZOOMS.length - 1]} onClick={() => mudar(1)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="M15 15l5 5M10.5 8v5M8 10.5h5" />
        </svg>
      </button>
      <span aria-hidden="true">{Math.round(z * 100)}%</span>
      <button type="button" aria-label="Diminuir a cena" disabled={z === 1} onClick={() => mudar(-1)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="M15 15l5 5M8 10.5h5" />
        </svg>
      </button>
    </div>
  );
}
