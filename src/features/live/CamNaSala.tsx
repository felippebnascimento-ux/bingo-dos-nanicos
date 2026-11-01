"use client";
import { useCallback, type ReactNode } from "react";
import { IcExpandir } from "@/components/ui/icones";
import { MY_KEY } from "@/lib/store";
import { CAM, camStreamOf, openCamPip } from "./camera";
import { useLive } from "./estado";
import { VideoMudo } from "./Video";

/** Mostra a câmera de `personKey` se estiver ligada; senão, o rosto (`children`). */
export function CamNaSala({ personKey, nome, children }: { personKey: string; nome: string; children: ReactNode }) {
  useLive((s) => s.v);
  const guarda = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) CAM.videos.set(personKey, el);
      else CAM.videos.delete(personKey);
    },
    [personKey],
  );
  const st = camStreamOf(personKey);
  if (!st) return <>{children}</>;
  return (
    <span className={"av cam" + (personKey === MY_KEY ? " mirror" : "")}>
      <VideoMudo stream={st} onEl={guarda} />
      <button
        type="button"
        className="cam-pop"
        aria-label={`Abrir a câmera de ${nome} numa janela flutuante`}
        title="Abrir numa janela flutuante"
        onClick={(e) => {
          e.stopPropagation();
          openCamPip(personKey);
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <IcExpandir />
      </button>
    </span>
  );
}
