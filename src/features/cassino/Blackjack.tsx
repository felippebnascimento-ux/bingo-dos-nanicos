"use client";
/*
 * Blackjack ao vivo, na mesa em meia-lua (o padrão das mesas de cartas): o dealer em cima com o sapato e a bandeja de
 * fichas, até 5 nanicos no arco com a aposta e a mão, e embaixo a barra (escolher as fichas e apostar, ou jogar a
 * vez: pedir, parar, dobrar, dividir). Quem dá as cartas, conta e paga é o banco (seção 43); aqui só mostra.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { formatarMoedas } from "@/lib/moedas";
import { useCarteira } from "@/lib/carteira";
import { CartaFrancesa } from "@/features/mesa/CartaFrancesa";
import { Ficha, Lugar, Mesa, NaMesa, Pilha } from "@/features/mesa/Pecas";
import { APOSTA_MAX, APOSTA_MIN, carta, hashBate, LUGARES, opcoes, resultado, sapato, TEMPO_VEZ_MS, type MaoBj } from "./bjRegras";
import { useBlackjack } from "./bjDados";

/* onde fica cada lugar no arco (em % da mesa) */
const LUGAR_XY: [number, number][] = [
  [15, 58],
  [32, 73],
  [50, 79],
  [68, 73],
  [85, 58],
];
const FICHAS = [5, 10, 25, 50, 100, 200];

/** O relógio do banco, andando de 1/4 em 1/4 de segundo (para as contagens). */
function useAgora(agoraBanco: () => number) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(agoraBanco()), 250);
    return () => clearInterval(t);
  }, [agoraBanco]);
  return agora;
}

function Cartas({ cartas, grande }: { cartas: string[]; grande?: boolean }) {
  return (
    <div className="mesa-leque bj-mao">
      {cartas.map((c, i) => {
        const k = carta(c);
        return <CartaFrancesa key={i} v={k?.v} n={k?.n} costas={!k} className={grande ? "grande" : ""} />;
      })}
    </div>
  );
}

const SELO: Record<string, { txt: (m: MaoBj) => string; cls: string }> = {
  blackjack: { txt: () => "BLACKJACK", cls: "bj" },
  ganhou: { txt: (m) => `GANHOU +${(m.pagou ?? 0) - m.aposta}`, cls: "ganhou" },
  empate: { txt: () => "EMPATE", cls: "empate" },
  perdeu: { txt: () => "PERDEU", cls: "perdeu" },
  estourou: { txt: (m) => `ESTOUROU · ${m.pontos}`, cls: "perdeu" },
};

