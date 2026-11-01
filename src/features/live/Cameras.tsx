"use client";
import { createPortal } from "react-dom";
import { IcJanela } from "@/components/ui/icones";
import { MY_KEY, useApp } from "@/lib/store";
import { activeCams, CAM, openCamPip } from "./camera";
import { useLive } from "./estado";
import { VideoMudo } from "./Video";

/** Faixa de câmeras embaixo da live (sempre visível quando alguém está com a câmera ligada). */
export function FaixaCameras() {
  useLive((s) => s.v);
  useApp((s) => s.online);
  useApp((s) => s.friends);
  const list = activeCams();
  return (
    <div className="cams-strip" id="camsStrip" hidden={!list.length}>
      <div className="cams-row" id="camsRow">
        {list.map((c) => {
          const eu = c.key === MY_KEY;
          return (
            <button
              key={c.key}
              type="button"
              className={"cam-t" + (eu ? " mirror" : "")}
              title={`Abrir a câmera de ${eu ? "você" : c.name} numa janela flutuante`}
              onClick={() => openCamPip(c.key)}
            >
              <VideoMudo stream={c.st} />
              <span>{eu ? "Você" : c.name}</span>
            </button>
          );
        })}
      </div>
      <button className="btn soft sm cams-open" id="camsOpen" type="button" onClick={() => openCamPip(null)}>
        <IcJanela />
        <span>Câmeras em janela</span>
      </button>
    </div>
  );
}

/** Conteúdo da janela flutuante das câmeras (todas, ou só a de uma pessoa). */
export function JanelaCameras() {
  useLive((s) => s.v);
  useApp((s) => s.online);
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
