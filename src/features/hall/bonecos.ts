/*
 * Movimento dos bonecos no hall. Cada navegador calcula o caminho e anima sozinho:
 * pela sala só vão o destino (evento `hall`) e, na chegada, o piso na presença (`pos`).
 * O loop de animação só roda enquanto alguém anda e o hall está à vista.
 */
import { create } from "zustand";
import { aoMudarPresenca, aoReceber, enviar, estaNaSala, limitePorPessoa } from "@/lib/sala";
import { getApp, MY_KEY, setApp, useApp } from "@/lib/store";
import { umPorNanico, type PresencaNanico } from "@/lib/presenca";
import { local, reduzMovimento } from "@/lib/util";
import { assentoDe, caminho, entradaDe, entradaSorteada, livre, posHall, posValida, sentido, suavizar, type Piso, type Sentido } from "./hall";
import { assentoDoQuarto, pisoLivreMaisPerto, posQuarto, type Grade } from "@/features/quarto/grade";
import { portaDaCena } from "@/features/quarto/cenas";
import { iniciarQuartos, useQuartos } from "@/features/quarto/quartoDados";
import { gradeDe } from "@/features/quarto/visita";
import { iniciarLoja } from "@/features/loja/lojaDados";
import { lerAcao, marcarAcao, pararAcao, type Acao } from "./acoes";
import { marcarDigitando } from "./baloes";

export type Boneco = {
  key: string;
  name: string;
  fid: string | null;
  /** posição na tela, em pisos (fracionária no meio de um passo) */
  i: number;
  j: number;
  sentido: Sentido;
  /** 0 = parado, 1 a 4 = quadros do andar */
  quadro: number;
  /** assento onde está sentado (null = em pé) */
  senta: string | null;
};

type Interno = Boneco & {
  /** piso de onde saiu e para onde vai no passo atual (parado: os dois iguais) */
  de: Piso;
  alvo: Piso;
  fila: Piso[];
  progresso: number;
  desde: number;
  /** assento onde vai sentar quando chegar */
  vaiSentar: string | null;
  /** está no primeiro passo depois de parado (acelera nele) */
  arrancou: boolean;
};


/** brilho do teletransporte (alguém sumiu ou apareceu na cena indo para um quarto ou voltando ao K-FOFO) */
export type Brilho = { id: string; i: number; j: number };
export const useHall = create<{ bonecos: Boneco[]; aviso: string; brilhos: Brilho[] }>()(() => ({ bonecos: [], aviso: "", brilhos: [] }));

/* ---------- cena: o K-FOFO ou o quarto de alguém (fase 35) ---------- */
/** A cena que estou vendo: o quarto de alguém (friend id do dono) ou o K-FOFO (null). */
const cena = () => getApp().meuQuarto;
/** A grade do quarto que estou vendo (null no K-FOFO ou se o quarto ainda não carregou). */
const gradeCena = (): Grade | null => {
  const q = cena();
  return q ? gradeDe(q) : null;
};
const nada = () => false;
const livreCena = () => (cena() ? (gradeCena()?.livre ?? nada) : livre);
/** O assento pelo id, na cena (sofás do hall ou os móveis de sentar do quarto). */
function assentoCena(id: unknown): { id: string; chegar: Piso; olha: Sentido } | null {
  if (!cena()) return assentoDe(id);
  const g = gradeCena();
  return g ? assentoDoQuarto(g, id) : null;
}
/** Confere um piso (e o assento) com a grade da cena. */
function posCena(v: unknown) {
  if (!cena()) return posHall(v);
  const g = gradeCena();
  return g ? posQuarto(v, g) : null;
}
/** Onde aparece quem chega à cena sem piso: a porta do quarto ou uma entrada do K-FOFO. */
const chegadaCena = (id: string): Piso => (cena() ? { ...portaDaCena(cena()) } : entradaDe(id));

