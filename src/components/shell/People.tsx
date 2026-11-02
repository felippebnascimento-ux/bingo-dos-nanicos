"use client";
import { Avatar } from "@/components/ui/Avatar";
import { CamNaSala } from "@/features/live/CamNaSala";
import { assistir } from "@/features/live/live";
import { bingoLines } from "@/lib/bingo";
import { friendDaPresenca, MY_KEY, setApp, useApp } from "@/lib/store";
import type { Presence } from "@/lib/tipos";
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

/** Quem está na sala agora, comigo primeiro e o resto em ordem alfabética (usado aqui e no Sítio). */
export function usePessoasNaSala(): Presence[] {
  const online = useApp((s) => s.online);
  const myName = useApp((s) => s.myName);
  const myFid = useApp((s) => s.myFid);
  const card = useApp((s) => s.card);
  const myLiveSid = useApp((s) => s.myLiveSid);
  const myCamSid = useApp((s) => s.myCamSid);
  const list: Presence[] = online.slice();
  if (myName && !list.some((p) => p.key === MY_KEY))
    list.unshift({ key: MY_KEY, name: myName, fid: myFid, lines: bingoLines(card), live: myLiveSid, cam: myCamSid, pos: null, at: 0 });
  return list.sort((a, b) => (a.key === MY_KEY ? -1 : b.key === MY_KEY ? 1 : String(a.name).localeCompare(String(b.name), "pt-BR")));
}

/** "Na sala agora": quem está com o site aberto, com BINGO e AO VIVO. No Sítio, a lista fica no canto do hall. */
export function People() {
  const friends = useApp((s) => s.friends);
  const noSitio = useApp((s) => s.aba === "hall");
  const list = usePessoasNaSala();
  if (noSitio) return null;

  return (
    <section className="room" aria-labelledby="roomTitle">
      <h3 id="roomTitle">
        <span className="dot" aria-hidden="true" />
        <span id="roomCount">Na sala agora ({list.length})</span>
      </h3>
      <ul className="people" id="people">
        {list.length ? (
          list.map((p) => {
            const f = friendDaPresenca(p, friends);
            const nm = f ? f.name : p.name,
              eu = p.key === MY_KEY;
            const titulo = p.live ? (eu ? "Ver a sua transmissão" : `Assistir a tela de ${nm}`) : nm;
            const pic = f ? (
              <Avatar f={f} />
            ) : (
              <span className="u" style={{ ["--h" as string]: hueOf(p.name) }} aria-hidden="true">
                {initials(p.name)}
              </span>
            );
            return (
              <li
                key={p.key}
                data-key={p.key}
                className={(eu ? "me" : "") + (p.live ? " live" : "")}
                title={titulo}
                {...(p.live
                  ? {
                      "data-live": p.key,
                      role: "button",
                      tabIndex: 0,
                      "aria-label": titulo,
                      onClick: () => goWatch(p.key),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goWatch(p.key);
                        }
                      },
                    }
                  : {})}
              >
                <CamNaSala personKey={p.key} nome={nm}>
                  {pic}
                </CamNaSala>
                <span className="who">
                  {nm}
                  {eu && (
                    <>
                      {" "}
                      <span className="you">(você)</span>
                    </>
                  )}
                </span>
                {p.live && <span className="live-pill">AO VIVO</span>}
                {p.lines > 0 && <span className="bingo-pill">BINGO{p.lines > 1 ? " ×" + p.lines : ""}</span>}
              </li>
            );
          })
        ) : (
          <li className="status">Ninguém por aqui ainda.</li>
        )}
      </ul>
    </section>
  );
}
