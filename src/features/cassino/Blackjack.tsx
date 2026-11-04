"use client";
/*
 * Blackjack ao vivo, no jeito dos cassinos ao vivo de verdade: a barra de cima com o que está acontecendo, o tempo, a
 * carteira e quanto tenho na mesa; as últimas somas do dealer; o estúdio com o Veião de dealer atrás da mesa em
 * perspectiva (BjEstudio.tsx: ele dá as cartas com a mão, fala com a mesa e reage), o sapato, o descarte, a bandeja e
 * os 5 lugares com o círculo de aposta numerado (o meu dourado). No celular, os outros ficam
 * numa fileira e a minha mão fica grande no meio. Embaixo, o painel: fichas para montar a aposta (Desfazer, Repetir,
 * Dobrar) ou os botões redondos da vez (Pedir, Parar, Dobrar, Dividir). Quem dá as cartas, conta e paga é o banco
 * (seção 43); aqui só mostra.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useApp } from "@/lib/store";
import { formatarMoedas } from "@/lib/moedas";
import { useCarteira } from "@/lib/carteira";
import { local, reduzMovimento } from "@/lib/util";
import { CartaFrancesa } from "@/features/mesa/CartaFrancesa";
import { Ficha, Lugar, NaMesa, Pilha } from "@/features/mesa/Pecas";
import { AnimarMesa, Aparece, Pula, Some, Vira, Voa } from "@/features/mesa/Animar";
import { BarraJogo, BotaoMini, BotaoRedondo, EscolherFichas, Faixa, Historico, Soma } from "@/features/mesa/Painel";
import { APOSTA_MIN, carta, hashBate, LUGARES, opcoes, resultado, sapato, TEMPO_APOSTAS_MS, TEMPO_VEZ_MS, type MaoBj } from "./bjRegras";
import { useBlackjack } from "./bjDados";
import { EstudioBj } from "./BjEstudio";

/* onde fica cada lugar no arco do computador (em % da mesa); no celular, 36-mesas.css muda (bj-eu, bj-o0…) */
const LUGAR_XY: [number, number][] = [
  [14, 62],
  [31, 72],
  [50, 78],
  [69, 72],
  [86, 62],
];
/* uma carta sai do sapato a cada DAR_MS (na primeira distribuição e quando o dealer tira várias de uma vez) e voa
   VOO_MS até a mesa; a mão do Veião acompanha (36-mesas.css) */
const DAR_MS = 620;
const VOO_MS = 760;
/* no fim, o Veião recolhe mão por mão (uma a cada RECOLHE_MAO_MS): junta as cartas num montinho, levanta, vira de
   costas no ar e põe no descarte; cada mão leva RECOLHE_VOO_MS */
const RECOLHE_MAO_MS = 650;
const RECOLHE_VOO_MS = 1150;
/* aposta de 5 até o saldo (seção 64): as fichas somam e o TUDO põe a carteira inteira */
const FICHAS = [5, 10, 25, 50, 100, 500, 1000];
const fmt = (n: number) => n.toLocaleString("pt-BR");

/** O relógio do banco, andando de 1/4 em 1/4 de segundo (para as contagens). */
function useAgora(agoraBanco: () => number) {
  const [agora, setAgora] = useState(() => Date.now());
  const ref = useRef(agoraBanco);
  useEffect(() => { ref.current = agoraBanco; });
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) setAgora(ref.current());
    }, 250);
    return () => clearInterval(t);
  }, []);
  return agora;
}

const centro = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * O Veião recolhe uma mão, como no cassino: as cartas escorregam para cima da primeira e viram um montinho, ele
 * levanta o montinho, vira de costas no ar (a carta "afina" e volta mostrando o verso) e assenta no descarte, já
 * deitado como as outras de lá. A mão está inclinada na mesa (perspectiva e o giro para o jogador), então cada
 * deslocamento na tela é convertido para o deslocamento dentro dela medindo como um passo de teste anda na tela.
 */
