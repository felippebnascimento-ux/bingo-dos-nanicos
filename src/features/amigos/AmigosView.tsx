"use client";
/* Aba Amigos: os amigos dos nanicos (friends.tipo = 'amigo', seção 39), com a arte de corpo inteiro, online ou
   offline e quem convidou. Tocar abre a ficha. Quem está em AMIGOS mas ainda não tem linha no banco aparece
   "chega logo", sem abrir a ficha. Some do menu sem amigos. */
import { useNanicosOnline } from "@/components/shell/People";
import { TituloNanico } from "@/features/loja/Itens";
import { ChamaNome } from "@/features/ficha/NoSitio";
import { AMIGOS, artOf, soAmigos } from "@/lib/dados/nanicos";
import { friendOf, setApp, useApp } from "@/lib/store";
import { norm } from "@/lib/util";

export function AmigosView({ hidden }: { hidden: boolean }) {
  const friends = useApp((s) => s.friends);
  const online = useNanicosOnline();
  const amigos = soAmigos(friends);
  /* os que já têm arte mas ainda não têm linha no banco */
  const chegando = Object.entries(AMIGOS).filter(([chave]) => !friends.some((f) => norm(f.name) === chave));
  return (
    <section id="view-amigos" className="inner" hidden={hidden}>
      <header className="hero">
        <h1>Amigos dos Nanicos</h1>
        <p>Quem não é um dos 14 mas faz parte da resenha: tem boneco no K-FOFO, moedas, cassino, loja e truco.</p>
      </header>
      <div className="block nan-block">
        <div className="nanicos">
          {amigos.map((f) => {
            const art = artOf(f);
            const on = online.some((p) => p.fid === f.id);
            const quem = friendOf(f.convidado_por ?? null, friends);
            return (
              <button
                key={f.id}
                type="button"
                className="nanico"
                aria-label={`Abrir a ficha de ${f.name}${on ? ", online" : ""}`}
                title={`Abrir a ficha de ${f.name}`}
                onClick={() => setApp({ fichaAberta: f.id })}
              >
                <strong>
                  {f.name}
                  <ChamaNome fid={f.id} />
                  <TituloNanico userId={f.user_id} />
                </strong>
                {art && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="body" src={art.full} width={art.w} height={art.h} alt={f.name} />
                )}
                <span className={"status amigo-status" + (on ? " on" : "")}>
                  {on ? "online" : "offline"}
                  {quem && ` · amigo do ${quem.name}`}
                </span>
              </button>
            );
          })}
          {chegando.map(([chave, a]) => {
            const art = artOf({ name: a.nome });
            return (
              <div key={chave} className="nanico">
                <strong>{a.nome}</strong>
                {art && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="body" src={art.full} width={art.w} height={art.h} alt={a.nome} />
                )}
                <span className="status">chega logo</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
