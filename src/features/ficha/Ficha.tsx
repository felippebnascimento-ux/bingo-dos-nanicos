"use client";
/*
 * Ficha do nanico (abre ao tocar num nanico na aba Nanicos): o boneco no quarto, à esquerda,
 * e os números reais do LoL e da Steam e os atributos votados, à direita. Fecha com Esc ou no X; o foco fica preso dentro.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent as KE } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcFechar } from "@/components/ui/icones";
import { TituloNanico } from "@/features/loja/Itens";
import { MochilaLista } from "@/features/loja/LojaView";
import { useEquipados } from "@/features/loja/lojaDados";
import { verNanicadas } from "@/features/nanicos/NanicosView";
import { opggNick, opggOf } from "@/features/perfil/opgg";
import { steamNome, steamOf } from "@/features/perfil/steam";
import { artOf, bonecoOf } from "@/lib/dados/nanicos";
import { friendOf, getApp, setApp, useApp } from "@/lib/store";
import type { Friend } from "@/lib/tipos";
import { carregarFicha, useFicha } from "./estado";
import { eloTexto, haQuanto, horasTexto, kdaTexto, taxaVitoria, type NumerosFicha } from "./numeros";
import { AtributosFicha } from "./AtributosFicha";
import { NoSitio } from "./NoSitio";
import { PlacarZoeira } from "./PlacarZoeira";
import { Quarto, type EquipQuarto } from "./Quarto";

/** Como deixar as horas da Steam visíveis (usado aqui e no Perfil). */
export function DicaSteamPrivada() {
  return (
    <details className="dica-steam">
      <summary>Como deixar as horas visíveis</summary>
      <p>
        Na Steam, abra o seu perfil, clique em <b>Editar perfil</b> e depois em <b>Privacidade</b>. Deixe <b>Meu perfil</b> e <b>Detalhes de jogos</b>{" "}
        como <b>Público</b>. As horas aparecem aqui na próxima atualização (até 6 horas).
      </p>
    </details>
  );
}

function Numeros({ f, num, carregando, falhou }: { f: Friend; num: NumerosFicha | undefined; carregando: boolean; falhou: boolean }) {
  const opgg = opggOf(f);
  const steam = steamOf(f);
  const lol = opgg ? num?.lol : null;
  const st = steam ? num?.steam : null;
  const quando = Math.max(lol?.atualizado ?? 0, st?.atualizado ?? 0);
  const blocos: { v: string; t: string }[] = [];
  if (lol?.dados) {
    const d = lol.dados;
    const taxa = taxaVitoria(d.vitorias, d.derrotas);
    blocos.push({ v: eloTexto(d), t: d.tier && d.lp !== null ? `${d.lp} PdL na solo` : "na ranqueada solo" });
    if (taxa !== null) blocos.push({ v: `${taxa}%`, t: `vitórias (${d.vitorias}V ${d.derrotas}D)` });
    if (d.kda !== null) blocos.push({ v: kdaTexto(d.kda), t: `KDA (últimas ${d.partidas})` });
  }
  if (st?.dados && !st.dados.privado && st.dados.cs2Horas !== null) blocos.push({ v: `${horasTexto(st.dados.cs2Horas)} h`, t: "CS2 na Steam" });
  if (st?.dados && !st.dados.privado && st.dados.totalHoras !== null) blocos.push({ v: `${horasTexto(st.dados.totalHoras)} h`, t: "total na Steam" });
  const main = lol?.dados?.main;

  return (
    <section className="ficha-sec">
      <h3>
        No jogo
        <small>{carregando ? "buscando…" : quando ? `atualizado ${haQuanto(quando)}` : ""}</small>
      </h3>
      {!opgg && !steam && <p className="hint">{f.name} ainda não colocou o op.gg nem a Steam no Perfil.</p>}
      {blocos.length > 0 && (
        <div className="ficha-reais">
          {blocos.map((b) => (
            <div className="st" key={b.t}>
              <b>{b.v}</b>
              <span>{b.t}</span>
            </div>
          ))}
        </div>
      )}
      {(opgg || steam) && !blocos.length && carregando && <p className="hint">Buscando os números…</p>}
      {falhou && <p className="hint">Não deu para buscar os números agora. Tente de novo daqui a pouco.</p>}
      {lol?.erro && <p className="hint">LoL: {lol.erro}</p>}
      {st?.erro && <p className="hint">Steam: {st.erro}</p>}
      {st?.dados?.privado && (
        <>
          <p className="hint">A Steam de {f.name} está privada: as horas não aparecem.</p>
          <DicaSteamPrivada />
        </>
      )}
      {num?.avisos.map((a) => (
        <p className="hint" key={a}>
          {a}
        </p>
      ))}
      {(opgg || steam || main) && (
        <div className="ficha-links">
          {opgg && (
            <a className="btn soft sm" href={opgg} target="_blank" rel="noopener noreferrer" title={opggNick(opgg)}>
              op.gg ↗
            </a>
          )}
          {steam && (
            <a className="btn soft sm" href={steam} target="_blank" rel="noopener noreferrer" title={steamNome(steam)}>
              Steam ↗
            </a>
          )}
          {main && <span className="ficha-main">Main: {main}</span>}
        </div>
      )}
    </section>
  );
}