function recolherMao(mao: HTMLElement, atraso: number): Animation[] {
  const cartas = [...mao.children] as HTMLElement[];
  const alvo = mao.closest(".mesa-cartas")?.querySelector(".bj-descarte");
  if (!cartas.length || !alvo || reduzMovimento()) {
    mao.style.opacity = "0";
    return [{ cancel: () => void (mao.style.opacity = "") } as Animation];
  }
  /* quanto 100px de translate dentro da mão andam na tela, em x e em y (o primeiro passo vale para todas) */
  const passo = (el: HTMLElement, tx: number, ty: number) => {
    const a = centro(el.getBoundingClientRect());
    el.style.transform = `translate(${tx}px, ${ty}px)`;
    const b = centro(el.getBoundingClientRect());
    el.style.transform = "";
    return { x: (b.x - a.x) / 100, y: (b.y - a.y) / 100 };
  };
  const ex = passo(cartas[0], 100, 0), ey = passo(cartas[0], 0, 100);
  const det = ex.x * ey.y - ey.x * ex.y || 1;
  /* deslocamento na tela → translate dentro da mão */
  const local = (dx: number, dy: number) => ({ x: (dx * ey.y - ey.x * dy) / det, y: (ex.x * dy - dx * ex.y) / det });
  const tr = (dx: number, dy: number) => {
    const l = local(dx, dy);
    return `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`;
  };
  const b = centro(alvo.getBoundingClientRect());
  const primeira = centro(cartas[0].getBoundingClientRect());
  const anims: Animation[] = [];
  const opcoes = { duration: RECOLHE_VOO_MS, delay: atraso, easing: "linear", fill: "forwards" as const };
  cartas.forEach((el, i) => {
    const a = centro(el.getBoundingClientRect());
    /* o montinho: cada carta um tiquinho acima da de baixo */
    const gx = primeira.x - a.x + i * 1.2, gy = primeira.y - a.y - i * 1.4;
    const dx = b.x - a.x + i * 0.6, dy = b.y - a.y - i * 0.8;
    const mx = gx + (dx - gx) * 0.5, my = gy + (dy - gy) * 0.5 - 34;
    anims.push(
      el.animate(
        [
          /* sempre a mesma lista (translate, rotate, scale) para o navegador interpolar cada parte */
          { transform: `${tr(0, 0)} rotate(0deg) scale(1, 1)`, easing: "cubic-bezier(.4,0,.2,1)" },
          { transform: `${tr(gx, gy)} rotate(0deg) scale(1, 1)`, offset: 0.3, easing: "cubic-bezier(.3,0,.4,1)" },
          { transform: `${tr(gx, gy - 8)} rotate(0deg) scale(1.04, 1.04)`, offset: 0.4, easing: "cubic-bezier(.45,0,.7,.4)" },
          { transform: `${tr(mx, my)} rotate(-32deg) scale(.04, 1.08)`, offset: 0.64, easing: "cubic-bezier(.2,.6,.3,1)" },
          { transform: `${tr(dx, dy)} rotate(-78deg) scale(.82, .82)`, offset: 0.93 },
          { transform: `${tr(dx, dy)} rotate(-78deg) scale(.8, .8)`, opacity: 1, offset: 0.96 },
          { transform: `${tr(dx, dy)} rotate(-78deg) scale(.8, .8)`, opacity: 0 },
        ],
        opcoes,
      ),
    );
    const verso = el.querySelector<HTMLElement>(".bj-verso-sai");
    if (verso) anims.push(verso.animate([{ opacity: 0 }, { opacity: 0, offset: 0.64 }, { opacity: 1, offset: 0.64 }, { opacity: 1 }], opcoes));
  });
  return anims;
}

/**
 * Uma mão: cada carta nova sai do sapato e vira de frente. `atraso(i)` diz quando a carta i sai na primeira
 * distribuição (uma de cada vez pelos lugares); depois, quando chegam várias juntas (o dealer tirando), elas saem
 * uma de cada vez, e a carta escondida do dealer vira na hora em que é revelada. Com `recolhe` (ms), o Veião
 * recolhe a mão depois desse tempo (`recolherMao`).
 */
