"use client";
/*
 * Desenhos dos itens da loja (SVG, sem imagens): o cigarrinho, o charuto, as latinhas, a cuia do chimarrão,
 * o copo da caipirinha, o cafezinho, a pipoca, a pizza, o whisky, o champanhe e o escudo. Os mesmos desenhos
 * aparecem na vitrine e na mão do boneco no Sítio.
 * As cores são as variáveis --loja-* do 30-loja.css (com tema escuro).
 */
import type { Boneco } from "@/features/hall/bonecos";
import { peNaTela, type Caixa2D } from "@/features/hall/hall";
import { useApp } from "@/lib/store";
import type { ItemLoja } from "./loja";
import { DURA_ANIM, restanteEfeito } from "./loja";
import { useConsumo } from "./consumoSala";
import { useEquipados, useLoja } from "./lojaDados";

/** O desenho do consumível (ou do escudo), em pé, com a ponta/boca para cima. */
export function DesenhoItem({ id }: { id: string }) {
  switch (id) {
    case "cigarro":
      return (
        <svg viewBox="0 0 12 40" aria-hidden="true">
          <rect x="4" y="6" width="4" height="30" rx="1" className="l-papel" />
          <rect x="4" y="28" width="4" height="8" rx="1" className="l-filtro" />
          <rect x="4" y="4" width="4" height="3" rx="1" className="l-brasa" />
        </svg>
      );
    case "charuto":
      return (
        <svg viewBox="0 0 14 40" aria-hidden="true">
          <rect x="3" y="5" width="8" height="32" rx="3.5" className="l-charuto" />
          <rect x="3" y="24" width="8" height="5" className="l-anel" />
          <rect x="3" y="3" width="8" height="4" rx="2" className="l-brasa" />
        </svg>
      );
    case "cerveja":
    case "energetico":
      return (
        <svg viewBox="0 0 20 34" aria-hidden="true">
          <rect x="2" y="3" width="16" height="29" rx="3" className={id === "cerveja" ? "l-lata" : "l-lata2"} />
          <rect x="2" y="10" width="16" height="12" className={id === "cerveja" ? "l-rotulo" : "l-raio"} />
          <rect x="4" y="1" width="12" height="3" rx="1" className="l-tampa" />
        </svg>
      );
    case "chimarrao":
      return (
        <svg viewBox="0 0 24 36" aria-hidden="true">
          <path d="M14 0 L16 0 L15 14 Z" className="l-bomba" />
          <path d="M3 12 Q12 8 21 12 Q23 26 16 33 L8 33 Q1 26 3 12 Z" className="l-cuia" />
          <ellipse cx="12" cy="12" rx="9" ry="2.6" className="l-erva" />
        </svg>
      );
    case "caipirinha":
      return (
        <svg viewBox="0 0 22 34" aria-hidden="true">
          <path d="M2 6 L20 6 L17 32 L5 32 Z" className="l-copo" />
          <path d="M3 14 L19 14 L17 32 L5 32 Z" className="l-bebida" />
          <circle cx="9" cy="24" r="3" className="l-limao" />
          <circle cx="14" cy="19" r="2.4" className="l-limao" />
          <rect x="13" y="0" width="2" height="16" className="l-canudo" transform="rotate(14 14 8)" />
        </svg>
      );
    case "cafe":
      return (
        <svg viewBox="0 0 26 30" aria-hidden="true">
          <path d="M3 10 L19 10 L17 27 Q11 29 5 27 Z" className="l-xicara" />
          <path d="M19 13 Q25 13 24 18 Q23 22 18 21" fill="none" strokeWidth="2.4" className="l-xicara-asa" />
          <ellipse cx="11" cy="10.5" rx="8" ry="2" className="l-cafe" />
          <path d="M8 7 Q6 4 8 1 M13 7 Q11 4 13 1" fill="none" strokeWidth="1.2" strokeLinecap="round" className="l-vapor" />
        </svg>
      );
    case "pipoca":
      return (
        <svg viewBox="0 0 26 36" aria-hidden="true">
          {[[6, 9], [11, 6], [16, 7], [20, 10], [8, 4], [14, 3], [18, 4]].map(([x, y], k) => (
            <circle key={k} cx={x} cy={y + 4} r="3.6" className="l-milho" />
          ))}
          <path d="M2 12 L24 12 L21 34 L5 34 Z" className="l-balde" />
          <path d="M8 12 L9.5 34 L12.5 34 L12 12 Z M16 12 L15.5 34 L18.5 34 L20 12 Z" className="l-listra" />
        </svg>
      );
    case "pizza":
      return (
        <svg viewBox="0 0 26 34" aria-hidden="true">
          <path d="M2 4 Q13 0 24 4 L13 33 Z" className="l-queijo" />
          <path d="M2 4 Q13 0 24 4 L23 7 Q13 3 3 7 Z" className="l-massa" />
          <circle cx="10" cy="11" r="2.6" className="l-calabresa" />
          <circle cx="16" cy="13" r="2.4" className="l-calabresa" />
          <circle cx="13" cy="20" r="2.2" className="l-calabresa" />
        </svg>
      );
    case "whisky":
      return (
        <svg viewBox="0 0 24 28" aria-hidden="true">
          <path d="M2 6 L22 6 L20 26 L4 26 Z" className="l-copo" />
          <path d="M3.2 14 L20.8 14 L20 26 L4 26 Z" className="l-whisky" />
          <rect x="7" y="10" width="6" height="6" rx="1" transform="rotate(12 10 13)" className="l-gelo" />
        </svg>
      );
    case "champanhe":
      return (
        <svg viewBox="0 0 16 44" aria-hidden="true">
          <path d="M6 1 L10 1 L10 12 Q14 15 14 20 L14 41 Q14 43 12 43 L4 43 Q2 43 2 41 L2 20 Q2 15 6 12 Z" className="l-garrafa" />
          <path d="M5.5 0 L10.5 0 L10.5 13 L5.5 13 Z" className="l-anel" />
          <rect x="2" y="25" width="12" height="9" className="l-papel" />
        </svg>
      );
    case "celular":
      return (
        <svg viewBox="0 0 22 38" aria-hidden="true">
          <rect x="1" y="1" width="20" height="36" rx="4" className="l-lata2" />
          <rect x="3" y="5" width="16" height="25" rx="1.5" className="l-raio" />
          <rect x="8" y="32.5" width="6" height="2" rx="1" className="l-tampa" />
        </svg>
      );
    case "escudo":
      return (
        <svg viewBox="0 0 30 34" aria-hidden="true">
          <path d="M15 1 L28 6 Q28 24 15 33 Q2 24 2 6 Z" className="l-escudo" />
          <path d="M15 6 L23 9 Q23 21 15 27 Q7 21 7 9 Z" className="l-escudo2" />
          <path d="M11 16 L14 20 L20 12" className="l-check" />
        </svg>
      );
    default:
      return null;
  }
}