function brilhar(lista: Brilho[]) {
  if (!lista.length || reduzMovimento()) return;
  useHall.setState((s) => ({ brilhos: [...s.brilhos, ...lista] }));
  const ids = new Set(lista.map((b) => b.id));
  setTimeout(() => useHall.setState((s) => ({ brilhos: s.brilhos.filter((b) => !ids.has(b.id)) })), 700);
}

const B = new Map<string, Interno>();
/** pisos por segundo */
const VEL = 3;
const VEL_SEM_MOVIMENTO = 6;
/** troca de quadro do andar */
const QUADRO_MS = 120;

let primeiraLista = true;

const publicar = () =>
  useHall.setState({
    bonecos: [...B.values()].map(({ key, name, fid, i, j, sentido: s, quadro, senta }) => ({ key, name, fid, i, j, sentido: s, quadro, senta })),
  });

const visivel = () => getApp().aba === "hall" && typeof document !== "undefined" && !document.hidden;

function novo(key: string, name: string, fid: string | null, p: Piso & { s?: string }): Interno {
  const a = assentoCena(p.s);
  return {
    key, name, fid, i: p.i, j: p.j, sentido: a?.olha ?? "frente-direita", quadro: 0, senta: a?.id ?? null,
    de: { i: p.i, j: p.j }, alvo: { i: p.i, j: p.j }, fila: [], progresso: 0, desde: 0, vaiSentar: null, arrancou: false,
  };
}

/** Chegou ao fim do caminho: para no quadro "parado" e, se for o meu, avisa a presença. */
function parar(b: Interno) {
  b.de = { ...b.alvo };
  b.i = b.alvo.i;
  b.j = b.alvo.j;
  b.fila = [];
  b.progresso = 0;
  b.quadro = 0;
  /* chegou no piso do assento: senta, olhando para o lado do móvel */
  const a = assentoCena(b.vaiSentar);
  b.senta = a && a.chegar.i === b.alvo.i && a.chegar.j === b.alvo.j ? a.id : null;
  if (a && b.senta) b.sentido = a.olha;
  b.vaiSentar = null;
  if (b.key === MY_KEY) {
    const pos = b.senta ? { ...b.alvo, s: b.senta } : { ...b.alvo };
    setApp({ hallPos: pos });
    /* o assento não fica salvo: ao voltar ao site, a pessoa aparece em pé; o piso do quarto também não (abre no K-FOFO) */
    if (!cena()) local.setJson("hall-pos", { ...b.alvo });
  }
}

const andando = (b: Interno) => b.de.i !== b.alvo.i || b.de.j !== b.alvo.j;

/** Começa o próximo passo da fila (ou para, se acabou). */
function proximoPasso(b: Interno) {
  const prox = b.fila.shift();
  if (!prox) return parar(b);
  b.arrancou = !andando(b);
  b.de = { ...b.alvo };
  b.alvo = prox;
  b.sentido = sentido(b.de, b.alvo, b.sentido);
}

/** Leva o boneco até `para`. Se estiver no meio de um passo, termina o passo e segue dali. */
function rota(b: Interno, para: Piso, sentar: string | null = null): boolean {
  const c = caminho(b.alvo, para, livreCena());
  if (!c.length) return false;
  /* levanta para andar (ou para trocar de assento no mesmo piso); andar acaba com a dança e o deitar */
  b.senta = null;
  pararAcao(b.key);
  b.vaiSentar = sentar;
  b.fila = c.slice(1);
  if (!andando(b)) {
    b.desde = performance.now();
    proximoPasso(b);
  }
  if (!visivel()) {
    /* com o hall escondido não tem por que animar: vai direto */
    b.alvo = c[c.length - 1];
    parar(b);
  } else ligarLoop();
  publicar();
  return true;
}

/* ---------- loop de animação ---------- */
let raf = 0;
let ultimo = 0;

function ligarLoop() {
  if (raf) return;
  ultimo = performance.now();
  raf = requestAnimationFrame(passo);
  vigiar();
}

