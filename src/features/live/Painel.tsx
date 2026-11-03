"use client";
import { ChatPainel } from "@/features/chat/ChatPainel";
import { nomeDaSala } from "@/features/salas/trocar";
import { MiniCartela } from "@/features/jogar/MiniCartela";
import { setApp, useApp } from "@/lib/store";
import type { RailTab } from "@/lib/tipos";
import { local } from "@/lib/util";

const ABAS: { rt: RailTab; t: string }[] = [
  { rt: "chat", t: "Chat" },
  { rt: "cartela", t: "Cartela" },
];

/** Painel da direita do Ao vivo: Chat (o chat do canal de voz, a sala) / Cartela. As telas ficam na grade do canal. */
export function Painel() {
  const railTab = useApp((s) => s.railTab);
  const unread = useApp((s) => s.chatUnread);
  const sala = useApp((s) => nomeDaSala(s.minhaSala, s.salas));
  const setRail = (t: RailTab) => {
    setApp(t === "chat" ? { railTab: t, chatUnread: 0 } : { railTab: t });
    local.set("rail-tab", t);
  };
  return (
    <aside className="rail">
      <div className="rail-tabs" role="tablist" aria-label="Painel">
        {ABAS.map(({ rt, t }) => (
          <button key={rt} role="tab" data-rt={rt} aria-selected={railTab === rt} onClick={() => setRail(rt)}>
            {t}
            {rt === "chat" && (
              <>
                {" "}
                <span className="count" id="nChat">
                  {unread ? (unread > 99 ? "99+" : String(unread)) : ""}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      <div className="rail-pane" data-pane="chat" hidden={railTab !== "chat"}>
        <ChatPainel placeholder={sala ? `Mensagem para a ${sala}` : undefined} />
      </div>
      <div className="rail-pane" data-pane="cartela" hidden={railTab !== "cartela"}>
        <div className="block" id="miniCardBlock">
          <MiniCartela />
        </div>
      </div>
    </aside>
  );
}
