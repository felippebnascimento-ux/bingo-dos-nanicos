"use client";
/*
 * O cavalo de corrida desenhado (de lado, virado para a direita), com o jóquei na cor da raia. A pelagem e as sedas
 * ficam em variáveis no 42-corrida.css (`cav-<pelagem>` e `raia-<n>`); `correndo` liga o galope das pernas.
 */
import type { Pelagem } from "./corridaRegras";

export function DesenhoCavalo({ pelagem, raia, correndo = false, semJoquei = false }: { pelagem: Pelagem; raia?: number; correndo?: boolean; semJoquei?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 64"
      className={`cav cav-${pelagem}` + (raia !== undefined ? ` raia-${raia + 1}` : "") + (correndo ? " cav-corre" : "")}
      aria-hidden="true"
    >
      {/* rabo */}
      <path d="M27 27 Q14 28 11 44 Q18 38 26 34 Z" className="cav-crina" />
      {/* pernas de trás e da frente (giram no quadril e no ombro) */}
      <g className="cav-perna p1">
        <path d="M33 34 L31 52 L35 53 L37 35 Z" className="cav-pelo-esc" />
        <rect x="29.5" y="52" width="6" height="3" rx="1" className="cav-casco" />
      </g>
      <g className="cav-perna p3">
        <path d="M64 35 L65 52 L69 52 L68 35 Z" className="cav-pelo-esc" />
        <rect x="63.5" y="52" width="6" height="3" rx="1" className="cav-casco" />
      </g>
      {/* corpo, pescoço e cabeça */}
      <ellipse cx="48" cy="30" rx="23" ry="10.5" className="cav-pelo" />
      {pelagem === "pampa" && (
        <>
          <ellipse cx="41" cy="27" rx="8" ry="5.5" className="cav-mancha" />
          <ellipse cx="58" cy="33" rx="6" ry="4" className="cav-mancha" />
        </>
      )}
      <path d="M62 24 L76 8 L84 12 L72 33 Z" className="cav-pelo" />
      <ellipse cx="85" cy="13" rx="10" ry="5" transform="rotate(28 85 13)" className="cav-pelo" />
      <path d="M77 5 L80 1 L81 7 Z" className="cav-pelo" />
      <circle cx="84" cy="10" r="1.1" className="cav-olho" />
      {/* crina */}
      <path d="M62 23 Q68 12 76 6 L78 9 Q71 15 66 26 Z" className="cav-crina" />
      <g className="cav-perna p2">
        <path d="M36 34 L36 53 L40 53 L41 35 Z" className="cav-pelo" />
        <rect x="34.5" y="52" width="6" height="3" rx="1" className="cav-casco" />
      </g>
      <g className="cav-perna p4">
        <path d="M60 35 L58 52 L62 53 L64 35 Z" className="cav-pelo" />
        <rect x="56.5" y="52" width="6" height="3" rx="1" className="cav-casco" />
      </g>
      {!semJoquei && (
        <g className="cav-joquei">
          {/* sela, perna, tronco, braço e capacete */}
          <rect x="44" y="18" width="14" height="4" rx="2" className="cav-sela" />
          <path d="M50 19 L56 27 L52 29 L47 21 Z" className="cav-calca" />
          <path d="M45 19 Q47 8 56 7 L60 10 Q53 12 51 20 Z" className="cav-seda" />
          <path d="M56 9 L66 14 L65 16 L55 12 Z" className="cav-seda" />
          <circle cx="58" cy="5" r="4" className="cav-seda" />
          <path d="M58 1 A4 4 0 0 1 62 5 L64 5" className="cav-bone" />
        </g>
      )}
    </svg>
  );
}
