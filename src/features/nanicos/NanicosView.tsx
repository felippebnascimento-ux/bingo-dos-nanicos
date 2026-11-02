"use client";
/* Aba Nanicos: os 14 com a arte de corpo inteiro. Tocar num nanico abre a ficha dele (features/ficha). */
import { TituloNanico } from "@/features/loja/Itens";
import { ChamaNome } from "@/features/ficha/NoSitio";
import { Avatar } from "@/components/ui/Avatar";
import { fecharSeletores } from "@/components/ui/FriendPicker";
import { artOf } from "@/lib/dados/nanicos";
import { setApp, useApp } from "@/lib/store";
import { rolarAte } from "@/lib/util";

/** Abre a aba Nanicadas já filtrada na pessoa. */
export function verNanicadas(fid: string) {
  fecharSeletores();
  setApp({ nanicadasFiltro: fid || null, nanicadasBusca: "", aba: "frases" });
  /* espera a aba aparecer para conseguir rolar até a lista */
  setTimeout(() => rolarAte(document.querySelector("#view-frases .list-block")), 0);
}

export function NanicosView({ hidden }: { hidden: boolean }) {
  const friends = useApp((s) => s.friends);
  const phrases = useApp((s) => s.phrases);
  return (
    <section id="view-nanicos" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Os Nanicos</h1>
      </header>
      <div className="block nan-block">
        <div className="nanicos" id="listaAmigos">
          {friends.length ? (
            friends.map((f) => {
              const n = phrases.filter((p) => p.friendIds.includes(f.id)).length;
              const art = artOf(f);
              return (
                <button
                  key={f.id}
                  type="button"
                  className="nanico"
                  aria-label={`Abrir a ficha de ${f.name}`}
                  title={`Abrir a ficha de ${f.name}`}
                  onClick={() => setApp({ fichaAberta: f.id })}
                >
                  <strong>
                    {f.name}
                    <ChamaNome fid={f.id} />
                    <TituloNanico userId={f.user_id} />
                  </strong>
                  {art ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="body" src={art.full} width={art.w} height={art.h} alt={f.name} />
                  ) : (
                    <div className="body none">
                      <Avatar f={f} size="lg" />
                    </div>
                  )}
                  <span className="status">
                    {n} nanicada{n === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="status" style={{ gridColumn: "1/-1", textAlign: "center", padding: "20px 0" }}>
              Nenhum nanico cadastrado ainda.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
