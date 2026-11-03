"use client";
/*
 * Editor de story do InstaNanico, como o do Instagram: foto (arrasta e amplia) ou fundo colorido; textos com 5 estilos,
 * cores, fundo da letra e alinhamento, que se arrastam, crescem e giram (pinça com dois dedos; no computador a
 * rodinha amplia e Shift + rodinha gira); desenho com caneta, marca-texto, neon e borracha; figurinhas (emoji, menção,
 * hora e local); guias do centro e lixeira para apagar arrastando. Tocar na tela vazia escreve.
 * O story sai como uma imagem 1080×1920 desenhada com as mesmas regras (storyEditor.ts): o que se vê é o que sai.
 * Quem foi mencionado recebe no Direct "Mencionou você no story".
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { FUNDOS, recorte, type Fundo } from "./insta";
import { enviarMensagem, postarStory, useRede } from "./rede";
import {
  ALTURA_LINHA,
  encaixar,
  FONTES,
  horaAdesivo,
  LARGURA_TEXTO,
  limitarEscala,
  N_TINTAS,
  naLixeira,
  pinca,
  pontasDegrade,
  quebrarLinhas,
  STORY_H,
  STORY_W,
  textoVisivel,
  type Alinhar,
  type CaixaTexto,
  type Fonte,
  type Item,
  type ItemTexto,
  type Pincel,
  type Traco,
} from "./storyEditor";

/* ---------- ícones (traço, como os do Instagram) ---------- */
const Ic = ({ children, tam = 26 }: { children: ReactNode; tam?: number }) => (
  <svg viewBox="0 0 24 24" width={tam} height={tam} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IcFechar = () => (
  <Ic>
    <path d="M5 5l14 14M19 5 5 19" />
  </Ic>
);
const IcFigurinha = () => (
  <Ic>
    <path d="M14 21H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z" />
    <path d="M21 14h-4a3 3 0 0 0-3 3v4" />
    <path d="M8.5 13.5s1.2 1.5 3.5 1.5M9 9h.01M15 9h.01" strokeWidth={2.4} />
  </Ic>
);
const IcRabisco = () => (
  <Ic>
    <path d="M3 17c3-6 6-9 8-8s-3 7-1 8 5-6 7-5 1 4 4 3" />
  </Ic>
);
const IcGaleria = () => (
  <Ic>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-5-5L5 21" />
  </Ic>
);
const IcDesfazer = () => (
  <Ic>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Ic>
);
const IcLixo = () => (
  <Ic tam={24}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Ic>
);
const IcSeta = () => (
  <Ic tam={20}>
    <path d="m9 5 7 7-7 7" />
  </Ic>
);
const IcAlinhar = ({ a }: { a: Alinhar }) => (
  <Ic tam={22}>
    {a === "center" ? <path d="M4 6h16M7 10h10M4 14h16M7 18h10" /> : a === "left" ? <path d="M4 6h16M4 10h10M4 14h16M4 18h10" /> : <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />}
  </Ic>
);

/* ---------- cores e fontes (lidas do CSS, para o canvas desenhar igual) ---------- */
const TINTA = (i: number) => `var(--ig-tinta-${i})`;
/** fundos coloridos do story de texto: as duas cores do degradê de 160° (como .f-roxo etc.) */
const DEGRADE: Record<Fundo, [string, string]> = {
  roxo: ["--ig-roxo", "--ig-a3"],
  laranja: ["--ig-a1", "--ig-laranja"],
  verde: ["--ig-verde", "--ig-azul2"],
  azul: ["--ig-azul2", "--ig-a4"],
  preto: ["--ig-preto", "--ig-campo"],
};
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"Courier New",monospace';

type Familias = { body: string; display: string };
function fonteDe(fonte: Fonte, px: number, fam: Familias) {
  switch (fonte) {
    case "moderna":
      return `700 ${px}px ${fam.display}`;
    case "neon":
      return `600 ${px}px ${fam.body}`;
    case "maquina":
      return `500 ${px}px ${MONO}`;
    case "forte":
      return `italic 900 ${px}px ${fam.body}`;
    default:
      return `700 ${px}px ${fam.body}`;
  }
}
/** Cor da letra e do fundo da letra (texto claro em fundo escuro e vice-versa). */
function coresTexto(it: Pick<ItemTexto, "cor" | "caixa">) {
  const clara = it.cor === 0 || it.cor === 4; /* branco e amarelo */
  if (it.caixa === "cor") return { letra: clara ? 1 : 0, caixa: it.cor };
  if (it.caixa === "clara") return { letra: it.cor === 0 ? 1 : it.cor, caixa: 0 };
  return { letra: it.cor, caixa: null as number | null };
}

/* um canvas só para medir texto (fora do React) */
let ctxMedir: CanvasRenderingContext2D | null | undefined;
function medirTexto(fonte: string, t: string) {
  if (ctxMedir === undefined) ctxMedir = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!ctxMedir) return t.length * 10;
  ctxMedir.font = fonte;
  return ctxMedir.measureText(t).width;
}

