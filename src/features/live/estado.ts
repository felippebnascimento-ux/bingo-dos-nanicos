/*
 * Estado da aba Ao vivo que o React precisa ver. Os objetos do WebRTC (RTCPeerConnection,
 * MediaStream) moram nos módulos .ts (tela.ts, camera.ts); aqui fica só um contador `v`
 * que muda a cada mudança neles, e as preferências de cada pessoa.
 */
import { create } from "zustand";
import { local } from "@/lib/util";

export type Fps = 30 | 60;
export type Res = 1080 | 1440;

/** Uma reação subindo na tela: `camada` "palco" = na live que estou vendo; "minha" = na minha transmissão. */
export type Voo = { id: number; camada: "palco" | "minha"; i: number; nome: string; meu: boolean; x: number; dx: number };

export type LiveUi = {
  /** muda sempre que a transmissão, as telas abertas ou as câmeras mudam */
  v: number;
  /** o navegador bloqueou o som da tela principal: mostra "Ativar som" */
  unmute: boolean;
  fps: Fps;
  res: Res;
  vol: number;
  reacoesVer: boolean;
  voando: Voo[];
  desenhoOn: boolean;
  desenhoVer: boolean;
  desenhoCor: number;
  desenhoEsp: number;
};

const num = (k: string) => parseFloat(local.get(k) ?? "");
const fpsSalvo = num("live-fps"),
  resSalvo = num("live-res"),
  volSalvo = num("live-vol");
const des = local.json<{ cor?: unknown; esp?: unknown; ver?: unknown }>("desenho") || {};

export const useLive = create<LiveUi>()(() => ({
  v: 0,
  unmute: false,
  fps: fpsSalvo === 30 ? 30 : 60,
  res: resSalvo === 1440 ? 1440 : 1080,
  vol: volSalvo >= 0 && volSalvo <= 1 ? volSalvo : 1,
  reacoesVer: local.get("reacoes-ver") !== "0",
  voando: [],
  desenhoOn: false,
  desenhoVer: des.ver !== false,
  desenhoCor: Number.isInteger(des.cor) && (des.cor as number) >= 0 && (des.cor as number) < 6 ? (des.cor as number) : 0,
  desenhoEsp: Number.isInteger(des.esp) && (des.esp as number) >= 0 && (des.esp as number) < 3 ? (des.esp as number) : 1,
}));

export const setLive = (p: Partial<LiveUi>) => useLive.setState(p);
export const getLive = () => useLive.getState();

/** Avisa o React que algo no WebRTC mudou (equivale ao renderLive()/renderCamPip() do site antigo). */
export const avisar = () => useLive.setState((s) => ({ v: s.v + 1 }));
