/*
 * Regras puras do editor de story do InstaNanico (sem React nem canvas), testadas em storyEditor.test.ts.
 * O story tem 1080×1920 "pontos de story"; a tela do editor é a mesma coisa em escala (k = largura na tela / 1080),
 * então o que aparece no editor é exatamente o que sai na imagem.
 */

import type { Figurinha } from "./insta";

export const STORY_W = 1080;
export const STORY_H = 1920;

/** Estilos de texto, como os do Instagram (Clássica, Moderna, Neon, Máquina de escrever, Forte). */
export type Fonte = "classica" | "moderna" | "neon" | "maquina" | "forte";
export const FONTES: { id: Fonte; nome: string }[] = [
  { id: "classica", nome: "Clássica" },
  { id: "moderna", nome: "Moderna" },
  { id: "neon", nome: "Neon" },
  { id: "maquina", nome: "Máquina" },
  { id: "forte", nome: "Forte" },
];
/** Fundo do texto: nada, caixa da cor (texto claro/escuro) ou caixa clara (texto na cor). */
export type CaixaTexto = "nada" | "cor" | "clara";
export type Alinhar = "center" | "left" | "right";

/** Quantas cores tem a paleta (as cores ficam no CSS, `--ig-tinta-0` … `--ig-tinta-9`). */
export const N_TINTAS = 10;

type Base = { id: number; x: number; y: number; escala: number; rot: number };
export type ItemTexto = Base & { tipo: "texto"; texto: string; fonte: Fonte; cor: number; caixa: CaixaTexto; alinhar: Alinhar; tamanho: number };
export type ItemEmoji = Base & { tipo: "emoji"; emoji: string };
export type ItemMencao = Base & { tipo: "mencao"; userId: string; nome: string };
export type ItemHora = Base & { tipo: "hora"; texto: string };
export type ItemLocal = Base & { tipo: "local"; texto: string };
/** A figurinha que se toca (enquete, pergunta, contagem, publicação): não entra na imagem, vai por cima (seção 68). */
export type FigSemLugar = DistributiveOmit<Figurinha, "x" | "y" | "escala" | "rot">;
export type ItemInterativo = Base & { tipo: "interativo"; fig: FigSemLugar };
export type Item = ItemTexto | ItemEmoji | ItemMencao | ItemHora | ItemLocal | ItemInterativo;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type Pincel = "caneta" | "marca" | "neon" | "borracha";
export type Traco = { pincel: Pincel; cor: number; tam: number; pontos: number[] };

/** Largura máxima de uma linha de texto (antes da escala do item). */
export const LARGURA_TEXTO = STORY_W * 0.84;
/** Altura de linha do texto, em relação ao tamanho da letra. */
export const ALTURA_LINHA = 1.25;

/**
 * Quebra o texto em linhas que cabem em `max` (respeita as quebras que a pessoa digitou; palavra maior que a linha
 * é cortada no meio). `medir` diz a largura de um pedaço de texto na fonte certa.
 */
export function quebrarLinhas(texto: string, max: number, medir: (t: string) => number): string[] {
  const out: string[] = [];
  for (const par of texto.split("\n")) {
    if (!par) {
      out.push("");
      continue;
    }
    let linha = "";
    for (const palavra of par.split(/(\s+)/)) {
      if (!palavra) continue;
      const tenta = linha + palavra;
      if (medir(tenta) <= max || !linha.trim()) {
        /* palavra sozinha maior que a linha: corta por letras */
        if (!linha.trim() && medir(tenta) > max) {
          let pedaco = linha;
          for (const ch of palavra) {
            if (medir(pedaco + ch) > max && pedaco) {
              out.push(pedaco);
              pedaco = ch;
            } else pedaco += ch;
          }
          linha = pedaco;
        } else linha = tenta;
      } else {
        out.push(linha.trimEnd());
        linha = /^\s+$/.test(palavra) ? "" : palavra;
        if (medir(linha) > max) {
          let pedaco = "";
          for (const ch of linha) {
            if (medir(pedaco + ch) > max && pedaco) {
              out.push(pedaco);
              pedaco = ch;
            } else pedaco += ch;
          }
          linha = pedaco;
        }
      }
    }
    out.push(linha.trimEnd());
  }
  return out;
}

/** O texto como ele aparece (o estilo Forte é todo em maiúsculas). */
export const textoVisivel = (it: Pick<ItemTexto, "texto" | "fonte">) => (it.fonte === "forte" ? it.texto.toLocaleUpperCase("pt-BR") : it.texto);

/** Puxa para o centro (as guias do Instagram): perto de `alvo`, gruda nele. */
export function encaixar(v: number, alvo = 0.5, raio = 0.015): { v: number; grudou: boolean } {
  return Math.abs(v - alvo) <= raio ? { v: alvo, grudou: true } : { v, grudou: false };
}

type Pt = { x: number; y: number };
/** Pinça com dois dedos: quanto a distância cresceu (escala) e quanto girou (radianos), de um par de pontos a outro. */
export function pinca(a0: Pt, b0: Pt, a1: Pt, b1: Pt): { escala: number; giro: number } {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y) || 1;
  const g0 = Math.atan2(b0.y - a0.y, b0.x - a0.x);
  const g1 = Math.atan2(b1.y - a1.y, b1.x - a1.x);
  let giro = g1 - g0;
  if (giro > Math.PI) giro -= 2 * Math.PI;
  if (giro < -Math.PI) giro += 2 * Math.PI;
  return { escala: d1 / d0, giro };
}

/** Limites do tamanho de um item (para não sumir nem tapar tudo). */
export const limitarEscala = (e: number) => Math.min(6, Math.max(0.25, e));

/**
 * Pontas de um degradê linear em CSS (`linear-gradient(<graus>deg, …)`) num retângulo w×h, para o canvas desenhar
 * igual: o ângulo conta a partir de "para cima", no sentido do relógio.
 */
export function pontasDegrade(graus: number, w: number, h: number) {
  const r = (graus * Math.PI) / 180;
  const dx = Math.sin(r),
    dy = -Math.cos(r);
  /* comprimento da linha do degradê no CSS: |w·sen| + |h·cos| */
  const L = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w / 2,
    cy = h / 2;
  return { x0: cx - (dx * L) / 2, y0: cy - (dy * L) / 2, x1: cx + (dx * L) / 2, y1: cy + (dy * L) / 2 };
}

/** Item está em cima da lixeira (embaixo, no meio)? Em frações da tela do story. */
export const naLixeira = (x: number, y: number) => y > 0.86 && Math.abs(x - 0.5) < 0.12;

/** Hora no formato do adesivo (21:43). */
export const horaAdesivo = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
