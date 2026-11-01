/*
 * Reações com emoji na live.
 * Quem assiste toca num emoji; ele sobe na tela de todo mundo que está vendo a mesma transmissão
 * (e no canto da tela de quem está transmitindo). Os emojis sobem pelo lado esquerdo para não tapar o minimapa.
 */
import { enviar, estaNaSala, limitePorPessoa, salaConectada } from "@/lib/sala";
import { friendDaPresenca, getApp, MY_KEY } from "@/lib/store";
import { local } from "@/lib/util";
import { getLive, setLive, useLive, type Voo } from "./estado";
import { LIVE } from "./tela";

export const REACOES = ["😂", "🔥", "💀", "👏", "😮", "🤡", "😡", "❤️"];
/* reações com foto (os Picarétezzi) entram depois dos emojis */
export const REACOES_FOTO = [
  { nome: "Picaretoula Picarétezzi", img: "/arte/reacoes/picaretoula.webp", mini: "/arte/reacoes/picaretoula-mini.webp" },
  { nome: "Aluysio Picarétezzi", img: "/arte/reacoes/aluysio.webp", mini: "/arte/reacoes/aluysio-mini.webp" },
];
const N_REACOES = REACOES.length + REACOES_FOTO.length;

let meus: number[] = [];
let seq = 0;
const limDeles = limitePorPessoa(10, 3000);

/** Toquei num emoji: manda para a sala e mostra na minha tela. */
export function reagir(i: number) {
  const alvo = LIVE.main;
  if (!alvo || !salaConectada()) return;
  const agora = Date.now();
  meus = meus.filter((t) => agora - t < 3000);
  if (meus.length >= 8) return; /* até 8 a cada 3 s */
  meus.push(agora);
  enviar("reacao", { i, alvo });
  mostrarReacao(i, getApp().myName, alvo, true);
}

/** Reação que chegou da sala (não confiável: confere tudo). */
export function onReacao(m: Record<string, unknown>) {
  if (!getLive().reacoesVer || typeof m.from !== "string" || typeof m.alvo !== "string" || m.from === MY_KEY) return;
  const i = Number(m.i);
  if (!Number.isInteger(i) || i < 0 || i >= N_REACOES) return;
  if (!estaNaSala(m.from)) return; /* só de quem está na sala */
  if (!limDeles(m.from)) return;
  const p = getApp().online.find((x) => x.key === m.from)!;
  const f = friendDaPresenca(p);
  mostrarReacao(i, f ? f.name : p.name, m.alvo);
}

function mostrarReacao(i: number, nome: string, alvo: string, meu = false) {
  let camada: Voo["camada"] | null = null;
  if (alvo === MY_KEY && LIVE.mySid) camada = "minha"; /* reagiram na minha transmissão */
  else if (alvo === LIVE.main && getApp().aba === "live") camada = "palco"; /* estou vendo essa transmissão */
  if (!camada) return;
  const { voando } = getLive();
  if (voando.filter((v) => v.camada === camada).length > 40) return;
  const id = ++seq;
  const voo: Voo = {
    id,
    camada,
    i,
    nome: String(nome || "").slice(0, 20),
    meu,
    x: 4 + Math.random() * 30,
    dx: Math.round(Math.random() * 50 - 25),
  };
  setLive({ voando: [...voando, voo] });
  setTimeout(() => tirarVoo(id), 4000);
}

export function tirarVoo(id: number) {
  const { voando } = getLive();
  if (voando.some((v) => v.id === id)) setLive({ voando: voando.filter((v) => v.id !== id) });
}

/** "Ver reações": desligado, não aparece nenhum emoji/foto dos outros (fica salvo no navegador). */
export function setReacoesVer(ver: boolean) {
  local.set("reacoes-ver", ver ? "1" : "0");
  useLive.setState((s) => ({
    reacoesVer: ver,
    voando: ver ? s.voando : s.voando.filter((v) => v.camada === "palco" && v.meu),
  }));
}
