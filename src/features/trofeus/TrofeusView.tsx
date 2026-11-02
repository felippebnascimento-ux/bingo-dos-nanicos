"use client";
/*
 * Aba Troféus (abre pelo quadro na parede do Sítio; fica fora do menu): um cartão por troféu com o pódio
 * da semana escolhida, o "Mais rico" de agora e o hall da fama. Clicar num rosto abre a ficha.
 */
import { useState, type ComponentType } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcControle, IcMapa, IcMoeda, IcPergunta, IcPiano, IcPrato, IcVoltar } from "@/components/ui/icones";
import { useRanking } from "@/features/moedas/Ranking";
import { friendOf, setApp, useApp } from "@/lib/store";
import type { Friend } from "@/lib/tipos";
import { formatarValor, podio, rotuloSemana, TROFEUS, type TrofeuId } from "./trofeus";
import { useTrofeus } from "./trofeusDados";

const ICONE: Record<TrofeuId, ComponentType<{ tam?: number }>> = {
  feeder: IcPrato,
  turista: IcMapa,
  piano: IcPiano,
  viciado: IcControle,
  sumido: IcPergunta,
  rico: IcMoeda,
};
const SEMANAS = 8;

type Linha = { fid: string; valor: number };

function Rosto({ f, size }: { f: Friend | undefined; size?: "xs" | "lg" }) {
  if (!f) return null;
  return (
    <button type="button" className="trofeu-rosto" aria-label={`Abrir a ficha de ${f.name}`} onClick={() => setApp({ fichaAberta: f.id })}>
      <Avatar f={f} size={size} />
    </button>
  );
}

function Cartao({ id, lista, friends, agora }: { id: TrofeuId; lista: Linha[]; friends: Friend[]; agora?: boolean }) {
  const t = TROFEUS.find((x) => x.id === id)!;
  const Ic = ICONE[id];
  const [primeiro, ...resto] = lista;
  const f1 = primeiro ? friendOf(primeiro.fid, friends) : undefined;
  return (
    <article className={"block trofeu-cartao" + (t.vergonha ? " vergonha" : " gloria")}>
      <header>
        <span className="trofeu-icone" aria-hidden="true">
          <Ic tam={22} />
        </span>
        <div>
          <h2>
            {t.nome}
            {agora && <span className="trofeu-agora">AGORA</span>}
          </h2>
          <p className="hint">{t.frase}</p>
        </div>
      </header>
      {primeiro && f1 ? (
        <div className="trofeu-primeiro">
          <Rosto f={f1} size="lg" />
          <div>
            <b>{f1.name}</b>
            <small>{formatarValor(id, primeiro.valor)}</small>
          </div>
          <span className="trofeu-pos">1º</span>
        </div>
      ) : (
        <p className="hint trofeu-vazio">Ninguém nesta semana.</p>
      )}
      {resto.length > 0 && (
        <ol className="trofeu-resto">
          {resto.map((l, i) => {
            const f = friendOf(l.fid, friends);
            return (
              <li key={l.fid}>
                <span className="trofeu-pos">{i + 2}º</span>
                <Rosto f={f} size="xs" />
                <span className="nome">{f?.name ?? "?"}</span>
                <span className="valor">{formatarValor(id, l.valor).split(" ")[id === "piano" ? 1 : 0]}</span>
              </li>
            );
          })}
        </ol>
      )}
      <span className="trofeu-premio">{t.premio}</span>
    </article>
  );
}

export function TrofeusView({ hidden }: { hidden: boolean }) {
  const linhas = useTrofeus((s) => s.linhas);
  const fama = useTrofeus((s) => s.fama);
  const calculando = useTrofeus((s) => s.calculando);
  const friends = useApp((s) => s.friends);
  const ranking = useRanking();
  const semanas = [...new Set((linhas ?? []).map((l) => l.semana))].sort().reverse().slice(0, SEMANAS);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const semana = escolhida && semanas.includes(escolhida) ? escolhida : (semanas[0] ?? null);
  const ricos: Linha[] = (ranking ?? [])
    .filter((l) => l.saldo !== null)
    .slice(0, 3)
    .map((l) => ({ fid: l.fid, valor: l.saldo! }));
  const daSemana = (id: TrofeuId): Linha[] => (semana && linhas ? podio(linhas, id, semana).map((l) => ({ fid: l.fid, valor: l.valor })) : []);
  const comFama = friends.filter((f) => fama[f.id]);

  return (
    <section id="view-trofeus" className="inner" hidden={hidden}>
      <button type="button" className="linkish trofeus-voltar" onClick={() => setApp({ aba: "hall" })}>
        <IcVoltar tam={14} /> Voltar ao Sítio
      </button>
      <header className="hero">
        <h1>Troféus da semana</h1>
        <p>Calculados pelas partidas de LoL de cada um, toda segunda-feira. Clique num rosto para ver a ficha.</p>
      </header>
      {calculando && <p className="hint">Calculando os troféus da semana passada… Isso pode levar alguns minutos.</p>}
      {semanas.length > 1 && (
        <div className="seg trofeus-semanas" role="radiogroup" aria-label="Semana">
          {semanas.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={s === semana} className={s === semana ? "on" : undefined} onClick={() => setEscolhida(s)}>
              {rotuloSemana(s)}
            </button>
          ))}
        </div>
      )}
      {semanas.length === 1 && semana && <p className="hint">Semana de {rotuloSemana(semana)}</p>}
      <div className="trofeus-grade">
        {TROFEUS.map((t) =>
          t.id === "rico" ? (
            <Cartao key={t.id} id="rico" lista={ricos} friends={friends} agora />
          ) : (
            <Cartao key={t.id} id={t.id} lista={daSemana(t.id)} friends={friends} />
          ),
        )}
      </div>
      {comFama.length > 0 && (
        <section className="block trofeus-fama" aria-labelledby="famaTitulo">
          <h2 id="famaTitulo">Hall da fama</h2>
          <div className="trofeus-fama-tabela">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nanico</th>
                  {TROFEUS.filter((t) => t.id !== "rico").map((t) => (
                    <th key={t.id} scope="col">
                      {t.nome.replace(" da semana", "").replace("Carregou o ", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comFama.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">
                      <Rosto f={f} size="xs" />
                      {f.name}
                    </th>
                    {TROFEUS.filter((t) => t.id !== "rico").map((t) => {
                      const n = fama[f.id]?.[t.id] ?? 0;
                      return (
                        <td key={t.id} className={n ? "tem" : undefined}>
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
