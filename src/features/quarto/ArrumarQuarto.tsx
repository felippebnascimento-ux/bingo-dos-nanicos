"use client";
/*
 * Arrumar o quarto próprio (fase 34): o quarto grande na tela, com o piso em alvos. Tocar num móvel guardado e depois
 * num piso o coloca (o piso fica verde se cabe e vermelho se não); tocar num móvel colocado o seleciona para Girar,
 * Mover ou Guardar. Tudo vai na hora para o banco (quarto_por/mover/guardar), que confere de novo; o tempo real de
 * quarto_moveis atualiza todo mundo. Esc ou o X fecham.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { IcFechar } from "@/components/ui/icones";
import { useApp } from "@/lib/store";
import { Previa } from "@/features/loja/LojaView";
import { posicionavel, type ItemLoja } from "@/features/loja/loja";
import { useEquipados, useLoja, useMinhaMochila } from "@/features/loja/lojaDados";
import { cabe, pisoDo, type Retangulo } from "./quarto";
import { QuartoCena } from "./QuartoCena";
import { guardarMovel, iniciarQuartos, moverMovel, moveisDe, porMovel, useQuartos } from "./quartoDados";
import { paraCena } from "./visita";

type Escolha = { tipo: "guardado"; item: ItemLoja } | { tipo: "movel"; id: number; mover: boolean } | null;

export function ArrumarQuarto() {
  const aberto = useQuartos((s) => s.arrumando);
  return aberto ? <ArrumarAberto /> : null;
}

function ArrumarAberto() {
  const myUid = useApp((s) => s.myUid);
  const tamanho = useQuartos((s) => (myUid ? s.quartos[myUid] : undefined));
  const todos = useQuartos((s) => s.moveis);
  const ocupado = useQuartos((s) => s.ocupado);
  const itens = useLoja((s) => s.itens);
  const minhas = useMinhaMochila();
  const eq = useEquipados(myUid);
  const [esc, setEsc] = useState<Escolha>(null);
  const [giro, setGiro] = useState(false);
  const [sobre, setSobre] = useState<{ i: number; j: number } | null>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => useQuartos.setState({ arrumando: false });

  useEffect(() => {
    void iniciarQuartos();
    fecharRef.current?.focus();
  }, []);

  const meus = useMemo(() => moveisDe(todos, myUid), [todos, myUid]);
  const cena = useMemo(() => paraCena(meus, itens), [meus, itens]);
  const equip = useMemo(() => ({ parede: eq.parede?.dados.cor, luz: eq.luz?.dados.cor, poster: eq.poster?.dados.cor }), [eq]);
  /* os guardados: o que está na mochila e ainda não está no quarto */
  const guardados = (itens ?? [])
    .filter((it) => posicionavel(it))
    .map((it) => ({ it, sobra: (minhas.find((l) => l.itemId === it.id)?.qtd ?? 0) - meus.filter((m) => m.itemId === it.id).length }))
    .filter((x) => x.sobra > 0);

  /* o que vai ser posto ou movido agora, e se cabe onde o mouse está */
  const emMao = (() => {
    if (esc?.tipo === "guardado" && esc.item.dados.w && esc.item.dados.d) return { ...pisoDo(esc.item.dados.w, esc.item.dados.d, giro), ignorar: null as number | null };
    if (esc?.tipo === "movel" && esc.mover) {
      const m = cena.find((x) => x.id === esc.id);
      const it = itens?.find((x) => x.id === meus.find((y) => y.id === esc.id)?.itemId);
      if (m && it?.dados.w && it.dados.d) return { ...pisoDo(it.dados.w, it.dados.d, giro), ignorar: m.id };
    }
    return null;
  })();
  const ocupados = (ignorar: number | null): Retangulo[] => cena.filter((m) => m.id !== ignorar).map((m) => m.ret);
  const destaque = emMao && sobre && tamanho ? { ret: { i: sobre.i, j: sobre.j, w: emMao.w, d: emMao.d }, cabe: cabe(tamanho, ocupados(emMao.ignorar), { i: sobre.i, j: sobre.j, w: emMao.w, d: emMao.d }) } : null;

  const tocarPiso = async (i: number, j: number) => {
    setSobre({ i, j });
    if (!esc || ocupado) return;
    if (esc.tipo === "guardado") {
      if (await porMovel(esc.item.id, i, j, giro)) setEsc(null);
    } else if (esc.mover) {
      if (await moverMovel(esc.id, i, j, giro)) setEsc(null);
    }
  };
  const selecionado = esc?.tipo === "movel" ? esc.id : null;
  const movelSel = selecionado !== null ? meus.find((m) => m.id === selecionado) : undefined;

  return (
    <div className="gate arrumar-gate" role="dialog" aria-modal="true" aria-labelledby="arrumarTitulo" onKeyDown={(e) => e.key === "Escape" && fechar()}>
      <div className="arrumar quarto-vars">
        <div className="arrumar-topo">
          <b id="arrumarTitulo">Arrumar meu quarto</b>
          <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar" onClick={fechar}>
            <IcFechar />
          </button>
        </div>
        {!tamanho ? (
          <p className="hint">Compre um quarto na Loja para arrumar.</p>
        ) : (
          <>
            <p className="hint arrumar-dica">
              {esc?.tipo === "guardado"
                ? `Toque no piso para pôr: ${esc.item.nome}.`
                : esc?.tipo === "movel" && esc.mover
                  ? "Toque no piso para onde ele vai."
                  : "Toque num móvel guardado e depois no piso, ou num móvel do quarto para mexer nele."}
            </p>
            <div className="arrumar-palco" onMouseLeave={() => setSobre(null)}>
              <QuartoCena
                tamanho={tamanho}
                equip={equip}
                moveis={cena}
                selecionado={selecionado}
                destaque={destaque}
                aoTocarPiso={(i, j) => void tocarPiso(i, j)}
                aoPassarPiso={(i, j) => setSobre((s) => (s && s.i === i && s.j === j ? s : { i, j }))}
                aoTocarMovel={(id) => {
                  const m = meus.find((x) => x.id === id);
                  setGiro(m?.giro ?? false);
                  setEsc({ tipo: "movel", id, mover: false });
                }}
              />
            </div>
            <div className="arrumar-acoes">
              {(esc?.tipo === "guardado" || (esc?.tipo === "movel" && esc.mover)) && (
                <button type="button" className="btn soft sm" onClick={() => setGiro((g) => !g)}>
                  Girar
                </button>
              )}
              {esc?.tipo === "movel" && !esc.mover && movelSel && (
                <>
                  <button type="button" className="btn soft sm" disabled={ocupado} onClick={() => void moverMovel(movelSel.id, movelSel.i, movelSel.j, !movelSel.giro)}>
                    Girar
                  </button>
                  <button type="button" className="btn soft sm" onClick={() => setEsc({ tipo: "movel", id: movelSel.id, mover: true })}>
                    Mover
                  </button>
                  <button
                    type="button"
                    className="btn soft sm"
                    disabled={ocupado}
                    onClick={() => void guardarMovel(movelSel.id).then((ok) => ok && setEsc(null))}
                  >
                    Guardar
                  </button>
                </>
              )}
              {esc && (
                <button type="button" className="linkish" onClick={() => setEsc(null)}>
                  Cancelar
                </button>
              )}
            </div>
            <section className="arrumar-guardados" aria-labelledby="guardadosTitulo">
              <h3 id="guardadosTitulo">Guardados</h3>
              {guardados.length ? (
                <ul>
                  {guardados.map(({ it, sobra }) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        className={"arrumar-item" + (esc?.tipo === "guardado" && esc.item.id === it.id ? " on" : "")}
                        onClick={() => {
                          setGiro(false);
                          setEsc({ tipo: "guardado", item: it });
                        }}
                      >
                        <span className="mochila-previa">
                          <Previa it={it} />
                        </span>
                        <span>
                          {it.nome}
                          {sobra > 1 && <small> ×{sobra}</small>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">Nada guardado. Compre móveis na Loja.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
