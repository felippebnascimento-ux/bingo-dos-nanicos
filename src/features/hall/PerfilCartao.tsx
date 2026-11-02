"use client";
/*
 * Cartão do perfil no canto de baixo à direita do Sítio, aberto ao tocar num boneco (inclusive o meu):
 * rosto, nome e título, respeitos recebidos (e o botão de dar respeito), o efeito do consumível que está
 * fazendo e os emblemas conquistados. "Ver ficha" abre a ficha inteira.
 */
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcFechar } from "@/components/ui/icones";
import { Emblema } from "@/features/emblemas/Emblema";
import { carregarEmblemas, darRespeito, useEmblemas } from "@/features/emblemas/emblemasDados";
import { DesenhoItem, TituloNanico, useEfeitoDe } from "@/features/loja/Itens";
import { friendOf, setApp, useApp } from "@/lib/store";
import type { Boneco } from "./bonecos";
import { abrirMenu } from "./zoeiraSala";

export function PerfilCartao({ b }: { b: Boneco }) {
  const fid = b.fid;
  const f = useApp((s) => friendOf(fid, s.friends));
  const souEu = useApp((s) => !!fid && s.myFid === fid);
  const emblemas = useEmblemas((s) => (fid ? s.emblemas[fid]?.lista : undefined));
  const recebidos = useEmblemas((s) => (fid && s.recebidos ? (s.recebidos[fid] ?? 0) : null));
  const restantes = useEmblemas((s) => s.restantes);
  const dando = useEmblemas((s) => s.dando);
  const efeito = useEfeitoDe(fid);
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (fid) void carregarEmblemas(fid);
  }, [fid]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && abrirMenu(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  if (!fid || !f) return null;

  return (
    <aside className="hall-canto perfil-cartao" aria-label={`Perfil de ${f.name}`} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <Avatar f={f} size="lg" />
        <span className="perfil-nome">
          <b>{f.name}</b>
          <TituloNanico userId={f.user_id} />
        </span>
        <button ref={fechar} type="button" className="perfil-fechar" aria-label="Fechar o perfil" onClick={() => abrirMenu(null)}>
          <IcFechar />
        </button>
      </header>

      <div className="perfil-respeito">
        <span aria-label={`${recebidos ?? 0} respeitos recebidos`}>
          <span className="perfil-coracao" aria-hidden="true">
            ♥
          </span>{" "}
          <b>{recebidos ?? "…"}</b> {recebidos === 1 ? "respeito" : "respeitos"}
        </span>
        {!souEu && (
          <button type="button" className="btn sm" disabled={dando || restantes === 0} onClick={() => void darRespeito(fid)}>
            {restantes === 0 ? "Sem respeitos hoje" : `Dar respeito${restantes !== null ? ` (${restantes})` : ""}`}
          </button>
        )}
        {souEu && restantes !== null && <small>{restantes} para dar hoje</small>}
      </div>

      {efeito && (
        <p className="perfil-efeito">
          <span className="hall-efeito-item" aria-hidden="true">
            <DesenhoItem id={efeito.id} />
          </span>
          {efeito.nome} · <b>{efeito.falta}</b>
        </p>
      )}

      <div className="perfil-emblemas" aria-label="Emblemas">
        {emblemas === undefined ? (
          <small>Carregando os emblemas…</small>
        ) : emblemas.length ? (
          emblemas.map((e) => <Emblema key={e.id} e={e} />)
        ) : (
          <small>Nenhum emblema ainda.</small>
        )}
      </div>

      <button
        type="button"
        className="btn soft sm perfil-ficha"
        onClick={() => {
          abrirMenu(null);
          setApp({ fichaAberta: fid });
        }}
      >
        Ver ficha
      </button>
    </aside>
  );
}
