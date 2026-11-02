"use client";
/* Placar da zoeira na ficha: quantas chineladas e tortas a pessoa deu e levou nos últimos 7 dias. */
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);

export function PlacarZoeira({ fid }: { fid: string }) {
  const [placar, setPlacar] = useState<{ fid: string; deu: number; levou: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    sb()
      .rpc("placar_zoeira", { p_friend: fid })
      .then(({ data, error }) => {
        const o = (data || {}) as Record<string, unknown>;
        if (vivo && !error) setPlacar({ fid, deu: num(o.deu), levou: num(o.levou) });
      });
    return () => {
      vivo = false;
    };
  }, [fid]);
  /* sem o SQL (ou antes de chegar), não aparece */
  if (!placar || placar.fid !== fid) return null;
  return (
    <section className="ficha-sec placar-zoeira" aria-label="Zoeira da semana">
      <h3>Zoeira da semana</h3>
      <dl className="no-sitio-tempo">
        <div>
          <dt>Deu</dt>
          <dd>{placar.deu}</dd>
        </div>
        <div>
          <dt>Levou</dt>
          <dd>{placar.levou}</dd>
        </div>
      </dl>
    </section>
  );
}
