"use client";
/* Zoeira na tela do hall: o menu do boneco, o chinelo/torta voando, o "PLAFT!" e o aviso de revidar. */
import { useEffect, useRef } from "react";
import { useSure } from "@/components/ui/useSure";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { setApp } from "@/lib/store";
import type { Boneco } from "./bonecos";
import { tela, type Caixa2D } from "./hall";
import { arco, type Ponto } from "./zoeira";
import { abrirMenu, PRECO, useZoeira, VOO_MS, zoar, type TipoZoeira } from "./zoeiraSala";

/** cabeça do boneco, em coordenadas do desenho do hall */
const cabeca = (b: Pick<Boneco, "i" | "j">): Ponto => {
  const [x, y] = tela(b.i + 0.5, b.j + 0.5);
  return { x, y: y - 112 };
};
const emPct = (p: Ponto, vb: Caixa2D) => ({ left: `${((p.x - vb.x) / vb.w) * 100}%`, top: `${((p.y - vb.y) / vb.h) * 100}%` });

/** Chinelo de dedo (desenhado aqui, sem imagem). */
const Chinelo = () => (
  <svg viewBox="0 0 40 20" width="34" height="17" aria-hidden="true">
    <ellipse cx="20" cy="10" rx="18" ry="8" className="z-sola" />
    <path d="M12 10 L22 4 M12 10 L22 16" className="z-tira" />
  </svg>
);
/** Torta com chantili. */
const Torta = () => (
  <svg viewBox="0 0 40 26" width="34" height="22" aria-hidden="true">
    <path d="M3 14 h34 l-4 10 h-26 z" className="z-massa" />
    <path d="M4 14 q4 -9 8 -2 q4 -9 8 -2 q4 -9 8 -2 q4 -9 8 0 z" className="z-chantili" />
    <circle cx="20" cy="5" r="3" className="z-cereja" />
  </svg>
);

/** O que voa, o "PLAFT!" e o chantili, por cima dos bonecos. */
export function ZoeiraCamada({ bonecos, vb }: { bonecos: Boneco[]; vb: Caixa2D }) {
  const agora = useZoeira((s) => s.agora);
  const voos = useZoeira((s) => s.voos);
  const plaft = useZoeira((s) => s.plaft);
  const torta = useZoeira((s) => s.torta);
  const porFid = (fid: string) => bonecos.find((b) => b.fid === fid);
  return (
    <div className="zoeira-camada" aria-hidden="true">
      {voos.map((v) => {
        const de = porFid(v.de);
        const para = porFid(v.para);
        if (!de || !para) return null;
        const t = Math.min(1, Math.max(0, (agora - v.inicio) / VOO_MS));
        const p = arco(cabeca(de), cabeca(para), t);
        return (
          <span key={v.id} className="zoeira-voo" style={{ ...emPct(p, vb), ["--rot" as string]: `${Math.round(t * 720)}deg` }}>
            {v.tipo === "torta" ? <Torta /> : <Chinelo />}
          </span>
        );
      })}
      {Object.keys(plaft).map((fid) => {
        const b = porFid(fid);
        return b ? (
          <span key={"p" + fid} className="zoeira-plaft" style={emPct(cabeca(b), vb)}>
            PLAFT!
          </span>
        ) : null;
      })}
      {Object.keys(torta).map((fid) => {
        const b = porFid(fid);
        return b ? <span key={"t" + fid} className="zoeira-chantili" style={emPct({ x: cabeca(b).x, y: cabeca(b).y + 38 }, vb)} /> : null;
      })}
    </div>
  );
}

/** Menu em cima do boneco de outra pessoa: ver ficha, chinelada (5) e torta (25, com segundo toque). */
export function MenuBoneco({ b, vb }: { b: Boneco; vb: Caixa2D }) {
  const saldo = useCarteira((s) => s.carteira?.saldo ?? null);
  const ocupado = useZoeira((s) => s.ocupado);
  const caixa = useRef<HTMLDivElement>(null);
  const torta = useSure();
  useEffect(() => {
    caixa.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Element | null;
      if (!caixa.current?.contains(alvo) && !alvo?.closest?.(".boneco-toque, .perfil-cartao")) abrirMenu(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && abrirMenu(null);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  if (!b.fid) return null;
  const fid = b.fid;
  const falta = (tipo: TipoZoeira) => (saldo === null ? 0 : Math.max(0, PRECO[tipo] - saldo));
  const botao = (tipo: "chinelo" | "torta", rotulo: string) => {
    const f = falta(tipo);
    const sure = tipo === "torta" && torta.sure;
    return (
      <button
        type="button"
        role="menuitem"
        className={sure ? "sure" : undefined}
        disabled={ocupado || saldo === null || f > 0}
        onClick={(e) => {
          e.stopPropagation();
          if (tipo === "torta" && !torta.pedir()) return;
          zoar(fid, tipo);
        }}
      >
        {f > 0 ? `${rotulo}: faltam ${formatarMoedas(f)} moedas` : sure ? "Confirmar a torta · 25" : `${rotulo} · ${PRECO[tipo]}`}
      </button>
    );
  };
  return (
    <div
      ref={caixa}
      className="boneco-menu"
      role="menu"
      aria-label={`Opções para ${b.name}`}
      style={emPct(cabeca(b), vb)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <b>{b.name}</b>
      <button
        type="button"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          abrirMenu(null);
          setApp({ fichaAberta: fid });
        }}
      >
        Ver ficha
      </button>
      {botao("chinelo", "Chinelada")}
      {botao("torta", "Torta na cara")}
    </div>
  );
}

/** "Gamer te deu uma chinelada · Revidar" (grátis, uma vez, por 30 s). */
export function Revidar() {
  const r = useZoeira((s) => s.revidar);
  const ocupado = useZoeira((s) => s.ocupado);
  if (!r) return null;
  return (
    <div className="hall-revidar" role="status">
      <span>
        <b>{r.nome}</b> te deu {r.tipo === "torta" ? "uma torta na cara" : "uma chinelada"}
      </span>
      <button type="button" className="btn sm" disabled={ocupado} onClick={() => zoar(r.de, "revide")}>
        Revidar (grátis)
      </button>
    </div>
  );
}
