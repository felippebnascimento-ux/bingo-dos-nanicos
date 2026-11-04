"use client";
/*
 * O quarto próprio desenhado em qualquer tamanho (6, 9 ou 12): piso em xadrez, as duas paredes com a tinta, o neon e o
 * pôster equipados (como no quarto fixo da ficha), a porta no piso (0, 0) e os móveis na ordem certa (camadasQuarto).
 * Serve para a ficha, para a tela de arrumar e, na fase 35, para as visitas. Com `aoTocarPiso`, cada piso vira um alvo.
 * Com `tipo`, desenha as cenas especiais (cenas.ts): a rua (gramado e a fachada do K-FOFO com a porta) e o corredor
 * dos quartos (uma porta por nanico, aberta ou fechada, tocável).
 */
import { memo, useId, useMemo } from "react";
import { ANCORA, caixaDoBoneco, CEL_H, CEL_W, ordemZ, quadroSprite, type Caixa, type Sentido } from "@/features/hall/hall";
import { BaloesSvg } from "@/features/hall/ChatHabbo";
import { iconeAcao, type Acao } from "@/features/hall/acoes";
import { EstadoNoMovel, TintaQuarto } from "./EstadoMovel";
import { useEquipados } from "@/features/loja/lojaDados";
import { corDoQuarto, ehInterativo, type EstadoMovel } from "./interativo";
import { desenharMovel, Poligonos, type Poly, type Pt } from "./Moveis";
import { camadasQuarto, type Retangulo } from "./quarto";
import { MARCA_PENALTI, type PortaCorredor } from "./cenas";
import type { Pixo } from "./pixacoes";

const TW = 46, TH = 23, ZS = 1.3, WH = 150, MARGEM = 24;

export type MovelCena = { id: number; desenho: string; ret: Retangulo; giro: boolean; estado?: EstadoMovel };
export type Equip = { parede?: string; luz?: string; poster?: string };
/** Um boneco andando no quarto (visitas, fase 35): a posição em pisos e, sentado, o centro do assento e o móvel. */
export type BonecoCena = {
  key: string;
  nome: string;
  folha: string | null;
  i: number;
  j: number;
  sentido: Sentido;
  quadro: number;
  sentado: { i: number; j: number; movel: number } | null;
  eu: boolean;
  /** user_id, para os balões do chat (ChatHabbo) */
  uid?: string | null;
  /** acenar, dançar ou deitar (hall/acoes.ts) */
  acao?: Acao | null;
};

/** A projeção de um quarto de lado n: a origem fica no canto de cima, com folga para as paredes. */
export function projecao(n: number) {
  const X0 = n * TW + MARGEM, Y0 = WH * ZS + MARGEM + 10;
  const p = (i: number, j: number, z = 0): Pt => [X0 + (i - j) * TW, Y0 + (i + j) * TH - z * ZS];
  return { p, largura: 2 * n * TW + 2 * MARGEM, altura: Y0 + 2 * n * TH + MARGEM };
}

/** A rua: gramado em dois tons, a calçada de terra da porta até a árvore, a marca do pênalti e a fachada do K-FOFO. */
function fundoRua(n: number, p: (i: number, j: number, z?: number) => Pt): Poly[] {
  const L: Poly[] = [];
  const poly = (q: Pt[], c: string, linha = false) => L.push({ q, c, linha });
  /* a fachada do K-FOFO na parede da direita (j = 0), com a porta no piso (0, 0) */
  poly([p(0, 0), p(n, 0), p(n, 0, WH), p(0, 0, WH)], "fachada");
  for (let z = 10; z < WH; z += 12) poly([p(0, 0, z), p(n, 0, z), p(n, 0, z + 1.5), p(0, 0, z + 1.5)], "fachada-linha");
  poly([p(0, 0, WH), p(n, 0, WH), p(n, 0, WH + 10), p(0, 0, WH + 10)], "topo2");
  poly([p(0.12, 0), p(0.88, 0), p(0.88, 0, 104), p(0.12, 0, 104)], "porta", true);
  poly([p(2.2, 0, 112), p(6.4, 0, 112), p(6.4, 0, 138), p(2.2, 0, 138)], "placa-kfofo", true);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) poly([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], (i + j) % 2 ? "grama0" : "grama1");
  for (let k = 0; k < 4; k++) poly([p(0.2 + k, 0.25 + k), p(1.0 + k, 0.25 + k), p(1.0 + k, 1.0 + k), p(0.2 + k, 1.0 + k)], "terra");
  poly([p(MARCA_PENALTI.i - 0.12, MARCA_PENALTI.j - 0.12), p(MARCA_PENALTI.i + 0.12, MARCA_PENALTI.j - 0.12), p(MARCA_PENALTI.i + 0.12, MARCA_PENALTI.j + 0.12), p(MARCA_PENALTI.i - 0.12, MARCA_PENALTI.j + 0.12)], "cal");
  poly([p(9.2, 1.4), p(n, 1.4), p(n, 5.6), p(9.2, 5.6)], "cal-area", true);
  return L;
}

