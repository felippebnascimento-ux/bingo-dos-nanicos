/*
 * Sons em arquivo (public/sons/), tocados pelo <audio> do navegador. Os curtos (clique, entrou, saiu, dinheiro)
 * podem se sobrepor: cada toque é um <audio> novo, e o arquivo já fica no cache depois do primeiro. Os longos
 * (faroeste, pedro) devolvem o <audio> para quem chamou poder parar ou pular para o meio.
 * O navegador só toca depois de um toque na página; antes disso, o erro é engolido em silêncio.
 */
export type Som = "clique" | "entrou" | "saiu" | "dinheiro" | "faroeste" | "pedro";

const URL_SOM: Record<Som, string> = {
  clique: "/sons/clique.mp3",
  entrou: "/sons/entrou.mp3",
  saiu: "/sons/saiu.mp3",
  dinheiro: "/sons/dinheiro.mp3",
  faroeste: "/sons/faroeste.mp3",
  pedro: "/sons/pedro.mp3",
};

/** Toca um som (volume de 0 a 1). `desde` pula os primeiros segundos (para quem chega no meio). */
export function tocarSom(som: Som, volume = 1, desde = 0): HTMLAudioElement | null {
  if (typeof Audio === "undefined" || volume <= 0) return null;
  try {
    const a = new Audio(URL_SOM[som]);
    a.volume = Math.max(0, Math.min(1, volume));
    /* alguns navegadores só aceitam pular depois de saber a duração */
    if (desde > 0) a.addEventListener("loadedmetadata", () => (a.currentTime = Math.min(desde, a.duration || desde)), { once: true });
    void a.play().catch(() => {});
    return a;
  } catch {
    return null;
  }
}

/** Para um som longo e solta o arquivo. */
export function pararSom(a: HTMLAudioElement | null | undefined) {
  if (!a) return;
  try {
    a.pause();
    a.removeAttribute("src");
    a.load();
  } catch {
    /* já parou */
  }
}
