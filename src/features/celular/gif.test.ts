import { describe, expect, it } from "vitest";
import { indexar, indiceDaCor, lzw, montarGif, paleta } from "./gif";

/* um leitor de LZW do GIF como os navegadores fazem (para conferir que o que sai volta igual) */
function deslzw(blocos: number[], min = 8): number[] {
  const bytes: number[] = [];
  for (let i = 0; blocos[i]; i += blocos[i] + 1) bytes.push(...blocos.slice(i + 1, i + 1 + blocos[i]));
  const CLEAR = 1 << min, FIM = CLEAR + 1;
  let tam = min + 1, pos = 0;
  const ler = () => {
    let v = 0;
    for (let k = 0; k < tam; k++, pos++) v |= ((bytes[pos >> 3] >> (pos & 7)) & 1) << k;
    return v;
  };
  let dic: number[][] = [];
  const zera = () => {
    dic = Array.from({ length: CLEAR + 2 }, (_, i) => [i]);
    tam = min + 1;
  };
  zera();
  const out: number[] = [];
  let ant: number[] | null = null;
  for (;;) {
    const c = ler();
    if (c === CLEAR) {
      zera();
      ant = null;
      continue;
    }
    if (c === FIM) break;
    let e: number[];
    if (c < dic.length) e = dic[c];
    else if (ant) e = [...ant, ant[0]];
    else throw new Error("código ruim");
    out.push(...e);
    if (ant) dic.push([...ant, e[0]]);
    if (dic.length >= 1 << tam && tam < 12) tam++;
    ant = e;
  }
  return out;
}

describe("GIF do boomerang", () => {
  it("acha a cor da paleta", () => {
    expect(indiceDaCor(0, 0, 0)).toBe(0);
    expect(indiceDaCor(255, 255, 255)).toBe(5 * 42 + 6 * 6 + 5);
    const p = paleta();
    const i = indiceDaCor(255, 0, 0) * 3;
    expect([p[i], p[i + 1], p[i + 2]]).toEqual([255, 0, 0]);
  });

  it("a compressão volta igual (pequeno, repetido e grande o bastante para trocar o dicionário)", () => {
    const casos = [
      Uint8Array.from([1, 1, 1, 1, 2, 2, 3]),
      Uint8Array.from({ length: 3000 }, (_, i) => (i * 7) % 5),
      Uint8Array.from({ length: 60000 }, (_, i) => (i * 2654435761) % 251),
    ];
    for (const c of casos) expect(deslzw(lzw(c))).toEqual([...c]);
  });

  it("monta um GIF de verdade (cabeçalho, quadros e fim)", () => {
    const w = 8, h = 4;
    const rgba = new Uint8ClampedArray(w * h * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256));
    const q = indexar(rgba, w, h);
    const g = montarGif([q, q], w, h);
    expect(String.fromCharCode(...g.slice(0, 6))).toBe("GIF89a");
    expect(g[6] | (g[7] << 8)).toBe(8);
    expect(g[g.length - 1]).toBe(0x3b);
    expect([...g].filter((x, i) => x === 0x2c && g[i - 8] === 0x21).length).toBeGreaterThanOrEqual(2);
  });
});
