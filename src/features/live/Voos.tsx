"use client";
import type { CSSProperties } from "react";
import type { Voo } from "./estado";
import { REACOES, REACOES_FOTO, tirarVoo } from "./reacoes";

/** Emojis e fotos subindo numa camada de reações. */
export function Voos({ voando, camada }: { voando: Voo[]; camada: Voo["camada"] }) {
  return (
    <>
      {voando
        .filter((v) => v.camada === camada)
        .map((v) => {
          const foto = v.i >= REACOES.length ? REACOES_FOTO[v.i - REACOES.length] : null;
          return (
            <span
              key={v.id}
              className={"react-fly" + (foto ? " foto" : "") + (v.meu ? " meu" : "")}
              style={{ left: v.x + "%", ["--dx" as string]: v.dx + "px" } as CSSProperties}
              onAnimationEnd={() => tirarVoo(v.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {foto ? <img src={foto.img} alt="" /> : <b>{REACOES[v.i]}</b>}
              <small>{v.nome}</small>
            </span>
          );
        })}
    </>
  );
}
