/*
 * Quarto isométrico da ficha, com o boneco do nanico em pé no tapete.
 * Geometria copiada de planejamento/demo/ficha-demo.html (`p()`, `poly()`, `box()`).
 * As cores são classes `q-<nome>`, definidas como variáveis em 24-ficha.css (com tema escuro).
 */
import { memo } from "react";
import { ANCORA, CEL_H, CEL_W } from "@/features/hall/hall";

type Pt = [number, number];
type Poly = { q: Pt[]; c: string; linha?: boolean };

const X0 = 310, Y0 = 300, TW = 46, TH = 23, ZS = 1.3, N = 6, WH = 185;
const p = (i: number, j: number, z = 0): Pt => [X0 + (i - j) * TW, Y0 + (i + j) * TH - z * ZS];

function desenhar(): Poly[] {
  const L: Poly[] = [];
  const poly = (q: Pt[], c: string, linha = false) => L.push({ q, c, linha });
  /* caixa isométrica: canto (i, j), w em i, d em j, altura h, base z */
  const box = (i: number, j: number, w: number, d: number, h: number, topo: string, esq: string, dir: string, z = 0) => {
    poly([p(i, j + d, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i, j + d, z + h)], esq, true);
    poly([p(i + w, j, z), p(i + w, j + d, z), p(i + w, j + d, z + h), p(i + w, j, z + h)], dir, true);
    poly([p(i, j, z + h), p(i + w, j, z + h), p(i + w, j + d, z + h), p(i, j + d, z + h)], topo, true);
  };
  /* paredes, beiral e rodapé */
  poly([p(0, 0), p(0, N), p(0, N, WH), p(0, 0, WH)], "parede1");
  poly([p(0, 0), p(N, 0), p(N, 0, WH), p(0, 0, WH)], "parede2");
  poly([p(0, 0, WH), p(0, N, WH), p(0, N, WH + 10), p(0, 0, WH + 10)], "topo1");
  poly([p(0, 0, WH), p(N, 0, WH), p(N, 0, WH + 10), p(0, 0, WH + 10)], "topo2");
  poly([p(0, 0), p(0, N), p(0, N, 8), p(0, 0, 8)], "rodape1");
  poly([p(0, 0), p(N, 0), p(N, 0, 8), p(0, 0, 8)], "rodape2");
  /* janela com o céu (parede da esquerda) e o pôster da cartela (parede da direita) */
  poly([p(0, 1.2, 70), p(0, 3.2, 70), p(0, 3.2, 150), p(0, 1.2, 150)], "janela", true);
  poly([p(0, 1.35, 78), p(0, 3.05, 78), p(0, 3.05, 142), p(0, 1.35, 142)], "ceu");
  poly([p(0, 2.2, 78), p(0, 2.25, 78), p(0, 2.25, 142), p(0, 2.2, 142)], "preto0");
  poly([p(1.3, 0, 80), p(3.3, 0, 80), p(3.3, 0, 160), p(1.3, 0, 160)], "poster", true);
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++) {
      const i = 1.5 + a * 0.6, z = 92 + b * 22;
      poly([p(i, 0, z), p(i + 0.45, 0, z), p(i + 0.45, 0, z + 17), p(i, 0, z + 17)], (a + b) % 2 ? "cartela1" : "cartela0");
    }
  /* piso em xadrez e o tapete */
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) poly([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], (i + j) % 2 ? "piso0" : "piso1");
  poly([p(1.8, 2.4), p(4.8, 2.4), p(4.8, 5.4), p(1.8, 5.4)], "tapete0");
  poly([p(2.05, 2.65), p(4.55, 2.65), p(4.55, 5.15), p(2.05, 5.15)], "tapete1");
  /* mesa da lan com o PC, teclado e gabinete */
  box(3.0, 0.15, 2.7, 1.1, 44, "madeira0", "madeira1", "madeira2");
  box(3.9, 0.25, 1.2, 0.12, 46, "preto0", "preto1", "preto2", 44);
  poly([p(3.97, 0.37, 52), p(5.03, 0.37, 52), p(5.03, 0.37, 84), p(3.97, 0.37, 84)], "ceu");
  poly([p(4.1, 0.37, 60), p(4.5, 0.37, 60), p(4.5, 0.37, 66), p(4.1, 0.37, 66)], "tapete1");
  poly([p(4.1, 0.37, 70), p(4.9, 0.37, 70), p(4.9, 0.37, 74), p(4.1, 0.37, 74)], "luz");
  box(4.0, 0.65, 1.0, 0.3, 3, "teclado", "preto0", "preto0", 44);
  box(5.45, 0.3, 0.15, 0.5, 36, "teclado", "preto0", "preto1", 44);
  box(5.45, 0.3, 0.15, 0.5, 1, "luz", "luz", "luz", 62);
  /* cadeira e plantinha */
  box(4.1, 1.55, 0.9, 0.9, 26, "cadeira0", "cadeira1", "cadeira2");
  box(4.1, 1.55, 0.9, 0.18, 62, "cadeira0", "cadeira1", "cadeira2", 26);
  box(0.4, 4.8, 0.6, 0.6, 24, "madeira0", "madeira1", "madeira2");
  for (const [di, dj, dz] of [[0.2, 0.2, 40], [0.45, 0.15, 50], [0.3, 0.45, 46], [0.1, 0.4, 34]])
    box(0.4 + di - 0.12, 4.8 + dj - 0.12, 0.3, 0.3, 14, "planta0", "planta1", "planta2", 24 + dz - 30);
  return L;
}
const QUARTO = desenhar();
const [PE_X, PE_Y] = p(3.3, 3.9);
/* o boneco aparece com o dobro do tamanho da folha */
const ESCALA = 2;

/**
 * O quarto com o nanico. `boneco` é a spritesheet do hall (quadro "parado" de frente);
 * sem ela, usa a arte de corpo inteiro (`arte`).
 */
export const Quarto = memo(function Quarto({ nome, boneco, arte }: { nome: string; boneco: string | null; arte: { src: string; w: number; h: number } | null }) {
  const altura = boneco ? CEL_H * ESCALA : 270;
  const topo = PE_Y - (boneco ? ANCORA.y * ESCALA : altura - 6);
  const placa = Math.max(68, nome.length * 9 + 22);
  return (
    <svg className="quarto" viewBox="20 20 580 570" role="img" aria-label={`${nome} no quarto`}>
      {QUARTO.map((d, k) => (
        <polygon key={k} points={d.q.map((v) => v.join(",")).join(" ")} className={`q-${d.c}` + (d.linha ? " q-linha" : "")} />
      ))}
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
