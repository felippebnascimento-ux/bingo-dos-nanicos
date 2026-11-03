/*
 * Quarto isométrico da ficha, com o boneco do nanico em pé no tapete.
 * Geometria copiada de planejamento/demo/ficha-demo.html (`p()`, `poly()`, `box()`).
 * As cores são classes `q-<nome>`, definidas como variáveis em 24-ficha.css (com tema escuro).
 * Os itens da loja equipados (`equip`: espaço → cor do item) trocam a parede, o pôster, o tapete, a mesa,
 * a cadeira e a planta e acendem o neon; sem item, fica o quarto padrão.
 */
import { memo } from "react";
import { ANCORA, CEL_H, CEL_W } from "@/features/hall/hall";

type Pt = [number, number];
type Poly = { q: Pt[]; c: string; linha?: boolean };
/** espaço do quarto → a "cor" do item equipado (o `dados.cor` da loja) */
export type EquipQuarto = Partial<Record<"cadeira" | "mesa" | "tapete" | "poster" | "planta" | "parede" | "luz", string>>;

const X0 = 310, Y0 = 300, TW = 46, TH = 23, ZS = 1.3, N = 6, WH = 185;
const p = (i: number, j: number, z = 0): Pt => [X0 + (i - j) * TW, Y0 + (i + j) * TH - z * ZS];

