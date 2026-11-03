"use client";
import { createPortal } from "react-dom";
import { MY_KEY, useApp } from "@/lib/store";
import { activeCams, CAM } from "./camera";
import { useLive } from "./estado";
import { VideoMudo } from "./Video";

/** Conteúdo da janela flutuante das câmeras (todas, ou só a de uma pessoa). */
export function JanelaCameras() {
  useLive((s) => s.v);
  useApp((s) => s.onlineSala);
  useApp((s) => s.friends);
  const win = CAM.win;
  if (!win || win.closed) return null;
  const only = CAM.only;
  let list = activeCams();
  if (only) list = list.filter((c) => c.key === only);
  return createPortal(
    <div className={"cams-grid" + (only ? " one" : "")} id="camsGrid">
      {list.length ? (
        list.map((c) => (
          <div key={c.key} className={"cam-tile" + (c.key === MY_KEY ? " mirror" : "")} data-key={c.key}>
            <VideoMudo stream={c.st} />
            <span>{c.name}</span>
          </div>
        ))
      ) : (
        <div className="cams-empty">{only ? "Essa câmera foi desligada." : "Ninguém com a câmera ligada agora."}</div>
      )}
    </div>,
    win.document.body,
  );
}
