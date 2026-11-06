"use client";
/*
 * A pista da corrida (05/11/2026), como na transmissão: vista de lado, um pouco de cima, montada em camadas com as artes
 * geradas pelo grupo (public/arte/corrida/, recortadas por scripts/importar-cenario.py). O fundo com a arquibancada
 * desliza devagar; a pista (que emenda sem fim), os postes de distância, o poste da chegada e o portão andam com a
 * câmera, que segue o líder; a cerca de fora passa na frente dos cavalos. Os cavalos são a ilustração do galope
 * (Cavalo.tsx), menores nas raias de dentro, com sombra e poeira. Por cima, o letreiro da fase, o placar ao vivo e o
 * mapa da corrida. As contas estão em camera3d.ts.
 */
import { useId, useMemo } from "react";
import { reduzMovimento } from "@/lib/util";
import { CavaloSvg, MASCARA_SEDA, QH, QUADROS, QW, quadroNaPista } from "./Cavalo";
import { AREIA_FIM_Y, CERCA_DENTRO_Y, COMPR, H, K, PISTA_ALT, PISTA_ESC, PISTA_Y, W, deslocFaixa, escRaia, focoDaCamera, telaX, yRaia } from "./camera3d";
import { RAIAS, estilo, faseEm, posicao, temposDeChegada, type EstadoCorrida, type Pelagem } from "./corridaRegras";

const ORDINAL = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º"];
const ARTE = "/arte/corrida/";
/* tamanhos das artes (em px da imagem) */
const FUNDO = { w: 1500, h: 321 };
const FAIXA_W = 3000 * PISTA_ESC;
const POSTE = { w: 136, h: 330 };
const PORTAO = { w: 898, h: 309 };
/* o centro de cada porta do portão (fração da largura) e a altura do número */
const PORTA_X = (k: number) => 0.159 + k * 0.1002;
const PORTA_Y = 0.72;
/* altura do fundo na cena: o gramado de baixo entra um pouco na pista */
const FUNDO_ALT = 250;
const FUNDO_LARG = (FUNDO.w * FUNDO_ALT) / FUNDO.h;

type Linha = { nome: string; pelagem: Pelagem | null };

/** A faixa da pista repetida para cobrir a tela inteira. */
function Faixa({ href, desloc, className }: { href: string; desloc: number; className: string }) {
  const n = Math.ceil(W / FAIXA_W) + 1;
  return (
    <g className={className}>
      {Array.from({ length: n }, (_, k) => (
        <image key={k} href={href} x={k * FAIXA_W - desloc - 0.5} y={PISTA_Y} width={FAIXA_W + 1} height={PISTA_ALT * PISTA_ESC} preserveAspectRatio="none" />
      ))}
    </g>
  );
}

/** Um poste (de distância ou da chegada) em pé na cerca de dentro. */
function Poste({ x, alt }: { x: number; alt: number }) {
  const larg = (POSTE.w * alt) / POSTE.h;
  if (x < -larg || x > W + larg) return null;
  return <image href={ARTE + "chegada.webp"} x={x - larg / 2} y={CERCA_DENTRO_Y + 6 - alt} width={larg} height={alt} />;
}

