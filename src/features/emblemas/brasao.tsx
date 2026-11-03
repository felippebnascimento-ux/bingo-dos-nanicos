"use client";
/*
 * Brasão oficial do elo do LoL e círculo do nível da Gamers Club (fase 33).
 * O brasão é a imagem do Community Dragon (a CSP já aceita raw.communitydragon.org; nada fica no repositório),
 * um PNG de 1280×720 com o brasão no meio, recortado por CSS (.brasao-elo). O círculo da GC é desenho nosso,
 * com as cores de cada nível nas variáveis --gc-<n>-a/b de 34-perfil.css.
 */
import { useId } from "react";
import { nomeTier, TIERS } from "@/features/ficha/numeros";

const BASE = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-";

/** URL do brasão de um tier conhecido; qualquer outro, null. */
export const brasaoUrl = (tier: string | null | undefined) => (tier && TIERS.includes(tier) ? `${BASE}${tier.toLowerCase()}.png` : null);

/** O brasão do elo, do tamanho pedido (some com um tier desconhecido). */
export function BrasaoElo({ tier, tam = 24 }: { tier: string | null | undefined; tam?: number }) {
  const url = brasaoUrl(tier);
  if (!url) return null;
  return (
    <span
      className="brasao-elo"
      role="img"
      aria-label={nomeTier(tier!)}
      style={{ width: tam, height: tam, backgroundImage: `url(${url})` }}
    />
  );
}

/** O círculo do nível da GC (1 a 20); o 20 tem brilho vermelho. */
export function NivelGc({ n, tam = 22 }: { n: number; tam?: number }) {
  const id = useId();
  const k = Math.max(1, Math.min(20, Math.round(n)));
  return (
    <span className="gc-nivel" role="img" aria-label={`GC nível ${k}`}>
      <svg viewBox="0 0 64 64" width={tam} height={tam} aria-hidden="true">
        <defs>
          <radialGradient id={id} cx=".35" cy=".3" r=".8">
            <stop offset="0" style={{ stopColor: `var(--gc-${k}-a)` }} />
            <stop offset="1" style={{ stopColor: `var(--gc-${k}-b)` }} />
          </radialGradient>
        </defs>
        {k === 20 && <circle cx="32" cy="32" r="30" strokeWidth="3" className="gc-vinte" />}
        <circle cx="32" cy="32" r="26" fill={`url(#${id})`} strokeWidth="3" className="gc-aro" />
        <ellipse cx="25" cy="21" rx="10" ry="5" className="gc-luz" />
        <text x="32" y="40" textAnchor="middle" className={k > 9 ? "dois" : undefined}>
          {k}
        </text>
      </svg>
    </span>
  );
}
