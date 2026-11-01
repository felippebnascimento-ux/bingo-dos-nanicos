/* ---------- partida ao vivo (API da Riot, pela função riot-ao-vivo do Supabase) ----------
   A cada minuto o site pergunta à função quem dos nanicos com op.gg está em partida.
   Quando aparece uma partida nova, a escalação pode ser preenchida sozinha. */
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { salvarEscalacao } from "@/lib/dados";
import { friendOf, getApp } from "@/lib/store";
import { sb } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { local } from "@/lib/util";
import { escalacaoDaPartida, riotEmJogo as emJogoDe, riotJogos, type RiotPartida } from "./partida";

type RiotState = {
  /** partidas acontecendo agora (já sem dado velho) */
  jogos: RiotPartida[];
  erro: string | null;
  checado: number | null;
  /** a função não respondeu: tenta de novo em 5 minutos */
  off: boolean;
  /** preencher a escalação sozinho quando aparece partida nova */
  auto: boolean;
};

export const useRiot = create<RiotState>()(() => ({
  jogos: [],
  erro: null,
  checado: null,
  off: false,
  auto: local.get("riot-auto") !== "0",
}));

/** Nanicos em partida agora → campeão (usado no Perfil). */
export const riotEmJogo = (jogos: RiotPartida[] = useRiot.getState().jogos) => emJogoDe(jogos);

export function setRiotAuto(on: boolean) {
  useRiot.setState({ auto: on });
  local.set("riot-auto", on ? "1" : "0");
}

/* partidas que já preencheram a escalação sozinhas (uma vez por partida) */
let visto: string[] = (() => {
  const v = local.json<unknown>("riot-visto");
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
})();

let timer: ReturnType<typeof setTimeout> | undefined;
let ult = 0;

async function riotTick() {
  clearTimeout(timer);
  if (!getApp().myFid) {
    timer = setTimeout(riotTick, 15000);
    return;
  }
  if (document.hidden) {
    timer = setTimeout(riotTick, 30000);
    return;
  }
  ult = Date.now();
  let linhas: unknown[] = [];
  const antes = useRiot.getState();
  let erro = antes.erro,
    checado = antes.checado,
    off = false;
  try {
    const { data, error } = await sb().functions.invoke("riot-ao-vivo", { body: {} });
    if (error) throw error;
    linhas = Array.isArray(data?.linhas) ? data.linhas.slice(0, 30) : [];
    erro = typeof data?.erro === "string" ? data.erro.slice(0, 160) : null;
    checado = data?.checado_em ? Date.parse(data.checado_em) : null;
  } catch (e) {
    console.warn("partida ao vivo indisponível", e);
    off = true;
    linhas = [];
  }
  const jogos = riotJogos(linhas, Date.now());
  useRiot.setState({ jogos, erro, checado, off });
  /* partida nova e só uma acontecendo: preenche a escalação sozinho (uma vez por partida) */
  if (useRiot.getState().auto && jogos.length === 1 && !visto.includes(jogos[0].id)) {
    visto = [...visto, jogos[0].id].slice(-20);
    local.setJson("riot-visto", visto);
    riotPreencher(jogos[0], false);
  }
  timer = setTimeout(riotTick, off ? 300000 : 60000);
}

/** Coloca os nanicos da partida na escalação, cada um na lane deduzida. */
export function riotPreencher(g: RiotPartida, manual: boolean) {
  const novo = escalacaoDaPartida(g, (fid) => !!friendOf(fid));
  if (!novo) {
    if (manual) toast("Nenhum nanico encontrado nessa partida.");
    return;
  }
  salvarEscalacao(novo);
  toast(manual ? "Escalação preenchida com a partida" : "Partida detectada: escalação preenchida");
}

let iniciou = false;
/** Chamado uma vez, 1,5 s depois de entrar no site. */
export function iniciarRiot(): void {
  if (iniciou) return;
  iniciou = true;
  riotTick();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - ult > 60000) riotTick();
  });
}

/* ---------- relógio de 1 s para o tempo de partida ---------- */
let agora = Date.now();
const ouvintes = new Set<() => void>();
let intervalo: ReturnType<typeof setInterval> | undefined;
function assinarRelogio(cb: () => void) {
  ouvintes.add(cb);
  if (!intervalo) {
    agora = Date.now();
    intervalo = setInterval(() => {
      agora = Date.now();
      ouvintes.forEach((f) => f());
    }, 1000);
  }
  return () => {
    ouvintes.delete(cb);
    if (!ouvintes.size) {
      clearInterval(intervalo);
      intervalo = undefined;
    }
  };
}
/** Hora atual (ms), atualizada a cada segundo enquanto alguém usa. */
export const useRelogio = () => useSyncExternalStore(assinarRelogio, () => agora);