/** O banheiro: azulejo nas duas paredes, piso de ladrilho e a saída para o K-FOFO no piso (0, 0). */
function fundoBanheiro(n: number, p: (i: number, j: number, z?: number) => Pt): Poly[] {
  const L: Poly[] = [];
  const poly = (q: Pt[], c: string, linha = false) => L.push({ q, c, linha });
  poly([p(0, 0), p(0, n), p(0, n, WH), p(0, 0, WH)], "azulejo1");
  poly([p(0, 0), p(n, 0), p(n, 0, WH), p(0, 0, WH)], "azulejo2");
  /* o rejunte do azulejo: linhas a cada meio piso e a cada 18 de altura */
  for (let a = 0.5; a < n; a += 0.5) {
    poly([p(0, a), p(0, a + 0.02), p(0, a + 0.02, WH), p(0, a, WH)], "rejunte-b");
    poly([p(a, 0), p(a + 0.02, 0), p(a + 0.02, 0, WH), p(a, 0, WH)], "rejunte-b");
  }
  for (let z = 18; z < WH; z += 18) {
    poly([p(0, 0, z), p(0, n, z), p(0, n, z + 1), p(0, 0, z + 1)], "rejunte-b");
    poly([p(0, 0, z), p(n, 0, z), p(n, 0, z + 1), p(0, 0, z + 1)], "rejunte-b");
  }
  poly([p(0, 0, WH), p(0, n, WH), p(0, n, WH + 10), p(0, 0, WH + 10)], "topo1");
  poly([p(0, 0, WH), p(n, 0, WH), p(n, 0, WH + 10), p(0, 0, WH + 10)], "topo2");
  poly([p(0.12, 0), p(0.88, 0), p(0.88, 0, 104), p(0.12, 0, 104)], "porta", true);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) poly([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], (i + j) % 2 ? "ladrilho0" : "ladrilho1");
  /* o espelho em cima da pia */
  poly([p(0, 4.1, 70), p(0, 4.9, 70), p(0, 4.9, 118), p(0, 4.1, 118)], "espelho", true);
  return L;
}

