"use client";
/*
 * Blackjack ao vivo, no jeito dos cassinos online (o padrão das mesas de cartas): a barra de cima com o que está
 * acontecendo, o tempo, a carteira e quanto tenho na mesa; as últimas somas do dealer; a mesa em meia-lua com o dealer,
 * o sapato e a bandeja, e os 5 lugares com o círculo de aposta numerado (o meu dourado). No celular, os outros ficam
 * numa fileira e a minha mão fica grande no meio. Embaixo, o painel: fichas para montar a aposta (Desfazer, Repetir,
 * Dobrar) ou os botões redondos da vez (Pedir, Parar, Dobrar, Dividir). Quem dá as cartas, conta e paga é o banco
 * (seção 43); aqui só mostra.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { formatarMoedas } from "@/lib/moedas";
import { useCarteira } from "@/lib/carteira";
import { local } from "@/lib/util";
import { CartaFrancesa } from "@/features/mesa/CartaFrancesa";
import { Ficha, Lugar, Mesa, NaMesa, Pilha } from "@/features/mesa/Pecas";
import { Aparece, Pula, Some, Vira, Voa } from "@/features/mesa/Animar";
import { BarraJogo, BotaoMini, BotaoRedondo, EscolherFichas, Faixa, Historico, Soma } from "@/features/mesa/Painel";
import { APOSTA_MAX, APOSTA_MIN, carta, hashBate, LUGARES, opcoes, resultado, sapato, TEMPO_APOSTAS_MS, TEMPO_VEZ_MS, type MaoBj } from "./bjRegras";
import { useBlackjack } from "./bjDados";

/* onde fica cada lugar no arco do computador (em % da mesa); no celular, 36-mesas.css muda (bj-eu, bj-o0…) */
const LUGAR_XY: [number, number][] = [
  [15, 60],
  [32, 74],
  [50, 80],
  [68, 74],
  [85, 60],
];
const FICHAS = [5, 10, 25, 50, 100, 200];
const fmt = (n: number) => n.toLocaleString("pt-BR");

/** O relógio do banco, andando de 1/4 em 1/4 de segundo (para as contagens). */
function useAgora(agoraBanco: () => number) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(agoraBanco()), 250);
    return () => clearInterval(t);
  }, [agoraBanco]);
  return agora;
}

/**
 * Uma mão: cada carta nova sai do sapato e vira de frente. `atraso(i)` diz quando a carta i sai (na primeira
 * distribuição, uma de cada vez pelos lugares); a carta escondida do dealer vira quando é revelada.
 */
