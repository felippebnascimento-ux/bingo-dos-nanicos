"use client";
/*
 * Tela de Início (abre depois do login), em três faixas: "Seu dia" (moedas, posição, sequência e missões),
 * "Acontecendo agora" (partida, transmissão, mesa de truco; some quando não tem nada) e os lugares do site,
 * com o ranking de moedas ao lado. Tudo lê o que já está no store e nos módulos (o ranking usa a mesma
 * leitura das carteiras do painel do ranking).
 */
import { useMemo, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcCoroa } from "@/components/ui/icones";
import { useMissoes } from "@/features/missoes/missoesDados";
import { Fundo } from "@/features/hall/Sala";
import { riotEmJogo, useRiot } from "@/features/jogar/riot";
import { useTruco } from "@/features/truco/mesa";
import { useCarteira } from "@/lib/carteira";
import { abrirCarteira, useMinhaPosicao, useRanking } from "@/features/moedas/Ranking";
import { bonecoOf } from "@/lib/dados/nanicos";
import { LANES } from "@/lib/dados/campeoes";
import { bonusDoDia, diasSeguidos, formatarMoedas, ordinal } from "@/lib/moedas";
import { umPorNanico } from "@/lib/presenca";
import { friendDaPresenca, friendOf, MY_KEY, salaLol, setApp, useApp } from "@/lib/store";
import type { Aba } from "@/lib/tipos";

/** Recorte do Sítio para a capa (sem bonecos e sem animação). */
const VB_CAPA = { x: 300, y: 120, w: 920, h: 575 };
/** Os 5 bonecos da marca, parados de frente (recorte da mesma folha do hall). */
const MARCA_NOMES = ["Gamer", "Max", "Pitoco", "Alemão", "Henry"];

function Cartao({ titulo, linha, acao, aria, onClick, capa, classe }: { titulo: string; linha: string; acao: string; aria: string; onClick: () => void; capa: ReactNode; classe: string }) {
  return (
    <button type="button" className={"cartao " + classe} aria-label={aria} onClick={onClick}>
      <span className="cartao-capa" aria-hidden="true">
        {capa}
      </span>
      <span className="cartao-pe">
        <span>
          <b>{titulo}</b>
          <small>{linha}</small>
        </span>
        <em>{acao} →</em>
      </span>
    </button>
  );
}

function Rostos({ ids }: { ids: (string | null)[] }) {
  const friends = useApp((s) => s.friends);
  const lista = ids.map((id) => friendOf(id, friends)).filter((f): f is NonNullable<typeof f> => !!f).slice(0, 7);
  if (!lista.length) return null;
  return (
    <span className="cartao-rostos">
      {lista.map((f) => (
        <Avatar key={f.id} f={f} size="xs" />
      ))}
    </span>
  );
}

const ir = (aba: Aba) => () => setApp({ aba });

