import { useEffect, useRef, useState } from "react";

/**
 * Ação destrutiva pede um SEGUNDO toque (nunca `confirm()`).
 * `pedir()` devolve true só no segundo toque; no primeiro, `sure` fica true por `ms`
 * (use para trocar o texto para "Confirmar" e pôr a classe `.sure`).
 */
export function useSure(ms = 3500) {
  const [sure, setSure] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const pedir = () => {
    if (sure) {
      clearTimeout(t.current);
      setSure(false);
      return true;
    }
    setSure(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setSure(false), ms);
    return false;
  };
  return { sure, pedir };
}
