"use client";
/* Aba Jogar: escalação, partida ao vivo da Riot, cartela e montar a própria cartela. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FriendPicker } from "@/components/ui/FriendPicker";
import { IcEstrela } from "@/components/ui/icones";
import { useSure } from "@/components/ui/useSure";
import { cellsDe, eligible, limparMarcacoes, linhasFeitas, novaCartela, sortear } from "@/lib/bingo";
import { salvarEscalacao } from "@/lib/dados";
import { LANES } from "@/lib/dados/campeoes";
import { friendName, getApp, useApp } from "@/lib/store";
import type { Friend, Phrase } from "@/lib/tipos";
import { toast } from "@/lib/toast";
import { canon, norm, rolarAte, shuffle } from "@/lib/util";
import { CellTag } from "./CellTag";
import { CartelaFlutuante } from "./MiniCartela";
import { RiotBox } from "./RiotBox";
import { Roleta } from "./Roleta";
import { fecharPartida, sortearCartela, tocarCasa, usarMontada, useBingo, useBingoNoServidor } from "./bingoSala";

/* ---------- escalação ---------- */

/** Campeão de uma rota. Salva no "change" (ao sair do campo ou escolher da lista), como o site antigo. */
function CampeaoInput({ i, valor, oculto }: { i: number; valor: string; oculto: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  /* enquanto a pessoa digita, o texto fica aqui; fora isso, o campo mostra o que está salvo */
  const [rascunho, setRascunho] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = () => {
      const c = canon(el.value);
      const lineup = getApp().lineup.slice();
      lineup[i] = { ...lineup[i], champion: c };
      setRascunho(null);
      salvarEscalacao(lineup);
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [i]);
  return (
    <input
      ref={ref}
      id={"lp-c-" + i}
      list="champs"
      placeholder="Campeão"
      aria-label={"Campeão " + LANES[i]}
      autoComplete="off"
      hidden={oculto}
      value={rascunho ?? valor}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => setRascunho(null)}
    />
  );
}

/* ---------- montar a própria cartela ----------
   Mostra só as nanicadas que valem para a escalação atual. A pessoa escolhe até 24;
   a ordem de escolha é a posição na cartela (pulando o LIVRE do meio). */
type Montando = { sel: string[]; filtro: "todas" | "partida" | "gen"; busca: string };
type ItemMont = Phrase & { hitF?: string[]; hit?: string[]; tipo: "partida" | "gen" };

