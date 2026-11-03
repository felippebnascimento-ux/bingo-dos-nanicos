"use client";
/*
 * Chat estilo Habbo: a barra branca embaixo do K-FOFO (manda para o #geral) e os balões em cima dos bonecos
 * (baloes.ts). No K-FOFO os balões ficam numa camada por cima de tudo, em % do cômodo; no quarto, dentro do SVG.
 */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { enviarChat, useChat } from "@/features/chat/chat";
import { Avatar } from "@/components/ui/Avatar";
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
        placeholder="Fale com quem está aqui… (Z abre o histórico)"
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

/* ---------- histórico (tecla Z): as últimas mensagens do #geral, o chat do K-FOFO, da rua e do corredor ---------- */
const digitando = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

/** Z (fora de um campo de texto) abre e fecha o histórico do chat; Esc fecha. Só com a aba do K-FOFO na tela. */
export function HistoricoChat() {
  const [aberto, setAberto] = useState(false);
  const aba = useApp((s) => s.aba);
  const msgs = useChat((s) => s.geral);
  const friends = useApp((s) => s.friends);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") return setAberto(false);
      if ((e.key !== "z" && e.key !== "Z") || e.ctrlKey || e.metaKey || e.altKey || digitando(e.target) || aba !== "hall") return;
      e.preventDefault();
      setAberto((v) => !v);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aba]);
  useEffect(() => {
    if (aberto) fim.current?.scrollIntoView({ block: "end" });
  }, [aberto, msgs.length]);
  if (!aberto || aba !== "hall") return null;
  return (
    <div className="habbo-historico" role="dialog" aria-label="Histórico do chat (Z fecha)">
      <header>
        <b>Histórico do chat</b>
        <small>Z ou Esc fecha</small>
        <button type="button" className="perfil-fechar" aria-label="Fechar o histórico" onClick={() => setAberto(false)}>
          ×
        </button>
      </header>
      <div className="habbo-historico-lista">
        {msgs.length === 0 && <p className="hint">Ninguém falou ainda.</p>}
        {msgs.slice(-100).map((m) => {
          const autor = friends.find((x) => x.user_id === m.user_id);
          const hora = new Date(m.created_at);
          return (
            <p key={m.id} className="habbo-historico-msg">
              {autor && <Avatar f={autor} size="xs" />}
              <span>
                <b>{autor?.name ?? "Nanico"}</b> <small>{isNaN(hora.getTime()) ? "" : hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
                <br />
                {m.text}
              </span>
            </p>
          );
        })}
        <div ref={fim} />
      </div>
    </div>
  );
}
