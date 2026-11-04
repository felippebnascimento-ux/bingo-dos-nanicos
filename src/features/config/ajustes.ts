/*
 * Os ajustes das Configurações (como os do Discord): aparência, acessibilidade, texto e imagens e notificações. Só
 * neste navegador (chave `ajustes`), valem na hora. O tema vai no `data-theme` do <html> (o CSS já tem as duas
 * versões); o tamanho do texto do chat, as mensagens compactas, menos movimento e o destaque de quem fala viram uma
 * variável e classes no <html>; o resto é lido pelo chat e pelos sons quando acontecem.
 */
import { create } from "zustand";
import { setApp } from "@/lib/store";
import { local } from "@/lib/util";

export type Ajustes = {
  tema: "sistema" | "claro" | "escuro";
  /** tamanho do texto do chat, em px */
  fonteChat: number;
  compacto: boolean;
  reduzirMovimento: boolean;
  destacarFala: boolean;
  videosLinks: boolean;
  imagensChat: boolean;
  spoilersAbertos: boolean;
  enterEnvia: boolean;
  avisoMencao: boolean;
  somMencao: boolean;
  somVoz: boolean;
  somMudo: boolean;
  somLive: boolean;
  somSoundboard: boolean;
  somChamada: boolean;
};

const PADRAO: Ajustes = {
  tema: "sistema",
  fonteChat: 15,
  compacto: false,
  reduzirMovimento: false,
  destacarFala: true,
  videosLinks: true,
  imagensChat: true,
  spoilersAbertos: false,
  enterEnvia: true,
  avisoMencao: true,
  somMencao: true,
  somVoz: true,
  somMudo: true,
  somLive: true,
  somSoundboard: true,
  somChamada: true,
};
export const FONTE_MIN = 12;
export const FONTE_MAX = 20;

/** Confere o que estava guardado (o que não bate volta para o padrão). */
export function lerAjustes(v: unknown): Ajustes {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const out = { ...PADRAO };
  for (const k of Object.keys(PADRAO) as (keyof Ajustes)[]) {
    const x = o[k];
    if (typeof PADRAO[k] === "boolean" && typeof x === "boolean") (out[k] as boolean) = x;
  }
  if (o.tema === "claro" || o.tema === "escuro" || o.tema === "sistema") out.tema = o.tema;
  if (typeof o.fonteChat === "number" && o.fonteChat >= FONTE_MIN && o.fonteChat <= FONTE_MAX) out.fonteChat = Math.round(o.fonteChat);
  return out;
}

export const useAjustes = create<Ajustes>()(() => lerAjustes(local.json("ajustes")));
export const ajuste = <K extends keyof Ajustes>(k: K) => useAjustes.getState()[k];

export function mudarAjuste(p: Partial<Ajustes>) {
  useAjustes.setState(p);
  local.setJson("ajustes", useAjustes.getState());
  aplicarNaPagina();
}

/** Põe na página o que é visual: tema, tamanho do texto e as classes de acessibilidade. */
export function aplicarNaPagina() {
  if (typeof document === "undefined") return;
  const a = useAjustes.getState();
  const html = document.documentElement;
  if (a.tema === "sistema") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", a.tema === "claro" ? "light" : "dark");
  html.style.setProperty("--chat-fonte", `${a.fonteChat}px`);
  html.classList.toggle("chat-compacto", a.compacto);
  html.classList.toggle("menos-movimento", a.reduzirMovimento);
  html.classList.toggle("sem-destaque-fala", !a.destacarFala);
}

/**
 * O aviso do computador (fora do site) quando alguém me menciona, como no Discord. Pede a permissão do navegador na
 * primeira vez que a pessoa liga.
 */
export async function pedirAvisoDoComputador(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}
export function avisarNoComputador(titulo: string, texto: string) {
  if (!ajuste("avisoMencao") || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!document.hidden && document.hasFocus()) return;
  try {
    const n = new Notification(titulo, { body: texto.slice(0, 140), icon: "/icon.png", tag: "mencao" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* navegador sem aviso */
  }
}

/** Abre as Configurações já numa seção (ex.: "voz", pelo "Configurações de voz" dos menus). */
export function abrirConfiguracoes(secao?: string) {
  if (secao) local.set("cfg-secao", secao);
  setApp({ configAberto: true });
}
