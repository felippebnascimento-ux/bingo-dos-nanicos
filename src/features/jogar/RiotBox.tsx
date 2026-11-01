"use client";
/* Caixa "EM PARTIDA" da aba Jogar: os dois times, bans, tempo de jogo e o botão de usar na escalação. */
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { friendOf, useApp } from "@/lib/store";
import { mmss } from "@/lib/util";
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

function Partida({ g }: { g: RiotPartida }) {
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
      </div>
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