export function Blackjack({ ativa = true }: { ativa?: boolean }) {
  const { estado, ligada, enviando, apostar, jogar, agoraBanco } = useBlackjack(ativa);
  const agora = useAgora(agoraBanco);
  const friends = useApp((s) => s.friends);
  const eu = useApp((s) => s.myUid);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? 0);
  const [valor, setValor] = useState(25);
  const [conferencia, setConferencia] = useState<string | null>(null);

  if (ligada === false) return <p className="block hint">O blackjack ainda não foi ligado no banco (seção 43 do seguranca.sql).</p>;
  /* rodada acabada e o resultado já mostrado: a mesa fica limpa esperando a próxima aposta */
  const passou = estado?.rodada?.fase === "fim" && (estado.rodada.fimEm ?? 0) <= agora;
  const r = passou ? null : (estado?.rodada ?? null);
  const maos = passou ? [] : (estado?.maos ?? []);
  const rosto = (uid: string) => friends.find((f) => f.user_id === uid);
  const nome = (uid: string) => (uid === eu ? "Você" : (rosto(uid)?.name ?? "Nanico"));
  const vez = r?.vez != null ? maos.find((m) => m.id === r.vez) : undefined;
  const minhaVez = !!vez && vez.userId === eu;
  const minhas = maos.filter((m) => m.userId === eu);
  const segApostas = r?.fase === "apostas" ? Math.max(0, Math.ceil((r.fechaEm - agora) / 1000)) : null;
  const segVez = r?.fase === "jogo" && r.vezAte ? Math.max(0, Math.ceil((r.vezAte - agora) / 1000)) : null;
  /* dá para apostar: mesa parada, rodada acabada (depois do resultado) ou apostas abertas */
  const podeApostar = !r || (r.fase === "fim" && (r.fimEm ?? 0) <= agora) || (r.fase === "apostas" && (segApostas ?? 0) > 0);
  const lugaresOcupados = new Set(maos.map((m) => m.lugar));
  const cheia = r?.fase === "apostas" && lugaresOcupados.size >= LUGARES && !minhas.length;
  const op = minhaVez && vez ? opcoes(vez, maos) : null;
  const mostrarResultado = r?.fase === "fim";

  const aviso = !r
    ? "Mesa parada: a primeira aposta abre a rodada"
    : r.fase === "apostas"
      ? `Apostas abertas · ${segApostas} s`
      : r.fase === "jogo"
        ? vez
          ? `${vez.userId === eu ? "Sua vez" : `Vez de ${nome(vez.userId)}`}${vez.mao === 2 ? " (2ª mão)" : ""}`
          : "O dealer está jogando"
        : `Dealer: ${r.dealerPontos > 21 ? `estourou com ${r.dealerPontos}` : r.dealerPontos}`;

  const conferir = async () => {
    if (!r?.segredo) return;
    const ok = await hashBate(r.segredo, r.hash);
    const s = await sapato(r.segredo, r.id);
    setConferencia(`${ok ? "O segredo bate com o hash mostrado antes da rodada." : "O segredo NÃO bate com o hash!"} Primeiras cartas do sapato: ${s.slice(0, 8).join(", ")}`);
  };

  return (
    <div className="bj-jogo">
      <div className="mesa-topo">
        <div className="mesa-topo-grupo">
          <span className="mesa-selo ouro">
            Aposta de {APOSTA_MIN} a {APOSTA_MAX}
          </span>
          {r && <span className="mesa-selo">Rodada {r.id}</span>}
        </div>
        <div className="mesa-topo-grupo">
          <span className="mesa-selo">6 baralhos</span>
        </div>
      </div>
      <Mesa forma="meia-lua">
        <svg className="bj-arco" viewBox="0 0 1000 590" aria-hidden="true">
          <defs>
            <path id="bj-arco1" d="M150 190 Q500 350 850 190" />
            <path id="bj-arco2" d="M240 232 Q500 365 760 232" />
          </defs>
          <text className="bj-arco-1">
            <textPath href="#bj-arco1" startOffset="50%" textAnchor="middle">
              BLACKJACK PAGA 3 PARA 2
            </textPath>
          </text>
          <text className="bj-arco-2">
            <textPath href="#bj-arco2" startOffset="50%" textAnchor="middle">
              O DEALER PEDE ATÉ 16 E PARA EM 17
            </textPath>
          </text>
        </svg>
        <NaMesa x={50} y={6}>
          <div className="bj-bandeja" aria-hidden="true">
            {[1000, 500, 100, 25, 10, 5].map((v) => (
              <span key={v}>
                <Ficha valor={v} tam={22} />
                <Ficha valor={v} tam={22} />
              </span>
            ))}
          </div>
        </NaMesa>
        <NaMesa x={88} y={12}>
          <span className="bj-sapato" aria-hidden="true" />
        </NaMesa>
        {/* o dealer */}
        <NaMesa x={50} y={23}>
          {r && r.dealer.length > 0 ? (
            <div className="bj-dealer">
              <Cartas cartas={r.dealer} />
              <span className="mesa-soma">{r.dealerPontos}</span>
            </div>
          ) : null}
          <span className="mesa-aviso" role="status">
            {aviso}
          </span>
        </NaMesa>
        {/* os lugares no arco */}
        {LUGAR_XY.map(([x, y], i) => {
          const lugar = i + 1;
          const dele = maos.filter((m) => m.lugar === lugar);
          if (!dele.length)
            return (
              <NaMesa key={lugar} x={x} y={y} className={"bj-l" + lugar}>
                <span className="mesa-circulo bj-livre" aria-label={`Lugar ${lugar} livre`} />
              </NaMesa>
            );
          const uid = dele[0].userId;
          const naVez = !!vez && vez.userId === uid;
          const falta = naVez && segVez !== null ? segVez / (TEMPO_VEZ_MS / 1000) : null;
          return (
            <NaMesa key={lugar} x={x} y={y} className={"bj-lugar bj-l" + lugar}>
              <div className="bj-maos">
                {dele.map((m) => {
                  const res = resultado(m);
                  return (
                    <div key={m.id} className={"bj-uma" + (vez?.id === m.id ? " vez" : "")}>
                      {m.cartas.length > 0 && <Cartas cartas={m.cartas} />}
                      {m.cartas.length > 0 && !(mostrarResultado && res) && <span className="mesa-soma">{m.pontos}</span>}
                      {res && (mostrarResultado || res === "estourou" || res === "blackjack") && <span className={"mesa-res " + SELO[res].cls}>{SELO[res].txt(m)}</span>}
                      <Pilha valor={m.aposta} />
                    </div>
                  );
                })}
              </div>
              <Lugar f={rosto(uid)} nome={nome(uid)} eu={uid === eu} vez={falta} info={naVez && segVez !== null ? `${segVez} s` : undefined} />
            </NaMesa>
          );
        })}
      </Mesa>

      {/* a barra de baixo: apostar ou jogar a vez */}
      <div className="mesa-acoes">
        {minhaVez && op ? (
          <>
            <span className="mesa-tempo">
              <b>{segVez ?? "—"}</b>sua vez
            </span>
            <button className="mesa-bt ouro" type="button" disabled={enviando} onClick={() => void jogar("pedir")}>
              Pedir
            </button>
            <button className="mesa-bt" type="button" disabled={enviando} onClick={() => void jogar("parar")}>
              Parar
            </button>
            {op.dobrar && (
              <button className="mesa-bt" type="button" disabled={enviando || saldo < (vez?.aposta ?? 0)} onClick={() => void jogar("dobrar")}>
                Dobrar<small>+{vez?.aposta}</small>
              </button>
            )}
            {op.dividir && (
              <button className="mesa-bt" type="button" disabled={enviando || saldo < (vez?.aposta ?? 0)} onClick={() => void jogar("dividir")}>
                Dividir<small>+{vez?.aposta}</small>
              </button>
            )}
          </>
        ) : podeApostar && !cheia ? (
          <>
            {r?.fase === "apostas" && (
              <span className="mesa-tempo">
                <b>{segApostas}</b>apostas
              </span>
            )}
            <div className="bj-fichas" role="radiogroup" aria-label="Valor da aposta">
              {FICHAS.map((v) => (
                <button key={v} type="button" role="radio" aria-checked={valor === v} className={"bj-ficha" + (valor === v ? " on" : "")} onClick={() => setValor(v)} aria-label={`${v} moedas`}>
                  <Ficha valor={v} tam={38} />
                  <b>{v}</b>
                </button>
              ))}
            </div>
            <button className="mesa-bt ouro" type="button" disabled={enviando || saldo < valor} onClick={() => void apostar(valor)}>
              {minhas.length && r?.fase === "apostas" ? "Trocar aposta" : "Apostar"}
              <small>{formatarMoedas(valor)}</small>
            </button>
          </>
        ) : (
          <span className="mesa-tempo bj-espera">
            {cheia
              ? "A mesa está cheia: espere a próxima rodada"
              : r?.fase === "fim"
                ? `Próxima rodada em ${Math.max(0, Math.ceil(((r.fimEm ?? agora) - agora) / 1000))} s`
                : minhas.length
                  ? "Esperando a sua vez"
                  : "Rodada em andamento: aposte na próxima"}
          </span>
        )}
      </div>
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
