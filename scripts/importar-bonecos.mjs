/*
 * Gera public/arte/bonecos a partir dos atlas do pacote Nanico Hotel, no formato de sempre: a folha do andar (bonecos.json) e a folha
 * de poses (hall/poses.ts). O site não muda: só as imagens. Uso: node scripts/importar-bonecos.mjs <pasta com abreutz/, alemao/ ...>
 * Cada subpasta tem atlas.png e avatar.json. Sem o `heightScale`: os pacotes já vêm na altura de cada um (o Pin é menor).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const origem = process.argv[2];
if (!origem) throw new Error("Passe a pasta dos atlas.");
const destino = "public/arte/bonecos";
/* a altura do John (208 px na célula do pacote) passa a ser a altura que a folha sempre teve (374 px) */
const ESCALA = 374 / 208;
const NOMES = { abreutz: "abreutz", alemao: "alemao", dd: "dd", gamer: "gamer", gordao: "gordao", grito: "grito", guiperino: "guiperino", henry: "henry", john: "john", lebubu: "le-bubu", lightzin: "lightzin", max: "max", pin: "pin", pitoco: "pitoco", veiao: "veiao" };

const ANDAR = { w: 252, h: 402, pe: [126, 396] };
const POSE = { w: 336, h: 402, pe: [168, 396] };
/* linhas de quadros do pacote pelo nome. O pacote desenha olhando para a esquerda e a folha olha para a direita: tudo espelha. */
const GRADE_ANDAR = [
  ["idle-sw", "walk-sw-a", "idle-sw", "walk-sw-b", "idle-sw"],
  ["idle-nw", "walk-nw-a", "idle-nw", "walk-nw-b", "idle-nw"],
];
const GRADE_POSES = [
  ["sit-sw", "wave", "idle-sw", "lie"],
  ["dance-a", "dance-b", "dance-a", "dance-a"],
  ["laugh", "cheer", "cheer", "sit-sw"],
  ["sit-nw", "back-wave", "back-dance-a", "back-dance-b"],
];

async function folha(atlas, quadros, grade, cel) {
  const celulas = [];
  for (const [l, linha] of grade.entries())
    for (const [c, id] of linha.entries()) {
      const q = quadros.get(id);
      if (!q) throw new Error("Falta o quadro " + id);
      const [rx, ry] = q.rect;
      const [bx, by, bw, bh] = q.bounds;
      /* quem não cabe na célula (o deitado) encolhe para caber */
      const s = Math.min(ESCALA, (cel.w - 4) / bw);
      const w = Math.round(bw * s), h = Math.round(bh * s);
      const espelhadoX = q.rect[2] - (bx + bw);
      const ox = q.rect[2] - q.origin[0];
      const left = Math.max(0, Math.min(cel.w - w, Math.round(cel.pe[0] + (espelhadoX - ox) * s)));
      const top = Math.max(0, Math.round(cel.pe[1] + (by - q.origin[1]) * s));
      const input = await sharp(atlas).extract({ left: rx + bx, top: ry + by, width: bw, height: bh }).flop().resize(w, h, { kernel: "lanczos3" }).png().toBuffer();
      celulas.push({ input, left: c * cel.w + left, top: l * cel.h + top });
    }
  return sharp({ create: { width: grade[0].length * cel.w, height: grade.length * cel.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(celulas).webp({ quality: 88, alphaQuality: 100, effort: 6 });
}

for (const [pasta, nome] of Object.entries(NOMES)) {
  const dir = join(origem, pasta);
  const av = JSON.parse(readFileSync(join(dir, "avatar.json"), "utf8"));
  const quadros = new Map(av.frames.map((q) => [q.id, q]));
  const atlas = readFileSync(join(dir, "atlas.png"));
  await (await folha(atlas, quadros, GRADE_ANDAR, ANDAR)).toFile(join(destino, nome + ".webp"));
  /* amigo não tem folha de poses */
  if (existsSync(join(destino, "poses", nome + ".webp"))) await (await folha(atlas, quadros, GRADE_POSES, POSE)).toFile(join(destino, "poses", nome + ".webp"));
  console.log("ok", nome);
}
