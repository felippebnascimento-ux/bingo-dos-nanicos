/*
 * Visitas ao quarto próprio (fase 35): a cena do K-FOFO troca para o quarto de alguém (o meu ou o de outro nanico)
 * sem mudar a aba, a sala, a voz nem a câmera. `meuQuarto` no store é o friend id do dono (null = K-FOFO) e vai na
 * presença; o boneco anda na grade do quarto (grade.ts). Recarregar o site sempre abre no K-FOFO (nada no localStorage).
 */
import { entradaSorteada } from "@/features/hall/hall";
import { useLoja } from "@/features/loja/lojaDados";
import type { ItemLoja } from "@/features/loja/loja";
import { getApp, setApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { gradeDoQuarto, type Grade, type MovelGrade } from "./grade";
import { desenhoDo } from "./Moveis";
import { pisoDo, PORTA, type MovelNoQuarto } from "./quarto";
import { iniciarQuartos, moveisDe, useQuartos } from "./quartoDados";

/** Os móveis de alguém prontos para desenhar e para a grade (com o piso do item e o giro). */
export function paraCena(moveis: readonly MovelNoQuarto[], itens: readonly ItemLoja[] | null): MovelGrade[] {
  if (!itens) return [];
  return moveis.flatMap((m) => {
    const it = itens.find((x) => x.id === m.itemId);
    if (!it || !it.dados.w || !it.dados.d) return [];
    const { w, d } = pisoDo(it.dados.w, it.dados.d, m.giro);
    return [{ id: m.id, desenho: desenhoDo(it), ret: { i: m.i, j: m.j, w, d }, giro: m.giro }];
  });
}

/** O user_id do dono de um quarto (pelo friend id), se ele tem quarto. */
export function donoDoQuarto(fid: string | null | undefined): string | null {
  if (!fid) return null;
  const uid = getApp().friends.find((f) => f.id === fid)?.user_id;
  return uid && useQuartos.getState().quartos[uid] ? uid : null;
}

/* a grade muda só quando o tamanho, os móveis ou a vitrine mudam: guarda a última de cada dono */
const cache = new Map<string, { tam: number; moveis: unknown; itens: unknown; g: Grade }>();
/** A grade do quarto de um nanico (friend id), ou null se ele não tem quarto. */
export function gradeDe(fid: string | null | undefined): Grade | null {
  const uid = donoDoQuarto(fid);
  if (!uid || !fid) return null;
  const { quartos, moveis } = useQuartos.getState();
  const itens = useLoja.getState().itens;
  const c = cache.get(fid);
  if (c && c.tam === quartos[uid] && c.moveis === moveis && c.itens === itens) return c.g;
  const g = gradeDoQuarto(quartos[uid], paraCena(moveisDe(moveis, uid), itens));
  cache.set(fid, { tam: quartos[uid], moveis, itens, g });
  return g;
}

/**
 * Vai para o quarto de alguém (friend id) ou volta ao K-FOFO (null). O boneco aparece na porta do quarto (0, 0) ou
 * numa das entradas do K-FOFO; a presença leva o `quarto` e o piso novos.
 */
export function irParaQuarto(dono: string | null) {
  void iniciarQuartos();
  const s = getApp();
  if (dono === s.meuQuarto) return setApp({ aba: "hall", fichaAberta: null });
  if (dono && !donoDoQuarto(dono)) return toast("Esse nanico ainda não tem quarto.");
  setApp({ aba: "hall", fichaAberta: null, meuQuarto: dono, hallPos: dono ? { ...PORTA } : entradaSorteada() });
}
