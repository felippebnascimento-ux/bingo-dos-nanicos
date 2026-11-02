"use client";
/*
 * Cartão das missões do dia: no canto do Sítio (embaixo da carteira; dá para recolher) e no Perfil.
 * Só mostra o que o banco devolveu; quem conta e paga é minhas_missoes().
 */
import { useState } from "react";
import { local } from "@/lib/util";
import { useMissoes } from "./missoesDados";

export function Missoes({ canto = false }: { canto?: boolean }) {
  const { ok, missoes, bonus, bonusPago, novas } = useMissoes();
  const [aberto, setAberto] = useState(() => !canto || local.get("missoes-min") !== "1");
  if (!ok || !missoes.length) return null;
  const feitas = missoes.filter((m) => m.feita).length;
  const alternar = () => {
    const v = !aberto;
    setAberto(v);
    local.set("missoes-min", v ? null : "1");
  };
  return (
    <section className={(canto ? "hall-canto " : "block ") + "missoes" + (canto ? " no-canto" : "")} aria-label="Missões do dia">
      <button type="button" className="missoes-topo" aria-expanded={aberto} onClick={canto ? alternar : undefined} disabled={!canto}>
        <b>Missões do dia</b>
        <small>
          {feitas} de {missoes.length}
          {bonusPago ? " · bônus pago" : ` · todas: +${bonus}`}
        </small>
      </button>
      {aberto && (
        <ul>
          {missoes.map((m) => (
            <li key={m.id} className={(m.feita ? "feita" : "") + (novas.includes(m.id) ? " nova" : "")}>
              <span className="missao-ck" aria-hidden="true">
                {m.feita ? "✓" : ""}
              </span>
              <span className="missao-tx">
                <span>{m.texto}</span>
                {m.feita ? (
                  <small>{novas.includes(m.id) ? "Missão feita!" : "Feita"} · +{m.valor}</small>
                ) : (
                  <>
                    <span className="missao-barra" role="progressbar" aria-valuemin={0} aria-valuemax={m.meta} aria-valuenow={m.progresso} aria-label={m.texto}>
                      <i style={{ width: `${(m.progresso / m.meta) * 100}%` }} />
                    </span>
                    <small>
                      {m.progresso} de {m.meta} · +{m.valor}
                    </small>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