/* página aberta mas sem desenhar (janela coberta, aba de fundo): sem quadro por 0,5 s, todo mundo chega direto */
let vigia: ReturnType<typeof setTimeout> | undefined;
function vigiar() {
  clearTimeout(vigia);
  vigia = setTimeout(() => {
    if (!raf) return;
    if (performance.now() - ultimo > 400) terminarTudo();
    else vigiar();
  }, 500);
}

function passo(agora: number) {
  raf = 0;
  if (!visivel()) return terminarTudo();
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;
  const calmo = reduzMovimento();
  let alguem = false;
  for (const b of B.values()) {
    if (!andando(b)) continue;
    b.progresso += dt * (calmo ? VEL_SEM_MOVIMENTO : VEL);
    while (b.progresso >= 1 && andando(b)) {
      b.progresso -= 1;
      proximoPasso(b);
    }
    if (andando(b)) {
      alguem = true;
      /* calmo (menos movimento): reto, sem acelerar nem frear */
      const t = calmo ? b.progresso : suavizar(b.progresso, b.arrancou, b.fila.length === 0);
      b.i = b.de.i + (b.alvo.i - b.de.i) * t;
      b.j = b.de.j + (b.alvo.j - b.de.j) * t;
      b.quadro = calmo ? 0 : 1 + (Math.floor((agora - b.desde) / QUADRO_MS) % 4);
    }
  }
  publicar();
  if (alguem) raf = requestAnimationFrame(passo);
}

/** Hall escondido: todo mundo que estava andando já aparece onde ia parar. */
function terminarTudo() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  for (const b of B.values()) {
    if (!andando(b) && !b.fila.length) continue;
    b.alvo = b.fila.length ? b.fila[b.fila.length - 1] : b.alvo;
    parar(b);
  }
  publicar();
}

/* ---------- quem está no hall ---------- */
/* chave de cada aba → boneco do nanico dono dela (para o broadcast de qualquer aba mover o mesmo boneco) */
const chaveDoBoneco = new Map<string, string>();

function sincronizar() {
  const s = getApp();
  if (s.fase !== "app" || !s.myName) {
    /* saiu do site: o próximo login começa com o hall vazio */
    B.clear();
    primeiraLista = true;
    return publicar();
  }
  /* um boneco por nanico: as várias abas (e presenças antigas) de alguém viram um só */
  const todos: Pick<PresencaNanico, "id" | "chaves" | "name" | "fid" | "pos" | "quarto">[] = umPorNanico(s.online, MY_KEY);
  const aqui = cena();
  /* teletransporte: quem trocou de cena (foi para um quarto ou voltou) some ou aparece com um brilho */
  const brilhos: Brilho[] = [];
  const teleportou = new Set<string>();
  for (const p of todos) {
    const antes = cenaAntes.get(p.id), agora = p.quarto ?? null;
    if (p.id === MY_KEY || primeiraLista || antes === undefined || antes === agora) continue;
    teleportou.add(p.id);
    const b = B.get(p.id);
    if (antes === aqui && b) brilhos.push({ id: `${p.id}:${Date.now()}:s`, i: b.i, j: b.j });
    else if (agora === aqui) {
      const pp = posCena(p.pos) ?? chegadaCena(p.id);
      brilhos.push({ id: `${p.id}:${Date.now()}:a`, i: pp.i, j: pp.j });
    }
  }
  cenaAntes.clear();
  for (const p of todos) cenaAntes.set(p.id, p.quarto ?? null);
  /* só quem está na mesma cena (no K-FOFO, quem não está em quarto nenhum) */
  const lista = todos.filter((p) => p.id === MY_KEY || (p.quarto ?? null) === aqui);
  /* eu apareço mesmo antes da presença chegar (ou se a sala cair) */
  if (!lista.some((p) => p.id === MY_KEY)) lista.push({ id: MY_KEY, chaves: [MY_KEY], name: s.myName, fid: s.myFid, pos: s.hallPos, quarto: aqui });
  const ids = new Set<string>();
  const entraram: string[] = [];
  chaveDoBoneco.clear();
  for (const p of lista) {
    ids.add(p.id);
    for (const k of p.chaves) chaveDoBoneco.set(k, p.id);
    const eu = p.id === MY_KEY;
    /* no quarto, o piso de cada um é conferido com a grade dele (móveis e assentos) */
    const dele = eu ? null : posCena(p.pos);
    const pos = (eu ? s.hallPos : dele) || chegadaCena(p.id);
    const b = B.get(p.id);
    if (!b) {
      B.set(p.id, novo(p.id, eu ? s.myName : p.name, eu ? s.myFid : p.fid, pos));
      if (!eu && !teleportou.has(p.id)) entraram.push(p.name);
      continue;
    }
    b.name = eu ? s.myName : p.name;
    b.fid = eu ? s.myFid : p.fid;
    /* perdeu algum destino? a presença corrige, andando até o piso certo (e sentando, se ela estiver sentada) */
    if (dele && !andando(b) && (b.alvo.i !== dele.i || b.alvo.j !== dele.j || b.senta !== (dele.s ?? null))) rota(b, dele, dele.s ?? null);
  }
  for (const k of [...B.keys()])
    if (!ids.has(k)) {
      B.delete(k);
      pararAcao(k);
    }
  if (entraram.length && !primeiraLista) useHall.setState({ aviso: `${entraram.join(", ")} entrou no hall` });
  primeiraLista = false;
  publicar();
  brilhar(brilhos);
}

