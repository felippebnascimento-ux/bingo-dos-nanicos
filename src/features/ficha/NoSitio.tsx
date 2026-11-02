"use client";
/* Bloco "No Sítio" da ficha: dias seguidos (com chama), recorde e tempo online de hoje, da semana e total. */
import { useEffect } from "react";
import { IcChama } from "@/components/ui/icones";
import { diasSeguidos, faltaParaPremio, sequenciaEmRisco, textoTempo } from "@/lib/moedas";
import { carregarPresenca, carregarPresencaTodos, usePresenca } from "./presenca";

/** 2026-11-02 → "segunda" */
const diaDaSemana = (dia: string) => new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");

export function NoSitio({ fid, eu }: { fid: string; eu: boolean }) {
  const p = usePresenca((s) => s.de[fid]);
  useEffect(() => {
    carregarPresenca(fid);
    const t = setInterval(() => carregarPresenca(fid), 2 * 60_000);
    return () => clearInterval(t);
  }, [fid]);
  /* sem o SQL (ou antes de chegar), o bloco não aparece */
  if (!p) return null;
  const falta = eu ? faltaParaPremio(p.seq) : null;
  const semanaMin = p.semana.reduce((s, d) => s + d.min, 0);
  const maior = Math.max(60, ...p.semana.map((d) => d.min));
  return (
    <section className="ficha-sec no-sitio" aria-labelledby={`noSitio-${fid}`}>
      <h3 id={`noSitio-${fid}`}>No K-FOFO</h3>
      <div className="no-sitio-seq">
        <IcChama tam={34} className={p.seq ? "acesa" : undefined} />
        <div>
          <b>{p.seq ? diasSeguidos(p.seq) : "Sem sequência"}</b>
          <small>
            recorde: {p.recorde} {p.recorde === 1 ? "dia" : "dias"}
            {sequenciaEmRisco(p.seq, p.pegouHoje) && " · entra hoje para não perder"}
          </small>
          {falta && (
            <small>
              Faltam {falta.dias} {falta.dias === 1 ? "dia" : "dias"} para o prêmio de {falta.premio} dias
            </small>
          )}
        </div>
      </div>
      <dl className="no-sitio-tempo">
        <div>
          <dt>Hoje</dt>
          <dd>{textoTempo(p.hojeMin)}</dd>
        </div>
        <div>
          <dt>7 dias</dt>
          <dd>{textoTempo(semanaMin)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{textoTempo(p.totalMin)}</dd>
        </div>
      </dl>
      <div className="no-sitio-barras">
        {[...p.semana].reverse().map((d) => (
          <span key={d.dia} role="img" aria-label={`${diaDaSemana(d.dia)}: ${textoTempo(d.min)}`} title={`${diaDaSemana(d.dia)}: ${textoTempo(d.min)}`}>
            <i style={{ ["--h" as string]: `${Math.round((d.min / maior) * 100)}%` }} />
            <small aria-hidden="true">{diaDaSemana(d.dia).slice(0, 3)}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

/** Chama pequena ao lado do nome (só a partir de 3 dias seguidos). */
export function ChamaNome({ fid }: { fid: string | null | undefined }) {
  const c = usePresenca((s) => (fid && s.todos ? s.todos[fid] : undefined));
  useEffect(() => {
    carregarPresencaTodos();
  }, []);
  if (!c || c.seq < 3) return null;
  return (
    <span className="chama-nome" title={diasSeguidos(c.seq)} aria-label={diasSeguidos(c.seq)}>
      <IcChama tam={12} />
      {c.seq}
    </span>
  );
}
