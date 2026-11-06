// Monta as folhas do Romildo no formato dos bonecos novos (05/11/2026): andar 5×2 de 252×402 e poses 4×4 de 336×402,
// o pé em y = 396 e a cabeça no meio da célula, na mesma altura dos outros (o parado de frente com 375 px).
// As imagens vêm da ferramenta de imagem com fundo cinza liso: o fundo sai a partir das bordas e cada figura é achada
// pelas faixas vazias (linhas e depois colunas). Rodar da raiz: node planejamento/assets/romildo/montar.mjs
import sharp from "sharp";
import path from "node:path";

const P = "planejamento/assets/romildo";
const ANDAR = { w: 252, h: 402, chao: 396 };
const POSE = { w: 336, h: 402, chao: 396 };
const ALTURA = 375;

/* tira o fundo cinza liso por preenchimento a partir das bordas, sem atravessar o contorno escuro */
async function semFundo(arq) {
  const { data, info } = await sharp(path.join(P, arq)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const ref = [data[(4 * W + 4) * 4], data[(4 * W + 4) * 4 + 1], data[(4 * W + 4) * 4 + 2]];
  const fundo = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.abs(r - ref[0]) + Math.abs(g - ref[1]) + Math.abs(b - ref[2]) < 48 && Math.max(r, g, b) - Math.min(r, g, b) < 24;
  };
  const vis = new Uint8Array(W * H), pilha = [];
  for (let x = 0; x < W; x++) pilha.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) pilha.push(y * W, y * W + W - 1);
  while (pilha.length) {
    const p = pilha.pop();
    if (vis[p] || !fundo(p * 4)) continue;
    vis[p] = 1;
    data[p * 4 + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) pilha.push(p - 1);
    if (x < W - 1) pilha.push(p + 1);
    if (y > 0) pilha.push(p - W);
    if (y < H - 1) pilha.push(p + W);
  }
  /* a franja clara que sobra em volta do contorno vira meio transparente */
  for (let p = 0; p < W * H; p++) {
    if (!data[p * 4 + 3]) continue;
    const x = p % W, y = (p / W) | 0;
    const viz = [p - 1, p + 1, p - W, p + W].some((q) => q >= 0 && q < W * H && Math.abs((q % W) - x) <= 1 && Math.abs(((q / W) | 0) - y) <= 1 && vis[q]);
    if (viz && fundo(p * 4)) data[p * 4 + 3] = 0;
  }
  return { data, W, H };
}

const cheio = (img, x, y) => img.data[(y * img.W + x) * 4 + 3] > 20;
function faixas(n, temAlgo, minimo) {
  const out = [];
  for (let a = 0; a < n; ) {
    if (!temAlgo(a)) { a++; continue; }
    const s = a;
    while (a < n && temAlgo(a)) a++;
    if (a - s > minimo) out.push([s, a]);
  }
  return out;
}
/* as figuras de uma imagem, linha por linha (faixas sem pixel separam as linhas e, dentro delas, as colunas) */
function figuras(img) {
  const linhas = faixas(img.H, (y) => { let n = 0; for (let x = 0; x < img.W; x++) if (cheio(img, x, y)) n++; return n > 2; }, 40);
  return linhas.map(([y0, y1]) =>
    faixas(img.W, (x) => { let n = 0; for (let y = y0; y < y1; y++) if (cheio(img, x, y)) n++; return n > 2; }, 30).map(([x0, x1]) => {
      let a = y1, b = y0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (cheio(img, x, y)) { if (y < a) a = y; if (y > b) b = y; }
      /* o centro da cabeça: a média das colunas com pixel nos 20% de cima */
      let soma = 0, n = 0;
      for (let y = a; y < a + (b - a) * 0.2; y++) for (let x = x0; x < x1; x++) if (cheio(img, x, y)) { soma += x; n++; }
      return { x0, x1, y0: a, y1: b + 1, cab: soma / n };
    }),
  );
}

async function quadro(img, c, escala, cel) {
  const w = c.x1 - c.x0, h = c.y1 - c.y0;
  const s = Math.min(escala, (cel.w - 4) / w, (cel.chao - 2) / h);
  const nw = Math.round(w * s), nh = Math.round(h * s);
  const input = await sharp(img.data, { raw: { width: img.W, height: img.H, channels: 4 } })
    .extract({ left: c.x0, top: c.y0, width: w, height: h }).resize(nw, nh, { kernel: "lanczos3" }).png().toBuffer();
  const left = Math.max(0, Math.min(cel.w - nw, Math.round(cel.w / 2 - (c.cab - c.x0) * s)));
  return { input, left, top: cel.chao - nh };
}

async function folha(img, grade, escala, cel, saida) {
  const camadas = [];
  for (const [l, linha] of grade.entries())
    for (const [col, c] of linha.entries()) {
      const q = await quadro(img, c, escala, cel);
      camadas.push({ input: q.input, left: col * cel.w + q.left, top: l * cel.h + q.top });
    }
  const vazio = { width: grade[0].length * cel.w, height: grade.length * cel.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  await sharp({ create: vazio }).composite(camadas).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(saida);
  await sharp({ create: vazio }).composite(camadas).flatten({ background: "#e8e2d6" }).png().toFile(saida.replace(/\.webp$/, "-previa.png"));
}

const andar = await semFundo("andar.png");
const fa = figuras(andar);
console.log("andar:", fa.map((l) => l.length));
const escala = ALTURA / (fa[0][0].y1 - fa[0][0].y0);
await folha(andar, [fa[0].slice(0, 5), fa[1].slice(0, 5)], escala, ANDAR, path.join(P, "romildo.webp"));

const poses = await semFundo("poses.png");
const fp = figuras(poses);
console.log("poses:", fp.map((l) => l.length));
/* a mesma escala do andar: o parado das poses (linha 1, coluna 3) fica com a altura do parado do andar */
const escPoses = ALTURA / (fp[0][2].y1 - fp[0][2].y0);
await folha(poses, fp.map((l) => l.slice(0, 4)), escPoses, POSE, path.join(P, "romildo-poses.webp"));
console.log("ok");
