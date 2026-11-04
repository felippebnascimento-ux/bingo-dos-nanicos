/*
 * Pedro no K-FOFO (seção 63, pedido do Felippe, 03/11/2026): o botão na parede cobra 200 moedas (pedro_tocar, no
 * banco) e toca "pedro pedro pedro" para todo mundo que está no K-FOFO, com a discoteca acesa enquanto a música dura.
 * A linha nova de `kfofo_pedro` chega a todos pelo tempo real (nunca broadcast); quem abre o K-FOFO no meio pergunta
 * `pedro_agora()` e entra no ponto certo da música. Quem está num quarto, na rua ou em outra aba não ouve.
 */
import { create } from "zustand";
import { aoConectar, aoMudarTabela } from "@/lib/sala";
import { getApp, useApp } from "@/lib/store";
import { errMsg, sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { pararSom, tocarSom } from "@/lib/sons";

/** Quanto dura a música (o banco espera 13 s antes de aceitar outra). */
export const PEDRO_MS = 11_700;
export const PEDRO_PRECO = 200;

/** `inicio`: a hora (deste aparelho) em que a música começou. */
export type Festa = { id: number; userId: string; inicio: number };

export const usePedro = create<{ festa: Festa | null; pedindo: boolean }>(() => ({ festa: null, pedindo: false }));

/** A festa ainda está tocando? */
export const festaAtiva = (f: Festa | null, agora = Date.now()): f is Festa => !!f && agora - f.inicio >= 0 && agora - f.inicio < PEDRO_MS;

/** Linha nova de kfofo_pedro (do tempo real), conferida. */
export function lerFesta(row: Record<string, unknown> | null, agora = Date.now(), passouMs = 0): Festa | null {
  if (!row) return null;
  const id = row.id, userId = row.user_id;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0 || typeof userId !== "string" || userId.length > 64) return null;
  const passou = Number.isFinite(passouMs) ? Math.max(0, Math.min(PEDRO_MS, passouMs)) : 0;
  return { id, userId, inicio: agora - passou };
}

let audio: HTMLAudioElement | null = null;
let tocandoId = 0;
let fim: ReturnType<typeof setTimeout> | undefined;

const noKfofo = () => {
  const s = getApp();
  return s.fase === "app" && s.aba === "hall" && !s.meuQuarto;
};

/** Liga ou desliga o som conforme a festa e onde eu estou. */
function sincronizar() {
  const f = usePedro.getState().festa;
  const agora = Date.now();
  if (!festaAtiva(f, agora)) {
    pararSom(audio);
    audio = null;
    tocandoId = 0;
    if (f) usePedro.setState({ festa: null });
    return;
  }
  if (!noKfofo()) {
    pararSom(audio);
    audio = null;
    tocandoId = 0;
    return;
  }
  if (tocandoId === f.id) return;
  pararSom(audio);
  audio = tocarSom("pedro", 0.75, (agora - f.inicio) / 1000);
  tocandoId = f.id;
}

function comecar(f: Festa | null) {
  if (!f) return;
  const atual = usePedro.getState().festa;
  if (atual && atual.id >= f.id) return; /* a mesma (ou uma mais nova) já está valendo */
  usePedro.setState({ festa: f });
  clearTimeout(fim);
  fim = setTimeout(sincronizar, Math.max(0, f.inicio + PEDRO_MS - Date.now()) + 50);
  sincronizar();
}

/** Pergunta ao banco se tem Pedro tocando agora (ao entrar e ao reconectar). */
async function perguntar() {
  const { data, error } = await sb().rpc("pedro_agora");
  if (error || !data || typeof data !== "object") return;
  const d = data as Record<string, unknown>;
  comecar(lerFesta(d, Date.now(), Number(d.passou_ms)));
}

let ligado = false;

export function iniciarPedro() {
  if (ligado) return;
  ligado = true;
  aoMudarTabela("kfofo_pedro", (row, ev) => {
    if (ev === "INSERT") comecar(lerFesta(row));
  });
  aoConectar(() => void perguntar());
  /* entrei ou saí do K-FOFO (aba ou quarto): liga ou desliga o som */
  useApp.subscribe((s, p) => {
    if (s.aba !== p.aba || s.meuQuarto !== p.meuQuarto || s.fase !== p.fase) sincronizar();
  });
  void perguntar();
}

/** O botão da parede: paga 200 e toca para todo mundo. */
export async function tocarPedro() {
  if (usePedro.getState().pedindo) return;
  usePedro.setState({ pedindo: true });
  const { data, error } = await sb().rpc("pedro_tocar");
  usePedro.setState({ pedindo: false });
  if (error) {
    const m = error.message || "";
    toast(
      /function|schema cache/i.test(m)
        ? "O Pedro ainda não foi ligado no banco (seção 63)."
        : /Saldo insuficiente/.test(m)
          ? `Faltam moedas: o Pedro custa ${PEDRO_PRECO}.`
          : /^O Pedro já está tocando/.test(m)
            ? "O Pedro já está tocando. Espere acabar."
            : errMsg(error, "Não deu para tocar o Pedro. Tente de novo."),
    );
    return;
  }
  const d = (data ?? {}) as Record<string, unknown>;
  /* o tempo real também avisa; aqui é só para começar na hora para quem pagou */
  comecar(lerFesta({ id: d.id, user_id: getApp().myUid }));
}
