/*
 * Seguir amigo (como no Habbo): vai até onde o nanico está agora, no K-FOFO, na rua, no corredor ou num quarto,
 * e para ao lado dele. Usa só a presença (a cena `quarto` e o piso `pos` de cada um), sem banco e sem broadcast novo.
 */
import { umPorNanico } from "@/lib/presenca";
import { getApp, MY_KEY } from "@/lib/store";
import { toast } from "@/lib/toast";
import { irParaQuarto } from "@/features/quarto/visita";
import { andarPerto } from "./bonecos";

/** Onde o nanico está: a cena (dono do quarto, "rua", "corredor"… ou null = K-FOFO) e o piso, ou null se offline. */
export function ondeEsta(fid: string): { quarto: string | null; pos: unknown } | null {
  const s = getApp();
  const p = umPorNanico(s.online, MY_KEY).find((x) => x.fid === fid && x.id !== MY_KEY);
  return p ? { quarto: p.quarto ?? null, pos: p.pos } : null;
}

/** Vai até o nanico (friend id). Troca de cena se precisar e anda até o lado dele quando a cena se monta. */
export function seguir(fid: string) {
  const s = getApp();
  const nome = s.friends.find((f) => f.id === fid)?.name ?? "Esse nanico";
  const onde = ondeEsta(fid);
  if (!onde) return toast(`${nome} não está no site agora.`);
  const mudou = onde.quarto !== s.meuQuarto;
  irParaQuarto(onde.quarto);
  /* trocando de cena, espera a cena nova se montar (grade do quarto, bonecos) antes de andar */
  setTimeout(() => andarPerto(onde.pos), mudou ? 600 : 0);
}
