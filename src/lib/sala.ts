/*
 * Sala em tempo real (canais privados do Supabase):
 *   - lobby, canal "bingo-dos-nanicos": presença de todo mundo (com a sala de cada um), truco, hall
 *     e mudanças no banco;
 *   - canal da minha sala, "sala:<id>": a live, as câmeras, as reações e o desenho só de quem está nela.
 *
 * Tudo que chega daqui vem de outros navegadores: NÃO é confiável.
 * Cada handler confere tipo e tamanho dos dados, se o remetente está em `online`
 * e tem limite de mensagens por pessoa (veja `limitePorPessoa`).
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { CANAL_SALA } from "./config";
import { sb } from "./supabase";
import { getApp, MY_KEY, setApp, useApp } from "./store";
import type { Presence } from "./tipos";
import { bingoLines } from "./bingo";
import { posHall } from "@/features/hall/hall";

/** Eventos de broadcast. Evento novo: acrescente aqui e escreva o handler com as conferências. */
export const EVENTOS = ["rtc", "reacao", "risco", "hall"] as const;
export type Evento = (typeof EVENTOS)[number];
/** Estes vão pelo canal da minha sala; o resto, pelo lobby. */
const EVENTOS_SALA: readonly Evento[] = ["rtc", "reacao", "risco"];

type Payload = Record<string, unknown> & { from?: unknown };
type Handler = (payload: Payload) => void;

let room: RealtimeChannel | null = null;
let canalSala: RealtimeChannel | null = null;
const handlers = new Map<Evento, Set<Handler>>();
const presencaFns = new Set<() => void>();
const conectarFns = new Set<() => void>();
const tabelaFns = new Map<string, Set<(row: Record<string, unknown> | null, ev: string) => void>>();

const add = <K, F>(m: Map<K, Set<F>>, k: K, fn: F) => {
  if (!m.has(k)) m.set(k, new Set());
  m.get(k)!.add(fn);
  return () => void m.get(k)!.delete(fn);
};

/** Recebe um evento de broadcast. Devolve a função que para de ouvir. */
export const aoReceber = (ev: Evento, fn: Handler) => add(handlers, ev, fn);

/** Chamado sempre que a lista de quem está na sala muda (depois de `online` atualizar). */
export function aoMudarPresenca(fn: () => void) {
  presencaFns.add(fn);
  return () => void presencaFns.delete(fn);
}

/** Chamado toda vez que a sala conecta (status SUBSCRIBED). */
export function aoConectar(fn: () => void) {
  conectarFns.add(fn);
  return () => void conectarFns.delete(fn);
}

/** Mudança numa tabela do banco (`friends`, `phrases`, `game`, `chat_messages`, `carteiras`, `rodizio`, `zoeiras`, `mochila`, `consumos`, `truco_mesas`, `truco_maos`, `bingo_partidas`, `bingo_cartelas`, `bingo_cantos`, `midias`, `mural_links`, `perfil_links`, `rede_posts`, `rede_curtidas`, `rede_comentarios`, `rede_stories`, `rede_mensagens`, `apostas_mercados`, `apostas`, `atributos_aviso`, `respeitos`, `truco_mercados`, `truco_apostas`). No DELETE, `row` traz só a chave da linha apagada. */
export const aoMudarTabela = (
  tabela: "friends" | "phrases" | "game" | "chat_messages" | "carteiras" | "rodizio" | "zoeiras" | "mochila" | "consumos" | "truco_mesas" | "truco_maos"
    | "bingo_partidas" | "bingo_cartelas" | "bingo_cantos"
    | "midias" | "mural_links" | "perfil_links"
    | "rede_posts" | "rede_curtidas" | "rede_comentarios" | "rede_stories" | "rede_mensagens"
    | "apostas_mercados" | "apostas" | "atributos_aviso" | "respeitos" | "truco_mercados" | "truco_apostas",
  fn: (row: Record<string, unknown> | null, ev: string) => void,
) => add(tabelaFns, tabela, fn);

/** Manda um evento para a sala. `from` (MY_KEY) é acrescentado sozinho. */
export function enviar(ev: Evento, payload: Record<string, unknown>) {
  const ch = EVENTOS_SALA.includes(ev) ? canalSala : room;
  /* canal fora do ar (entrando ou reconectando): o supabase-js mandaria pela API, que não entrega em canal privado */
  if (ch?.state !== "joined") return;
  ch.send({ type: "broadcast", event: ev, payload: { ...payload, from: MY_KEY } }).catch(() => {});
}