export function FichaNanico() {
  const fid = useApp((s) => s.fichaAberta);
  const friends = useApp((s) => s.friends);
  const f = friendOf(fid, friends);
  return f ? <FichaAberta key={f.id} f={f} /> : null;
}

function FichaAberta({ f }: { f: Friend }) {
  const num = useFicha((s) => s.porNanico[f.id]);
  const carregando = useFicha((s) => !!s.carregando[f.id]);
  const falhou = useFicha((s) => !!s.falhou[f.id]);
  const caixa = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => setApp({ fichaAberta: null });

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    carregarFicha(f.id);
    return () => antes?.focus?.();
  }, [f.id]);

  /* Esc fecha; Tab fica dentro da ficha */
  const tecla = (e: KE<HTMLDivElement>) => {
    if (e.key === "Escape") return fechar();
    if (e.key !== "Tab" || !caixa.current) return;
    const foco = [...caixa.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), summary, input")];
    if (!foco.length) return;
    const [primeiro, ultimo] = [foco[0], foco[foco.length - 1]];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  };

  const art = artOf(f);
  const eu = f.id === getApp().myFid;
  return (
    <div className="gate ficha-gate" role="dialog" aria-modal="true" aria-labelledby="fichaNome" onKeyDown={tecla} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="ficha-card" ref={caixa}>
        <div className="ficha-quarto">
          <QuartoDe f={f} arte={art ? { src: art.full, w: art.w, h: art.h } : null} />
        </div>
        <div className="ficha">
          <div className="ficha-topo">
            <Avatar f={f} size="lg" />
            <h2 id="fichaNome">
              {f.name}
              <TituloNanico userId={f.user_id} />
            </h2>
            <button className="ficha-fechar" type="button" ref={fecharRef} aria-label="Fechar a ficha" title="Fechar" onClick={fechar}>
              <IcFechar />
            </button>
          </div>
          <NoSitio fid={f.id} eu={eu} />
          <Numeros f={f} num={num} carregando={carregando} falhou={falhou} />
          <AtributosFicha f={f} eu={eu} />
          <PlacarZoeira fid={f.id} />
          {eu && (
            <details className="ficha-sec ficha-mochila">
              <summary>Minha mochila</summary>
              <MochilaLista />
              <button type="button" className="linkish" onClick={() => setApp({ aba: "loja", fichaAberta: null })}>
                Abrir a loja
              </button>
            </details>
          )}
          <button
            className="linkish"
            type="button"
            onClick={() => {
              fechar();
              verNanicadas(f.id);
            }}
          >
            Ver as nanicadas de {f.name}
          </button>
        </div>
      </div>
    </div>
  );
}

/** O quarto com os itens que o nanico equipou na loja (a RLS deixa todo mundo ver os equipados). */
function QuartoDe({ f, arte }: { f: Friend; arte: { src: string; w: number; h: number } | null }) {
  const eq = useEquipados(f.user_id);
  const equip = useMemo(() => {
    const out: EquipQuarto = {};
    for (const k of ["cadeira", "mesa", "tapete", "poster", "planta", "parede", "luz"] as const) if (eq[k]?.dados.cor) out[k] = eq[k]!.dados.cor;
    return out;
  }, [eq]);
  return <Quarto nome={f.name} boneco={bonecoOf(f)} arte={arte} equip={equip} />;
}
