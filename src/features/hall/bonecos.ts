/*
 * Movimento dos bonecos no hall. Cada navegador calcula o caminho e anima sozinho:
 * pela sala só vão o destino (evento `hall`) e, na chegada, o piso na presença (`pos`).
 * O loop de animação só roda enquanto alguém anda e o hall está à vista.
 */
import { create } from "zustand";
import { aoMudarPresenca, aoReceber, enviar, estaNaSala, limitePorPessoa } from "@/lib/sala";
import { getApp, MY_KEY, setApp, useApp } from "@/lib/store";
import type { Presence } from "@/lib/tipos";
import { local, reduzMovimento } from "@/lib/util";
import { caminho, entradaDe, entradaSorteada, posValida, sentido, type Piso, type Sentido } from "./hall";

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
};

type Interno = Boneco & {
  /** piso de onde saiu e para onde vai no passo atual (parado: os dois iguais) */
  de: Piso;
  alvo: Piso;
  fila: Piso[];
  progresso: number;
  desde: number;
};

export const useHall = create<{ bonecos: Boneco[]; aviso: string }>()(() => ({ bonecos: [], aviso: "" }));

const B = new Map<string, Interno>();
/** pisos por segundo */
const VEL = 3;
const VEL_SEM_MOVIMENTO = 6;
/** troca de quadro do andar */
const QUADRO_MS = 120;

let primeiraLista = true;

const publicar = () =>
  useHall.setState({
    bonecos: [...B.values()].map(({ key, name, fid, i, j, sentido: s, quadro }) => ({ key, name, fid, i, j, sentido: s, quadro })),
  });

const visivel = () => getApp().aba === "hall" && typeof document !== "undefined" && !document.hidden;

function novo(key: string, name: string, fid: string | null, p: Piso): Interno {
  return { key, name, fid, i: p.i, j: p.j, sentido: "frente-direita", quadro: 0, de: { ...p }, alvo: { ...p }, fila: [], progresso: 0, desde: 0 };
}

/** Chegou ao fim do caminho: para no quadro "parado" e, se for o meu, avisa a presença. */
function parar(b: Interno) {
  b.de = { ...b.alvo };
  b.i = b.alvo.i;
  b.j = b.alvo.j;
  b.fila = [];
  b.progresso = 0;
  b.quadro = 0;
  if (b.key === MY_KEY) {
    const pos = { ...b.alvo };
    setApp({ hallPos: pos });
    local.setJson("hall-pos", pos);
  }
}

const andando = (b: Interno) => b.de.i !== b.alvo.i || b.de.j !== b.alvo.j;

/** Começa o próximo passo da fila (ou para, se acabou). */
function proximoPasso(b: Interno) {
  const prox = b.fila.shift();
  if (!prox) return parar(b);
  b.de = { ...b.alvo };
  b.alvo = prox;
  b.sentido = sentido(b.de, b.alvo, b.sentido);
}

/** Leva o boneco até `para`. Se estiver no meio de um passo, termina o passo e segue dali. */
function rota(b: Interno, para: Piso): boolean {
  const c = caminho(b.alvo, para);
  if (!c.length) return false;
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
      b.i = b.de.i + (b.alvo.i - b.de.i) * b.progresso;
      b.j = b.de.j + (b.alvo.j - b.de.j) * b.progresso;
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
function sincronizar() {
  const s = getApp();
  if (s.fase !== "app" || !s.myName) {
    /* saiu do site: o próximo login começa com o hall vazio */
    B.clear();
    primeiraLista = true;
    return publicar();
  }
  const lista: Pick<Presence, "key" | "name" | "fid" | "pos">[] = s.online.slice();
  /* eu apareço mesmo antes da presença chegar (ou se a sala cair) */
  if (!lista.some((p) => p.key === MY_KEY)) lista.push({ key: MY_KEY, name: s.myName, fid: s.myFid, pos: s.hallPos });
  const chaves = new Set<string>();
  const entraram: string[] = [];
  for (const p of lista) {
    chaves.add(p.key);
    const eu = p.key === MY_KEY;
    const pos = (eu ? s.hallPos : p.pos) || entradaDe(p.key);
    const b = B.get(p.key);
    if (!b) {
      B.set(p.key, novo(p.key, eu ? s.myName : p.name, eu ? s.myFid : p.fid, pos));
      if (!eu) entraram.push(p.name);
      continue;
    }
    b.name = eu ? s.myName : p.name;
    b.fid = eu ? s.myFid : p.fid;
    /* perdeu algum destino? a presença corrige, andando até o piso certo */
    if (!eu && p.pos && !andando(b) && (b.alvo.i !== p.pos.i || b.alvo.j !== p.pos.j)) rota(b, p.pos);
  }
  for (const k of [...B.keys()]) if (!chaves.has(k)) B.delete(k);
  if (entraram.length && !primeiraLista) useHall.setState({ aviso: `${entraram.join(", ")} entrou no hall` });
  primeiraLista = false;
  publicar();
}

/* ---------- comandos ---------- */
/** Leva o meu boneco até o piso e avisa a sala. */
export function andarAte(para: Piso) {
  const b = B.get(MY_KEY);
  if (!b || !posValida(para)) return;
  if (rota(b, para)) enviar("hall", { para: { i: para.i, j: para.j } });
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
  if (typeof m.from !== "string" || m.from === MY_KEY || !posValida(m.para)) return;
  if (!estaNaSala(m.from) || !hallLimite(m.from)) return;
  const b = B.get(m.from);
  if (b) rota(b, { i: m.para.i, j: m.para.j });
}

let iniciado = false;
/** Liga o hall à sala (uma vez só). Chamado pela aba ao montar, antes do login. */
export function iniciarHall() {
  if (iniciado) return;
  iniciado = true;
  const salvo = local.json<unknown>("hall-pos");
  setApp({ hallPos: posValida(salvo) ? { i: salvo.i, j: salvo.j } : entradaSorteada() });
  aoReceber("hall", onHall);
  aoMudarPresenca(sincronizar);
  useApp.subscribe((s, p) => {
    if (s.fase !== p.fase || s.myName !== p.myName) sincronizar();
    if (s.aba !== p.aba && s.aba !== "hall") terminarTudo();
  });
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => document.hidden && terminarTudo());
  sincronizar();
}
