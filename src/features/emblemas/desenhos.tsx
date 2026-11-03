/* Os desenhos dos emblemas (viewBox 64×64): cada um tem a sua silhueta (casa, chama, monitor, coroa, coração,
   hexágono, roseta, carta, cartela, ficha, pergaminho, prancheta, estrela, losango, escudo, asas, pentágono,
   arco, octógono, ogiva, mochila), a face com as cores dele e uma ilustração por cima.
   O aro é do metal do nível (o Emblema.tsx monta). As cores são classes do 34-perfil.css: ef1–ef4 preenchem com
   --em-1 a --em-4 do emblema, efl com a luz e eft com a tinta escura; es1–es4, esl e est são os traços. */
import type { ReactNode } from "react";
import type { IdEmblema } from "./emblemas";

/** Silhueta: `fora` leva o metal; `dentro` é a face (sem ela, `fora` encolhido `k` vezes em volta de `c`). */
export type Forma = { fora: string; dentro?: string; c?: [number, number]; k?: number; furo?: boolean };

/** Estrela de `n` pontas (ou polígono, com r = R e n lados ímpares/pares), centrada em cx, cy. */
function estrela(n: number, R: number, r: number, cx: number, cy: number, giro = -90) {
  const p: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const raio = i % 2 ? r : R;
    const a = ((giro + (i * 180) / n) * Math.PI) / 180;
    p.push(`${(cx + raio * Math.cos(a)).toFixed(2)} ${(cy + raio * Math.sin(a)).toFixed(2)}`);
  }
  return "M" + p.join("L") + "Z";
}
function poligono(n: number, R: number, cx: number, cy: number, giro = -90) {
  const p: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((giro + (i * 360) / n) * Math.PI) / 180;
    p.push(`${(cx + R * Math.cos(a)).toFixed(2)} ${(cy + R * Math.sin(a)).toFixed(2)}`);
  }
  return "M" + p.join("L") + "Z";
}
const circulo = (cx: number, cy: number, r: number) => `M${cx} ${cy - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}z`;

const CARTA = "M20 7h24a4 4 0 0 1 4 4v38a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4z";
const CARTA_DENTRO = "M21.5 11h21a1.5 1.5 0 0 1 1.5 1.5v35a1.5 1.5 0 0 1-1.5 1.5h-21a1.5 1.5 0 0 1-1.5-1.5v-35a1.5 1.5 0 0 1 1.5-1.5z";
/* avião visto de cima, de bico para cima (gira na arte) */
const AVIAO = "M32 14c1.4 0 2.2 1.4 2.2 3.2V24l9.8 6v2.6l-9.8-3V35l3 2.2V39l-5.2-1.4L26.8 39v-1.8l3-2.2v-5.4l-9.8 3V30l9.8-6v-6.8c0-1.8.8-3.2 2.2-3.2z";

type Desenho = {
  forma: Forma;
  /** a ilustração; `clip` é o url() da face, para o que não pode sair dela */
  arte: (clip: string) => ReactNode;
  /** desenhado antes do aro (a carta de trás do truco); `metal` é o url() do metal do nível */
  atras?: (metal: string) => ReactNode;
  /** desenhado depois de tudo (as pérolas da coroa) */
  frente?: ReactNode;
};

