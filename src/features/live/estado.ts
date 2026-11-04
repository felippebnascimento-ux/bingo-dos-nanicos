/*
 * Estado da aba Ao vivo que o React precisa ver. Os objetos do WebRTC (RTCPeerConnection,
 * MediaStream) moram nos módulos .ts (tela.ts, camera.ts); aqui fica só um contador `v`
 * que muda a cada mudança neles, e as preferências de cada pessoa.
 */
import { create } from "zustand";
import { local } from "@/lib/util";

export type Fps = 30 | 60;
export type Res = 720 | 1080 | 1440;
/** o que a janela do navegador já mostra selecionado ao transmitir (quem escolhe de fato é a janela dele) */
export type Mostrar = "monitor" | "window" | "browser";

/** Uma reação subindo na tela: `camada` "palco" = na live que estou vendo; "minha" = na minha transmissão. */
export type Voo = { id: number; camada: "palco" | "minha"; i: number; nome: string; meu: boolean; x: number; dx: number };

export type LiveUi = {
  /** muda sempre que a transmissão, as telas abertas ou as câmeras mudam */
  v: number;
  /** o navegador bloqueou o som da tela principal: mostra "Ativar som" */
  unmute: boolean;
  fps: Fps;
  res: Res;
  /** o volume da tela principal agora (o de quem está nela, guardado em `volTelas`) */
  vol: number;
  /** o volume da transmissão de cada nanico (friend id), de 0 a 2 (até 200%), como no Discord */
  volTelas: Record<string, number>;
  reacoesVer: boolean;
  voando: Voo[];
  desenhoOn: boolean;
  desenhoVer: boolean;
  desenhoCor: number;
  desenhoEsp: number;
  /** transmitir com o som do computador */
  somPc: boolean;
  mostrar: Mostrar;
  /** o Ao vivo como no Discord: todo mundo em quadrados ("grade") ou uma tela grande com o resto embaixo ("foco") */
  modo: "grade" | "foco";
  /** no foco: o quadro grande (id do quadro) quando não é a tela de alguém no Palco (minha tela, uma câmera) */
  destaque: string | null;
  /** janelas abertas: escolher a transmissão e a prévia da câmera */
  janelaTela: boolean;
  previaCam: boolean;
  /** a minha câmera aparece espelhada para mim (os outros sempre veem do jeito certo) */
  espelho: boolean;
  /** mostrar a minha câmera no meu quadrado da grade */
  minhaCamNaGrade: boolean;
  /** como no Discord: esconder da grade quem está sem câmera (as telas ao vivo continuam) */
  soVideo: boolean;
  /** esconder os nomes nos quadrados (aparecem ao passar o mouse) */
  semNomes: boolean;
  /** nanicos (friend id) cuja câmera eu desliguei só para mim */
  semVideo: string[];
};

const num = (k: string) => parseFloat(local.get(k) ?? "");
const fpsSalvo = num("live-fps"),
  resSalvo = num("live-res"),
  volSalvo = num("live-vol");
const volTelasSalvo = local.json<Record<string, unknown>>("live-vol-por") || {};
const semVideoSalvo = local.json<unknown[]>("cv-sem-video");
const des = local.json<{ cor?: unknown; esp?: unknown; ver?: unknown }>("desenho") || {};

export const useLive = create<LiveUi>()(() => ({
  v: 0,
  unmute: false,
  fps: fpsSalvo === 30 ? 30 : 60,
  res: resSalvo === 1440 || resSalvo === 720 ? resSalvo : 1080,
  vol: volSalvo >= 0 && volSalvo <= 2 ? volSalvo : 1,
  volTelas: Object.fromEntries(Object.entries(volTelasSalvo).filter((e): e is [string, number] => typeof e[1] === "number" && e[1] >= 0 && e[1] <= 2)),
  reacoesVer: local.get("reacoes-ver") !== "0",
  voando: [],
  desenhoOn: false,
  desenhoVer: des.ver !== false,
  desenhoCor: Number.isInteger(des.cor) && (des.cor as number) >= 0 && (des.cor as number) < 7 /* DCORES.length, em desenho.ts */ ? (des.cor as number) : 0,
  desenhoEsp: Number.isInteger(des.esp) && (des.esp as number) >= 0 && (des.esp as number) < 3 ? (des.esp as number) : 1,
  somPc: local.get("live-som") !== "0",
  mostrar: (["monitor", "window", "browser"] as const).find((m) => m === local.get("live-mostrar")) ?? "monitor",
  modo: "grade",
  destaque: null,
  janelaTela: false,
  previaCam: false,
  espelho: local.get("cam-espelho") !== "0",
  minhaCamNaGrade: local.get("cam-na-grade") !== "0",
  soVideo: local.get("cv-so-video") === "1",
  semNomes: local.get("cv-sem-nomes") === "1",
  semVideo: Array.isArray(semVideoSalvo) ? semVideoSalvo.filter((x): x is string => typeof x === "string") : [],
}));

export const setLive = (p: Partial<LiveUi>) => useLive.setState(p);
export const getLive = () => useLive.getState();

/** Liga ou desliga uma opção da call e guarda no aparelho. */
export function opcaoCall(k: "soVideo" | "semNomes", v: boolean) {
  setLive({ [k]: v });
  local.set(k === "soVideo" ? "cv-so-video" : "cv-sem-nomes", v ? "1" : "0");
}
/** Desliga (ou volta) a câmera de um nanico só para mim. */
export function semVideoDe(fid: string, sim: boolean) {
  const l = getLive().semVideo.filter((x) => x !== fid);
  const semVideo = sim ? [...l, fid] : l;
  setLive({ semVideo });
  local.setJson("cv-sem-video", semVideo);
}

/** Avisa o React que algo no WebRTC mudou (equivale ao renderLive()/renderCamPip() do site antigo). */
export const avisar = () => useLive.setState((s) => ({ v: s.v + 1 }));
