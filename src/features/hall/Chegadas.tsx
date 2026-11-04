"use client";
/*
 * "Fulano entrou!": no canto de cima, à esquerda do K-FOFO (embaixo do "Na sala agora"), quem acabou de abrir o
 * site. Vem da presença do lobby (todo mundo online, em qualquer aba), acompanhada fora do React por
 * `iniciarChegadas`. Não avisa a lista que chega ao entrar, nem a mim, nem quem só piscou (caiu e voltou em menos
 * de 2 min). Cada aviso some em 6 s; no máximo 3. Cada chegada toca a campainha (somDeChegada, em live/sonsVoz.ts).
 * "Fulano saiu": quem fechou o site e não voltou em 20 s (troca de aba e reconexão não contam); depois desse aviso,
 * a volta já conta como "entrou".
 */
import { create } from "zustand";
import { Avatar } from "@/components/ui/Avatar";
import { somDeChegada } from "@/features/live/sonsVoz";
import { useAjustesVoz } from "@/features/live/voz";
import { friendOf, getApp, useApp } from "@/lib/store";

const MOSTRA_MS = 6000;
/** sumiu e voltou dentro disso: é a mesma visita (troca de aba, reconexão) */
const PISCOU_MS = 120_000;
/** a lista que já está online quando eu chego não conta como "entrou" */
const ESPERA_MS = 8000;
/** quanto esperar para dizer que alguém saiu (uma reconexão volta antes disso) */
const SAIU_MS = 20_000;

type Chegada = { id: number; fid: string; saiu?: boolean };
const useChegadas = create<{ avisos: Chegada[] }>()(() => ({ avisos: [] }));

let ligado = false;
let proxId = 1;
let inicio = 0;
let antes = new Set<string>();
/** quando cada um saiu (para saber se só piscou) */
const saiu = new Map<string, number>();

function mostrar(itens: Chegada[]) {
  useChegadas.setState((s) => ({ avisos: [...itens, ...s.avisos].slice(0, 3) }));
  setTimeout(() => useChegadas.setState((s) => ({ avisos: s.avisos.filter((x) => !itens.some((i) => i.id === x.id)) })), MOSTRA_MS);
}

function conferir() {
  const { online, myFid } = getApp();
  const agora = Date.now();
  const atuais = new Set(online.map((p) => p.fid).filter((f): f is string => !!f));
  for (const fid of antes)
    if (!atuais.has(fid) && fid !== myFid) {
      saiu.set(fid, agora);
      setTimeout(() => {
        /* voltou no meio do caminho, ou saiu de novo depois: não é este aviso */
        if (antes.has(fid) || saiu.get(fid) !== agora) return;
        saiu.set(fid, 0);
        mostrar([{ id: proxId++, fid, saiu: true }]);
      }, SAIU_MS);
    }
  const novos: string[] = [];
  for (const fid of atuais) {
    if (antes.has(fid) || fid === myFid || agora - inicio < ESPERA_MS) continue;
    const quando = saiu.get(fid);
    if (quando === undefined || agora - quando > PISCOU_MS) novos.push(fid);
  }
  antes = atuais;
  if (!novos.length) return;
  /* o som avisa mesmo com o site em outra aba: entrou mais um nanico */
  somDeChegada(useAjustesVoz.getState().geral);
  mostrar(novos.map((fid) => ({ id: proxId++, fid })));
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
          <div key={a.id} className={"hall-chegada" + (a.saiu ? " saiu" : "")}>
            <Avatar f={f} size="xs" />
            <span>
              <b>{f.name}</b> {a.saiu ? "saiu" : "entrou!"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