export const DESENHOS: Record<Exclude<IdEmblema, "elo" | "gc">, Desenho> = {
  /* Morador do K-FOFO: a casa com relógio no frontão (as horas de site), janelas acesas e a porta */
  online: {
    forma: { fora: "M32 5 56 25h-3v26a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V25H8z", dentro: "M32 11.5 47 24.5V48H17V24.5z" },
    arte: () => (
      <>
        <rect x="18" y="33" width="6" height="6" rx="1" className="ef3" />
        <rect x="40" y="33" width="6" height="6" rx="1" className="ef3" />
        <path d="M21 33v6M18 36h6M43 33v6M40 36h6" className="es4" strokeWidth=".9" />
        <circle cx="32" cy="26" r="7.2" className="ef1" />
        <path d="M32 21.6V26l3.2 2" className="est" strokeWidth="1.9" />
        <rect x="27.5" y="36" width="9" height="12" rx="1.6" className="ef2" />
        <circle cx="34.6" cy="42.5" r="1" className="ef3" />
      </>
    ),
  },
  /* Fiel: a chama de várias camadas, que só cresce com os dias seguidos */
  sequencia: {
    forma: { fora: "M32 3C37 14 51 21 51 35a19 19 0 0 1-38 0C13 21 27 14 32 3z", c: [32, 35], k: 0.8 },
    arte: () => (
      <>
        <path d="M32 17C35 25 43 29 43 38a11 11 0 0 1-22 0C21 29 29 25 32 17z" className="ef1" />
        <path d="M32 29c2 4 6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 4-6.5 6-10.5z" className="ef2" />
        <circle cx="22.5" cy="22" r="1.4" className="ef1" />
        <circle cx="42" cy="25" r="1.1" className="ef1" />
      </>
    ),
  },
  /* Transmissor: o monitor com o play e as ondas de transmissão */
  tela: {
    forma: {
      fora: "M13 8h38a5 5 0 0 1 5 5v26a5 5 0 0 1-5 5H38l2 5h3a2 2 0 0 1 0 4H21a2 2 0 0 1 0-4h3l2-5H13a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z",
      dentro: "M15.5 13h33a1.5 1.5 0 0 1 1.5 1.5v23a1.5 1.5 0 0 1-1.5 1.5h-33a1.5 1.5 0 0 1-1.5-1.5v-23a1.5 1.5 0 0 1 1.5-1.5z",
    },
    arte: () => (
      <>
        <path d="M24 21a7 7 0 0 0 0 10M40 21a7 7 0 0 1 0 10" className="es1" strokeWidth="2.4" />
        <path d="M20 18a11.5 11.5 0 0 0 0 16M44 18a11.5 11.5 0 0 1 0 16" className="es1" strokeWidth="2.4" opacity=".6" />
        <path d="M28.5 20.5v11l9.5-5.5z" className="efl" strokeLinejoin="round" />
        <circle cx="45.5" cy="35" r="1.6" className="ef2" />
      </>
    ),
  },
  /* Realeza: a própria coroa, de veludo, com rubi, esmeraldas e pérolas nas pontas */
  coroa: {
    forma: { fora: "M8 18 19 28 32 8 45 28 56 18 51 50H13z", c: [32, 33], k: 0.76 },
    arte: () => (
      <>
        <rect x="16" y="40" width="32" height="3.4" rx="1.2" className="ef3" />
        <path d="M32 27.5l4.2 5-4.2 5-4.2-5z" className="ef1" />
        <circle cx="22.5" cy="35" r="2.5" className="ef2" />
        <circle cx="41.5" cy="35" r="2.5" className="ef2" />
        <circle cx="30.8" cy="31" r=".9" className="efl" />
      </>
    ),
    frente: (
      <>
        {[[8, 18], [32, 8], [56, 18]].map(([x, y]) => (
          <g key={x}>
            <circle cx={x} cy={y} r="3.4" className="ef3" />
            <circle cx={x - 1} cy={y - 1} r="1.1" className="efl" />
          </g>
        ))}
      </>
    ),
  },
  /* Respeitado: o coração com a cartola tirada em sinal de respeito */
  respeito: {
    forma: { fora: "M32 53C18 43 8 34 8 21.5a12.5 12.5 0 0 1 24-5 12.5 12.5 0 0 1 24 5C56 34 46 43 32 53z", c: [32, 30], k: 0.76 },
    arte: () => (
      <>
        <g transform="rotate(-14 32 33)">
          <path d="M25.5 20h13l-1 13h-11z" className="ef1" />
          <path d="M26.2 29h11.6l-.3 3.4h-11z" className="ef2" />
          <ellipse cx="32" cy="34" rx="11.5" ry="2.8" className="ef1" />
          <path d="M28 22.5v5" className="esl" strokeWidth="1.2" opacity=".45" />
        </g>
        <path d="M42.5 18.5l2.8-2M44 23.5h3.4" className="esl" strokeWidth="1.8" />
      </>
    ),
  },
  /* Veterano do CS: a mira laranja numa placa hexagonal verde-oliva */
  cs: {
    forma: { fora: "M32 5l21 12v24L32 53 11 41V17z", c: [32, 29], k: 0.8 },
    arte: () => (
      <>
        <circle cx="32" cy="29" r="10.5" className="es1" strokeWidth="2.6" />
        <path d="M32 13.5v7M32 37.5v7M16.5 29h7M40.5 29h7" className="es1" strokeWidth="2.6" />
        <circle cx="32" cy="29" r="1.9" className="ef1" />
      </>
    ),
  },
  /* Campeão da semana: a taça dourada numa roseta azul de 12 pontas */
  trofeu: {
    forma: { fora: estrela(12, 24.5, 21, 32, 29), dentro: circulo(32, 29, 16.5) },
    arte: () => (
      <>
        <path d="M23.5 18.5h-2.6a3.4 3.4 0 0 0 3.6 6M40.5 18.5h2.6a3.4 3.4 0 0 1-3.6 6" className="es1" strokeWidth="2.2" />
        <path d="M23.5 16h17v6.5a8.5 8.5 0 0 1-17 0z" className="ef1" />
        <path d="M36.5 16h4v6.5a8.5 8.5 0 0 1-6 8.1c1.4-2 2-5 2-8.1z" className="ef2" />
        <rect x="30.2" y="30.5" width="3.6" height="5.5" className="ef2" />
        <path d="M26 36h12l1.2 4H24.8z" className="ef1" />
        <path d={estrela(5, 3.3, 1.4, 31, 22)} className="efl" />
      </>
    ),
  },
  /* Truqueiro: o espadão do baralho espanhol, com outra carta atrás em leque */
  truco: {
    forma: { fora: CARTA, dentro: CARTA_DENTRO },
    atras: (metal) => (
      <g transform="rotate(-16 32 53)">
        <path d={CARTA} fill={metal} stroke={metal} strokeWidth="2" strokeLinejoin="round" />
        <path d={CARTA_DENTRO} className="ef4" />
      </g>
    ),
    arte: () => (
      <>
        <path d="M32 13l3 4.5V35h-6V17.5z" className="ef1" />
        <path d="M32 17.5V34" className="esl" strokeWidth="1" opacity=".5" />
        <rect x="23.5" y="35" width="17" height="3.2" rx="1.6" className="ef2" />
        <rect x="30.3" y="38" width="3.4" height="6" className="ef3" />
        <circle cx="32" cy="45.6" r="2.3" className="ef2" />
      </>
    ),
  },
  /* Bingo!: a cartela com a diagonal carimbada e riscada */
  bingo: {
    forma: {
      fora: "M14 7h36a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V13a6 6 0 0 1 6-6z",
      dentro: "M15.5 12.5h33a2 2 0 0 1 2 2v31a2 2 0 0 1-2 2h-33a2 2 0 0 1-2-2v-31a2 2 0 0 1 2-2z",
    },
    arte: () => (
      <>
        {[21.5, 32, 42.5].flatMap((y, l) =>
          [21.5, 32, 42.5].map((x, c) =>
            l === c ? <circle key={`${l}${c}`} cx={x} cy={y - 1.5} r="4.6" className="ef1" /> : <circle key={`${l}${c}`} cx={x} cy={y - 1.5} r="2.6" className="ef2" />,
          ),
        )}
        <path d="M18 16.5 46 44.5" className="es3" strokeWidth="2.6" />
      </>
    ),
  },
  /* Apostador: a ficha de cassino vermelha, com as listras na borda e o espadas no meio */
  cassino: {
    forma: { fora: circulo(32, 29, 23), c: [32, 29], k: 0.86 },
    arte: () => (
      <>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((g) => (
          <rect key={g} x="-2.6" y="-19.6" width="5.2" height="4.8" rx=".8" className="efl" transform={`translate(32 29) rotate(${g})`} />
        ))}
        <circle cx="32" cy="29" r="12.6" className="esl" strokeWidth="1.3" strokeDasharray="2.6 2.4" />
        <circle cx="32" cy="29" r="10.2" className="ef1" />
        <path d="M32 21.5c3 4 7.5 6 7.5 9.4a3.6 3.6 0 0 1-6.3 2.4L34.4 37h-4.8l1.2-3.7a3.6 3.6 0 0 1-6.3-2.4c0-3.4 4.5-5.4 7.5-9.4z" className="ef2" />
      </>
    ),
  },
  /* Cronista: o pergaminho com a pena de escrever nanicadas */
  cronista: {
    forma: {
      fora: "M13 7h38a3.5 3.5 0 0 1 0 7h-2v30h2a3.5 3.5 0 0 1 0 7H13a3.5 3.5 0 0 1 0-7h2V14h-2a3.5 3.5 0 0 1 0-7z",
      dentro: "M18.5 14h27v30h-27z",
    },
    arte: () => (
      <>
        <path d="M22 19h12M22 24h8M22 29h5M22 39.5h20" className="es2" strokeWidth="1.9" />
        <path d="M43.5 15c-7 1-13 7-16 15l-2 6.5 1.6-.6C34.5 33 41 26 43.5 15z" className="ef1" />
        <path d="M42.5 16.5 25.5 37.5" className="es3" strokeWidth="1.2" />
        <path d="M25.6 36l-1.8 4.2 3.2-2.8z" className="ef3" />
      </>
    ),
  },
  /* Missionário: a prancheta com as três missões feitas */
  missao: {
    forma: {
      fora: "M15 10h9.5a7.5 5.5 0 0 1 15 0H49a3 3 0 0 1 3 3v37a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z",
      dentro: "M17.5 16h29a1 1 0 0 1 1 1v31a1 1 0 0 1-1 1h-29a1 1 0 0 1-1-1V17a1 1 0 0 1 1-1z",
    },
    arte: () => (
      <>
        <path d="M25 12h14a1.5 1.5 0 0 1 1.5 1.5V18h-17v-4.5A1.5 1.5 0 0 1 25 12z" className="ef3" />
        <circle cx="32" cy="7.6" r="1.6" className="eft" />
        {[25, 33, 41].map((y) => (
          <g key={y}>
            <rect x="19.5" y={y - 3} width="6" height="6" rx="1.2" className="es2" strokeWidth="1.4" />
            <path d={`M20.4 ${y}l2 2 3.8-4.4`} className="es1" strokeWidth="2.2" />
            <path d={`M29 ${y}h14`} className="es2" strokeWidth="2" />
          </g>
        ))}
      </>
    ),
  },
  /* Dia perfeito: a estrela violeta com o visto bem grande */
  perfeito: {
    forma: { fora: estrela(5, 26, 13.5, 32, 31), c: [32, 31], k: 0.74 },
    arte: () => <path d="M25 31.5l5 5 9.5-10.5" className="esl" strokeWidth="4.4" />,
  },
  /* Mão quente: três cartas em leque pegando fogo, num losango em brasa */
  mao: {
    forma: { fora: "M32 4 57 29 32 54 7 29z", c: [32, 29], k: 0.78 },
    arte: () => (
      <>
        <path d="M32 13c2.5 4.5 7 7 7 12a7 7 0 0 1-14 0c0-3 2-5 3.5-6.5 0 2 1 3.5 2.5 3.5-.5-3.5 0-6 1-9z" className="ef3" />
        {[-20, 20, 0].map((g) => (
          <rect key={g} x="27.5" y="25" width="9" height="13" rx="1.4" className="ef1 est" strokeWidth=".7" transform={`rotate(${g} 32 46)`} />
        ))}
        <path d="M32 27.8l2.2 3.4-2.2 3.4-2.2-3.4z" className="ef2" />
      </>
    ),
  },
  /* Tubarão: a barbatana cortando o mar, com as moedas do prêmio grande */
  tubarao: {
    forma: { fora: "M10 8h44v18c0 14-10 23-22 28C20 49 10 40 10 26z", c: [32, 29], k: 0.8 },
    arte: (clip) => (
      <>
        <path d="M8 37q5.5-3.5 11 0t11 0 11 0 11 0 11 0V60H8z" className="ef4" clipPath={clip} />
        <path d="M22 37.5c2-10 9-17 19-21-2.5 7-2.5 14 0 21z" className="ef1" />
        <path d="M8 37q5.5-3.5 11 0t11 0 11 0 11 0 11 0" className="es2" strokeWidth="2.2" clipPath={clip} />
        <circle cx="20" cy="21" r="3.1" className="ef3" />
        <circle cx="26.5" cy="16.5" r="2.4" className="ef3" />
        <circle cx="19.2" cy="20.2" r=".9" className="efl" />
      </>
    ),
  },
  /* Pé no chão: o brevê de piloto (asas) com o avião pousando na pista */
  aviao: {
    forma: {
      fora:
        circulo(32, 28, 17) +
        "M17 21 2 19.5c2 3.2 5 4.4 8 4.8L3.5 27c3 2.6 6.4 3.2 9.4 3L9 33.5c3.2 1.6 7 1.4 10.5-.6z" +
        "M47 21 62 19.5c-2 3.2-5 4.4-8 4.8L60.5 27c-3 2.6-6.4 3.2-9.4 3L55 33.5c-3.2 1.6-7 1.4-10.5-.6z",
      dentro: circulo(32, 28, 13.5),
    },
    arte: (clip) => (
      <>
        <rect x="14" y="33.5" width="36" height="12" className="ef1" clipPath={clip} />
        <path d="M20.5 37.5h4M30 37.5h4M39.5 37.5h4" className="esl" strokeWidth="1.4" />
        <path d={AVIAO} className="efl" transform="translate(32 25.5) rotate(100) scale(.55) translate(-32 -26.5)" />
      </>
    ),
  },
  /* Artilheiro: o gol e a bola no gramado listrado, num pentágono */
  artilheiro: {
    forma: { fora: poligono(5, 25, 32, 30), c: [32, 30], k: 0.8 },
    arte: (clip) => (
      <>
        <rect x="8" y="34" width="48" height="5" className="ef4" clipPath={clip} />
        <rect x="8" y="44" width="48" height="5" className="ef4" clipPath={clip} />
        <path d="M24 21v12M28 21v12M32 21v12M36 21v12M40 21v12M20 25h24M20 29h24" className="es1" strokeWidth=".8" opacity=".55" />
        <path d="M20 33V21h24v12" className="es1" strokeWidth="2.2" />
        <circle cx="32" cy="39.5" r="5.6" className="efl est" strokeWidth=".9" />
        <path d={poligono(5, 2.3, 32, 39.5)} className="eft" />
      </>
    ),
  },
  /* Coruja: a coruja do happy hour no galho, debaixo da lua, numa janela em arco */
  coruja: {
    forma: { fora: "M11 53V28a21 21 0 0 1 42 0v25z", c: [32, 32], k: 0.8 },
    arte: () => (
      <>
        <path d="M24.5 14.5a5.5 5.5 0 1 0 3.6 9.7 4.6 4.6 0 1 1-3.6-9.7z" className="ef1" />
        <circle cx="41" cy="19" r=".9" className="efl" />
        <circle cx="44.5" cy="27" r=".8" className="efl" />
        <circle cx="35" cy="15.5" r=".7" className="efl" />
        <path d="M17 47.5h30" className="es4" strokeWidth="3" />
        <path d="M24.8 30.5l1.2-6.5 4.5 4.2zM39.2 30.5l-1.2-6.5-4.5 4.2z" className="ef2" />
        <ellipse cx="32" cy="37.5" rx="8.6" ry="9.6" className="ef2" />
        <ellipse cx="32" cy="40.5" rx="5" ry="5.6" className="ef1" opacity=".55" />
        <circle cx="28.5" cy="33" r="3.5" className="ef3" />
        <circle cx="35.5" cy="33" r="3.5" className="ef3" />
        <circle cx="28.7" cy="33.2" r="1.6" className="eft" />
        <circle cx="35.3" cy="33.2" r="1.6" className="eft" />
        <path d="M32 35.5l1.5 1.8-1.5 2-1.5-2z" className="ef3" />
      </>
    ),
  },
  /* Churrasqueiro: o espetinho na grelha, sobre a brasa, num octógono */
  churrasco: {
    forma: { fora: poligono(8, 24.5, 32, 29, -112.5), c: [32, 29], k: 0.8 },
    arte: () => (
      <>
        <path d="M15 22h34M13.5 29h37M15 36h34" className="est" strokeWidth="1.6" opacity=".45" />
        <path d="M18.5 43.5 46.5 15.5" className="es2" strokeWidth="2" />
        <circle cx="18" cy="44" r="2" className="es2" strokeWidth="1.6" />
        {(
          [
            [24.6, 37.4, "ef1"],
            [29.4, 32.6, "ef3"],
            [34.2, 27.8, "ef1"],
            [39, 23, "ef4"],
          ] as const
        ).map(([x, y, c]) => (
          <rect key={x} x={x - 3.7} y={y - 3.7} width="7.4" height="7.4" rx="1.8" className={c} transform={`rotate(45 ${x} ${y})`} />
        ))}
        <circle cx="22" cy="21" r="1.2" className="ef2" opacity=".7" />
        <circle cx="42" cy="38" r="1.4" className="ef2" opacity=".7" />
        <circle cx="37" cy="43" r="1" className="ef2" opacity=".7" />
      </>
    ),
  },
  /* Fênix: a ave de fogo subindo com o sol nascendo, numa ogiva (a Bolsa que faz renascer) */
  fenix: {
    forma: { fora: "M11 53V31C11 18 22 10 32 4c10 6 21 14 21 27v22z", c: [32, 32], k: 0.8 },
    arte: (clip) => (
      <>
        <circle cx="32" cy="47" r="11" className="ef3" clipPath={clip} />
        <g transform="translate(0 4)">
          <path d="M31 32C25 32 19 27 17 17c3 2 5 3 7 3-1.5-2.5-2-5-1.5-8 2.5 3 4.5 5.5 6 8 0-2.5.5-4.5 1.5-6 1.5 4 2 8.5 1 18z" className="ef2" />
          <path d="M33 32C39 32 45 27 47 17c-3 2-5 3-7 3 1.5-2.5 2-5 1.5-8-2.5 3-4.5 5.5-6 8 0-2.5-.5-4.5-1.5-6-1.5 4-2 8.5-1 18z" className="ef2" />
          <path d="M32 38c2 3 4.5 5 4.5 8-1.5-1-3-1.5-4.5-1.2-1.5-.3-3 .2-4.5 1.2 0-3 2.5-5 4.5-8z" className="ef2" />
          <path d="M32 22.5c2 2 2.6 5 2.4 8.5-.2 4-1 7-2.4 9.5-1.4-2.5-2.2-5.5-2.4-9.5-.2-3.5.4-6.5 2.4-8.5z" className="ef1" />
          <circle cx="32" cy="20.8" r="2.6" className="ef1" />
          <path d="M32 18.4c.5-2 1.6-3.2 3-3.8-.4 1.4-.6 2.6-.3 3.8z" className="ef2" />
        </g>
      </>
    ),
  },
  /* Colecionador: a mochila cheia, com aba, fivela e bolso costurado */
  colecao: {
    forma: {
      fora: "M22 14v-3a10 8 0 0 1 20 0v3h1.5a8 8 0 0 1 8 8v26a5 5 0 0 1-5 5h-29a5 5 0 0 1-5-5V22a8 8 0 0 1 8-8zM27 14v-3a5 3.5 0 0 1 10 0v3z",
      dentro: "M22 19.5h20a5 5 0 0 1 5 5V46a2 2 0 0 1-2 2H19a2 2 0 0 1-2-2V24.5a5 5 0 0 1 5-5z",
      furo: true,
    },
    arte: (clip) => (
      <>
        <path d="M14 18h36v10a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5z" className="ef1" clipPath={clip} />
        <rect x="29.4" y="29.5" width="5.2" height="6" rx="1.2" className="ef2" />
        <rect x="31.2" y="31.4" width="1.6" height="2.2" rx=".5" className="ef1" />
        <path d="M23 38.5h18v5.5a2 2 0 0 1-2 2H25a2 2 0 0 1-2-2z" className="ef1" />
        <path d="M24.5 40.5h15" className="es3" strokeWidth="1" strokeDasharray="1.6 1.4" />
        <path d={estrela(5, 3, 1.3, 41, 24.5)} className="ef2" />
      </>
    ),
  },
};