function Cartas({ cartas, rodada, atraso, recolhe = null }: { cartas: string[]; rodada: number; atraso?: (i: number) => number | undefined; recolhe?: number | null }) {
  /* as cartas que estavam na tela antes da última mudança (para saber quais chegaram agora e qual foi revelada) */
  const chave = rodada + ":" + cartas.join(",");
  const [antes, setAntes] = useState({ chave, rodada, cartas, ant: [] as string[] });
  let ant = antes.ant;
  if (antes.chave !== chave) {
    ant = antes.rodada === rodada ? antes.cartas : [];
    setAntes({ chave, rodada, cartas, ant });
  }
  const virou = ant.some((c, i) => c === "X" && cartas[i] && cartas[i] !== "X");
  const mao = useRef<HTMLDivElement>(null);
  const recolhendo = recolhe !== null;
  useLayoutEffect(() => {
    if (!recolhendo || !mao.current) return;
    const anims = recolherMao(mao.current, recolhe ?? 0);
    return () => anims.forEach((a) => a.cancel());
    // só quando começa a recolher
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recolhendo]);
  return (
    <div className="mesa-leque bj-mao" ref={mao}>
      {cartas.map((c, i) => {
        const k = carta(c);
        const nova = i >= ant.length;
        /* a que acabou de ser revelada vira já; as novas esperam a vez delas (depois da que virou) */
        const t = nova ? (atraso?.(i) ?? (i - ant.length + (virou ? 1 : 0)) * DAR_MS) : 0;
        const revelada = !nova && ant[i] === "X";
        return (
          <Voa key={`${rodada}-${i}`} de=".bj-sapato" atraso={t} giro={-24} escala={0.5} arco={34} duracao={VOO_MS}>
            {k ? (
              <Vira key={c} atraso={revelada ? 0 : t + VOO_MS - 80}>
                <CartaFrancesa v={k.v} n={k.n} />
              </Vira>
            ) : (
              <CartaFrancesa costas />
            )}
            {/* o verso, que aparece quando a carta vira no ar a caminho do descarte */}
            {recolhendo && (
              <span className="bj-verso-sai" aria-hidden="true">
                <CartaFrancesa costas />
              </span>
            )}
          </Voa>
        );
      })}
    </div>
  );
}

const SELO: Record<string, { txt: (m: MaoBj) => string; cls: string }> = {
  blackjack: { txt: () => "BLACKJACK", cls: "bj" },
  ganhou: { txt: (m) => `GANHOU +${(m.pagou ?? 0) - m.aposta}`, cls: "ganhou" },
  empate: { txt: () => "EMPATE", cls: "empate" },
  perdeu: { txt: () => "PERDEU", cls: "perdeu" },
  estourou: { txt: () => "ESTOUROU", cls: "perdeu" },
};

const REGRAS = (
  <>
    <p>Todos contra o mesmo dealer. Aposte de {APOSTA_MIN} moedas até tudo o que tem; a primeira aposta abre a rodada, com 10 s para os outros entrarem.</p>
    <p>Blackjack paga 3 para 2. O dealer pede até 16 e para em todos os 17. Empate devolve a aposta.</p>
    <p>Dobrar com as duas primeiras cartas; dividir um par uma vez (ases recebem uma carta só). 15 s por decisão: acabou o tempo, para.</p>
  </>
);