export const salaConectada = () => !!room;

/** O remetente está no site agora? Mensagem de quem não está é descartada. */
export const estaNaSala = (key: unknown) =>
  typeof key === "string" && getApp().online.some((p) => p.key === key);

/** O remetente está na MINHA sala? (live, câmeras, reações e desenho só aceitam de quem está nela) */
export const naMinhaSala = (key: unknown) =>
  typeof key === "string" && !!getApp().minhaSala && getApp().onlineSala.some((p) => p.key === key);

/** Quem está na minha sala, a partir da presença do lobby. */
function atualizarOnlineSala() {
  const s = getApp();
  setApp({ onlineSala: s.minhaSala ? s.online.filter((p) => p.sala === s.minhaSala) : [] });
}

/** Troca o canal da sala (null = só o lobby). Quem chama encerra antes a tela e a câmera. */
export function entrarCanalSala(id: string | null) {
  if (canalSala) {
    sb().removeChannel(canalSala).catch(() => {});
    canalSala = null;
  }
  setApp({ minhaSala: id });
  atualizarOnlineSala();
  presencaFns.forEach((fn) => fn());
  if (!id) return;
  let ch = sb().channel("sala:" + id, { config: { broadcast: { self: false }, private: true } });
  for (const ev of EVENTOS_SALA) {
    ch = ch.on("broadcast", { event: ev }, ({ payload }) => {
      if (!payload || typeof payload !== "object") return;
      handlers.get(ev)?.forEach((fn) => fn(payload as Payload));
    });
  }
  canalSala = ch;
  ch.subscribe();
}

/**
 * Limite de mensagens por pessoa numa janela de tempo. Devolve false quando passou do limite.
 * Ex.: `const lim = limitePorPessoa(40, 2000); if (!lim(m.from)) return;`
 */
export function limitePorPessoa(max: number, janelaMs: number) {
  const hits = new Map<string, number[]>();
  return (from: string) => {
    const agora = Date.now();
    const h = (hits.get(from) || []).filter((t) => agora - t < janelaMs);
    if (h.length >= max) {
      hits.set(from, h);
      return false;
    }
    h.push(agora);
    hits.set(from, h);
    return true;
  };
}

/* ---------- presença ---------- */
const SID_RE = /^[A-Za-z0-9-]{8,64}$/;
export const sidValido = (v: unknown): v is string => typeof v === "string" && SID_RE.test(v);

export function cleanPresence(key: unknown, d: unknown): Presence | null {
  if (!d || typeof d !== "object" || typeof key !== "string" || key.length > 80) return null;
  const o = d as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 40) : "";
  if (!name) return null;
  return {
    key,
    name,
    fid: typeof o.fid === "string" ? o.fid.slice(0, 64) : null,
    lines: Math.max(0, Math.min(12, Math.floor(Number(o.lines)) || 0)),
    live: sidValido(o.live) ? o.live : null,
    cam: sidValido(o.cam) ? o.cam : null,
    pos: posHall(o.pos),
    sala: typeof o.sala === "string" && getApp().salas.some((x) => x.id === o.sala) ? o.sala : null,
    voz: sidValido(o.voz) ? o.voz : null,
    mudo: o.mudo === true,
    surdo: o.surdo === true,
    texto: canalValido(o.texto) ? o.texto : null,
    at: Number(o.at) || 0,
  };
}

/** Canal de texto que existe: "geral" ou o id de uma sala. */
export const canalValido = (v: unknown): v is string => typeof v === "string" && (v === "geral" || getApp().salas.some((x) => x.id === v));

/** O canal de texto que eu estou olhando agora (vai na presença). */
const meuTexto = (s = getApp()) => (s.aba === "chat" ? s.canalTexto : null);

/*
 * O Supabase aceita só 5 atualizações de presença a cada 30 s por pessoa; passou disso, ele FECHA o canal
 * (ClientPresenceRateLimitReached) e, até reconectar, nada da sala chega (emojis, desenho, sinal da live).
 * Então a presença sai no máximo 4 vezes a cada 30 s: o que mudar no meio espera e sai junto, com o estado mais novo.
 */
const PRESENCA_MAX = 4,
  PRESENCA_JANELA = 30_000;