/** As fontes do site (lidas do CSS) e o medidor de texto. */
function useMedidor(raiz: React.RefObject<HTMLElement | null>) {
  const [fam, setFam] = useState<Familias>({ body: "system-ui, sans-serif", display: "system-ui, sans-serif" });
  useEffect(() => {
    const cs = getComputedStyle(raiz.current ?? document.documentElement);
    const body = cs.getPropertyValue("--body").trim() || "system-ui, sans-serif";
    const display = cs.getPropertyValue("--display").trim() || body;
    /* as fontes do site podem ainda estar chegando: mede de novo quando chegam */
    const pronto = () => setFam({ body, display });
    pronto();
    void document.fonts?.ready.then(pronto);
  }, [raiz]);
  return { fam, medir: medirTexto };
}

/** Linhas de um texto, já quebradas na largura do story. */
function linhasDe(it: ItemTexto, fam: Familias, medir: (f: string, t: string) => number) {
  const f = fonteDe(it.fonte, it.tamanho, fam);
  return quebrarLinhas(textoVisivel(it), LARGURA_TEXTO, (t) => medir(f, t));
}

/* ---------- desenhar (o mesmo código pinta a tela do editor e a imagem final) ---------- */
function tintaHex(raiz: HTMLElement, i: number) {
  return getComputedStyle(raiz).getPropertyValue(`--ig-tinta-${i}`).trim() || "#FFFFFF";
}
function desenharTracos(ctx: CanvasRenderingContext2D, tracos: Traco[], k: number, cor: (i: number) => string) {
  for (const t of tracos) {
    if (t.pontos.length < 2) continue;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = t.pincel === "marca" ? "butt" : "round";
    const linha = () => {
      ctx.beginPath();
      ctx.moveTo(t.pontos[0] * k, t.pontos[1] * k);
      if (t.pontos.length === 2) ctx.lineTo(t.pontos[0] * k + 0.1, t.pontos[1] * k);
      for (let i = 2; i < t.pontos.length; i += 2) ctx.lineTo(t.pontos[i] * k, t.pontos[i + 1] * k);
      ctx.stroke();
    };
    if (t.pincel === "borracha") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = t.tam * 2.2 * k;
      ctx.strokeStyle = "#000";
      linha();
    } else if (t.pincel === "marca") {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = t.tam * 2.4 * k;
      ctx.strokeStyle = cor(t.cor);
      linha();
    } else if (t.pincel === "neon") {
      ctx.shadowColor = cor(t.cor);
      ctx.shadowBlur = t.tam * 2 * k;
      ctx.lineWidth = t.tam * k;
      ctx.strokeStyle = cor(t.cor);
      linha();
      ctx.shadowBlur = 0;
      ctx.lineWidth = t.tam * 0.45 * k;
      ctx.strokeStyle = cor(0);
      linha();
    } else {
      ctx.lineWidth = t.tam * k;
      ctx.strokeStyle = cor(t.cor);
      linha();
    }
    ctx.restore();
  }
}

function caixaArredondada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/* figurinhas: medidas em pontos de story (iguais no editor, pelo CSS em em, e na imagem) */
const ADESIVO = { mencao: 64, hora: 120, local: 60, emoji: 200 };

