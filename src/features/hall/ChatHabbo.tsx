"use client";
/*
 * Chat estilo Habbo: a barra branca embaixo do K-FOFO (manda para o #geral) e os balões em cima dos bonecos
 * (baloes.ts). No K-FOFO os balões ficam numa camada por cima de tudo, em % do cômodo; no quarto, dentro do SVG.
 */
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { enviarChat } from "@/features/chat/chat";
import { errMsg } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { useApp } from "@/lib/store";
import { BALAO_MS, iniciarBaloes, useBaloes, type Balao } from "./baloes";
import type { Boneco } from "./bonecos";
import { ANCORA, assentoDe, tela, type Caixa2D } from "./hall";

const pct = (v: number) => `${v * 100}%`;

/** A barra branca: escreve, Enter manda para o #geral, e o balão sobe em cima do meu boneco. */
export function ChatBarra() {
  const [texto, setTexto] = useState("");
  const [indo, setIndo] = useState(false);
  useEffect(iniciarBaloes, []);
  const mandar = async (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || indo) return;
    setIndo(true);
    try {
      await enviarChat(t, "geral");
      setTexto("");
    } catch (err) {
      toast(errMsg(err, "Não deu para mandar. Tente de novo."));
    } finally {
      setIndo(false);
    }
  };
  return (
    <form className="habbo-barra" onSubmit={mandar}>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={300}
        placeholder="Fale com quem está no K-FOFO…"
        aria-label="Mensagem para o #geral (aparece num balão em cima do seu boneco)"
        enterKeyHint="send"
        autoComplete="off"
      />
      <button type="submit" className="habbo-enviar" disabled={indo || !texto.trim()}>
        Falar
      </button>
    </form>
  );
}

/** Os balões de uma pessoa, empilhados (o mais novo embaixo, perto da cabeça). */
function Pilha({ nome, baloes }: { nome: string; baloes: readonly Balao[] }) {
  return (
    <>
      {baloes.map((b) => (
        <span key={b.id} className="habbo-balao" style={{ ["--vida" as string]: `${BALAO_MS}ms` } as CSSProperties}>
          <b>{nome}:</b> {b.texto}
        </span>
      ))}
    </>
  );
}

/** Balões no K-FOFO: um grupo em cima da cabeça de cada boneco que falou. */
export function BaloesHall({ bonecos, vb }: { bonecos: readonly Boneco[]; vb: Caixa2D }) {
  const lista = useBaloes((s) => s.lista);
  const friends = useApp((s) => s.friends);
  if (!lista.length) return null;
  return (
    <>
      {bonecos.map((b) => {
        const uid = friends.find((f) => f.id === b.fid)?.user_id;
        const meus = uid ? lista.filter((x) => x.uid === uid) : [];
        if (!meus.length) return null;
        const a = assentoDe(b.senta);
        const [x, y] = a ? tela(a.i, a.j) : tela(b.i + 0.5, b.j + 0.5);
        return (
          <div key={b.key} className="habbo-pilha" style={{ left: pct((x - vb.x) / vb.w), top: pct((y - ANCORA.y - vb.y) / vb.h) }}>
            <Pilha nome={b.name} baloes={meus} />
          </div>
        );
      })}
    </>
  );
}

/** Balões no quarto (dentro do SVG): `x`, `y` é o alto da cabeça, nas medidas do SVG. */
export function BaloesSvg({ itens }: { itens: readonly { key: string; nome: string; uid?: string | null; x: number; y: number }[] }) {
  const lista = useBaloes((s) => s.lista);
  if (!lista.length) return null;
  return (
    <>
      {itens.map((it) => {
        const meus = it.uid ? lista.filter((x) => x.uid === it.uid) : [];
        if (!meus.length) return null;
        return (
          <foreignObject key={it.key} x={it.x - 160} y={it.y - 240} width={320} height={240} pointerEvents="none">
            <div className="habbo-pilha no-svg">
              <Pilha nome={it.nome} baloes={meus} />
            </div>
          </foreignObject>
        );
      })}
    </>
  );
}
