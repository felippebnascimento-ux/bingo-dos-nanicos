"use client";
/* Aba Nanicadas: cadastrar, editar, remover, filtrar e buscar. */
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { FriendPicker } from "@/components/ui/FriendPicker";
import { useSure } from "@/components/ui/useSure";
import { champsOf } from "@/lib/bingo";
import { api, loadPhrases, type NovaNanicada } from "@/lib/dados";
import { CHAMPS } from "@/lib/dados/campeoes";
import { friendName, friendOf, getApp, setApp, useApp } from "@/lib/store";
import { errMsg } from "@/lib/supabase";
import type { Friend, Modo, Phrase } from "@/lib/tipos";
import { toast } from "@/lib/toast";
import { canon, lower, norm, rolarAte } from "@/lib/util";

/** Uma nanicada da lista, com Editar e Remover (remover pede um segundo toque). */
function ItemNanicada({
  p,
  friends,
  editando,
  onEditar,
  onRemovida,
}: {
  p: Phrase;
  friends: Friend[];
  editando: boolean;
  onEditar: () => void;
  onRemovida: () => void;
}) {
  const { sure, pedir } = useSure();
  const [apagando, setApagando] = useState(false);
  const cs = champsOf(p);

  const remover = async () => {
    if (!pedir()) return;
    if (!getApp().phrasesV2) return toast("Para remover, rode o SQL novo no Supabase.");
    setApagando(true);
    try {
      const r = await api.delPhrase(p.id);
      if (!r || !r.length) throw new Error("nada removido");
      onRemovida();
      toast("Nanicada removida");
      loadPhrases().catch(() => setApagando(false));
    } catch (err) {
      console.error(err);
      setApagando(false);
      toast(errMsg(err, "Não deu para remover. Confira a internet."));
    }
  };

  return (
    <li data-id={p.id} className={editando ? "editing" : undefined}>
      <div className="ptext">
        {p.text}
        <div className="badges">
          {p.friendIds.map((id) => (
            <span key={id} className="badge f">
              <Avatar f={friendOf(id, friends) || null} size="xs" />
              {friendName(id, friends) || "nanico removido"}
            </span>
          ))}
          {cs.map((c) => (
            <span key={c} className="badge c">
              {c}
            </span>
          ))}
          {p.modo === "todos" && p.friendIds.length + cs.length > 1 && (
            <span className="badge m" title="Só entra na cartela quando todos estiverem na partida">
              todos juntos
            </span>
          )}
          {!p.friendIds.length && !cs.length && <span className="badge g">Genérica</span>}
        </div>
      </div>
      <div className="pacts">
        <button type="button" className="pact" aria-label={"Editar: " + p.text} onClick={onEditar}>
          Editar
        </button>
        <button
          type="button"
          className={"pact del" + (sure ? " sure" : "")}
          aria-label={"Remover: " + p.text}
          disabled={apagando}
          onClick={remover}
        >
          {sure ? "Confirmar" : "Remover"}
        </button>
      </div>
    </li>
  );
}

