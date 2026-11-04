"use client";
/* Caixa "EM PARTIDA" da aba Jogar: os dois times, bans, tempo de jogo, o botão de usar na escalação e as apostas. */
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useCarteira } from "@/lib/carteira";
import { friendOf, useApp } from "@/lib/store";
import { mmss } from "@/lib/util";
import { APOSTA_MIN, nomeLado, retornoEstimado, type Lado } from "./apostas";
import { ValorAposta } from "@/features/cassino/ValorAposta";
import { apostaAberta, apostar, useApostas } from "./apostasDados";
import { riotNossoTime, type RiotJogo, type RiotParticipante, type RiotPartida } from "./partida";
import { riotPreencher, setRiotAuto, useRelogio, useRiot } from "./riot";

const FILAS: Record<number, string> = {
  0: "Personalizada", 400: "Normal (escolha)", 420: "Ranqueada Solo/Duo", 430: "Normal (às cegas)", 440: "Ranqueada Flex",
  450: "ARAM", 480: "Partida rápida", 490: "Partida rápida", 700: "Clash", 720: "Clash ARAM", 830: "Co-op vs IA",
  840: "Co-op vs IA", 850: "Co-op vs IA", 870: "Co-op vs IA", 880: "Co-op vs IA", 890: "Co-op vs IA", 900: "URF",
  1020: "Um por Todos", 1300: "Nexus Blitz", 1700: "Arena", 1900: "URF", 2400: "ARAM: Caos",
};

/* a imagem vem de um endereço montado com dado de fora: só passa id e versão com caracteres seguros */
const SAFE_ID = /^[A-Za-z0-9]{1,40}$/,
  SAFE_V = /^[0-9.]{1,20}$/;
const champImg = (j: RiotJogo, img: unknown) =>
  typeof img === "string" && SAFE_ID.test(img) && SAFE_V.test(String(j.versao || ""))
    ? `https://ddragon.leagueoflegends.com/cdn/${j.versao}/img/champion/${img}.png`
    : "";

/** Iniciais do campeão quando não tem imagem. */
function ChFallback({ nome, ban }: { nome: unknown; ban?: boolean }) {
  const n = String(nome || "?").replace(/[^A-Za-zÀ-ÿ0-9]/g, "").slice(0, 2) || "?";
  return (
    <span className={"ch none" + (ban ? " ban" : "")} aria-hidden="true">
      {n}
    </span>
  );
}