/** Ranking de moedas no Início: os 5 primeiros e, se eu estiver mais para baixo, a minha linha. */
function RankingInicio() {
  const lista = useRanking();
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  if (!lista) return null;
  const top = lista.filter((l) => l.saldo !== null).slice(0, 5);
  const eu = lista.find((l) => !!myUid && l.userId === myUid);
  const linhas = eu && !top.includes(eu) ? [...top, eu] : top;
  return (
    <section className="block inicio-ranking" aria-labelledby="inicioRanking">
      <h2 id="inicioRanking">Ranking de moedas</h2>
      <ol className="ranking">
        {linhas.map((l) => {
          const f = friendOf(l.fid, friends);
          const souEu = !!myUid && l.userId === myUid;
          return (
            <li key={l.fid} className={souEu ? "eu" : undefined}>
              <button type="button" onClick={() => setApp({ fichaAberta: l.fid })} aria-label={`${l.pos ? ordinal(l.pos) + " lugar, " : ""}${l.nome}, ${formatarMoedas(l.saldo ?? 0)} moedas. Abrir a ficha`}>
                <span className="ranking-pos">{l.pos ? ordinal(l.pos) : "—"}</span>
                <span className="ranking-rosto">
                  {l.pos === 1 && <IcCoroa className="ranking-coroa" tam={18} />}
                  {f ? <Avatar f={f} size="xs" /> : <span className="av xs">{l.nome[0]}</span>}
                </span>
                <span className="ranking-nome">{souEu ? "Você" : l.nome}</span>
                <b>{formatarMoedas(l.saldo ?? 0)}</b>
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="btn soft sm" onClick={abrirCarteira}>
        Ver ranking completo
      </button>
    </section>
  );
}

export function InicioView({ hidden }: { hidden: boolean }) {
  const online = useApp((s) => s.online);
  const friends = useApp((s) => s.friends);
  const myName = useApp((s) => s.myName);
  const myFid = useApp((s) => s.myFid);
  const myLiveSid = useApp((s) => s.myLiveSid);
  const lineup = useApp((s) => s.lineup);
  const phrases = useApp((s) => s.phrases);
  const temJogar = useApp((s) => !s.salas.length || !!salaLol(s));
  const carteira = useCarteira((s) => s.carteira);
  const posicao = useMinhaPosicao();
  const mesas = useTruco((s) => s.mesas);
  const jogos = useRiot((s) => s.jogos);
  const missoes = useMissoes((s) => s.missoes);

  const gente = umPorNanico(online, MY_KEY);
  const naoTenhoPresenca = myName && !gente.some((p) => p.key === MY_KEY);
  const nOnline = gente.length + (naoTenhoPresenca ? 1 : 0);
  const fidsHall = [myFid, ...gente.filter((p) => p.key !== MY_KEY).map((p) => friendDaPresenca(p, friends)?.id ?? null)];
  const quemTransmite = gente.find((p) => p.live && p.key !== MY_KEY);
  const aoVivo = !!myLiveSid || !!quemTransmite;
  const nomeLive = myLiveSid ? "Você" : quemTransmite ? (friendDaPresenca(quemTransmite, friends)?.name ?? quemTransmite.name) : "";
  const abertas = mesas.filter((m) => m.fase === "espera");
  const falta = abertas.reduce((n, m) => n + m.lugares.filter((l) => !l).length, 0);
  const naMesa = mesas.flatMap((m) => m.lugares.filter(Boolean).map((l) => l!.fid));
  const emJogo = riotEmJogo(jogos);
  const algumEmPartida = lineup.some((l) => l.friendId && emJogo.has(l.friendId)) || jogos.length > 0;
  /* as 3 nanicadas mais novas */
  const tres = useMemo(() => [...phrases].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3), [phrases]);
  const hoje = new Date().toDateString();
  const novasHoje = phrases.filter((p) => new Date(p.createdAt).toDateString() === hoje).length;
  const eu = friendOf(myFid, friends);

  return (
    <section id="view-inicio" className="inner" hidden={hidden}>
      <header className="inicio-topo">
        <button type="button" className="inicio-marca" aria-label="Bingo dos Nanicos: voltar ao Início" onClick={ir("inicio")}>
          <span className="inicio-faixa" aria-hidden="true">
            {MARCA_NOMES.map((n) => {
              const folha = bonecoOf({ name: n });
              return folha ? <span key={n} className="inicio-boneco" style={{ backgroundImage: `url(${folha})` }} /> : null;
            })}
          </span>
          <span>
            <b>Bingo dos Nanicos</b>
            <small>
              Sítio do Mitz · {nOnline} online agora
            </small>
          </span>
        </button>
        <span className="inicio-chips">
          {carteira && (
            <button type="button" className="inicio-chip" aria-label={`${formatarMoedas(carteira.saldo)} moedas${posicao ? `, ${posicao}` : ""}. Abrir o ranking`} onClick={abrirCarteira}>
              <span className="hall-moeda" aria-hidden="true">$</span>
              <b>{formatarMoedas(carteira.saldo)}</b>
              {posicao && <span>· {posicao}</span>}
            </button>
          )}
          {carteira && (
            <button type="button" className="inicio-chip" onClick={ir("loja")}>
              <b>Loja</b>
            </button>
          )}
          {eu && (
            <button type="button" className="inicio-chip" aria-label="Abrir a minha ficha" onClick={() => setApp({ fichaAberta: eu.id })}>
              <Avatar f={eu} size="xs" />
              <b>{eu.name}</b>
            </button>
          )}
        </span>
      </header>

      <div className="inicio-oi">
        <h1>E aí, {myName || "nanico"}</h1>
      </div>

      {carteira && (
        <div className="inicio-dia" aria-label="Seu dia">
          <button type="button" className="dia-item" onClick={abrirCarteira}>
            <small>Moedas</small>
            <b>{formatarMoedas(carteira.saldo)}</b>
            <span>{posicao || "ver ranking"}</span>
          </button>
          <button type="button" className="dia-item" onClick={() => setApp({ aba: "perfil" })}>
            <small>Sequência</small>
            <b>{carteira.seq || 0}</b>
            <span>{carteira.seq ? diasSeguidos(carteira.seq) : "começa hoje"}</span>
          </button>
          <button type="button" className="dia-item" onClick={() => setApp({ aba: "perfil" })}>
            <small>Bônus de hoje</small>
            <b>{carteira.pegouHoje ? `+${bonusDoDia(carteira.seq)}` : "—"}</b>
            <span>{carteira.pegouHoje ? "já está na carteira" : "volte amanhã também"}</span>
          </button>
          {missoes.length > 0 && (
            <button type="button" className="dia-item" onClick={ir("hall")}>
              <small>Missões do dia</small>
              <b>
                {missoes.filter((m) => m.feita).length} de {missoes.length}
              </b>
              <span>{missoes.find((m) => !m.feita)?.texto ?? "todas feitas"}</span>
            </button>
          )}
        </div>
      )}

      {(algumEmPartida || aoVivo || abertas.length > 0) && (
        <section className="inicio-agora" aria-labelledby="inicioAgora">
          <h2 id="inicioAgora">Acontecendo agora</h2>
          <ul>
            {algumEmPartida && (
              <li>
                <span className="ingame-pill">EM PARTIDA</span>
                <span className="agora-txt">{jogos.length > 1 ? `${jogos.length} partidas com nanicos` : "Tem nanico jogando: aposte nos 5 primeiros minutos"}</span>
                <button type="button" className="btn sm" onClick={temJogar ? ir("jogar") : () => setApp({ salasAberto: true })}>
                  {temJogar ? "Ver e apostar" : "Entrar numa sala"}
                </button>
              </li>
            )}
            {aoVivo && (
              <li>
                <span className="live-pill">AO VIVO</span>
                <span className="agora-txt">{nomeLive} está transmitindo</span>
                <button type="button" className="btn sm" onClick={ir("live")}>
                  Assistir
                </button>
              </li>
            )}
            {abertas.length > 0 && (
              <li>
                <span className="agora-selo">TRUCO</span>
                <span className="agora-txt">
                  {abertas.length === 1 ? "Uma mesa esperando" : `${abertas.length} mesas esperando`}
                  {falta ? ` · falta ${falta}` : ""}
                </span>
                <button type="button" className="btn sm" onClick={ir("truco")}>
                  Sentar
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="inicio-corpo">
        <div className="inicio-cartoes">
        <Cartao
          classe="c-sitio"
          titulo="Sítio"
          linha={`${nOnline} ${nOnline === 1 ? "nanico" : "nanicos"} no hall agora`}
          acao="Entrar"
          aria={`Entrar no Sítio, ${nOnline} no hall agora`}
          onClick={ir("hall")}
          capa={
            <span className="hall capa-sitio">
              <Fundo aoVivo={aoVivo} vb={VB_CAPA} />
              <Rostos ids={fidsHall} />
            </span>
          }
        />
        <Cartao
          classe="c-truco"
          titulo="Truco"
          linha={abertas.length ? `${abertas.length} ${abertas.length === 1 ? "mesa aberta" : "mesas abertas"}${falta ? ` · falta ${falta}` : ""}` : "Nenhuma mesa aberta"}
          acao="Jogar"
          aria="Abrir o Truco"
          onClick={ir("truco")}
          capa={
            <>
              <span className="capa-cartas">
                <i />
                <i>
                  1<br />♥
                </i>
                <i />
              </span>
              <Rostos ids={naMesa} />
            </>
          }
        />
        <Cartao
          classe="c-live"
          titulo="Ao vivo"
          linha={aoVivo ? `${nomeLive} está transmitindo` : "Ninguém transmitindo"}
          acao="Assistir"
          aria={aoVivo ? `Abrir o Ao vivo: ${nomeLive} transmitindo` : "Abrir o Ao vivo"}
          onClick={ir("live")}
          capa={
            <>
              {aoVivo && <span className="live-pill cartao-selo">AO VIVO</span>}
              <span className={"capa-tela" + (aoVivo ? " ligada" : "")} />
            </>
          }
        />
        <Cartao
          classe="c-jogar"
          titulo="Jogar"
          linha={temJogar ? "Escalação e cartela" : "Entre numa sala de LoL para jogar"}
          acao="Abrir"
          aria="Abrir o Jogar"
          onClick={temJogar ? ir("jogar") : () => setApp({ salasAberto: true })}
          capa={
            <>
              {algumEmPartida && <span className="ingame-pill cartao-selo">EM PARTIDA</span>}
              <span className="capa-rotas">
                {LANES.map((rota, k) => {
                  const f = friendOf(lineup[k]?.friendId, friends);
                  return (
                    <span key={rota}>
                      {f ? <Avatar f={f} size="xs" /> : <i />}
                      <small>{rota}</small>
                    </span>
                  );
                })}
              </span>
            </>
          }
        />
        <Cartao
          classe="c-cassino"
          titulo="Cassino"
          linha="Roleta, limbo, maior ou menor e caça-níquel"
          acao="Apostar"
          aria="Abrir o Cassino"
          onClick={ir("cassino")}
          capa={<span className="capa-roleta" />}
        />
        <Cartao
          classe="c-nanicadas"
          titulo="Nanicadas"
          linha={`${phrases.length} cadastradas${novasHoje ? ` · ${novasHoje} ${novasHoje === 1 ? "nova" : "novas"} hoje` : ""}`}
          acao="Ver"
          aria="Abrir as Nanicadas"
          onClick={ir("frases")}
          capa={
            <span className="capa-baloes">
              {tres.map((p) => (
                <span key={p.id}>“{p.text}”</span>
              ))}
            </span>
          }
        />
        </div>
        <RankingInicio />
      </div>
      <p className="hint inicio-rodape">Ao entrar no site, o seu boneco já aparece no Sítio para todo mundo, mesmo que você fique aqui no Início.</p>
    </section>
  );
}
