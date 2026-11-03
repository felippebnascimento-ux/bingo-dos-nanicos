"use client";
/*
 * Cartão do perfil no canto de baixo à direita do Sítio, aberto ao tocar num boneco (inclusive o meu), no jeito do
 * Habbo: o corpo inteiro do nanico (a mesma arte da aba Nanicos) à esquerda e os emblemas numa grade de quadradinhos
 * à direita; embaixo, os respeitos (e o botão de dar respeito) e o efeito do consumível. "Ver ficha" abre a ficha.
 */
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcFechar } from "@/components/ui/icones";
import { Emblema } from "@/features/emblemas/Emblema";
import { carregarEmblemas, darRespeito, useEmblemas } from "@/features/emblemas/emblemasDados";
import { DesenhoItem, TituloNanico, useEfeitoDe } from "@/features/loja/Itens";
import { artOf } from "@/lib/dados/nanicos";
import { friendOf, setApp, useApp } from "@/lib/store";
import type { Boneco } from "./bonecos";
import { abrirMenu } from "./zoeiraSala";
import { seguir } from "./seguir";
import { SeloGrupo } from "@/features/grupos/GruposJanela";
import { abrirTroca } from "@/features/troca/trocas";

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
  const arte = artOf(f);
  /* a grade sempre cheia de quadradinhos (os vazios ficam apagados), de 4 em 4, no mínimo 8 */
  const n = emblemas?.length ?? 0;
  const vazios = Math.max(8, Math.ceil(n / 4) * 4) - n;

  return (
    <aside className="hall-canto perfil-cartao" aria-label={`Perfil de ${f.name}`} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <span className="perfil-nome">
          <b>{f.name}</b>
          <TituloNanico userId={f.user_id} />
          <SeloGrupo uid={f.user_id} />
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

      <div className="perfil-vitrine">
        <figure className="perfil-corpo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {arte ? <img src={arte.full} alt={`${f.name} de corpo inteiro`} width={arte.w} height={arte.h} /> : <Avatar f={f} size="lg" />}
        </figure>
        <div className="perfil-emblemas perfil-grade" aria-label="Emblemas">
          {emblemas === undefined ? (
            <small>Carregando os emblemas…</small>
          ) : (
            <>
              {emblemas.map((e) => (
                <span key={e.id} className="perfil-slot">
                  <Emblema e={e} tam={34} />
                </span>
              ))}
              {Array.from({ length: vazios }, (_, k) => (
                <span key={"v" + k} className="perfil-slot vazio" aria-hidden="true" />
              ))}
            </>
          )}
        </div>
      </div>
      {emblemas?.length === 0 && <small className="perfil-sem">Nenhum emblema ainda.</small>}

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
      {!souEu && (
        <button
          type="button"
          className="btn soft sm perfil-ficha"
          onClick={() => {
            abrirMenu(null);
            seguir(fid);
          }}
        >
          Ir até {f.name}
        </button>
      )}
      {!souEu && (
        <button
          type="button"
          className="btn soft sm perfil-ficha"
          onClick={() => {
            abrirMenu(null);
            void abrirTroca(fid);
          }}
        >
          Propor troca
        </button>
      )}
    </aside>
  );
}