export function NanicadasView({ hidden }: { hidden: boolean }) {
  const friends = useApp((s) => s.friends);
  const phrases = useApp((s) => s.phrases);
  const filtroSalvo = useApp((s) => s.nanicadasFiltro);
  const buscaTxt = useApp((s) => s.nanicadasBusca);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [campo, setCampo] = useState("");
  const [selCamps, setSelCamps] = useState<string[]>([]);
  const [idsSel, setIdsSel] = useState<string[]>([]);
  const [modo, setModo] = useState<Modo>("qualquer");
  const [salvando, setSalvando] = useState(false);

  const formBlock = useRef<HTMLDivElement>(null);
  const fTexto = useRef<HTMLInputElement>(null);
  const fCamp = useRef<HTMLInputElement>(null);

  /* nanico que saiu do banco some do seletor e do filtro */
  const ids = idsSel.filter((id) => friends.some((f) => f.id === id));
  const filtro = filtroSalvo && filtroSalvo !== "gen" && !friends.some((f) => f.id === filtroSalvo) ? null : filtroSalvo;
  const busca = norm(buscaTxt);

  const addCamp = () => {
    const el = fCamp.current;
    const c = canon(el?.value);
    setCampo("");
    if (c) setSelCamps((s) => (s.some((x) => norm(x) === norm(c)) ? s : [...s, c]));
    el?.focus();
  };

  /* escolheu um campeão da lista (evento "change" nativo): já inclui */
  useEffect(() => {
    const el = fCamp.current;
    if (!el) return;
    const onChange = () => {
      if (!CHAMPS.some((c) => norm(c) === norm(el.value))) return;
      const c = canon(el.value);
      setCampo("");
      setSelCamps((s) => (s.some((x) => norm(x) === norm(c)) ? s : [...s, c]));
      el.focus();
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, []);

  /* qualquer um × todos: só aparece com 2 ou mais nanicos/campeões */
  const pend = canon(campo);
  const n = ids.length,
    c = selCamps.length + (pend && !selCamps.some((x) => norm(x) === norm(pend)) ? 1 : 0);
  const modoExp =
    modo === "todos"
      ? n && c
        ? `Entra só se ${n > 1 ? "todos esses nanicos estiverem" : "esse nanico estiver"} jogando e ${c > 1 ? "todos esses campeões estiverem" : "esse campeão estiver"} na partida.`
        : n
          ? "Entra só se todos esses nanicos estiverem jogando."
          : "Entra só se todos esses campeões estiverem na partida."
      : n && c
        ? `Entra se ${n > 1 ? "um desses nanicos" : "esse nanico"} estiver jogando com ${c > 1 ? "um desses campeões" : "esse campeão"}.`
        : n
          ? "Entra se pelo menos um desses nanicos estiver jogando."
          : "Entra se pelo menos um desses campeões estiver na partida.";

  const limparForm = () => {
    setEditingId(null);
    setTexto("");
    setCampo("");
    setIdsSel([]);
    setSelCamps([]);
    setModo("qualquer");
  };

  const startEdit = (id: string) => {
    const p = phrases.find((x) => x.id === id);
    if (!p) return;
    if (!getApp().phrasesV2) return toast("Para editar, rode o SQL novo no Supabase.");
    setEditingId(id);
    setTexto(p.text);
    setCampo("");
    setIdsSel(p.friendIds.filter((x) => friendOf(x, friends)));
    setSelCamps(champsOf(p).slice());
    setModo(p.modo === "todos" ? "todos" : "qualquer");
    rolarAte(formBlock.current);
    fTexto.current?.focus({ preventScroll: true });
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!getApp().db) return toast("Sem conexão com o banco.");
    const text = lower(texto).trim();
    if (!text) return;
    const camps = selCamps.slice();
    if (pend && !camps.some((x) => norm(x) === norm(pend))) camps.push(pend);
    setSelCamps(camps);
    const fids = ids.filter((id) => friendOf(id));
    const data: NovaNanicada = { text, friendIds: fids, champions: camps, modo: fids.length + camps.length > 1 ? modo : "qualquer" };
    if (!getApp().phrasesV2 && (fids.length > 1 || data.modo === "todos"))
      return toast("Para usar vários nanicos ou “todos”, rode o SQL novo no Supabase.");
    const editando = editingId;
    setSalvando(true);
    try {
      if (editando) {
        const r = await api.updPhrase(editando, data);
        if (!r || !r.length) throw new Error("nada salvo");
        limparForm();
        await loadPhrases().catch(() => {});
        toast("Nanicada salva");
      } else {
        await api.addPhrase(data);
        loadPhrases().catch(() => {});
        limparForm();
        fTexto.current?.focus();
        toast("Nanicada adicionada");
      }
    } catch (err) {
      console.error(err);
      toast(errMsg(err, editando ? "Não deu para salvar. Confira a internet." : "Não deu para adicionar a nanicada. Confira a internet."));
    } finally {
      setSalvando(false);
    }
  };

  /* lista: mais novas primeiro, filtro de um nanico (ou genéricas) e busca */
  let list = phrases.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (filtro)
    list = list.filter((p) => (filtro === "gen" && !p.friendIds.length && !champsOf(p).length) || p.friendIds.includes(filtro));
  if (busca)
    list = list.filter((p) =>
      norm(p.text + " " + champsOf(p).join(" ") + " " + p.friendIds.map((id) => friendName(id, friends)).join(" ")).includes(busca),
    );

  const chips: [string, string, Friend | null][] = [
    ["todas", "Todas", null],
    ["gen", "Genéricas", null],
    ...friends.map((f): [string, string, Friend] => [f.id, f.name, f]),
  ];

  return (
    <section id="view-frases" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Nanicadas</h1>
        <p>Tudo que esse grupo fala e faz toda santa partida.</p>
      </header>
      <div className={"block form-block" + (editingId ? " editing" : "")} ref={formBlock}>
        <h2 id="formTitle">{editingId ? "Editar nanicada" : "Nova nanicada"}</h2>
        <form className="add" id="formFrase" onSubmit={enviar}>
          <div className="full">
            <label className="lbl" htmlFor="fTexto">
              Nanicada
            </label>
            <input
              ref={fTexto}
              id="fTexto"
              maxLength={90}
              placeholder="ex.: foca a torre"
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={texto}
              onChange={(e) => {
                /* nanicada é sempre em minúsculas: troca na hora, sem pular o cursor */
                const el = e.target,
                  v = lower(el.value);
                if (v !== el.value) {
                  const a = el.selectionStart,
                    b = el.selectionEnd;
                  el.value = v;
                  try {
                    el.setSelectionRange(a, b);
                  } catch {
                    /* campo sem seleção */
                  }
                }
                setTexto(v);
              }}
            />
          </div>
          <div>
            <span className="lbl">Nanicos</span>
            <FriendPicker id="fAmigo" multi values={ids} onChange={setIdsSel} emptyLabel="Nenhum (qualquer um)" ariaLabel="Nanicos da nanicada" />
          </div>
          <div>
            <label className="lbl" htmlFor="fCamp">
              Campeões
            </label>
            <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
              <input
                ref={fCamp}
                id="fCamp"
                list="champs"
                placeholder="Qualquer um"
                autoComplete="off"
                value={campo}
                onChange={(e) => setCampo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCamp();
                  }
                }}
              />
              <button className="btn soft sq" type="button" id="addCamp" aria-label="Incluir campeão" onClick={addCamp}>
                +
              </button>
            </div>
          </div>
          <div className="full modo-row" id="modoRow" hidden={n + c < 2}>
            <span className="lbl" id="lblModo">
              Aparece na cartela quando
            </span>
            <div className="seg" role="radiogroup" aria-labelledby="lblModo">
              <button type="button" role="radio" aria-checked={modo === "qualquer"} onClick={() => setModo("qualquer")}>
                Qualquer um estiver na partida
              </button>
              <button type="button" role="radio" aria-checked={modo === "todos"} onClick={() => setModo("todos")}>
                Todos estiverem na partida
              </button>
            </div>
            <p className="modo-exp" id="modoExp">
              {modoExp}
            </p>
          </div>
          <div className="add-foot">
            <div className="selchamps" id="selCamps">
              {selCamps.map((x, i) => (
                <button key={x} type="button" aria-label={"Tirar " + x} onClick={() => setSelCamps((s) => s.filter((_, k) => k !== i))}>
                  {x}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
            <div className="foot-btns">
              <button className="btn soft" type="button" id="cancelEdit" hidden={!editingId} onClick={limparForm}>
                Cancelar
              </button>
              <button className="btn" type="submit" id="submitFrase" disabled={salvando}>
                {editingId ? "Salvar alterações" : "Adicionar nanicada"}
              </button>
            </div>
          </div>
        </form>
      </div>
      <div className="block list-block">
        <div className="list-head">
          <h2 style={{ margin: 0 }}>Todas as nanicadas</h2>
          <input
            id="busca"
            placeholder="Buscar nanicada, nanico ou campeão"
            aria-label="Buscar"
            value={buscaTxt}
            onChange={(e) => setApp({ nanicadasBusca: e.target.value })}
          />
        </div>
        <div className="filters" id="filtros">
          {chips.map(([k, nome, f]) => (
            <button
              key={k}
              className={"chip" + (f ? "" : " plain")}
              aria-pressed={k === "todas" ? !filtro : filtro === k}
              onClick={() => {
                /* um filtro por vez: tocar em quem já está escolhido volta para Todas */
                setApp({ nanicadasFiltro: k === "todas" || filtro === k ? null : k });
              }}
            >
              {f && <Avatar f={f} size="xs" />}
              {nome}
            </button>
          ))}
        </div>
        <p className="status res" id="resumo">
          {filtro || busca
            ? `Mostrando ${list.length} de ${phrases.length} nanicadas`
            : `${phrases.length} nanicada${phrases.length === 1 ? "" : "s"}`}
        </p>
        <ul className="list" id="listaFrases">
          {list.length ? (
            list.map((p) => (
              <ItemNanicada
                key={p.id}
                p={p}
                friends={friends}
                editando={p.id === editingId}
                onEditar={() => startEdit(p.id)}
                onRemovida={() => {
                  if (editingId === p.id) limparForm();
                }}
              />
            ))
          ) : (
            <li className="li-empty">
              {phrases.length ? "Nenhuma nanicada com esse filtro." : "Nenhuma nanicada ainda. Cadastre a primeira no formulário."}
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
