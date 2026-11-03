"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { friendOf, useApp } from "@/lib/store";
import { local } from "@/lib/util";
import { abrirMesa, TR_VALORES, useTruco, verMesa } from "./mesa";

type Opt = { modo: 2 | 4; alvo: number; flor: boolean; valor: number };

/* opções da mesa nova ficam salvas em `truco-opt` (só conveniência) */
function lerOpt(): Opt {
  const o: Opt = { modo: 2, alvo: 24, flor: true, valor: 0 };
  const d = local.json<Record<string, unknown>>("truco-opt");
  if (d && typeof d === "object") {
    if (d.modo === 2 || d.modo === 4) o.modo = d.modo;
    if (d.alvo === 12 || d.alvo === 24 || d.alvo === 30) o.alvo = d.alvo;
    if (d.flor === false) o.flor = false;
    if ((TR_VALORES as readonly unknown[]).includes(d.valor)) o.valor = d.valor as number;
  }
  return o;
}

export function Lobby() {
  const mesas = useTruco((s) => s.mesas);
  const valores = useTruco((s) => s.valores);
  const friends = useApp((s) => s.friends);
  const myFid = useApp((s) => s.myFid);
  const myUid = useApp((s) => s.myUid);
  const [opt, setOptState] = useState(lerOpt);
  const setOpt = (p: Partial<Opt>) => {
    const o = { ...opt, ...p };
    setOptState(o);
    local.setJson("truco-opt", o);
  };
  const lista = mesas.slice().sort((a, b) => (a.fase === "espera" ? 0 : 1) - (b.fase === "espera" ? 0 : 1));

  return (
    <div className="tr-lobby">
      <div className="block tr-nova">
        <h2>Abrir uma mesa</h2>
        <div className="seg" role="radiogroup" aria-label="Quantos jogam">
          {([[2, "1 contra 1"], [4, "2 contra 2"]] as const).map(([v, t]) => (
            <button key={v} type="button" role="radio" aria-checked={opt.modo === v} onClick={() => setOpt({ modo: v })}>
              {t}
            </button>
          ))}
        </div>
        <div className="seg three" role="radiogroup" aria-label="Pontos para ganhar">
          {[12, 24, 30].map((v) => (
            <button key={v} type="button" role="radio" aria-checked={opt.alvo === v} onClick={() => setOpt({ alvo: v })}>
              Até {v}
            </button>
          ))}
        </div>
        <div className="seg tr-valor" role="radiogroup" aria-label="Quanto vale por jogador">
          {TR_VALORES.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={opt.valor === v} onClick={() => setOpt({ valor: v })}>
              {v ? `Vale ${v}` : "Grátis"}
            </button>
          ))}
        </div>
        <p className="hint tr-valor-dica">
          {opt.valor
            ? `Cada um paga ${opt.valor} moedas ao começar e quem ganha leva o bolo de ${opt.valor * opt.modo}.`
            : "Sem moedas em jogo: quem ganha leva +15 (até 3 vitórias pagas por dia)."}
        </p>
        <label className="tr-flor">
          <input type="checkbox" id="trFlor" checked={opt.flor} onChange={(e) => setOpt({ flor: e.target.checked })} />
          Jogar com flor
        </label>
        <button className="btn" id="trAbrir" type="button" onClick={() => void abrirMesa(opt.modo, opt.alvo, opt.flor, opt.valor)}>
          Abrir mesa
        </button>
      </div>
      <div className="block tr-lista">
        <h2>Mesas</h2>
        {lista.length ? (
          <ul className="tr-mesas">
            {lista.map((m) => {
              const sent = m.lugares.filter(Boolean).length;
              const minha = m.lugares.some((l) => l && (l.key === myUid || (!!myFid && l.fid === myFid)));
              const livre = m.fase === "espera" && sent < m.modo;
              const falta = m.modo - sent;
              const estado =
                m.fase === "espera"
                  ? livre
                    ? `Falta${falta > 1 ? "m" : ""} ${falta}`
                    : "Completa"
                  : m.fase === "jogo"
                    ? `Jogando, ${m.placar[0]} a ${m.placar[1]}`
                    : "Partida encerrada";
              return (
                <li key={m.id}>
                  <div className="tr-quem">
                    {m.lugares.map((l, i) =>
                      l ? (
                        <Avatar key={i} f={friendOf(l.fid, friends) || { name: l.nome }} size="xs" />
                      ) : (
                        <span key={i} className="av xs none" aria-hidden="true" />
                      ),
                    )}
                  </div>
                  <div className="tr-info">
                    <b>Mesa do {m.lugares[0]?.nome || "?"}</b>
                    <small>
                      {m.modo === 2 ? "1 contra 1" : "2 contra 2"}, até {m.alvo}
                      {m.comFlor ? ", com flor" : ""}. {estado}
                    </small>
                    {(valores[m.id] ?? 0) > 0 && (
                      <span className="tr-vale">
                        Vale {valores[m.id]} · bolo {valores[m.id] * m.modo}
                      </span>
                    )}
                  </div>
                  <button className={"btn sm" + (minha || livre ? "" : " soft")} type="button" onClick={() => verMesa(m.id)}>
                    {minha ? "Voltar" : livre ? "Sentar" : "Assistir"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="status tr-vazio">Nenhuma mesa aberta. Abra uma e chame a galera.</p>
        )}
      </div>
    </div>
  );
}