/** As pixações deitadas nas paredes do banheiro (texto livre de quem escreveu; o React escapa tudo). */
function Pixos({ lista, p }: { lista: readonly Pixo[]; p: (i: number, j: number, z?: number) => Pt }) {
  const L = Math.hypot(TW, TH);
  return (
    <g className="quarto-pixos" pointerEvents="none">
      {lista.map((x) => {
        const [ox, oy] = x.parede === "dir" ? p(x.a, 0, x.z) : p(0, x.a, x.z);
        /* o papel reto entortado para o plano da parede: na da direita +i vai para a direita e desce; na da esquerda o
           texto anda para −j (sobe para a direita) */
        const m = x.parede === "dir" ? `matrix(${TW / L} ${TH / L} 0 1 ${ox} ${oy})` : `matrix(${TW / L} ${-TH / L} 0 1 ${ox} ${oy})`;
        return (
          <g key={x.id} transform={m}>
            <text className={"quarto-pixo p-" + x.cor} transform={`rotate(${x.rot})`} textAnchor="middle">
              {x.texto}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * A Pirapó 114 (das fotos e da planta do João): paredes bege com moldura e rodapé brancos; a porta de entrada no meio
 * do corredor; no corredor, as portas brancas de almofada, o quadro do gato e os armários espelhados; no quarto, a
 * janela com grade e persiana; o ar-condicionado da sala; e os pisos de cada cômodo: o claro com a faixa de granito
 * no corredor, o claro da cozinha, o taco em espinha do quarto, o porcelanato brilhante da sala e a cerâmica da sacada,
 * com a mureta de madeira e a grade. Fora do prédio fica escuro.
 */
function fundoPirapo(n: number, p: (i: number, j: number, z?: number) => Pt): Poly[] {
  const L: Poly[] = [];
  const poly = (q: Pt[], c: string, linha = false) => L.push({ q, c, linha });
  const ret = (i0: number, j0: number, i1: number, j1: number, c: string, linha = false) => poly([p(i0, j0), p(i1, j0), p(i1, j1), p(i0, j1)], c, linha);
  const naDir = (i0: number, i1: number, z0: number, z1: number, c: string, linha = false) => poly([p(i0, 0, z0), p(i1, 0, z0), p(i1, 0, z1), p(i0, 0, z1)], c, linha);
  const naEsq = (j0: number, j1: number, z0: number, z1: number, c: string, linha = false) => poly([p(0, j0, z0), p(0, j1, z0), p(0, j1, z1), p(0, j0, z1)], c, linha);
  const ate = 14; /* a parede da direita vai até a sala; a sacada fica para fora */
  poly([p(0, 0), p(0, n), p(0, n, WH), p(0, 0, WH)], "pp-parede1");
  poly([p(0, 0), p(ate, 0), p(ate, 0, WH), p(0, 0, WH)], "pp-parede2");
  poly([p(0, 0, WH), p(0, n, WH), p(0, n, WH + 10), p(0, 0, WH + 10)], "pp-branco1");
  poly([p(0, 0, WH), p(ate, 0, WH), p(ate, 0, WH + 10), p(0, 0, WH + 10)], "pp-branco2");
  naEsq(0, n, WH - 8, WH, "pp-branco0");
  naDir(0, ate, WH - 8, WH, "pp-branco0");
  naEsq(0, n, 0, 9, "pp-branco1");
  naDir(0, ate, 0, 9, "pp-branco0");
  /* a porta de entrada, no meio do corredor (piso 5, 0) */
  naDir(5.08, 5.92, 0, 108, "pp-branco0", true);
  naDir(5.18, 5.82, 56, 100, "pp-branco1", true);
  naDir(5.18, 5.82, 10, 48, "pp-branco1", true);
  naDir(5.76, 5.82, 52, 56, "pp-macaneta");
  /* as portas brancas de almofada do lado direito do corredor e o quadro do gato */
  for (const i0 of [1.2, 3.1]) {
    naDir(i0, i0 + 0.8, 0, 108, "pp-branco0", true);
    naDir(i0 + 0.1, i0 + 0.7, 54, 98, "pp-branco1", true);
    naDir(i0 + 0.1, i0 + 0.7, 10, 46, "pp-branco1", true);
    naDir(i0 + 0.66, i0 + 0.72, 50, 54, "pp-macaneta");
  }
  naDir(6.25, 7.45, 66, 128, "pp-moldura", true);
  naDir(6.4, 7.3, 72, 122, "pp-branco0");
  naDir(6.55, 7.15, 78, 116, "pp-gato0");
  naDir(6.7, 7.0, 96, 110, "pp-gato1");
  /* os armários espelhados na parede da esquerda do corredor */
  naEsq(0.15, 2.85, 8, 128, "pp-branco1", true);
  naEsq(0.25, 1.45, 14, 122, "pp-espelho", true);
  naEsq(1.55, 2.75, 14, 122, "pp-espelho", true);
  /* a janela do quarto, com a grade e a persiana branca enrolada no alto */
  naEsq(10, 13, 56, 112, "pp-janela", true);
  for (let jj = 10.25; jj < 13; jj += 0.25) naEsq(jj, jj + 0.03, 56, 112, "pp-grade");
  naEsq(10, 13, 98, 112, "pp-cortina");
  /* o ar-condicionado da sala */
  naDir(10.9, 12.5, 112, 128, "pp-branco0", true);
  naDir(11, 12.4, 113, 116, "pp-branco2");
  /* pisos: cada cômodo com o seu (quarto de taco em espinha) e o lado de fora do prédio escuro */
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const corredor = j <= 2 && i <= 8, quarto = i <= 2 && j >= 4, sala = i >= 9 && i <= 13, sacada = i >= 14 && j >= 4 && j <= 7, fora = i >= 14 && !sacada && i !== 14;
      if (quarto) {
        for (let k = 0; k < 4; k++) {
          const a = k / 4, b = (k + 1) / 4;
          if ((i + j) % 2) ret(i + a, j, i + b, j + 1, k % 2 ? "pp-taco0" : "pp-taco1", true);
          else ret(i, j + a, i + 1, j + b, k % 2 ? "pp-taco1" : "pp-taco0", true);
        }
      } else
        ret(i, j, i + 1, j + 1, fora ? "pp-fora" : sala ? ((i + j) % 2 ? "pp-porc0" : "pp-porc1") : sacada ? "pp-sacada" : corredor || (i + j) % 2 ? "pp-piso0" : "pp-piso1", !fora);
    }
  /* o brilho do porcelanato da sala e a faixa de granito do corredor */
  poly([p(10, 3), p(10.7, 3), p(12.8, 11), p(12.1, 11)], "pp-reflexo");
  ret(0.3, 0.7, 8.6, 1.3, "pp-granito");
  /* a sacada: a mureta de madeira com a grade, na beirada de fora */
  poly([p(n, 4), p(n, 8), p(n, 8, 40), p(n, 4, 40)], "pp-mureta1", true);
  for (let jj = 4.2; jj < 8; jj += 0.3) poly([p(n, jj, 40), p(n, jj + 0.04, 40), p(n, jj + 0.04, 62), p(n, jj, 62)], "preto1");
  poly([p(n, 4, 60), p(n, 8, 60), p(n, 8, 63), p(n, 4, 63)], "preto0");
  return L;
}

/** O corredor: as duas paredes sem janela nem pôster, o carpete comprido e a saída para o K-FOFO no piso (0, 0). */
/** O corredor no jeito de hotel (opção 1, escolhida em 03/11/2026): papel de parede listrado, lambri de madeira
    com friso dourado, sanca no alto, piso de tábuas escuras e o carpete vinho com losangos dourados. */
function fundoCorredor(n: number, p: (i: number, j: number, z?: number) => Pt): Poly[] {
  const L: Poly[] = [];
  const poly = (q: Pt[], c: string, linha = false) => L.push({ q, c, linha });
  const esq = (a: number, b: number, z0: number, z1: number, c: string) => poly([p(0, a, z0), p(0, b, z0), p(0, b, z1), p(0, a, z1)], c);
  const dir = (a: number, b: number, z0: number, z1: number, c: string) => poly([p(a, 0, z0), p(b, 0, z0), p(b, 0, z1), p(a, 0, z1)], c);
  esq(0, n, 0, WH, "hotel-papel1");
  dir(0, n, 0, WH, "hotel-papel2");
  for (let a = 0.25; a < n; a += 0.5) {
    esq(a, a + 0.08, 48, WH - 12, "hotel-listra");
    dir(a, a + 0.08, 48, WH - 12, "hotel-listra");
  }
  /* o lambri: tábuas verticais, o friso dourado em cima e o rodapé escuro */
  esq(0, n, 0, 46, "hotel-lambri1");
  dir(0, n, 0, 46, "hotel-lambri2");
  for (let a = 0.5; a < n; a += 0.5) {
    esq(a, a + 0.02, 8, 44, "hotel-lambri-junta");
    dir(a, a + 0.02, 8, 44, "hotel-lambri-junta");
  }
  esq(0, n, 44, 49, "hotel-friso");
  dir(0, n, 44, 49, "hotel-friso");
  esq(0, n, 0, 8, "hotel-rodape");
  dir(0, n, 0, 8, "hotel-rodape");
  /* a sanca no alto, com o friso dourado embaixo */
  esq(0, n, WH - 12, WH, "hotel-sanca1");
  dir(0, n, WH - 12, WH, "hotel-sanca2");
  esq(0, n, WH - 14, WH - 12, "hotel-friso");
  dir(0, n, WH - 14, WH - 12, "hotel-friso");
  poly([p(0, 0, WH), p(0, n, WH), p(0, n, WH + 10), p(0, 0, WH + 10)], "topo1");
  poly([p(0, 0, WH), p(n, 0, WH), p(n, 0, WH + 10), p(0, 0, WH + 10)], "topo2");
  /* a saída para o K-FOFO: batente e porta de duas folhas com almofadas */
  dir(0.06, 0.94, 0, 108, "batente");
  dir(0.12, 0.88, 0, 104, "porta");
  dir(0.495, 0.505, 0, 104, "batente");
  for (const [a, b] of [[0.18, 0.44], [0.56, 0.82]]) {
    dir(a, b, 54, 96, "hotel-almofada");
    dir(a, b, 8, 46, "hotel-almofada");
  }
  /* piso de tábuas escuras, compridas no sentido de i, com as emendas desencontradas */
  for (let j = 0; j < n; j += 0.5) {
    const s = Math.round(j * 2) % 2 ? 0.5 : 0;
    for (let i = -s; i < n; i += 1) {
      const a = Math.max(0, i), b = Math.min(n, i + 1);
      poly([p(a, j), p(b, j), p(b, j + 0.5), p(a, j + 0.5)], Math.round(i + j * 2) % 2 ? "hotel-piso0" : "hotel-piso1", true);
    }
  }
  /* o carpete: borda dourada, miolo vinho e os losangos */
  poly([p(1.1, 1.1), p(n - 0.5, 1.1), p(n - 0.5, n - 0.5), p(1.1, n - 0.5)], "hotel-friso");
  poly([p(1.18, 1.18), p(n - 0.58, 1.18), p(n - 0.58, n - 0.58), p(1.18, n - 0.58)], "carpete0");
  poly([p(1.45, 1.45), p(n - 0.85, 1.45), p(n - 0.85, n - 0.85), p(1.45, n - 0.85)], "carpete1");
  for (let a = 1.9; a < n - 1; a += 1.1)
    for (let b = 1.9; b < n - 1; b += 1.1) poly([p(a, b + 0.3), p(a + 0.3, b), p(a + 0.6, b + 0.3), p(a + 0.3, b + 0.6)], "hotel-losango");
  return L;
}

function paredes(n: number, p: (i: number, j: number, z?: number) => Pt, e: Equip): Poly[] {
  const L: Poly[] = [];
  const poly = (q: Pt[], c: string, linha = false) => L.push({ q, c, linha });
  const tinta = e.parede === "oliva" || e.parede === "ardosia" ? e.parede : "parede";
  poly([p(0, 0), p(0, n), p(0, n, WH), p(0, 0, WH)], tinta + "1");
  poly([p(0, 0), p(n, 0), p(n, 0, WH), p(0, 0, WH)], tinta + "2");
  for (const a of [0.9, 0.4]) {
    poly([p(0, 0), p(0, a), p(0, a, WH), p(0, 0, WH)], "sombra-leve");
    poly([p(0, 0), p(a, 0), p(a, 0, WH), p(0, 0, WH)], "sombra-leve");
  }
  if (e.luz === "ouro" || e.luz === "vermelho") {
    poly([p(0, 0.2, WH - 16), p(0, n - 0.2, WH - 16), p(0, n - 0.2, WH - 11), p(0, 0.2, WH - 11)], "neon-" + e.luz);
    poly([p(0.2, 0, WH - 16), p(n - 0.2, 0, WH - 16), p(n - 0.2, 0, WH - 11), p(0.2, 0, WH - 11)], "neon-" + e.luz);
  }
  poly([p(0, 0, WH), p(0, n, WH), p(0, n, WH + 10), p(0, 0, WH + 10)], "topo1");
  poly([p(0, 0, WH), p(n, 0, WH), p(n, 0, WH + 10), p(0, 0, WH + 10)], "topo2");
  poly([p(0, 0), p(0, n), p(0, n, 8), p(0, 0, 8)], "rodape1");
  poly([p(0, 0), p(n, 0), p(n, 0, 8), p(0, 0, 8)], "rodape2");
  /* a porta, na parede da direita, em frente ao piso (0, 0) */
  poly([p(0.12, 0), p(0.88, 0), p(0.88, 0, 104), p(0.12, 0, 104)], "porta", true);
  /* janela na parede da esquerda e o pôster na da direita, no meio de cada uma */
  const jm = n / 2;
  poly([p(0, jm - 1, 60), p(0, jm + 1, 60), p(0, jm + 1, 130), p(0, jm - 1, 130)], "janela", true);
  poly([p(0, jm - 0.85, 66), p(0, jm + 0.85, 66), p(0, jm + 0.85, 124), p(0, jm - 0.85, 124)], "ceu");
  poly([p(0, jm - 0.85, 104), p(0, jm + 0.85, 104), p(0, jm + 0.85, 124), p(0, jm - 0.85, 124)], "ceu-claro");
  const im = Math.max(2, n / 2);
  poly([p(im - 1, 0, 64), p(im + 1, 0, 64), p(im + 1, 0, 136), p(im - 1, 0, 136)], "poster", true);
  if (e.poster === "roxo") poly([p(im - 0.85, 0, 70), p(im + 0.85, 0, 70), p(im + 0.85, 0, 130), p(im - 0.85, 0, 130)], "roxo1");
  else if (e.poster === "sitio") {
    poly([p(im - 0.85, 0, 70), p(im + 0.85, 0, 70), p(im + 0.85, 0, 130), p(im - 0.85, 0, 130)], "ceu");
    poly([p(im - 0.85, 0, 70), p(im + 0.85, 0, 70), p(im + 0.85, 0, 88), p(im - 0.85, 0, 88)], "planta0");
  } else
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        const i = im - 0.75 + a * 0.52, z = 74 + b * 19;
        poly([p(i, 0, z), p(i + 0.4, 0, z), p(i + 0.4, 0, z + 14), p(i, 0, z + 14)], (a + b) % 2 ? "cartela1" : "cartela0");
      }
  /* piso em xadrez e o capacho da porta */
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) poly([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], (i + j) % 2 ? "piso0" : "piso1");
  poly([p(0.1, 0.1), p(0.9, 0.1), p(0.9, 0.9), p(0.1, 0.9)], "tapete0");
  return L;
}

export const QuartoCena = memo(function QuartoCena({
  tamanho,
  equip,
  moveis,
  nome,
  boneco,
  selecionado = null,
  destaque = null,
  aoTocarPiso,
  aoPassarPiso,
  aoTocarMovel,
  bonecos,
  brilhos,
  tipo = "quarto",
  portas,
  aoTocarPorta,
  aoTocarSaida,
  porta = { i: 0, j: 0 },
  pixos,
  pisosCor,
}: {
  tamanho: number;
  equip: Equip;
  moveis: readonly MovelCena[];
  nome?: string;
  boneco?: string | null;
  selecionado?: number | null;
  destaque?: { ret: Retangulo; cabe: boolean } | null;
  aoTocarPiso?: (i: number, j: number) => void;
  aoPassarPiso?: (i: number, j: number) => void;
  aoTocarMovel?: (id: number) => void;
  bonecos?: readonly BonecoCena[];
  brilhos?: readonly { id: string; i: number; j: number }[];
  tipo?: "quarto" | "rua" | "corredor" | "banheiro" | "pirapo";
  /** as pixações do banheiro */
  pixos?: readonly Pixo[];
  /** a arena (seção 58): "i,j" → cor do time que pintou */
  pisosCor?: Readonly<Record<string, "azul" | "vermelho">>;
  portas?: readonly PortaCorredor[];
  aoTocarPorta?: (fid: string) => void;
  /** a porta do piso (0, 0): na rua e no corredor, volta ao K-FOFO */
  aoTocarSaida?: () => void;
  /** o piso da porta na parede da direita (j = 0): o 0,0 de sempre, ou o da cena (portaDaCena) */
  porta?: { i: number; j: number };
}) {
  const n = tamanho;
  const { p, largura, altura } = useMemo(() => projecao(n), [n]);
  const fundo = useMemo(
    () => (tipo === "rua" ? fundoRua(n, p) : tipo === "corredor" ? fundoCorredor(n, p) : tipo === "banheiro" ? fundoBanheiro(n, p) : tipo === "pirapo" ? fundoPirapo(n, p) : paredes(n, p, equip)),
    [n, p, equip, tipo],
  );
  const ordem = useMemo(() => camadasQuarto(moveis.map((m) => m.ret)), [moveis]);
  /* com bonecos: quem está em pé entra na ordem com os móveis; quem está sentado vem logo depois do móvel dele */
  const camadas = useMemo(() => {
    if (!bonecos?.length) return ordem.map((k) => ({ movel: k }));
    const empe = bonecos.flatMap((b, k) => (b.sentado ? [] : [k]));
    const caixas: Caixa[] = [...moveis.map((m) => ({ i0: m.ret.i, i1: m.ret.i + m.ret.w, j0: m.ret.j, j1: m.ret.j + m.ret.d })), ...empe.map((k) => caixaDoBoneco(bonecos[k].i, bonecos[k].j))];
    const out: ({ movel: number } | { boneco: number })[] = [];
    for (const k of ordemZ(caixas)) {
      if (k < moveis.length) {
        out.push({ movel: k });
        bonecos.forEach((b, x) => b.sentado?.movel === moveis[k].id && out.push({ boneco: x }));
      } else out.push({ boneco: empe[k - moveis.length] });
    }
    /* sentado num móvel que acabou de sair: aparece por cima de tudo até levantar */
    bonecos.forEach((b, x) => b.sentado && !moveis.some((m) => m.id === b.sentado!.movel) && out.push({ boneco: x }));
    return out;
  }, [ordem, moveis, bonecos]);
  const escala = 1.6;
  const [px, py] = p(0.5, 0.5);
  /* um filtro por cena: o mesmo id em duas cenas (uma escondida) faria a sombra sumir */
  const sombraId = useId() + "sombra";
  return (
    <svg className="quarto quarto-cena" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={nome ? `Quarto de ${nome}` : "Quarto"}>
      <Poligonos lista={fundo} />
      {tipo === "rua" && (
        <text className="quarto-placa-texto" {...rotParede(p, 4.3, 0, 120)}>
          K-FOFO
        </text>
      )}
      {aoTocarSaida && (
        <polygon className="quarto-alvo-porta" points={[p(porta.i + 0.12, 0), p(porta.i + 0.88, 0), p(porta.i + 0.88, 0, 104), p(porta.i + 0.12, 0, 104)].map((v) => v.join(",")).join(" ")} onClick={aoTocarSaida}>
          <title>Voltar ao K-FOFO</title>
        </polygon>
      )}
      {pixos && <Pixos lista={pixos} p={p} />}
      {pisosCor &&
        Object.entries(pisosCor).map(([k, cor]) => {
          const [i, j] = k.split(",").map(Number);
          return <polygon key={"pinta" + k} className={"arena-piso " + cor} pointerEvents="none" points={[p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)].map((v) => v.join(",")).join(" ")} />;
        })}
      {portas?.map((d) => (
        <PortaNaParede key={d.fid} d={d} p={p} aoTocar={aoTocarPorta} />
      ))}
      {/* sombra de cada móvel no chão (luz de cima à esquerda: cai para +i), menos dos tapetes */}
      <defs>
        <filter id={sombraId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g className="quarto-sombras" filter={`url(#${sombraId})`} pointerEvents="none">
        {moveis
          .filter((m) => !m.desenho.startsWith("tapete") && m.desenho !== "fora")
          .map((m) => (
            <polygon
              key={m.id}
              points={[p(m.ret.i + 0.2, m.ret.j + 0.1), p(m.ret.i + m.ret.w + 0.28, m.ret.j + 0.1), p(m.ret.i + m.ret.w + 0.28, m.ret.j + m.ret.d + 0.14), p(m.ret.i + 0.2, m.ret.j + m.ret.d + 0.14)]
                .map((v) => v.join(","))
                .join(" ")}
            />
          ))}
      </g>
      {aoTocarPiso &&
        Array.from({ length: n * n }, (_, k) => {
          const i = k % n, j = Math.floor(k / n);
          return (
            <polygon
              key={"alvo" + k}
              className="quarto-alvo"
              points={[p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)].map((v) => v.join(",")).join(" ")}
              onClick={() => aoTocarPiso(i, j)}
              onMouseEnter={aoPassarPiso ? () => aoPassarPiso(i, j) : undefined}
            />
          );
        })}
      {destaque && (
        <polygon
          className={destaque.cabe ? "q-cabe" : "q-naocabe"}
          pointerEvents="none"
          points={[
            p(destaque.ret.i, destaque.ret.j),
            p(destaque.ret.i + destaque.ret.w, destaque.ret.j),
            p(destaque.ret.i + destaque.ret.w, destaque.ret.j + destaque.ret.d),
            p(destaque.ret.i, destaque.ret.j + destaque.ret.d),
          ]
            .map((v) => v.join(","))
            .join(" ")}
        />
      )}
      {camadas.map((c) => {
        if ("boneco" in c) return <BonecoNoQuarto key={"b:" + bonecos![c.boneco].key} b={bonecos![c.boneco]} p={p} />;
        const m = moveis[c.movel];
        return (
          <g
            key={m.id}
            className={"quarto-movel" + (selecionado === m.id ? " sel" : "") + (aoTocarMovel ? " tocavel" : "") + (m.desenho === "luminaria" && m.estado?.liga === false ? " apagada" : "")}
            onClick={aoTocarMovel ? () => aoTocarMovel(m.id) : undefined}
          >
            <Poligonos lista={desenharMovel(p, m.desenho, m.ret, m.giro)} />
            {ehInterativo(m.desenho) && <EstadoNoMovel m={m} p={p} />}
          </g>
        );
      })}
      {/* o regulador de luz pinta o quarto inteiro */}
      {tipo === "quarto" && <TintaQuarto cor={corDoQuarto(moveis)} largura={largura} altura={altura} />}
      {brilhos?.map((b) => {
        const [x, y] = p(b.i + 0.5, b.j + 0.5);
        return <circle key={b.id} className="quarto-brilho" cx={x} cy={y - 50} r={46} pointerEvents="none" />;
      })}
      {bonecos && (
        <BaloesSvg
          itens={bonecos.map((b) => {
            const [x, y] = b.sentado ? p(b.sentado.i, b.sentado.j) : p(b.i + 0.5, b.j + 0.5);
            return { key: b.key, nome: b.nome, uid: b.uid, x, y: y - CEL_H * ESCALA_VISITA * (b.sentado ? 0.8 : 1) };
          })}
        />
      )}
      {boneco && (
        <svg x={px - ANCORA.x * escala} y={py - ANCORA.y * escala} width={CEL_W * escala} height={CEL_H * escala} viewBox={`0 0 ${CEL_W} ${CEL_H}`} pointerEvents="none">
          <image href={boneco} width={CEL_W * 5} height={CEL_H * 2} />
        </svg>
      )}
    </svg>
  );
});

/** O boneco no quarto: o quadro da folha (espelhado nos lados esquerdos), ou um pino com as iniciais, e o nome. */
const ESCALA_VISITA = 1.15;
function BonecoNoQuarto({ b, p }: { b: BonecoCena; p: (i: number, j: number, z?: number) => Pt }) {
  /* efeito comprado na loja (seção 61) */
  const efeito = useEquipados(b.uid).efeito?.dados.cor;
  const [x, y0] = b.sentado ? p(b.sentado.i, b.sentado.j) : p(b.i + 0.5, b.j + 0.5);
  /* sentado, o quadril desce para o estofado (como o .boneco.sentado do hall) */
  const y = y0 + (b.sentado ? CEL_H * ESCALA_VISITA * 0.19 : 0);
  const q = quadroSprite(b.sentido, b.sentado ? 0 : b.quadro);
  const w = CEL_W * ESCALA_VISITA, h = CEL_H * ESCALA_VISITA;
  const vx = -q.x, vy = -q.y;
  /* sentado, as pernas somem dentro do estofado (como no K-FOFO): a janela do quadro corta o terço de baixo */
  const corte = b.sentado ? 0.68 : 1;
  return (
    <g className={"quarto-boneco" + (b.eu ? " eu" : "") + (b.acao ? " acao-" + b.acao : "") + (efeito ? " efeito-" + efeito : "")} pointerEvents="none">
      <g className="quarto-corpo">
      {b.folha ? (
        <svg x={x - ANCORA.x * ESCALA_VISITA} y={y - ANCORA.y * ESCALA_VISITA} width={w} height={h * corte} viewBox={`${vx} ${vy} ${CEL_W} ${CEL_H * corte}`}>
          <g transform={q.espelha ? `translate(${2 * vx + CEL_W} 0) scale(-1 1)` : undefined}>
            <image href={b.folha} width={CEL_W * 5} height={CEL_H * 2} />
          </g>
        </svg>
      ) : (
        <circle className="quarto-pino" cx={x} cy={y - 40} r={16} />
      )}
      </g>
      {b.acao && (
        <text className="quarto-acao" x={x + w * 0.3} y={y - h * 0.8} textAnchor="middle" aria-hidden="true">
          {iconeAcao(b.acao)}
        </text>
      )}
      <text className="quarto-boneco-nome" x={x} y={y - h * 0.92} textAnchor="middle">
        {b.nome}
      </text>
    </g>
  );
}

/** Prévia de um móvel sozinho (loja, mochila e guardados), recortada em volta do desenho. */
export const MovelPrevia = memo(function MovelPrevia({ desenho, w, d }: { desenho: string; w: number; d: number }) {
  const { p } = projecao(3);
  const L = desenharMovel(p, desenho, { i: 0.5, j: 0.5, w, d }, false);
  if (!L.length) return null;
  const xs = L.flatMap((f) => f.q.map((v) => v[0])), ys = L.flatMap((f) => f.q.map((v) => v[1]));
  const x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6;
  return (
    <svg className="quarto quarto-previa" viewBox={`${x0} ${y0} ${Math.max(...xs) + 6 - x0} ${Math.max(...ys) + 6 - y0}`} aria-hidden="true">
      <Poligonos lista={L} />
    </svg>
  );
});

/** Texto deitado numa parede: "dir" (j = 0) sobe para a direita; "esq" (i = 0) sobe para a esquerda. */
function rotParede(p: (i: number, j: number, z?: number) => Pt, i: number, j: number, z: number) {
  const [x, y] = p(i, j, z);
  return { x, y, textAnchor: "middle" as const, transform: `rotate(${j === 0 ? 26.57 : -26.57} ${x} ${y})` };
}

/** Uma porta do corredor: aberta (o quarto existe, dá para entrar) ou fechada, com a placa do nome em cima. */
function PortaNaParede({ d, p, aoTocar }: { d: PortaCorredor; p: (i: number, j: number, z?: number) => Pt; aoTocar?: (fid: string) => void }) {
  const ponto = (a: number, z: number) => (d.parede === "dir" ? p(a, 0, z) : p(0, a, z));
  const ret = (a: number, b: number, z0: number, z1: number) => [ponto(a, z0), ponto(b, z0), ponto(b, z1), ponto(a, z1)].map((v) => v.join(",")).join(" ");
  const meio = (d.a + d.b) / 2;
  const placa = d.parede === "dir" ? rotParede(p, meio, 0, 112) : rotParede(p, 0, meio, 112);
  return (
    <g
      className={"quarto-porta-nanico" + (d.aberta ? " aberta" : "")}
      onClick={aoTocar ? () => aoTocar(d.fid) : undefined}
      role="button"
      aria-label={d.aberta ? `Entrar no quarto de ${d.nome}` : `Quarto de ${d.nome}: porta fechada`}
    >
      <polygon points={ret(d.a - 0.07, d.b + 0.07, 0, 102)} className="q-batente q-linha" />
      {d.aberta ? (
        <>
          <polygon points={ret(d.a, d.b, 0, 96)} className="q-porta-dentro" />
          <polygon points={ret(d.a, d.a + (d.b - d.a) * 0.35, 0, 96)} className="q-porta q-linha" />
        </>
      ) : (
        <>
          <polygon points={ret(d.a, d.b, 0, 96)} className="q-porta q-linha" />
          {/* as almofadas da porta, a maçaneta e o olho mágico */}
          <polygon points={ret(d.a + 0.1, d.b - 0.1, 54, 88)} className="q-hotel-almofada" />
          <polygon points={ret(d.a + 0.1, d.b - 0.1, 8, 46)} className="q-hotel-almofada" />
          <polygon points={ret(d.b - 0.16, d.b - 0.09, 46, 52)} className="q-ouro0" />
          <polygon points={ret(meio - 0.02, meio + 0.02, 74, 77)} className="q-ouro1" />
        </>
      )}
      {/* a arandela ao lado da porta, com a luz na parede */}
      <ellipse className="q-hotel-luz" cx={ponto(d.b + 0.17, 110)[0]} cy={ponto(d.b + 0.17, 110)[1]} rx="18" ry="16" />
      <polygon points={ret(d.b + 0.14, d.b + 0.2, 98, 104)} className="q-hotel-arandela" />
      <polygon points={ret(d.b + 0.12, d.b + 0.22, 104, 114)} className="q-hotel-cupula" />
      <polygon points={ret(meio - 0.42, meio + 0.42, 104, 120)} className="q-placa-nome q-linha" />
      <text className="quarto-placa-nome" {...placa}>
        {d.nome.length > 9 ? d.nome.slice(0, 8) + "…" : d.nome}
      </text>
    </g>
  );
}
