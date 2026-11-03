"use client";
/* Aba Amigos: os amigos dos nanicos (não são um dos 14), com a arte de corpo inteiro. Tocar abre a ficha.
   Quem está em AMIGOS mas ainda não tem login aparece sem abrir a ficha. */
import { TituloNanico } from "@/features/loja/Itens";
import { ChamaNome } from "@/features/ficha/NoSitio";
import { AMIGOS, artOf } from "@/lib/dados/nanicos";
import { setApp, useApp } from "@/lib/store";
import { norm } from "@/lib/util";

export function AmigosView({ hidden }: { hidden: boolean }) {
  const friends = useApp((s) => s.friends);
  return (
    <section id="view-amigos" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Amigos dos Nanicos</h1>
      </header>
      <div className="block nan-block">
        <div className="nanicos">
          {Object.entries(AMIGOS).map(([chave, a]) => {
            const f = friends.find((x) => norm(x.name) === chave);
            const art = artOf({ name: a.nome });
            const corpo = (
              <>
                <strong>
                  {a.nome}
                  {f && <ChamaNome fid={f.id} />}
                  {f && <TituloNanico userId={f.user_id} />}
                </strong>
                {art && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="body" src={art.full} width={art.w} height={art.h} alt={a.nome} />
                )}
                <span className="status">{f ? "amigo dos nanicos" : "chega logo"}</span>
              </>
            );
            return f ? (
              <button
                key={chave}
                type="button"
                className="nanico"
                aria-label={`Abrir a ficha de ${a.nome}`}
                title={`Abrir a ficha de ${a.nome}`}
                onClick={() => setApp({ fichaAberta: f.id })}
              >
                {corpo}
              </button>
            ) : (
              <div key={chave} className="nanico">
                {corpo}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
