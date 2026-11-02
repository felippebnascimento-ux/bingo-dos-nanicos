/*
 * Copia a supressão de ruído (RNNoise) do node_modules para public/ruido/, para o site servir os arquivos
 * do próprio endereço (a CSP só deixa script e wasm do próprio site). Roda sozinho depois do `npm install`.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "node_modules/@sapphi-red/web-noise-suppressor/dist");
const destino = join(raiz, "public/ruido");
mkdirSync(destino, { recursive: true });
for (const [de, para] of [
  ["rnnoise/workletProcessor.js", "rnnoiseWorklet.js"],
  ["rnnoise.wasm", "rnnoise.wasm"],
  ["rnnoise_simd.wasm", "rnnoise_simd.wasm"],
])
  copyFileSync(join(origem, de), join(destino, para));
