"use client";
/*
 * O navegador de quartos (como o do Habbo): o botão no K-FOFO abre a lista dos quartos de todo mundo, com quem está
 * lá agora e as curtidas; "Ir" teletransporta. E o botão de curtir no topo do quarto de outra pessoa.
 */
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { umPorNanico } from "@/lib/presenca";
import { MY_KEY, useApp } from "@/lib/store";
import { curtirQuarto, iniciarCurtidas, ordenarQuartos, useCurtidas, type LinhaNavegador } from "./navegador";
import { iniciarQuartos, useQuartos } from "./quartoDados";
import { irParaQuarto } from "./visita";

export function BotaoNavegador() {
  return (
    <button type="button" className="btn soft sm" onClick={() => useCurtidas.setState({ aberto: true })}>
      Navegador de quartos
    </button>
  );
}

export function NavegadorJanela() {
  const aberto = useCurtidas((s) => s.aberto);
  return aberto ? <Janela /> : null;
}

function Janela() {
  const quartos = useQuartos((s) => s.quartos);
  const curtidas = useCurtidas((s) => s.lista);
  const friends = useApp((s) => s.friends);
  const online = useApp((s) => s.online);
  const [por, setPor] = useState<"gente" | "curtidas">("gente");
  useEffect(() => {
    void iniciarQuartos();
    iniciarCurtidas();
  }, []);
  const fechar = () => useCurtidas.setState({ aberto: false });
  const linhas = useMemo(() => {
    const gente = umPorNanico(online, MY_KEY);
    const out: LinhaNavegador[] = [];
    for (const [uid, tamanho] of Object.entries(quartos)) {
      const f = friends.find((x) => x.user_id === uid);
      if (!f) continue;
      out.push({ uid, fid: f.id, nome: f.name, tamanho, agora: gente.filter((p) => p.quarto === f.id).length, curtidas: curtidas.filter((c) => c.dono === uid).length });
    }
    return ordenarQuartos(out, por);
  }, [quartos, friends, online, curtidas, por]);

  return (
    <div className="gate navegador-gate" role="dialog" aria-modal="true" aria-label="Navegador de quartos" onKeyDown={(e) => e.key === "Escape" && fechar()} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="navegador">
        <header className="troca-topo">
          <b>Navegador de quartos</b>
          <button type="button" className="perfil-fechar" aria-label="Fechar" onClick={fechar}>
            ×
          </button>
        </header>
        <div className="seg" role="radiogroup" aria-label="Ordem">
          <button type="button" role="radio" aria-checked={por === "gente"} className={por === "gente" ? "on" : undefined} onClick={() => setPor("gente")}>
            Com gente agora
          </button>
          <button type="button" role="radio" aria-checked={por === "curtidas"} className={por === "curtidas" ? "on" : undefined} onClick={() => setPor("curtidas")}>
            Mais curtidos
          </button>
        </div>
        {!linhas.length && <p className="hint">Ninguém comprou quarto ainda. Ele está na Loja.</p>}
        <ol className="navegador-lista">
          {linhas.map((l, k) => {
            const f = friends.find((x) => x.id === l.fid);
            return (
              <li key={l.uid}>
                {por === "curtidas" && <span className="navegador-pos">{k + 1}º</span>}
                {f && <Avatar f={f} size="xs" />}
                <span className="navegador-nome">
                  <b>Quarto do {l.nome}</b>
                  <small>
                    {l.tamanho}×{l.tamanho} · ♥ {l.curtidas}
                    {l.agora > 0 && ` · ${l.agora} ${l.agora === 1 ? "pessoa" : "pessoas"} agora`}
                  </small>
                </span>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    fechar();
                    irParaQuarto(l.fid);
                  }}
                >
                  Ir
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** ♥ no topo do quarto de outra pessoa: curte e descurte (o dono vê só a contagem). */
export function CurtirQuarto({ dono }: { dono: string }) {
  const f = useApp((s) => s.friends.find((x) => x.id === dono));
  const myUid = useApp((s) => s.myUid);
  const lista = useCurtidas((s) => s.lista);
  useEffect(iniciarCurtidas, []);
  if (!f?.user_id) return null;
  const doQuarto = lista.filter((c) => c.dono === f.user_id);
  const curti = doQuarto.some((c) => c.quem === myUid);
  if (f.user_id === myUid) return <span className="status">♥ {doQuarto.length}</span>;
  return (
    <button type="button" className={"btn soft sm" + (curti ? " on" : "")} aria-pressed={curti} onClick={() => void curtirQuarto(dono, !curti)}>
      {curti ? "♥ Curtido" : "♡ Curtir"} · {doQuarto.length}
    </button>
  );
}