function Cartas({ cartas, rodada, atraso }: { cartas: string[]; rodada: number; atraso?: (i: number) => number }) {
  return (
    <div className="mesa-leque bj-mao">
      {cartas.map((c, i) => {
        const k = carta(c);
        const t = atraso?.(i) ?? 0;
        return (
          <Voa key={`${rodada}-${i}`} de=".bj-sapato" atraso={t} giro={-18} escala={0.55}>
            {k ? (
              <Vira key={c} atraso={t + 360}>
                <CartaFrancesa v={k.v} n={k.n} />
              </Vira>
            ) : (
              <CartaFrancesa costas />
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
    <p>Todos contra o mesmo dealer. Aposte de {APOSTA_MIN} a {APOSTA_MAX}; a primeira aposta abre a rodada, com 10 s para os outros entrarem.</p>
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
  const passou = estado?.rodada?.fase === "fim" && (estado.rodada.fimEm ?? 0) <= agora;
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
  const podeApostar = !r || (r.fase === "apostas" && (segApostas ?? 0) > 0);
  const lugaresOcupados = new Set(maos.map((m) => m.lugar));
  const cheia = r?.fase === "apostas" && lugaresOcupados.size >= LUGARES && !minhas.length;
  const op = minhaVez && vez ? opcoes(vez, maos) : null;
  const fim = r?.fase === "fim";
  /* a primeira distribuição: uma carta para cada lugar, uma para o dealer, e de novo */
  const lugaresNaRodada = [...lugaresOcupados].sort((a, b) => a - b);
  const darAtraso = (lugar: number | "dealer") => (i: number) =>
    i < 2 ? (i * (lugaresNaRodada.length + 1) + (lugar === "dealer" ? lugaresNaRodada.length : Math.max(0, lugaresNaRodada.indexOf(lugar)))) * 120 : 0;
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
        : "Rodada paga";
  const falta = r?.fase === "apostas" ? (r.fechaEm - agora) / TEMPO_APOSTAS_MS : r?.fase === "jogo" && vez && segVez !== null ? segVez / (TEMPO_VEZ_MS / 1000) : null;
  const meuTotal = minhas.reduce((s, m) => s + (m.pagou ?? 0), 0) - naMesa;
  const meuBj = minhas.some((m) => m.estado === "blackjack" && (m.pagou ?? 0) > m.aposta);
  const dealerTxt = r && r.dealerPontos > 21 ? `o dealer estourou com ${r.dealerPontos}` : `o dealer fez ${r?.dealerPontos ?? 0}`;
  const faixa = !r ? (
    <Faixa titulo="MESA PARADA" sub="A primeira aposta abre a rodada" />
  ) : r.fase === "apostas" ? (
    <Faixa titulo="FAÇAM SUAS APOSTAS" sub={`${segApostas} s · de ${APOSTA_MIN} a ${APOSTA_MAX}`} falta={falta} />
  ) : r.fase === "jogo" && minhaVez && vez ? (
    <Faixa titulo="SUA VEZ" sub={op?.dividir ? `${vez.pontos} · dá para dividir` : op?.dobrar && vez.pontos >= 9 && vez.pontos <= 11 ? `${vez.pontos} · boa hora para dobrar` : `${vez.pontos} · ${segVez} s`} />
  ) : r.fase === "jogo" && !vez ? (
    <Faixa titulo="O DEALER JOGA" />
  ) : fim && minhas.length ? (
    meuTotal > 0 ? (
      <Faixa titulo={meuBj ? `BLACKJACK! +${fmt(meuTotal)}` : `VOCÊ GANHOU ${fmt(meuTotal)}`} sub={dealerTxt} tom="ganhou" />
    ) : meuTotal === 0 ? (
      <Faixa titulo="EMPATE" sub={`a aposta volta · ${dealerTxt}`} />
    ) : (
      <Faixa titulo="NÃO FOI DESTA VEZ" sub={`−${fmt(-meuTotal)} · ${dealerTxt}`} tom="perdeu" />
    )
  ) : fim ? (
    <Faixa titulo={r.dealerPontos > 21 ? "O DEALER ESTOUROU" : `DEALER ${r.dealerPontos}`} />
  ) : null;

  /* no celular, os outros vão numa fileira (bj-o0…) e o meu lugar fica grande no meio (bj-eu) */
  const outros = Array.from({ length: LUGARES }, (_, i) => i + 1).filter((l) => l !== meuLugar);

  const somarFicha = (v: number) => setPilha((p) => (p.reduce((s, x) => s + x, 0) + v <= APOSTA_MAX ? [...p, v] : p));
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
      <Mesa forma="meia-lua" className={meuLugar ? "bj-comigo" : "bj-sem-mim"}>
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
        <NaMesa x={88} y={12} className="bj-sapato-pos">
          <span className="bj-sapato" aria-hidden="true" />
        </NaMesa>
        {/* o dealer */}
        <NaMesa x={50} y={22} className="bj-topo">
          {r && r.dealer.length > 0 && (
            <div className="bj-dealer">
              <Cartas cartas={r.dealer} rodada={r.id} atraso={darAtraso("dealer")} />
              <Aparece atraso={darAtraso("dealer")(1) + 500}>
                <Pula valor={r.dealerPontos}>
                  <Soma valor={r.dealerPontos} tipo={r.dealerPontos > 21 ? "estourou" : undefined} />
                </Pula>
              </Aparece>
            </div>
          )}
          {vez && !minhaVez && (
            <span className="mesa-aviso" key={vez.id}>
              Vez de {nome(vez.userId)}
              {vez.mao === 2 ? " (2ª mão)" : ""}
            </span>
          )}
        </NaMesa>
        <NaMesa x={50} y={34} className="bj-regras-pos">
          <span className="bj-regras">BLACKJACK PAGA 3 PARA 2 · O DEALER PARA EM 17</span>
        </NaMesa>
        {faixa && (
          <NaMesa x={50} y={44} className={"bj-faixa-pos" + (r?.fase === "jogo" ? " no-jogo" : fim ? " no-fim" : "")} key={`${r?.id}-${r?.fase}-${minhaVez}`}>
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
          const fVez = naVez && segVez !== null ? segVez / (TEMPO_VEZ_MS / 1000) : null;
          const aposta = dele.reduce((s, m) => s + m.aposta, 0);
          const pago = dele.reduce((s, m) => s + (m.pagou ?? 0), 0);
          return (
            <NaMesa key={lugar} x={x} y={y} className={`bj-lugar bj-l${lugar} ${posCel}`}>
              <div className="bj-maos">
                {dele.map((m) => {
                  const res = resultado(m);
                  return (
                    <div key={m.id} className={"bj-uma" + (vez?.id === m.id ? " vez" : "")}>
                      {m.cartas.length > 0 && (
                        <div className="bj-linha">
                          <Cartas cartas={m.cartas} rodada={r?.id ?? 0} atraso={m.mao === 1 ? darAtraso(lugar) : undefined} />
                          <Aparece atraso={m.mao === 1 ? darAtraso(lugar)(1) + 500 : 0}>
                            <Pula valor={m.pontos}>
                              <Soma valor={m.estado === "blackjack" ? "BJ" : m.pontos} tipo={m.estado === "blackjack" ? "bj" : m.estado === "estourou" ? "estourou" : undefined} />
                            </Pula>
                          </Aparece>
                        </div>
                      )}
                      {res && (fim || res === "estourou") && res !== "blackjack" && <span className={"mesa-res " + SELO[res].cls}>{SELO[res].txt(m)}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="bj-aposta">
                <span className={"mesa-spot" + (uid === eu ? " meu" : "")}>
                  <span className="mesa-spot-num">{lugar}</span>
                  {fim && pago === 0 ? (
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
                {/* ganhou: o pagamento sai da banca */}
                {fim && pago > aposta && (
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
                ganhou={fim && pago > aposta}
                info={naVez && segVez !== null ? `${segVez} s` : dele.every((m) => m.estado === "parou") && r?.fase === "jogo" ? "parou" : undefined}
              />
            </NaMesa>
          );
        })}
      </Mesa>

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
          <EscolherFichas valores={FICHAS} onFicha={somarFicha} desligadas={(v) => montado + v > APOSTA_MAX || montado + v > saldo} />
          <div className="mesa-linha">
            <BotaoMini icone="↶" rotulo="Desfazer" onClick={() => setPilha((p) => p.slice(0, -1))} disabled={!pilha.length} />
            <BotaoMini icone="↻" rotulo={ultima ? `Repetir ${ultima}` : "Repetir"} onClick={() => setPilha([ultima])} disabled={!ultima || ultima > saldo} />
            <BotaoMini icone="×2" rotulo="Dobrar" onClick={() => setPilha((p) => (montado * 2 <= Math.min(APOSTA_MAX, saldo) ? [...p, ...p] : p))} disabled={!montado || montado * 2 > Math.min(APOSTA_MAX, saldo)} />
            <button className="mesa-bt ouro" type="button" disabled={enviando || montado < APOSTA_MIN || saldo < montado} onClick={() => void enviarAposta(montado)}>
              {minhas.length && r?.fase === "apostas" ? "Trocar aposta" : "Apostar"}
              <small>{montado ? formatarMoedas(montado) : `toque nas fichas (${APOSTA_MIN} a ${APOSTA_MAX})`}</small>
            </button>
          </div>
        </div>
      ) : (
        <div className="mesa-painel" key="espera">
          {fim && minhas.length > 0 && (
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