export function Blackjack({ ativa = true }: { ativa?: boolean }) {
  const { estado, ligada, enviando, apostar, jogar, agoraBanco } = useBlackjack(ativa);
  const agora = useAgora(agoraBanco);
  const friends = useApp((s) => s.friends);
  const eu = useApp((s) => s.myUid);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? 0);
  /* a aposta que estou montando, ficha por ficha (Desfazer tira a última) */
  const [pilha, setPilha] = useState<number[]>([]);
  const [conferencia, setConferencia] = useState<string | null>(null);

  if (ligada === false) return <p className="block hint">O blackjack ainda não foi ligado no banco (seção 43 do seguranca.sql).</p>;
  /* rodada acabada e o resultado já mostrado: a mesa fica limpa esperando a próxima aposta */
  /* o fim da rodada, pelo relógio do banco: o banco dá 4 s + 0,9 s por carta que o dealer tirou (seção 43). Primeiro
     o dealer vira a escondida e tira as dele, uma de cada vez; só então aparece o resultado. Perto do fim ele recolhe
     as cartas, mão por mão, e a mesa limpa um pouco depois do fim do banco (já dá para apostar enquanto ele recolhe) */
  const rod = estado?.rodada;
  const tirou = rod ? Math.max(0, rod.dealer.length - 2) : 0;
  const fimEm = rod?.fimEm ?? 0;
  const fimDesde = fimEm - 4000 - tirou * 900;
  const dealerPronto = fimDesde + (tirou ? tirou * DAR_MS + VOO_MS : 600);
  const recolheDesde = fimEm - 500;
  const recolheMs = (estado?.maos.length ?? 0) * RECOLHE_MAO_MS + RECOLHE_VOO_MS + 200;
  const passou = rod?.fase === "fim" && recolheDesde + recolheMs <= agora;
  const r = passou ? null : (estado?.rodada ?? null);
  const maos = passou ? [] : (estado?.maos ?? []);
  const rosto = (uid: string) => friends.find((f) => f.user_id === uid);
  const nome = (uid: string) => (uid === eu ? "Você" : (rosto(uid)?.name ?? "Nanico"));
  const vez = r?.vez != null ? maos.find((m) => m.id === r.vez) : undefined;
  const minhaVez = !!vez && vez.userId === eu;
  const minhas = maos.filter((m) => m.userId === eu);
  const meuLugar = minhas[0]?.lugar ?? null;
  const segApostas = r?.fase === "apostas" ? Math.max(0, Math.ceil((r.fechaEm - agora) / 1000)) : null;
  const segVez = r?.fase === "jogo" && r.vezAte ? Math.max(0, Math.ceil((r.vezAte - agora) / 1000)) : null;
  /* dá para apostar: mesa parada, rodada acabada (depois do resultado) ou apostas abertas */
  const podeApostar = !r || (r.fase === "apostas" && (segApostas ?? 0) > 0) || (r.fase === "fim" && fimEm <= agora);
  const lugaresOcupados = new Set(maos.map((m) => m.lugar));
  const cheia = r?.fase === "apostas" && lugaresOcupados.size >= LUGARES && !minhas.length;
  const op = minhaVez && vez ? opcoes(vez, maos) : null;
  const fim = r?.fase === "fim";
  /* o resultado só aparece depois que o dealer terminou de tirar as cartas dele */
  const fimPronto = fim && agora >= dealerPronto;
  /* a primeira distribuição: uma carta para cada lugar, uma para o dealer, e de novo */
  const lugaresNaRodada = [...lugaresOcupados].sort((a, b) => a - b);
  const darAtraso = (lugar: number | "dealer") => (i: number) =>
    i < 2 ? (i * (lugaresNaRodada.length + 1) + (lugar === "dealer" ? lugaresNaRodada.length : Math.max(0, lugaresNaRodada.indexOf(lugar)))) * DAR_MS : undefined;
  const urgente = (segVez !== null && segVez <= 5) || (segApostas !== null && segApostas <= 3);
  const naMesa = minhas.reduce((s, m) => s + m.aposta, 0);
  const montado = pilha.reduce((s, v) => s + v, 0);
  const ultima = Number(local.get("bj-ultima")) || 0;

  /* ---------- textos ---------- */
  const status = !r
    ? "Mesa parada"
    : r.fase === "apostas"
      ? `Apostas abertas · ${segApostas} s`
      : r.fase === "jogo"
        ? vez
          ? minhaVez
            ? `Sua vez · ${segVez} s`
            : `Vez de ${nome(vez.userId)} · ${segVez} s`
          : "O dealer joga"
        : fimPronto
          ? "Rodada paga"
          : "O dealer joga";
  const falta = r?.fase === "apostas" ? (r.fechaEm - agora) / TEMPO_APOSTAS_MS : r?.fase === "jogo" && vez && r.vezAte ? Math.max(0, (r.vezAte - agora) / TEMPO_VEZ_MS) : null;
  const meuTotal = minhas.reduce((s, m) => s + (m.pagou ?? 0), 0) - naMesa;
  const meuBj = minhas.some((m) => m.estado === "blackjack" && (m.pagou ?? 0) > m.aposta);
  const dealerTxt = r && r.dealerPontos > 21 ? `o dealer estourou com ${r.dealerPontos}` : `o dealer fez ${r?.dealerPontos ?? 0}`;
  const faixa = !r ? (
    <Faixa titulo="MESA PARADA" sub="A primeira aposta abre a rodada" />
  ) : r.fase === "apostas" ? (
    <Faixa titulo="FAÇAM SUAS APOSTAS" sub={`${segApostas} s · de ${APOSTA_MIN} até o seu saldo`} falta={falta} />
  ) : r.fase === "jogo" && minhaVez && vez ? (
    <Faixa titulo="SUA VEZ" sub={op?.dividir ? `${vez.pontos} · dá para dividir` : op?.dobrar && vez.pontos >= 9 && vez.pontos <= 11 ? `${vez.pontos} · boa hora para dobrar` : `${vez.pontos} · ${segVez} s`} />
  ) : (r.fase === "jogo" && !vez) || (fim && !fimPronto) ? (
    <Faixa titulo="O DEALER JOGA" />
  ) : fimPronto && minhas.length ? (
    meuTotal > 0 ? (
      <Faixa titulo={meuBj ? `BLACKJACK! +${fmt(meuTotal)}` : `VOCÊ GANHOU ${fmt(meuTotal)}`} sub={dealerTxt} tom="ganhou" />
    ) : meuTotal === 0 ? (
      <Faixa titulo="EMPATE" sub={`a aposta volta · ${dealerTxt}`} />
    ) : (
      <Faixa titulo="NÃO FOI DESTA VEZ" sub={`−${fmt(-meuTotal)} · ${dealerTxt}`} tom="perdeu" />
    )
  ) : fimPronto ? (
    <Faixa titulo={r.dealerPontos > 21 ? "O DEALER ESTOUROU" : `DEALER ${r.dealerPontos}`} />
  ) : null;

  /* ---------- o Veião ---------- */
  /* no fim do resultado, ele recolhe as cartas para o descarte: do lugar 5 ao 1 e as dele por último */
  const recolher = fim && agora >= recolheDesde;
  const ordemRecolhe = [...maos].sort((a, b) => b.lugar - a.lugar || a.mao - b.mao).map((m) => m.id);
  const recolheDe = (id: number | "dealer") => (recolher ? (id === "dealer" ? maos.length : ordemRecolhe.indexOf(id)) * RECOLHE_MAO_MS : null);
  /* a soma e o selo de uma mão somem quando o Veião pega as cartas dela */
  const sai = (atraso: number | null) =>
    ({ className: "bj-sai" + (atraso !== null ? " sai" : ""), style: { "--sai": `${atraso ?? 0}ms` } as CSSProperties });
  const dealerBj = !!r && r.dealer.length === 2 && r.dealerPontos === 21 && !r.dealer.includes("X");
  const algumBj = maos.some((m) => m.estado === "blackjack");
  const fala = !r
    ? "Mesa aberta! Quem vai?"
    : r.fase === "apostas"
      ? (segApostas ?? 0) > 3
        ? "Façam suas apostas!"
        : "Últimas apostas…"
      : r.fase === "jogo"
        ? vez
          ? minhaVez
            ? vez.pontos >= 9 && vez.pontos <= 11 && op?.dobrar
              ? `${vez.pontos}… dobra?`
              : "Sua vez! Pede ou para?"
            : `E aí, ${nome(vez.userId)}?`
          : r.dealerPontos > 21
            ? "Estourei!"
            : "Minha vez…"
        : !fimPronto
          ? "Minha vez…"
          : r.dealerPontos > 21
          ? "Estourei! Pago a mesa"
          : dealerBj
            ? "Blackjack da casa!"
            : algumBj
              ? "Blackjack! Parabéns"
              : `Dealer fez ${r.dealerPontos}`;
  const olha = vez ? (vez.lugar - 3) / 2 : 0;
  const gesto = !fimPronto ? undefined : recolher ? "recolhe" : r && r.dealerPontos > 21 ? "estourou" : dealerBj ? "comemora" : "paga";
  /* a mão que dá as cartas: um lote por mudança no número de cartas na mesa */
  const naMesaCartas = (r?.dealer.length ?? 0) + maos.reduce((s, m) => s + m.cartas.length, 0);
  const primeiraMao = maos.every((m) => m.cartas.length <= 2) && (r?.dealer.length ?? 0) <= 2;
  const dar = r && r.fase !== "apostas" ? { chave: `${r.id}-${naMesaCartas}`, n: primeiraMao ? naMesaCartas : fim ? Math.max(1, tirou) : 1 } : undefined;

  /* no celular, os outros vão numa fileira (bj-o0…) e o meu lugar fica grande no meio (bj-eu) */
  const outros = Array.from({ length: LUGARES }, (_, i) => i + 1).filter((l) => l !== meuLugar);

  const somarFicha = (v: number) => setPilha((p) => (p.reduce((s, x) => s + x, 0) + v <= saldo ? [...p, v] : p));
  const enviarAposta = async (v: number) => {
    if (v < APOSTA_MIN) return;
    if (await apostar(v)) {
      local.set("bj-ultima", String(v));
      setPilha([]);
    }
  };
  const conferir = async () => {
    if (!r?.segredo) return;
    const ok = await hashBate(r.segredo, r.hash);
    const s = await sapato(r.segredo, r.id);
    setConferencia(`${ok ? "O segredo bate com o hash mostrado antes da rodada." : "O segredo NÃO bate com o hash!"} Primeiras cartas do sapato: ${s.slice(0, 8).join(", ")}`);
  };

  return (
    <div className="mesa-jogo bj-jogo">
      <BarraJogo
        icone="21"
        nome="Blackjack ao vivo"
        sub={r ? `Rodada ${r.id} · 6 baralhos` : "6 baralhos · aposta de 5 a 200"}
        status={status}
        falta={falta}
        urgente={urgente}
        carteira={saldo}
        naMesa={naMesa}
        regras={REGRAS}
      />
      <Historico
        rotulo="Últimas do dealer:"
        itens={(estado?.historico ?? []).map((h) => (h.bj ? { txt: "BJ", tom: "o" as const } : h.pontos > 21 ? { txt: String(h.pontos), tom: "p" as const, dica: "estourou" } : { txt: String(h.pontos) }))}
      />
      <AnimarMesa>
      <div className={"mesa-cartas meia-lua bj-3d " + (meuLugar ? "bj-comigo" : "bj-sem-mim")}>
        <EstudioBj fala={fala} olha={olha} gesto={gesto} dar={dar} />
        <NaMesa x={50} y={41.5} className="bj-bandeja-pos">
          <div className="bj-bandeja" aria-hidden="true">
            {[500, 100, 25, 10, 5].map((v) => (
              <span key={v}>
                <Ficha valor={v} tam={22} />
                <Ficha valor={v} tam={22} />
                <Ficha valor={v} tam={22} />
              </span>
            ))}
          </div>
        </NaMesa>
        <NaMesa x={67.5} y={42} className="bj-sapato-pos">
          <span className="bj-sapato" aria-hidden="true">
            <i />
          </span>
        </NaMesa>
        <NaMesa x={32.5} y={42} className="bj-descarte-pos">
          <span className="bj-descarte" aria-hidden="true" />
        </NaMesa>
        {/* o dealer */}
        <NaMesa x={50} y={51.5} className="bj-topo">
          {r && r.dealer.length > 0 && (
            <div className="bj-dealer">
              <Cartas cartas={r.dealer} rodada={r.id} atraso={darAtraso("dealer")} recolhe={recolheDe("dealer")} />
              {/* a soma do dealer espera as cartas dele chegarem (no fim, até ele terminar de tirar) */}
              {(!fim || fimPronto) && (
                <span {...sai(recolheDe("dealer"))}>
                  <Aparece atraso={fim ? 0 : (darAtraso("dealer")(1) ?? 0) + VOO_MS}>
                    <Pula valor={r.dealerPontos}>
                      <Soma valor={r.dealerPontos} tipo={r.dealerPontos > 21 ? "estourou" : undefined} />
                    </Pula>
                  </Aparece>
                </span>
              )}
            </div>
          )}
          {vez && !minhaVez && (
            <span className="mesa-aviso" key={vez.id}>
              Vez de {nome(vez.userId)}
              {vez.mao === 2 ? " (2ª mão)" : ""}
            </span>
          )}
        </NaMesa>
        {faixa && (
          <NaMesa x={22} y={19} className={"bj-faixa-pos" + (r?.fase === "jogo" ? " no-jogo" : fim ? " no-fim" : "")} key={`${r?.id}-${r?.fase}-${minhaVez}-${fimPronto}`}>
            {faixa}
          </NaMesa>
        )}
        {/* os 5 lugares */}
        {LUGAR_XY.map(([x, y], i) => {
          const lugar = i + 1;
          const dele = maos.filter((m) => m.lugar === lugar);
          const posCel = lugar === meuLugar ? "bj-eu" : "bj-o" + outros.indexOf(lugar);
          if (!dele.length)
            return (
              <NaMesa key={lugar} x={x} y={y} className={`bj-l${lugar} ${posCel} bj-vazio`}>
                <span className="mesa-spot" aria-label={`Lugar ${lugar} livre`}>
                  <span className="mesa-spot-num">{lugar}</span>
                  LIVRE
                </span>
              </NaMesa>
            );
          const uid = dele[0].userId;
          const naVez = !!vez && vez.userId === uid;
          /* o anel do tempo pelo relógio em ms (pelos segundos inteiros ele andava aos saltos) */
          const fVez = naVez && r?.vezAte ? Math.max(0, Math.min(1, (r.vezAte - agora) / TEMPO_VEZ_MS)) : null;
          const aposta = dele.reduce((s, m) => s + m.aposta, 0);
          const pago = dele.reduce((s, m) => s + (m.pagou ?? 0), 0);
          return (
            <NaMesa key={lugar} x={x} y={y} className={`bj-lugar bj-l${lugar} ${posCel}`}>
              {naVez && <span className="bj-holofote" aria-hidden="true" />}
              <div className="bj-maos">
                {dele.map((m) => {
                  const res = resultado(m);
                  return (
                    <div key={m.id} className={"bj-uma" + (vez?.id === m.id ? " vez" : "") + (m.estado === "estourou" ? " estourou" : "")}>
                      {m.cartas.length > 0 && (
                        <div className="bj-linha">
                          <Cartas cartas={m.cartas} rodada={r?.id ?? 0} atraso={m.mao === 1 ? darAtraso(lugar) : undefined} recolhe={recolheDe(m.id)} />
                          <span {...sai(recolheDe(m.id))}>
                            <Aparece atraso={m.mao === 1 ? (darAtraso(lugar)(1) ?? 0) + VOO_MS : 0}>
                              <Pula valor={m.pontos}>
                                <Soma valor={m.estado === "blackjack" ? "BJ" : m.pontos} tipo={m.estado === "blackjack" ? "bj" : m.estado === "estourou" ? "estourou" : undefined} />
                              </Pula>
                            </Aparece>
                          </span>
                        </div>
                      )}
                      {res && (fimPronto || res === "estourou") && res !== "blackjack" && (
                        <span {...sai(recolheDe(m.id))}>
                          <span className={"mesa-res " + SELO[res].cls}>{SELO[res].txt(m)}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="bj-aposta">
                <span className={"mesa-spot" + (uid === eu ? " meu" : "")}>
                  <span className="mesa-spot-num">{lugar}</span>
                  {/* a aposta chegou ou mudou: uma onda de luz no círculo */}
                  <span className="bj-onda" key={"onda-" + aposta} aria-hidden="true" />
                  {fimPronto && pago === 0 ? (
                    /* perdeu: a aposta vai para a banca do dealer */
                    <Some key={"perdeu-" + lugar} para=".bj-bandeja" atraso={500}>
                      <Pilha valor={aposta} />
                    </Some>
                  ) : (
                    <Voa key={"aposta-" + lugar + "-" + (r?.id ?? 0)} de={`.bj-l${lugar} .mesa-rosto`} giro={0} escala={0.8} duracao={360}>
                      <Pula valor={aposta}>
                        <Pilha valor={aposta} />
                      </Pula>
                    </Voa>
                  )}
                </span>
                {/* ganhou: uma chuva de moedas (maior com blackjack) */}
                {fimPronto && pago > aposta && (
                  <span className={"bj-moedas" + (dele.some((m) => m.estado === "blackjack") ? " muitas" : "")} aria-hidden="true">
                    {Array.from({ length: 14 }, (_, k) => (
                      <i key={k} style={{ "--k": k } as CSSProperties} />
                    ))}
                  </span>
                )}
                {/* ganhou: o pagamento sai da banca */}
                {fimPronto && pago > aposta && (
                  <Voa key={"paga-" + lugar} de=".bj-bandeja" giro={0} escala={1} duracao={700} atraso={500}>
                    <Pilha valor={pago - aposta} />
                  </Voa>
                )}
              </div>
              <Lugar
                f={rosto(uid)}
                nome={nome(uid)}
                eu={uid === eu}
                vez={fVez}
                urgente={naVez && urgente}
                ganhou={fimPronto && pago > aposta}
                info={naVez && segVez !== null ? `${segVez} s` : dele.every((m) => m.estado === "parou") && r?.fase === "jogo" ? "parou" : undefined}
              />
            </NaMesa>
          );
        })}
      </div>
      </AnimarMesa>

      {/* o painel de baixo: montar a aposta, jogar a vez ou esperar */}
      {minhaVez && op && vez ? (
        <div className={"mesa-painel minha-vez" + (urgente ? " urgente" : "")} key="vez">
          <div className="mesa-linha">
            <BotaoRedondo tipo="pedir" icone="+" rotulo="Pedir" onClick={() => void jogar("pedir")} disabled={enviando} />
            <BotaoRedondo tipo="parar" icone="✋" rotulo="Parar" onClick={() => void jogar("parar")} disabled={enviando} />
            <BotaoRedondo tipo="dobrar" icone="×2" rotulo="Dobrar" sub={`+${vez.aposta}`} onClick={() => void jogar("dobrar")} disabled={enviando || !op.dobrar || saldo < vez.aposta} />
            <BotaoRedondo tipo="dividir" icone="⇆" rotulo="Dividir" sub={op.dividir ? `+${vez.aposta}` : undefined} onClick={() => void jogar("dividir")} disabled={enviando || !op.dividir || saldo < vez.aposta} />
          </div>
          <div className="mesa-linha dica">
            Sua mão: {vez.pontos}
            {vez.mao === 2 ? " (2ª mão)" : ""} · {segVez} s para decidir
          </div>
        </div>
      ) : podeApostar && !cheia ? (
        <div className="mesa-painel" key="apostas">
          <EscolherFichas valores={FICHAS} onFicha={somarFicha} desligadas={(v) => montado + v > saldo} />
          <div className="mesa-linha">
            <BotaoMini icone="↶" rotulo="Desfazer" onClick={() => setPilha((p) => p.slice(0, -1))} disabled={!pilha.length} />
            <BotaoMini icone="↻" rotulo={ultima ? `Repetir ${ultima}` : "Repetir"} onClick={() => setPilha([ultima])} disabled={!ultima || ultima > saldo} />
            <BotaoMini icone="×2" rotulo="Dobrar" onClick={() => setPilha((p) => (montado * 2 <= saldo ? [...p, ...p] : p))} disabled={!montado || montado * 2 > saldo} />
            <BotaoMini icone="∞" rotulo="Tudo" onClick={() => setPilha([saldo])} disabled={saldo < APOSTA_MIN || montado === saldo} />
            <button className="mesa-bt ouro" type="button" disabled={enviando || montado < APOSTA_MIN || saldo < montado} onClick={() => void enviarAposta(montado)}>
              {minhas.length && r?.fase === "apostas" ? "Trocar aposta" : "Apostar"}
              <small>{montado ? formatarMoedas(montado) : `toque nas fichas (de ${APOSTA_MIN} até o saldo)`}</small>
            </button>
          </div>
        </div>
      ) : (
        <div className="mesa-painel" key="espera">
          {fimPronto && minhas.length > 0 && (
            <div className={"bj-resultado-cel" + (meuTotal < 0 ? " perdeu" : "")}>
              <b>{meuTotal > 0 ? (meuBj ? `BLACKJACK! +${fmt(meuTotal)}` : `Você ganhou ${fmt(meuTotal)}`) : meuTotal === 0 ? "Empate: a aposta volta" : `Não foi desta vez: −${fmt(-meuTotal)}`}</b>
              <small>{dealerTxt}</small>
            </div>
          )}
          <div className="mesa-linha dica">
            {cheia
              ? "A mesa está cheia: espere a próxima rodada"
              : fim
                ? `Próxima rodada em ${Math.max(0, Math.ceil(((r?.fimEm ?? agora) - agora) / 1000))} s`
                : minhas.length
                  ? "Esperando a sua vez"
                  : "Rodada em andamento: aposte na próxima"}
          </div>
        </div>
      )}
      <p className="bj-justo hint">
        Justo: o sapato é embaralhado por um segredo da rodada; o código dele (hash) aparece antes e o segredo sai no fim.
        {r && <span className="bj-hash"> Hash: {r.hash.slice(0, 16)}…</span>}
        {r?.segredo && (
          <button type="button" className="linkish" onClick={() => void conferir()}>
            Conferir esta rodada
          </button>
        )}
      </p>
      {conferencia && <p className="bj-justo hint">{conferencia}</p>}
    </div>
  );
}