let presencaEnvios: number[] = [];
let presencaDepois: ReturnType<typeof setTimeout> | undefined;

/** Atualiza a minha presença (nome, linhas de bingo, transmissão, câmera, piso do hall, sala, voz e canal de texto). */
export function trackMe() {
  if (presencaDepois) return; /* já tem uma marcada; ela lê o estado na hora de sair */
  const agora = Date.now();
  presencaEnvios = presencaEnvios.filter((t) => agora - t < PRESENCA_JANELA);
  if (presencaEnvios.length >= PRESENCA_MAX) {
    const espera = presencaEnvios[0] + PRESENCA_JANELA - agora + 250;
    presencaDepois = setTimeout(() => {
      presencaDepois = undefined;
      trackMe();
    }, espera);
    return;
  }
  const s = getApp();
  if (!room || room.state !== "joined" || !s.myName) return;
  presencaEnvios.push(agora);
  room
    .track({
      name: s.myName,
      fid: s.myFid,
      lines: bingoLines(s.card),
      live: s.myLiveSid,
      cam: s.myCamSid,
      pos: s.hallPos,
      sala: s.minhaSala,
      voz: s.myVozSid,
      mudo: s.vozMudo,
      surdo: s.vozSurdo,
      texto: meuTexto(s),
      at: Date.now(),
    })
    .catch(() => {});
}

/* ---------- conexão ---------- */
let aoTabela: (tabela: string) => void = () => {};
let ligouUmaVez = false;
let tentativa = 0;
let religar: ReturnType<typeof setTimeout> | undefined;
/** espera antes de reconectar: 1 s, 2 s, 5 s, 10 s e no máximo 30 s */
const ESPERAS = [1000, 2000, 5000, 10000, 30000];

/** Entra no lobby (uma vez); se a conexão cair, `reconectar()` monta o canal de novo sozinho. */
export function joinRoom(onTabela: (tabela: string) => void) {
  if (room) return;
  aoTabela = onTabela;
  conectar();
  if (ligouUmaVez) return;
  ligouUmaVez = true;
  /* a presença acompanha sozinha a cartela (linhas de bingo), a transmissão, a câmera, o piso do hall, a sala, a voz e o canal de texto */
  useApp.subscribe((s, p) => {
    if (
      s.myLiveSid !== p.myLiveSid ||
      s.myCamSid !== p.myCamSid ||
      s.myName !== p.myName ||
      s.hallPos !== p.hallPos ||
      s.minhaSala !== p.minhaSala ||
      s.myVozSid !== p.myVozSid ||
      s.vozMudo !== p.vozMudo ||
      s.vozSurdo !== p.vozSurdo ||
      meuTexto(s) !== meuTexto(p) ||
      bingoLines(s.card) !== bingoLines(p.card)
    )
      trackMe();
  });
  /* voltou para a aba: se o canal caiu, reconecta na hora; se não, renova a presença */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (!room || room.state !== "joined") reconectar(0);
    else trackMe();
  });
  /* a presença se renova a cada minuto (o "mais recente" do um-por-nanico depende do `at`) */
  setInterval(() => {
    if (room?.state === "joined") trackMe();
  }, 60_000);
}

/** Derruba o canal velho e monta de novo depois de `espera` (sem espera = agora). */
function reconectar(espera = ESPERAS[Math.min(tentativa, ESPERAS.length - 1)]) {
  clearTimeout(religar);
  setApp({ conn: "Reconectando…" });
  religar = setTimeout(() => {
    const velho = room;
    room = null;
    if (velho) sb().removeChannel(velho).catch(() => {});
    tentativa++;
    conectar();
    /* o canal da sala também volta (sem encerrar a live: quem transmite continua) */
    const sala = getApp().minhaSala;
    if (sala) entrarCanalSala(sala);
  }, espera);
}