function Montar({
  mt,
  setMt,
  M,
  friends,
}: {
  mt: Montando;
  setMt: (m: Montando | null) => void;
  M: Map<string, ItemMont>;
  friends: Friend[];
}) {
  /* nanicada que deixou de valer (a escalação mudou) sai da escolha */
  const sel = mt.sel.filter((id) => M.has(id)).slice(0, 24);
  const muda = (p: Partial<Montando>) => setMt({ ...mt, sel, ...p });
  const n = sel.length;
  const slots: (string | null)[] = [];
  for (let i = 0, k = 0; i < 25; i++) {
    if (i === 12) {
      slots.push(null);
      continue;
    }
    slots.push(sel[k++] || "");
  }
  const busca = norm(mt.busca);
  const servidor = useBingoNoServidor();
  const todos = [...M.values()];
  const lista = todos
    .filter(
      (p) =>
        (mt.filtro === "todas" || p.tipo === mt.filtro) &&
        (!busca ||
          norm(p.text + " " + (p.hit || []).join(" ") + " " + (p.hitF || []).map((id) => friendName(id, friends)).join(" ")).includes(busca)),
    )
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "partida" ? -1 : 1) || a.text.localeCompare(b.text, "pt-BR"));
  const nP = todos.filter((p) => p.tipo === "partida").length,
    nG = M.size - nP;
  const tag = (p: ItemMont) => (
    <CellTag
      c={{ text: "", friendIds: p.hitF || [], fnames: (p.hitF || []).map((id) => friendName(id, friends)), champs: (p.hit || []).join("/") }}
      friends={friends}
    />
  );

  const completar = () => {
    /* completa com as que faltam, dando preferência às da partida */
    const resto = todos.filter((p) => !sel.includes(p.id));
    const sp = shuffle(resto.filter((p) => p.tipo === "partida")),
      ge = shuffle(resto.filter((p) => p.tipo === "gen"));
    const falta = 24 - sel.length,
      nSp = Math.max(0, Math.min(sp.length, 16 - sel.filter((id) => M.get(id)!.tipo === "partida").length, falta));
    let add = sp.slice(0, nSp);
    add = add.concat(ge.slice(0, falta - add.length));
    if (add.length < falta) add = add.concat(sp.slice(nSp, nSp + falta - add.length));
    muda({ sel: sel.concat(add.map((p) => p.id)).slice(0, 24) });
  };

  const pronto = async () => {
    if (sel.length < 24) return;
    const ok = await usarMontada(sel, () => {
      novaCartela(cellsDe(sel.map((id) => M.get(id)!), friends));
      toast("Cartela montada");
    });
    if (ok) setMt(null);
  };

  return (
    <div className="card-wrap builder">
      <div className="card-head">
        <h2>Montar minha cartela</h2>
        <span className="status">
          <b>{n}</b> de 24
        </span>
      </div>
      <p className="hint" style={{ margin: "0 0 10px" }}>
        Toque nas nanicadas da lista para colocar na cartela, na ordem em que escolher. Toque numa casa para tirar.
      </p>
      {servidor && <p className="hint bingo-aviso">Cartela montada não vale moedas.</p>}
      <div className="letters" aria-hidden="true">
        <span>B</span>
        <span>I</span>
        <span>N</span>
        <span>G</span>
        <span>O</span>
      </div>
      <div className="card mont">
        {slots.map((id, i) =>
          id === null ? (
            <div key={i} className="cell free">
              <IcEstrela />
              <span>Livre</span>
            </div>
          ) : id ? (
            <button
              key={i}
              type="button"
              className="cell picked"
              title="Tirar da cartela"
              onClick={() => muda({ sel: sel.filter((x) => x !== id) })}
            >
              <span className="t">{M.get(id)!.text}</span>
              {tag(M.get(id)!)}
            </button>
          ) : (
            <div key={i} className="cell vazia" aria-hidden="true">
              {i < 12 ? i + 1 : i}
            </div>
          ),
        )}
      </div>
      <div className="mont-acts">
        <button type="button" className="btn soft sm" disabled={n >= 24 || M.size < 24} onClick={completar}>
          Completar sorteando
        </button>
        <button type="button" className="btn soft sm" disabled={n < 2} onClick={() => muda({ sel: shuffle(sel) })}>
          Embaralhar posições
        </button>
        <button type="button" className="btn soft sm" disabled={!n} onClick={() => muda({ sel: [] })}>
          Limpar
        </button>
      </div>
      <div className="mont-head">
        <input
          id="mBusca"
          placeholder="Buscar nanicada"
          aria-label="Buscar nanicada"
          value={mt.busca}
          autoComplete="off"
          onChange={(e) => muda({ busca: e.target.value })}
        />
        <div className="mont-filtro" role="radiogroup" aria-label="Mostrar">
          {(
            [
              ["todas", `Todas (${M.size})`],
              ["partida", `Da partida (${nP})`],
              ["gen", `Genéricas (${nG})`],
            ] as const
          ).map(([k, t]) => (
            <button key={k} type="button" role="radio" aria-checked={mt.filtro === k} onClick={() => muda({ filtro: k })}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <ul className="mont-list">
        {lista.length ? (
          lista.map((p) => {
            const on = sel.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={"mont-item" + (on ? " on" : "")}
                  aria-pressed={on}
                  disabled={!on && n >= 24}
                  onClick={() => muda({ sel: on ? sel.filter((x) => x !== p.id) : n < 24 ? [...sel, p.id] : sel })}
                >
                  <span className="ck" aria-hidden="true">
                    {on ? sel.indexOf(p.id) + 1 : "+"}
                  </span>
                  <span className="tx">
                    <span>{p.text}</span>
                    {p.tipo === "gen" ? <span className="tag">Genérica</span> : tag(p)}
                  </span>
                </button>
              </li>
            );
          })
        ) : (
          <li className="status" style={{ padding: 10 }}>
            Nenhuma nanicada com esse filtro.
          </li>
        )}
      </ul>
      <div className="row mont-foot">
        <button type="button" className="btn soft" onClick={() => setMt(null)}>
          Cancelar
        </button>
        <button type="button" className="btn" disabled={n < 24} onClick={() => void pronto()}>
          {n < 24 ? `Faltam ${24 - n}` : "Usar esta cartela"}
        </button>
      </div>
    </div>
  );
}

/* ---------- cartela ---------- */
function Cartela({ friends }: { friends: Friend[] }) {
  const card = useApp((s) => s.card);
  const myUid = useApp((s) => s.myUid);
  const b = useBingo();
  const servidor = b.sql === true && !!b.sala;
  const fechar = useSure(3000);
  if (!card)
    return (
      <div className="empty">
        <b>Sua cartela aparece aqui</b>
        <span>
          Monte a escalação e toque em “Sortear minha cartela”. Cada pessoa na sala recebe uma diferente.
          {servidor && " A sorteada vale +25 moedas a quem fechar uma linha."}
        </span>
      </div>
    );
  const done = linhasFeitas(card);
  const inLine = new Set(done.flat());
  const marked = card.marked.filter(Boolean).length - 1;
  return (
    <div className="card-wrap">
      {done.length > 0 && (
        <div className="banner" role="status">
          BINGO{done.length > 1 ? " ×" + done.length : ""}!
        </div>
      )}
      <div className="card-head">
        <h2>Minha cartela</h2>
        <span className="status">
          {marked} de 24 marcadas
          {servidor && b.origem === "montada" && " · montada, não vale moedas"}
        </span>
      </div>
      <div className="letters" aria-hidden="true">
        <span>B</span>
        <span>I</span>
        <span>N</span>
        <span>G</span>
        <span>O</span>
      </div>
      <div className="card">
        {card.cells.map((c, i) => {
          if (c.free)
            return (
              <div key={i} className="cell free">
                <IcEstrela />
                <span>Livre</span>
              </div>
            );
          const rot = c.rot || 0;
          const estilo = { "--rot": `${rot}deg`, "--dx": `${rot % 4}px`, "--dy": `${(rot * 7) % 4}px` } as CSSProperties;
          /* no servidor: cantada e esperando outro nanico confirmar */
          const canto = servidor && !card.marked[i] && b.casas?.[i] ? b.cantos[b.casas[i]!] : undefined;
          const meu = !!canto && canto.por === myUid;
          return (
            <button
              key={i}
              className={"cell" + (card.marked[i] ? " on" : "") + (inLine.has(i) ? " line" : "") + (canto ? " cant" : "")}
              aria-pressed={!!card.marked[i]}
              aria-label={canto ? `${c.text}: ${meu ? "esperando alguém confirmar" : "aconteceu? confirmar"}` : undefined}
              style={estilo}
              disabled={servidor && b.ocupado}
              onClick={() => void tocarCasa(i)}
            >
              <span className="t">{c.text}</span>
              {canto ? (
                <span className="cant-tag">{meu ? "Esperando…" : "Confirmar?"}</span>
              ) : (
                <CellTag c={c} friends={friends} />
              )}
            </button>
          );
        })}
      </div>
      {servidor ? (
        <div className="row bingo-rodape">
          <span className="status">Aconteceu? Toque na casa. Ela marca quando outro nanico confirmar.</span>
          <button className={"btn soft" + (fechar.sure ? " sure" : "")} id="fecharPartida" onClick={() => fechar.pedir() && void fecharPartida()}>
            {fechar.sure ? "Confirmar: fechar a partida" : "Fechar a partida"}
          </button>
        </div>
      ) : (
        <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
          <span className="status">Toque numa casa quando a nanicada acontecer.</span>
          <button className="btn soft" id="limpar" onClick={limparMarcacoes}>
            Limpar marcações
          </button>
        </div>
      )}
    </div>
  );
}

export function JogarView({ hidden }: { hidden: boolean }) {
  const lineup = useApp((s) => s.lineup);
  const phrases = useApp((s) => s.phrases);
  const friends = useApp((s) => s.friends);
  const [montando, setMontando] = useState<Montando | null>(null);
  const area = useRef<HTMLDivElement>(null);

  const { spec, gen } = useMemo(() => eligible(phrases, lineup), [phrases, lineup]);
  const tot = spec.length + gen.length;
  const M = useMemo(() => {
    const m = new Map<string, ItemMont>();
    spec.forEach((p) => m.set(p.id, { ...p, tipo: "partida" }));
    gen.forEach((p) => m.set(p.id, { ...p, tipo: "gen" }));
    return m;
  }, [spec, gen]);

  const trocarJogador = (i: number, v: string) => {
    const novo = getApp().lineup.slice();
    novo[i] = { friendId: v, champion: v ? novo[i]?.champion || "" : "" };
    salvarEscalacao(novo);
  };

  const montar = () => {
    setMontando({ sel: [], filtro: "todas", busca: "" });
    rolarAte(area.current);
  };

  const gerar = async () => {
    setMontando(null);
    await sortearCartela(() => {
      novaCartela(cellsDe(sortear(spec, gen), friends));
      toast("Cartela sorteada");
    });
    rolarAte(area.current);
  };

  return (
    <section id="view-jogar" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Quem tá na partida?</h1>
        <p>Escalação, cartela e marcar o que acontecer.</p>
      </header>
      <RiotBox />
      <div className="play">
        <div className="block lineup-block">
          <h2>Escalação</h2>
          <div className="lineup" id="lineup">
            {LANES.map((l, i) => (
              <div key={l} className="lane">
                <b>{l}</b>
                <FriendPicker
                  id={"lp-f-" + i}
                  value={lineup[i]?.friendId || ""}
                  emptyLabel="Random"
                  ariaLabel={"Jogador " + l}
                  onChange={(v) => trocarJogador(i, v)}
                />
                <CampeaoInput i={i} valor={lineup[i]?.champion || ""} oculto={!lineup[i]?.friendId} />
              </div>
            ))}
          </div>
          <div className="row go">
            <span className="meter" id="meter">
              <strong>{spec.length}</strong> da partida e <strong>{gen.length}</strong> genéricas.{" "}
              {tot >= 24 ? (
                <span className="ok">Dá para montar ou sortear.</span>
              ) : (
                <>
                  Faltam <strong>{24 - tot}</strong> nanicadas.
                </>
              )}
            </span>
            <div className="go-btns">
              <button className="btn soft" id="montar" disabled={tot < 24} onClick={montar}>
                Montar minha cartela
              </button>
              <button className="btn" id="gerar" disabled={tot < 24} onClick={() => void gerar()}>
                Sortear minha cartela
              </button>
            </div>
          </div>
        </div>
        <div id="cardArea" ref={area}>
          {montando ? <Montar mt={montando} setMt={setMontando} M={M} friends={friends} /> : <Cartela friends={friends} />}
        </div>
      </div>
      <Roleta />
      <CartelaFlutuante />
    </section>
  );
}
