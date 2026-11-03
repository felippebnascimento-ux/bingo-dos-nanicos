"use client";
/*
 * Grupos (seção 61): o botão no K-FOFO abre a lista (com os membros de cada um), entrar e sair, e criar o meu
 * (500 moedas). O SeloGrupo mostra o grupo de alguém no cartão do perfil.
 */
import { useEffect, useState } from "react";
import { useSure } from "@/components/ui/useSure";
import { useApp } from "@/lib/store";
import { CORES_GRUPO, criarGrupo, entrarNoGrupo, grupoDe, iniciarGrupos, sairDoGrupo, SIMBOLOS, useGrupos, type CorGrupo, type Simbolo } from "./grupos";

export function BotaoGrupos() {
  return (
    <button type="button" className="btn soft sm" onClick={() => useGrupos.setState({ aberto: true })}>
      Grupos
    </button>
  );
}

export function SeloGrupo({ uid }: { uid: string | null | undefined }) {
  const grupos = useGrupos((s) => s.grupos);
  const membros = useGrupos((s) => s.membros);
  useEffect(iniciarGrupos, []);
  const g = grupoDe(uid, grupos, membros);
  if (!g) return null;
  return (
    <span className={"grupo-selo g-" + g.cor} title={`Grupo ${g.nome}`}>
      <span aria-hidden="true">{SIMBOLOS[g.simbolo]}</span> {g.nome}
    </span>
  );
}

export function GruposJanela() {
  const aberto = useGrupos((s) => s.aberto);
  return aberto ? <Janela /> : null;
}

function Janela() {
  const grupos = useGrupos((s) => s.grupos);
  const membros = useGrupos((s) => s.membros);
  const friends = useApp((s) => s.friends);
  const myUid = useApp((s) => s.myUid);
  const meu = grupoDe(myUid, grupos, membros);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<CorGrupo>("ouro");
  const [simbolo, setSimbolo] = useState<Simbolo>("estrela");
  const [indo, setIndo] = useState(false);
  const sair = useSure();
  useEffect(iniciarGrupos, []);
  const fechar = () => useGrupos.setState({ aberto: false });
  const nomesDe = (id: number) =>
    Object.entries(membros)
      .filter(([, g]) => g === id)
      .map(([uid]) => friends.find((f) => f.user_id === uid)?.name ?? "?");

  return (
    <div className="gate navegador-gate" role="dialog" aria-modal="true" aria-label="Grupos" onKeyDown={(e) => e.key === "Escape" && fechar()} onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="navegador">
        <header className="troca-topo">
          <b>Grupos</b>
          <button type="button" className="perfil-fechar" aria-label="Fechar" onClick={fechar}>
            ×
          </button>
        </header>
        {meu && (
          <p className="grupo-meu">
            Você é do <SeloGrupo uid={myUid} />{" "}
            <button type="button" className={"linkish" + (sair.sure ? " sure" : "")} onClick={() => sair.pedir() && void sairDoGrupo()}>
              {sair.sure ? "Confirmar" : meu.dono === myUid ? "Apagar o grupo" : "Sair do grupo"}
            </button>
          </p>
        )}
        {!grupos.length && <p className="hint">Nenhum grupo ainda. Crie o primeiro.</p>}
        <ol className="navegador-lista">
          {grupos.map((g) => (
            <li key={g.id}>
              <span className={"grupo-simbolo g-" + g.cor} aria-hidden="true">
                {SIMBOLOS[g.simbolo]}
              </span>
              <span className="navegador-nome">
                <b>{g.nome}</b>
                <small>{nomesDe(g.id).join(", ")}</small>
              </span>
              {!meu && (
                <button type="button" className="btn sm" onClick={() => void entrarNoGrupo(g.id)}>
                  Entrar
                </button>
              )}
            </li>
          ))}
        </ol>
        {!meu && (
          <form
            className="grupo-criar"
            onSubmit={async (e) => {
              e.preventDefault();
              if (indo || nome.trim().length < 2) return;
              setIndo(true);
              if (await criarGrupo(nome.trim(), cor, simbolo)) setNome("");
              setIndo(false);
            }}
          >
            <b>Criar um grupo (500 moedas)</b>
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={24} placeholder="Nome do grupo" aria-label="Nome do grupo" />
            <div className="seg" role="radiogroup" aria-label="Símbolo">
              {(Object.keys(SIMBOLOS) as Simbolo[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={simbolo === s} aria-label={s} className={simbolo === s ? "on" : undefined} onClick={() => setSimbolo(s)}>
                  {SIMBOLOS[s]}
                </button>
              ))}
            </div>
            <div className="seg" role="radiogroup" aria-label="Cor">
              {CORES_GRUPO.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={c} className={"grupo-cor g-" + c + (cor === c ? " on" : "")} onClick={() => setCor(c)} />
              ))}
            </div>
            <button type="submit" className="btn sm" disabled={indo || nome.trim().length < 2}>
              Criar grupo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