/** A pista inteira. */
export function Pista3D({ e, agora }: { e: EstadoCorrida; agora: number }) {
  const id = useId().replace(/:/g, "");
  const mascara = "seda" + id;
  const fase = faseEm(e.tempos, agora);
  const campo = e.campo;
  const tempos = useMemo(() => (e.pontos ? temposDeChegada(e.pontos) : null), [e.pontos]);
  const estilos = useMemo(() => campo?.map((c, i) => estilo(c, i)) ?? [], [campo]);
  const desde = agora - e.tempos.fechaEm;
  const parado = reduzMovimento();
  const antes = fase === "inscricoes" || fase === "apostas";
  const linhas: Linha[] = campo
    ? campo.map((c) => ({ nome: c.nome, pelagem: c.pelagem }))
    : Array.from({ length: RAIAS }, (_, i) => (e.inscritos[i] ? { nome: e.inscritos[i].nome, pelagem: e.inscritos[i].pelagem } : { nome: "", pelagem: null }));

  /* onde está cada cavalo (x na pista) e se ainda galopa */
  const rank = (i: number) => (e.ordem ? e.ordem.indexOf(i) : i);
  const fimX = (i: number) => COMPR + 9 - rank(i) * 2.1;
  const xs = linhas.map((_, i) => {
    if (antes || !tempos) return -1.5;
    if (fase === "fim" || parado) return fimX(i);
    if (desde < tempos[i]) return posicao(desde / tempos[i], estilos[i]) * COMPR;
    return Math.min(fimX(i), COMPR + ((desde - tempos[i]) / 1000) * 6);
  });
  const galopa = (i: number) => fase === "correndo" && !parado && xs[i] < fimX(i) - 0.01;
  const lider = Math.max(...xs);
  const cam = focoDaCamera(fase, lider);
  const desloc = deslocFaixa(cam, FAIXA_W);
  /* o fundo anda só um pouco do começo ao fim da corrida */
  const fundoX = -((Math.max(0, Math.min(COMPR + 4, cam)) / (COMPR + 4)) * (FUNDO_LARG - W));

  const portaoLarg = 700;
  const portaoAlt = (PORTAO.h * portaoLarg) / PORTAO.w;
  const portaoX = telaX(0, cam) - portaoLarg * 0.48;
  const portaoY = yRaia(7) + 14 - portaoAlt;
  const chegadaX = telaX(COMPR, cam);

  const cavalos = antes
    ? null
    : linhas.map((l, i) => {
        if (!l.pelagem) return null;
        const x = telaX(xs[i], cam);
        const y = yRaia(i);
        const esc = escRaia(i);
        const larg = 4.6 * K * esc;
        if (x < -larg || x > W + larg) return null;
        /* a passada anda com o chão: um galope inteiro a cada PASSADA larguras de cavalo percorridas (a pata não escorrega) */
        const q = galopa(i) ? quadroNaPista(xs[i] * K, larg, i * 0.37) : (i * 3) % QUADROS;
        const poeira = galopa(i)
          ? [0.34, 0.46, 0.6].map((d, k) => (
              <ellipse
                key={k}
                cx={x - larg * d}
                cy={y - (6 + k * 7 + 4 * Math.sin(agora / 90 + i + k)) * esc}
                rx={(16 + k * 9) * esc}
                ry={(8 + k * 4) * esc}
                className="p3-poeira"
                opacity={0.45 - k * 0.12}
              />
            ))
          : null;
        return (
          <g key={i}>
            <ellipse cx={x + larg * 0.02} cy={y - 2} rx={larg * 0.36} ry={7 * esc} className="p3-sombra" />
            {poeira}
            <CavaloSvg pelagem={l.pelagem} raia={i} quadro={q} x={x} y={y} larg={larg} idMascara={mascara} />
          </g>
        );
      });

  /* placar ao vivo: quem está na frente agora */
  const ordemAgora = linhas
    .map((l, i) => ({ i, x: xs[i], l }))
    .filter((o) => o.l.pelagem)
    .sort((a, b) => (fase === "fim" && e.ordem ? rank(a.i) - rank(b.i) : b.x - a.x));
  const banner =
    fase === "inscricoes"
      ? "Inscrições abertas"
      : fase === "apostas"
        ? "Façam suas apostas"
        : fase === "correndo"
          ? desde < 1600
            ? "E foi dada a largada!"
            : lider >= COMPR - 25 && lider < COMPR
              ? "Reta de chegada!"
              : null
          : "Chegada!";

  return (
    <div className={"p3" + (e.pista === "pesada" ? " pesada" : "")} role="img" aria-label={campo ? "A corrida com os 8 cavalos" : "O portão de largada"}>
      <svg viewBox={`0 0 ${W} ${H}`} className="p3-cena" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={"ceu" + id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="p3-ceu-a" />
            <stop offset="1" className="p3-ceu-b" />
          </linearGradient>
          <mask id={mascara} maskUnits="userSpaceOnUse" x={0} y={0} width={QW * QUADROS} height={QH}>
            <image href={MASCARA_SEDA} width={QW * QUADROS} height={QH} />
          </mask>
        </defs>
        {/* fundo: o céu (da tela) e a arte com a arquibancada e o gramado */}
        <rect width={W} height={PISTA_Y + 30} fill={`url(#ceu${id})`} />
        <image href={ARTE + "fundo.webp"} x={fundoX} y={PISTA_Y + 22 - FUNDO_ALT} width={FUNDO_LARG} height={FUNDO_ALT} preserveAspectRatio="none" className="p3-fundo" />
        <Faixa href={ARTE + "pista.webp"} desloc={desloc} className="p3-chao" />
        {/* postes de distância e a chegada */}
        {[35, 70, 105].map((d) => (
          <Poste key={d} x={telaX(d, cam)} alt={92} />
        ))}
        <polygon
          points={`${chegadaX - 3},${CERCA_DENTRO_Y + 2} ${chegadaX + 3},${CERCA_DENTRO_Y + 2} ${chegadaX + 14},${AREIA_FIM_Y} ${chegadaX + 2},${AREIA_FIM_Y}`}
          className="p3-linha-chegada"
        />
        <Poste x={chegadaX} alt={170} />
        {/* o portão de largada: os cavalos ficam dentro dele até a largada */}
        {portaoX < W && portaoX + portaoLarg > 0 && (
          <g>
            <image href={ARTE + "portao.webp"} x={portaoX} y={portaoY} width={portaoLarg} height={portaoAlt} />
            {antes &&
              linhas.map((l, k) => (
                <g key={k} className={`raia-${k + 1}`} opacity={l.pelagem ? 1 : 0.35}>
                  <rect x={portaoX + portaoLarg * PORTA_X(k) - 15} y={portaoY + portaoAlt * PORTA_Y - 15} width={30} height={30} rx={5} className="p3-porta-placa" />
                  <text x={portaoX + portaoLarg * PORTA_X(k)} y={portaoY + portaoAlt * PORTA_Y} className="p3-porta-num" textAnchor="middle" dominantBaseline="central">
                    {k + 1}
                  </text>
                </g>
              ))}
          </g>
        )}
        {cavalos}
        <Faixa href={ARTE + "pista-frente.webp"} desloc={desloc} className="p3-chao" />
      </svg>
      {banner && <span className={"p3-banner f-" + fase}>{banner}</span>}
      {antes && (
        <ol className="p3-largada" aria-label="Quem larga em cada portão">
          {linhas.map((l, i) => (
            <li key={i} className={l.pelagem ? undefined : "vaga"}>
              <span className={`p3-placar-num raia-${i + 1}`}>{i + 1}</span>
              <span className="p3-placar-nome">{l.pelagem ? l.nome : "vaga da casa"}</span>
            </li>
          ))}
        </ol>
      )}
      {!antes && ordemAgora.length > 0 && (
        <ol className="p3-placar" aria-label="Ordem agora">
          {ordemAgora.map((o, k) => (
            <li key={o.i} className={k < 3 ? "podio" : undefined}>
              <span className="p3-placar-pos">{ORDINAL[k]}</span>
              <span className={`p3-placar-num raia-${o.i + 1}`}>{o.i + 1}</span>
              <span className="p3-placar-nome">{o.l.nome}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="p3-mapa" aria-hidden="true">
        <span className="p3-mapa-linha" />
        {linhas.map((l, i) =>
          l.pelagem ? <i key={i} className={`raia-${i + 1}`} style={{ left: `${Math.max(0, Math.min(1, xs[i] / COMPR)) * 100}%` }} /> : null,
        )}
      </div>
    </div>
  );
}
