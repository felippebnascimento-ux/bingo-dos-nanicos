"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast, type TipoAviso } from "@/lib/toast";

/* um ícone por tipo de aviso (traço, na cor do tipo) */
const ICONE: Record<TipoAviso, React.ReactNode> = {
  ok: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  erro: <path d="M12 8v5m0 3.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />,
  dinheiro: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm2.8 6.2c-.4-.9-1.5-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2s1.2 1.7 2.8 2 2.8.8 2.8 2-1.2 2-2.8 2c-1.3 0-2.4-.5-2.8-1.4M12 6v1.8m0 8.4V18" />,
  aviso: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" />,
  info: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v5m0-8.5h.01" />,
};

/**
 * Os avisos, como no Discord: empilham no rodapé (até 3), cada um com o ícone e a cor do tipo. Na tela cheia vão para
 * dentro do elemento em tela cheia, para continuar visíveis.
 */
export function Toast() {
  const avisos = useToast((s) => s.avisos);
  const [alvo, setAlvo] = useState<Element | null>(null);
  useEffect(() => {
    const f = () => setAlvo(document.fullscreenElement || document.body);
    f();
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  if (!alvo) return null;
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={"toast show t-" + a.tipo + (a.saindo ? " saindo" : "")}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONE[a.tipo]}
          </svg>
          <span>{a.texto}</span>
        </div>
      ))}
    </div>,
    alvo,
  );
}
