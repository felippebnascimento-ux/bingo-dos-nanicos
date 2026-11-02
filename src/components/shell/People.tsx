"use client";
import { useEffect, useState } from "react";
import { ChamaNome } from "@/features/ficha/NoSitio";
import { Avatar } from "@/components/ui/Avatar";
import { IcVoltar } from "@/components/ui/icones";
import { CamNaSala } from "@/features/live/CamNaSala";
import { assistir } from "@/features/live/live";
import { nomeDaSala } from "@/features/salas/trocar";
import { bingoLines } from "@/lib/bingo";
import { umPorNanico, type PresencaNanico } from "@/lib/presenca";
import { friendDaPresenca, MY_KEY, setApp, useApp } from "@/lib/store";
import type { Friend, Presence } from "@/lib/tipos";
import { ehCelular, hueOf, initials, local, rolarAte } from "@/lib/util";

/** Clicar em quem está ao vivo na lista da sala: abre a aba Ao vivo já na tela da pessoa. */
export function goWatch(key: string) {
  setApp({ aba: "live" });
  if (key !== MY_KEY) assistir(key, true);
  else {
    setApp({ railTab: "telas" });
    local.set("rail-tab", "telas");
  }
  if (ehCelular()) setTimeout(() => rolarAte(document.getElementById("stage")), 0);
}

/**
 * Quem está na sala agora, comigo primeiro e o resto em ordem alfabética.
 * Só quem está na minha sala (ou no lobby, se eu estiver nele); com `todos`, o site inteiro (Sítio).
 */
export function usePessoasNaSala(todos = false): Presence[] {
  const online = useApp((s) => s.online);
  const minhaSala = useApp((s) => s.minhaSala);
  const myName = useApp((s) => s.myName);
  const myFid = useApp((s) => s.myFid);
  const card = useApp((s) => s.card);
  const myLiveSid = useApp((s) => s.myLiveSid);
  const myCamSid = useApp((s) => s.myCamSid);
  /* um por nanico: as várias abas de alguém viram uma linha só */
  const juntos = umPorNanico(online, MY_KEY);
  const list: Presence[] = todos ? juntos : juntos.filter((p) => p.sala === minhaSala || p.key === MY_KEY);
  if (myName && !list.some((p) => p.key === MY_KEY))
    list.unshift({ key: MY_KEY, name: myName, fid: myFid, lines: bingoLines(card), live: myLiveSid, cam: myCamSid, pos: null, sala: minhaSala, at: 0 });
  return list.sort((a, b) => (a.key === MY_KEY ? -1 : b.key === MY_KEY ? 1 : String(a.name).localeCompare(String(b.name), "pt-BR")));
}

/**
 * Todo mundo com o site aberto, um por nanico, comigo incluído. O meu item usa o meu estado
 * (sala, tela, câmera, voz, canal de texto), que chega antes da presença voltar do canal.
 */
export function useNanicosOnline(): PresencaNanico[] {
  const online = useApp((s) => s.online);
  const myName = useApp((s) => s.myName);
  const myFid = useApp((s) => s.myFid);
  const card = useApp((s) => s.card);
  const sala = useApp((s) => s.minhaSala);
  const live = useApp((s) => s.myLiveSid);
  const cam = useApp((s) => s.myCamSid);
  const voz = useApp((s) => s.myVozSid);
  const mudo = useApp((s) => s.vozMudo);
  const surdo = useApp((s) => s.vozSurdo);
  const texto = useApp((s) => (s.aba === "chat" ? s.canalTexto : null));
  const lista = umPorNanico(online, MY_KEY);
  const meu = { sala, live: live ?? null, cam: cam ?? null, voz, mudo: !!voz && mudo, surdo: !!voz && surdo, texto };
  const i = lista.findIndex((p) => p.chaves.includes(MY_KEY));
  if (i >= 0) lista[i] = { ...lista[i], ...meu, live: live ?? lista[i].live, cam: cam ?? lista[i].cam, chaveCam: cam ? MY_KEY : lista[i].chaveCam };
  else if (myName)
    lista.unshift({ key: MY_KEY, name: myName, fid: myFid, lines: bingoLines(card), pos: null, at: 0, id: MY_KEY, chaves: [MY_KEY], chaveCam: cam ? MY_KEY : null, ...meu });
  return lista;
}