function desenharItem(ctx: CanvasRenderingContext2D, it: Item, fam: Familias, medir: (f: string, t: string) => number, cor: (i: number) => string) {
  ctx.save();
  ctx.translate(it.x * STORY_W, it.y * STORY_H);
  ctx.rotate(it.rot);
  ctx.scale(it.escala, it.escala);
  ctx.textBaseline = "middle";
  if (it.tipo === "texto") {
    const s = it.tamanho;
    const fonte = fonteDe(it.fonte, s, fam);
    const linhas = linhasDe(it, fam, medir);
    const lh = s * ALTURA_LINHA,
      pad = s * 0.32;
    const larg = linhas.map((l) => medir(fonte, l));
    const bloco = Math.max(...larg, 0) + pad * 2;
    const altura = linhas.length * lh;
    const c = coresTexto(it);
    ctx.font = fonte;
    linhas.forEach((l, i) => {
      const w = larg[i];
      const y = -altura / 2 + i * lh;
      const x = it.alinhar === "left" ? -bloco / 2 + pad : it.alinhar === "right" ? bloco / 2 - pad - w : -w / 2;
      if (c.caixa !== null && l) {
        ctx.fillStyle = cor(c.caixa);
        caixaArredondada(ctx, x - pad, y, w + pad * 2, lh, s * 0.22);
      }
      ctx.fillStyle = cor(c.letra);
      if (it.fonte === "neon" && c.caixa === null) {
        ctx.shadowColor = cor(it.cor);
        ctx.shadowBlur = s * 0.45;
        ctx.fillText(l, x, y + lh / 2);
        ctx.fillText(l, x, y + lh / 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = cor(0);
        ctx.globalAlpha = 0.85;
        ctx.fillText(l, x, y + lh / 2);
        ctx.globalAlpha = 1;
      } else {
        if (c.caixa === null) {
          ctx.shadowColor = "rgba(0,0,0,.25)";
          ctx.shadowBlur = s * 0.12;
        }
        ctx.fillText(l, x, y + lh / 2);
        ctx.shadowBlur = 0;
      }
    });
  } else if (it.tipo === "emoji") {
    ctx.font = `${ADESIVO.emoji}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(it.emoji, 0, 0);
  } else {
    const s = ADESIVO[it.tipo];
    const texto = it.tipo === "mencao" ? `@${it.nome}`.toLocaleUpperCase("pt-BR") : it.tipo === "local" ? `📍 ${it.texto}`.toLocaleUpperCase("pt-BR") : it.texto;
    const fonte = it.tipo === "hora" ? `700 ${s}px ${fam.display}` : `800 ${s}px ${fam.body}`;
    ctx.font = fonte;
    const w = medir(fonte, texto);
    const px = s * 0.5,
      py = s * 0.32,
      h = s * 1.2 + py * 2;
    ctx.fillStyle = cor(0);
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = s * 0.3;
    caixaArredondada(ctx, -w / 2 - px, -h / 2, w + px * 2, h, s * 0.4);
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    if (it.tipo === "hora") ctx.fillStyle = cor(1);
    else {
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, cor(it.tipo === "mencao" ? 8 : 7));
      g.addColorStop(1, cor(it.tipo === "mencao" ? 3 : 6));
      ctx.fillStyle = g;
    }
    ctx.fillText(texto, 0, 2);
  }
  ctx.restore();
}

/* ---------- um item na tela do editor ---------- */
function ItemNaTela({
  it,
  k,
  fam,
  medir,
  escondido,
  onPointerDown,
}: {
  it: Item;
  k: number;
  fam: Familias;
  medir: (f: string, t: string) => number;
  escondido?: boolean;
  onPointerDown: (e: React.PointerEvent, id: number) => void;
}) {
  const estilo: React.CSSProperties = {
    left: `${it.x * 100}%`,
    top: `${it.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${it.rot}rad) scale(${it.escala})`,
    visibility: escondido ? "hidden" : undefined,
  };
  let conteudo: ReactNode;
  if (it.tipo === "texto") {
    const linhas = linhasDe(it, fam, medir);
    const c = coresTexto(it);
    conteudo = (
      <div
        className={"se-texto" + (it.fonte === "neon" && c.caixa === null ? " neon" : "") + (c.caixa === null ? " sem-caixa" : "")}
        style={{
          font: fonteDe(it.fonte, it.tamanho * k, fam),
          textAlign: it.alinhar,
          alignItems: it.alinhar === "left" ? "flex-start" : it.alinhar === "right" ? "flex-end" : "center",
          color: TINTA(c.letra),
          ["--brilho" as string]: TINTA(it.cor),
          ["--caixa" as string]: c.caixa === null ? "transparent" : TINTA(c.caixa),
        }}
      >
        {linhas.map((l, i) => (
          <span key={i}>{l || " "}</span>
        ))}
      </div>
    );
  } else if (it.tipo === "emoji") conteudo = <span className="se-emoji" style={{ fontSize: ADESIVO.emoji * k }}>{it.emoji}</span>;
  else
    conteudo = (
      <span className={"se-adesivo " + it.tipo} style={{ fontSize: ADESIVO[it.tipo] * k, fontFamily: it.tipo === "hora" ? fam.display : fam.body }}>
        {it.tipo === "mencao" ? `@${it.nome}` : it.tipo === "local" ? `📍 ${it.texto}` : it.texto}
      </span>
    );
  return (
    <div className="se-item" data-item={it.id} style={estilo} onPointerDown={(e) => onPointerDown(e, it.id)}>
      {conteudo}
    </div>
  );
}

const EMOJIS = ["😂", "🔥", "😍", "🥹", "😎", "🤡", "💀", "👀", "🍻", "🥩", "🎮", "🏆", "⚽", "🎰", "💸", "❤️", "💜", "👑", "🤝", "🙏", "😭", "😡", "🤯", "🥳", "🍕", "🚬", "🧉", "🏖️", "🌙", "✨"];

type Gesto =
  | { alvo: "item"; id: number; x0: number; y0: number; ini: Item; moveu: boolean; t0: number; par?: { a0: { x: number; y: number }; b0: { x: number; y: number }; ini: Item } }
  | { alvo: "foto"; x0: number; y0: number; ini: { z: number; dx: number; dy: number }; moveu: boolean; t0: number; par?: { a0: { x: number; y: number }; b0: { x: number; y: number }; ini: { z: number; dx: number; dy: number } } };

/** Um item sem a posição (a figurinha nova nasce no meio). */
type SemLugar = Item extends infer T ? (T extends Item ? Omit<T, "id" | "x" | "y" | "escala" | "rot"> : never) : never;

let seq = 1;
const novoTexto = (): ItemTexto => ({ id: seq++, tipo: "texto", texto: "", fonte: "classica", cor: 0, caixa: "nada", alinhar: "center", tamanho: 84, x: 0.5, y: 0.42, escala: 1, rot: 0 });

/** O editor inteiro (por cima da tela do app). `fechar` sai sem postar; `postou` depois de publicar. */
export function EditorStory({ fechar, postou, irParaPost }: { fechar: () => void; postou: () => void; irParaPost?: () => void }) {
  const eu = useApp((s) => s.myUid);
  const friends = useApp((s) => s.friends);
  const enviando = useRede((s) => s.enviando);
  const raiz = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { fam, medir } = useMedidor(raiz);

  const [W, setW] = useState(0);
  const k = W / STORY_W;
  const [foto, setFoto] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const [fotoPos, setFotoPos] = useState({ z: 1, dx: 0, dy: 0 });
  const [fundo, setFundo] = useState<Fundo>("roxo");
  const [itens, setItens] = useState<Item[]>([]);
  const [tracos, setTracos] = useState<Traco[]>([]);
  const [modo, setModo] = useState<"livre" | "texto" | "desenho" | "figurinhas" | "mencao">("livre");
  const [editando, setEditando] = useState<ItemTexto | null>(null);
  const [arraste, setArraste] = useState<{ id: number; lixo: boolean; gv: boolean; gh: boolean } | null>(null);
  const [pincel, setPincel] = useState<{ tipo: Pincel; cor: number; tam: number }>({ tipo: "caneta", cor: 0, tam: 14 });
  const [descartar, setDescartar] = useState(false);
  const [vivo, setVivo] = useState<Traco | null>(null);

  /* tamanho da tela do story (9:16) */
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const ler = () => setW(el.clientWidth);
    ler();
    const ro = new ResizeObserver(ler);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* a foto escolhida (o endereço é solto quando ela sai) */
  useEffect(
    () => () => {
      if (foto) URL.revokeObjectURL(foto.url);
    },
    [foto],
  );
  const escolherFoto = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Escolha uma imagem.");
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setFoto({ url, img });
      setFotoPos({ z: 1, dx: 0, dy: 0 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast("Não deu para abrir essa imagem.");
    };
    img.src = url;
  };

  /* desenho na tela do editor (o mesmo da imagem final, em escala) */
  const cor = useCallback((i: number) => (raiz.current ? tintaHex(raiz.current, i) : "#FFFFFF"), []);
  useEffect(() => {
    const cv = tela.current;
    if (!cv || !W) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const H = (W * STORY_H) / STORY_W;
    if (cv.width !== Math.round(W * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    desenharTracos(g, vivo ? [...tracos, vivo] : tracos, k, cor);
  }, [tracos, vivo, W, k, cor]);

  const mexeu = itens.length > 0 || tracos.length > 0 || !!foto;

  /* ---------- gestos: arrastar, pinça, tocar ---------- */
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<Gesto | null>(null);
  const lixoRef = useRef(false);
  const itensRef = useRef(itens);
  useEffect(() => {
    itensRef.current = itens;
  }, [itens]);
  const fotoRef = useRef(fotoPos);
  useEffect(() => {
    fotoRef.current = fotoPos;
  }, [fotoPos]);

  const prenderFoto = useCallback(
    (p: { z: number; dx: number; dy: number }) => {
      if (!foto) return p;
      const r = recorte({ w: foto.img.naturalWidth, h: foto.img.naturalHeight }, { W: STORY_W, H: STORY_H }, p.z, p.dx, p.dy);
      return { z: Math.min(4, Math.max(1, p.z)), dx: r.dx, dy: r.dy };
    },
    [foto],
  );

  const iniciar = (e: React.PointerEvent, id: number | null) => {
    if (modo !== "livre") return;
    e.stopPropagation();
    try {
      palco.current?.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura, segue enquanto o dedo está em cima */
    }
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (dedos.current.size === 2 && g) {
      const [a, b] = [...dedos.current.values()];
      if (g.alvo === "item") {
        const it = itensRef.current.find((x) => x.id === g.id);
        if (it) g.par = { a0: a, b0: b, ini: it };
      } else g.par = { a0: a, b0: b, ini: fotoRef.current };
      g.moveu = true;
      return;
    }
    if (dedos.current.size > 1) return;
    const it = id !== null ? itensRef.current.find((x) => x.id === id) : undefined;
    if (it) {
      /* o tocado vem para a frente */
      setItens((l) => [...l.filter((x) => x.id !== it.id), it]);
      gesto.current = { alvo: "item", id: it.id, x0: e.clientX, y0: e.clientY, ini: it, moveu: false, t0: e.timeStamp };
    } else gesto.current = { alvo: "foto", x0: e.clientX, y0: e.clientY, ini: fotoRef.current, moveu: false, t0: e.timeStamp };
  };

  const mover = (e: React.PointerEvent) => {
    if (modo === "desenho") return desenharMove(e);
    if (!dedos.current.has(e.pointerId)) return;
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (!g || !W) return;
    const H = (W * STORY_H) / STORY_W;
    if (g.par && dedos.current.size >= 2) {
      const [a, b] = [...dedos.current.values()];
      const p = pinca(g.par.a0, g.par.b0, a, b);
      if (g.alvo === "item") {
        const ini = g.par.ini as Item;
        setItens((l) => l.map((x) => (x.id === g.id ? { ...x, escala: limitarEscala(ini.escala * p.escala), rot: ini.rot + p.giro } : x)));
      } else if (foto) {
        const ini = g.par.ini as { z: number; dx: number; dy: number };
        setFotoPos(prenderFoto({ ...ini, z: ini.z * p.escala }));
      }
      return;
    }
    const dx = e.clientX - g.x0,
      dy = e.clientY - g.y0;
    if (!g.moveu && Math.hypot(dx, dy) > 6) g.moveu = true;
    if (!g.moveu) return;
    if (g.alvo === "item") {
      const sx = encaixar(g.ini.x + dx / W),
        sy = encaixar(g.ini.y + dy / H);
      const caixa = palco.current!.getBoundingClientRect();
      const lixo = naLixeira((e.clientX - caixa.left) / W, (e.clientY - caixa.top) / H);
      lixoRef.current = lixo;
      setArraste({ id: g.id, lixo, gv: sx.grudou, gh: sy.grudou });
      setItens((l) => l.map((x) => (x.id === g.id ? { ...x, x: sx.v, y: sy.v } : x)));
    } else if (foto) setFotoPos(prenderFoto({ ...g.ini, dx: g.ini.dx + dx / k, dy: g.ini.dy + dy / k }));
  };

  const soltar = (e: React.PointerEvent) => {
    if (modo === "desenho") return desenharFim();
    if (!dedos.current.has(e.pointerId)) return;
    dedos.current.delete(e.pointerId);
    const g = gesto.current;
    if (dedos.current.size > 0) {
      /* tirou um dos dois dedos: o que ficou recomeça daqui (sem pular) */
      if (g) {
        const [r] = [...dedos.current.values()];
        g.par = undefined;
        g.x0 = r.x;
        g.y0 = r.y;
        if (g.alvo === "item") {
          const it = itensRef.current.find((x) => x.id === g.id);
          if (it) g.ini = it;
        } else g.ini = fotoRef.current;
      }
      return;
    }
    gesto.current = null;
    /* lido da ref: entre o último movimento e o soltar pode não ter dado tempo de redesenhar */
    const lixo = lixoRef.current;
    lixoRef.current = false;
    setArraste(null);
    if (!g) return;
    if (g.alvo === "item") {
      if (g.moveu && lixo) setItens((l) => l.filter((x) => x.id !== g.id));
      else if (!g.moveu && e.timeStamp - g.t0 < 400) {
        const it = itensRef.current.find((x) => x.id === g.id);
        if (it?.tipo === "texto") abrirTexto(it);
      }
    } else if (!g.moveu && e.timeStamp - g.t0 < 400) abrirTexto(null);
  };

  /* rodinha do mouse: amplia o item embaixo do cursor (Shift gira) ou a foto */
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      if (modo !== "livre") return;
      e.preventDefault();
      const alvo = (e.target as HTMLElement).closest?.("[data-item]") as HTMLElement | null;
      const id = alvo ? Number(alvo.dataset.item) : null;
      if (id !== null) {
        setItens((l) => l.map((x) => (x.id === id ? (e.shiftKey ? { ...x, rot: x.rot + e.deltaY * 0.004 } : { ...x, escala: limitarEscala(x.escala * Math.exp(-e.deltaY * 0.0015)) }) : x)));
      } else if (foto) setFotoPos((p) => prenderFoto({ ...p, z: p.z * Math.exp(-e.deltaY * 0.0015) }));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [modo, foto, prenderFoto]);

  /* ---------- texto ---------- */
  function abrirTexto(it: ItemTexto | null) {
    setEditando(it ?? novoTexto());
    setModo("texto");
  }
  function concluirTexto() {
    const t = editando;
    setModo("livre");
    setEditando(null);
    if (!t) return;
    const vazio = !t.texto.trim();
    setItens((l) => {
      const sem = l.filter((x) => x.id !== t.id);
      return vazio ? sem : [...sem, { ...t, texto: t.texto.replace(/\s+$/, "") }];
    });
  }

  /* ---------- desenho ---------- */
  const desenhando = useRef(false);
  const ponto = (e: React.PointerEvent) => {
    const r = palco.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / k) * 10) / 10, Math.round(((e.clientY - r.top) / k) * 10) / 10];
  };
  const desenharIni = (e: React.PointerEvent) => {
    if (modo !== "desenho" || !k) return;
    try {
      palco.current?.setPointerCapture(e.pointerId);
    } catch {
      /* segue sem captura */
    }
    desenhando.current = true;
    setVivo({ pincel: pincel.tipo, cor: pincel.cor, tam: pincel.tam, pontos: ponto(e) });
  };
  function desenharMove(e: React.PointerEvent) {
    if (!desenhando.current) return;
    const [x, y] = ponto(e);
    setVivo((v) => (v ? { ...v, pontos: [...v.pontos, x, y] } : v));
  }
  function desenharFim() {
    if (!desenhando.current) return;
    desenhando.current = false;
    setVivo((v) => {
      if (v) setTracos((l) => [...l, v]);
      return null;
    });
  }

  /* ---------- figurinhas ---------- */
  const adicionar = (it: SemLugar) => {
    setItens((l) => [...l, { ...it, id: seq++, x: 0.5, y: 0.45, escala: 1, rot: 0 } as Item]);
    setModo("livre");
  };

  /* ---------- publicar ---------- */
  async function gerar(): Promise<File | null> {
    if (!raiz.current) return null;
    await document.fonts?.ready;
    const cv = document.createElement("canvas");
    cv.width = STORY_W;
    cv.height = STORY_H;
    const g = cv.getContext("2d");
    if (!g) return null;
    if (foto) {
      const r = recorte({ w: foto.img.naturalWidth, h: foto.img.naturalHeight }, { W: STORY_W, H: STORY_H }, fotoPos.z, fotoPos.dx, fotoPos.dy);
      g.fillStyle = cor(1);
      g.fillRect(0, 0, STORY_W, STORY_H);
      g.drawImage(foto.img, r.x, r.y, r.largura, r.altura, 0, 0, STORY_W, STORY_H);
    } else {
      const cs = getComputedStyle(raiz.current);
      const p = pontasDegrade(160, STORY_W, STORY_H);
      const gr = g.createLinearGradient(p.x0, p.y0, p.x1, p.y1);
      gr.addColorStop(0, cs.getPropertyValue(DEGRADE[fundo][0]).trim() || "#7B2FF7");
      gr.addColorStop(1, cs.getPropertyValue(DEGRADE[fundo][1]).trim() || "#D62976");
      g.fillStyle = gr;
      g.fillRect(0, 0, STORY_W, STORY_H);
    }
    if (tracos.length) {
      const camada = document.createElement("canvas");
      camada.width = STORY_W;
      camada.height = STORY_H;
      const c2 = camada.getContext("2d");
      if (c2) {
        desenharTracos(c2, tracos, 1, cor);
        g.drawImage(camada, 0, 0);
      }
    }
    for (const it of itens) desenharItem(g, it, fam, medir, cor);
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/webp", 0.9));
    return blob ? new File([blob], "story.webp", { type: "image/webp" }) : null;
  }

  async function publicar() {
    if (enviando) return;
    if (!mexeu) {
      /* story só com a cor: ainda precisa de algo para mostrar */
      toast("Escreva algo, desenhe ou escolha uma foto.");
      return;
    }
    const arquivo = await gerar();
    if (!arquivo) return toast("Não deu para montar o story.");
    const id = await postarStory(arquivo, "", fundo);
    if (id === null) return;
    /* quem foi mencionado fica sabendo pelo Direct, como no Instagram */
    const mencionados = [...new Set(itens.filter((x) => x.tipo === "mencao").map((x) => (x.tipo === "mencao" ? x.userId : "")))].filter((u) => u && u !== eu);
    for (const u of mencionados) void enviarMensagem(u, "Mencionou você no story", id ? { storyId: id } : {});
    postou();
  }

  const H = (W * STORY_H) / STORY_W;
  const rf = foto && W ? recorte({ w: foto.img.naturalWidth, h: foto.img.naturalHeight }, { W, H }, fotoPos.z, fotoPos.dx * k, fotoPos.dy * k) : null;
  const nanicos = friends.filter((f) => f.user_id && f.user_id !== eu);

  return (
    <div ref={raiz} className="se" role="dialog" aria-label="Criar story">
      <div className="se-area">
        <div
          ref={palco}
          className={"se-palco" + (foto ? "" : " f-" + fundo) + (modo === "desenho" ? " desenhando" : "")}
          onPointerDown={(e) => (modo === "desenho" ? desenharIni(e) : iniciar(e, null))}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          {foto && rf && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="se-foto"
              src={foto.url}
              alt=""
              draggable={false}
              style={{ width: foto.img.naturalWidth * rf.escala, height: foto.img.naturalHeight * rf.escala, transform: `translate(calc(-50% + ${rf.dx}px), calc(-50% + ${rf.dy}px))` }}
            />
          )}
          <canvas ref={tela} className="se-tela" aria-hidden="true" />
          {itens.map((it) => (
            <ItemNaTela key={it.id} it={it} k={k} fam={fam} medir={medir} escondido={modo === "texto" && editando?.id === it.id} onPointerDown={iniciar} />
          ))}
          {arraste?.gv && <span className="se-guia v" aria-hidden="true" />}
          {arraste?.gh && <span className="se-guia h" aria-hidden="true" />}
          {arraste && (
            <span className={"se-lixo" + (arraste.lixo ? " on" : "")} aria-hidden="true">
              <IcLixo />
            </span>
          )}

          {/* ---------- barra de cima (some enquanto arrasta, como no Instagram) ---------- */}
          {modo === "livre" && !arraste && (
            <>
              <div className="se-topo">
                <button
                  type="button"
                  className="se-redondo"
                  aria-label={descartar ? "Descartar o story" : "Fechar"}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (!mexeu || descartar) return fechar();
                    setDescartar(true);
                    setTimeout(() => setDescartar(false), 3000);
                  }}
                >
                  {descartar ? <b className="se-descartar">Descartar?</b> : <IcFechar />}
                </button>
                <span className="se-espaco" />
                <div className="se-ferramentas" onPointerDown={(e) => e.stopPropagation()}>
                  <button type="button" className="se-redondo" aria-label="Texto" title="Texto" onClick={() => abrirTexto(null)}>
                    <b className="se-aa">Aa</b>
                  </button>
                  <button type="button" className="se-redondo" aria-label="Figurinhas" title="Figurinhas" onClick={() => setModo("figurinhas")}>
                    <IcFigurinha />
                  </button>
                  <button type="button" className="se-redondo" aria-label="Desenhar" title="Desenhar" onClick={() => setModo("desenho")}>
                    <IcRabisco />
                  </button>
                  {!foto && (
                    <button
                      type="button"
                      className={"se-redondo se-cor-fundo f-" + FUNDOS[(FUNDOS.indexOf(fundo) + 1) % FUNDOS.length]}
                      aria-label="Trocar a cor do fundo"
                      title="Cor do fundo"
                      onClick={() => setFundo(FUNDOS[(FUNDOS.indexOf(fundo) + 1) % FUNDOS.length])}
                    />
                  )}
                </div>
              </div>
              {!mexeu && (
                <p className="se-dica" aria-hidden="true">
                  Toque para escrever
                </p>
              )}
            </>
          )}

          {/* ---------- desenho ---------- */}
          {modo === "desenho" && (
            <div className="se-camada-ui" onPointerDown={(e) => e.stopPropagation()}>
              <div className="se-topo">
                <button type="button" className="se-redondo" aria-label="Desfazer o último traço" disabled={!tracos.length} onClick={() => setTracos((l) => l.slice(0, -1))}>
                  <IcDesfazer />
                </button>
                <span className="se-espaco" />
                <div className="se-pinceis" role="radiogroup" aria-label="Pincel">
                  {(["caneta", "marca", "neon", "borracha"] as Pincel[]).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={pincel.tipo === p} aria-label={{ caneta: "Caneta", marca: "Marca-texto", neon: "Neon", borracha: "Borracha" }[p]} className={"se-pincel " + p} onClick={() => setPincel((x) => ({ ...x, tipo: p }))}>
                      <i />
                    </button>
                  ))}
                </div>
                <span className="se-espaco" />
                <button type="button" className="se-concluir" onClick={() => setModo("livre")}>
                  Concluir
                </button>
              </div>
              <label className="se-tamanho">
                <input type="range" min={4} max={40} value={pincel.tam} aria-label="Grossura do traço" onChange={(e) => setPincel((x) => ({ ...x, tam: Number(e.target.value) }))} />
              </label>
              <Paleta valor={pincel.cor} onChange={(c) => setPincel((x) => ({ ...x, cor: c, tipo: x.tipo === "borracha" ? "caneta" : x.tipo }))} />
            </div>
          )}

          {/* ---------- texto sendo escrito ---------- */}
          {modo === "texto" && editando && (
            <EditorTexto
              t={editando}
              k={k}
              fam={fam}
              mudar={(p) => setEditando((x) => (x ? { ...x, ...p } : x))}
              concluir={concluirTexto}
            />
          )}
        </div>
      </div>

      {/* ---------- embaixo: galeria e publicar ---------- */}
      {modo === "livre" && (
        <div className="se-pe">
          <button type="button" className="se-galeria" aria-label={foto ? "Trocar a foto" : "Escolher uma foto"} onClick={() => input.current?.click()}>
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto.url} alt="" />
            ) : (
              <IcGaleria />
            )}
          </button>
          {foto && (
            <button type="button" className="se-tirar-foto" onClick={() => setFoto(null)}>
              Tirar a foto
            </button>
          )}
          <span className="se-espaco" />
          <button type="button" className="se-publicar" disabled={enviando} onClick={() => void publicar()}>
            {eu && <Avatar f={friends.find((f) => f.user_id === eu) ?? null} className="se-publicar-rosto" />}
            {enviando ? "Postando…" : "Seu story"}
            <IcSeta />
          </button>
        </div>
      )}
      {modo === "livre" && irParaPost && !mexeu && (
        <div className="se-modos" role="radiogroup" aria-label="Publicar como">
          <button type="button" role="radio" aria-checked={false} onClick={irParaPost}>
            PUBLICAÇÃO
          </button>
          <button type="button" role="radio" aria-checked={true} className="on">
            STORY
          </button>
        </div>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => escolherFoto(e.target.files?.[0])} />

      {/* ---------- figurinhas ---------- */}
      {(modo === "figurinhas" || modo === "mencao") && (
        <div className="se-folha-fundo" onPointerDown={(e) => e.target === e.currentTarget && setModo("livre")}>
          <section className="se-folha" aria-label={modo === "mencao" ? "Mencionar um nanico" : "Figurinhas"}>
            <span className="se-alca" aria-hidden="true" />
            {modo === "mencao" ? (
              <>
                <h3>Mencionar</h3>
                <ul className="se-gente">
                  {nanicos.map((f) => (
                    <li key={f.user_id}>
                      <button type="button" onClick={() => adicionar({ tipo: "mencao", userId: f.user_id!, nome: f.name.toLocaleLowerCase("pt-BR").replace(/\s+/g, "") })}>
                        <Avatar f={f} className="se-gente-rosto" />
                        <span>{f.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div className="se-adesivos">
                  <button type="button" className="se-adesivo mencao" onClick={() => setModo("mencao")}>
                    @MENÇÃO
                  </button>
                  <button type="button" className="se-adesivo hora" onClick={() => adicionar({ tipo: "hora", texto: horaAdesivo(new Date()) })}>
                    {horaAdesivo(new Date())}
                  </button>
                  <button type="button" className="se-adesivo local" onClick={() => adicionar({ tipo: "local", texto: "K-FOFO" })}>
                    📍 K-FOFO
                  </button>
                </div>
                <div className="se-emojis">
                  {EMOJIS.map((em) => (
                    <button key={em} type="button" aria-label={`Figurinha ${em}`} onClick={() => adicionar({ tipo: "emoji", emoji: em })}>
                      {em}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------- paleta de cores (a mesma do texto e do desenho) ---------- */
function Paleta({ valor, onChange }: { valor: number; onChange: (c: number) => void }) {
  return (
    <div className="se-paleta" role="radiogroup" aria-label="Cor">
      {Array.from({ length: N_TINTAS }, (_, i) => (
        <button key={i} type="button" role="radio" aria-checked={valor === i} aria-label={`Cor ${i + 1}`} style={{ background: TINTA(i) }} onClick={() => onChange(i)} />
      ))}
    </div>
  );
}

/* ---------- escrevendo um texto ---------- */
function EditorTexto({ t, k, fam, mudar, concluir }: { t: ItemTexto; k: number; fam: Familias; mudar: (p: Partial<ItemTexto>) => void; concluir: () => void }) {
  const campo = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  /* a caixa do texto cresce com ele */
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [t.texto, t.tamanho, t.fonte, k]);
  const c = coresTexto(t);
  const proximaCaixa: Record<CaixaTexto, CaixaTexto> = { nada: "cor", cor: "clara", clara: "nada" };
  const proximoAlinhar: Record<Alinhar, Alinhar> = { center: "left", left: "right", right: "center" };
  return (
    <div className="se-escrevendo" onPointerDown={(e) => e.stopPropagation()}>
      <div className="se-topo">
        <button type="button" className="se-redondo" aria-label="Alinhamento" onClick={() => mudar({ alinhar: proximoAlinhar[t.alinhar] })}>
          <IcAlinhar a={t.alinhar} />
        </button>
        <button type="button" className={"se-redondo se-btn-caixa " + t.caixa} aria-label="Fundo da letra" onClick={() => mudar({ caixa: proximaCaixa[t.caixa] })}>
          <b>A</b>
        </button>
        <span className="se-espaco" />
        <button type="button" className="se-concluir" onClick={concluir}>
          Concluir
        </button>
      </div>
      <label className="se-tamanho">
        <input type="range" min={40} max={180} value={t.tamanho} aria-label="Tamanho da letra" onChange={(e) => mudar({ tamanho: Number(e.target.value) })} />
      </label>
      <div className="se-campo-area" onPointerDown={(e) => e.target === e.currentTarget && concluir()}>
        <textarea
          ref={campo}
          className={"se-campo" + (t.fonte === "neon" && c.caixa === null ? " neon" : "")}
          value={t.texto}
          rows={1}
          maxLength={300}
          aria-label="Texto do story"
          placeholder="Escreva…"
          onChange={(e) => mudar({ texto: e.target.value })}
          style={{
            font: fonteDe(t.fonte, t.tamanho * k, fam),
            lineHeight: ALTURA_LINHA,
            textAlign: t.alinhar,
            textTransform: t.fonte === "forte" ? "uppercase" : undefined,
            color: TINTA(c.letra),
            background: c.caixa === null ? "transparent" : TINTA(c.caixa),
            ["--brilho" as string]: TINTA(t.cor),
          }}
        />
      </div>
      <div className="se-texto-pe">
        <div className="se-fontes" role="radiogroup" aria-label="Estilo da letra">
          {FONTES.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={t.fonte === f.id} className={"se-fonte " + f.id} style={{ font: fonteDe(f.id, 13, fam) }} onClick={() => mudar({ fonte: f.id })}>
              {f.id === "forte" ? f.nome.toLocaleUpperCase("pt-BR") : f.nome}
            </button>
          ))}
        </div>
        <Paleta valor={t.cor} onChange={(cor) => mudar({ cor })} />
      </div>
    </div>
  );
}
