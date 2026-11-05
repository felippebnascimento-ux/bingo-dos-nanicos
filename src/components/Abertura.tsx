"use client";
/*
 * A abertura, como a de um app: o logo do Bingo dos Nanicos e uma barrinha enquanto o site conecta. Some suave quando
 * fica "Sincronizado" (ou depois de 3 s, para nunca prender ninguém), uma vez por carregamento.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

export function Abertura() {
  const pronto = useApp((s) => s.conn === "Sincronizado");
  const [fase, setFase] = useState<"aberta" | "saindo" | "fora">("aberta");
  useEffect(() => {
    if (fase !== "aberta") return;
    const t = setTimeout(() => setFase("saindo"), pronto ? 350 : 3000);
    return () => clearTimeout(t);
  }, [pronto, fase]);
  useEffect(() => {
    if (fase !== "saindo") return;
    const t = setTimeout(() => setFase("fora"), 450);
    return () => clearTimeout(t);
  }, [fase]);
  if (fase === "fora") return null;
  return (
    <div className={"abertura" + (fase === "saindo" ? " saindo" : "")} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/arte/marca.png" alt="" />
      <b>Bingo dos Nanicos</b>
      <span className="abertura-barra">
        <i />
      </span>
    </div>
  );
}
