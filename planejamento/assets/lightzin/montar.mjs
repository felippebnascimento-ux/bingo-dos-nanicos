// Monta a folha do boneco do Lightzin igual às de public/arte/bonecos/ (5×2 células de 252×402, chão em y=396).
// Faz em Node o que o recortar.py faz (o notebook não tem Python): tira o fundo cinza, separa as poses e alinha.
// Rodar da raiz do repositório: node planejamento/assets/lightzin/montar.mjs
import sharp from "sharp";
import path from "node:path";

const PASTA = "planejamento/assets/lightzin";
const CW = 252, CH = 402, CHAO = 396, CENTRO = 126, ALTURA = 376;

// Tira o fundo cinza por preenchimento a partir das bordas (mesma regra do recortar.py).
async function semFundo(arq) {
  const { data, info } = await sharp(path.join(PASTA, arq)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const ref = [data[(2 * W + 2) * 4], data[(2 * W + 2) * 4 + 1], data[(2 * W + 2) * 4 + 2]];
  const fundo = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.abs(r - ref[0]) + Math.abs(g - ref[1]) + Math.abs(b - ref[2]) < 40 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
  };
  const vis = new Uint8Array(W * H);
  const pilha = [];
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
  return { data, W, H };
}

// Separa as figuras pelas colunas com algum pixel (ignora sujeira estreita).
function poses({ data, W, H }) {
  const cheia = [];
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = 0; y < H; y++) if (data[(y * W + x) * 4 + 3] > 20) n++;
    cheia.push(n > 2);
  }
  const out = [];
  for (let x = 0; x < W; ) {
    if (!cheia[x]) { x++; continue; }
    const s = x;
    while (x < W && cheia[x]) x++;
    if (x - s > 30) out.push(caixa(data, W, H, s, x));
  }
  return out;
}

function caixa(data, W, H, x0, x1) {
  let y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++)
    if (data[(y * W + x) * 4 + 3] > 20) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
  // centro da cabeça: média das colunas com pixel nos 20% de cima
  let soma = 0, n = 0;
  const yc = y0 + (y1 - y0) * 0.2;
  for (let y = y0; y < yc; y++) for (let x = x0; x < x1; x++)
    if (data[(y * W + x) * 4 + 3] > 20) { soma += x; n++; }
  return { x0, x1, y0, y1: y1 + 1, cab: soma / n };
}

async function recorte(img, c, escala) {
  const w = c.x1 - c.x0, h = c.y1 - c.y0;
  const buf = await sharp(img.data, { raw: { width: img.W, height: img.H, channels: 4 } })
    .extract({ left: c.x0, top: c.y0, width: w, height: h })
    .resize(Math.round(w * escala), Math.round(h * escala), { kernel: "lanczos3" })
    .png().toBuffer();
  const nw = Math.round(w * escala), nh = Math.round(h * escala);
  return { buf, left: Math.round(CENTRO - (c.cab - c.x0) * escala), top: CHAO - nh, nw, nh };
}

const parado = await semFundo("poses-b.png");
const pp = poses(parado);
const frente = await semFundo("andar-frente.png");
const costas = await semFundo("andar-costas.png");
const pf = poses(frente), pc = poses(costas);
console.log("poses:", pp.length, "frente:", pf.length, "costas:", pc.length);

const altura = (c) => c.y1 - c.y0;
const escParado = ALTURA / Math.max(altura(pp[0]), altura(pp[2]));
// o andar tem o mesmo tamanho do parado: a maior figura de cada imagem fica com a altura do parado
const escFrente = (altura(pp[0]) * escParado) / Math.max(...pf.map(altura));
const escCostas = (altura(pp[2]) * escParado) / Math.max(...pc.map(altura));

const camadas = [];
const linhas = [
  [[parado, pp[0], escParado], ...pf.slice(0, 4).map((c) => [frente, c, escFrente])],
  [[parado, pp[2], escParado], ...pc.slice(0, 4).map((c) => [costas, c, escCostas])],
];
const quadros = [];
for (let r = 0; r < 2; r++) for (let col = 0; col < 5; col++) {
  const [img, c, e] = linhas[r][col];
  const q = await recorte(img, c, e);
  // não deixa sair da célula
  const left = Math.max(0, Math.min(CW - q.nw, q.left)), top = Math.max(0, q.top);
  camadas.push({ input: q.buf, left: col * CW + left, top: r * CH + top });
  quadros.push({ input: q.buf, left, top });
}
const vazio = { width: CW * 5, height: CH * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
await sharp({ create: vazio }).composite(camadas).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(PASTA, "lightzin.webp"));
await sharp({ create: vazio }).composite(camadas).png().toFile(path.join(PASTA, "lightzin-folha.png"));

// Andar em gif (frente e costas), no fundo claro do hall
const fundo = { r: 240, g: 236, b: 228, alpha: 1 };
for (const [nome, ini] of [["frente", 1], ["costas", 6]]) {
  const fr = [];
  for (let k = 0; k < 4; k++) {
    const q = quadros[ini + k];
    fr.push(await sharp({ create: { width: CW, height: CH, channels: 4, background: fundo } })
      .composite([{ input: q.input, left: q.left, top: q.top }]).png().toBuffer());
  }
  await sharp(fr, { join: { animated: true } }).gif({ delay: 150, loop: 0 }).toFile(path.join(PASTA, `lightzin-andando-${nome}.gif`));
}

// Vitrine: o parado do Lightzin entre dois bonecos atuais, na mesma escala
const outros = ["gamer", "john"];
const vitr = [];
for (const [i, nome] of [outros[0], "lightzin", outros[1]].entries()) {
  const src = nome === "lightzin" ? path.join(PASTA, "lightzin.webp") : `public/arte/bonecos/${nome}.webp`;
  const cel = await sharp(src).extract({ left: 0, top: 0, width: CW, height: CH }).png().toBuffer();
  const cos = await sharp(src).extract({ left: 0, top: CH, width: CW, height: CH }).png().toBuffer();
  vitr.push({ input: cel, left: i * CW * 2, top: 0 }, { input: cos, left: i * CW * 2 + CW, top: 0 });
}
await sharp({ create: { width: CW * 6, height: CH, channels: 4, background: fundo } })
  .composite(vitr).png().toFile(path.join(PASTA, "comparacao.png"));
console.log("ok");