/* lembra a cena de cada nanico, para saber quem se teletransportou */
const cenaAntes = new Map<string, string | null>();

/** Troquei de cena (fui para um quarto ou voltei): a cena começa vazia e se monta de novo, com o meu brilho na chegada. */
function trocarCena() {
  /* sem terminarTudo: ele pararia o meu boneco no piso da cena antiga (e mudaria o hallPos de volta) */
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  B.clear();
  primeiraLista = true;
  sincronizar();
  const eu = B.get(MY_KEY);
  if (eu) brilhar([{ id: `${MY_KEY}:${Date.now()}:a`, i: eu.i, j: eu.j }]);
}

/** Um móvel do quarto caiu em cima de mim (o dono arrumando): vou para o piso livre mais perto. */
function sairDeBaixo() {
  const g = gradeCena();
  const b = B.get(MY_KEY);
  if (!cena() || !g || !b) return;
  const fim = b.fila.length ? b.fila[b.fila.length - 1] : b.alvo;
  const sentado = b.senta ?? b.vaiSentar;
  if (g.livre(fim.i, fim.j) && (!sentado || assentoDoQuarto(g, sentado))) return;
  const p = pisoLivreMaisPerto(fim, g);
  if (p) andarAte(p);
}

/* ---------- comandos ---------- */
/** Leva o meu boneco até o piso (e senta no assento `sentar`, que tem que sair daquele piso) e avisa a sala. */
export function andarAte(para: Piso, sentar: string | null = null) {
  const b = B.get(MY_KEY);
  const p = posCena(sentar ? { ...para, s: sentar } : para);
  if (!b || !p) return;
  const q = cena();
  /* no quarto, o destino leva o dono (`q`): só quem está vendo aquele quarto anima */
  if (rota(b, p, p.s ?? null)) enviar("hall", { para: p.s ? { i: p.i, j: p.j, s: p.s } : { i: p.i, j: p.j }, ...(q ? { q } : {}) });
}

/** Anda até um piso livre ao lado de `alvo` (o piso de alguém, conferido com a grade da cena). */
export function andarPerto(alvo: unknown) {
  const p = posCena(alvo);
  if (!p) return;
  const ok = livreCena();
  for (const [di, dj] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const q = { i: p.i + di, j: p.j + dj };
    if (ok(q.i, q.j)) return andarAte(q);
  }
}

