"use client";
/*
 * Pênalti x1 (aba Cassino): duelo de pênaltis entre dois membros, valendo moedas (seção 48). No saguão, os duelos
 * abertos (desafiar) e os em jogo (assistir), e o quadro para abrir um com qualquer valor, até o all-in. Na partida, o
 * mesmo estádio do Pênalti: quem bate escolhe um dos 5 cantos e quem defende também, ao mesmo tempo, com 15 s no anel.
 * O banco guarda as escolhas em segredo, sorteia para quem não escolheu, mostra o lance (bola e goleiro) e paga 2×.
 */
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useCarteira } from "@/lib/carteira";
import { formatarMoedas } from "@/lib/moedas";
import { useApp } from "@/lib/store";
import { reduzMovimento } from "@/lib/util";
import {
  apostaValida,
  APOSTA_MIN,
  atalhosDo,
  bolinhas,
  colunaDaZona,
  comSinal,
  meuLado,
  meuPapel,
  momento,
  NOME_ZONA,
  nomeCobranca,
  MSG_MAX,
  posicoesRanking,
  REACOES_DUELO,
  REVELA_MS,
  tempoRestante,
  zonaAlta,
  ZONAS,
  type Duelo as DueloT,
  type Lado,
  type Zona,
} from "./dueloRegras";
import { abrirChatDuelo, mandarMsgDuelo, useChatDuelo, useDuelo, useRankingDuelo } from "./dueloDados";
import { Bola, Goleiro } from "./Penalti";

type Rede = ReturnType<typeof useDuelo>;
/** O lance na tela: a bola voando até o canto e depois parada na rede ou espirrando na defesa. */
type Lance = { n: number; zb: Zona; zg: Zona; gol: boolean; fase: "voando" | "rebateu" | "parou" };

/** O relógio do banco, andando de 1/4 em 1/4 de segundo. */
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

function useNome() {
  const friends = useApp((s) => s.friends);
  return (uid: string | null | undefined) => friends.find((f) => f.user_id === uid);
}

