"use client";
/*
 * "Fulano entrou!": no canto de cima, à esquerda do K-FOFO (embaixo do "Na sala agora"), quem acabou de abrir o
 * site. Vem da presença do lobby (todo mundo online, em qualquer aba), acompanhada fora do React por
 * `iniciarChegadas`. Não avisa a lista que chega ao entrar, nem a mim, nem quem só piscou (caiu e voltou em menos
 * de 2 min). Cada aviso some em 6 s; no máximo 3.
 */
import { create } from "zustand";
import { Avatar } from "@/components/ui/Avatar";
import { friendOf, getApp, useApp } from "@/lib/store";

const MOSTRA_MS = 6000;
/** sumiu e voltou dentro disso: é a mesma visita (troca de aba, reconexão) */
const PISCOU_MS = 120_000;
/** a lista que já está online quando eu chego não conta como "entrou" */
const ESPERA_MS = 8000;

type Chegada = { id: number; fid: string };
const useChegadas = create<{ avisos: Chegada[] }>()(() => ({ avisos: [] }));

let ligado = false;
let proxId = 1;
let inicio = 0;
let antes = new Set<string>();
/** quando cada um saiu (para saber se só piscou) */
const saiu = new Map<string, number>();

function conferir() {
  const { online, myFid } = getApp();
  const agora = Date.now();
  const atuais = new Set(online.map((p) => p.fid).filter((f): f is string => !!f));
  for (const fid of antes) if (!atuais.has(fid)) saiu.set(fid, agora);
  const novos: string[] = [];
  for (const fid of atuais) {
    if (antes.has(fid) || fid === myFid || agora - inicio < ESPERA_MS) continue;
    const quando = saiu.get(fid);
    if (quando === undefined || agora - quando > PISCOU_MS) novos.push(fid);
  }
  antes = atuais;
  if (!novos.length) return;
  const itens = novos.map((fid) => ({ id: proxId++, fid }));
  useChegadas.setState((s) => ({ avisos: [...itens, ...s.avisos].slice(0, 3) }));
  setTimeout(() => useChegadas.setState((s) => ({ avisos: s.avisos.filter((x) => !itens.some((i) => i.id === x.id)) })), MOSTRA_MS);
}

/** Começa a acompanhar quem entra (chamado uma vez pelo K-FOFO). */
export function iniciarChegadas() {
  if (ligado) return;
  ligado = true;
  inicio = Date.now();
  useApp.subscribe((s, a) => {
    if (s.online !== a.online) conferir();
  });
}

export function Chegadas() {
  const avisos = useChegadas((s) => s.avisos);
  const friends = useApp((s) => s.friends);
  if (!avisos.length) return null;
  return (
    <div className="hall-chegadas" aria-live="polite">
      {avisos.map((a) => {
        const f = friendOf(a.fid, friends);
        if (!f) return null;
        return (
          <div key={a.id} className="hall-chegada">
            <Avatar f={f} size="xs" />
            <span>
              <b>{f.name}</b> entrou!
            </span>
          </div>
        );
      })}
    </div>
  );
}