/* Louros dos níveis prata e ouro: folhas ao longo de um arco de cada lado, atrás da silhueta */
export const FOLHAS = (() => {
  const out: { x: number; y: number; r: number }[] = [];
  const R = 26.5;
  for (let g = 104; g <= 212; g += 13.5) {
    const a = (g * Math.PI) / 180;
    const x = 32 + R * Math.cos(a);
    const y = 31 + R * Math.sin(a);
    const tang = g + 90; // a tangente andando para cima
    out.push({ x: +(x + 2.3 * Math.cos(a)).toFixed(2), y: +(y + 2.3 * Math.sin(a)).toFixed(2), r: tang - 32 });
    out.push({ x: +(x - 1.1 * Math.cos(a)).toFixed(2), y: +(y - 1.1 * Math.sin(a)).toFixed(2), r: tang + 32 });
  }
  return out;
})();
const pontoArco = (g: number) => {
  const a = (g * Math.PI) / 180;
  return `${(32 + 26.5 * Math.cos(a)).toFixed(2)} ${(31 + 26.5 * Math.sin(a)).toFixed(2)}`;
};
export const CAULE = `M${pontoArco(100)}A26.5 26.5 0 0 1 ${pontoArco(214)}`;

/** Estrela pequena da fita do ouro. */
export const ESTRELA_FITA = (cx: number) => estrela(5, 2.7, 1.15, cx, 56.6);
/** Brilho de 4 pontas do ouro. */
export const faisca = (cx: number, cy: number, t: number) =>
  `M${cx} ${cy - t}Q${cx} ${cy} ${cx + t} ${cy}Q${cx} ${cy} ${cx} ${cy + t}Q${cx} ${cy} ${cx - t} ${cy}Q${cx} ${cy} ${cx} ${cy - t}z`;