/** Acenar, dançar ou deitar (acoes.ts): o meu boneco faz na hora e a cena vê pelo evento `hall`. */
export function fazerAcao(tipo: Acao) {
  if (!B.has(MY_KEY)) return;
  marcarAcao(MY_KEY, tipo);
  const q = cena();
  enviar("hall", { acao: tipo, ...(q ? { q } : {}) });
}

/** Estou escrevendo na barra do chat: a cena mostra o "…" em cima de mim (no máximo um aviso a cada 2,5 s). */
let ultimoDigita = 0;
export function avisarDigitando() {
  const agora = Date.now();
  if (agora - ultimoDigita < 2500 || !B.has(MY_KEY)) return;
  ultimoDigita = agora;
  const q = cena();
  enviar("hall", { digita: 1, ...(q ? { q } : {}) });
}

/** Setas do teclado: um piso a partir de onde o boneco vai parar. */
export function andarUmPiso(di: number, dj: number) {
  const b = B.get(MY_KEY);
  if (!b) return;
  const fim = b.fila.length ? b.fila[b.fila.length - 1] : b.alvo;
  andarAte({ i: fim.i + di, j: fim.j + dj });
}

/* o destino vem de outro navegador: confere tudo antes de andar */
const hallLimite = limitePorPessoa(8, 2000);
function onHall(m: Record<string, unknown>) {
  /* `q` = dono do quarto (sem ele, o K-FOFO): só anima quem está vendo a mesma cena, com a grade dela */
  const q = m.q === undefined || m.q === null ? null : typeof m.q === "string" && m.q.length <= 64 ? m.q : undefined;
  if (q === undefined || q !== cena()) return;
  /* uma ação (acenar, dançar, deitar) em vez de um destino */
  const acao = m.para === undefined ? lerAcao(m.acao) : null;
  const digita = m.para === undefined && m.digita === 1;
  if (acao || digita) {
    if (typeof m.from !== "string" || m.from === MY_KEY || !estaNaSala(m.from) || !hallLimite(m.from)) return;
    const k = chaveDoBoneco.get(m.from) ?? m.from;
    if (!B.has(k)) return;
    if (acao) marcarAcao(k, acao);
    else marcarDigitando(k);
    return;
  }
  const para = posCena(m.para);
  if (typeof m.from !== "string" || m.from === MY_KEY || !para) return;
  if (!estaNaSala(m.from) || !hallLimite(m.from)) return;
  /* qualquer aba daquele nanico move o mesmo boneco (inclusive uma outra aba minha move o meu) */
  const b = B.get(chaveDoBoneco.get(m.from) ?? m.from);
  if (b) rota(b, { i: para.i, j: para.j }, para.s ?? null);
}

let iniciado = false;
/** Liga o hall à sala (uma vez só). Chamado no login (`enterApp`) e pela aba ao montar. */
export function iniciarHall() {
  if (iniciado) return;
  iniciado = true;
  const salvo = local.json<unknown>("hall-pos");
  setApp({ hallPos: posValida(salvo) ? { i: salvo.i, j: salvo.j } : entradaSorteada() });
  aoReceber("hall", onHall);
  aoMudarPresenca(sincronizar);
  iniciarLoja();
  void iniciarQuartos();
  /* o dono arrumando com gente dentro: os móveis mudam na hora e quem ficou embaixo de um sai */
  useQuartos.subscribe((s, p) => {
    if (s.moveis === p.moveis && s.quartos === p.quartos) return;
    sairDeBaixo();
    if (cena()) sincronizar();
  });
  useApp.subscribe((s, p) => {
    if (s.meuQuarto !== p.meuQuarto) trocarCena();
    else if (s.fase !== p.fase || s.myName !== p.myName) sincronizar();
    if (s.aba !== p.aba && s.aba !== "hall") terminarTudo();
  });
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => document.hidden && terminarTudo());
  sincronizar();
}