function desenhar(e: EquipQuarto): Poly[] {
  const L: Poly[] = [];
  const poly = (q: Pt[], c: string, linha = false) => L.push({ q, c, linha });
  /* caixa isométrica: canto (i, j), w em i, d em j, altura h, base z */
  const box = (i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z = 0) => {
    poly([p(i, j + d, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i, j + d, z + h)], esq, true);
    poly([p(i + w, j, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i + w, j, z + h)], dir, true);
    poly([p(i, j, z + h), p(i + w, j, z + h), p(i + w, j + d, z + h), p(i, j + d, z + h)], topo, true);
  };
  /* paredes (com a tinta da loja), beiral e rodapé */
  const tinta = e.parede === "oliva" || e.parede === "ardosia" ? e.parede : "parede";
  poly([p(0, 0), p(0, N), p(0, N, WH), p(0, 0, WH)], tinta + "1");
  poly([p(0, 0), p(N, 0), p(N, 0, WH), p(0, 0, WH)], tinta + "2");
  /* neon no alto das duas paredes */
  if (e.luz === "ouro" || e.luz === "vermelho") {
    poly([p(0, 0.2, WH - 16), p(0, N - 0.2, WH - 16), p(0, N - 0.2, WH - 11), p(0, 0.2, WH - 11)], "neon-" + e.luz);
    poly([p(0.2, 0, WH - 16), p(N - 0.2, 0, WH - 16), p(N - 0.2, 0, WH - 11), p(0.2, 0, WH - 11)], "neon-" + e.luz);
  }
  poly([p(0, 0, WH), p(0, N, WH), p(0, N, WH + 10), p(0, 0, WH + 10)], "topo1");
  poly([p(0, 0, WH), p(N, 0, WH), p(N, 0, WH + 10), p(0, 0, WH + 10)], "topo2");
  poly([p(0, 0), p(0, N), p(0, N, 8), p(0, 0, 8)], "rodape1");
  poly([p(0, 0), p(N, 0), p(N, 0, 8), p(0, 0, 8)], "rodape2");
  /* sombra no canto, onde as paredes se encontram (duas faixas que vão clareando) */
  for (const [a, c] of [[0.9, "sombra-leve"], [0.4, "sombra-leve"]] as const) {
    poly([p(0, 0), p(0, a), p(0, a, WH), p(0, 0, WH)], c);
    poly([p(0, 0), p(a, 0), p(a, 0, WH), p(0, 0, WH)], c);
  }
  /* janela com o céu (parede da esquerda): moldura, travessas, peitoril e o sol que entra no chão */
  poly([p(0, 1.2, 70), p(0, 3.2, 70), p(0, 3.2, 150), p(0, 1.2, 150)], "janela", true);
  poly([p(0, 1.35, 78), p(0, 3.05, 78), p(0, 3.05, 142), p(0, 1.35, 142)], "ceu");
  poly([p(0, 1.35, 118), p(0, 3.05, 118), p(0, 3.05, 142), p(0, 1.35, 142)], "ceu-claro");
  poly([p(0, 2.2, 78), p(0, 2.25, 78), p(0, 2.25, 142), p(0, 2.2, 142)], "preto0");
  poly([p(0, 1.35, 108), p(0, 3.05, 108), p(0, 3.05, 111), p(0, 1.35, 111)], "preto0");
  box(0, 1.1, 0.22, 2.2, 4, "rodape2", "rodape1", "rodape1", 66);
  poly([p(1.3, 0, 80), p(3.3, 0, 80), p(3.3, 0, 160), p(1.3, 0, 160)], "poster", true);
  if (e.poster === "roxo") {
    /* o Barão: corpo roxo, olhos e chifres */
    poly([p(1.45, 0, 84), p(3.15, 0, 84), p(3.15, 0, 156), p(1.45, 0, 156)], "roxo0");
    poly([p(1.75, 0, 92), p(2.85, 0, 92), p(2.95, 0, 128), p(2.3, 0, 142), p(1.65, 0, 128)], "roxo1");
    poly([p(1.75, 0, 128), p(1.95, 0, 132), p(1.6, 0, 150)], "roxo1");
    poly([p(2.85, 0, 128), p(2.65, 0, 132), p(3.0, 0, 150)], "roxo1");
    poly([p(2.0, 0, 118), p(2.2, 0, 118), p(2.2, 0, 124), p(2.0, 0, 124)], "neon-ouro");
    poly([p(2.4, 0, 118), p(2.6, 0, 118), p(2.6, 0, 124), p(2.4, 0, 124)], "neon-ouro");
  } else if (e.poster === "sitio") {
    /* o portão do Sítio: céu, grama e o portão de madeira */
    poly([p(1.45, 0, 84), p(3.15, 0, 84), p(3.15, 0, 156), p(1.45, 0, 156)], "ceu");
    poly([p(1.45, 0, 84), p(3.15, 0, 84), p(3.15, 0, 106), p(1.45, 0, 106)], "planta0");
    for (let k = 0; k < 5; k++) poly([p(1.7 + k * 0.28, 0, 94), p(1.84 + k * 0.28, 0, 94), p(1.84 + k * 0.28, 0, 134), p(1.7 + k * 0.28, 0, 134)], "madeira1");
    poly([p(1.6, 0, 120), p(3.0, 0, 120), p(3.0, 0, 126), p(1.6, 0, 126)], "madeira0");
  } else
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        const i = 1.5 + a * 0.6, z = 92 + b * 22;
        poly([p(i, 0, z), p(i + 0.45, 0, z), p(i + 0.45, 0, z + 17), p(i, 0, z + 17)], (a + b) % 2 ? "cartela1" : "cartela0");
      }
  /* prateleira acima da mesa, com livros e um troféuzinho */
  box(3.25, 0, 2.2, 0.35, 4, "madeira0", "madeira1", "madeira2", 128);
  [["cartela1", 0.14, 22], ["pelucia0", 0.12, 18], ["tapete0", 0.16, 25], ["planta1", 0.12, 20]].forEach(([c, w, h], k) =>
    box(3.4 + k * 0.2, 0.05, w as number, 0.26, h as number, c as string, c as string, c as string, 132),
  );
  box(4.75, 0.08, 0.2, 0.2, 6, "ouro2", "ouro1", "ouro0", 132);
  box(4.8, 0.13, 0.1, 0.1, 10, "ouro1", "ouro1", "ouro0", 138);
  box(4.72, 0.05, 0.26, 0.26, 7, "ouro0", "ouro1", "ouro2", 148);
  /* piso em xadrez, o sol da janela e o tapete */
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) poly([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], (i + j) % 2 ? "piso0" : "piso1");
  poly([p(0, 1.35), p(0, 3.05), p(2.4, 2.75), p(2.4, 1.05)], "sol");
  const tap = e.tapete === "rift" || e.tapete === "pelucia" ? e.tapete : "tapete";
  poly([p(1.8, 2.4), p(4.8, 2.4), p(4.8, 5.4), p(1.8, 5.4)], tap + "0");
  poly([p(2.05, 2.65), p(4.55, 2.65), p(4.55, 5.15), p(2.05, 5.15)], tap + "1");
  if (tap === "rift") {
    /* as três rotas: a do meio na diagonal e as de cima e de baixo nas bordas */
    poly([p(2.05, 5.0), p(2.25, 5.15), p(4.55, 2.8), p(4.35, 2.65)], "rift2");
    poly([p(2.05, 2.65), p(2.25, 2.65), p(2.25, 5.15), p(2.05, 5.15)], "rift2");
    poly([p(2.05, 2.65), p(4.55, 2.65), p(4.55, 2.85), p(2.05, 2.85)], "rift2");
  }
  /* mesa da lan com o PC, teclado e gabinete (o PC gamer RGB tem dois monitores e o gabinete aceso) */
  const rgb = e.mesa === "rgb";
  box(3.0, 0.15, 2.7, 1.1, 44, rgb ? "preto0" : "madeira0", rgb ? "preto1" : "madeira1", rgb ? "preto2" : "madeira2");
  if (rgb) {
    box(3.0, 0.15, 2.7, 1.1, 2, "rgb1", "rgb2", "rgb3", 40);
    box(3.1, 0.25, 0.75, 0.12, 40, "preto0", "preto1", "preto2", 44);
    poly([p(3.15, 0.37, 52), p(3.8, 0.37, 52), p(3.8, 0.37, 80), p(3.15, 0.37, 80)], "rgb3");
  }
  box(3.9, 0.25, 1.2, 0.12, 46, "preto0", "preto1", "preto2", 44);
  poly([p(3.97, 0.37, 52), p(5.03, 0.37, 52), p(5.03, 0.37, 84), p(3.97, 0.37, 84)], "ceu");
  poly([p(4.1, 0.37, 60), p(4.5, 0.37, 60), p(4.5, 0.37, 66), p(4.1, 0.37, 66)], "tapete1");
  poly([p(4.1, 0.37, 70), p(4.9, 0.37, 70), p(4.9, 0.37, 74), p(4.1, 0.37, 74)], "luz");
  box(4.0, 0.65, 1.0, 0.3, 3, "teclado", "preto0", "preto0", 44);
  box(5.45, 0.3, 0.15, 0.5, 36, "teclado", "preto0", "preto1", 44);
  box(5.45, 0.3, 0.15, 0.5, 1, "luz", "luz", "luz", 62);
  if (rgb) ["rgb1", "rgb2", "rgb3"].forEach((c, k) => box(5.45, 0.3, 0.15, 0.5, 1, c, c, c, 50 + k * 8));
  /* cadeira: a padrão, a gamer (preta com faixa vermelha e encosto alto) ou o trono dourado */
  const cad = e.cadeira === "gamer" ? ["preto0", "preto1", "preto2"] : e.cadeira === "trono" ? ["ouro0", "ouro1", "ouro2"] : ["cadeira0", "cadeira1", "cadeira2"];
  const encosto = e.cadeira === "gamer" ? 84 : e.cadeira === "trono" ? 100 : 62;
  box(4.1, 1.55, 0.9, 0.9, 26, cad[0], cad[1], cad[2]);
  box(4.1, 1.55, 0.9, 0.18, encosto, cad[0], cad[1], cad[2], 26);
  if (e.cadeira === "gamer") box(4.4, 1.55, 0.3, 0.19, encosto - 10, "pelucia0", "pelucia0", "pelucia1", 31);
  if (e.cadeira === "trono") for (const di of [0, 0.35, 0.7]) box(4.1 + di, 1.55, 0.2, 0.18, 12, "ouro2", "ouro1", "ouro0", 26 + encosto);
  /* planta: a plantinha padrão, a samambaia (mais cheia) ou o cacto */
  box(0.4, 4.8, 0.6, 0.6, 24, "madeira0", "madeira1", "madeira2");
  if (e.planta === "cacto") {
    box(0.55, 4.95, 0.3, 0.3, 70, "cacto0", "cacto1", "cacto1", 24);
    box(0.35, 5.0, 0.2, 0.2, 26, "cacto0", "cacto1", "cacto1", 54);
    box(0.85, 5.0, 0.2, 0.2, 20, "cacto0", "cacto1", "cacto1", 66);
  } else {
    const folhas =
      e.planta === "verde"
        ? [[0.2, 0.2, 40], [0.45, 0.15, 50], [0.3, 0.45, 46], [0.1, 0.4, 34], [0.0, 0.0, 44], [0.6, 0.5, 40], [0.5, 0.0, 60], [0.0, 0.6, 52], [0.3, 0.3, 66]]
        : [[0.2, 0.2, 40], [0.45, 0.15, 50], [0.3, 0.45, 46], [0.1, 0.4, 34]];
    for (const [di, dj, dz] of folhas) box(0.4 + di - 0.12, 4.8 + dj - 0.12, 0.3, 0.3, 14, "planta0", "planta1", "planta2", 24 + dz - 30);
  }
  return L;
}
/* um desenho por combinação de itens (são poucas) */
const CACHE = new Map<string, Poly[]>();
export function quartoCom(e: EquipQuarto) {
  const chave = JSON.stringify(e);
  let d = CACHE.get(chave);
  if (!d) CACHE.set(chave, (d = desenhar(e)));
  return d;
}
const SEM_ITENS: EquipQuarto = {};
const [PE_X, PE_Y] = p(3.3, 3.9);
/* o boneco aparece com o dobro do tamanho da folha */
const ESCALA = 2;