/** Uma pessoa na lista de membros: rosto (ou câmera), nome, onde está e o que está fazendo. */
/* quem está falando aparece só nos canais de voz (à esquerda), não aqui */
function Membro({ p, f }: { p: PresencaNanico | null; f: Friend | undefined }) {
  const salas = useApp((s) => s.salas);
  const minhaSala = useApp((s) => s.minhaSala);
  const nome = f?.name ?? p?.name ?? "";
  const eu = !!p?.chaves.includes(MY_KEY);
  const online = !!p;
  /* a tela só dá para assistir de dentro da mesma sala */
  const assiste = !!p?.live && p.sala === minhaSala;
  const titulo = assiste ? (eu ? "Ver a sua transmissão" : `Assistir a tela de ${nome}`) : `Ver a ficha de ${nome}`;
  const abrir = () => {
    if (assiste && p) goWatch(p.key);
    else if (f) setApp({ fichaAberta: f.id });
  };
  const onde = !p ? null : p.sala ? (nomeDaSala(p.sala, salas) ?? "Numa sala") : salas.length ? "No lobby" : null;
  const pic = f ? (
    <Avatar f={f} />
  ) : (
    <span className="u" style={{ ["--h" as string]: hueOf(nome) }} aria-hidden="true">
      {initials(nome)}
    </span>
  );
  return (
    <li
      data-key={p?.key}
      className={(eu ? "me" : "") + (p?.live ? " live" : "") + (online ? "" : " offline")}
      title={titulo}
      role={f || assiste ? "button" : undefined}
      tabIndex={f || assiste ? 0 : undefined}
      aria-label={f || assiste ? titulo : undefined}
      onClick={f || assiste ? abrir : undefined}
      onKeyDown={(e) => {
        if ((f || assiste) && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          abrir();
        }
      }}
    >
      {p ? (
        <CamNaSala personKey={p.chaveCam ?? p.key} nome={nome}>
          {pic}
        </CamNaSala>
      ) : (
        pic
      )}
      <span className="who">
        <span className="nm">
          {nome}
          <ChamaNome fid={f?.id} />
          {eu && (
            <>
              {" "}
              <span className="you">(você)</span>
            </>
          )}
        </span>
        {onde && (
          <small className="onde">
            {onde}
          </small>
        )}
      </span>
      {p?.live && <span className="live-pill">AO VIVO</span>}
      {!!p?.lines && <span className="bingo-pill">BINGO{p.lines > 1 ? " ×" + p.lines : ""}</span>}
    </li>
  );
}

/** Abaixo desta largura a lista fica só com os rostos (sobra pouco espaço para o conteúdo). */
const ESTREITA = "(max-width: 1199px)";
function useEstreita() {
  const [v, setV] = useState(() => matchMedia(ESTREITA).matches);
  useEffect(() => {
    const mq = matchMedia(ESTREITA);
    const fn = () => setV(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return v;
}

/**
 * Membros (barra da direita, como no Discord): os 14 nanicos, primeiro quem está online e depois
 * quem está offline. Com a câmera no círculo, AO VIVO (clica para assistir), BINGO e onde cada um está.
 * Some no Nanico Hotel (ele tem a própria lista no canto).
 */
export function Membros() {
  const friends = useApp((s) => s.friends);
  const min = useApp((s) => s.membrosMin);
  const estreita = useEstreita();
  const pessoas = useNanicosOnline();

  useEffect(() => {
    document.body.classList.toggle("membros-min", min || estreita);
  }, [min, estreita]);

  const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");
  const linhas = pessoas.map((p) => {
    const f = friendDaPresenca(p, friends);
    return { p, f, nome: f?.name ?? p.name };
  });
  /* eu primeiro; depois quem está online em ordem de nome */
  const online = linhas.sort((a, b) => (a.p.chaves.includes(MY_KEY) ? -1 : b.p.chaves.includes(MY_KEY) ? 1 : porNome(a, b)));
  const offline = friends
    .filter((f) => !linhas.some((l) => l.f?.id === f.id))
    .map((f) => ({ p: null, f, nome: f.name }))
    .sort(porNome);

  return (
    <aside className="membros" aria-label="Membros">
      <button
        className="membros-toggle"
        type="button"
        hidden={estreita}
        aria-expanded={!min}
        aria-label={min ? "Abrir a lista de membros" : "Recolher a lista de membros"}
        title={min ? "Abrir a lista de membros" : "Recolher a lista de membros"}
        onClick={() => {
          setApp({ membrosMin: !min });
          local.set("membros-min", min ? "0" : "1");
        }}
      >
        <IcVoltar />
      </button>
      <h3>
        <span className="dot" aria-hidden="true" />
        <span className="t">Online — </span>
        {online.length}
      </h3>
      <ul className="people">
        {online.map(({ p, f }) => (
          <Membro key={p.id} p={p} f={f} />
        ))}
      </ul>
      {offline.length > 0 && (
        <>
          <h3>
            <span className="t">Offline — </span>
            {offline.length}
          </h3>
          <ul className="people">
            {offline.map(({ f }) => (
              <Membro key={f.id} p={null} f={f} />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