const emPct = (x: number, y: number, vb: Caixa2D) => ({ left: `${((x - vb.x) / vb.w) * 100}%`, top: `${((y - vb.y) / vb.h) * 100}%` });

/** Os consumíveis na mão dos bonecos (sobe até a boca, fumaça ou gole), por cima do hall. */
export function ConsumoCamada({ bonecos, vb }: { bonecos: Boneco[]; vb: Caixa2D }) {
  const ativos = useConsumo((s) => s.ativos);
  const itens = useLoja((s) => s.itens);
  if (!ativos.length) return null;
  return (
    <div className="consumo-camada" aria-hidden="true">
      {ativos.map((c) => {
        const b = bonecos.find((x) => x.fid === c.fid);
        if (!b) return null;
        /* a boca do boneco: um pouco à direita do meio, perto do topo da cabeça */
        const [x, y] = peNaTela(b);
        const fumaca = c.anim === "fumar" || c.anim === "charuto";
        const it: ItemLoja | undefined = itens?.find((i) => i.id === c.item);
        return (
          <span
            key={c.id}
            className={"consumo " + (fumaca ? "fuma" : "bebe") + (c.anim === "charuto" ? " grosso" : "")}
            style={{ ...emPct(x + 13, y - 86, vb), ["--dura" as string]: `${DURA_ANIM[c.anim]}ms` }}
            title={it?.nome}
          >
            <span className="consumo-item">
              <DesenhoItem id={c.item} />
            </span>
            {fumaca && (
              <span className="consumo-fumaca">
                <i />
                <i />
                <i />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** O efeito que um nanico está sob agora ("Latinha gelada · 1:42"), ou nada. */
export function useEfeitoDe(fid: string | null | undefined) {
  const c = useConsumo((s) => s.ativos.find((x) => x.fid === fid));
  const agora = useConsumo((s) => s.agora);
  const itens = useLoja((s) => s.itens);
  if (!c) return null;
  const falta = restanteEfeito(c.anim, Math.max(agora, c.inicio) - c.inicio);
  if (!falta) return null;
  return { id: c.item, nome: itens?.find((i) => i.id === c.item)?.nome ?? "Efeito", falta };
}

/** Contador do MEU efeito, embaixo no meio do Sítio. */
export function EfeitoCanto() {
  const myFid = useApp((s) => s.myFid);
  const e = useEfeitoDe(myFid);
  if (!e) return null;
  return (
    <div className="hall-canto hall-efeito" role="status" aria-label={`Seu efeito: ${e.nome}, faltam ${e.falta}`}>
      <span className="hall-efeito-item" aria-hidden="true">
        <DesenhoItem id={e.id} />
      </span>
      <span>{e.nome}</span>
      <b>{e.falta}</b>
    </div>
  );
}


/** Título comprado na loja, embaixo do nome ("Rei do tilt"). */
export function TituloNanico({ userId }: { userId: string | null | undefined }) {
  const texto = useEquipados(userId).titulo?.dados.texto;
  return texto ? <small className="titulo-nanico">{texto}</small> : null;
}
