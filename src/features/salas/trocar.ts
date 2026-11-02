/*
 * Salas tipo lan house: entrar, trocar e voltar para o lobby.
 * Trocar de sala encerra a tela e a câmera (são só de quem está na sala), troca o canal da sala,
 * avisa a presença do lobby e carrega a escalação (nas salas de LoL) e o chat da sala nova.
 */
import { pararTudoAoVivo } from "@/features/live/live";
import { loadGame } from "@/lib/dados";
import { entrarCanalSala } from "@/lib/sala";
import { getApp, salaLol, setApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { local } from "@/lib/util";

export function entrarSala(id: string | null) {
  const s = getApp();
  if (s.minhaSala === id) return setApp({ salasAberto: false });
  const sala = id ? s.salas.find((x) => x.id === id) : null;
  if (id && !sala) return;
  try {
    pararTudoAoVivo();
  } catch {
    /* nada transmitindo */
  }
  entrarCanalSala(id);
  local.set("sala-atual", id);
  if (salaLol()) loadGame().catch(() => {});
  /* a aba Jogar só existe nas salas de LoL */
  setApp({ salasAberto: false, ...(getApp().aba === "jogar" && !salaLol() ? { aba: "hall" as const } : {}) });
  toast(sala ? `Você entrou na ${sala.nome}` : "Você voltou para o lobby");
}

/** Nome da minha sala ("LoL 1"), ou null no lobby. */
export const nomeDaSala = (id: string | null, salas = getApp().salas) => (id ? (salas.find((x) => x.id === id)?.nome ?? null) : null);
