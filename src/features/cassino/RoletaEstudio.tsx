"use client";
/*
 * O estúdio da roleta ao vivo, como nos cassinos ao vivo de verdade: a parede do estúdio com as luzes e a placa, o
 * Henry de crupiê em pé atrás da mesa (a arte dele de crupiê, `cassino/henry-crupie.webp`: colete, camisa branca, gravata-borboleta e calça social) e a roda deitada na mesa em perspectiva
 * (a RodaRoleta de sempre, só inclinada; quando gira, a câmera desce para ela de cima, o `zoom` do RoletaMesa).
 * O Henry é o Crupie (features/mesa/Crupie.tsx): o corpo e as mãos parados na mesa, a cabeça acena quando abrem as
 * apostas, acompanha a bola quando ele lança e vira para a roda enquanto ela gira.
 * Só desenho: a roda (filha) continua sendo a que o banco manda parar.
 */
import type { ReactNode } from "react";
import { Crupie, type Gesto, type Pose } from "@/features/mesa/Crupie";

/* a arte do Henry de crupiê (colete, camisa, gravata-borboleta), feita pelo grupo no estilo das outras */
const ARTE = "/arte/cassino/henry-crupie.webp";
/* as poses do Henry: quadros de animação desenhados pelo grupo (cassino/quadros/), encaixados na arte parada pelo
   colete e pela calça; a cabeça é sempre a da arte parada */
const POSES: Record<string, Pose> = {
  lanca: { quadros: [
    { arte: "/arte/cassino/quadros/henry-lanca-2.webp", x: -37, y: 0, w: 299.2, h: 440.1 },
    { arte: "/arte/cassino/quadros/henry-lanca-3.webp", x: -55, y: -1, w: 246.6, h: 442.2 },
    { arte: "/arte/cassino/quadros/henry-lanca-4.webp", x: -27, y: 1, w: 218.0, h: 437.0 },
    { arte: "/arte/cassino/quadros/henry-lanca-5.webp", x: 9, y: 1, w: 248.7, h: 437.0 },
    { arte: "/arte/cassino/quadros/henry-lanca-6.webp", x: -3, y: 1, w: 193.9, h: 437.0 },
  ], ms: 1300, volta: 1 },
  acena: { quadros: [
    { arte: "/arte/cassino/quadros/henry-acena-2.webp", x: -44, y: 0, w: 277.5, h: 438.3 },
    { arte: "/arte/cassino/quadros/henry-acena-3.webp", x: -49, y: 0, w: 286.7, h: 438.3 },
    { arte: "/arte/cassino/quadros/henry-acena-4.webp", x: -75, y: 0, w: 340.2, h: 438.7 },
    { arte: "/arte/cassino/quadros/henry-acena-5.webp", x: -6, y: 0, w: 200.9, h: 439.9 },
  ], ms: 1500, volta: 1 },
};
type Props = {
  /** a roda (a RodaRoleta), que fica deitada na mesa */
  children: ReactNode;
  /** o que o Henry está falando */
  fala?: string | null;
  /** "lanca" (lança a bola), "acena" (abriram as apostas) */
  gesto?: string;
  /** olhando para a roda (enquanto ela gira) */
  olhaRoda?: boolean;
};

/** O estúdio com o Henry e a roda deitada na mesa. */
export function EstudioRoleta({ children, fala, gesto, olhaRoda }: Props) {
  /* um gesto por mudança: acena quando abrem as apostas, acompanha a bola quando lança, e um aceno a cada fala nova */
  const g: Gesto | null = gesto ? { nome: gesto, chave: gesto + (fala ?? "") } : fala ? { nome: "fala", chave: fala } : null;
  return (
    <div className="rl-estudio">
      {/* atrás da roda: a parede, o Henry e a mesa (as medidas em cqw valem dentro de .rl-cena; a roda fica fora dela
          para poder ir para o meio da tela quando a câmera desce) */}
      <div className="rl-cena atras">
      <div className="rl-fundo" aria-hidden="true">
        <div className="bj-parede" />
        <div className="bj-luzes" />
        <div className="rl-placa">
          <small>Nanicos Live</small>
          <b>ROLETA</b>
        </div>
      </div>
      <span className="rl-henry-luz" aria-hidden="true" />
      {/* a mesa: madeira com o feltro, vista de frente */}
      <svg viewBox="0 0 1000 340" preserveAspectRatio="none" className="rl-mesa-svg" aria-hidden="true">
        <defs>
          <linearGradient id="rl-feltro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="rl-st-feltro0" />
            <stop offset="1" className="rl-st-feltro1" />
          </linearGradient>
          <linearGradient id="rl-madeira" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="bj-st-madeira0" />
            <stop offset="1" className="bj-st-madeira1" />
          </linearGradient>
          <radialGradient id="rl-luz" cx="62%" cy="40%" r="55%">
            <stop offset="0" className="bj-st-luz0" />
            <stop offset="1" className="bj-st-luz1" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="1000" height="14" className="bj-borda-tras" />
        <path d="M0 12 L1000 12 L1000 290 L0 290 Z" fill="url(#rl-feltro)" />
        <path d="M0 12 L1000 12 L1000 290 L0 290 Z" fill="url(#rl-luz)" />
        <path d="M0 22 L1000 22" className="bj-fio-ouro fino" />
        <path d="M0 290 L1000 290 L1000 340 L0 340 Z" fill="url(#rl-madeira)" />
        <path d="M0 292 L1000 292" className="bj-couro-brilho" />
        {/* a sombra da roda no feltro */}
        <ellipse cx="650" cy="205" rx="320" ry="100" className="rl-roda-sombra" />
      </svg>
      </div>
      <div className="rl-roda">{children}</div>
      {/* na frente da roda: as fichas do crupiê, o Henry e o balão */}
      <div className="rl-cena frente">
      {/* pilhas de fichas do crupiê, à esquerda */}
      <div className="rl-pilhas" aria-hidden="true">
        {["f5", "f10", "f25", "f50", "f100"].map((c) => (
          <span key={c} className={"rl-pilha " + c}>
            <i />
            <i />
            <i />
            <i />
          </span>
        ))}
      </div>
      {/* o Henry por cima da mesa, com as mãos apoiadas no feltro; ele olha para a roda (à esquerda dele) enquanto gira */}
      <div className="rl-henry">
        <Crupie arte={ARTE} w={189} mesa={300} maos={{ ate: 331, esq: 40, dir: 150 }} pescoco={[96, 151]} rosto={[24, 162]} olha={olhaRoda ? 1 : 0} gesto={g} poses={POSES} />
      </div>
      {fala && (
        <span className="rl-fala" key={fala} role="status">
          {fala}
        </span>
      )}
      </div>
    </div>
  );
}
