/*
 * Um por nanico: a presença usa uma chave por aba (MY_KEY muda a cada recarga), então o mesmo nanico
 * com duas abas, PC e celular, ou uma presença antiga que ainda não expirou, aparece várias vezes.
 * Aqui juntamos tudo num item só por nanico. Regra pura, sem React.
 */
import type { Presence } from "./tipos";

export type PresencaNanico = Presence & {
  /** identificador estável do nanico na tela: a minha chave, ou "n:<fid>" (sem fid, "nome:<nome>") */
  id: string;
  /** todas as chaves (abas) daquele nanico agora */
  chaves: string[];
  /** a chave da aba com a câmera ligada (a câmera chega por ela), ou null */
  chaveCam: string | null;
};

const grupoDe = (p: Presence) => (p.fid ? `n:${p.fid}` : `nome:${p.name.trim().toLowerCase()}`);

/**
 * Junta as presenças por nanico (pelo `fid`; sem `fid`, pelo nome), ficando com a de `at` mais recente.
 * Quem transmite tela ou câmera, ou está na voz, em qualquer aba continua com `live`/`cam`/`voz` (e a chave da tela),
 * para a live não sumir de quem transmite numa aba e anda na outra.
 * As minhas outras abas entram no meu item, que fica com a `minhaChave`.
 */
export function umPorNanico(online: readonly Presence[], minhaChave: string): PresencaNanico[] {
  const grupos = new Map<string, Presence[]>();
  for (const p of online) {
    const g = grupoDe(p);
    grupos.set(g, [...(grupos.get(g) ?? []), p]);
  }
  const out: PresencaNanico[] = [];
  for (const [g, lista] of grupos) {
    const recente = lista.reduce((a, b) => (b.at > a.at ? b : a));
    const eu = lista.find((p) => p.key === minhaChave);
    const transmite = lista.filter((p) => p.live).reduce<Presence | null>((a, b) => (!a || b.at > a.at ? b : a), null);
    const comCam = lista.filter((p) => p.cam).reduce<Presence | null>((a, b) => (!a || b.at > a.at ? b : a), null);
    const comPos = lista.filter((p) => p.pos).reduce<Presence | null>((a, b) => (!a || b.at > a.at ? b : a), null);
    const naVoz = lista.filter((p) => p.voz).reduce<Presence | null>((a, b) => (!a || b.at > a.at ? b : a), null);
    const lendo = lista.filter((p) => p.texto).reduce<Presence | null>((a, b) => (!a || b.at > a.at ? b : a), null);
    const numaSala = lista.filter((p) => p.sala).reduce<Presence | null>((a, b) => (!a || b.at > a.at ? b : a), null);
    const base = eu ?? recente;
    out.push({
      ...base,
      /* a chave de quem transmite vale para assistir; senão, a minha (ou a mais recente) */
      key: eu ? eu.key : (transmite ?? recente).key,
      live: transmite?.live ?? null,
      cam: comCam?.cam ?? null,
      /* a voz (e o microfone e o fone dela) vem da aba que está na voz */
      voz: naVoz?.voz ?? null,
      mudo: naVoz?.mudo ?? false,
      surdo: naVoz?.surdo ?? false,
      texto: lendo?.texto ?? null,
      pos: (eu ?? comPos ?? recente).pos,
      /* o quarto anda junto com o piso: os dois vêm da mesma aba */
      quarto: (eu ?? comPos ?? recente).quarto ?? null,
      /* a sala vem da aba que está na voz ou numa sala, nunca de uma aba no lobby que só renovou a presença por último
         (senão, com duas abas, a pessoa pula entre a sala e o lobby a cada renovação) */
      sala: (eu ?? naVoz ?? numaSala ?? recente).sala,
      lines: Math.max(...lista.map((p) => p.lines)),
      id: eu ? minhaChave : g,
      chaves: lista.map((p) => p.key),
      chaveCam: comCam?.key ?? null,
    });
  }
  return out;
}

/** Acha o item do nanico dono de uma chave (qualquer aba dele). */
export const donoDaChave = (lista: readonly PresencaNanico[], chave: string) => lista.find((p) => p.chaves.includes(chave)) ?? null;