/* ---------- o ranking (seção 50): os 10 primeiros e, se estiver mais embaixo, a minha linha ---------- */
const RANKING_TOPO = 10;
function Ranking({ ativa }: { ativa: boolean }) {
  const linhas = useRankingDuelo(ativa);
  const eu = useApp((s) => s.myUid);
  const quem = useNome();
  if (!linhas?.length) return null;
  const pos = posicoesRanking(linhas);
  const mostrar = linhas.map((l, i) => ({ l, p: pos[i] })).filter((x, i) => i < RANKING_TOPO || x.l.userId === eu);
  return (
    <>
      <p className="rm-rotulo">Ranking do Pênalti x1</p>
      <table className="dl-ranking">
        <thead>
          <tr>
            <th scope="col" aria-label="Posição">#</th>
            <th scope="col">Quem</th>
            <th scope="col" title="Vitórias">V</th>
            <th scope="col" title="Derrotas">D</th>
            <th scope="col">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {mostrar.map(({ l, p }) => {
            const f = quem(l.userId);
            const meu = l.userId === eu;
            return (
              <tr key={l.userId} className={meu ? "eu" : undefined} title={l.maiorPremio ? `Maior prêmio: ${formatarMoedas(l.maiorPremio)}` : undefined}>
                <td className="dl-pos">{p}º</td>
                <td className="dl-quem">
                  <div className="dl-quem-in">
                    <Avatar f={f ?? null} size="xs" />
                    <span>
                      {f?.name ?? "Alguém"}
                      {meu ? <small> (você)</small> : null}
                    </span>
                  </div>
                </td>
                <td>{l.vitorias}</td>
                <td>{l.derrotas}</td>
                <td className={"dl-saldo" + (l.saldo > 0 ? " mais" : l.saldo < 0 ? " menos" : "")}>{comSinal(l.saldo)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/* ---------- o chat do duelo (seção 50): só os dois escrevem; a plateia lê ---------- */
const SEM_MSGS: never[] = [];
function ChatDuelo({ d, eu }: { d: DueloT; eu: string | null }) {
  const quem = useNome();
  const msgs = useChatDuelo((s) => (s.id === d.id ? s.msgs : SEM_MSGS));
  const ok = useChatDuelo((s) => s.ok);
  const [texto, setTexto] = useState("");
  const [mandando, setMandando] = useState(false);
  const lista = useRef<HTMLOListElement>(null);
  const jogador = !!meuLado(d, eu);
  const pode = jogador && (d.estado === "aberto" || d.estado === "jogando");

  useEffect(() => {
    void abrirChatDuelo(d.id);
  }, [d.id]);
  /* a mensagem nova aparece embaixo: a lista desce sozinha */
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  if (ok === false) return null;
  const mandar = async (t: string) => {
    if (mandando || !t.trim()) return;
    setMandando(true);
    const foi = await mandarMsgDuelo(d.id, t);
    setMandando(false);
    if (foi && t === texto) setTexto("");
  };

  return (
    <section className="dl-chat" aria-label="Chat do duelo">
      <p className="rm-rotulo">Chat do duelo</p>
      {msgs.length > 0 ? (
        <ol className="dl-chat-lista" ref={lista} aria-live="polite">
          {msgs.map((m) => (
            <li key={m.id} className={m.userId === eu ? "eu" : undefined}>
              <b>{m.userId === eu ? "Você" : quem(m.userId)?.name ?? "Alguém"}</b> <span>{m.texto}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="hint dl-chat-vazio">{pode ? "Mande a primeira provocação." : "Ninguém falou nada ainda."}</p>
      )}
      {pode ? (
        <>
          <div className="dl-chat-reacoes" role="group" aria-label="Reações rápidas">
            {REACOES_DUELO.map((e) => (
              <button key={e} type="button" disabled={mandando} aria-label={`Mandar ${e}`} onClick={() => void mandar(e)}>
                {e}
              </button>
            ))}
          </div>
          <form
            className="dl-chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void mandar(texto);
            }}
          >
            <input
              type="text"
              value={texto}
              maxLength={MSG_MAX}
              placeholder="Escreva para o adversário"
              aria-label="Mensagem para o chat do duelo"
              onChange={(e) => setTexto(e.target.value)}
            />
            <button type="submit" className="btn sm" disabled={mandando || !texto.trim()}>
              Mandar
            </button>
          </form>
        </>
      ) : (
        <p className="hint dl-chat-vazio">{jogador ? "O duelo acabou: o chat fechou." : "Só os dois jogadores escrevem aqui."}</p>
      )}
    </section>
  );
}

/* ---------- o saguão ---------- */
function Saguao({ r, ativa }: { r: Rede; ativa: boolean }) {
  const saldo = useCarteira((s) => s.carteira?.saldo);
  const eu = useApp((s) => s.myUid);
  const quem = useNome();
  const [valor, setValor] = useState("50");
  const v = Number(valor);
  const ok = apostaValida(v, saldo);
  const abertos = r.lista.filter((d) => d.estado === "aberto");
  const jogando = r.lista.filter((d) => d.estado === "jogando");

  return (
    <div className="dl-saguao">
      <div className="mesa-topo">
        <div className="mesa-topo-grupo">
          <span className="mesa-selo ouro">Pênalti x1</span>
          <span className="mesa-selo">5 cobranças para cada</span>
        </div>
        <span className="mesa-selo">Sem taxa: quem vence leva 2×</span>
      </div>

      <p className="rm-rotulo">Duelos abertos</p>
      {abertos.length > 0 ? (
        <ul className="dl-lista">
          {abertos.map((d) => {
            const f = quem(d.criador);
            const meu = d.criador === eu;
            return (
              <li key={d.id}>
                <Avatar f={f ?? null} size="xs" />
                <span className="dl-info">
                  <b>{f?.name ?? "Alguém"}</b>
                  <small>
                    aposta {formatarMoedas(d.aposta)} · leva {formatarMoedas(d.aposta * 2)}
                  </small>
                </span>
                {meu ? (
                  <button type="button" className="btn soft sm" onClick={() => r.irPara(d.id)}>
                    Ver o meu
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn sm"
                    disabled={r.enviando || (saldo !== undefined && saldo < d.aposta)}
                    aria-label={`Desafiar ${f?.name ?? "alguém"} valendo ${d.aposta} moedas`}
                    onClick={() => void r.entrar(d.id)}
                  >
                    Desafiar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hint dl-vazio">Nenhum duelo aberto. Abra um e chame a turma.</p>
      )}

      {jogando.length > 0 && (
        <>
          <p className="rm-rotulo">Em jogo agora</p>
          <ul className="dl-lista">
            {jogando.map((d) => {
              const a = quem(d.criador), b = quem(d.desafiante);
              return (
                <li key={d.id}>
                  <span className="dl-rostos" aria-hidden="true">
                    <Avatar f={a ?? null} size="xs" />
                    <Avatar f={b ?? null} size="xs" />
                  </span>
                  <span className="dl-info">
                    <b>
                      {a?.name ?? "Alguém"} {d.golsCriador} × {d.golsDesafiante} {b?.name ?? "Alguém"}
                    </b>
                    <small>valendo {formatarMoedas(d.aposta * 2)}</small>
                  </span>
                  <button type="button" className="btn soft sm" onClick={() => r.irPara(d.id)}>
                    Assistir
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <form
        className="dl-novo av-painel"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) void r.abrir(v);
        }}
      >
        <label className="rm-rotulo" htmlFor="dueloValor">
          Abrir um duelo valendo
        </label>
        <div className="dl-valor">
          <input
            id="dueloValor"
            type="number"
            inputMode="numeric"
            min={APOSTA_MIN}
            max={saldo}
            step={1}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <button type="button" className="dl-allin" disabled={!saldo || saldo < APOSTA_MIN} onClick={() => setValor(String(saldo ?? 0))}>
            All-in
          </button>
        </div>
        <div className="dl-chips" role="group" aria-label="Valores rápidos">
          {atalhosDo(saldo).map((x) => (
            <button key={x} type="button" className={"dl-chip" + (v === x ? " on" : "")} aria-pressed={v === x} onClick={() => setValor(String(x))}>
              {formatarMoedas(x)}
            </button>
          ))}
        </div>
        <button type="submit" className="rm-girar" disabled={!ok || r.enviando}>
          {ok ? `Abrir duelo de ${formatarMoedas(v)}` : saldo !== undefined && v > saldo ? "Sem moedas para esse valor" : `A aposta mínima é ${APOSTA_MIN}`}
        </button>
        <p className="hint">Quem entrar paga o mesmo valor. Ninguém em 10 minutos? O duelo some e a aposta volta.</p>
      </form>

      <Ranking ativa={ativa} />
    </div>
  );
}

/* ---------- a partida ---------- */
function Placar({ d, eu }: { d: DueloT; eu: string | null }) {
  const quem = useNome();
  const lado = (l: Lado) => {
    const uid = l === "criador" ? d.criador : d.desafiante;
    const f = quem(uid);
    const gols = l === "criador" ? d.golsCriador : d.golsDesafiante;
    const bate = d.atual && d.atual.batedor === uid;
    return (
      <div className={"dl-lado" + (bate ? " bate" : "")}>
        <Avatar f={f ?? null} size="xs" />
        <span className="dl-nome">
          {f?.name ?? (uid ? "Alguém" : "esperando…")}
          {uid && uid === eu ? <small> (você)</small> : null}
        </span>
        <b className="dl-gols">{gols}</b>
        <ol className="dl-bolinhas" aria-label={`Cobranças de ${f?.name ?? "alguém"}`}>
          {bolinhas(d, l).map((b, k) => (
            <li key={k} className={b ?? "falta"} aria-label={b === "gol" ? "gol" : b === "perdeu" ? "perdeu" : "ainda não bateu"}>
              {b === "gol" ? "✓" : b === "perdeu" ? "✗" : ""}
            </li>
          ))}
        </ol>
      </div>
    );
  };
  return (
    <div className="dl-placar">
      {lado("criador")}
      <span className="dl-x" aria-hidden="true">×</span>
      {lado("desafiante")}
    </div>
  );
}

function Relogio({ fracao, segundos }: { fracao: number; segundos: number }) {
  const C = 2 * Math.PI * 17;
  return (
    <div className={"dl-relogio" + (segundos <= 5 ? " pouco" : "")} role="timer" aria-label={`${segundos} segundos`}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" className="dl-relogio-fundo" />
        <circle cx="20" cy="20" r="17" className="dl-relogio-anel" strokeDasharray={C} strokeDashoffset={C * (1 - fracao)} />
      </svg>
      <b>{segundos}</b>
    </div>
  );
}

function Partida({ r }: { r: Rede }) {
  const d = r.duelo;
  const eu = useApp((s) => s.myUid);
  const quem = useNome();
  const agora = useAgora(r.agoraBanco);
  const [lance, setLance] = useState<Lance | null>(null);
  const visto = useRef<{ id: number; n: number }>({ id: 0, n: 0 });
  const agoraBanco = r.agoraBanco;
  /* os passos do lance não são cancelados (a próxima resposta do banco não pode cortar a animação); só não mexem mais depois de sair da tela */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  /* cobrança nova resolvida: anima o lance (só se ainda está nos 3 s dele; ao recarregar, não repete os antigos) */
  useEffect(() => {
    if (!d) return;
    const ult = d.chutes[d.chutes.length - 1];
    if (visto.current.id !== d.id) visto.current = { id: d.id, n: 0 };
    if (!ult || ult.n <= visto.current.n) return;
    const novo = visto.current.n > 0 || agoraBanco() - ult.resolvidoEm < REVELA_MS;
    visto.current = { id: d.id, n: ult.n };
    if (!novo) return;
    const base = { n: ult.n, zb: ult.zonaBatedor, zg: ult.zonaGoleiro, gol: ult.gol };
    const resta = Math.max(800, REVELA_MS - Math.max(0, agoraBanco() - ult.resolvidoEm));
    const voo = reduzMovimento() ? 0 : 560;
    const passo = (ms: number, f: () => void) => setTimeout(() => vivo.current && f(), ms);
    passo(30, () => setLance({ ...base, fase: "voando" }));
    passo(30 + voo, () => setLance({ ...base, fase: ult.gol ? "parou" : "rebateu" }));
    passo(resta, () => setLance((l) => (l?.n === ult.n && d.estado === "jogando" ? null : l)));
  }, [d, agoraBanco]);

  if (!d) return <p className="hint">Carregando o duelo…</p>;

  const m = momento(d, agora);
  const papel = meuPapel(d, eu);
  const lado = meuLado(d, eu);
  const atual = d.atual;
  const aberta = m === "escolher" && atual && agora >= atual.abreEm && agora < atual.ate;
  const escolhi = !!atual?.minha;
  const outro = lado === "criador" ? quem(d.desafiante) : quem(d.criador);
  const podeTocar = aberta && papel !== "plateia" && !escolhi && !r.enviando;
  const t = atual ? tempoRestante(atual, agora) : null;
  const placa = lance && lance.fase !== "voando" ? (lance.gol ? "gol" : "defendeu") : null;
  /* o meio do x1 fica na meia-altura: o goleiro agacha um pouco ("centro"); nos cantos, pula alto ou baixo */
  const mergulho = lance ? ["esq", "meio", "dir"][colunaDaZona(lance.zg)] + (lance.zg === "meio" ? " centro" : zonaAlta(lance.zg) ? " alto" : " baixo") : "";
  /* defendeu: a bola fica na luva */
  const classeBola = !lance ? "" : lance.fase === "rebateu" ? ` dz-${lance.zb} pega` : ` dz dz-${lance.zb}`;
  const nomeBatedor = atual ? (atual.batedor === eu ? "Você" : quem(atual.batedor)?.name ?? "Alguém") : "";
  const nomeGoleiro = atual ? (atual.goleiro === eu ? "você" : quem(atual.goleiro)?.name ?? "alguém") : "";

  let dica = "";
  if (m === "aberto") dica = lado ? "Esperando um adversário…" : "Esperando um adversário";
  else if (m === "cancelado") dica = "Duelo cancelado: a aposta voltou";
  else if (m === "escolher" && atual) {
    if (!aberta) dica = "Preparando a cobrança…";
    else if (papel === "batedor") dica = escolhi ? `Você vai bater ${NOME_ZONA[atual.minha!]}. Esperando o goleiro…` : "Você bate: escolha o canto";
    else if (papel === "goleiro") dica = escolhi ? `Você vai pular ${NOME_ZONA[atual.minha!]}. Esperando o batedor…` : "Você defende: escolha o canto do pulo";
    else dica = `${nomeBatedor} bate, ${nomeGoleiro} defende`;
  }

  return (
    <div className="dl-partida">
      <div className="mesa-topo">
        <div className="mesa-topo-grupo">
          <span className="mesa-selo ouro">Pênalti x1</span>
          <span className="mesa-selo">
            {d.estado === "aberto" ? `aposta ${formatarMoedas(d.aposta)}` : `valendo ${formatarMoedas(d.aposta * 2)}`}
          </span>
        </div>
        {atual && d.estado === "jogando" && <span className="mesa-selo">{nomeCobranca(atual.n)}</span>}
      </div>

      <Placar d={d} eu={eu} />

      <div className={"pn-campo" + (placa ? " " + placa : "")}>
        <div className="pn-torcida" aria-hidden="true" />
        <span className="pn-refletor e" aria-hidden="true" />
        <span className="pn-refletor d" aria-hidden="true" />
        <div className="pn-gramado" aria-hidden="true">
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none">
            <path d="M120 40 L880 40 L1000 300 M120 40 L0 300" className="pn-linha" />
            <path d="M300 40 L270 120 L730 120 L700 40" className="pn-linha" />
            <ellipse cx="500" cy="232" rx="9" ry="4" className="pn-marca" />
          </svg>
        </div>
        <div className="pn-gol">
          <div className="pn-rede" aria-hidden="true" />
          <div className="pn-trave" aria-hidden="true" />
          <div className={"pn-goleiro " + mergulho} aria-hidden="true">
            <Goleiro />
          </div>
          {d.estado === "jogando" && (
            <div className="dl-zonas" role="group" aria-label={papel === "goleiro" ? "Escolha o canto para defender" : papel === "batedor" ? "Escolha o canto do chute" : "Cantos do gol"}>
              {ZONAS.map((z) => (
                <button
                  key={z}
                  type="button"
                  className={`pn-zona dl-zona ${z}` + (atual?.minha === z ? " minha" : "")}
                  disabled={!podeTocar}
                  aria-label={papel === "goleiro" ? `Defender ${NOME_ZONA[z]}` : papel === "batedor" ? `Bater ${NOME_ZONA[z]}` : NOME_ZONA[z]}
                  onClick={() => void r.escolher(z)}
                >
                  {podeTocar && <span className="dl-zona-txt">{papel === "goleiro" ? "Defender" : "Bater"}</span>}
                  {atual?.minha === z && aberta && <span className="pn-mira" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={"pn-bola" + classeBola} aria-hidden="true">
          <Bola />
        </div>
        <span className="pn-bola-sombra" aria-hidden="true" />
        {aberta && t && <Relogio fracao={t.fracao} segundos={t.segundos} />}
        {placa && (
          <div className={"pn-placa " + placa} aria-live="assertive">
            {placa === "gol" ? "GOL!" : "DEFENDEU!"}
          </div>
        )}
        {!lance && dica && (
          <p className="pn-dica" aria-live="polite">
            {dica}
          </p>
        )}
      </div>

      {m === "aberto" && lado === "criador" && (
        <div className="av-painel dl-espera">
          <p className="pn-agora">
            Seu duelo de <b>{formatarMoedas(d.aposta)}</b> está aberto. Some em {Math.max(0, Math.ceil((d.expiraEm - agora) / 60000))} min se ninguém entrar.
          </p>
          <button type="button" className="btn soft" disabled={r.enviando} onClick={() => void r.cancelar()}>
            Cancelar e pegar a aposta de volta
          </button>
        </div>
      )}

      {m === "escolher" && atual && papel !== "plateia" && (
        <p className="dl-vez" aria-live="polite">
          {papel === "batedor"
            ? atual.goleiroEscolheu
              ? `${outro?.name ?? "O goleiro"} já escolheu o canto.`
              : `${outro?.name ?? "O goleiro"} ainda está escolhendo.`
            : atual.batedorEscolheu
              ? `${outro?.name ?? "O batedor"} já escolheu o canto.`
              : `${outro?.name ?? "O batedor"} ainda está escolhendo.`}{" "}
          Quem não escolher em 15 s fica com um canto sorteado.
        </p>
      )}

      {(d.estado === "jogando" || d.estado === "fim") && <ChatDuelo d={d} eu={eu} />}

      {(m === "fim" || m === "cancelado") && <Resultado d={d} eu={eu} />}

      {m === "fim" || m === "cancelado" ? (
        <VoltaSozinho key={d.id} segundos={8} onVoltar={() => r.irPara(null)} />
      ) : (
        !lado && (
          <button type="button" className="btn soft dl-voltar" onClick={() => r.irPara(null)}>
            Voltar aos duelos
          </button>
        )
      )}
      {m !== "fim" && d.chutes.length > 0 && <UltimoLance d={d} />}
    </div>
  );
}

function UltimoLance({ d }: { d: DueloT }) {
  const quem = useNome();
  const c = d.chutes[d.chutes.length - 1];
  const b = quem(c.batedor)?.name ?? "Alguém", g = quem(c.goleiro)?.name ?? "alguém";
  return (
    <p className="hint dl-ultimo">
      Última: {b} bateu {NOME_ZONA[c.zonaBatedor]}
      {c.sorteouBatedor ? " (sorteado)" : ""}, {g} pulou {NOME_ZONA[c.zonaGoleiro]}
      {c.sorteouGoleiro ? " (sorteado)" : ""}: {c.gol ? "gol" : "defendeu"}.
    </p>
  );
}

function Resultado({ d, eu }: { d: DueloT; eu: string | null }) {
  const quem = useNome();
  const placar = `${Math.max(d.golsCriador, d.golsDesafiante)} a ${Math.min(d.golsCriador, d.golsDesafiante)}`;
  let texto: string, bom = false;
  if (d.estado === "cancelado") texto = "Ninguém entrou: a aposta voltou para a carteira.";
  else if (!d.vencedor) texto = "Empate até o fim da morte súbita: as duas apostas voltaram.";
  else if (d.vencedor === eu) {
    bom = true;
    texto = `Você venceu ${placar} e levou ${formatarMoedas(d.aposta * 2)} moedas!`;
  } else if (meuLado(d, eu)) texto = `${quem(d.vencedor)?.name ?? "O outro"} venceu ${placar}. Você perdeu ${formatarMoedas(d.aposta)} moedas.`;
  else texto = `${quem(d.vencedor)?.name ?? "Alguém"} venceu ${placar} e levou ${formatarMoedas(d.aposta * 2)} moedas.`;
  return (
    <p className={"av-res dl-fim " + (bom ? "bom" : d.vencedor && meuLado(d, eu) ? "ruim" : "")} role="status">
      {texto}
    </p>
  );
}

/** Acabou o duelo: mostra o resultado por alguns segundos e volta sozinho ao saguão (ou na hora, no botão). */
function VoltaSozinho({ segundos, onVoltar }: { segundos: number; onVoltar: () => void }) {
  const [desde] = useState(() => Date.now());
  const [agora, setAgora] = useState(desde);
  const volta = useRef(onVoltar);
  useEffect(() => {
    volta.current = onVoltar;
  });
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 250);
    const fim = setTimeout(() => volta.current(), segundos * 1000);
    return () => {
      clearInterval(t);
      clearTimeout(fim);
    };
  }, [segundos]);
  const falta = Math.max(0, Math.ceil((desde + segundos * 1000 - agora) / 1000));
  return (
    <button type="button" className="btn soft dl-voltar" onClick={() => volta.current()}>
      Voltar aos duelos agora <small>· volta sozinho em {falta} s</small>
    </button>
  );
}

export function Duelo({ ativa = true }: { ativa?: boolean }) {
  const r = useDuelo(ativa);
  if (r.ligado === false) return <p className="hint">O Pênalti x1 ainda não foi ligado no banco (seção 48 do seguranca.sql).</p>;
  return <div className="rm penalti duelo">{r.id ? <Partida r={r} /> : <Saguao r={r} ativa={ativa} />}</div>;
}
