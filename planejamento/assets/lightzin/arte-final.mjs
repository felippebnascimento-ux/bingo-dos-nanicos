// Gera rosto (160×160) e corpo (440 px de altura) do Lightzin em webp transparente, como os de public/arte/nanicos/.
// Rodar da raiz: node planejamento/assets/lightzin/arte-final.mjs
import sharp from "sharp";
const P = "planejamento/assets/lightzin/";
const { data, info } = await sharp(P + "15-corpo.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, vis = new Uint8Array(W * H), pilha = [];
const branco = (p) => data[p * 4] > 235 && data[p * 4 + 1] > 235 && data[p * 4 + 2] > 235;
for (let x = 0; x < W; x++) pilha.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) pilha.push(y * W, y * W + W - 1);
while (pilha.length) {
  const p = pilha.pop();
  if (vis[p] || !branco(p)) continue;
  vis[p] = 1; data[p * 4 + 3] = 0;
  const x = p % W, y = (p / W) | 0;
  if (x > 0) pilha.push(p - 1); if (x < W - 1) pilha.push(p + 1);
  if (y > 0) pilha.push(p - W); if (y < H - 1) pilha.push(p + W);
}
const cru = { raw: { width: W, height: H, channels: 4 } };
const corpo = await sharp(data, cru).trim().resize({ height: 440 }).webp({ quality: 90, alphaQuality: 100 }).toBuffer({ resolveWithObject: true });
await sharp(corpo.data).toFile(P + "lightzin-corpo.webp");
await sharp(data, cru).extract({ left: 214, top: 0, width: 260, height: 260 }).resize(160, 160).webp({ quality: 90, alphaQuality: 100 }).toFile(P + "lightzin-rosto.webp");
console.log("corpo", corpo.info.width + "x" + corpo.info.height);
