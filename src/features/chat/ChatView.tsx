"use client";
/*
 * Aba Chat (fora do menu): o canal de texto escolhido em "Canais de texto" na barra lateral.
 * Hoje é só o #geral, o chat de todo mundo; o chat de cada sala fica no Ao vivo (é o chat do canal de voz).
 */
import { IcHash } from "@/components/ui/icones";
import { nomeDaSala } from "@/features/salas/trocar";
import { useApp } from "@/lib/store";
import { ChatPainel } from "./ChatPainel";

export function ChatView({ hidden }: { hidden: boolean }) {
  const canal = useApp((s) => s.canalTexto);
  const salas = useApp((s) => s.salas);
  const nome = canal === "geral" ? "geral" : (nomeDaSala(canal, salas) ?? canal);
  return (
    <section id="view-chat" className="inner" hidden={hidden}>
      <header className="canal-topo">
        <h2>
          <IcHash tam={22} />
          {nome}
        </h2>
        <p className="hint">{canal === "geral" ? "O chat de todo mundo, esteja onde estiver." : `O chat da ${nome}. Quem está na sala vê no Ao vivo.`}</p>
      </header>
      {/* key: trocar de canal começa a lista do fim e limpa o que estava escrito */}
      <ChatPainel key={canal} canal={canal} placeholder={`Mensagem em #${nome}`} />
    </section>
  );
}
