"use client";
import { ChatPainel } from "@/features/chat/ChatPainel";
import { useChat } from "@/features/chat/chat";
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
export function Painel({ fechar }: { fechar?: () => void }) {
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
        {fechar && (
          <button type="button" className="rail-fechar" onClick={fechar} aria-label="Fechar o chat (a transmissão fica maior)" title="Fechar o chat">
            Fechar ▾
          </button>
        )}
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

/**
 * O chat fechado embaixo da call: uma barrinha com a última mensagem e as novas. Tocar abre o chat (e já deixa
 * digitar); fechado, a transmissão fica com quase a tela toda.
 */
export function ChatFechado({ abrir }: { abrir: () => void }) {
  const unread = useApp((s) => s.chatUnread);
  const friends = useApp((s) => s.friends);
  const ultima = useChat((s) => s.msgs[s.msgs.length - 1]);
  const quem = ultima ? friends.find((f) => f.user_id === ultima.user_id) : undefined;
  return (
    <button type="button" className="chat-fechado-barra" onClick={abrir} aria-label={`Abrir o chat${unread ? `, ${unread} mensagens novas` : ""}`}>
      <span className="chat-fechado-ic" aria-hidden="true">
        💬
      </span>
      <b>Chat</b>
      {unread > 0 && <span className="canal-novas">{unread > 99 ? "99+" : unread}</span>}
      <span className="chat-fechado-ultima">
        {ultima ? (
          <>
            <b>{quem?.name ?? "Alguém"}:</b> {ultima.text || (ultima.midia ? "🖼 Imagem" : "")}
          </>
        ) : (
          "Nenhuma mensagem ainda. Toque para escrever."
        )}
      </span>
      <span className="chat-fechado-abrir">Abrir ▴</span>
    </button>
  );
}