/**
 * O quarto com o nanico. `boneco` é a spritesheet do hall (quadro "parado" de frente);
 * sem ela, usa a arte de corpo inteiro (`arte`).
 */
export const Quarto = memo(function Quarto({
  nome,
  boneco,
  arte,
  equip = SEM_ITENS,
}: {
  nome: string;
  boneco: string | null;
  arte: { src: string; w: number; h: number } | null;
  equip?: EquipQuarto;
}) {
  const formas = quartoCom(equip);
  const altura = boneco ? CEL_H * ESCALA : 270;
  const topo = PE_Y - (boneco ? ANCORA.y * ESCALA : altura - 6);
  const placa = Math.max(68, nome.length * 9 + 22);
  return (
    <svg className="quarto" viewBox="20 20 580 570" role="img" aria-label={`${nome} no quarto`}>
      <Poligonos lista={formas} />
      <ellipse cx={PE_X} cy={PE_Y - 4} rx={58} ry={18} className="q-sombra" />
      {boneco ? (
        <svg x={PE_X - ANCORA.x * ESCALA} y={topo} width={CEL_W * ESCALA} height={CEL_H * ESCALA} viewBox={`0 0 ${CEL_W} ${CEL_H}`}>
          <image href={boneco} width={CEL_W * 5} height={CEL_H * 2} />
        </svg>
      ) : arte ? (
        <image href={arte.src} x={PE_X - (altura * arte.w) / arte.h / 2} y={topo} width={(altura * arte.w) / arte.h} height={altura} />
      ) : null}
      <rect x={PE_X - placa / 2} y={topo - 26} width={placa} height={20} rx={4} className="q-placa" />
      <text x={PE_X} y={topo - 12} textAnchor="middle" className="q-nome">
        {nome.toUpperCase()}
      </text>
    </svg>
  );
});

function Poligonos({ lista }: { lista: Poly[] }) {
  return (
    <>
      {lista.map((d, k) => (
        <polygon key={k} points={d.q.map((v) => v.join(",")).join(" ")} className={`q-${d.c}` + (d.linha ? " q-linha" : "")} />
      ))}
    </>
  );
}

/** Recorte do quarto vazio (sem boneco) com um item, para a prévia da loja. */
const RECORTE = { parede: "20 60 580 435", chao: "120 370 320 240", mesa: "330 225 300 225", poster: "305 112 220 165", cadeira: "275 250 307 230", planta: "2 280 227 170" } as const;
export const QuartoPrevia = memo(function QuartoPrevia({ equip, foco }: { equip: EquipQuarto; foco: keyof typeof RECORTE }) {
  return (
    <svg className="quarto quarto-previa" viewBox={RECORTE[foco]} aria-hidden="true">
      <Poligonos lista={quartoCom(equip)} />
    </svg>
  );
});
