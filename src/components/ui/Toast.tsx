"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/lib/toast";

/** Aviso rápido. Na tela cheia ele vai para dentro do elemento em tela cheia, para continuar visível. */
export function Toast() {
  const { texto, visivel } = useToast();
  const [alvo, setAlvo] = useState<Element | null>(null);
  useEffect(() => {
    const f = () => setAlvo(document.fullscreenElement || document.body);
    f();
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  if (!alvo) return null;
  return createPortal(
    <div className={"toast" + (visivel ? " show" : "")} role="status" aria-live="polite">
      {texto}
    </div>,
    alvo,
  );
}
