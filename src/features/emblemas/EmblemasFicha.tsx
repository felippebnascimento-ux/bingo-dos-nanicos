"use client";
/* Bloco "Emblemas" da ficha: os conquistados (com o nível no aro) e os respeitos recebidos. */
import { useEffect } from "react";
import { Emblema } from "./Emblema";
import { carregarEmblemas, useEmblemas } from "./emblemasDados";

export function EmblemasFicha({ fid }: { fid: string }) {
  const lista = useEmblemas((s) => s.emblemas[fid]?.lista);
  const recebidos = useEmblemas((s) => (s.recebidos ? (s.recebidos[fid] ?? 0) : null));
  useEffect(() => {
    void carregarEmblemas(fid);
  }, [fid]);
  return (
    <section className="ficha-sec ficha-emblemas" aria-labelledby={"emb-" + fid}>
      <h3 id={"emb-" + fid}>
        Emblemas
        {recebidos !== null && (
          <small>
            {" "}
            · <span className="perfil-coracao">♥</span> {recebidos} {recebidos === 1 ? "respeito" : "respeitos"}
          </small>
        )}
      </h3>
      <div className="perfil-emblemas">
        {lista === undefined ? <small className="hint">Carregando…</small> : lista.length ? lista.map((e) => <Emblema key={e.id} e={e} tam={44} />) : <small className="hint">Nenhum emblema ainda.</small>}
      </div>
    </section>
  );
}