/** Imagem do campeão. Se não carregar, tenta o CommunityDragon e, se falhar de novo, mostra a inicial. */
function ChImg({ src, cid, nome, ban }: { src: string; cid: number; nome: string; ban?: boolean }) {
  const [fase, setFase] = useState(0);
  if (!src || fase === 2) return <ChFallback nome={nome} ban={ban} />;
  const url =
    fase === 1 ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${cid}.png` : src;
  const erro = () => setFase(fase === 0 && cid > 0 ? 1 : 2);
  return ban ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ban" src={url} alt={nome} title={nome} width={22} height={22} onError={erro} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ch" src={url} alt="" width={32} height={32} onError={erro} />
  );
}

function RgTempo({ j, em }: { j: RiotJogo; em: number }) {
  const agora = useRelogio();
  const ini = Number(j.inicio) || 0;
  return <span className="rg-time">{mmss(ini > 0 ? (agora - ini) / 1000 : (Number(j.duracao) || 0) + (agora - em) / 1000)}</span>;
}


/** Painel "Apostar": escolhe o time e o valor, mostra o bolo de cada lado, o retorno estimado e o prazo. */
function Apostas({ g, aberto, times }: { g: RiotPartida; aberto: boolean; times: number[] }) {
  const game = Number(g.id);
  const m = useApostas((s) => s.mercados[game]);
  const minha = useApostas((s) => s.minhas[game]);
  const enviando = useApostas((s) => s.enviando);
  const saldo = useCarteira((s) => s.carteira?.saldo ?? null);
  const friends = useApp((s) => s.friends);
  const myFid = useApp((s) => s.myFid);
  const agora = useRelogio();
  const [lado, setLado] = useState<Lado | null>(null);
  const [valor, setValor] = useState(25);
  if (!m || !aberto) return null;
  /* quem está jogando só aposta no próprio time */
  const meu = (myFid && (m.nanicos[myFid] ?? g.jogo.participantes.find((p) => p && p.fid === myFid)?.time)) || null;
  const nomes = (l: Lado) =>
    friends.filter((f) => g.fids.has(f.id) && g.jogo.participantes.some((p) => p && p.fid === f.id && p.time === l)).map((f) => f.name);
  const bolo = (l: Lado) => (l === 100 ? m.bolo100 : m.bolo200);
  const falta = Math.max(0, (m.fechaEm - agora) / 1000);
  const pode = apostaAberta(m, agora);
  return (
    <div className="aposta">
      <p className="aposta-prazo">
        {minha ? (
          <>
            Você apostou <b>{minha.valor}</b> no time {nomeLado(minha.lado)}. Se vencer, volta cerca de{" "}
            <b>{retornoEstimado(minha.valor, minha.lado, m.bolo100, m.bolo200, true)}</b>.
          </>
        ) : pode ? (
          <>
            As apostas fecham em <b className="rg-time">{mmss(falta)}</b>. A casa leva 5%.
          </>
        ) : (
          "As apostas desta partida fecharam."
        )}
      </p>
      <div className="aposta-lados" role={minha || !pode ? undefined : "radiogroup"} aria-label="Time da aposta">
        {([100, 200] as const).filter((l) => times.includes(l)).map((l) => {
          const n = nomes(l);
          const bloqueado = !!meu && meu !== l;
          const escolhido = minha ? minha.lado === l : lado === l;
          return (
            <button
              key={l}
              type="button"
              role={minha || !pode ? undefined : "radio"}
              aria-checked={minha || !pode ? undefined : lado === l}
              className={"aposta-lado l" + l + (escolhido ? " on" : "")}
              disabled={!!minha || !pode || bloqueado}
              onClick={() => setLado(l)}
            >
              <b>Time {nomeLado(l)}</b>
              <small>{n.length ? n.join(", ") : "sem nanicos"}</small>
              <span>
                bolo <b>{bolo(l)}</b>
              </span>
              {bloqueado && <small>você joga do outro lado</small>}
            </button>
          );
        })}
      </div>
      {!minha && pode && (
        <>
          {/* de 5 até o saldo (seção 63) */}
          <ValorAposta valor={valor} onValor={setValor} saldo={saldo ?? undefined} />
          <div className="aposta-fim">
            <span className="hint">
              {lado ? (
                <>
                  Se o time {nomeLado(lado)} vencer, volta cerca de <b>{retornoEstimado(valor, lado, m.bolo100, m.bolo200)}</b>.
                </>
              ) : (
                "Escolha um time."
              )}
            </span>
            <button
              type="button"
              className="btn sm"
              disabled={!lado || enviando || valor < APOSTA_MIN || (saldo !== null && saldo < valor)}
              onClick={() => lado && void apostar(game, lado, valor)}
            >
              {valor < APOSTA_MIN ? "Monte a aposta" : saldo !== null && saldo < valor ? "Sem moedas" : `Apostar ${valor.toLocaleString("pt-BR")}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Botão "Apostar" do cabeçalho: só aparece com o mercado aberto ou com a minha aposta feita. */
function BotaoApostar({ g, aberto, onClick }: { g: RiotPartida; aberto: boolean; onClick: () => void }) {
  const game = Number(g.id);
  const m = useApostas((s) => s.mercados[game]);
  const minha = useApostas((s) => !!s.minhas[game]);
  const agora = useRelogio();
  if (!m || (!minha && !apostaAberta(m, agora))) return null;
  return (
    <button className={"btn sm" + (aberto ? "" : " soft")} type="button" aria-expanded={aberto} onClick={onClick}>
      {minha ? "Minha aposta" : "Apostar"}
    </button>
  );
}

function Partida({ g }: { g: RiotPartida }) {
  const [apostas, setApostas] = useState(false);
  const friends = useApp((s) => s.friends);
  const auto = useRiot((s) => s.auto);
  const j = g.jogo,
    ps = j.participantes.filter((p): p is RiotParticipante => !!p && typeof p === "object");
  const times = [...new Set(ps.map((p) => Number(p.time) || 0))].sort();
  const nos = riotNossoTime(g);
  const fila = FILAS[Number(j.queueId)] || (j.modo === "ARAM" ? "ARAM" : "Partida");
  const bans = (Array.isArray(j.bans) ? j.bans : [])
    .map((b) => ({ src: champImg(j, b && b.img), n: String((b && b.campeao) || "") }))
    .filter((b) => b.src);

  const linha = (p: RiotParticipante, k: number) => {
    const f = p.fid && g.fids.has(p.fid) ? friendOf(p.fid, friends) : null;
    const nome = String(p.riotId || "").split("#")[0];
    return (
      <div key={k} className={"rg-p" + (f ? " nan" : "")}>
        <ChImg key={champImg(j, p.img)} src={champImg(j, p.img)} cid={Number(p.campeaoId) || 0} nome={String(p.campeao || "")} />
        <span className="tx">
          <b>{String(p.campeao || "?")}</b>
          <small>{f ? f.name : nome}</small>
        </span>
        {f && <Avatar f={f} size="xs" />}
      </div>
    );
  };

  return (
    <div className="block riot-game">
      <div className="rg-head">
        <span className="live-pill">EM PARTIDA</span>
        <b>{fila}</b>
        <RgTempo j={j} em={g.em} />
        <span className="sp" />
        <label className="rg-auto">
          <input type="checkbox" checked={auto} onChange={(e) => setRiotAuto(e.target.checked)} />
          Preencher a escalação sozinho
        </label>
        <button className="btn sm" type="button" onClick={() => riotPreencher(g, true)}>
          Usar na escalação
        </button>
        <BotaoApostar g={g} aberto={apostas} onClick={() => setApostas((v) => !v)} />
      </div>
      <Apostas g={g} aberto={apostas} times={times} />
      <div className="rg-teams">
        {times.map((t) => (
          <div key={t} className="rg-team">
            <h3>{t === nos ? "Time dos nanicos" : t === 100 ? "Time azul" : t === 200 ? "Time vermelho" : "Time"}</h3>
            {ps.filter((p) => (Number(p.time) || 0) === t).map(linha)}
          </div>
        ))}
      </div>
      {bans.length > 0 && (
        <div className="rg-bans">
          Bans:{" "}
          {bans.slice(0, 10).map((b, i) => (
            <ChImg key={i + b.src} src={b.src} cid={0} nome={b.n} ban />
          ))}
        </div>
      )}
    </div>
  );
}

/** Conteúdo do #riotBox. */
export function RiotBox() {
  const jogos = useRiot((s) => s.jogos);
  const erro = useRiot((s) => s.erro);
  const off = useRiot((s) => s.off);
  return (
    <div id="riotBox" className="riot-box" aria-live="polite">
      {jogos.length
        ? jogos.map((g) => <Partida key={g.id} g={g} />)
        : erro && !off && <p className="riot-note">Partida ao vivo: {erro}</p>}
    </div>
  );
}
