"use client";
/*
 * Busca rápida, como o "Ir para" do Discord (Ctrl+K, ou Cmd+K no Mac): uma caixa no meio da tela para pular para
 * qualquer aba, canal de voz ou de texto, a ficha de um nanico ou uma seção das Configurações. Setas escolhem,
 * Enter vai, Esc fecha.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IcHash, IcVolume } from "@/components/ui/icones";
import { abrirConfiguracoes } from "@/features/config/ajustes";
import { abrirCanalTexto } from "@/features/chat/chat";
import { entrarSala } from "@/features/salas/trocar";
import { setApp, useApp } from "@/lib/store";
import type { Aba, Friend } from "@/lib/tipos";

type Item = { id: string; nome: string; tipo: string; busca: string; ir: () => void; f?: Friend; ic?: "voz" | "texto" | "aba" | "cfg" };

const ABAS: [Aba, string, string][] = [
  ["hall", "K-FOFO", "sitio hotel sala bonecos"],
  ["live", "Ao vivo", "call voz transmissao tela"],
  ["truco", "Truco", "cartas mesa"],
  ["cassino", "Cassino", "roleta aviao penalti blackjack poquer caca niquel"],
  ["loja", "Loja", "comprar itens mochila"],
  ["frases", "Nanicadas", "frases"],
  ["jogar", "Jogar", "bingo cartela escalacao"],
  ["nanicos", "Nanicos", "turma"],
  ["midias", "Mídias", "fotos videos galeria"],
  ["trofeus", "Troféus", "hall da fama semana"],
  ["perfil", "Perfil", "opgg steam links"],
];
const CFG: [string, string][] = [
  ["conta", "Minha conta"],
  ["voz", "Voz e vídeo"],
  ["notif", "Notificações"],
  ["apar", "Aparência"],
  ["priv", "Privacidade"],
  ["atalhos", "Atalhos de teclado"],
];
const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function BuscaRapida() {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((v) => !v);
      }
    };
    const abre = () => setAberta(true);
    addEventListener("keydown", tecla);
    addEventListener("abrir-busca", abre);
    return () => {
      removeEventListener("keydown", tecla);
      removeEventListener("abrir-busca", abre);
    };
  }, []);
  return aberta ? <Caixa fechar={() => setAberta(false)} /> : null;
}
/** Abre a busca de fora (o botão "Buscar" da call). */
export const abrirBusca = () => dispatchEvent(new Event("abrir-busca"));

function Caixa({ fechar }: { fechar: () => void }) {
  const friends = useApp((s) => s.friends);
  const salas = useApp((s) => s.salas);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const todos = useMemo<Item[]>(() => {
    const ir = (f: () => void) => () => (fechar(), f());
    return [
      ...friends.map((f) => ({ id: "n" + f.id, nome: f.name, tipo: "Ficha", busca: f.name, f, ir: ir(() => setApp({ fichaAberta: f.id })) })),
      ...salas.map((s) => ({ id: "s" + s.id, nome: s.nome, tipo: "Canal de voz", busca: s.nome + " voz", ic: "voz" as const, ir: ir(() => (entrarSala(s.id), setApp({ aba: "live" }))) })),
      { id: "tgeral", nome: "geral", tipo: "Canal de texto", busca: "geral chat", ic: "texto" as const, ir: ir(() => abrirCanalTexto("geral")) },
      ...ABAS.map(([a, n, b]) => ({ id: "a" + a, nome: n, tipo: "Aba", busca: n + " " + b, ic: "aba" as const, ir: ir(() => setApp({ aba: a })) })),
      ...CFG.map(([c, n]) => ({ id: "c" + c, nome: n, tipo: "Configurações", busca: n + " configuracoes ajustes", ic: "cfg" as const, ir: ir(() => abrirConfiguracoes(c)) })),
    ];
  }, [friends, salas, fechar]);
  const achados = useMemo(() => {
    const t = semAcento(q.trim());
    if (!t) return todos.filter((x) => x.tipo !== "Configurações").slice(0, 8);
    return todos
      .filter((x) => semAcento(x.busca).includes(t))
      .sort((a, b) => Number(!semAcento(a.nome).startsWith(t)) - Number(!semAcento(b.nome).startsWith(t)))
      .slice(0, 9);
  }, [q, todos]);
  const atual = Math.min(sel, Math.max(0, achados.length - 1));
  useEffect(() => {
    lista.current?.children[atual]?.scrollIntoView({ block: "nearest" });
  }, [atual]);
  return (
    <div className="busca-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="busca-caixa" role="dialog" aria-label="Busca rápida">
        <input
          autoFocus
          className="busca-campo"
          placeholder="Para onde você quer ir?"
          aria-label="Buscar"
          value={q}
          onChange={(e) => (setQ(e.target.value), setSel(0))}
          onKeyDown={(e) => {
            if (e.key === "Escape") fechar();
            else if (e.key === "Enter") achados[atual]?.ir();
            else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const passo = e.key === "ArrowDown" ? 1 : -1;
              setSel((v) => Math.max(0, Math.min(achados.length - 1, v + passo)));
            }
          }}
        />
        <ul ref={lista} className="busca-lista" role="listbox">
          {achados.map((x, i) => (
            <li key={x.id}>
              <button type="button" role="option" aria-selected={i === atual} className={"busca-it" + (i === atual ? " on" : "")} onMouseEnter={() => setSel(i)} onClick={x.ir}>
                <span className="busca-ic">{x.f ? <Avatar f={x.f} size="xs" /> : x.ic === "voz" ? <IcVolume tam={16} /> : x.ic === "texto" ? <IcHash tam={16} /> : <span className="busca-ponto" />}</span>
                <b>{x.nome}</b>
                <small>{x.tipo}</small>
              </button>
            </li>
          ))}
          {!achados.length && <li className="busca-nada">Nada com “{q}”.</li>}
        </ul>
        <p className="busca-dica">
          <kbd>↑</kbd> <kbd>↓</kbd> para escolher · <kbd>Enter</kbd> para ir · <kbd>Esc</kbd> para fechar
        </p>
      </div>
    </div>
  );
}
