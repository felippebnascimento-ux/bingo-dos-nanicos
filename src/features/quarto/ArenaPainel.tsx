"use client";
/*
 * Painel da arena (seção 58), por cima da cena: os dois times, Entrar / Sair / Começar, a contagem, o tempo, o placar
 * de pisos pintados e quem ganhou. A pintura em si sai de arena.ts.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { comecarArena, entrarNaArena, faseDa, iniciarArena, placar, sairDaArena, useArena, type Time } from "./arena";

const NOME: Record<Time, string> = { azul: "Azul", vermelho: "Vermelho" };

export function ArenaPainel() {
  const partida = useArena((s) => s.partida);
  const pisos = useArena((s) => s.pisos);
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    iniciarArena();
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const fase = faseDa(partida, agora);
  const pts = placar(pisos);
  const meuTime = partida && myUid ? partida.times[myUid] : undefined;
  const nomes = (t: Time) =>
    Object.entries(partida?.times ?? {})
      .filter(([, x]) => x === t)
      .map(([uid]) => friends.find((f) => f.user_id === uid)?.name ?? "?");
  const seg = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
  const vencedor: Time | "empate" = pts.azul === pts.vermelho ? "empate" : pts.azul > pts.vermelho ? "azul" : "vermelho";

  return (
    <div className="arena-painel" onClick={(e) => e.stopPropagation()}>
      <div className="arena-placar" aria-live="polite">
        <span className="arena-time azul">
          <b>{pts.azul}</b> Azul
        </span>
        <span className="arena-relogio">
          {fase === "contagem" && partida?.comeca ? `Começa em ${seg(partida.comeca - agora)}` : fase === "jogando" && partida?.acaba ? `${seg(partida.acaba - agora)} s` : fase === "fim" ? (vencedor === "empate" ? "Empate!" : `${NOME[vencedor]} venceu!`) : "Esperando"}
        </span>
        <span className="arena-time vermelho">
          Vermelho <b>{pts.vermelho}</b>
        </span>
      </div>
      {(fase === "esperando" || fase === "fim") && (
        <>
          <p className="hint arena-times">
            <span className="azul">Azul: {nomes("azul").join(", ") || "ninguém"}</span> · <span className="vermelho">Vermelho: {nomes("vermelho").join(", ") || "ninguém"}</span>
          </p>
          <div className="arena-botoes">
            {fase === "esperando" && meuTime ? (
              <>
                <button type="button" className="btn soft sm" onClick={() => void sairDaArena()}>
                  Sair do time
                </button>
                <button type="button" className="btn sm" onClick={() => void comecarArena()}>
                  Começar a partida
                </button>
              </>
            ) : (
              <button type="button" className="btn sm" onClick={() => void entrarNaArena()}>
                {fase === "fim" ? "Jogar de novo" : "Entrar num time"}
              </button>
            )}
          </div>
          <p className="hint arena-regra">Dois times, 90 segundos: ande pela arena e o chão por onde você passa fica da cor do seu time. Ganha quem pintar mais.</p>
        </>
      )}
      {(fase === "contagem" || fase === "jogando") && meuTime && <p className={"arena-meu " + meuTime}>Você é do time {NOME[meuTime]}: corra pelo chão!</p>}
    </div>
  );
}
