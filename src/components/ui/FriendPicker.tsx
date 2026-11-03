"use client";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { soNanicos } from "@/lib/dados/nanicos";
import { friendOf, useApp } from "@/lib/store";
import { Avatar } from "./Avatar";

/** Só um seletor aberto por vez no site inteiro. */
const useAberto = create<{ id: string | null }>()(() => ({ id: null }));
export const fecharSeletores = () => useAberto.setState({ id: null });

type Comum = { emptyLabel: string; ariaLabel: string; id?: string };
type Props =
  | (Comum & { multi?: false; value: string; onChange: (v: string) => void })
  | (Comum & { multi: true; values: string[]; onChange: (v: string[]) => void });

/* fecha ao tocar fora, com Esc e ao redimensionar a janela */
let ouvindo = false;
function ouvirFechar() {
  if (ouvindo || typeof document === "undefined") return;
  ouvindo = true;
  document.addEventListener("click", (e) => {
    if (!(e.target as Element | null)?.closest?.(".picker,.pick-panel")) fecharSeletores();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharSeletores();
  });
  addEventListener("resize", fecharSeletores);
}

/** Seletor de nanico com rosto. O painel fica direto no <body>, para nunca ficar atrás de nada. */
export function FriendPicker(props: Props) {
  const friends = useApp((s) => s.friends);
  const meuId = useId();
  const aberto = useAberto((s) => s.id === meuId);
  const btn = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const ultimoToque = useRef<string | null>(null);

  useEffect(ouvirFechar, []);

  const selecionados = props.multi ? props.values : props.value ? [props.value] : [];
  const on = (id: string) => (id ? selecionados.includes(id) : !selecionados.length);

  /* posiciona o painel onde ele cabe: embaixo, em cima ou ao lado do botão */
  const posicionar = () => {
    const b = btn.current,
      pn = painel.current;
    if (!b || !pn) return;
    const M = 8,
      vw = innerWidth,
      vh = innerHeight,
      r = b.getBoundingClientRect();
    pn.style.maxHeight = vh - 2 * M + "px";
    pn.style.top = "0px";
    pn.style.left = "0px";
    const w = pn.offsetWidth,
      h = pn.offsetHeight;
    let top: number, left: number;
    if (r.bottom + 6 + h <= vh - M) {
      top = r.bottom + 6;
      left = r.left;
    } else if (r.top - 6 - h >= M) {
      top = r.top - 6 - h;
      left = r.left;
    } else {
      top = Math.min(Math.max(M, r.top + r.height / 2 - h / 2), vh - M - h);
      left = r.right + 8 + w <= vw - M ? r.right + 8 : r.left - 8 - w;
    }
    left = Math.min(Math.max(M, left), vw - M - w);
    top = Math.max(M, top);
    pn.style.top = top + "px";
    pn.style.left = left + "px";
  };

  useLayoutEffect(() => {
    if (!aberto) return;
    posicionar();
    const pn = painel.current;
    if (!props.multi) (pn?.querySelector<HTMLElement>('.tile[aria-pressed="true"]') || pn?.querySelector<HTMLElement>(".tile"))?.focus({ preventScroll: true });
    const onScroll = () => posicionar();
    addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => removeEventListener("scroll", onScroll, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  /* vários nanicos: o foco fica na peça que acabou de ser tocada */
  useLayoutEffect(() => {
    if (!aberto || !props.multi || ultimoToque.current === null) return;
    painel.current?.querySelector<HTMLElement>(`.tile[data-id="${CSS.escape(ultimoToque.current)}"]`)?.focus({ preventScroll: true });
  });

  const tocar = (id: string) => {
    if (props.multi) {
      ultimoToque.current = id;
      const v = props.values;
      props.onChange(!id ? [] : v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);
      return;
    }
    fecharSeletores();
    props.onChange(id);
    btn.current?.focus();
  };

  const sel = selecionados.map((id) => friendOf(id, friends)).filter((f) => !!f);

  return (
    <div className="picker" id={props.id}>
      <button
        ref={btn}
        type="button"
        className="pick-btn"
        aria-haspopup="true"
        aria-expanded={aberto}
        aria-label={props.ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          ultimoToque.current = null;
          useAberto.setState({ id: aberto ? null : meuId });
        }}
      >
        {props.multi ? (
          <span className="avs">{sel.length ? sel.slice(0, 3).map((x) => <Avatar key={x.id} f={x} />) : <Avatar f={null} />}</span>
        ) : (
          <Avatar f={sel[0] || null} />
        )}
        <span className="nm">{sel.length ? sel.map((x) => x.name).join(", ") : props.emptyLabel}</span>
      </button>
      {aberto &&
        createPortal(
          <div
            ref={painel}
            className="pick-panel"
            role="group"
            aria-label={props.ariaLabel}
            style={{ position: "fixed" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="tile" data-id="" aria-pressed={on("")} onClick={() => tocar("")}>
              <Avatar f={null} size="lg" />
              <span>{props.emptyLabel}</span>
            </button>
            {soNanicos(friends).map((x) => (
              <button key={x.id} type="button" className="tile" data-id={x.id} aria-pressed={on(x.id)} onClick={() => tocar(x.id)}>
                <Avatar f={x} size="lg" />
                <span>{x.name}</span>
              </button>
            ))}
            {!soNanicos(friends).length && (
              <span className="status" style={{ gridColumn: "1/-1", padding: 6 }}>
                Nenhum nanico cadastrado ainda.
              </span>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
