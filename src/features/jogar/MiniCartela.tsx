"use client";
/* Cartela compacta: painel do Ao vivo e janela flutuante (Document Picture-in-Picture). */
import { createPortal } from "react-dom";
import { create } from "zustand";
import { linhasFeitas, toggleCell } from "@/lib/bingo";
import { setApp, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

type DocPip = { requestWindow(o: { width: number; height: number }): Promise<Window> };
const docPip = () => (window as unknown as { documentPictureInPicture?: DocPip }).documentPictureInPicture;
const canPip = () => typeof window !== "undefined" && "documentPictureInPicture" in window;

/** Janela flutuante aberta (e o elemento dentro dela onde a cartela é desenhada). */
const usePip = create<{ win: Window | null; alvo: HTMLElement | null }>()(() => ({ win: null, alvo: null }));

async function abrirPip() {
  const api = docPip();
  if (!api) return toast("Seu navegador não abre a cartela flutuante. Use o Chrome ou o Edge no computador.");
  try {
    const w = await api.requestWindow({ width: 380, height: 470 });
    /* copia o CSS do site (com endereço completo, porque a janela nova é about:blank) */
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach((n) => {
      const c = n.cloneNode(true);
      if (n instanceof HTMLLinkElement) (c as HTMLLinkElement).href = n.href;
      w.document.head.appendChild(c);
    });
    const html = document.documentElement;
    /* as classes do <html> trazem as variáveis das fontes */
    if (html.className) w.document.documentElement.className = html.className;
    const th = html.getAttribute("data-theme");
    if (th) w.document.documentElement.setAttribute("data-theme", th);
    w.document.title = "Cartela";
    w.document.body.className = "pip";
    const alvo = w.document.createElement("div");
    alvo.id = "pipCard";
    w.document.body.appendChild(alvo);
    w.addEventListener("pagehide", () => usePip.setState({ win: null, alvo: null }));
    usePip.setState({ win: w, alvo });
  } catch (e) {
    console.error(e);
    toast("Não deu para abrir a cartela flutuante.");
  }
}

/** A cartela compacta (a mesma no painel e na janela flutuante). */
function MiniCard() {
  const card = useApp((s) => s.card);
  if (!card)
    return (
      <div className="mempty">
        <b>Você ainda não tem cartela</b>
        <span>Sorteie a sua na aba Jogar.</span>
        <button
          className="btn sm"
          type="button"
          onClick={() => {
            setApp({ aba: "jogar" });
            window.focus();
          }}
        >
          Ir para Jogar
        </button>
      </div>
    );
  const done = linhasFeitas(card),
    inLine = new Set(done.flat());
  const marked = card.marked.filter(Boolean).length - 1;
  return (
    <>
      {done.length > 0 && (
        <div className="mbanner" role="status">
          BINGO{done.length > 1 ? " ×" + done.length : ""}!
        </div>
      )}
      <div className="mhead">
        <b>Minha cartela</b>
        <span className="status">{marked} de 24</span>
      </div>
      <div className="mcard">
        {card.cells.map((c, i) =>
          c.free ? (
            <div key={i} className="mcell free">
              Livre
            </div>
          ) : (
            <button
              key={i}
              type="button"
              className={"mcell" + (card.marked[i] ? " on" : "") + (inLine.has(i) ? " line" : "")}
              aria-pressed={!!card.marked[i]}
              title={c.text}
              onClick={() => toggleCell(i)}
            >
              <span>{c.text}</span>
            </button>
          ),
        )}
      </div>
    </>
  );
}

/** Conteúdo do bloco #miniCardBlock (aba Cartela do painel do Ao vivo). */
export function MiniCartela() {
  const win = usePip((s) => s.win);
  return (
    <>
      <MiniCard />
      {canPip() && (
        <>
          <button
            className="btn soft sm"
            id="pipCardBtn"
            type="button"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => (win ? win.close() : abrirPip())}
          >
            {win ? "Fechar cartela flutuante" : "Abrir cartela flutuante"}
          </button>
          <p className="status" style={{ margin: "8px 0 0" }}>
            A cartela flutuante fica por cima das outras janelas, até do jogo em modo janela.
          </p>
        </>
      )}
    </>
  );
}

/**
 * Desenha a cartela dentro da janela flutuante. Fica na aba Jogar (sempre montada),
 * para a janela continuar viva seja qual for a aba ou o painel aberto.
 */
export function CartelaFlutuante() {
  const alvo = usePip((s) => s.alvo);
  return alvo ? createPortal(<MiniCard />, alvo) : null;
}
