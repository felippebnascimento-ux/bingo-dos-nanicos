"use client";
/* Meus links no Perfil (Twitch, YouTube, Instagram, TikTok, X, Faceit, Leetify): aparecem na minha ficha. */
import { useState } from "react";
import { linksDe, salvarLinkPerfil, useMidias } from "@/features/midias/midiasDados";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cleanLink, TIPOS_LINK, type TipoLink } from "./links";

export function CampoLinks() {
  const ok = useMidias((s) => s.ok);
  const links = useMidias((s) => s.links);
  const myFid = useApp((s) => s.myFid);
  const [rascunho, setRascunho] = useState<Partial<Record<TipoLink, string>>>({});
  const [salvando, setSalvando] = useState<TipoLink | null>(null);
  if (!ok) return null;
  const meus = linksDe(links, myFid);
  const atual = (t: TipoLink) => meus.find((l) => l.tipo === t)?.url ?? "";

  const salvar = async (t: TipoLink) => {
    const def = TIPOS_LINK.find((x) => x.tipo === t)!;
    const url = cleanLink(t, rascunho[t] ?? atual(t));
    if (url === null) return toast(`Esse link não é de um perfil do ${def.nome}. Use assim: ${def.exemplo}`);
    if (url === atual(t)) return;
    setSalvando(t);
    if (await salvarLinkPerfil(t, url)) {
      toast(url ? `${def.nome} salvo` : "Link tirado");
      setRascunho((r) => ({ ...r, [t]: undefined }));
    }
    setSalvando(null);
  };

  return (
    <details className="perfil-links" open={meus.length > 0}>
      <summary>Meus links {meus.length > 0 && `(${meus.length})`}</summary>
      <p className="hint">Aparecem na sua ficha. Deixe vazio e salve para tirar.</p>
      {TIPOS_LINK.map((d) => (
        <form
          key={d.tipo}
          className="perfil-link"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void salvar(d.tipo);
          }}
        >
          <label className="lbl" htmlFor={"link-" + d.tipo}>
            {d.nome}
          </label>
          <div className="row">
            <input
              id={"link-" + d.tipo}
              type="url"
              inputMode="url"
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              placeholder={d.exemplo}
              value={rascunho[d.tipo] ?? atual(d.tipo)}
              onChange={(e) => setRascunho((r) => ({ ...r, [d.tipo]: e.target.value }))}
            />
            <button className="btn soft sm" type="submit" disabled={salvando === d.tipo}>
              Salvar
            </button>
          </div>
        </form>
      ))}
    </details>
  );
}
