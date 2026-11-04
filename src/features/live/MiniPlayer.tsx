"use client";
/*
 * Mini player, como no Discord: assistindo a tela de alguém e saindo do Ao vivo, a tela continua num quadrinho no canto
 * (o som segue pelo somTelas.ts). Tocar volta para o Ao vivo; o X para de assistir. Dá para arrastar para outro canto.
 */
import { useState } from "react";
import { IcFechar } from "@/components/ui/icones";
import { setApp, useApp } from "@/lib/store";
import { local } from "@/lib/util";
import { useLive } from "./estado";
import { LIVE, unwatch } from "./tela";
import { VideoMudo } from "./Video";

type Canto = "dir-baixo" | "esq-baixo" | "dir-cima" | "esq-cima";
const CANTOS: Canto[] = ["dir-baixo", "esq-baixo", "dir-cima", "esq-cima"];

export function MiniPlayer() {
  useLive((s) => s.v);
  const aba = useApp((s) => s.aba);
  const [canto, setCanto] = useState<Canto>(() => CANTOS.find((c) => c === local.get("mini-canto")) ?? "dir-baixo");
  const w = LIVE.main ? LIVE.watching.get(LIVE.main) : undefined;
  if (aba === "live" || !w || w.state !== "live" || !w.stream) return null;
  /* soltou o arrasto: vai para o canto mais perto */
  const soltar = (x: number, y: number) => {
    const c: Canto = `${x < innerWidth / 2 ? "esq" : "dir"}-${y < innerHeight / 2 ? "cima" : "baixo"}`;
    setCanto(c);
    local.set("mini-canto", c);
  };
  return (
    <div
      className={"mini-player " + canto}
      role="button"
      tabIndex={0}
      aria-label={`Tela de ${w.name}. Toque para voltar ao Ao vivo`}
      draggable
      onDragEnd={(e) => soltar(e.clientX, e.clientY)}
      onClick={() => setApp({ aba: "live" })}
      onKeyDown={(e) => e.key === "Enter" && setApp({ aba: "live" })}
    >
      <VideoMudo stream={w.stream} />
      <span className="mini-nome">
        <i aria-hidden="true" />
        {w.name}
      </span>
      <button
        type="button"
        className="mini-fechar"
        aria-label="Parar de assistir"
        title="Parar de assistir"
        onClick={(e) => {
          e.stopPropagation();
          unwatch(w.key);
        }}
      >
        <IcFechar tam={14} />
      </button>
    </div>
  );
}
