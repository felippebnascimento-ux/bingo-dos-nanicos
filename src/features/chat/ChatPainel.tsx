"use client";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { getApp, useApp } from "@/lib/store";
import { errMsg } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { hhmm } from "@/lib/util";
import { enviarChat, useChat, type MsgChat } from "./chat";

/** Chat da sala no painel do Ao vivo. */
export function ChatPainel() {
  const msgs = useChat((s) => s.msgs);
  const ok = useChat((s) => s.ok);
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const visivel = useApp((s) => s.aba === "live" && s.railTab === "chat");
  const [texto, setTexto] = useState("");
  const lista = useRef<HTMLDivElement>(null);
  /* só desce sozinho se a pessoa já estava no fim da conversa */
  const noFim = useRef(true);

  const descer = () => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
    noFim.current = true;
  };

  useLayoutEffect(() => {
    const el = lista.current;
    if (el && noFim.current) el.scrollTop = el.scrollHeight;
  }, [msgs, ok]);

  useEffect(() => {
    if (visivel) descer();
  }, [visivel]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || !getApp().db) return;
    if (!ok) return toast("O chat ainda não está ligado no Supabase.");
    setTexto("");
    try {
      await enviarChat(t);
      requestAnimationFrame(descer);
    } catch (err) {
      console.error(err);
      setTexto(t);
      toast(errMsg(err, "Não deu para enviar. Confira a internet."));
    }
  }

  const authorOf = (uid: string) => friends.find((f) => f.user_id === uid);

  return (
    <div className="block chat">
      <div
        className="chat-list"
        id="chatList"
        ref={lista}
        onScroll={(e) => {
          const el = e.currentTarget;
          noFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {!ok ? (
          <p className="chat-empty">O chat ainda não está ligado. Peça para o admin rodar o SQL novo no Supabase.</p>
        ) : !msgs.length ? (
          <p className="chat-empty">Nenhuma mensagem ainda. Mande a primeira.</p>
        ) : (
          msgs.map((m, i) => {
            const prev: MsgChat | undefined = msgs[i - 1];
            const first =
              !prev ||
              prev.user_id !== m.user_id ||
              Date.parse(m.created_at) - Date.parse(prev.created_at) > 5 * 60e3;
            const mine = m.user_id === myUid;
            if (!first)
              return (
                <div key={m.id} className={"msg" + (mine ? " mine" : "")}>
                  <div className="tx">{m.text}</div>
                </div>
              );
            const f = authorOf(m.user_id);
            return (
              <div key={m.id} className={"msg first" + (mine ? " mine" : "")}>
                {f ? <Avatar f={f} /> : <span className="av">?</span>}
                <div className="hd">
                  <b>{f ? f.name : "Alguém"}</b>
                  <time>{hhmm(m.created_at)}</time>
                </div>
                <div className="tx">{m.text}</div>
              </div>
            );
          })
        )}
      </div>
      <form className="chat-form" id="chatForm" autoComplete="off" onSubmit={enviar}>
        <input
          id="chatInput"
          maxLength={300}
          placeholder="Mensagem para a sala"
          aria-label="Mensagem"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="btn sq" type="submit">
          Enviar
        </button>
      </form>
    </div>
  );
}
