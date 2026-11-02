"use client";
/*
 * Roleta do rodízio (aba Jogar, embaixo da escalação): fila de quem quer jogar, a roleta (o banco sorteia,
 * todo mundo vê girar junto) e, depois do sorteio, a escolha da rota de quem sai.
 */
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { FriendPicker } from "@/components/ui/FriendPicker";
import { IcFechar } from "@/components/ui/icones";
import { useSure } from "@/components/ui/useSure";
import { LANES } from "@/lib/dados/campeoes";
import { artOf } from "@/lib/dados/nanicos";
import { friendName, friendOf, useApp } from "@/lib/store";
import type { Friend } from "@/lib/tipos";
import { candidatos, rodadaNova, seguidas, sugestaoDeSaida } from "./rodizio";
import { carregarRodizio, colocar, desistir, filaEntrar, filaSair, girar, useRodizio, type Rodizio } from "./rodizioSala";

/** ponto da borda da roda no ângulo `a` (graus, a partir do topo, sentido horário) */
const ponto = (a: number, raio = 100) => {
  const r = (a * Math.PI) / 180;
  return `${(raio * Math.sin(r)).toFixed(2)} ${(-raio * Math.cos(r)).toFixed(2)}`;
};

/** a fatia (já com o giro da roda) está na metade de baixo? */
const embaixo = (a: number) => {
  const g = ((a % 360) + 360) % 360;
  return g > 90 && g < 270;
};

