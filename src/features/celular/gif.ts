/*
 * GIF animado pequeno, feito no navegador (o boomerang da câmera do InstaNanico, seção 69). Sem biblioteca: paleta
 * fixa de 6×7×6 cores (252) com pontilhado leve, compressão LZW e repetição infinita. Puro e testado em gif.test.ts.
 */

/** A cor da paleta mais perto de (r, g, b): 6 níveis de vermelho, 7 de verde e 6 de azul. */
export function indiceDaCor(r: number, g: number, b: number) {
  const ri = Math.min(5, Math.round((r / 255) * 5)), gi = Math.min(6, Math.round((g / 255) * 6)), bi = Math.min(5, Math.round((b / 255) * 5));
  return ri * 42 + gi * 6 + bi;
}
/** A paleta (256 entradas RGB; as 4 últimas ficam pretas). */
export function paleta(): Uint8Array {
  const p = new Uint8Array(256 * 3);
  for (let r = 0; r < 6; r++)
    for (let g = 0; g < 7; g++)
      for (let b = 0; b < 6; b++) {
        const i = (r * 42 + g * 6 + b) * 3;
        p[i] = Math.round((r * 255) / 5);
        p[i + 1] = Math.round((g * 255) / 6);
        p[i + 2] = Math.round((b * 255) / 5);
      }
  return p;
}

/* pontilhado ordenado 4×4 (espalha o degrau entre as cores, sem deixar faixas) */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Os pixels RGBA de um quadro viram índices da paleta. */
export function indexar(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, d = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 40;
      out[y * w + x] = indiceDaCor(rgba[i] + d, rgba[i + 1] + d, rgba[i + 2] + d);
    }
  return out;
}

/** Compressão LZW do GIF (tamanho mínimo de código 8). Devolve os bytes, já em blocos de até 255. */
export function lzw(indices: Uint8Array): number[] {
  const MIN = 8, CLEAR = 1 << MIN, FIM = CLEAR + 1;
  const saida: number[] = [];
  let acc = 0, nbits = 0, tam = MIN + 1;
  const escreve = (cod: number) => {
    acc |= cod << nbits;
    nbits += tam;
    while (nbits >= 8) {
      saida.push(acc & 255);
      acc >>>= 8;
      nbits -= 8;
    }
  };
  let dic = new Map<number, number>();
  let prox = FIM + 1;
  escreve(CLEAR);
  let w = indices[0] ?? 0;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], chave = w * 4096 + k;
    const tem = dic.get(chave);
    if (tem !== undefined) {
      w = tem;
      continue;
    }
    escreve(w);
    if (prox < 4096) {
      dic.set(chave, prox++);
      if (prox > 1 << tam && tam < 12) tam++;
    } else {
      escreve(CLEAR);
      dic = new Map();
      prox = FIM + 1;
      tam = MIN + 1;
    }
    w = k;
  }
  escreve(w);
  escreve(FIM);
  if (nbits > 0) saida.push(acc & 255);
  const blocos: number[] = [];
  for (let i = 0; i < saida.length; i += 255) {
    const parte = saida.slice(i, i + 255);
    blocos.push(parte.length, ...parte);
  }
  blocos.push(0);
  return blocos;
}

/** Monta o GIF: quadros já indexados (w × h), `atraso` em centésimos de segundo, repetindo para sempre. */
export function montarGif(quadros: Uint8Array[], w: number, h: number, atraso = 7): Uint8Array {
  const b: number[] = [];
  const u16 = (v: number) => b.push(v & 255, (v >> 8) & 255);
  b.push(...[..."GIF89a"].map((c) => c.charCodeAt(0)));
  u16(w);
  u16(h);
  b.push(0xf7, 0, 0); /* paleta global de 256 cores */
  b.push(...paleta());
  b.push(0x21, 0xff, 11, ...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0); /* repete sempre */
  for (const q of quadros) {
    b.push(0x21, 0xf9, 4, 0x04, atraso & 255, (atraso >> 8) & 255, 0, 0);
    b.push(0x2c);
    u16(0);
    u16(0);
    u16(w);
    u16(h);
    b.push(0, 8);
    b.push(...lzw(q));
  }
  b.push(0x3b);
  return Uint8Array.from(b);
}
