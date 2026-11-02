"use client";
/*
 * Ficha do nanico (abre ao tocar num nanico na aba Nanicos): o boneco no quarto, à esquerda,
 * e os links do jogo (op.gg, smurf, Steam, com o Premier e a GC do CS) e os atributos votados, à direita. Fecha com Esc ou no X; o foco fica preso dentro.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent as KE } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcFechar } from "@/components/ui/icones";
import { TituloNanico } from "@/features/loja/Itens";
import { MochilaLista } from "@/features/loja/LojaView";
import { useEquipados } from "@/features/loja/lojaDados";
import { verNanicadas } from "@/features/nanicos/NanicosView";
import { opggNick, opggOf, opggSmurfOf } from "@/features/perfil/opgg";
import { steamNome, steamOf } from "@/features/perfil/steam";
import { linksDe, useMidias } from "@/features/midias/midiasDados";
import { TIPOS_LINK } from "@/features/perfil/links";
import { artOf, bonecoOf } from "@/lib/dados/nanicos";
import { friendOf, getApp, setApp, useApp } from "@/lib/store";
import type { Friend } from "@/lib/tipos";
import { AtributosFicha } from "./AtributosFicha";
import { NoSitio } from "./NoSitio";
import { carregarFicha, useFicha } from "./estado";
import { csTexto } from "./numeros";
import { EmblemasFicha } from "@/features/emblemas/EmblemasFicha";
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

/** "No jogo": só os links (op.gg, o do smurf, Steam e os outros do perfil), sem números. */
function Links({ f }: { f: Friend }) {
  const cs = csTexto(useFicha((s) => s.porNanico[f.id]?.cs?.dados));
  const opgg = opggOf(f);
  const smurf = opggSmurfOf(f);
  const steam = steamOf(f);
  /* Premier e GC vêm da função ficha-jogos (Leetify), guardados por 6 h */
  useEffect(() => {
    if (steam) void carregarFicha(f.id);
  }, [f.id, steam]);
  const extras = linksDe(useMidias((s) => s.links), f.id);
  return (
    <section className="ficha-sec">
      <h3>No jogo</h3>
      {cs && <p className="ficha-cs"><b>CS2</b> {cs}</p>}
      {!opgg && !smurf && !steam && !extras.length && <p className="hint">{f.name} ainda não colocou o op.gg no Perfil.</p>}
      {(opgg || smurf || steam || extras.length > 0) && (
        <div className="ficha-links">
          {opgg && (
            <a className="btn soft sm" href={opgg} target="_blank" rel="noopener noreferrer" title={opggNick(opgg)}>
              op.gg ↗
            </a>
          )}
          {smurf && (
            <a className="btn soft sm" href={smurf} target="_blank" rel="noopener noreferrer" title={opggNick(smurf)}>
              op.gg do smurf ↗
            </a>
          )}
          {steam && (
            <a className="btn soft sm" href={steam} target="_blank" rel="noopener noreferrer" title={steamNome(steam)}>
              Steam ↗
            </a>
          )}
          {extras.map((l) => (
            <a key={l.tipo} className="btn soft sm ficha-link" href={l.url} target="_blank" rel="noopener noreferrer">
              {TIPOS_LINK.find((d) => d.tipo === l.tipo)?.nome ?? l.tipo} ↗
            </a>
          ))}
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
  const caixa = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const fechar = () => setApp({ fichaAberta: null });

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
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
          <EmblemasFicha fid={f.id} />
          <Links f={f} />
          <AtributosFicha f={f} eu={eu} />
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