function Roda({ fatias, friends }: { fatias: string[]; friends: Friend[] }) {
  const angulo = useRodizio((s) => s.angulo);
  const girando = useRodizio((s) => s.girando);
  const n = fatias.length;
  const fatia = n ? 360 / n : 360;
  const letra = n > 8 ? 6 : n > 5 ? 7.5 : 9;
  return (
    <div className="roda">
      <span className="roda-ponteiro" aria-hidden="true" />
      <svg viewBox="-104 -104 208 208" aria-hidden="true">
        <circle r="103" className="roda-aro" />
        <g className={"roda-giro" + (girando ? " girando" : "")} style={{ transform: `rotate(${angulo}deg)` }}>
          {!n && <circle r="100" className="roda-vazia" />}
          {fatias.map((fid, i) => {
            const f = friendOf(fid, friends);
            const face = f ? artOf(f)?.face : null;
            const meio = (i + 0.5) * fatia;
            const cor = "roda-f" + (n % 4 === 1 && i === n - 1 && n > 1 ? (i + 1) % 4 : i % 4);
            return (
              <g key={fid}>
                {n === 1 ? (
                  <circle r="100" className={cor} />
                ) : (
                  <path d={`M0 0 L${ponto(i * fatia)} A100 100 0 ${fatia > 180 ? 1 : 0} 1 ${ponto((i + 1) * fatia)} Z`} className={cor} />
                )}
                <g transform={`rotate(${meio})`}>
                  <clipPath id={`roda-rosto-${i}`}>
                    <circle cy="-72" r="14" />
                  </clipPath>
                  <circle cy="-72" r="15.5" className="roda-rosto-aro" />
                  {face && <image href={face} x="-14" y="-86" width="28" height="28" clipPath={`url(#roda-rosto-${i})`} />}
                  {/* nome embaixo do rosto; na metade de baixo da roda, virado para não ficar de cabeça para baixo */}
                  <text x="0" y="-46" transform={embaixo(meio + angulo) ? "rotate(180 0 -46)" : undefined} textAnchor="middle" dominantBaseline="middle" fontSize={letra} className="roda-nome">
                    {(f?.name ?? "?").toUpperCase()}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
        <circle r="20" className="roda-meio" />
      </svg>
    </div>
  );
}

/** Depois do sorteio: "X entra!", as 5 rotas (com a sugestão de quem sai) e os botões. */
function Resultado({ r, friends }: { r: Rodizio; friends: Friend[] }) {
  const lineup = useApp((s) => s.lineup);
  const ocupado = useRodizio((s) => s.ocupado);
  const [rota, setRota] = useState(() => sugestaoDeSaida(lineup, r.noTime, r.trocas));
  const sugestao = sugestaoDeSaida(lineup, r.noTime, r.trocas);
  const { sure, pedir } = useSure();
  const f = friendOf(r.sorteado, friends);
  const nome = f?.name ?? "Alguém";
  const por = friends.find((x) => x.user_id === r.sorteadoPor)?.name;
  return (
    <div className="rodizio-resultado">
      <div className="rodizio-entra">
        {f && <Avatar f={f} size="lg" />}
        <div>
          <b>{nome} entra!</b>
          <small>{por ? `Sorteado por ${por}. ` : ""}Escolha a rota de quem sai:</small>
        </div>
      </div>
      <div className="rodizio-rotas" role="radiogroup" aria-label="Rota de quem sai">
        {LANES.map((l, i) => {
          const fid = lineup[i]?.friendId || "";
          const quem = friendOf(fid, friends);
          const n = fid ? seguidas(r.noTime, r.trocas, fid) : 0;
          return (
            <button key={l} type="button" role="radio" aria-checked={rota === i} className={(rota === i ? "on" : "") + (sugestao === i ? " sugestao" : "")} onClick={() => setRota(i)}>
              <small>{l}</small>
              {quem ? <Avatar f={quem} size="xs" /> : <i aria-hidden="true" />}
              <b>{quem?.name ?? "vaga"}</b>
              <span>
                {fid ? `${n} ${n === 1 ? "seguida" : "seguidas"}` : "livre"}
                {sugestao === i && fid && " · sai"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="rodizio-botoes">
        <button type="button" className={"btn" + (sure ? " sure" : "")} disabled={ocupado} onClick={() => pedir() && colocar(rota)}>
          {sure ? "Confirmar" : "Colocar na escalação"}
        </button>
        <button type="button" className="btn soft" disabled={ocupado} onClick={() => desistir()}>
          {nome} não vai jogar
        </button>
      </div>
      <p className="hint">Sugestão: sai quem está há mais partidas seguidas. Quem sai entra na fila da próxima.</p>
    </div>
  );
}

export function Roleta() {
  const r = useRodizio((s) => s.r);
  const girando = useRodizio((s) => s.girando);
  const fatiasGiro = useRodizio((s) => s.fatias);
  const ocupado = useRodizio((s) => s.ocupado);
  const friends = useApp((s) => s.friends);
  const myFid = useApp((s) => s.myFid);
  const lineup = useApp((s) => s.lineup);
  useEffect(() => {
    carregarRodizio();
  }, []);
  /* sem sala de LoL ou sem o SQL do rodízio: o bloco não aparece */
  if (!r) return null;

  const nomes = Object.fromEntries(friends.map((f) => [f.id, f.name]));
  const virou = rodadaNova(r.fila, r.jaEntraram, nomes);
  const agora = candidatos(r.fila, virou ? [] : r.jaEntraram, nomes);
  const fatias = girando && fatiasGiro ? fatiasGiro : r.sorteado ? candidatos(r.fila, r.jaEntraram, nomes) : agora;
  /* a fila na tela: quem quer jogar e quem já entrou nesta rodada (riscado) */
  const pessoas = [...new Set([...r.fila, ...(virou ? [] : r.jaEntraram)])].filter((id) => nomes[id] !== undefined).sort((a, b) => nomes[a].localeCompare(nomes[b], "pt-BR"));
  const entraram = virou ? 0 : pessoas.filter((id) => r.jaEntraram.includes(id)).length;
  const naEscalacao = !!myFid && lineup.some((l) => l.friendId === myFid);
  const naFila = !!myFid && r.fila.includes(myFid);
  const podeGirar = !r.sorteado && !girando && agora.length > 0;

  return (
    <section className="block rodizio" aria-labelledby="rodizioTitulo">
      <div className="rodizio-topo">
        <h2 id="rodizioTitulo">Roleta do rodízio</h2>
        <span className="hint">sorteio feito pelo banco</span>
      </div>
      <div className="rodizio-corpo">
        <div className="rodizio-roleta">
          <Roda fatias={fatias} friends={friends} />
          <p className="rodizio-aviso" aria-live="polite">
            {r.sorteado && !girando ? `${friendName(r.sorteado, friends)} foi sorteado` : ""}
          </p>
          <div className="rodizio-botoes">
            {podeGirar && (
              <button type="button" className="btn" disabled={ocupado} onClick={() => girar()}>
                Girar a roleta
              </button>
            )}
            {myFid && !naEscalacao && (
              <button type="button" className="btn soft" disabled={ocupado} onClick={() => (naFila ? filaSair(myFid) : filaEntrar(myFid))}>
                {naFila ? "Sair da fila" : "Quero jogar"}
              </button>
            )}
          </div>
          {!pessoas.length && <p className="hint">Ninguém na fila. Quem está de fora clica em &quot;Quero jogar&quot;.</p>}
        </div>

        <div className="rodizio-fila">
          <div className="rodizio-topo">
            <h3>Querem jogar ({pessoas.length})</h3>
            <span className="hint">quem já entrou nesta rodada fica riscado</span>
          </div>
          {pessoas.length > 0 && (
            <ul>
              {pessoas.map((id) => {
                const f = friendOf(id, friends);
                const jogou = !virou && r.jaEntraram.includes(id);
                const eu = id === myFid;
                return (
                  <li key={id} className={(jogou ? "jogou" : "") + (eu ? " eu" : "")}>
                    {f && <Avatar f={f} size="xs" />}
                    <span className="nome">{nomes[id]}</span>
                    <small>{r.sorteado === id ? "sorteado" : jogou ? "jogou" : eu ? "você" : "na roleta"}</small>
                    {r.fila.includes(id) && (
                      <button type="button" className="rodizio-tirar" aria-label={`Tirar ${nomes[id]} da fila`} title="Tirar da fila" disabled={ocupado} onClick={() => filaSair(id)}>
                        <IcFechar tam={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {pessoas.length > 0 && (
            <div className="rodizio-rodada">
              <span>
                Rodada {virou ? r.rodada + 1 : r.rodada} · <b>{entraram} de {pessoas.length}</b> já entraram
              </span>
              <span className="rodizio-barra" role="progressbar" aria-label="Quantos já entraram nesta rodada" aria-valuemin={0} aria-valuemax={pessoas.length} aria-valuenow={entraram}>
                <i style={{ width: `${(entraram / pessoas.length) * 100}%` }} />
              </span>
            </div>
          )}
          <div className="rodizio-por">
            <FriendPicker value="" emptyLabel="Pôr alguém na fila" ariaLabel="Pôr alguém na fila" onChange={(v) => v && filaEntrar(v)} />
          </div>
          {r.sorteado && !girando && <Resultado key={r.giradoEm ?? ""} r={r} friends={friends} />}
        </div>
      </div>
    </section>
  );
}