function conectar() {
  const onTabela = aoTabela;
  let ch = sb().channel(CANAL_SALA, {
    config: { presence: { key: MY_KEY }, broadcast: { self: false }, private: true },
  });
  ch = ch.on("presence", { event: "sync" }, () => {
    const st = ch.presenceState() as Record<string, unknown[]>;
    /* até 60 chaves cruas (abas e presenças antigas); o um-por-nanico junta depois */
    const online = Object.entries(st)
      .slice(0, 60)
      .map(([key, arr]) => cleanPresence(key, Array.isArray(arr) ? arr[arr.length - 1] : null))
      .filter((p): p is Presence => !!p);
    setApp({ online });
    atualizarOnlineSala();
    presencaFns.forEach((fn) => fn());
  });
  for (const ev of EVENTOS.filter((e) => !EVENTOS_SALA.includes(e))) {
    ch = ch.on("broadcast", { event: ev }, ({ payload }) => {
      if (!payload || typeof payload !== "object") return;
      handlers.get(ev)?.forEach((fn) => fn(payload as Payload));
    });
  }
  for (const tabela of ["friends", "phrases", "game"] as const) {
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table: tabela }, (pl) => {
      onTabela(tabela);
      tabelaFns.get(tabela)?.forEach((fn) => fn((pl?.new as Record<string, unknown>) || null, pl?.eventType || ""));
    });
  }
  ch = ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (pl) => {
    tabelaFns.get("chat_messages")?.forEach((fn) => fn((pl?.new as Record<string, unknown>) || null, "INSERT"));
  });
  /* ganhos de moedas de todo mundo: vêm do banco (a RLS deixa nanicos lerem as carteiras), nunca de broadcast */
  ch = ch.on("postgres_changes", { event: "*", schema: "public", table: "carteiras" }, (pl) => {
    tabelaFns.get("carteiras")?.forEach((fn) => fn((pl?.new as Record<string, unknown>) || null, pl?.eventType || ""));
  });
  /* roleta do rodízio: o sorteio vem da tabela (o banco sorteia), nunca de broadcast */
  ch = ch.on("postgres_changes", { event: "*", schema: "public", table: "rodizio" }, (pl) => {
    tabelaFns.get("rodizio")?.forEach((fn) => fn((pl?.new as Record<string, unknown>) || null, pl?.eventType || ""));
  });
  /* chinelada e torta: pagas, então vêm da tabela (gravada por zoar()), nunca de broadcast */
  ch = ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "zoeiras" }, (pl) => {
    tabelaFns.get("zoeiras")?.forEach((fn) => fn((pl?.new as Record<string, unknown>) || null, "INSERT"));
  });
  /* loja: o que cada um equipou (quarto, título, moldura) e o boneco fumando ou bebendo (pago, então da tabela) */
  ch = ch.on("postgres_changes", { event: "*", schema: "public", table: "mochila" }, (pl) => {
    tabelaFns.get("mochila")?.forEach((fn) => fn((pl?.new as Record<string, unknown>) || null, pl?.eventType || ""));
  });
  ch = ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "consumos" }, (pl) => {
    tabelaFns.get("consumos")?.forEach((fn) => fn((pl?.new as Record<string, unknown>) || null, "INSERT"));
  });
  /* truco: a mesa pública e a minha mão (o RLS só manda a minha), gravadas pela função truco-mesa, nunca broadcast */
  /* bingo: a partida da sala, a minha cartela (o RLS só manda a minha) e os cantos; gravados só pelas funções bingo_* */
  /* mídias, mural e links do perfil: a galeria e a ficha se atualizam sozinhas */
  /* apostas: o bolo de cada partida e as minhas apostas (o RLS só manda as minhas), gravados só pelas funções do banco */
  for (const tabela of ["truco_mesas", "truco_maos", "bingo_partidas", "bingo_cartelas", "bingo_cantos", "midias", "mural_links", "perfil_links", "rede_posts", "rede_curtidas", "rede_comentarios", "rede_stories", "rede_mensagens", "apostas_mercados", "apostas", "atributos_aviso", "respeitos", "truco_mercados", "truco_apostas"] as const) {
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table: tabela }, (pl) => {
      const row = (pl?.eventType === "DELETE" ? pl.old : pl?.new) as Record<string, unknown> | undefined;
      tabelaFns.get(tabela)?.forEach((fn) => fn(row || null, pl?.eventType || ""));
    });
  }
  room = ch;
  ch.subscribe((st) => {
    if (room !== ch) return; /* aviso de um canal velho, já trocado */
    if (st === "SUBSCRIBED") {
      tentativa = 0;
      setApp({ conn: "Sincronizado" });
      trackMe();
      conectarFns.forEach((fn) => fn());
    } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
      /* a aba ficou em segundo plano, a internet caiu ou o servidor fechou: tenta de novo sozinho */
      reconectar();
    }
  });
}
