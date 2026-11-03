"use client";
/*
 * O quarto próprio desenhado em qualquer tamanho (6, 9 ou 12): piso em xadrez, as duas paredes com a tinta, o neon e o
 * pôster equipados (como no quarto fixo da ficha), a porta no piso (0, 0) e os móveis na ordem certa (camadasQuarto).
 * Serve para a ficha, para a tela de arrumar e, na fase 35, para as visitas. Com `aoTocarPiso`, cada piso vira um alvo.
 */
import { memo, useMemo } from "react";
import { ANCORA, caixaDoBoneco, CEL_H, CEL_W, ordemZ, quadroSprite, type Caixa, type Sentido } from "@/features/hall/hall";
import { desenharMovel, Poligonos, type Poly, type Pt } from "./Moveis";
import { camadasQuarto, type Retangulo } from "./quarto";

const TW = 46, TH = 23, ZS = 1.3, WH = 150, MARGEM = 24;

export type MovelCena = { id: number; desenho: string; ret: Retangulo; giro: boolean };
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
};

/** A projeção de um quarto de lado n: a origem fica no canto de cima, com folga para as paredes. */
export function projecao(n: number) {
  const X0 = n * TW + MARGEM, Y0 = WH * ZS + MARGEM + 10;
  const p = (i: number, j: number, z = 0): Pt => [X0 + (i - j) * TW, Y0 + (i + j) * TH - z * ZS];
  return { p, largura: 2 * n * TW + 2 * MARGEM, altura: Y0 + 2 * n * TH + MARGEM };
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
}) {
  const n = tamanho;
  const { p, largura, altura } = useMemo(() => projecao(n), [n]);
  const fundo = useMemo(() => paredes(n, p, equip), [n, p, equip]);
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
  return (
    <svg className="quarto quarto-cena" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={nome ? `Quarto de ${nome}` : "Quarto"}>
      <Poligonos lista={fundo} />
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
            className={"quarto-movel" + (selecionado === m.id ? " sel" : "") + (aoTocarMovel ? " tocavel" : "")}
            onClick={aoTocarMovel ? () => aoTocarMovel(m.id) : undefined}
          >
            <Poligonos lista={desenharMovel(p, m.desenho, m.ret, m.giro)} />
          </g>
        );
      })}
      {brilhos?.map((b) => {
        const [x, y] = p(b.i + 0.5, b.j + 0.5);
        return <circle key={b.id} className="quarto-brilho" cx={x} cy={y - 50} r={46} pointerEvents="none" />;
      })}
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
  const [x, y0] = b.sentado ? p(b.sentado.i, b.sentado.j) : p(b.i + 0.5, b.j + 0.5);
  /* sentado, o quadril desce para o estofado (como o .boneco.sentado do hall) */
  const y = y0 + (b.sentado ? CEL_H * ESCALA_VISITA * 0.19 : 0);
  const q = quadroSprite(b.sentido, b.sentado ? 0 : b.quadro);
  const w = CEL_W * ESCALA_VISITA, h = CEL_H * ESCALA_VISITA;
  const vx = -q.x, vy = -q.y;
  return (
    <g className={"quarto-boneco" + (b.eu ? " eu" : "")} pointerEvents="none">
      {b.folha ? (
        <svg x={x - ANCORA.x * ESCALA_VISITA} y={y - ANCORA.y * ESCALA_VISITA} width={w} height={h} viewBox={`${vx} ${vy} ${CEL_W} ${CEL_H}`}>
          <g transform={q.espelha ? `translate(${2 * vx + CEL_W} 0) scale(-1 1)` : undefined}>
            <image href={b.folha} width={CEL_W * 5} height={CEL_H * 2} />
          </g>
        </svg>
      ) : (
        <circle className="quarto-pino" cx={x} cy={y - 40} r={16} />
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
